// api/crews.ts
// Study crews: create one, join with an invite code, see members' study
// hours, and join/leave the crew's live group-study room (max 4 people).
//
// Layout:
//   crews/{crewId}                     name, code, ownerUid, memberCount, createdAt
//   crews/{crewId}/members/{uid}       uid, joinedAt, role
//   crews/{crewId}/participants/{uid}  people in the live room (lastSeen heartbeat)
//   crews/{crewId}/signals/{id}        WebRTC connection messages between participants
//   users/{uid}/crews/{crewId}         crewId, joinedAt (so a user can list their crews)
//
// Only this route creates crews, members and participants. Clients may update
// their own participant heartbeat and exchange signals (see firestore.rules).

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpError, adminDb, rateLimit, requireUser, sendError } from "./_lib/admin";
import { computeStudyStats, parseTzOffsetMs } from "./_lib/stats";

const MAX_MEMBERS = 30;
const MAX_CREWS_PER_USER = 10;
const MAX_ROOM_SIZE = 4;
// A participant whose heartbeat is older than this has left (closed the app).
const ROOM_STALE_MS = 30 * 1000;
// No 0/O/1/I/L so codes are easy to read out and type.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

type Action = "create" | "join" | "leave" | "mine" | "detail" | "roomJoin" | "roomLeave";

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function validId(id: string) {
  return !!id && !id.includes("/") && id.length <= 128;
}

async function requireMember(db: Firestore, crewId: string, uid: string) {
  if (!validId(crewId)) throw new HttpError(400, "잘못된 요청이에요.");
  const [crew, member] = await Promise.all([
    db.collection("crews").doc(crewId).get(),
    db.collection("crews").doc(crewId).collection("members").doc(uid).get(),
  ]);
  if (!crew.exists) throw new HttpError(404, "크루를 찾을 수 없어요.");
  if (!member.exists) throw new HttpError(403, "크루 멤버만 볼 수 있어요.");
  return crew;
}

async function displayNames(db: Firestore, uids: string[]) {
  const names = new Map<string, string>();
  if (!uids.length) return names;
  const snaps = await db.getAll(...uids.map((u) => db.collection("users").doc(u)), {
    fieldMask: ["displayName"],
  });
  for (const snap of snaps) names.set(snap.id, String(snap.data()?.displayName || "User"));
  return names;
}

async function freshParticipants(db: Firestore, crewId: string, now: number) {
  const snap = await db.collection("crews").doc(crewId).collection("participants").get();
  return snap.docs
    .map((d) => d.data())
    .filter((p) => Number(p.lastSeen) >= now - ROOM_STALE_MS);
}

