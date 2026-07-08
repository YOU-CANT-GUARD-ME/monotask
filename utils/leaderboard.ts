// utils/leaderboard.ts
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getSessions, Session } from "./storage";

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  weeklyMs: number;
  streak: number;
  updatedAt: number;
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeStatsFromSessions(sessions: Session[]) {
  const dailyMap = new Map<number, number>();
  for (const s of sessions) {
    const key = startOfDay(s.startTime);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.durationMs);
  }

  const monday = getWeekMonday(new Date()).getTime();
  let weeklyMs = 0;
  for (const [dayTs, ms] of dailyMap.entries()) {
    if (dayTs >= monday) weeklyMs += ms;
  }

  const todayTs = startOfDay(Date.now());
  let streak = 0;
  let check = todayTs;
  while (dailyMap.has(check)) {
    streak++;
    check -= 86400000;
  }

  return { weeklyMs, streak };
}

// Recomputes this user's stats from local sessions and pushes them to
// Firestore. Safe to call often — it's just a local calc + one write.
export async function syncMyLeaderboardEntry(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const sessions = await getSessions();
  const { weeklyMs, streak } = computeStatsFromSessions(sessions);
  const displayName = user.displayName ?? user.email?.split("@")[0] ?? "User";

  await setDoc(doc(db, "leaderboard", user.uid), {
    uid: user.uid,
    displayName,
    weeklyMs,
    streak,
    updatedAt: Date.now(),
  });
}

// Fetches every leaderboard entry. Your rules allow any logged-in user to
// read this whole collection, so global + friends + streak views can all
// be derived client-side from one fetch.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, "leaderboard"));
  return snap.docs.map((d) => d.data() as LeaderboardEntry);
}