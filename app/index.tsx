// app/index.tsx
import AppIcon from "../components/AppIcon";
import TimeWheelPicker from "../components/DurationPicker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";
import { useStudyStats } from "../hooks/useStudyStats";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import LoginRequiredModal from "../components/LoginRequiredModal";

const ACTIVE_FOCUS_SESSION_KEY = "monotask_active_focus_session_v1";
let hasShownSplash = false;


function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const sec = totalSecs % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return sec > 0 ? `${sec}s` : "0m";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0.88)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(wordScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(tagOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(dotScale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, []);

  const splash = StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.surfaceDark,
      alignItems: "center",
      justifyContent: "center",
    },
    glow: {
      position: "absolute",
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: colors.primary,
      opacity: 0.12,
      transform: [{ scaleX: 1.6 }],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginBottom: 16,
    },
    wordmark: {
      fontSize: 42,
      fontWeight: "800",
      color: "#e0d8c4",
      letterSpacing: -1.5,
    },
    tagline: {
      marginTop: 10,
      fontSize: 13,
      color: colors.primaryDark,
      fontWeight: "500",
      letterSpacing: 1.5,
    },
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: overlayOpacity, zIndex: 99 }]}
    >
      <View style={splash.bg}>
        <View style={splash.glow} />
        <Animated.View style={[splash.dot, { transform: [{ scale: dotScale }] }]} />
        <Animated.Text
          style={[
            splash.wordmark,
            { opacity: wordOpacity, transform: [{ scale: wordScale }] },
          ]}
        >
          Monotask
        </Animated.Text>
        <Animated.Text style={[splash.tagline, { opacity: tagOpacity }]}>
          깊은 집중, 간편하게
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

type SessionMode = "stopwatch" | "timer";

