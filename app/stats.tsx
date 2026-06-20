// app/stats.tsx
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { ThemePalette } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import {
  getQuizAttempts,
  getSessions,
  QuizAttempt,
  Session,
} from "../utils/storage";

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatHm(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeek(
  monday: Date,
  dailyMap: Map<number, number>
): { label: string; ms: number; dateTs: number }[] {
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = startOfDay(d.getTime());
    return { label, ms: dailyMap.get(key) ?? 0, dateTs: key };
  });
}

function buildHeatmap(
  weeks: number,
  dailyMap: Map<number, number>
): { dateTs: number; ms: number }[][] {
  const today = new Date();
  const monday = getWeekMonday(today);
  const result: { dateTs: number; ms: number }[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() - w * 7);
    const row = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = startOfDay(d.getTime());
      return { dateTs: key, ms: dailyMap.get(key) ?? 0 };
    });
    result.push(row);
  }
  return result;
}

function heatColor(ms: number, heat: ThemePalette["heat"]): string {
  if (ms === 0) return heat[0];
  const mins = ms / 60000;
  if (mins < 30) return heat[1];
  if (mins < 60) return heat[2];
  if (mins < 120) return heat[3];
  if (mins < 180) return heat[4];
  return heat[5];
}

function AnimatedBar({
  ms,
  maxMs,
  maxHeight,
  isToday,
  delay,
  colors,
}: {
  ms: number;
  maxMs: number;
  maxHeight: number;
  isToday: boolean;
  delay: number;
  colors: ThemePalette;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const ratio = maxMs > 0 ? ms / maxMs : 0;
  const targetHeight = Math.max(ratio * maxHeight, ms > 0 ? 4 : 0);

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: targetHeight,
      delay,
      useNativeDriver: false,
      friction: 7,
      tension: 60,
    }).start();
  }, [targetHeight, delay]);

  return (
    <Animated.View
      style={{
        height: anim,
        width: "100%",
        borderRadius: 6,
        backgroundColor: isToday ? colors.primary : colors.heat[2],
        shadowColor: isToday ? colors.primary : "transparent",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isToday ? 0.35 : 0,
        shadowRadius: 6,
        elevation: isToday ? 4 : 0,
      }}
    />
  );
}

// ─── Daily quiz score chart ─────────────────────────────────────────────────
//
// Aggregates quiz attempts by day. For days with multiple attempts, shows the
// average percentage. Empty days are gaps in the line.

type DailyQuizPoint = {
  dateTs: number;
  avgPct: number | null; // null = no attempts that day
  count: number;
};

function buildDailyQuizSeries(
  attempts: QuizAttempt[],
  days: number
): DailyQuizPoint[] {
  const today = startOfDay(Date.now());
  // Build empty points for the last N days, oldest first
  const points: DailyQuizPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    points.push({
      dateTs: today - i * 86400000,
      avgPct: null,
      count: 0,
    });
  }

  // Accumulate sums per day key for averaging
  const sums = new Map<number, { total: number; count: number }>();
  for (const a of attempts) {
    const key = startOfDay(a.takenAt);
    const cur = sums.get(key) ?? { total: 0, count: 0 };
    cur.total += a.percentage;
    cur.count += 1;
    sums.set(key, cur);
  }

  for (const p of points) {
    const s = sums.get(p.dateTs);
    if (s) {
      p.avgPct = Math.round(s.total / s.count);
      p.count = s.count;
    }
  }
  return points;
}

