import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import { getSessions } from "../utils/storage";

export type StudyStats = {
  todayMs: number;
  weekMs: number;
  streakDays: number;
  recentSessions: { label: string; durationMs: number }[];
  dailyGoalMs: number;
  loading: boolean;
  refresh: () => void;
};

const DAILY_GOAL_MS = 3 * 60 * 60 * 1000; // 3 hours

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(daysAgo: number): string {
  if (daysAgo === 0) return "오늘";
  if (daysAgo === 1) return "어제";
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("ko-KR", { weekday: "long" });
}

export function useStudyStats(): StudyStats {
  const [stats, setStats] = useState<Omit<StudyStats, "loading" | "refresh">>({
    todayMs: 0,
    weekMs: 0,
    streakDays: 0,
    recentSessions: [],
    dailyGoalMs: DAILY_GOAL_MS,
  });
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    setLoading(true);
    const sessions = await getSessions();
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = todayStart - ((now.getDay() + 6) % 7) * 86400000;

    let todayMs = 0;
    let weekMs = 0;
    const dailyTotals = new Map<number, number>();

    for (const s of sessions) {
      const day = startOfDay(new Date(s.startTime));
      if (day === todayStart) todayMs += s.durationMs;
      if (s.startTime >= weekStart) weekMs += s.durationMs;
      dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + s.durationMs);
    }

    // Streak: consecutive days ending today that hit the daily goal
    let streakDays = 0;
    let checkDay = todayStart;
    while ((dailyTotals.get(checkDay) ?? 0) >= DAILY_GOAL_MS) {
      streakDays++;
      checkDay -= 86400000;
    }

    // Recent sessions grouped by day, newest first
    const grouped = new Map<number, number>();
    for (const s of sessions) {
      const day = startOfDay(new Date(s.startTime));
      grouped.set(day, (grouped.get(day) ?? 0) + s.durationMs);
    }
    const recentSessions = [...grouped.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 3)
      .map(([day, durationMs]) => ({
        label: dayLabel(Math.round((todayStart - day) / 86400000)),
        durationMs,
      }));

    setStats({ todayMs, weekMs, streakDays, recentSessions, dailyGoalMs: DAILY_GOAL_MS });
    setLoading(false);
  }, []);

  // Re-fetch when auth state changes (login / logout / account switch)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      compute();
    });
    return unsub; // cleans up the listener on unmount
  }, [compute]);

  return { ...stats, loading, refresh: compute };
}