function ModeButton({
  label,
  selected,
  onPress,
  rs,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  rs: (n: number) => number;
  colors: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 30,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={{
          alignItems: "center",
          paddingVertical: rs(12),
          borderRadius: rs(11),
          backgroundColor: selected ? colors.bg : "transparent",
        }}
      >
        <Text
          style={{
            fontSize: rs(14),
            fontWeight: "700",
            color: selected ? colors.text : colors.textFaint,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StartSessionModal({
  visible,
  onClose,
  onConfirm,
  rs,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (mode: SessionMode, totalMs: number) => void;
  rs: (n: number) => number;
  colors: any;
}) {
  const [mode, setMode] = useState<SessionMode>("stopwatch");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (visible) {
      setMode("stopwatch");
      setHours(0);
      setMinutes(0);
      setSeconds(0);
    }
  }, [visible]);

  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const MIN_TIMER_MS = 60 * 1000;
  const canStart = mode === "stopwatch" || totalMs > MIN_TIMER_MS;

  const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: rs(28),
      borderTopRightRadius: rs(28),
      paddingHorizontal: rs(24),
      paddingTop: rs(20),
      paddingBottom: rs(40),
    },
    handle: {
      width: rs(36),
      height: rs(4),
      borderRadius: 999,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: rs(20),
    },
    title: { fontSize: rs(20), fontWeight: "800", color: colors.text, marginBottom: rs(4) },
    sub: { fontSize: rs(13), color: colors.textFaint, marginBottom: rs(20) },
    modeRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: rs(14),
      padding: rs(4),
      marginBottom: rs(20),
    },
    pickerLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: rs(8),
      textAlign: "center",
    },
    startBtn: {
      backgroundColor: colors.primary,
      borderRadius: rs(20),
      paddingVertical: rs(16),
      alignItems: "center",
      marginTop: rs(20),
    },
    startBtnDisabled: { opacity: 0.4 },
    startBtnText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>집중 세션 시작</Text>
          <Text style={s.sub}>스톱워치 또는 타이머 중에서 선택하세요</Text>

          <View style={s.modeRow}>
            <ModeButton
              label="스톱워치"
              selected={mode === "stopwatch"}
              onPress={() => setMode("stopwatch")}
              rs={rs}
              colors={colors}
            />
            <ModeButton
              label="타이머"
              selected={mode === "timer"}
              onPress={() => setMode("timer")}
              rs={rs}
              colors={colors}
            />
          </View>

          {mode === "timer" && (
            <>
              <Text style={s.pickerLabel}>시간 설정</Text>
              <TimeWheelPicker
                hours={hours}
                minutes={minutes}
                seconds={seconds}
                onChange={(h, m, sec) => {
                  setHours(h);
                  setMinutes(m);
                  setSeconds(sec);
                }}
                rs={rs}
                resetKey={visible ? 1 : 0}
              />
            </>
          )}

          {mode === "timer" && totalMs > 0 && totalMs < MIN_TIMER_MS && (
            <Text style={{ fontSize: rs(12), color: colors.danger, textAlign: "center", marginTop: rs(8) }}>
              최소 1분 이상 설정해주세요
            </Text>
          )}

          <TouchableOpacity
            style={[s.startBtn, !canStart && s.startBtnDisabled]}
            disabled={!canStart}
            onPress={() => onConfirm(mode, totalMs)}
            activeOpacity={0.85}
          >
            <Text style={s.startBtnText}>시작하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const { width } = useWindowDimensions();

  // Web can briefly report width as 0 during first render.
  // Clamp it so SVG circle radius never becomes negative.
  const safeWidth = width && width > 0 ? width : 390;
  const scale = safeWidth / 390;
  const rs = (n: number) => Math.max(1, Math.round(n * scale));
  const router = useRouter();
  const { colors } = useTheme();

  const [splashDone, setSplashDone] = useState(hasShownSplash);
  const [isLoggedIn, setIsLoggedIn] = useState(!!auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setIsLoggedIn(!!u);
    });
    return unsub;
  }, []);

  const { todayMs, weekMs, streakDays, recentSessions, dailyGoalMs, loading } =
    useStudyStats();

  function handleSplashDone() {
    hasShownSplash = true;
    setSplashDone(true);
  }

  const progress = dailyGoalMs > 0 ? Math.min(todayMs / dailyGoalMs, 1) : 0;
  const progressPct = Math.round(progress * 100);

  const circleSize = Math.max(32, Math.min(rs(120), 160));
  const radius = Math.max(1, circleSize / 2 - 8);
  const strokeWidth = Math.max(1, rs(8));
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  function showLoginRequiredAlert() {
    setShowLoginRequired(true);
  }

