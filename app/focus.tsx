// app/focus.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";
import { saveSession } from "../utils/storage";

const ACTIVE_FOCUS_SESSION_KEY = "monotask_active_focus_session_v1";
const MAX_RESTORE_MS = 24 * 60 * 60 * 1000;

type ActiveFocusSession = {
  sessionId: string;
  startTime: number;
};

function formatElapsed(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSecs = Math.floor(safeMs / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const sec = totalSecs % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

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

function DndNudge({ rs }: { rs: (n: number) => number }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: "rgba(135,152,106,0.28)",
        borderRadius: rs(20),
        padding: rs(14),
        flexDirection: "row",
        alignItems: "center",
        gap: rs(12),
        marginBottom: rs(10),
      }}
    >
      <View
        style={{
          width: rs(38),
          height: rs(38),
          borderRadius: rs(11),
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            color: colors.onPrimary,
            fontSize: rs(18),
            fontWeight: "900",
          }}
        >
          !
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: rs(13),
            fontWeight: "700",
            color: "#e0d8c4",
            marginBottom: rs(3),
          }}
        >
          방해 금지 모드를 켜세요
        </Text>
        <Text
          style={{
            fontSize: rs(11),
            color: colors.primaryDark,
            lineHeight: rs(17),
          }}
        >
          설정 → 집중 모드 → 방해 금지{"\n"}에서 활성화하면 더 집중할 수 있어요
        </Text>
      </View>
    </Animated.View>
  );
}

