// app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../contexts/ThemeContext";
import { useStudyStats } from "../hooks/useStudyStats";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

let hasShownSplash = false;

function formatMs(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "0m";
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
      style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity, zIndex: 99 }]}
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

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors, resolvedMode } = useTheme();
  
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

  const circleSize = Math.min(rs(120), 160);
  const radius = circleSize / 2 - 8;
  const strokeWidth = rs(8);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const TAB_BAR_STYLE = {
    backgroundColor: resolvedMode === "dark" ? colors.bg : colors.primary,
    borderTopColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : colors.primaryDark,
    borderTopWidth: 1,
    height: 88,
    paddingBottom: 28,
    paddingTop: 10,
  };

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
    <SafeAreaView style={s.safe}>
      <Tabs.Screen
        options={{
          tabBarStyle: splashDone ? TAB_BAR_STYLE : { display: "none" },
        }}
      />

      {!splashDone && <SplashOverlay onDone={handleSplashDone} />}

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: rs(48) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.container}>
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
                Alert.alert(
                  "로그인이 필요해요",
                  "집중 세션을 저장하려면 먼저 로그인해주세요.",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "프로필로 가기",
                      onPress: () => router.push("/profile"),
                    },
                  ]
                );
                return;
              }
              router.push({
                pathname: "/focus",
                params: { sessionId: Date.now().toString() },
              });
            }}
          >
            <Ionicons name="play" size={rs(16)} color={colors.onPrimary} />
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
                  <Ionicons name="flame" size={rs(16)} color={colors.warning} />
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