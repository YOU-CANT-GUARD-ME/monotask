// app/study-end.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

type Screen = "end" | "later" | "note";

const MAX_PHOTOS = 6;

function parsePhotoUris(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function formatMs(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "0m";
}

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function StudyEndScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors } = useTheme();

  const params = useLocalSearchParams<{
    durationMs?: string;
    startTime?: string;
    photoUris?: string;
  }>();
  const durationMs = Number(params.durationMs ?? 0);
  const startTime = params.startTime ?? new Date().toISOString();

  const [screen, setScreen] = useState<Screen>("end");
  const [noteText, setNoteText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>(
    parsePhotoUris(params.photoUris)
  );
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  // Detect new sessions vs returning from camera
  const lastSessionKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    const key = `${params.startTime ?? ""}::${params.durationMs ?? ""}`;
    if (lastSessionKey.current !== key) {
      lastSessionKey.current = key;
      setScreen("end");
      setNoteText("");
      setPhotoUris(parsePhotoUris(params.photoUris));
      setPreviewIdx(null);
    }
  }, [params.startTime, params.durationMs]);

  // Returning from camera with new photoUris
  React.useEffect(() => {
    if (params.photoUris !== undefined) {
      const incoming = parsePhotoUris(params.photoUris);
      // Only update if it's actually different to avoid stomping state
      setPhotoUris(incoming);
      if (incoming.length > 0) setScreen("note");
    }
  }, [params.photoUris]);

  function removePhotoAt(index: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  }

  function openCamera() {
    router.push({
      pathname: "/camera",
      params: {
        noteText,
        durationMs: String(durationMs),
        startTime,
        existingPhotoUris: JSON.stringify(photoUris),
      },
    });
  }

  // Grid dimensions: 3 columns
  const gridGap = rs(10);
  const sideMargin = rs(24);
  const tileSize = Math.floor(
    (width - sideMargin * 2 - gridGap * 2) / 3
  );

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    bg: { flex: 1, backgroundColor: colors.bg },
    endScroll: {
      flexGrow: 1,
      paddingHorizontal: rs(24),
      paddingBottom: rs(48),
    },
    topSection: {
      alignItems: "center",
      paddingTop: rs(24),
      paddingBottom: rs(32),
    },
    badgeCircle: {
      width: rs(80),
      height: rs(80),
      borderRadius: rs(40),
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(18),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    endTitle: {
      fontSize: Math.min(rs(28), 34),
      fontWeight: "bold",
      color: colors.text,
      marginBottom: rs(6),
    },
    endSub: {
      fontSize: rs(14),
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: rs(22),
    },
    statsRow: { flexDirection: "row", gap: rs(12), marginBottom: rs(28) },
    statCard: {
      backgroundColor: colors.surface,
      padding: rs(18),
      borderRadius: rs(18),
      flex: 1,
    },
    statLabel: {
      color: colors.textFaint,
      fontSize: rs(11),
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    statValue: {
      fontSize: Math.min(rs(22), 28),
      fontWeight: "bold",
      marginTop: rs(6),
      color: colors.text,
    },
    dividerLabel: {
      fontSize: rs(13),
      color: colors.textFaint,
      textAlign: "center",
      marginBottom: rs(14),
      fontWeight: "500",
    },
    choiceRow: { flexDirection: "row", gap: rs(12), marginBottom: rs(16) },
    choiceBtn: {
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      paddingVertical: rs(22),
      paddingHorizontal: rs(12),
      flex: 1,
      alignItems: "center",
      gap: rs(8),
    },
    choiceBtnPrimary: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    choiceBtnLabel: { fontSize: rs(14), fontWeight: "bold", color: colors.text },
    choiceBtnLabelPrimary: { color: colors.onPrimary },
    choiceBtnDesc: {
      fontSize: rs(11),
      color: colors.textFaint,
      textAlign: "center",
      lineHeight: rs(15),
    },
    choiceBtnDescPrimary: { color: "rgba(244,241,234,0.7)" },
    skipBtn: { alignItems: "center", paddingVertical: rs(14) },
    skipText: { fontSize: rs(13), color: colors.textFaint },
    laterWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: rs(24),
    },
    laterBadge: {
      width: rs(72),
      height: rs(72),
      borderRadius: rs(36),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(18),
    },
    laterTitle: {
      fontSize: Math.min(rs(22), 28),
      fontWeight: "bold",
      color: colors.text,
      marginBottom: rs(8),
      textAlign: "center",
    },
    laterSub: {
      fontSize: rs(14),
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: rs(22),
      marginBottom: rs(28),
    },
    pendingCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: rs(16),
      padding: rs(16),
      flexDirection: "row",
      alignItems: "center",
      gap: rs(12),
      marginBottom: rs(28),
    },
    pendingDot: {
      width: rs(8),
      height: rs(8),
      borderRadius: rs(4),
      backgroundColor: colors.warning,
    },
    pendingText: {
      fontSize: rs(13),
      color: colors.textMuted,
      flex: 1,
      lineHeight: rs(20),
    },
    noteScroll: {
      flexGrow: 1,
      paddingHorizontal: rs(24),
      paddingBottom: rs(48),
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: rs(4),
      marginTop: rs(16),
      marginBottom: rs(24),
    },
    backText: { fontSize: rs(14), fontWeight: "600", color: colors.primary },
    noteHeader: { marginBottom: rs(20) },
    noteScreenTitle: {
      fontSize: Math.min(rs(24), 30),
      fontWeight: "bold",
      color: colors.text,
      marginBottom: rs(4),
    },
    noteDate: { fontSize: rs(13), color: colors.textFaint },
    noteInputWrapper: {
      backgroundColor: colors.surface,
      borderRadius: rs(18),
      padding: rs(16),
      marginBottom: rs(16),
    },
    noteInput: {
      fontSize: rs(15),
      color: colors.text,
      minHeight: rs(200),
      textAlignVertical: "top",
      lineHeight: rs(24),
    },
    charCount: {
      fontSize: rs(11),
      color: colors.textFaint,
      textAlign: "right",
      marginTop: rs(8),
    },

    photosLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: rs(8),
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: gridGap,
      marginBottom: rs(16),
    },
    photoTile: {
      width: tileSize,
      height: tileSize,
      borderRadius: rs(14),
      overflow: "hidden",
      position: "relative",
    },
    photoTileImg: { width: "100%", height: "100%" },
    photoDeleteBtn: {
      position: "absolute",
      top: rs(6),
      right: rs(6),
      width: rs(24),
      height: rs(24),
      borderRadius: rs(12),
      backgroundColor: "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent: "center",
    },
    addPhotoTile: {
      width: tileSize,
      height: tileSize,
      borderRadius: rs(14),
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: rs(4),
    },
    addPhotoText: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "600",
    },

    primaryBtn: {
      backgroundColor: colors.primary,
      padding: rs(18),
      borderRadius: rs(20),
      alignItems: "center",
      width: "100%",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    primaryBtnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
    primaryBtnText: {
      color: colors.onPrimary,
      fontWeight: "bold",
      fontSize: Math.min(rs(16), 20),
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalCloseBtn: {
      position: "absolute",
      top: 54,
      right: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    modalImage: { width: "100%", height: "80%" },
  });

  // ───── Screen: "end" ───────────────────────────────────────────────────
  if (screen === "end") {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView
          style={s.bg}
          contentContainerStyle={s.endScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.topSection}>
            <View style={s.badgeCircle}>
              <Ionicons name="checkmark" size={rs(36)} color={colors.onPrimary} />
            </View>
            <Text style={s.endTitle}>공부 완료!</Text>
            <Text style={s.endSub}>오늘도 수고했어요{"\n"}잘 정리해볼까요?</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>집중 시간</Text>
              <Text style={s.statValue}>{formatMs(durationMs)}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>시작 시각</Text>
              <Text style={s.statValue}>{formatStartTime(startTime)}</Text>
            </View>
          </View>

          <Text style={s.dividerLabel}>지금 바로 정리하시겠어요?</Text>

          <View style={s.choiceRow}>
            <TouchableOpacity
              style={[s.choiceBtn, s.choiceBtnPrimary]}
              onPress={() => setScreen("note")}
              activeOpacity={0.85}
            >
              <Ionicons name="book-outline" size={rs(26)} color={colors.onPrimary} />
              <Text style={[s.choiceBtnLabel, s.choiceBtnLabelPrimary]}>정리하기</Text>
              <Text style={[s.choiceBtnDesc, s.choiceBtnDescPrimary]}>
                복습 노트 & AI 요약
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.choiceBtn}
              onPress={() => setScreen("later")}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={rs(26)} color={colors.textMuted} />
              <Text style={s.choiceBtnLabel}>나중에 하기</Text>
              <Text style={s.choiceBtnDesc}>알림으로 나중에 안내</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.skipBtn} onPress={() => router.replace("/")}>
            <Text style={s.skipText}>그냥 홈으로 가기</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───── Screen: "later" ─────────────────────────────────────────────────
  if (screen === "later") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.bg}>
          <View style={s.laterWrap}>
            <View style={s.laterBadge}>
              <Ionicons name="notifications-outline" size={rs(32)} color={colors.textMuted} />
            </View>
            <Text style={s.laterTitle}>알겠어요, 나중에 할게요</Text>
            <Text style={s.laterSub}>
              {"정리하지 않은 공부가 남아 있어요.\n나중에 알림으로 알려드릴게요."}
            </Text>
            <View style={s.pendingCard}>
              <View style={s.pendingDot} />
              <Text style={s.pendingText}>
                오늘 공부 ({formatMs(durationMs)}) — 복습 노트 미작성
              </Text>
            </View>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => {
                setScreen("end");
                router.replace("/");
              }}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ───── Screen: "note" ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.bg}
        contentContainerStyle={s.noteScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={s.backBtn} onPress={() => setScreen("end")}>
          <Ionicons name="chevron-back" size={rs(16)} color={colors.primary} />
          <Text style={s.backText}>뒤로</Text>
        </TouchableOpacity>

        <View style={s.noteHeader}>
          <Text style={s.noteScreenTitle}>복습 노트 작성</Text>
          <Text style={s.noteDate}>{formatDate(startTime)} · 오늘 공부</Text>
        </View>

        <View style={s.noteInputWrapper}>
          <TextInput
            style={s.noteInput}
            placeholder="오늘 공부한 내용을 자유롭게 입력하세요. AI가 핵심 내용을 요약해드려요."
            placeholderTextColor={colors.textFaint}
            multiline
            value={noteText}
            onChangeText={setNoteText}
          />
          <Text style={s.charCount}>{noteText.length}자</Text>
        </View>

        {/* Photo grid */}
        <Text style={s.photosLabel}>
          사진 ({photoUris.length} / {MAX_PHOTOS})
        </Text>
        <View style={s.photoGrid}>
          {photoUris.map((uri, i) => (
            <View key={`${uri}-${i}`} style={s.photoTile}>
              <TouchableOpacity
                onPress={() => setPreviewIdx(i)}
                activeOpacity={0.9}
                style={{ width: "100%", height: "100%" }}
              >
                <Image source={{ uri }} style={s.photoTileImg} resizeMode="cover" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removePhotoAt(i)}
                style={s.photoDeleteBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={rs(14)} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {photoUris.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={s.addPhotoTile}
              onPress={openCamera}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={rs(28)} color={colors.textFaint} />
              <Text style={s.addPhotoText}>사진 추가</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, !noteText.trim() && s.primaryBtnDisabled, { marginTop: rs(8) }]}
          disabled={!noteText.trim()}
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/summary",
              params: {
                noteText,
                durationMs: String(durationMs),
                startTime,
                photoUris: JSON.stringify(photoUris),
              },
            })
          }
        >
          <Text style={s.primaryBtnText}>AI로 요약하기</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Fullscreen preview */}
      <Modal
        visible={previewIdx !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewIdx(null)}
      >
        <StatusBar hidden />
        <TouchableWithoutFeedback onPress={() => setPreviewIdx(null)}>
          <View style={s.modalBackdrop}>
            <TouchableOpacity
              style={s.modalCloseBtn}
              onPress={() => setPreviewIdx(null)}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableWithoutFeedback>
              {previewIdx !== null && photoUris[previewIdx] ? (
                <Image
                  source={{ uri: photoUris[previewIdx] }}
                  style={s.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View />
              )}
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}