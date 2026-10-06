// api/friends.ts
// Friend search and friend-request changes. These touch BOTH users' friend
// lists, so they run here with admin access after checking the request is
// allowed — clients are not allowed to write into another user's data.

import { HttpError, adminDb, rateLimit, requireUser, sendError } from "./_lib/admin";

type Action = "search" | "send" | "accept" | "remove";

function friendRef(ownerUid: string, otherUid: string) {
  return adminDb().collection("users").doc(ownerUid).collection("friends").doc(otherUid);
}

async function loadProfile(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) throw new HttpError(404, "사용자를 찾을 수 없어요.");
  const data = snap.data() || {};
  return {
    displayName: String(data.displayName || "User"),
    email: String(data.email || ""),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const myUid = await requireUser(req);
    const action = req.body?.action as Action;
    const otherUid = String(req.body?.uid || "");
    const db = adminDb();

    if (action === "search") {
      await rateLimit(`friend-search:${myUid}`, 60, 60 * 60 * 1000);

      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email) return res.status(200).json({ user: null });

      const snap = await db
        .collection("users")
        .where("emailLower", "==", email)
        .limit(1)
        .get();

      const found = snap.docs[0];
      if (!found || found.id === myUid) {
        return res.status(200).json({ user: null });
      }

      return res.status(200).json({
        user: {
          uid: found.id,
          email,
          displayName: String(found.data().displayName || "User"),
        },
      });
    }

    if (!otherUid || otherUid === myUid || otherUid.includes("/")) {
      throw new HttpError(400, "잘못된 요청이에요.");
    }

    if (action === "send") {
      await rateLimit(`friend-send:${myUid}`, 30, 60 * 60 * 1000);

      const existing = await friendRef(myUid, otherUid).get();
      if (existing.exists) {
        return res.status(200).json({ ok: true });
      }

      const [me, them] = await Promise.all([
        loadProfile(myUid),
        loadProfile(otherUid),
      ]);
      const now = Date.now();
      const batch = db.batch();

      batch.set(friendRef(myUid, otherUid), {
        uid: otherUid,
        status: "pending",
        direction: "sent",
        since: now,
        displayName: them.displayName,
        email: them.email,
      });
      batch.set(friendRef(otherUid, myUid), {
        uid: myUid,
        status: "pending",
        direction: "received",
        since: now,
        displayName: me.displayName,
        email: me.email,
      });

      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    if (action === "accept") {
      const mine = await friendRef(myUid, otherUid).get();
      const data = mine.data();

      // Only the person who RECEIVED the request can accept it.
      if (!data || data.status !== "pending" || data.direction !== "received") {
        throw new HttpError(403, "수락할 수 있는 친구 요청이 없어요.");
      }

      const batch = db.batch();
      batch.set(friendRef(myUid, otherUid), { status: "accepted" }, { merge: true });
      batch.set(friendRef(otherUid, myUid), { status: "accepted" }, { merge: true });
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    if (action === "remove") {
      const batch = db.batch();
      batch.delete(friendRef(myUid, otherUid));
      batch.delete(friendRef(otherUid, myUid));
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  } catch (error: any) {
    return sendError(res, error, "Friend request failed");
  }
}
