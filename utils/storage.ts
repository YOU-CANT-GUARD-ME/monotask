// utils/storage.ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export type Session = {
  id: string;
  startTime: number;
  durationMs: number;
  subject?: string;
  noteText?: string;
  aiSummary?: string;
  photoUri?: string;
  photoUris?: string[];
  createdAt?: number;
  updatedAt?: number;
};

export type QuizAttemptQuestion = {
  question: string;
  answer: "O" | "X";
  explanation: string;
  userAnswer: "O" | "X" | "";
};

export type QuizAttempt = {
  id: string;
  sessionId: string;
  subject: string;
  score: number;
  total: number;
  percentage: number;
  takenAt: number;
  questions?: QuizAttemptQuestion[];
  difficulty?: "easy" | "medium" | "hard";
  timerSeconds?: number;
};

function getUid() {
  const uid = auth.currentUser?.uid ?? null;
  console.log("CURRENT UID:", uid);
  return uid;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function sessionDocRef(sessionId: string) {
  const uid = getUid();

  if (!uid) {
    console.log("save stopped: no logged-in user");
    return null;
  }

  return doc(db, "users", uid, "sessions", sessionId);
}

export async function saveSession(
  session: Omit<Session, "id"> & { id: string }
): Promise<void> {
  console.log("saveSession called:", session);

  const ref = sessionDocRef(session.id);

  if (!ref) return;

  const now = Date.now();

  const data = {
    startTime: session.startTime ?? now,
    durationMs: session.durationMs ?? 0,
    subject: session.subject ?? "기타",
    noteText: session.noteText ?? "",
    aiSummary: session.aiSummary ?? "",
    photoUri: session.photoUri ?? "",
    photoUris: session.photoUris ?? [],
    createdAt: session.createdAt ?? now,
    updatedAt: now,
  };

  try {
    console.log("Saving to Firestore:", data);

    await setDoc(ref, data, { merge: true });

    console.log("Firestore save success");
  } catch (error) {
    console.error("saveSession error:", error);
  }
}

export async function getSessions(): Promise<Session[]> {
  const uid = getUid();

  if (!uid) {
    console.log("getSessions skipped: no logged-in user");
    return [];
  }

  try {
    const sessionsCol = collection(db, "users", uid, "sessions");
    const q = query(sessionsCol, orderBy("startTime", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Session, "id">),
    }));
  } catch (error) {
    console.error("getSessions error:", error);
    return [];
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const ref = sessionDocRef(sessionId);

  if (!ref) return;

  try {
    await deleteDoc(ref);
    console.log("Deleted session:", sessionId);
  } catch (error) {
    console.error("deleteSession error:", error);
  }
}

export async function clearSessions(): Promise<void> {
  console.log("clearSessions disabled");
}

// ─── Quiz attempts ────────────────────────────────────────────────────────────

function quizAttemptDocRef(attemptId: string) {
  const uid = getUid();
  if (!uid) {
    console.log("save stopped: no logged-in user");
    return null;
  }
  return doc(db, "users", uid, "quizAttempts", attemptId);
}

export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  const ref = quizAttemptDocRef(attempt.id);
  if (!ref) return;

  try {
    await setDoc(ref, {
      sessionId: attempt.sessionId ?? "",
      subject: attempt.subject ?? "기타",
      score: attempt.score,
      total: attempt.total,
      percentage: attempt.percentage,
      takenAt: attempt.takenAt,
      questions: attempt.questions ?? [],
      difficulty: attempt.difficulty ?? "medium",
      timerSeconds: attempt.timerSeconds ?? 0,
    });
    console.log("saveQuizAttempt success:", attempt.id);
  } catch (error) {
    console.error("saveQuizAttempt error:", error);
  }
}

export async function getQuizAttempts(): Promise<QuizAttempt[]> {
  const uid = getUid();
  if (!uid) {
    console.log("getQuizAttempts skipped: no logged-in user");
    return [];
  }

  try {
    const col = collection(db, "users", uid, "quizAttempts");
    const q = query(col, orderBy("takenAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<QuizAttempt, "id">),
    }));
  } catch (error) {
    console.error("getQuizAttempts error:", error);
    return [];
  }
}