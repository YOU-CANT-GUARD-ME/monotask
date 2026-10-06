// utils/friends.ts
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { apiPost } from "./api";

export type FriendStatus = "pending" | "accepted";

export type FriendDoc = {
  uid: string;
  status: FriendStatus;
  direction: "sent" | "received";
  since: number;
  displayName?: string;
  email?: string;
};

export type UserSearchResult = {
  uid: string;
  email: string;
  displayName: string;
};

// Waits for Firebase Auth to finish resolving the persisted session
// (auth.currentUser is null until this resolves, even if the user IS logged in)
function requireUid(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser.uid);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        reject(new Error("Not logged in"));
      }
    });
  });
}

// Search, send, accept and remove all go through /api/friends: they write
// to both users' friend lists, which only the server is allowed to do.

// ─── Search for a user by exact email ──────────────────────────────────────
export async function searchUserByEmail(
  email: string
): Promise<UserSearchResult | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  await requireUid();
  const data = await apiPost<{ user: UserSearchResult | null }>("/api/friends", {
    action: "search",
    email: cleanEmail,
  });
  return data.user;
}

// ─── Send a friend request ─────────────────────────────────────────────────
// Names and emails are looked up on the server; the extra arguments are kept
// so existing callers don't need to change.
export async function sendFriendRequest(
  targetUid: string,
  _targetDisplayName?: string,
  _targetEmail?: string
): Promise<void> {
  const myUid = await requireUid();
  if (myUid === targetUid) return;
  await apiPost("/api/friends", { action: "send", uid: targetUid });
}

// ─── Accept a friend request ────────────────────────────────────────────────
export async function acceptFriendRequest(otherUid: string): Promise<void> {
  await requireUid();
  await apiPost("/api/friends", { action: "accept", uid: otherUid });
}

// ─── Decline / remove a friend ─────────────────────────────────────────────
export async function removeFriend(otherUid: string): Promise<void> {
  await requireUid();
  await apiPost("/api/friends", { action: "remove", uid: otherUid });
}

// ─── Get all friend docs for the current user ──────────────────────────────
export async function getMyFriends(): Promise<FriendDoc[]> {
  const myUid = await requireUid();
  const snap = await getDocs(collection(db, "users", myUid, "friends"));
  return snap.docs.map((d) => d.data() as FriendDoc);
}