function QuizLineChart({
  points,
  width,
  height,
  colors,
}: {
  points: DailyQuizPoint[];
  width: number;
  height: number;
  colors: ThemePalette;
}) {
  // Chart drawing area
  const padTop = 12;
  const padBottom = 24;
  const padLeft = 28;
  const padRight = 8;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // x positions evenly spaced
  const xAt = (i: number) =>
    padLeft + (points.length > 1 ? (i / (points.length - 1)) * chartW : chartW / 2);
  // y positions: percentage 0..100 maps inverted
  const yAt = (pct: number) => padTop + (1 - pct / 100) * chartH;

  // Build polyline string from non-null points; gaps just don't get added
  // (Polyline doesn't render isolated single points, so we'll add Circles too)
  const linePoints = points
    .map((p, i) => (p.avgPct !== null ? `${xAt(i)},${yAt(p.avgPct)}` : null))
    .filter((v) => v !== null) as string[];

  // Y-axis gridlines at 0, 50, 100
  const gridY = [0, 50, 100];

  return (
    <Svg width={width} height={height}>
      {/* Horizontal grid lines */}
      {gridY.map((pct) => (
        <Line
          key={pct}
          x1={padLeft}
          x2={width - padRight}
          y1={yAt(pct)}
          y2={yAt(pct)}
          stroke={colors.borderSoft}
          strokeWidth={1}
        />
      ))}

      {/* Score line */}
      {linePoints.length > 1 && (
        <Polyline
          points={linePoints.join(" ")}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Data point circles */}
      {points.map((p, i) =>
        p.avgPct !== null ? (
          <Circle
            key={i}
            cx={xAt(i)}
            cy={yAt(p.avgPct)}
            r={4}
            fill={colors.bg}
            stroke={colors.primary}
            strokeWidth={2}
          />
        ) : null
      )}
    </Svg>
  );
}

export default function StatsScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const { colors } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<{
    label: string;
    ms: number;
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [heatWeeks] = useState(18);
  // Quiz chart range: 7 or 30 days
  const [quizRange, setQuizRange] = useState<7 | 30>(7);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const [sess, att] = await Promise.all([getSessions(), getQuizAttempts()]);
    setSessions(sess);
    setAttempts(att);
    setLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const dailyMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of sessions) {
      const key = startOfDay(s.startTime);
      map.set(key, (map.get(key) ?? 0) + s.durationMs);
    }
    return map;
  }, [sessions]);

  const todayTs = startOfDay(Date.now());

  const displayMonday = useMemo(() => {
    const m = getWeekMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDays = useMemo(
    () => buildWeek(displayMonday, dailyMap),
    [displayMonday, dailyMap]
  );
  const maxMs = useMemo(
    () => Math.max(...weekDays.map((d) => d.ms), 1),
    [weekDays]
  );
  const weekTotal = useMemo(
    () => weekDays.reduce((a, d) => a + d.ms, 0),
    [weekDays]
  );

  const heatmap = useMemo(
    () => buildHeatmap(heatWeeks, dailyMap),
    [heatWeeks, dailyMap]
  );

  const totalMs = useMemo(
    () => sessions.reduce((a, s) => a + s.durationMs, 0),
    [sessions]
  );
  const streakDays = useMemo(() => {
    let streak = 0;
    let check = todayTs;
    while (dailyMap.has(check)) {
      streak++;
      check -= 86400000;
    }
    return streak;
  }, [dailyMap, todayTs]);

  // Quiz stats
  const quizSeries = useMemo(
    () => buildDailyQuizSeries(attempts, quizRange),
    [attempts, quizRange]
  );
  const totalQuizzes = attempts.length;
  const overallAvgPct = useMemo(() => {
    if (attempts.length === 0) return 0;
    const sum = attempts.reduce((a, x) => a + x.percentage, 0);
    return Math.round(sum / attempts.length);
  }, [attempts]);
  const bestPct = useMemo(() => {
    if (attempts.length === 0) return 0;
    return Math.max(...attempts.map((a) => a.percentage));
  }, [attempts]);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = isCurrentWeek
    ? "이번 주"
    : weekOffset === -1
    ? "지난 주"
    : `${Math.abs(weekOffset)}주 전`;

  const BAR_AREA_HEIGHT = rs(140);

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: rs(48) },

    header: {
      paddingHorizontal: rs(24),
      paddingTop: rs(20),
      paddingBottom: rs(16),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: rs(22),
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSub: { fontSize: rs(13), color: colors.textFaint, marginTop: rs(2) },

    summaryRow: {
      flexDirection: "row",
      gap: rs(10),
      paddingHorizontal: rs(24),
      marginBottom: rs(24),
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: rs(16),
      paddingVertical: rs(14),
      paddingHorizontal: rs(12),
      alignItems: "center",
      gap: rs(4),
    },
    summaryCardGreen: { backgroundColor: colors.primary },
    summaryValue: { fontSize: rs(18), fontWeight: "800", color: colors.text },
    summaryValueWhite: { color: colors.onPrimary },
    summaryLabel: {
      fontSize: rs(10),
      color: colors.textFaint,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    summaryLabelWhite: { color: "rgba(244,241,234,0.75)" },

    sectionCard: {
      marginHorizontal: rs(24),
      marginBottom: rs(16),
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      padding: rs(20),
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: rs(16),
    },
    sectionTitle: { fontSize: rs(14), fontWeight: "700", color: colors.text },
    sectionSub: { fontSize: rs(12), color: colors.textFaint },
    weekNav: { flexDirection: "row", alignItems: "center", gap: rs(8) },
    weekNavBtn: {
      width: rs(28),
      height: rs(28),
      borderRadius: rs(14),
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    weekNavBtnDisabled: { opacity: 0.35 },
    weekLabelText: {
      fontSize: rs(12),
      color: colors.textMuted,
      fontWeight: "600",
      minWidth: rs(48),
      textAlign: "center",
    },

    barChart: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: BAR_AREA_HEIGHT,
      gap: rs(6),
    },
    barCol: { flex: 1, alignItems: "center", gap: rs(6) },
    barWrapper: { flex: 1, width: "100%", justifyContent: "flex-end" },
    barDayLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "600",
    },
    barDayLabelToday: { color: colors.primary, fontWeight: "800" },

    selectedInfo: {
      marginTop: rs(14),
      paddingTop: rs(14),
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: rs(8),
    },
    selectedDot: {
      width: rs(8),
      height: rs(8),
      borderRadius: rs(4),
      backgroundColor: colors.primary,
    },
    selectedText: { fontSize: rs(13), color: colors.textMuted, flex: 1 },

    heatmapLegend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: rs(4),
      marginTop: rs(10),
    },
    legendText: { fontSize: rs(10), color: colors.textFaint },
    legendCell: { borderRadius: rs(2) },

    monthRow: { flexDirection: "row", marginBottom: rs(6) },

    // Quiz chart-specific styles
    quizSummaryRow: {
      flexDirection: "row",
      gap: rs(10),
      marginBottom: rs(16),
    },
    quizPill: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: rs(12),
      paddingVertical: rs(10),
      alignItems: "center",
      gap: rs(2),
    },
    quizPillValue: { fontSize: rs(16), fontWeight: "800", color: colors.text },
    quizPillLabel: {
      fontSize: rs(10),
      color: colors.textFaint,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    rangeToggle: {
      flexDirection: "row",
      backgroundColor: colors.bg,
      borderRadius: rs(10),
      padding: rs(2),
      gap: rs(2),
    },
    rangeBtn: {
      paddingVertical: rs(5),
      paddingHorizontal: rs(10),
      borderRadius: rs(8),
    },
    rangeBtnActive: { backgroundColor: colors.surface },
    rangeBtnText: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
    },
    rangeBtnTextActive: { color: colors.text },

    quizYAxis: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: rs(28),
    },
    quizYLabel: {
      position: "absolute",
      fontSize: rs(9),
      color: colors.textFaint,
      fontWeight: "600",
    },

    quizEmpty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: rs(24),
      gap: rs(6),
    },
    quizEmptyTitle: { fontSize: rs(13), color: colors.textMuted, fontWeight: "700" },
    quizEmptySub: {
      fontSize: rs(11),
      color: colors.textFaint,
      textAlign: "center",
    },
  });

  const heatPad = rs(20) * 2;
  const heatGap = rs(3);
  const cellSize = Math.floor(
    (width - rs(24) * 2 - heatPad - heatGap * (heatWeeks - 1)) / heatWeeks
  );

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    heatmap.forEach((week, wi) => {
      const month = new Date(week[0].dateTs).getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: new Date(week[0].dateTs).toLocaleDateString("ko-KR", {
            month: "short",
          }),
          col: wi,
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [heatmap]);

  // Quiz chart dimensions (matches the section card's inner width)
  const quizChartWidth = width - rs(24) * 2 - rs(20) * 2;
  const quizChartHeight = rs(160);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textFaint, fontSize: rs(14) }}>
            불러오는 중…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <Animated.ScrollView
        style={[s.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>통계</Text>
            <Text style={s.headerSub}>공부 기록을 한눈에</Text>
          </View>
          <Ionicons name="stats-chart" size={rs(22)} color={colors.primary} />
        </View>

        <View style={s.summaryRow}>
          <View style={[s.summaryCard, s.summaryCardGreen]}>
            <Text style={[s.summaryValue, s.summaryValueWhite]}>
              {streakDays}일
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: rs(4),
              }}
            >
              <FontAwesome
                name="fire"
                size={rs(10)}
                color="rgba(244,241,234,0.75)"
              />
              <Text style={[s.summaryLabel, s.summaryLabelWhite]}>연속</Text>
            </View>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{formatHm(weekTotal)}</Text>
            <Text style={s.summaryLabel}>이번 주</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{formatHm(totalMs)}</Text>
            <Text style={s.summaryLabel}>누적 시간</Text>
          </View>
        </View>

        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>주간 공부 시간</Text>
              <Text style={s.sectionSub}>{formatHm(weekTotal)} 합계</Text>
            </View>
            <View style={s.weekNav}>
              <TouchableOpacity
                style={s.weekNavBtn}
                onPress={() => {
                  setWeekOffset((o) => o - 1);
                  setSelectedDay(null);
                }}
              >
                <Ionicons name="chevron-back" size={rs(14)} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={s.weekLabelText}>{weekLabel}</Text>
              <TouchableOpacity
                style={[s.weekNavBtn, isCurrentWeek && s.weekNavBtnDisabled]}
                disabled={isCurrentWeek}
                onPress={() => {
                  setWeekOffset((o) => o + 1);
                  setSelectedDay(null);
                }}
              >
                <Ionicons name="chevron-forward" size={rs(14)} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.barChart}>
            {weekDays.map((day, i) => {
              const isToday = day.dateTs === todayTs;
              return (
                <TouchableOpacity
                  key={i}
                  style={s.barCol}
                  activeOpacity={0.75}
                  onPress={() =>
                    setSelectedDay(
                      day.ms > 0 ? { label: day.label, ms: day.ms } : null
                    )
                  }
                >
                  <View style={s.barWrapper}>
                    <AnimatedBar
                      ms={day.ms}
                      maxMs={maxMs}
                      maxHeight={BAR_AREA_HEIGHT - rs(20)}
                      isToday={isToday}
                      delay={i * 40}
                      colors={colors}
                    />
                  </View>
                  <Text style={[s.barDayLabel, isToday && s.barDayLabelToday]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDay && (
            <View style={s.selectedInfo}>
              <View style={s.selectedDot} />
              <Text style={s.selectedText}>
                {selectedDay.label} — {formatHm(selectedDay.ms)} 공부
              </Text>
              <TouchableOpacity onPress={() => setSelectedDay(null)}>
                <Ionicons name="close-circle" size={rs(16)} color={colors.border} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Quiz score trend ─────────────────────────────────────────── */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View>
              <Text style={s.sectionTitle}>퀴즈 점수 추이</Text>
              <Text style={s.sectionSub}>일별 평균 정답률</Text>
            </View>
            <View style={s.rangeToggle}>
              <TouchableOpacity
                style={[s.rangeBtn, quizRange === 7 && s.rangeBtnActive]}
                onPress={() => setQuizRange(7)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.rangeBtnText,
                    quizRange === 7 && s.rangeBtnTextActive,
                  ]}
                >
                  7일
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.rangeBtn, quizRange === 30 && s.rangeBtnActive]}
                onPress={() => setQuizRange(30)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    s.rangeBtnText,
                    quizRange === 30 && s.rangeBtnTextActive,
                  ]}
                >
                  30일
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.quizSummaryRow}>
            <View style={s.quizPill}>
              <Text style={s.quizPillValue}>{totalQuizzes}회</Text>
              <Text style={s.quizPillLabel}>총 횟수</Text>
            </View>
            <View style={s.quizPill}>
              <Text style={s.quizPillValue}>{overallAvgPct}%</Text>
              <Text style={s.quizPillLabel}>평균</Text>
            </View>
            <View style={s.quizPill}>
              <Text style={s.quizPillValue}>{bestPct}%</Text>
              <Text style={s.quizPillLabel}>최고</Text>
            </View>
          </View>

          {totalQuizzes === 0 ? (
            <View style={s.quizEmpty}>
              <Ionicons
                name="help-circle-outline"
                size={rs(28)}
                color={colors.border}
              />
              <Text style={s.quizEmptyTitle}>아직 퀴즈 기록이 없어요</Text>
              <Text style={s.quizEmptySub}>
                기록에서 세션을 열어 OX 퀴즈를 풀어보세요
              </Text>
            </View>
          ) : (
            <View style={{ position: "relative" }}>
              {/* Y-axis labels: 100%, 50%, 0% */}
              <Text
                style={[
                  s.quizYLabel,
                  { left: 0, top: 12 - rs(4) },
                ]}
              >
                100%
              </Text>
              <Text
                style={[
                  s.quizYLabel,
                  { left: 0, top: 12 + (quizChartHeight - 12 - 24) / 2 - rs(4) },
                ]}
              >
                50%
              </Text>
              <Text
                style={[
                  s.quizYLabel,
                  { left: 0, top: quizChartHeight - 24 - rs(4) },
                ]}
              >
                0%
              </Text>

              <QuizLineChart
                points={quizSeries}
                width={quizChartWidth}
                height={quizChartHeight}
                colors={colors}
              />

              <Text
                style={{
                  fontSize: rs(10),
                  color: colors.textFaint,
                  textAlign: "center",
                  marginTop: rs(4),
                }}
              >
                지난 {quizRange}일
              </Text>
            </View>
          )}
        </View>

        <View style={s.sectionCard}>
          <View style={[s.sectionHeader, { marginBottom: rs(8) }]}>
            <View>
              <Text style={s.sectionTitle}>공부 캘린더</Text>
              <Text style={s.sectionSub}>진할수록 오래 공부한 날</Text>
            </View>
          </View>

          <View style={s.monthRow}>
            {monthLabels.map((m, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: m.col * (cellSize + heatGap),
                }}
              >
                <Text
                  style={{
                    fontSize: rs(9),
                    color: colors.textFaint,
                    fontWeight: "600",
                  }}
                >
                  {m.label}
                </Text>
              </View>
            ))}
            <View style={{ height: rs(14) }} />
          </View>

          <View style={{ flexDirection: "row", gap: heatGap }}>
            {heatmap.map((week, wi) => (
              <View key={wi} style={{ flexDirection: "column", gap: heatGap }}>
                {week.map((cell, di) => {
                  const isFuture = cell.dateTs > todayTs;
                  return (
                  <View
                    key={di}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: rs(3),
                      backgroundColor: isFuture
                        ? "transparent"
                        : heatColor(cell.ms, colors.heat),
                      opacity: isFuture ? 0 : 1,
                      borderWidth: 1,
                      borderColor: colors.borderSoft,
                    }}
                  />
                  );
                })}
              </View>
            ))}
          </View>

          <View style={s.heatmapLegend}>
            <Text style={s.legendText}>적음</Text>
            {colors.heat.map((c, i) => (
              <View
                key={i}
                style={[
                  s.legendCell,
                  { width: cellSize, height: cellSize, backgroundColor: c },
                ]}
              />
            ))}
            <Text style={s.legendText}>많음</Text>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}