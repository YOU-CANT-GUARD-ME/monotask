// app/friend-profile.tsx
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemePalette } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../firebase";

// ─── Types ────────────────────────────────────────────────────────────────

type FriendProfile = {
  displayName: string;
  email: string;
  avatarInitials: string;
};

type FriendSession = {
  id: string;
  startTime: number;
  durationMs: number;
  subject?: string;
  noteText?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Stat Pill (mirrors profile.tsx) ───────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  green,
  rs,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  green?: boolean;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: green ? colors.primary : colors.surface,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
        gap: 4,
      }}
    >
      <AppIcon
        name={icon as any}
        size={rs(14)}
        color={green ? "rgba(244,241,234,0.85)" : colors.primary}
      />
      <Text
        style={{
          fontSize: rs(17),
          fontWeight: "800",
          color: green ? colors.onPrimary : colors.text,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: rs(10),
          color: green ? "rgba(244,241,234,0.7)" : colors.textFaint,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FriendProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [sessions, setSessions] = useState<FriendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const profileSnap = await getDoc(doc(db, "users", uid));
      const data = profileSnap.data();
      const displayName = data?.displayName ?? "User";
      const email = data?.email ?? "";
      setProfile({
        displayName,
        email,
        avatarInitials: initialsOf(displayName),
      });

      const sessionsSnap = await getDocs(collection(db, "users", uid, "sessions"));
      const list: FriendSession[] = sessionsSnap.docs.map((d) => {
        const s = d.data();
        return {
          id: d.id,
          startTime: s.startTime,
          durationMs: s.durationMs ?? 0,
          subject: s.subject,
          noteText: s.noteText,
        };
      });
      list.sort((a, b) => b.startTime - a.startTime);
      setSessions(list);
    } catch (e) {
      console.warn("failed to load friend profile:", e);
      setError("친구 정보를 불러올 수 없습니다.");
      setProfile(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stats = useMemo(() => {
    const todayTs = startOfDay(Date.now());
    const dailyMap = new Map<number, number>();
    let totalMs = 0;
    for (const s of sessions) {
      const key = startOfDay(s.startTime);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.durationMs);
      totalMs += s.durationMs;
    }
    let streak = 0;
    let check = todayTs;
    while (dailyMap.has(check)) {
      streak++;
      check -= 86400000;
    }
    const todayMs = dailyMap.get(todayTs) ?? 0;
    return { totalMs, streak, todayMs, totalDays: dailyMap.size };
  }, [sessions]);

  const notes = useMemo(
    () => sessions.filter((s) => s.noteText?.trim()),
    [sessions]
  );

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: rs(24),
      paddingTop: rs(20),
      paddingBottom: rs(16),
      flexDirection: "row",
      alignItems: "center",
      gap: rs(12),
    },
    backBtn: {
      width: rs(34),
      height: rs(34),
      borderRadius: rs(10),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: rs(18),
      fontWeight: "800",
      color: colors.text,
    },
    scrollContent: { paddingBottom: rs(48) },
    avatarSection: {
      alignItems: "center",
      paddingTop: rs(8),
      paddingBottom: rs(28),
    },
    avatarCircle: {
      width: rs(88),
      height: rs(88),
      borderRadius: rs(44),
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(14),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    avatarText: { fontSize: rs(30), fontWeight: "800", color: colors.onPrimary },
    userName: {
      fontSize: rs(20),
      fontWeight: "800",
      color: colors.text,
      marginBottom: rs(4),
    },
    userEmail: { fontSize: rs(13), color: colors.textFaint },
    statsRow: {
      flexDirection: "row",
      gap: rs(10),
      paddingHorizontal: rs(24),
      marginBottom: rs(16),
    },
    sectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginHorizontal: rs(24),
      marginBottom: rs(10),
      marginTop: rs(8),
    },
    noteCard: {
      backgroundColor: colors.surface,
      borderRadius: rs(16),
      padding: rs(14),
      marginHorizontal: rs(24),
      marginBottom: rs(10),
      gap: rs(6),
    },
    noteTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    noteSubject: { fontSize: rs(13), fontWeight: "700", color: colors.text },
    noteDate: { fontSize: rs(11), color: colors.textFaint },
    noteText: { fontSize: rs(13), color: colors.textMuted, lineHeight: rs(20) },
    emptyText: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      paddingVertical: rs(24),
    },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  });

  return (
    <SafeAreaView style={s.safe} edges={Platform.OS === "web" ? [] : ["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <AppIcon name="chevron-back" size={rs(18)} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>친구 프로필</Text>
      </View>

      {loading ? (
        <View style={s.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !profile ? (
        <View style={s.centerFill}>
          <Text style={s.emptyText}>{error ?? "친구 정보를 불러올 수 없습니다."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={s.avatarSection}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{profile.avatarInitials}</Text>
            </View>
            <Text style={s.userName}>{profile.displayName}</Text>
            <Text style={s.userEmail}>{profile.email}</Text>
          </View>

          <View style={s.statsRow}>
            <StatPill
              icon="fire"
              label="연속"
              value={`${stats.streak}일`}
              green
              rs={rs}
              colors={colors}
            />
            <StatPill
              icon="clock-o"
              label="오늘"
              value={formatHm(stats.todayMs)}
              rs={rs}
              colors={colors}
            />
          </View>
          <View style={s.statsRow}>
            <StatPill
              icon="calendar-check-o"
              label="공부한 날"
              value={`${stats.totalDays}일`}
              rs={rs}
              colors={colors}
            />
            <StatPill
              icon="book"
              label="누적 시간"
              value={formatHm(stats.totalMs)}
              rs={rs}
              colors={colors}
            />
          </View>

          <Text style={s.sectionLabel}>노트 ({notes.length})</Text>
          {notes.length === 0 ? (
            <Text style={s.emptyText}>작성된 노트가 없어요</Text>
          ) : (
            notes.map((n) => (
              <View key={n.id} style={s.noteCard}>
                <View style={s.noteTopRow}>
                  <Text style={s.noteSubject}>{n.subject || "공부 세션"}</Text>
                  <Text style={s.noteDate}>{formatDate(n.startTime)}</Text>
                </View>
                <Text style={s.noteText} numberOfLines={4}>
                  {n.noteText}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}