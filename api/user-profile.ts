// api/user-profile.ts
// Returns someone's profile for the profile screen: name, follower/following
// counts, whether you follow them, and their study sessions. Any logged-in
// user can view it. Private sessions come back with times only (no subject,
// notes or AI summary), so private notes never leave the server.

import { HttpError, adminDb, requireUser, sendError } from "./_lib/admin";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const myUid = await requireUser(req);
    const uid = String(req.body?.uid || "");

    if (!uid || uid.includes("/")) {
      throw new HttpError(400, "잘못된 요청이에요.");
    }

    const db = adminDb();
    const userRef = db.collection("users").doc(uid);

    const [profileSnap, sessionsSnap, followersCount, followingCount, followEdge] =
      await Promise.all([
        userRef.get(),
        userRef.collection("sessions").get(),
        userRef.collection("followers").count().get(),
        userRef.collection("following").count().get(),
        db.collection("users").doc(myUid).collection("following").doc(uid).get(),
      ]);

    if (!profileSnap.exists) throw new HttpError(404, "사용자를 찾을 수 없어요.");
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
        followersCount: followersCount.data().count,
        followingCount: followingCount.data().count,
        isFollowing: followEdge.exists,
        isMe: uid === myUid,
      },
      sessions,
    });
  } catch (error: any) {
    return sendError(res, error, "Failed to load profile");
  }
}