export default function FocusScreen() {
  const { width } = useWindowDimensions();
  const safeWidth = width && width > 0 ? width : 390;
  const scale = safeWidth / 390;
  const rs = (n: number) => Math.max(1, Math.round(n * scale));
  const { colors } = useTheme();

  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const fallbackSessionId = useRef(Date.now().toString()).current;
  const [restoredSessionId, setRestoredSessionId] = useState<string | null>(null);
  const activeSessionId = String(sessionId || restoredSessionId || fallbackSessionId);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEndedRef = useRef(false);

  function syncElapsedFromClock() {
    if (!startTimeRef.current) return;
    setElapsedMs(Math.max(0, Date.now() - startTimeRef.current));
  }

  function stopTicker() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startTicker() {
    stopTicker();
    syncElapsedFromClock();

    intervalRef.current = setInterval(() => {
      syncElapsedFromClock();
    }, 1000);
  }

  useEffect(() => {
    let mounted = true;

    async function setupFocusSession() {
      stopTicker();
      hasEndedRef.current = false;

      const now = Date.now();
      const raw = await AsyncStorage.getItem(ACTIVE_FOCUS_SESSION_KEY);
      const saved = readActiveSession(raw);

      const savedIsValid =
        !!saved &&
        saved.startTime > 0 &&
        now >= saved.startTime &&
        now - saved.startTime < MAX_RESTORE_MS;

      const nextSessionId = String(
        sessionId || (savedIsValid ? saved.sessionId : fallbackSessionId)
      );

      const nextStartTime =
        savedIsValid && saved.sessionId === nextSessionId
          ? saved.startTime
          : now;

      if (!mounted) return;

      setRestoredSessionId(!sessionId && savedIsValid ? saved.sessionId : null);
      startTimeRef.current = nextStartTime;
      setElapsedMs(Math.max(0, Date.now() - nextStartTime));

      await AsyncStorage.setItem(
        ACTIVE_FOCUS_SESSION_KEY,
        JSON.stringify({
          sessionId: nextSessionId,
          startTime: nextStartTime,
        })
      );

      if (!mounted) return;
      startTicker();
    }

    setupFocusSession();

    return () => {
      mounted = false;
      stopTicker();
    };
  }, [sessionId]);

  useEffect(() => {
    const updateFromCurrentTime = () => {
      syncElapsedFromClock();
    };

    const subscription = AppState.addEventListener("change", updateFromCurrentTime);

    const maybeDocument =
      typeof globalThis !== "undefined"
        ? (globalThis as any).document
        : undefined;

    if (maybeDocument?.addEventListener) {
      maybeDocument.addEventListener("visibilitychange", updateFromCurrentTime);
    }

    return () => {
      subscription.remove();

      if (maybeDocument?.removeEventListener) {
        maybeDocument.removeEventListener("visibilitychange", updateFromCurrentTime);
      }
    };
  }, []);

  function goToStudyEnd() {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    setShowEndConfirm(false);

    const capturedStartTime = startTimeRef.current ?? Date.now();

    stopTicker();

    const durationMs = Math.max(0, Date.now() - capturedStartTime);

    AsyncStorage.removeItem(ACTIVE_FOCUS_SESSION_KEY).catch((error) => {
      console.log("Failed to clear active focus session:", error);
    });

    router.replace({
      pathname: "/study-end",
      params: {
        sessionId: activeSessionId,
        durationMs: String(durationMs),
        startTime: new Date(capturedStartTime).toISOString(),
      },
    });

    setTimeout(async () => {
      try {
        if (durationMs > 10000) {
          await saveSession({
            id: activeSessionId,
            startTime: capturedStartTime,
            durationMs,
          });
        }
      } catch (error) {
        console.log("Failed to save session:", error);
      }
    }, 0);
  }

  function handleEnd() {
    setShowEndConfirm(true);
  }

  function handleCancelEnd() {
    setShowEndConfirm(false);
  }

  const circleSize = Math.max(120, Math.min(rs(220), 260));
  const radius = Math.max(1, circleSize / 2 - 10);
  const strokeWidth = Math.max(1, rs(8));
  const circumference = 2 * Math.PI * radius;
  const maxMs = 2 * 60 * 60 * 1000;
  const progress = Math.min(elapsedMs / maxMs, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surfaceDark,
      alignItems: "center",
      justifyContent: "center",
      padding: rs(24),
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginBottom: rs(12),
    },
    modeLabel: {
      fontSize: rs(11),
      color: colors.primaryDark,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: rs(36),
    },
    svgWrapper: {
      alignItems: "center",
      justifyContent: "center",
    },
    timerOverlay: {
      position: "absolute",
      alignItems: "center",
    },
    elapsed: {
      fontSize: Math.min(rs(44), 54),
      fontWeight: "600",
      color: "#e0d8c4",
    },
    elapsedLabel: {
      fontSize: rs(13),
      color: colors.primaryDark,
      marginTop: rs(4),
    },
    bottomArea: {
      width: "100%",
      marginTop: rs(40),
    },
    endButton: {
      width: "100%",
      backgroundColor: colors.primary,
      paddingVertical: rs(18),
      borderRadius: rs(18),
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    endText: {
      fontSize: rs(16),
      color: colors.onPrimary,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    confirmOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.52)",
      alignItems: "center",
      justifyContent: "center",
      padding: rs(24),
    },
    confirmCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: "#F4F1EA",
      borderRadius: rs(24),
      padding: rs(22),
    },
    confirmTitle: {
      fontSize: rs(20),
      fontWeight: "800",
      color: "#26221A",
      marginBottom: rs(8),
    },
    confirmBody: {
      fontSize: rs(14),
      lineHeight: rs(21),
      color: "#5F654F",
      marginBottom: rs(20),
    },
    confirmButtonRow: {
      flexDirection: "row",
      gap: rs(10),
    },
    cancelButton: {
      flex: 1,
      paddingVertical: rs(14),
      borderRadius: rs(14),
      alignItems: "center",
      backgroundColor: "rgba(135,152,106,0.16)",
    },
    cancelButtonText: {
      fontSize: rs(14),
      fontWeight: "800",
      color: "#6A7A52",
    },
    confirmEndButton: {
      flex: 1,
      paddingVertical: rs(14),
      borderRadius: rs(14),
      alignItems: "center",
      backgroundColor: "#87986A",
    },
    confirmEndButtonText: {
      fontSize: rs(14),
      fontWeight: "800",
      color: "#F4F1EA",
    },
  });

  return (
    <View style={s.container}>
      <View style={s.dot} />
      <Text style={s.modeLabel}>Focus mode</Text>

      <View style={s.svgWrapper}>
        <Svg width={circleSize} height={circleSize}>
          <Circle
            stroke="#2B3123"
            fill="none"
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <Circle
            stroke={colors.heat?.[2] ?? colors.primary}
            fill="none"
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            strokeWidth={strokeWidth + 7}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${circleSize / 2}, ${circleSize / 2}`}
            opacity={0.22}
          />
          <Circle
            stroke={colors.primary}
            fill="none"
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${circleSize / 2}, ${circleSize / 2}`}
          />
        </Svg>

        <View style={s.timerOverlay}>
          <Text style={s.elapsed}>{formatElapsed(elapsedMs)}</Text>
          <Text style={s.elapsedLabel}>집중 시간</Text>
        </View>
      </View>

      <View style={s.bottomArea}>
        <DndNudge rs={rs} />
        <TouchableOpacity style={s.endButton} onPress={handleEnd} activeOpacity={0.85}>
          <Text style={s.endText}>집중 세션 종료</Text>
        </TouchableOpacity>
      </View>

      {showEndConfirm && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>세션 종료</Text>
            <Text style={s.confirmBody}>
              지금 집중 세션을 종료하시겠어요?{"\n"}
              화면이 꺼져 있었던 시간도 포함해서 저장됩니다.
            </Text>

            <View style={s.confirmButtonRow}>
              <TouchableOpacity
                style={s.cancelButton}
                onPress={handleCancelEnd}
                activeOpacity={0.85}
              >
                <Text style={s.cancelButtonText}>계속 집중</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.confirmEndButton}
                onPress={goToStudyEnd}
                activeOpacity={0.85}
              >
                <Text style={s.confirmEndButtonText}>종료하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
