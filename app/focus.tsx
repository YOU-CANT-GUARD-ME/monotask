// app/focus.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";
import { saveSession } from "../utils/storage";
import AppIcon from "@/components/AppIcon";
import {
  openDndAccessSettings,
  openOverlayPermissionSettings,
  openUsageAccessSettings,
} from "../utils/androidFocusPermissions";
import {
  setFocusGuardAppInForeground,
  startFocusGuard,
  stopFocusGuard,
} from "../utils/focusGuard";

const ACTIVE_FOCUS_SESSION_KEY = "monotask_active_focus_session_v1";
const MAX_RESTORE_MS = 24 * 60 * 60 * 1000;
const FOCUS_AWAY_WARNING_SECONDS = 10;
const FOCUS_AWAY_WARNING_MS = FOCUS_AWAY_WARNING_SECONDS * 1000;
const FOCUS_AWAY_CHANNEL_ID = "focus-away";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type FocusMode = "stopwatch" | "timer";

type ActiveFocusSession = {
  sessionId: string;
  startTime: number;
  mode?: FocusMode;
  targetMs?: number;
  awayStartedAt?: number;
};

type FocusAwayNotice = {
  leftAt: number;
  awayMs: number;
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
      const mode: FocusMode = parsed.mode === "timer" ? "timer" : "stopwatch";
      const targetMs =
        mode === "timer" &&
          typeof parsed.targetMs === "number" &&
          Number.isFinite(parsed.targetMs) &&
          parsed.targetMs > 0
          ? parsed.targetMs
          : undefined;
      const awayStartedAt =
        typeof parsed?.awayStartedAt === "number" &&
          Number.isFinite(parsed.awayStartedAt)
          ? parsed.awayStartedAt
          : undefined;

      return {
        sessionId: parsed.sessionId,
        startTime: parsed.startTime,
        mode,
        targetMs,
        awayStartedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function prepareFocusNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(FOCUS_AWAY_CHANNEL_ID, {
      name: "Focus alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#87986A",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  return finalStatus === "granted";
}

function DndNudge({ rs }: { rs: (n: number) => number }) {
  const { colors } = useTheme();
  const [settingsError, setSettingsError] = useState("");
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

  async function openSettingWithMessage(openSetting: () => Promise<void>) {
    setSettingsError("");

    try {
      await openSetting();
    } catch (error) {
      console.log("Failed to open focus permission setting:", error);
      setSettingsError("설정 화면을 열 수 없어요. 앱 설정에서 직접 허용해주세요.");
    }
  }

  const showAndroidPermissions = Platform.OS === "android";

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
        marginBottom: rs(10),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
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
            집중 권한을 허용하세요
          </Text>
          <Text
            style={{
              fontSize: rs(11),
              color: colors.primaryDark,
              lineHeight: rs(17),
            }}
          >
            {showAndroidPermissions
              ? "다른 앱 이탈 감지와 차단 기능 테스트를 위해 Android 권한 설정을 열 수 있어요"
              : "설정 → 집중 모드 → 방해 금지에서 활성화하면 더 집중할 수 있어요"}
          </Text>
        </View>
      </View>

      {showAndroidPermissions && (
        <View style={{ flexDirection: "row", gap: rs(8), marginTop: rs(12) }}>
          <TouchableOpacity
            style={{
              flex: 1,
              minHeight: rs(40),
              borderRadius: rs(12),
              backgroundColor: "rgba(135,152,106,0.18)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: rs(8),
            }}
            onPress={() => openSettingWithMessage(openOverlayPermissionSettings)}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: "#e0d8c4",
                fontSize: rs(11),
                fontWeight: "800",
                textAlign: "center",
              }}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              앱 위 표시
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              minHeight: rs(40),
              borderRadius: rs(12),
              backgroundColor: "rgba(135,152,106,0.18)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: rs(8),
            }}
            onPress={() => openSettingWithMessage(openUsageAccessSettings)}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: "#e0d8c4",
                fontSize: rs(11),
                fontWeight: "800",
                textAlign: "center",
              }}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              사용 기록
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              minHeight: rs(40),
              borderRadius: rs(12),
              backgroundColor: "rgba(135,152,106,0.18)",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: rs(8),
            }}
            onPress={() => openSettingWithMessage(openDndAccessSettings)}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: "#e0d8c4",
                fontSize: rs(11),
                fontWeight: "800",
                textAlign: "center",
              }}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              방해금지
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!!settingsError && (
        <Text
          style={{
            marginTop: rs(9),
            color: "#e0d8c4",
            fontSize: rs(10),
            lineHeight: rs(14),
          }}
        >
          {settingsError}
        </Text>
      )}
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
  const { sessionId, mode, targetMs } = useLocalSearchParams<{
    sessionId?: string;
    mode?: string;
    targetMs?: string;
  }>();

  const fallbackSessionId = useRef(Date.now().toString()).current;
  const [restoredSessionId, setRestoredSessionId] = useState<string | null>(null);
  const activeSessionId = String(sessionId || restoredSessionId || fallbackSessionId);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showTimerComplete, setShowTimerComplete] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>("stopwatch");
  const [targetDurationMs, setTargetDurationMs] = useState<number | null>(null);
  const [focusAwayNotice, setFocusAwayNotice] = useState<FocusAwayNotice | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEndedRef = useRef(false);
  const hasFiredCompleteRef = useRef(false);
  const focusModeRef = useRef<FocusMode>("stopwatch");
  const targetDurationRef = useRef<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alertLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertActiveRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const awayStartedAtRef = useRef<number | null>(null);
  const awayNotificationIdRef = useRef<string | null>(null);

  async function playCompletionAlert() {
    alertActiveRef.current = true;

    async function playOnce() {
      if (!alertActiveRef.current) return;

      Vibration.vibrate([0, 300, 150, 300, 150, 300]);

      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/sound/timer-done.mp3")
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        console.warn("Faild to play timer sound:", e);
      }

      if (!alertActiveRef.current) return;

      alertLoopRef.current = setTimeout(playOnce, 1800);
    }

    playOnce();
  }

  function stopCompletionAlert() {
    alertActiveRef.current = false;

    if (alertLoopRef.current) {
      clearTimeout(alertLoopRef.current);
      alertLoopRef.current = null;
    }

    Vibration.cancel();

    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => { });
      soundRef.current.unloadAsync().catch(() => { });
      soundRef.current = null;
    }
  }

  function syncElapsedFromClock() {
    if (!startTimeRef.current) return;
    const now = Date.now();
    const nextElapsed = Math.max(0, now - startTimeRef.current);
    setElapsedMs(nextElapsed);

    // Timer mode: once the countdown hits zero, show completion alert
    // instead of silently ending the session.
    if (
      focusModeRef.current === "timer" &&
      targetDurationRef.current &&
      nextElapsed >= targetDurationRef.current &&
      !hasFiredCompleteRef.current
    ) {
      hasFiredCompleteRef.current = true;
      stopTicker();
      setShowTimerComplete(true);
      playCompletionAlert();
    }
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

  async function persistActiveSessionAway(leftAt: number | null) {
    const startTime = startTimeRef.current ?? Date.now();
    const payload: ActiveFocusSession = {
      sessionId: activeSessionId,
      startTime,
      mode: focusModeRef.current,
      targetMs:
        focusModeRef.current === "timer"
          ? targetDurationRef.current ?? undefined
          : undefined,
    };

    if (leftAt !== null) {
      payload.awayStartedAt = leftAt;
    }

    await AsyncStorage.setItem(ACTIVE_FOCUS_SESSION_KEY, JSON.stringify(payload));
  }

  async function cancelFocusAwayNotification() {
    const notificationId = awayNotificationIdRef.current;
    awayNotificationIdRef.current = null;

    if (!notificationId || Platform.OS === "web") return;

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.log("Failed to cancel focus away notification:", error);
    }
  }

  async function scheduleFocusAwayNotification() {
    if (Platform.OS === "web" || hasEndedRef.current) return;

    const canNotify = await prepareFocusNotifications();
    if (!canNotify || hasEndedRef.current) return;

    await cancelFocusAwayNotification();

    awayNotificationIdRef.current = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Monotask 집중이 끊길 수 있어요",
        body: "앱으로 돌아오지 않으면 이번 집중 세션을 종료할 수 있어요.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { screen: "focus", sessionId: activeSessionId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: FOCUS_AWAY_WARNING_SECONDS,
        channelId: FOCUS_AWAY_CHANNEL_ID,
      },
    });
  }

  function markFocusAway() {
    if (hasEndedRef.current || awayStartedAtRef.current) return;

    const leftAt = Date.now();
    awayStartedAtRef.current = leftAt;
    setShowEndConfirm(false);
    setFocusAwayNotice(null);

    persistActiveSessionAway(leftAt).catch((error) => {
      console.log("Failed to persist focus away state:", error);
    });

    scheduleFocusAwayNotification().catch((error) => {
      console.log("Failed to schedule focus away notification:", error);
    });
  }

  function markFocusActive() {
    if (hasEndedRef.current) return;

    syncElapsedFromClock();

    const leftAt = awayStartedAtRef.current;
    awayStartedAtRef.current = null;

    cancelFocusAwayNotification();

    persistActiveSessionAway(null).catch((error) => {
      console.log("Failed to clear focus away state:", error);
    });

    if (!leftAt || hasEndedRef.current) return;

    const awayMs = Math.max(0, Date.now() - leftAt);
    if (awayMs >= FOCUS_AWAY_WARNING_MS) {
      setFocusAwayNotice({ leftAt, awayMs });
    }
  }

  useEffect(() => {
    let mounted = true;

    async function setupFocusSession() {
      stopTicker();
      hasEndedRef.current = false;
      hasFiredCompleteRef.current = false;

      const now = Date.now();
      const raw = await AsyncStorage.getItem(ACTIVE_FOCUS_SESSION_KEY);
      const saved = readActiveSession(raw);

      const savedIsValid =
        !!saved &&
        saved.startTime > 0 &&
        now >= saved.startTime &&
        now - saved.startTime < MAX_RESTORE_MS;

      const nextSessionId = String(
        sessionId || (savedIsValid ? saved!.sessionId : fallbackSessionId)
      );

      const nextStartTime =
        savedIsValid && saved!.sessionId === nextSessionId
          ? saved!.startTime
          : now;

      const paramMode: FocusMode = mode === "timer" ? "timer" : "stopwatch";
      const parsedParamTarget = Number(targetMs);
      const hasValidParamTarget =
        paramMode === "timer" &&
        Number.isFinite(parsedParamTarget) &&
        parsedParamTarget > 0;

      const nextMode: FocusMode = sessionId
        ? paramMode
        : savedIsValid && saved
          ? saved.mode ?? "stopwatch"
          : "stopwatch";

      const nextTargetMs: number | undefined = sessionId
        ? (hasValidParamTarget ? parsedParamTarget : undefined)
        : savedIsValid && saved
          ? saved.targetMs
          : undefined;

      const restoredAwayStartedAt =
        savedIsValid &&
          saved!.sessionId === nextSessionId &&
          typeof saved!.awayStartedAt === "number"
          ? saved!.awayStartedAt
          : null;

      if (!mounted) return;

      setRestoredSessionId(!sessionId && savedIsValid ? saved!.sessionId : null);
      startTimeRef.current = nextStartTime;
      focusModeRef.current = nextMode;
      targetDurationRef.current = nextMode === "timer" ? nextTargetMs ?? null : null;

      setFocusMode(nextMode);
      setTargetDurationMs(targetDurationRef.current);
      setElapsedMs(Math.max(0, Date.now() - nextStartTime));
      setShowTimerComplete(false);
      setFocusAwayNotice(null);
      awayStartedAtRef.current = null;

      await AsyncStorage.setItem(
        ACTIVE_FOCUS_SESSION_KEY,
        JSON.stringify({
          sessionId: nextSessionId,
          startTime: nextStartTime,
          mode: nextMode,
          targetMs: nextMode === "timer" ? nextTargetMs : undefined,
        })
      );

      if (!mounted) return;

      if (restoredAwayStartedAt) {
        const awayMs = Math.max(0, Date.now() - restoredAwayStartedAt);
        if (awayMs >= FOCUS_AWAY_WARNING_MS) {
          awayStartedAtRef.current = restoredAwayStartedAt;
          setFocusAwayNotice({ leftAt: restoredAwayStartedAt, awayMs });
        }
      }

      // If we restored a session that already blew past its target while
      // the app was closed, show the completion alert immediately instead
      // of starting the ticker.
      const restoredElapsed = Math.max(0, Date.now() - nextStartTime);
      if (
        nextMode === "timer" &&
        targetDurationRef.current &&
        restoredElapsed >= targetDurationRef.current
      ) {
        hasFiredCompleteRef.current = true;
        setShowTimerComplete(true);
        playCompletionAlert();
        return;
      }

      startTicker();

      if (Platform.OS === "android") {
        startFocusGuard(nextStartTime, {
          bg: colors.surfaceDark,
          onPrimary: colors.onPrimary,
          primary: colors.primary,
        }).catch((error) => {
          console.log("Failed to start FocusGuard:", error);
        });
      }
    }

    setupFocusSession();

    return () => {
      mounted = false;
      stopTicker();
      stopCompletionAlert();
    };
  }, [sessionId]);

  useEffect(() => {
    prepareFocusNotifications().catch((error) => {
      console.log("Failed to prepare focus notifications:", error);
    });
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (hasEndedRef.current) return;

      if (nextState === "active") {
        if (Platform.OS === "android") {
          setFocusGuardAppInForeground(true).catch(() => { });
        }
        markFocusActive();
        return;
      }

      if (
        previousState === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        if (Platform.OS === "android") {
          setFocusGuardAppInForeground(false).catch(() => { });
        } else {
          markFocusAway();
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    const maybeDocument =
      typeof globalThis !== "undefined"
        ? (globalThis as any).document
        : undefined;

    const handleVisibilityChange = () => {
      if (maybeDocument?.visibilityState === "hidden") {
        markFocusAway();
      } else if (maybeDocument?.visibilityState === "visible") {
        markFocusActive();
      }
    };

    if (maybeDocument?.addEventListener) {
      maybeDocument.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      subscription.remove();

      if (maybeDocument?.removeEventListener) {
        maybeDocument.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [activeSessionId]);

  function goToStudyEnd(endTimeOverride?: number) {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    stopCompletionAlert();
    setShowTimerComplete(false);
    setShowEndConfirm(false);
    setFocusAwayNotice(null);
    awayStartedAtRef.current = null;

    const capturedStartTime = startTimeRef.current ?? Date.now();
    const capturedEndTime = endTimeOverride ?? Date.now();

    stopTicker();

    const durationMs = Math.max(0, capturedEndTime - capturedStartTime);

    cancelFocusAwayNotification().catch(() => { });
    if (Platform.OS === "android") {
      stopFocusGuard().catch(() => { });
    }

    AsyncStorage.removeItem(ACTIVE_FOCUS_SESSION_KEY)
      .catch((error) => {
        console.log("Failed to clear active focus session:", error);
      })

    .finally(() => {
      router.replace({
        pathname: "/study-end",
        params: {
          sessionId: activeSessionId,
          durationMs: String(durationMs),
          startTime: new Date(capturedStartTime).toISOString(),
        },
      });
    })

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

  function handleContinueAfterAway() {
    setFocusAwayNotice(null);
    syncElapsedFromClock();
  }

  function handleEndAfterAway() {
    goToStudyEnd(focusAwayNotice?.leftAt);
  }

  function handleExtendTimer(extraMs: number) {
    stopCompletionAlert();
    setShowTimerComplete(false);
    hasFiredCompleteRef.current = false;

    const now = Date.now();
    const currentElapsed = startTimeRef.current ? now - startTimeRef.current : 0;
    const newTarget = currentElapsed + extraMs;
    targetDurationRef.current = newTarget;
    setTargetDurationMs(newTarget);

    AsyncStorage.setItem(
      ACTIVE_FOCUS_SESSION_KEY,
      JSON.stringify({
        sessionId: activeSessionId,
        startTime: startTimeRef.current,
        mode: focusModeRef.current,
        targetMs: newTarget,
      })
    ).catch(() => { });

    startTicker();
  }

  const circleSize = Math.max(120, Math.min(rs(220), 260));
  const radius = Math.max(1, circleSize / 2 - 10);
  const strokeWidth = Math.max(1, rs(8));
  const circumference = 2 * Math.PI * radius;

  const isTimer = focusMode === "timer" && !!targetDurationMs;
  const maxMs = isTimer ? (targetDurationMs as number) : 2 * 60 * 60 * 1000;
  const progress = Math.min(elapsedMs / maxMs, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const remainingMs = isTimer ? Math.max(0, (targetDurationMs as number) - elapsedMs) : null;
  const displayMs = isTimer && remainingMs !== null ? remainingMs : elapsedMs;

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
      backgroundColor: colors.bg,
      borderRadius: rs(24),
      padding: rs(22),
    },
    confirmTitle: {
      fontSize: rs(20),
      fontWeight: "800",
      color: colors.text,
      marginBottom: rs(8),
    },
    confirmBody: {
      fontSize: rs(14),
      lineHeight: rs(21),
      color: colors.textMuted,
      marginBottom: rs(20),
    },
    awayDurationPill: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(135,152,106,0.16)",
      borderRadius: rs(999),
      paddingHorizontal: rs(12),
      paddingVertical: rs(7),
      marginBottom: rs(16),
    },
    awayDurationText: {
      fontSize: rs(12),
      fontWeight: "800",
      color: colors.primaryDark,
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
      backgroundColor: colors.primarySoft,
    },
    cancelButtonText: {
      fontSize: rs(14),
      fontWeight: "800",
      color: colors.primaryDark,
    },
    confirmEndButton: {
      flex: 1,
      paddingVertical: rs(14),
      borderRadius: rs(14),
      alignItems: "center",
      backgroundColor: colors.primary,
    },
    confirmEndButtonText: {
      fontSize: rs(14),
      fontWeight: "800",
      color: colors.onPrimary,
    },
    timerDoneIconWrap: {
      width: rs(64),
      height: rs(64),
      borderRadius: rs(32),
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: rs(16),
    },
    extendRow: {
      flexDirection: "row",
      gap: rs(8),
      marginBottom: rs(14),
    },
    extendChip: {
      flex: 1,
      paddingVertical: rs(12),
      borderRadius: rs(14),
      alignItems: "center",
      backgroundColor: colors.primarySoft,
    },
    extendChipText: {
      fontSize: rs(13),
      fontWeight: "800",
      color: colors.primaryDark,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.dot} />
      <Text style={s.modeLabel}>{isTimer ? "Timer" : "Focus mode"}</Text>

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
          <Text style={s.elapsed}>{formatElapsed(displayMs)}</Text>
          <Text style={s.elapsedLabel}>{isTimer ? "남은 시간" : "집중 시간"}</Text>
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
                onPress={() => goToStudyEnd()}
                activeOpacity={0.85}
              >
                <Text style={s.confirmEndButtonText}>종료하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showTimerComplete && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <View style={s.timerDoneIconWrap}>
              <AppIcon name="time" size={rs(28)} color={colors.primary} />
            </View>
            <Text style={[s.confirmTitle, { textAlign: "center" }]}>
              타이머가 끝났어요!
            </Text>
            <Text style={[s.confirmBody, { textAlign: "center" }]}>
              설정한 시간을 모두 채웠어요.{"\n"}
              세션을 종료할까요, 아니면 조금 더 집중할까요?
            </Text>

            <View style={s.extendRow}>
              <TouchableOpacity
                style={s.extendChip}
                onPress={() => handleExtendTimer(5 * 60 * 1000)}
                activeOpacity={0.85}
              >
                <Text style={s.extendChipText}>+5분</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.extendChip}
                onPress={() => handleExtendTimer(10 * 60 * 1000)}
                activeOpacity={0.85}
              >
                <Text style={s.extendChipText}>+10분</Text>
              </TouchableOpacity>
            </View>

            <View style={s.confirmButtonRow}>
              <TouchableOpacity
                style={s.confirmEndButton}
                onPress={() => goToStudyEnd()}
                activeOpacity={0.85}
              >
                <Text style={s.confirmEndButtonText}>세션 종료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {focusAwayNotice && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>집중 이탈 감지</Text>
            <View style={s.awayDurationPill}>
              <Text style={s.awayDurationText}>
                앱 밖에 있었던 시간 {formatElapsed(focusAwayNotice.awayMs)}
              </Text>
            </View>
            <Text style={s.confirmBody}>
              Monotask를 벗어난 시간이 감지됐어요.{"\n"}
              세션을 종료하면 앱을 나간 시점까지만 집중 시간으로 저장됩니다.
            </Text>

            <View style={s.confirmButtonRow}>
              <TouchableOpacity
                style={s.cancelButton}
                onPress={handleContinueAfterAway}
                activeOpacity={0.85}
              >
                <Text style={s.cancelButtonText}>계속 인정</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.confirmEndButton}
                onPress={handleEndAfterAway}
                activeOpacity={0.85}
              >
                <Text style={s.confirmEndButtonText}>세션 종료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}