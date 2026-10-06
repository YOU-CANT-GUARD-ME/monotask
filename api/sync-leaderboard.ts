// api/sync-leaderboard.ts
// Recomputes the caller's leaderboard entry on the server from their saved
// sessions. Clients can no longer write leaderboard numbers directly.
// Sessions are clamped (max 12h each, nothing in the future, overlaps merged)
// so the weekly total can never exceed real elapsed time.

import { adminAuth, adminDb, rateLimit, requireUser, sendError } from "./_lib/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

type Interval = { start: number; end: number };

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uid = await requireUser(req);
    await rateLimit(`leaderboard:${uid}`, 120, 60 * 60 * 1000);

    // Minutes behind UTC, as returned by Date#getTimezoneOffset (KST = -540).
    const rawOffset = Number(req.body?.tzOffsetMinutes);
    const tzOffsetMs =
      Math.max(-840, Math.min(840, Number.isFinite(rawOffset) ? rawOffset : 0)) * 60000;

    const now = Date.now();
    const toLocal = (ts: number) => ts - tzOffsetMs;
    const startOfLocalDay = (ts: number) =>
      Math.floor(toLocal(ts) / DAY_MS) * DAY_MS + tzOffsetMs;

    const db = adminDb();
    const sessionsSnap = await db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .get();

    const intervals: Interval[] = [];
    for (const d of sessionsSnap.docs) {
      const s = d.data();
      const start = Number(s.startTime);
      const duration = Math.min(Math.max(Number(s.durationMs) || 0, 0), MAX_SESSION_MS);
      if (!Number.isFinite(start) || duration <= 0 || start > now) continue;
      intervals.push({ start, end: Math.min(start + duration, now) });
    }

    const merged = mergeIntervals(intervals);

    // Same rules as the app: a session counts toward the day it started on.
    const dailyMap = new Map<number, number>();
    for (const iv of merged) {
      const key = startOfLocalDay(iv.start);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + (iv.end - iv.start));
    }

    const todayStart = startOfLocalDay(now);
    const localWeekday = new Date(toLocal(now)).getUTCDay();
    const monday = todayStart - ((localWeekday + 6) % 7) * DAY_MS;

    let weeklyMs = 0;
    for (const [dayTs, ms] of dailyMap.entries()) {
      if (dayTs >= monday) weeklyMs += ms;
    }

    let streak = 0;
    let check = todayStart;
    while (dailyMap.has(check)) {
      streak++;
      check -= DAY_MS;
    }

    const user = await adminAuth().getUser(uid);
    const displayName = user.displayName ?? user.email?.split("@")[0] ?? "User";

    const entry = { uid, displayName, weeklyMs, streak, updatedAt: now };
    await db.collection("leaderboard").doc(uid).set(entry);

    return res.status(200).json({ entry });
  } catch (error: any) {
    return sendError(res, error, "Leaderboard sync failed");
  }
}