function handleConfirmStart(mode: SessionMode, totalMs: number) {
  setShowStartModal(false);
  AsyncStorage.removeItem(ACTIVE_FOCUS_SESSION_KEY).finally(() => {
    router.push({
      pathname: "/focus",
      params: {
        sessionId: Date.now().toString(),
        mode,
        ...(mode === "timer" ? { targetMs: String(totalMs) } : {}),
      },
    });
  });
}

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: rs(24) },
    greeting: {
      color: colors.textFaint,
      marginTop: rs(16),
      fontSize: rs(13),
      fontWeight: "500",
    },
    title: {
      fontSize: Math.min(rs(28), 36),
      fontWeight: "bold",
      marginBottom: rs(24),
      marginTop: rs(4),
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      padding: rs(20),
      borderRadius: rs(20),
      marginBottom: rs(16),
    },
    circleContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(4),
    },
    circleText: { position: "absolute", alignItems: "center" },
    time: {
      fontSize: Math.min(rs(20), 28),
      fontWeight: "bold",
      color: colors.text,
    },
    today: { color: colors.textFaint, fontSize: rs(12) },
    progressText: {
      textAlign: "center",
      marginTop: rs(8),
      color: colors.textMuted,
      fontSize: rs(13),
    },
    button: {
      backgroundColor: colors.primary,
      padding: rs(18),
      borderRadius: rs(20),
      alignItems: "center",
      marginBottom: rs(16),
      flexDirection: "row",
      justifyContent: "center",
      gap: rs(8),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: "bold",
      fontSize: Math.min(rs(16), 20),
    },
    row: { flexDirection: "row", gap: rs(12), marginBottom: rs(16) },
    smallCard: {
      backgroundColor: colors.surface,
      padding: rs(18),
      borderRadius: rs(18),
      flex: 1,
    },
    smallTitle: {
      color: colors.textFaint,
      fontSize: rs(11),
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    smallValue: {
      fontSize: Math.min(rs(18), 24),
      fontWeight: "bold",
      marginTop: rs(6),
      color: colors.text,
    },
    sectionLabel: {
      color: colors.textFaint,
      fontSize: rs(11),
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: rs(8),
    },
    sessionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: rs(8),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sessionRowLast: { borderBottomWidth: 0 },
    sessionLabel: { color: colors.textMuted, fontSize: rs(13) },
    green: { color: colors.primary, fontWeight: "600", fontSize: rs(13) },
    empty: {
      color: colors.textFaint,
      fontSize: rs(13),
      marginTop: rs(8),
      textAlign: "center",
    },
    streakRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: rs(4),
      marginTop: rs(6),
    },
  });

  return (
    <SafeAreaView
      style={s.safe}

      edges={Platform.OS === "web" ? [] : ["top", "right", "bottom", "left"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: rs(48) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.container, { flexGrow: 1 }]}>
          <LoginRequiredModal
            visible={showLoginRequired}
            onClose={() => setShowLoginRequired(false)}
            onGoProfile={() => {
              setShowLoginRequired(false);
              router.push("/profile");
            }}
          />

          <StartSessionModal
            visible={showStartModal}
            onClose={() => setShowStartModal(false)}
            onConfirm={handleConfirmStart}
            rs={rs}
            colors={colors}
          />

          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.title}>집중할 준비 됐나요?</Text>

          <View style={s.card}>
            <View style={s.circleContainer}>
              <Svg width={circleSize} height={circleSize}>
                <Circle
                  stroke={colors.border}
                  fill="none"
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
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

              <View style={s.circleText}>
                <Text style={s.time}>{loading ? "..." : formatMs(todayMs)}</Text>
                <Text style={s.today}>오늘</Text>
              </View>
            </View>

            <Text style={s.progressText}>
              {loading
                ? "학습 기록을 불러오는 중..."
                : todayMs === 0
                  ? "아직 세션이 없어요 — 시작해볼까요!"
                  : `오늘 목표의 ${progressPct}%를 달성했어요`}
            </Text>
          </View>

          <TouchableOpacity
            style={s.button}
            onPress={() => {
              if (!isLoggedIn) {
                showLoginRequiredAlert();
                return;
              }
              setShowStartModal(true);
            }}
          >
            <AppIcon name="play" size={rs(16)} color={colors.onPrimary} />
            <Text style={s.buttonText}>집중 시작</Text>
          </TouchableOpacity>

          <View style={s.row}>
            <View style={s.smallCard}>
              <Text style={s.smallTitle}>이번 주</Text>
              <Text style={s.smallValue}>
                {loading ? "..." : weekMs > 0 ? formatMs(weekMs) : "—"}
              </Text>
            </View>

            <View style={s.smallCard}>
              <Text style={s.smallTitle}>연속 일수</Text>

              {loading ? (
                <Text style={s.smallValue}>...</Text>
              ) : streakDays > 0 ? (
                <View style={s.streakRow}>
                  <AppIcon name="flame" size={rs(16)} color={colors.warning} />
                  <Text style={s.smallValue}>{streakDays}일</Text>
                </View>
              ) : (
                <Text style={s.smallValue}>—</Text>
              )}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.sectionLabel}>최근 세션</Text>

            {loading ? (
              <Text style={s.empty}>최근 세션 불러오는 중...</Text>
            ) : recentSessions.length === 0 ? (
              <Text style={s.empty}>세션을 완료하면 여기에 표시돼요</Text>
            ) : (
              recentSessions.map((session, i) => (
                <View
                  style={[
                    s.sessionRow,
                    i === recentSessions.length - 1 && s.sessionRowLast,
                  ]}
                  key={`${session.label}-${i}`}
                >
                  <Text style={s.sessionLabel}>{session.label}</Text>
                  <Text style={s.green}>{formatMs(session.durationMs)}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}