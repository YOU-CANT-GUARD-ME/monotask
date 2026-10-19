// components/CrewsPanel.tsx
// The 크루 tab on the community screen: your crews, plus creating a crew or
// joining one with an invite code.
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { ThemePalette } from "../constants/themes";
import { apiErrorMessage, createCrew, CrewSummary, getMyCrews, joinCrew } from "../utils/crews";
import AppIcon from "./AppIcon";

type Sheet = "create" | "join" | null;

export default function CrewsPanel({
  rs,
  colors,
}: {
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const router = useRouter();
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCrews(await getMyCrews());
    } catch (e) {
      console.warn("load crews failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openSheet(next: Sheet) {
    setInput("");
    setSheetError(null);
    setSheet(next);
  }

  async function submit() {
    const value = input.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setSheetError(null);
    try {
      const crew = sheet === "create" ? await createCrew(value) : await joinCrew(value);
      setSheet(null);
      await load();
      router.push({ pathname: "/crew", params: { crewId: crew.id } });
    } catch (e) {
      setSheetError(
        apiErrorMessage(e, sheet === "create" ? "크루를 만들지 못했어요." : "크루에 참여하지 못했어요.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const s = StyleSheet.create({
    actions: { flexDirection: "row", gap: rs(8), marginBottom: rs(16) },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: rs(6),
      borderRadius: rs(14),
      paddingVertical: rs(13),
    },
    primaryBtn: { backgroundColor: colors.primary },
    secondaryBtn: { backgroundColor: colors.surface },
    actionText: { fontWeight: "700", fontSize: rs(13) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: rs(16),
      padding: rs(16),
      marginBottom: rs(10),
      flexDirection: "row",
      alignItems: "center",
      gap: rs(12),
    },
    crewIcon: {
      width: rs(40),
      height: rs(40),
      borderRadius: rs(12),
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    name: { fontSize: rs(14), fontWeight: "800", color: colors.text },
    sub: { fontSize: rs(12), color: colors.textFaint, marginTop: rs(2) },
    livePill: {
      backgroundColor: "rgba(217,83,79,0.14)",
      borderRadius: 999,
      paddingHorizontal: rs(8),
      paddingVertical: rs(3),
    },
    liveText: { fontSize: rs(11), fontWeight: "800", color: "#D9534F" },
    emptyText: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      paddingVertical: rs(20),
      lineHeight: rs(20),
    },
    backdrop: { flex: 1, backgroundColor: `${colors.surfaceDark}66`, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: rs(28),
      borderTopRightRadius: rs(28),
      paddingHorizontal: rs(24),
      paddingTop: rs(24),
      paddingBottom: rs(40),
    },
    sheetTitle: { fontSize: rs(20), fontWeight: "800", color: colors.text, marginBottom: rs(4) },
    sheetSub: { fontSize: rs(13), color: colors.textFaint, marginBottom: rs(16) },
    input: {
      backgroundColor: colors.surface,
      borderRadius: rs(14),
      paddingHorizontal: rs(16),
      paddingVertical: rs(14),
      fontSize: rs(15),
      color: colors.text,
    },
    codeInput: { letterSpacing: 4, fontWeight: "800", textAlign: "center", fontSize: rs(20) },
    sheetError: { fontSize: rs(12), color: colors.danger, marginTop: rs(8) },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: rs(16),
      paddingVertical: rs(15),
      alignItems: "center",
      marginTop: rs(16),
    },
    submitText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) },
  });

  return (
    <>
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.actionBtn, s.primaryBtn]}
          onPress={() => openSheet("create")}
          activeOpacity={0.85}
        >
          <AppIcon name="add" size={rs(16)} color={colors.onPrimary} />
          <Text style={[s.actionText, { color: colors.onPrimary }]}>크루 만들기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.secondaryBtn]}
          onPress={() => openSheet("join")}
          activeOpacity={0.85}
        >
          <Text style={[s.actionText, { color: colors.text }]}>코드로 참여</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: rs(20) }} />
      ) : crews.length === 0 ? (
        <Text style={s.emptyText}>
          아직 참여한 크루가 없어요.{"\n"}크루를 만들거나 초대 코드로 참여해보세요.
        </Text>
      ) : (
        crews.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.card}
            onPress={() => router.push({ pathname: "/crew", params: { crewId: c.id } })}
            activeOpacity={0.75}
          >
            <View style={s.crewIcon}>
              <AppIcon name="people" size={rs(20)} color={colors.primary} />
            </View>
            <View style={s.info}>
              <Text style={s.name}>{c.name}</Text>
              <Text style={s.sub}>
                멤버 {c.memberCount}명{c.isOwner ? " · 내가 만든 크루" : ""}
              </Text>
            </View>
            {c.liveCount > 0 && (
              <View style={s.livePill}>
                <Text style={s.liveText}>{c.liveCount}명 공부 중</Text>
              </View>
            )}
            <AppIcon name="chevron-forward" size={rs(14)} color={colors.border} />
          </TouchableOpacity>
        ))
      )}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => setSheet(null)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>{sheet === "create" ? "크루 만들기" : "코드로 참여"}</Text>
              <Text style={s.sheetSub}>
                {sheet === "create"
                  ? "만든 뒤 초대 코드를 친구에게 공유하세요"
                  : "친구에게 받은 6자리 초대 코드를 입력하세요"}
              </Text>
              <TextInput
                style={[s.input, sheet === "join" && s.codeInput]}
                placeholder={sheet === "create" ? "크루 이름" : "K7Q2XM"}
                placeholderTextColor={colors.textFaint}
                value={input}
                onChangeText={(t) => setInput(sheet === "join" ? t.toUpperCase().slice(0, 6) : t.slice(0, 30))}
                autoCapitalize={sheet === "join" ? "characters" : "sentences"}
                autoCorrect={false}
                autoFocus
                onSubmitEditing={submit}
              />
              {!!sheetError && <Text style={s.sheetError}>{sheetError}</Text>}
              <TouchableOpacity
                style={[s.submitBtn, (!input.trim() || submitting) && { opacity: 0.5 }]}
                onPress={submit}
                disabled={!input.trim() || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={s.submitText}>{sheet === "create" ? "만들기" : "참여하기"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
