// api/follow.ts
// One-way following (like Instagram). Each follow is stored on both sides —
// users/{me}/following/{them} and users/{them}/followers/{me} — and only this
// route writes them, so the two lists always match.

import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { HttpError, adminDb, rateLimit, requireUser, sendError } from "./_lib/admin";

type Action = "search" | "follow" | "unfollow" | "list";

function edgeRefs(db: Firestore, followerUid: string, targetUid: string) {
  const users = db.collection("users");
  return {
    following: users.doc(followerUid).collection("following").doc(targetUid),
    follower: users.doc(targetUid).collection("followers").doc(followerUid),
  };
}

function validUid(uid: string) {
  return !!uid && !uid.includes("/") && uid.length <= 128;
}

// The old friends system was mutual; turn each accepted friendship into a
// follow in both directions the first time this user opens their lists.
async function migrateFriends(db: Firestore, uid: string) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.data()?.followMigrated) return;

  const friends = await userRef.collection("friends").where("status", "==", "accepted").get();
  const batch = db.batch();
  const since = Date.now();
  for (const f of friends.docs) {
    const other = f.id;
    if (!validUid(other)) continue;
    const a = edgeRefs(db, uid, other);
    const b = edgeRefs(db, other, uid);
    batch.set(a.following, { uid: other, since }, { merge: true });
    batch.set(a.follower, { uid, since }, { merge: true });
    batch.set(b.following, { uid, since }, { merge: true });
    batch.set(b.follower, { uid: other, since }, { merge: true });
  }
  batch.set(userRef, { followMigrated: true }, { merge: true });
  await batch.commit();
}

// Looks up display names for a set of uids in one round trip.
async function displayNames(db: Firestore, uids: string[]) {
  const names = new Map<string, string>();
  if (!uids.length) return names;
  const refs = uids.map((u) => db.collection("users").doc(u));
  const snaps = await db.getAll(...refs, { fieldMask: ["displayName"] });
  for (const snap of snaps) {
    names.set(snap.id, String(snap.data()?.displayName || "User"));
  }
  return names;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const myUid = await requireUser(req);
    const action = req.body?.action as Action;
    const db = adminDb();

    if (action === "search") {
      await rateLimit(`follow-search:${myUid}`, 60, 60 * 60 * 1000);

      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email) return res.status(200).json({ user: null });

      const snap = await db.collection("users").where("emailLower", "==", email).limit(1).get();
      const found = snap.docs[0];
      if (!found || found.id === myUid) return res.status(200).json({ user: null });

      const following = await edgeRefs(db, myUid, found.id).following.get();
      return res.status(200).json({
        user: {
          uid: found.id,
          email,
          displayName: String(found.data().displayName || "User"),
          isFollowing: following.exists,
        },
      });
    }

    if (action === "list") {
      const uid = String(req.body?.uid || myUid);
      const kind = req.body?.kind === "followers" ? "followers" : "following";
      if (!validUid(uid)) throw new HttpError(400, "잘못된 요청이에요.");

      if (uid === myUid) await migrateFriends(db, myUid);

      const snap = await db
        .collection("users")
        .doc(uid)
        .collection(kind)
        .orderBy("since", "desc")
        .limit(500)
        .get();
      const uids = snap.docs.map((d) => d.id).filter(validUid);

      // Which of these people do I follow? (drives the Follow/Following button)
      const myFollowing = new Set<string>();
      if (uids.length) {
        for (let i = 0; i < uids.length; i += 30) {
          const chunk = uids.slice(i, i + 30);
          const mine = await db
            .collection("users")
            .doc(myUid)
            .collection("following")
            .where(FieldPath.documentId(), "in", chunk)
            .get();
          mine.docs.forEach((d) => myFollowing.add(d.id));
        }
      }

      const names = await displayNames(db, uids);
      return res.status(200).json({
        users: uids.map((u) => ({
          uid: u,
          displayName: names.get(u) ?? "User",
          isFollowing: myFollowing.has(u),
          isMe: u === myUid,
        })),
      });
    }

    const targetUid = String(req.body?.uid || "");
    if (!validUid(targetUid) || targetUid === myUid) {
      throw new HttpError(400, "잘못된 요청이에요.");
    }

    if (action === "follow") {
      await rateLimit(`follow:${myUid}`, 100, 60 * 60 * 1000);

      const target = await db.collection("users").doc(targetUid).get();
      if (!target.exists) throw new HttpError(404, "사용자를 찾을 수 없어요.");

      const { following, follower } = edgeRefs(db, myUid, targetUid);
      const since = Date.now();
      const batch = db.batch();
      batch.set(following, { uid: targetUid, since });
      batch.set(follower, { uid: myUid, since });
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    if (action === "unfollow") {
      const { following, follower } = edgeRefs(db, myUid, targetUid);
      const batch = db.batch();
      batch.delete(following);
      batch.delete(follower);
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  } catch (error: any) {
    return sendError(res, error, "Follow request failed");
  }
}
