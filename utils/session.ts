import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "./storage";

const KEY = "study_sessions";

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: Session): Promise<void> {
  const existing = await loadSessions();

  const filtered = existing.filter((s) => s.id !== session.id);

  await AsyncStorage.setItem(
    KEY,
    JSON.stringify([session, ...filtered])
  );
}