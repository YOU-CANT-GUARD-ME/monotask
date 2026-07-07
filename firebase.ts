// firebase.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyA6-1-KDg2OmN36uX8Tl2TXDxwK2LepASk",
  authDomain: "monotask-e0e25.firebaseapp.com",
  projectId: "monotask-e0e25",
  storageBucket: "monotask-e0e25.appspot.com",
  messagingSenderId: "309449070629",
  appId: "1:309449070629:web:824f4f3b09734f627007cc",
  measurementId: "G-V6ECFBY3K7",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;

if (Platform.OS === "web") {
  // On web/PWA use browser localStorage persistence
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
  });
} else {
  // On native use AsyncStorage persistence
  const { getReactNativePersistence } = require("firebase/auth");
  const ReactNativeAsyncStorage = require("@react-native-async-storage/async-storage").default;
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };