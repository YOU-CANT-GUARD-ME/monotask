// api/sync-leaderboard.ts
// Recomputes the caller's leaderboard entry on the server from their saved
// sessions. Clients can no longer write leaderboard numbers directly.
// The maths lives in _lib/stats.ts.

import { adminAuth, adminDb, rateLimit, requireUser, sendError } from "./_lib/admin";
import { computeStudyStats, parseTzOffsetMs } from "./_lib/stats";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uid = await requireUser(req);
    await rateLimit(`leaderboard:${uid}`, 120, 60 * 60 * 1000);

    const now = Date.now();
    const sessionsSnap = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .get();
    const { weeklyMs, streak } = computeStudyStats(
      sessionsSnap.docs.map((d) => d.data()),
      parseTzOffsetMs(req.body?.tzOffsetMinutes),
      now
    );

    const user = await adminAuth().getUser(uid);
    const displayName = user.displayName ?? user.email?.split("@")[0] ?? "User";

    const entry = { uid, displayName, weeklyMs, streak, updatedAt: now };
    await adminDb().collection("leaderboard").doc(uid).set(entry);

    return res.status(200).json({ entry });
  } catch (error: any) {
    return sendError(res, error, "Leaderboard sync failed");
  }
}
