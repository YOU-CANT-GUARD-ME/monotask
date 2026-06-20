// app/focus.tsx
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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

function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const sec = totalSecs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function DndNudge({ rs }: { rs: (n: number) => number }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
        <FontAwesome name="bell-slash" size={rs(18)} color={colors.onPrimary} />
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
          style={{ fontSize: rs(11), color: colors.primaryDark, lineHeight: rs(17) }}
        >
          설정 → 집중 모드 → 방해 금지{"\n"}에서 활성화하면 더 집중할 수 있어요
        </Text>
      </View>
    </Animated.View>
  );
}

export default function FocusScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const { colors } = useTheme();

  const router = useRouter();
  const { sessionId } = useLocalSearchParams();

  const [elapsedMs, setElapsedMs] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId]);

  function goToStudyEnd() {
    const capturedStartTime = startTimeRef.current ?? Date.now();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const durationMs = Date.now() - capturedStartTime;

    router.replace({
      pathname: "/study-end",
      params: {
        durationMs: String(durationMs),
        startTime: new Date(capturedStartTime).toISOString(),
      },
    });

    setTimeout(async () => {
      try {
        if (durationMs > 10000) {
          await saveSession({
            id: String(capturedStartTime),
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
    Alert.alert(
      "세션 종료",
      "집중 세션을 종료하시겠어요?",
      [
        { text: "계속하기", style: "cancel" },
        { text: "종료", style: "destructive", onPress: goToStudyEnd },
      ],
      { cancelable: true }
    );
  }

  const circleSize = Math.min(rs(220), 260);
  const radius = circleSize / 2 - 10;
  const strokeWidth = rs(8);
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
    svgWrapper: { alignItems: "center", justifyContent: "center" },
    timerOverlay: { position: "absolute", alignItems: "center" },
    elapsed: {
      fontSize: Math.min(rs(44), 54),
      fontWeight: "600",
      color: "#e0d8c4",
    },
    elapsedLabel: { fontSize: rs(13), color: colors.primaryDark, marginTop: rs(4) },
    bottomArea: { width: "100%", marginTop: rs(40) },
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
            stroke={colors.heat[2]}
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
    </View>
  );
}