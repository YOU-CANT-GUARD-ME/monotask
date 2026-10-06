// api/friend-profile.ts
// Returns a friend's profile and study sessions. Only accepted friends can
// load it, and private sessions come back with times only (no subject, notes
// or AI summary), so private notes never leave the server.

import { HttpError, adminDb, requireUser, sendError } from "./_lib/admin";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const myUid = await requireUser(req);
    const friendUid = String(req.body?.uid || "");

    if (!friendUid || friendUid.includes("/")) {
      throw new HttpError(400, "잘못된 요청이에요.");
    }

    const db = adminDb();
    const userRef = db.collection("users").doc(friendUid);

    if (friendUid !== myUid) {
      const link = await db
        .collection("users")
        .doc(myUid)
        .collection("friends")
        .doc(friendUid)
        .get();

      if (link.data()?.status !== "accepted") {
        throw new HttpError(403, "친구만 프로필을 볼 수 있어요.");
      }
    }

    const [profileSnap, sessionsSnap] = await Promise.all([
      userRef.get(),
      userRef.collection("sessions").get(),
    ]);

    const profile = profileSnap.data() || {};

    const sessions = sessionsSnap.docs.map((d) => {
      const s = d.data();
      const isPublic = s.isPublic === true;
      return {
        id: d.id,
        startTime: Number(s.startTime) || 0,
        durationMs: Number(s.durationMs) || 0,
        isPublic,
        ...(isPublic
          ? {
              subject: s.subject ?? "",
              noteText: s.noteText ?? "",
              aiSummary: s.aiSummary ?? "",
            }
          : {}),
      };
    });

    return res.status(200).json({
      profile: {
        displayName: String(profile.displayName || "User"),
        email: String(profile.email || ""),
      },
      sessions,
    });
  } catch (error: any) {
    return sendError(res, error, "Failed to load friend profile");
  }
}
