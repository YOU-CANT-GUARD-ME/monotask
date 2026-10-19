// api/_lib/stats.ts
// Study-time stats computed on the server from saved session documents, used
// by the leaderboard and crews. Sessions are clamped (max 12h each, nothing
// in the future, overlaps merged) so totals can never exceed real time.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

type Interval = { start: number; end: number };

export type StudyStats = {
  todayMs: number;
  weeklyMs: number;
  totalMs: number;
  streak: number;
};

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

// Minutes behind UTC, as returned by Date#getTimezoneOffset (KST = -540),
// clamped to real-world offsets.
export function parseTzOffsetMs(raw: unknown): number {
  const minutes = Number(raw);
  return Math.max(-840, Math.min(840, Number.isFinite(minutes) ? minutes : 0)) * 60000;
}

export function computeStudyStats(
  sessions: { startTime?: unknown; durationMs?: unknown }[],
  tzOffsetMs: number,
  now = Date.now()
): StudyStats {
  const toLocal = (ts: number) => ts - tzOffsetMs;
  const startOfLocalDay = (ts: number) =>
    Math.floor(toLocal(ts) / DAY_MS) * DAY_MS + tzOffsetMs;

  const intervals: Interval[] = [];
  for (const s of sessions) {
    const start = Number(s.startTime);
    const duration = Math.min(Math.max(Number(s.durationMs) || 0, 0), MAX_SESSION_MS);
    if (!Number.isFinite(start) || duration <= 0 || start > now) continue;
    intervals.push({ start, end: Math.min(start + duration, now) });
  }

  // Same rule as the app: a session counts toward the day it started on.
  const dailyMap = new Map<number, number>();
  let totalMs = 0;
  for (const iv of mergeIntervals(intervals)) {
    const key = startOfLocalDay(iv.start);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + (iv.end - iv.start));
    totalMs += iv.end - iv.start;
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

  return { todayMs: dailyMap.get(todayStart) ?? 0, weeklyMs, totalMs, streak };
}
