// app/quiz.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Difficulty, generateQuiz, QuizQuestion } from "../utils/quiz";
import { saveQuizAttempt } from "../utils/storage";

type Answer = "O" | "X";
type Stage = "settings" | "loading" | "playing" | "results";

const ENCOURAGEMENTS = [
  "천천히 생각해보세요 🤔",
  "노트에서 본 내용이에요!",
  "직감을 믿어보세요 ✨",
  "맞다고 생각하면 O, 아니면 X",
  "잘하고 있어요! 계속 가요",
  "집중! 거의 다 왔어요 💪",
  "어렵다면 노트를 떠올려보세요",
  "정답은 노트 안에 있어요 📖",
  "한 문제씩 차근차근 🌱",
  "마지막까지 화이팅! 🔥",
];

const TIMER_PRESETS = [10, 20, 30, 45, 60];

const DIFFICULTY_OPTIONS: {
  key: Difficulty;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { key: "easy", label: "쉬움", desc: "기본 개념 확인", icon: "leaf-outline" },
  { key: "medium", label: "보통", desc: "응용 및 추론 포함", icon: "flame-outline" },
  { key: "hard", label: "어려움", desc: "함정 문제 / 깊은 이해", icon: "flash-outline" },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Countdown ring shown above each question ────────────────────────────────

function CountdownRing({
  seconds,
  resetKey,
  onExpire,
  rs,
  colors,
}: {
  seconds: number;
  resetKey: string;
  onExpire: () => void;
  rs: (n: number) => number;
  colors: any;
}) {
  const size = rs(200);
  const stroke = rs(12);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(1)).current;
  const [display, setDisplay] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    // Reset for new question
    expiredRef.current = false;
    setDisplay(seconds);
    progress.setValue(1);

    Animated.timing(progress, {
      toValue: 0,
      duration: seconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    if (intervalRef.current) clearInterval(intervalRef.current);
    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const remaining = Math.max(0, Math.ceil(seconds - elapsed));
      setDisplay(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        onExpire();
      }
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, seconds]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surface}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={
            display <= 5 ? colors.danger : colors.primary
          }
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            fontSize: rs(40),
            fontWeight: "800",
            color: colors.text,
            lineHeight: rs(42),
          }}
        >
          {display}
        </Text>
        <Text
          style={{
            fontSize: rs(18),
            color: colors.textFaint,
            fontWeight: "600",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginTop: rs(2),
          }}
        >
          초
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{
    noteText?: string;
    aiSummary?: string;
    subject?: string;
    sessionId?: string;
  }>();
  const noteText = params.noteText || "";
  const aiSummary = params.aiSummary || "";
  const subject = params.subject || "기타";
  const sessionId = params.sessionId || "";

  // Settings state
  const [stage, setStage] = useState<Stage>("settings");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [timerOn, setTimerOn] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(30);

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const questionAnim = useRef(new Animated.Value(0)).current;
  const savedAttemptRef = useRef<boolean>(false);

  // Reset to settings whenever the source content changes (new session opened)
  const lastSourceKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${noteText}::${aiSummary}::${subject}::${sessionId}`;
    if (lastSourceKey.current !== key) {
      lastSourceKey.current = key;
      setStage("settings");
      setQuestions([]);
      setCurrentIdx(0);
      setUserAnswers([]);
      setFeedback(null);
      setError(null);
      savedAttemptRef.current = false;
    }
  }, [noteText, aiSummary, subject, sessionId]);

  const startQuiz = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("loading");
    setError(null);
    setCurrentIdx(0);
    setUserAnswers([]);
    setQuestions([]);
    setFeedback(null);
    savedAttemptRef.current = false;

    try {
      const qs = await generateQuiz(noteText, aiSummary, subject, difficulty);
      setQuestions(qs);
      setStage("playing");
      animateQuestionIn();
    } catch (e: any) {
      setError(e.message ?? "퀴즈 생성 실패");
    }
  };

  const animateQuestionIn = () => {
    questionAnim.setValue(0);
    Animated.timing(questionAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const persistAttempt = (finalAnswers: Answer[]) => {
    if (savedAttemptRef.current) return;
    savedAttemptRef.current = true;

    const correct = finalAnswers.filter(
      (ans, i) => ans === questions[i]?.answer
    ).length;
    const total = questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const questionSnapshots = questions.map((q, i) => ({
      question: q.question,
      answer: q.answer,
      explanation: q.explanation,
      userAnswer: finalAnswers[i] ?? "",
    }));

    saveQuizAttempt({
      id: Date.now().toString(),
      sessionId,
      subject,
      score: correct,
      total,
      percentage,
      takenAt: Date.now(),
      questions: questionSnapshots,
      difficulty,
      timerSeconds: timerOn ? timerSeconds : 0,
    });
  };

  const advanceAfterAnswer = (newAnswers: Answer[]) => {
    setTimeout(() => {
      setFeedback(null);
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx((i) => i + 1);
        animateQuestionIn();
      } else {
        persistAttempt(newAnswers);
        setStage("results");
      }
    }, 600);
  };

  const handleAnswer = (answer: Answer) => {
    if (feedback !== null) return;

    const current = questions[currentIdx];
    const isCorrect = current.answer === answer;

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    setFeedback(isCorrect ? "correct" : "wrong");
    const newAnswers = [...userAnswers, answer];
    setUserAnswers(newAnswers);

    advanceAfterAnswer(newAnswers);
  };

  // Called when the countdown ring hits 0
  const handleTimeExpired = () => {
    if (feedback !== null) return; // already answered
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setFeedback("wrong");
    // "" = blank — marked wrong
    const newAnswers = [...userAnswers, "" as any];
    setUserAnswers(newAnswers);
    advanceAfterAnswer(newAnswers);
  };

  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage("settings");
    setQuestions([]);
    setCurrentIdx(0);
    setUserAnswers([]);
    setFeedback(null);
    savedAttemptRef.current = false;
  };

  const score = userAnswers.filter(
    (ans, i) => ans === questions[i]?.answer
  ).length;

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, paddingHorizontal: rs(24), paddingBottom: rs(20) },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: rs(8),
      paddingBottom: rs(16),
    },
    closeBtn: {
      width: rs(36),
      height: rs(36),
      borderRadius: rs(18),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    progressText: {
      fontSize: rs(13),
      color: colors.textMuted,
      fontWeight: "700",
    },

    // ── Settings ──────────────────────────────────────────────────────────
    settingsTitle: {
      fontSize: rs(17),
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      letterSpacing: -0.3,
    },
    settingsSub: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      marginTop: rs(4),
      marginBottom: rs(28),
    },
    sectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: rs(10),
    },
    diffCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: rs(14),
      padding: rs(14),
      borderRadius: rs(18),
      marginBottom: rs(10),
      borderWidth: 3,
      borderColor: "transparent",
      backgroundColor: colors.surface,
    },
    diffCardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    diffIcon: {
      width: rs(40),
      height: rs(40),
      borderRadius: rs(20),
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    diffIconSelected: { backgroundColor: "rgba(255,255,255,0.2)" },
    diffLabel: { fontSize: rs(15), fontWeight: "800", color: colors.text },
    diffLabelSelected: { color: colors.onPrimary },
    diffDesc: {
      fontSize: rs(12),
      color: colors.textFaint,
      marginTop: rs(2),
    },
    diffDescSelected: { color: "rgba(244,241,234,0.75)" },

    timerToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: rs(16),
      borderRadius: rs(18),
      backgroundColor: colors.surface,
      marginBottom: rs(18),
    },
    toggleTrack: {
      width: rs(48),
      height: rs(28),
      borderRadius: rs(14),
      padding: rs(3),
      justifyContent: "center",
    },
    toggleThumb: {
      width: rs(22),
      height: rs(22),
      borderRadius: rs(11),
      backgroundColor: colors.bg,
    },
    timerRow: {
      flexDirection: "row",
      gap: rs(8),
      marginBottom: rs(20),
    },
    timerPill: {
      flex: 1,
      paddingVertical: rs(12),
      borderRadius: rs(14),
      borderWidth: 2,
      borderColor: "transparent",
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    timerPillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    timerPillText: {
      fontSize: rs(13),
      fontWeight: "700",
      color: colors.textMuted,
    },
    timerPillTextSelected: { color: colors.onPrimary },

    previewLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      textAlign: "center",
      marginBottom: rs(12),
    },
    previewWrap: { alignItems: "center", marginBottom: rs(20) },

    startBtn: {
      backgroundColor: colors.primary,
      padding: rs(18),
      borderRadius: rs(20),
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    startBtnText: {
      color: colors.onPrimary,
      fontWeight: "800",
      fontSize: rs(16),
      letterSpacing: -0.2,
    },

    // ── Loading / Playing / Results (kept from original) ──────────────────
    progressBarBg: {
      height: rs(6),
      borderRadius: rs(3),
      backgroundColor: colors.surface,
      overflow: "hidden",
      marginBottom: rs(16),
    },
    progressBarFill: {
      height: "100%",
      borderRadius: rs(3),
      backgroundColor: colors.primary,
    },
    centeredWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: rs(32),
      gap: rs(16),
    },
    loadingTitle: {
      fontSize: rs(18),
      fontWeight: "700",
      color: colors.text,
      marginTop: rs(8),
    },
    loadingSub: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      lineHeight: rs(20),
    },
    errorIcon: {
      width: rs(64),
      height: rs(64),
      borderRadius: rs(32),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(8),
    },
    errorTitle: {
      fontSize: rs(16),
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    errorText: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      lineHeight: rs(20),
    },
    retryBtn: {
      marginTop: rs(8),
      backgroundColor: colors.primary,
      paddingVertical: rs(14),
      paddingHorizontal: rs(28),
      borderRadius: rs(16),
    },
    retryBtnText: {
      color: colors.onPrimary,
      fontWeight: "700",
      fontSize: rs(14),
    },

    ringWrap: { alignItems: "center", marginBottom: rs(16) },
    questionCard: {
      backgroundColor: colors.surface,
      borderRadius: rs(24),
      padding: rs(24),
      minHeight: rs(160),
      justifyContent: "center",
      marginBottom: rs(16),
    },
    encourageWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: rs(10),
    },
    encourageIcon: {
      width: rs(48),
      height: rs(48),
      borderRadius: rs(24),
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    encourageText: {
      fontSize: rs(14),
      color: colors.textMuted,
      fontWeight: "600",
      textAlign: "center",
      paddingHorizontal: rs(24),
      lineHeight: rs(20),
    },
    questionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: rs(12),
    },
    questionText: {
      fontSize: rs(22),
      fontWeight: "700",
      color: colors.text,
      lineHeight: rs(32),
    },
    answerRow: {
      flexDirection: "row",
      gap: rs(14),
      height: rs(130),
    },
    answerBtn: {
      flex: 1,
      borderRadius: rs(28),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: "transparent",
    },
    answerBtnCorrect: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    answerBtnWrong: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    answerSymbol: { fontSize: rs(60), fontWeight: "900" },
    answerSymbolO: { color: colors.primary },
    answerSymbolX: { color: colors.danger },
    answerSymbolFlash: { color: colors.onPrimary },

    resultsHeader: {
      alignItems: "center",
      paddingTop: rs(20),
      paddingBottom: rs(28),
    },
    scoreCircle: {
      width: rs(140),
      height: rs(140),
      borderRadius: rs(70),
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(20),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    scoreText: {
      fontSize: rs(48),
      fontWeight: "800",
      color: colors.onPrimary,
    },
    scoreLabel: {
      fontSize: rs(12),
      color: "rgba(244,241,234,0.85)",
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: rs(-4),
    },
    resultsTitle: {
      fontSize: rs(22),
      fontWeight: "800",
      color: colors.text,
      marginBottom: rs(6),
    },
    resultsSub: {
      fontSize: rs(14),
      color: colors.textMuted,
      textAlign: "center",
    },
    reviewSection: { marginTop: rs(8) },
    reviewSectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: rs(12),
    },
    reviewCard: {
      backgroundColor: colors.surface,
      borderRadius: rs(18),
      padding: rs(16),
      marginBottom: rs(10),
      flexDirection: "row",
      gap: rs(12),
    },
    reviewIcon: {
      width: rs(28),
      height: rs(28),
      borderRadius: rs(14),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: rs(1),
    },
    reviewIconCorrect: { backgroundColor: colors.primary },
    reviewIconWrong: { backgroundColor: colors.danger },
    reviewBody: { flex: 1, gap: rs(6) },
    reviewQuestion: {
      fontSize: rs(14),
      fontWeight: "700",
      color: colors.text,
      lineHeight: rs(20),
    },
    reviewAnswerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: rs(8),
      marginTop: rs(2),
    },
    reviewAnswerLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "600",
    },
    reviewAnswerValue: { fontSize: rs(12), fontWeight: "800" },
    reviewAnswerCorrect: { color: colors.primary },
    reviewAnswerWrong: { color: colors.danger },
    reviewExplanation: {
      fontSize: rs(12),
      color: colors.textMuted,
      lineHeight: rs(18),
      marginTop: rs(4),
    },
    footerRow: {
      flexDirection: "row",
      gap: rs(10),
      marginTop: rs(16),
      marginBottom: rs(8),
    },
    footerBtn: {
      flex: 1,
      paddingVertical: rs(16),
      borderRadius: rs(20),
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: rs(8),
    },
    footerBtnSecondary: { backgroundColor: colors.surface },
    footerBtnPrimary: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    footerBtnTextSecondary: {
      fontSize: rs(14),
      color: colors.text,
      fontWeight: "700",
    },
    footerBtnTextPrimary: {
      fontSize: rs(14),
      color: colors.onPrimary,
      fontWeight: "700",
    },
  });

  // ── STAGE: SETTINGS ─────────────────────────────────────────────────────
  if (stage === "settings") {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: rs(24), paddingBottom: rs(40) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={rs(20)} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={s.settingsTitle}>퀴즈 설정</Text>
            <View style={{ width: rs(36) }} />
          </View>

          <Text style={s.settingsSub}>난이도와 타이머를 골라주세요</Text>

          {/* Difficulty */}
          <Text style={s.sectionLabel}>난이도</Text>
          {DIFFICULTY_OPTIONS.map((opt) => {
            const selected = difficulty === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDifficulty(opt.key);
                }}
                activeOpacity={0.85}
                style={[s.diffCard, selected && s.diffCardSelected]}
              >
                <View style={[s.diffIcon, selected && s.diffIconSelected]}>
                  <Ionicons
                    name={opt.icon}
                    size={rs(20)}
                    color={selected ? colors.onPrimary : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.diffLabel, selected && s.diffLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[s.diffDesc, selected && s.diffDescSelected]}>
                    {opt.desc}
                  </Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark" size={rs(20)} color={colors.onPrimary} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Timer toggle */}
          <View style={[s.timerToggleRow, { marginTop: rs(18) }]}>
            <View>
              <Text style={{ fontSize: rs(15), fontWeight: "800", color: colors.text }}>
                타이머 사용
              </Text>
              <Text
                style={{ fontSize: rs(12), color: colors.textFaint, marginTop: rs(2) }}
              >
                문제마다 시간 제한
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.selectionAsync();
                setTimerOn((v) => !v);
              }}
              style={[
                s.toggleTrack,
                { backgroundColor: timerOn ? colors.primary : colors.border },
              ]}
            >
              <View
                style={[
                  s.toggleThumb,
                  { alignSelf: timerOn ? "flex-end" : "flex-start" },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Timer presets */}
          {timerOn && (
            <>
              <Text style={s.sectionLabel}>문제당 시간</Text>
              <View style={s.timerRow}>
                {TIMER_PRESETS.map((sec) => {
                  const selected = timerSeconds === sec;
                  return (
                    <TouchableOpacity
                      key={sec}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTimerSeconds(sec);
                      }}
                      activeOpacity={0.85}
                      style={[s.timerPill, selected && s.timerPillSelected]}
                    >
                      <Text
                        style={[
                          s.timerPillText,
                          selected && s.timerPillTextSelected,
                        ]}
                      >
                        {sec}초
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Preview */}
              <Text style={s.previewLabel}>미리보기</Text>
              <View style={s.previewWrap}>
                <View
                  style={{
                    width: rs(120),
                    height: rs(120),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Svg
                    width={rs(120)}
                    height={rs(120)}
                    style={{ transform: [{ rotate: "-90deg" }] }}
                  >
                    <Circle
                      cx={rs(60)}
                      cy={rs(60)}
                      r={rs(52)}
                      stroke={colors.surface}
                      strokeWidth={rs(10)}
                      fill="none"
                    />
                    <Circle
                      cx={rs(60)}
                      cy={rs(60)}
                      r={rs(52)}
                      stroke={colors.primary}
                      strokeWidth={rs(10)}
                      strokeDasharray={2 * Math.PI * rs(52)}
                      strokeDashoffset={2 * Math.PI * rs(52) * 0.33}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </Svg>
                  <View style={{ position: "absolute", alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: rs(32),
                        fontWeight: "800",
                        color: colors.text,
                        lineHeight: rs(36),
                      }}
                    >
                      {timerSeconds}
                    </Text>
                    <Text
                      style={{
                        fontSize: rs(11),
                        color: colors.textFaint,
                        fontWeight: "600",
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        marginTop: rs(2),
                      }}
                    >
                      초
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity style={s.startBtn} onPress={startQuiz} activeOpacity={0.9}>
            <Text style={s.startBtnText}>퀴즈 시작</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── STAGE: LOADING ──────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity style={s.closeBtn} onPress={() => setStage("settings")}>
              <Ionicons name="close" size={rs(20)} color={colors.textMuted} />
            </TouchableOpacity>
            <View />
            <View style={{ width: rs(36) }} />
          </View>

          {error ? (
            <View style={s.centeredWrap}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle-outline" size={rs(32)} color={colors.danger} />
              </View>
              <Text style={s.errorTitle}>퀴즈 생성 실패</Text>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity
                style={s.retryBtn}
                onPress={() => setStage("settings")}
                activeOpacity={0.85}
              >
                <Text style={s.retryBtnText}>설정으로 돌아가기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.centeredWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={s.loadingTitle}>퀴즈를 만들고 있어요</Text>
              <Text style={s.loadingSub}>
                {difficulty === "hard"
                  ? "어려운 문제를 신중하게 만드는 중..."
                  : "노트와 요약을 분석해서\nOX 문제 10개를 준비하는 중입니다"}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── STAGE: PLAYING ──────────────────────────────────────────────────────
  if (stage === "playing") {
    const current = questions[currentIdx];
    const progress = (currentIdx + 1) / questions.length;

    const animatedStyle = {
      opacity: questionAnim,
      transform: [
        {
          translateY: questionAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
    };

    return (
      <SafeAreaView style={s.safe}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={rs(20)} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={s.progressText}>
              {currentIdx + 1} / {questions.length}
            </Text>
            <View style={{ width: rs(36) }} />
          </View>

          <View style={s.progressBarBg}>
            <Animated.View
              style={[s.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>

          <Animated.View style={[s.questionCard, animatedStyle]}>
            <Text style={s.questionLabel}>문제 {currentIdx + 1}</Text>
            <Text style={s.questionText}>{current.question}</Text>
          </Animated.View>

          {timerOn ? (
            <View style={s.ringWrap}>
              <CountdownRing
                seconds={timerSeconds}
                resetKey={`${currentIdx}`}
                onExpire={handleTimeExpired}
                rs={rs}
                colors={colors}
              />
            </View>
          ) : (
            <View style={s.encourageWrap}>
              <View style={s.encourageIcon}>
                <Ionicons name="bulb-outline" size={rs(26)} color={colors.primary} />
              </View>
              <Text style={s.encourageText}>
                {ENCOURAGEMENTS[currentIdx % ENCOURAGEMENTS.length]}
              </Text>
            </View>
          )}

          <View style={s.answerRow}>
            <TouchableOpacity
              style={[
                s.answerBtn,
                feedback === "correct" && current.answer === "O" && s.answerBtnCorrect,
                feedback === "wrong" && current.answer === "X" && s.answerBtnCorrect,
                feedback === "wrong" && current.answer === "O" && s.answerBtnWrong,
              ]}
              onPress={() => handleAnswer("O")}
              activeOpacity={0.85}
              disabled={feedback !== null}
            >
              <Text
                style={[
                  s.answerSymbol,
                  s.answerSymbolO,
                  feedback !== null && current.answer === "O" && s.answerSymbolFlash,
                  feedback === "wrong" && current.answer !== "O" && s.answerSymbolFlash,
                ]}
              >
                O
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.answerBtn,
                feedback === "correct" && current.answer === "X" && s.answerBtnCorrect,
                feedback === "wrong" && current.answer === "O" && s.answerBtnCorrect,
                feedback === "wrong" && current.answer === "X" && s.answerBtnWrong,
              ]}
              onPress={() => handleAnswer("X")}
              activeOpacity={0.85}
              disabled={feedback !== null}
            >
              <Text
                style={[
                  s.answerSymbol,
                  s.answerSymbolX,
                  feedback !== null && current.answer === "X" && s.answerSymbolFlash,
                  feedback === "wrong" && current.answer !== "X" && s.answerSymbolFlash,
                ]}
              >
                X
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── STAGE: RESULTS ──────────────────────────────────────────────────────
  const scorePct = Math.round((score / questions.length) * 100);
  const encouragement =
    scorePct === 100
      ? "완벽해요!"
      : scorePct >= 80
      ? "훌륭해요!"
      : scorePct >= 60
      ? "잘했어요!"
      : scorePct >= 40
      ? "괜찮아요"
      : "다시 복습해봐요";

  const difficultyLabel = DIFFICULTY_OPTIONS.find((d) => d.key === difficulty)?.label;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: rs(24), paddingBottom: rs(48) }}
      >
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={rs(20)} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={s.progressText}>결과</Text>
          <View style={{ width: rs(36) }} />
        </View>

        <View style={s.resultsHeader}>
          <View style={s.scoreCircle}>
            <Text style={s.scoreText}>
              {score}
              <Text style={{ fontSize: rs(28), opacity: 0.75 }}>
                /{questions.length}
              </Text>
            </Text>
            <Text style={s.scoreLabel}>{scorePct}%</Text>
          </View>
          <Text style={s.resultsTitle}>{encouragement}</Text>
          <Text style={s.resultsSub}>
            {score}개 정답, {questions.length - score}개 오답
          </Text>
          <Text
            style={{
              fontSize: rs(11),
              color: colors.textFaint,
              fontWeight: "600",
              marginTop: rs(8),
              letterSpacing: 0.4,
            }}
          >
            난이도: {difficultyLabel}
            {timerOn ? ` · ${timerSeconds}초` : " · 타이머 없음"}
          </Text>
        </View>

        <View style={s.reviewSection}>
          <Text style={s.reviewSectionLabel}>문제 해설</Text>

          {questions.map((q, i) => {
            const userAns = userAnswers[i];
            const isCorrect = userAns === q.answer;
            return (
              <View key={i} style={s.reviewCard}>
                <View
                  style={[
                    s.reviewIcon,
                    isCorrect ? s.reviewIconCorrect : s.reviewIconWrong,
                  ]}
                >
                  <Ionicons
                    name={isCorrect ? "checkmark" : "close"}
                    size={rs(16)}
                    color={colors.onPrimary}
                  />
                </View>
                <View style={s.reviewBody}>
                  <Text style={s.reviewQuestion}>
                    {i + 1}. {q.question}
                  </Text>
                  <View style={s.reviewAnswerRow}>
                    <Text style={s.reviewAnswerLabel}>정답:</Text>
                    <Text style={[s.reviewAnswerValue, s.reviewAnswerCorrect]}>
                      {q.answer}
                    </Text>
                    {!isCorrect && (
                      <>
                        <Text style={s.reviewAnswerLabel}>· 내 답:</Text>
                        <Text style={[s.reviewAnswerValue, s.reviewAnswerWrong]}>
                          {userAns || "—"}
                        </Text>
                      </>
                    )}
                  </View>
                  <Text style={s.reviewExplanation}>{q.explanation}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.footerRow}>
          <TouchableOpacity
            style={[s.footerBtn, s.footerBtnSecondary]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={rs(15)} color={colors.text} />
            <Text style={s.footerBtnTextSecondary}>돌아가기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.footerBtn, s.footerBtnPrimary]}
            onPress={handleRetake}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={rs(15)} color={colors.onPrimary} />
            <Text style={s.footerBtnTextPrimary}>다시 풀기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}