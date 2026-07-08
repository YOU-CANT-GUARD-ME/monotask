// utils/friends.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";

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

// ─── Search for a user by exact email ──────────────────────────────────────
export async function searchUserByEmail(
  email: string
): Promise<UserSearchResult | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  const myUid = await requireUid();

  const usersCol = collection(db, "users");
  const q = query(usersCol, where("emailLower", "==", cleanEmail), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  if (docSnap.id === myUid) return null; // can't friend yourself

  const data = docSnap.data();
  return {
    uid: docSnap.id,
    email: data.email ?? "",
    displayName: data.displayName ?? "User",
  };
}

// ─── Send a friend request ─────────────────────────────────────────────────
export async function sendFriendRequest(
  targetUid: string,
  targetDisplayName: string,
  targetEmail: string
): Promise<void> {
  const myUid = await requireUid();
  if (myUid === targetUid) return;

  const myProfileSnap = await getDoc(doc(db, "users", myUid));
  const myData = myProfileSnap.data();
  const myDisplayName = myData?.displayName ?? "User";
  const myEmail = myData?.email ?? "";

  const now = Date.now();

  await setDoc(doc(db, "users", myUid, "friends", targetUid), {
    uid: targetUid,
    status: "pending",
    direction: "sent",
    since: now,
    displayName: targetDisplayName,
    email: targetEmail,
  });

  await setDoc(doc(db, "users", targetUid, "friends", myUid), {
    uid: myUid,
    status: "pending",
    direction: "received",
    since: now,
    displayName: myDisplayName,
    email: myEmail,
  });
}

// ─── Accept a friend request ────────────────────────────────────────────────
export async function acceptFriendRequest(otherUid: string): Promise<void> {
  const myUid = await requireUid();

  await setDoc(
    doc(db, "users", myUid, "friends", otherUid),
    { status: "accepted" },
    { merge: true }
  );
  await setDoc(
    doc(db, "users", otherUid, "friends", myUid),
    { status: "accepted" },
    { merge: true }
  );
}

// ─── Decline / remove a friend ─────────────────────────────────────────────
export async function removeFriend(otherUid: string): Promise<void> {
  const myUid = await requireUid();

  await deleteDoc(doc(db, "users", myUid, "friends", otherUid));
  await deleteDoc(doc(db, "users", otherUid, "friends", myUid));
}

// ─── Get all friend docs for the current user ──────────────────────────────
export async function getMyFriends(): Promise<FriendDoc[]> {
  const myUid = await requireUid();
  const snap = await getDocs(collection(db, "users", myUid, "friends"));
  return snap.docs.map((d) => d.data() as FriendDoc);
}