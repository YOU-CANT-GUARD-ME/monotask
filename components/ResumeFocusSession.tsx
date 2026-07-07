import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

const ACTIVE_FOCUS_SESSION_KEY = "monotask_active_focus_session_v1";
const MAX_RESTORE_MS = 24 * 60 * 60 * 1000;

type ActiveFocusSession = {
  sessionId: string;
  startTime: number;
};

function readActiveSession(raw: string | null): ActiveFocusSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed?.sessionId === "string" &&
      typeof parsed?.startTime === "number" &&
      Number.isFinite(parsed.startTime)
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export default function ResumeFocusSession() {
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    async function resumeIfNeeded() {
      if (hasRedirectedRef.current) return;

      const currentPath = pathname || "";

      // Do not interrupt these screens.
      if (
        currentPath.includes("/focus") ||
        currentPath.includes("/study-end") ||
        currentPath.includes("/reset-password") ||
        currentPath.includes("/quiz") ||
        currentPath.includes("/summary") ||
        currentPath.includes("/camera")
      ) {
        return;
      }

      const raw = await AsyncStorage.getItem(ACTIVE_FOCUS_SESSION_KEY);
      const activeSession = readActiveSession(raw);

      if (!activeSession) return;

      const now = Date.now();
      const isValid =
        activeSession.startTime > 0 &&
        now >= activeSession.startTime &&
        now - activeSession.startTime < MAX_RESTORE_MS;

      if (!isValid) {
        await AsyncStorage.removeItem(ACTIVE_FOCUS_SESSION_KEY);
        return;
      }

      hasRedirectedRef.current = true;

      router.replace({
        pathname: "/focus",
        params: {
          sessionId: activeSession.sessionId,
          resumed: "1",
        },
      });
    }

    resumeIfNeeded();
  }, [pathname, router]);

  return null;
}