// Removes leftover connection messages to or from this user.
async function clearSignals(db: Firestore, crewId: string, uid: string) {
  const signals = db.collection("crews").doc(crewId).collection("signals");
  const [to, from] = await Promise.all([
    signals.where("to", "==", uid).get(),
    signals.where("from", "==", uid).get(),
  ]);
  const docs = [...to.docs, ...from.docs];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uid = await requireUser(req);
    const action = req.body?.action as Action;
    const crewId = String(req.body?.crewId || "");
    const db = adminDb();
    const crews = db.collection("crews");
    const myCrews = db.collection("users").doc(uid).collection("crews");

    if (action === "create") {
      await rateLimit(`crew-create:${uid}`, 10, 24 * 60 * 60 * 1000);

      const name = String(req.body?.name || "").trim().slice(0, 30);
      if (!name) throw new HttpError(400, "크루 이름을 입력해주세요.");

      const mine = await myCrews.count().get();
      if (mine.data().count >= MAX_CREWS_PER_USER) {
        throw new HttpError(400, `크루는 최대 ${MAX_CREWS_PER_USER}개까지 참여할 수 있어요.`);
      }

      let code = randomCode();
      for (let i = 0; i < 5; i++) {
        const taken = await crews.where("code", "==", code).limit(1).get();
        if (taken.empty) break;
        code = randomCode();
      }

      const now = Date.now();
      const crewRef = crews.doc();
      const batch = db.batch();
      batch.set(crewRef, { name, code, ownerUid: uid, memberCount: 1, createdAt: now });
      batch.set(crewRef.collection("members").doc(uid), { uid, joinedAt: now, role: "owner" });
      batch.set(myCrews.doc(crewRef.id), { crewId: crewRef.id, joinedAt: now });
      await batch.commit();

      return res.status(200).json({ crew: { id: crewRef.id, name, code } });
    }

    if (action === "join") {
      await rateLimit(`crew-join:${uid}`, 30, 60 * 60 * 1000);

      const code = String(req.body?.code || "").trim().toUpperCase();
      if (code.length !== CODE_LENGTH) throw new HttpError(400, "초대 코드 6자리를 입력해주세요.");

      const found = await crews.where("code", "==", code).limit(1).get();
      const crewDoc = found.docs[0];
      if (!crewDoc) throw new HttpError(404, "해당 코드의 크루가 없어요.");

      const mine = await myCrews.count().get();
      const memberRef = crewDoc.ref.collection("members").doc(uid);

      await db.runTransaction(async (tx) => {
        const [crewSnap, memberSnap] = await Promise.all([tx.get(crewDoc.ref), tx.get(memberRef)]);
        if (memberSnap.exists) return;
        if (mine.data().count >= MAX_CREWS_PER_USER) {
          throw new HttpError(400, `크루는 최대 ${MAX_CREWS_PER_USER}개까지 참여할 수 있어요.`);
        }
        if (Number(crewSnap.data()?.memberCount) >= MAX_MEMBERS) {
          throw new HttpError(400, `이 크루는 정원(${MAX_MEMBERS}명)이 가득 찼어요.`);
        }
        const now = Date.now();
        tx.set(memberRef, { uid, joinedAt: now, role: "member" });
        tx.set(myCrews.doc(crewDoc.id), { crewId: crewDoc.id, joinedAt: now });
        tx.update(crewDoc.ref, { memberCount: FieldValue.increment(1) });
      });

      return res.status(200).json({ crew: { id: crewDoc.id, name: crewDoc.data().name, code } });
    }

    if (action === "leave") {
      await requireMember(db, crewId, uid);
      const crewRef = crews.doc(crewId);

      await db.runTransaction(async (tx) => {
        const crewSnap = await tx.get(crewRef);
        const crew = crewSnap.data() || {};
        const others = await tx.get(
          crewRef.collection("members").where("uid", "!=", uid).orderBy("uid").limit(MAX_MEMBERS)
        );

        tx.delete(crewRef.collection("members").doc(uid));
        tx.delete(myCrews.doc(crewId));
        tx.delete(crewRef.collection("participants").doc(uid));

        if (others.empty) {
          tx.delete(crewRef);
          return;
        }
        const update: Record<string, any> = { memberCount: FieldValue.increment(-1) };
        if (crew.ownerUid === uid) {
          // Hand the crew to whoever joined first.
          const next = others.docs
            .map((d) => d.data())
            .sort((a, b) => Number(a.joinedAt) - Number(b.joinedAt))[0];
          update.ownerUid = next.uid;
          tx.update(crewRef.collection("members").doc(next.uid), { role: "owner" });
        }
        tx.update(crewRef, update);
      });
      await clearSignals(db, crewId, uid);

      return res.status(200).json({ ok: true });
    }

    if (action === "mine") {
      const links = await myCrews.orderBy("joinedAt", "desc").get();
      const ids = links.docs.map((d) => d.id).filter(validId);
      if (!ids.length) return res.status(200).json({ crews: [] });

      const now = Date.now();
      const snaps = await db.getAll(...ids.map((id) => crews.doc(id)));
      const result = await Promise.all(
        snaps
          .filter((s) => s.exists)
          .map(async (s) => {
            const c = s.data() || {};
            const live = await freshParticipants(db, s.id, now);
            return {
              id: s.id,
              name: String(c.name || "크루"),
              code: String(c.code || ""),
              memberCount: Number(c.memberCount) || 1,
              isOwner: c.ownerUid === uid,
              liveCount: live.length,
            };
          })
      );
      return res.status(200).json({ crews: result });
    }

    if (action === "detail") {
      const crewSnap = await requireMember(db, crewId, uid);
      const crew = crewSnap.data() || {};
      const tzOffsetMs = parseTzOffsetMs(req.body?.tzOffsetMinutes);
      const now = Date.now();

      const membersSnap = await crews.doc(crewId).collection("members").get();
      const memberUids = membersSnap.docs.map((d) => d.id).filter(validId);
      const names = await displayNames(db, memberUids);

      const members = await Promise.all(
        memberUids.map(async (memberUid) => {
          const sessions = await db.collection("users").doc(memberUid).collection("sessions").get();
          const stats = computeStudyStats(
            sessions.docs.map((d) => d.data()),
            tzOffsetMs,
            now
          );
          return {
            uid: memberUid,
            displayName: names.get(memberUid) ?? "User",
            isOwner: crew.ownerUid === memberUid,
            isMe: memberUid === uid,
            ...stats,
          };
        })
      );
      members.sort((a, b) => b.weeklyMs - a.weeklyMs);

      const live = await freshParticipants(db, crewId, now);
      return res.status(200).json({
        crew: {
          id: crewId,
          name: String(crew.name || "크루"),
          code: String(crew.code || ""),
          memberCount: members.length,
          isOwner: crew.ownerUid === uid,
        },
        members,
        room: {
          maxSize: MAX_ROOM_SIZE,
          participants: live.map((p) => ({ uid: p.uid, displayName: p.displayName })),
        },
      });
    }

    if (action === "roomJoin") {
      await requireMember(db, crewId, uid);
      await rateLimit(`room-join:${uid}`, 60, 60 * 60 * 1000);

      const name = (await displayNames(db, [uid])).get(uid) ?? "User";
      const participants = crews.doc(crewId).collection("participants");

      await clearSignals(db, crewId, uid);
      await db.runTransaction(async (tx) => {
        const now = Date.now();
        const snap = await tx.get(participants);
        const stale = snap.docs.filter((d) => Number(d.data().lastSeen) < now - ROOM_STALE_MS);
        const active = snap.docs.filter(
          (d) => Number(d.data().lastSeen) >= now - ROOM_STALE_MS && d.id !== uid
        );
        if (active.length >= MAX_ROOM_SIZE) {
          throw new HttpError(409, `그룹 스터디는 최대 ${MAX_ROOM_SIZE}명까지 참여할 수 있어요.`);
        }
        stale.forEach((d) => tx.delete(d.ref));
        tx.set(participants.doc(uid), { uid, displayName: name, joinedAt: now, lastSeen: now });
      });

      return res.status(200).json({ ok: true, maxSize: MAX_ROOM_SIZE });
    }

    if (action === "roomLeave") {
      if (!validId(crewId)) throw new HttpError(400, "잘못된 요청이에요.");
      await crews.doc(crewId).collection("participants").doc(uid).delete();
      await clearSignals(db, crewId, uid);
      return res.status(200).json({ ok: true });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  } catch (error: any) {
    return sendError(res, error, "Crew request failed");
  }
}
