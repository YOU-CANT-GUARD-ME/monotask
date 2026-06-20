// firebase.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA6-1-KDg2OmN36uX8Tl2TXDxwK2LepASk",
  authDomain: "monotask-e0e25.firebaseapp.com",
  projectId: "monotask-e0e25",
  storageBucket: "monotask-e0e25.firebasestorage.app",
  messagingSenderId: "309449070629",
  appId: "1:309449070629:web:824f4f3b09734f627007cc",
  measurementId: "G-V6ECFBY3K7",
};

// Compat initializes its own app instance internally
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Also initialize a modular app (so we can use modular Firestore)
const modularApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Compat auth — handles RN persistence automatically, no setup needed
const auth = firebase.auth() as unknown as import("firebase/auth").Auth;

// Modular firestore + storage
const db = getFirestore(modularApp);
const storage = getStorage(modularApp);

export { auth, db, storage };
