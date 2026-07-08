// utils/userProfile.ts
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../firebase";

export async function ensureUserProfile(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const email = user.email ?? "";
  const displayName = user.displayName ?? email.split("@")[0] ?? "User";

  if (!snap.exists()) {
    await setDoc(ref, {
      email,
      emailLower: email.toLowerCase(),
      displayName,
      createdAt: Date.now(),
    });
  } else {
    // Keep email/displayName in sync in case they changed
    await setDoc(
      ref,
      { email, emailLower: email.toLowerCase(), displayName },
      { merge: true }
    );
  }
}

export function watchAuthAndSyncProfile() {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      ensureUserProfile(user).catch((e) =>
        console.warn("ensureUserProfile failed:", e)
      );
    }
  });
}