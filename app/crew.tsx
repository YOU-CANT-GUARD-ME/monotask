// app/crew.tsx
// A study crew: invite code, the live group-study room, and members ranked by
// this week's study time.
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { apiErrorMessage, CrewDetail, getCrewDetail, leaveCrew } from "../utils/crews";

function formatHm(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

export default function CrewScreen() {
  const { width } = useWindowDimensions();
  const rs = (n: number) => Math.round(n * (width / 390));
  const router = useRouter();
  const { colors } = useTheme();
  const { crewId } = useLocalSearchParams<{ crewId?: string }>();

  const [detail, setDetail] = useState<CrewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!crewId) return;
    setError(null);
    try {
      setDetail(await getCrewDetail(crewId));
    } catch (e) {
      setError(apiErrorMessage(e, "크루 정보를 불러올 수 없어요."));
    } finally {
      setLoading(false);
    }
  }, [crewId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function shareCode() {
    if (!detail) return;
    const message = `Monotask에서 "${detail.crew.name}" 크루에 참여해요! 초대 코드: ${detail.crew.code}`;
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (Platform.OS === "web" && !nav?.share && nav?.clipboard) {
      await nav.clipboard.writeText(detail.crew.code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    Share.share({ message }).catch(() => {});
  }

  async function handleLeave() {
    if (!crewId || leaving) return;
    setLeaving(true);
    try {
      await leaveCrew(crewId);
      router.replace({ pathname: "/friends", params: { tab: "crews" } });
    } catch (e) {
      setError(apiErrorMessage(e, "크루를 나가지 못했어요."));
      setLeaving(false);
      setConfirmLeave(false);
    }
  }

  const room = detail?.room;
  const roomFull = !!room && room.participants.length >= room.maxSize;
  const iAmInRoom = !!room && room.participants.some((p) => detail?.members.find((m) => m.isMe)?.uid === p.uid);

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: rs(20),
      paddingTop: rs(12),
      paddingBottom: rs(16),
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
    headerTitle: { flex: 1, fontSize: rs(18), fontWeight: "800", color: colors.text },
    content: { paddingHorizontal: rs(20), paddingBottom: rs(48) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: rs(18),
      padding: rs(18),
      marginBottom: rs(14),
    },
    cardLabel: {
      fontSize: rs(11),
      fontWeight: "700",
      color: colors.textFaint,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: rs(8),
    },
    codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    code: { fontSize: rs(26), fontWeight: "800", letterSpacing: 5, color: colors.text },
    smallBtn: {
      backgroundColor: colors.primarySoft,
      borderRadius: rs(12),
      paddingVertical: rs(9),
      paddingHorizontal: rs(14),
    },
    smallBtnText: { color: colors.primary, fontWeight: "800", fontSize: rs(12) },
    roomTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    roomTitle: { fontSize: rs(16), fontWeight: "800", color: colors.text },
    roomCount: { fontSize: rs(13), fontWeight: "800", color: colors.primary },
    roomSub: { fontSize: rs(12), color: colors.textFaint, marginTop: rs(4), lineHeight: rs(18) },
    roomNames: { flexDirection: "row", flexWrap: "wrap", gap: rs(6), marginTop: rs(10) },
    namePill: {
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: rs(10),
      paddingVertical: rs(4),
    },
    namePillText: { fontSize: rs(12), fontWeight: "700", color: colors.text },
    joinBtn: {
      flexDirection: "row",
      gap: rs(8),
      backgroundColor: colors.primary,
      borderRadius: rs(14),
      paddingVertical: rs(14),
      alignItems: "center",
      justifyContent: "center",
      marginTop: rs(14),
    },
    joinBtnText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(14) },
    sectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: rs(10),
      marginTop: rs(6),
    },
    memberRow: {
      backgroundColor: colors.surface,
      borderRadius: rs(16),
      padding: rs(14),
      marginBottom: rs(8),
      flexDirection: "row",
      alignItems: "center",
      gap: rs(12),
    },
    rank: { width: rs(22), fontSize: rs(14), fontWeight: "800", color: colors.textFaint, textAlign: "center" },
    memberInfo: { flex: 1 },
    memberName: { fontSize: rs(14), fontWeight: "700", color: colors.text },
    memberSub: { fontSize: rs(11), color: colors.textFaint, marginTop: rs(2) },
    memberWeek: { alignItems: "flex-end" },
    memberWeekValue: { fontSize: rs(15), fontWeight: "800", color: colors.text },
    memberWeekLabel: { fontSize: rs(10), color: colors.textFaint, marginTop: rs(1) },
    leaveBtn: { alignItems: "center", paddingVertical: rs(16), marginTop: rs(10) },
    leaveText: { color: colors.danger, fontWeight: "700", fontSize: rs(13) },
    confirmRow: { flexDirection: "row", gap: rs(8), marginTop: rs(10) },
    confirmBtn: { flex: 1, borderRadius: rs(14), paddingVertical: rs(13), alignItems: "center" },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: rs(24) },
    errorText: { fontSize: rs(13), color: colors.textFaint, textAlign: "center" },
  });

  return (
    <SafeAreaView style={s.safe} edges={Platform.OS === "web" ? [] : ["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <AppIcon name="chevron-back" size={rs(18)} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {detail?.crew.name ?? "크루"}
        </Text>
      </View>

      {loading && !detail ? (
        <View style={s.centerFill}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !detail ? (
        <View style={s.centerFill}>
          <Text style={s.errorText}>{error ?? "크루 정보를 불러올 수 없어요."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Text style={s.cardLabel}>초대 코드</Text>
            <View style={s.codeRow}>
              <Text style={s.code} selectable>
                {detail.crew.code}
              </Text>
              <TouchableOpacity style={s.smallBtn} onPress={shareCode} activeOpacity={0.8}>
                <Text style={s.smallBtnText}>{copied ? "복사됨" : "공유"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {room && (
            <View style={s.card}>
              <View style={s.roomTitleRow}>
                <Text style={s.roomTitle}>그룹 스터디</Text>
                <Text style={s.roomCount}>
                  {room.participants.length}/{room.maxSize}
                </Text>
              </View>
              <Text style={s.roomSub}>
                카메라를 켜고 함께 공부해요. 소리는 전달되지 않고 화면만 보여요.
              </Text>
              {room.participants.length > 0 && (
                <View style={s.roomNames}>
                  {room.participants.map((p) => (
                    <View key={p.uid} style={s.namePill}>
                      <Text style={s.namePillText}>{p.displayName}</Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={[s.joinBtn, roomFull && !iAmInRoom && { opacity: 0.45 }]}
                disabled={roomFull && !iAmInRoom}
                onPress={() => router.push({ pathname: "/group-study", params: { crewId: detail.crew.id } })}
                activeOpacity={0.85}
              >
                <AppIcon name="camera" size={rs(18)} color={colors.onPrimary} />
                <Text style={s.joinBtnText}>
                  {roomFull && !iAmInRoom ? "자리가 가득 찼어요" : "그룹 스터디 참여"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.sectionLabel}>멤버 {detail.crew.memberCount}명 · 이번 주 순위</Text>
          {detail.members.map((m, i) => (
            <TouchableOpacity
              key={m.uid}
              style={s.memberRow}
              onPress={() => router.push({ pathname: "/friend-profile", params: { uid: m.uid } })}
              activeOpacity={0.75}
            >
              <Text style={s.rank}>{i + 1}</Text>
              <View style={s.memberInfo}>
                <Text style={s.memberName}>
                  {m.displayName}
                  {m.isMe ? " (나)" : ""}
                  {m.isOwner ? " · 리더" : ""}
                </Text>
                <Text style={s.memberSub}>
                  오늘 {formatHm(m.todayMs)} · 총 {formatHm(m.totalMs)} · {m.streak}일 연속
                </Text>
              </View>
              <View style={s.memberWeek}>
                <Text style={s.memberWeekValue}>{formatHm(m.weeklyMs)}</Text>
                <Text style={s.memberWeekLabel}>이번 주</Text>
              </View>
            </TouchableOpacity>
          ))}

          {!!error && <Text style={[s.errorText, { marginTop: rs(10) }]}>{error}</Text>}

          {confirmLeave ? (
            <View style={s.card}>
              <Text style={[s.roomTitle, { fontSize: rs(15) }]}>정말 크루를 나갈까요?</Text>
              <Text style={s.roomSub}>
                {detail.crew.isOwner && detail.crew.memberCount > 1
                  ? "리더 역할은 가장 먼저 참여한 멤버에게 넘어가요."
                  : detail.crew.memberCount <= 1
                    ? "마지막 멤버라서 크루가 삭제돼요."
                    : "초대 코드로 언제든 다시 참여할 수 있어요."}
              </Text>
              <View style={s.confirmRow}>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: colors.bg }]}
                  onPress={() => setConfirmLeave(false)}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: colors.danger }]}
                  onPress={handleLeave}
                  disabled={leaving}
                >
                  {leaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>나가기</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.leaveBtn} onPress={() => setConfirmLeave(true)}>
              <Text style={s.leaveText}>크루 나가기</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
