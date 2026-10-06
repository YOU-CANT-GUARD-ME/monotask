// utils/leaderboard.ts
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { apiPost } from "./api";

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  weeklyMs: number;
  streak: number;
  updatedAt: number;
};

// Asks the server to recompute this user's entry from their saved sessions.
// The server does the maths so nobody can post made-up numbers.
export async function syncMyLeaderboardEntry(): Promise<void> {
  if (!auth.currentUser) return;

  await apiPost("/api/sync-leaderboard", {
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  });
}

// Fetches every leaderboard entry. The rules allow any logged-in user to
// read this whole collection, so global + friends + streak views can all
// be derived client-side from one fetch.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, "leaderboard"));
  return snap.docs.map((d) => d.data() as LeaderboardEntry);
}