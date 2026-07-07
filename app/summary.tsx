// app/summary.tsx
import AppIcon from "../components/AppIcon";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemePalette } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { uploadPhotos } from "../utils/photo";
import { deleteSession, getSessions, saveSession } from "../utils/storage";

export type StudySession = {
  id: string;
  startTime: string;
  durationMs: number;
  noteText?: string;
  aiSummary?: string;
  subject?: string;
  photoUri?: string;       // legacy single photo
  photoUris?: string[];    // new multi-photo
};

export async function loadSessions(): Promise<StudySession[]> {
  const sessions = await getSessions();
  return sessions.map((s) => ({
    ...s,
    startTime:
      typeof s.startTime === "number"
        ? new Date(s.startTime).toISOString()
        : s.startTime,
  })) as StudySession[];
}

export { deleteSession };

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── AI Summary with multiple photos ─────────────────────────────────────────

async function imageContentFor(photoUri: string): Promise<any | null> {
  if (!photoUri) return null;
  try {
    if (photoUri.startsWith("http://") || photoUri.startsWith("https://")) {
      return {
        type: "image_url",
        image_url: { url: photoUri, detail: "high" },
      };
    }

    // Normalize any local image (HEIC, JPG, PNG, no extension, etc.) to JPEG.
    // This guarantees OpenAI accepts the format and also shrinks large photos.
    const manipulated = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 1280 } }], // cap width so we don't blow up payload
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      console.error("⚠️ ImageManipulator returned no base64");
      return null;
    }

    return {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${manipulated.base64}`,
        detail: "high",
      },
    };
  } catch (e) {
    console.error("⚠️ IMAGE PROCESSING FAILED:", e, "uri:", photoUri);
    return null;
  }
}

async function fetchAiSummary(
  noteText: string,
  photoUris: string[]
): Promise<string> {
  const OPENAI_API_KEY =
    "REMOVED_OPENAI_KEY";

  const hasPhotos = photoUris.length > 0;

  if (!noteText.trim() && !hasPhotos) {
    return "노트나 사진이 없어 AI 요약을 만들지 않았어요. 다음 공부 때 짧은 메모나 사진을 남기면 더 좋은 요약을 받을 수 있어요.";
  }

  // Build image content blocks (parallel)
  const imageBlocks: any[] = [];
  if (hasPhotos) {
    const results = await Promise.all(photoUris.map((u) => imageContentFor(u)));
    for (const r of results) if (r) imageBlocks.push(r);
  }

  console.log("📸 photos sent to AI:", imageBlocks.length, "/", photoUris.length);

  const prompt = hasPhotos
    ? `당신은 학습 도우미입니다. 학생이 공부 세션을 마쳤고, ${imageBlocks.length}장의 사진과 노트를 첨부했습니다.

먼저 모든 사진을 순서대로 자세히 보고 거기에 적힌 글씨, 다이어그램, 표, 공식 등 모든 내용을 읽어내세요. 손글씨여도 최선을 다해 읽으세요. 여러 사진이 있다면 사진들이 연관된 내용일 수도 있다는 점을 고려하세요.

${noteText.trim() ? `학생이 추가로 작성한 노트:\n"${noteText}"` : "학생이 작성한 노트는 없습니다."}

사진에서 읽어낸 모든 내용과 노트를 종합해서 학습 요약을 한국어로 작성해주세요. 사진의 내용이 중심이 되어야 합니다.

형식:

📚 주요 주제
- 사진과 노트에서 다룬 핵심 주제 2~3개

💡 핵심 개념 / 내용
- 사진에 적힌 중요한 개념, 정의, 공식, 예시를 구체적으로 정리 (3~6개)

❓ 복습 질문
1. 사진의 내용을 활용한 자기 테스트 질문 2~3개

만약 일부 사진을 읽을 수 없거나 글씨를 알아볼 수 없다면, 솔직하게 그렇게 말해주세요.`
    : noteText.trim().length > 0
    ? `당신은 학습 도우미입니다.

학생 노트:

"${noteText}"

이 노트를 바탕으로 간결하고 구조화된 학습 요약을 한국어로 작성해주세요.

형식:

📚 주요 주제
- 핵심 주제 2~3개

💡 핵심 개념
- 중요한 개념 / 정의 / 공식 2~3개

❓ 복습 질문
1. 자기 테스트 질문 2개`
    : `학생이 공부 세션을 완료했지만 노트나 사진이 없습니다.

다음 공부 때 노트나 사진을 남기면 더 좋은 요약을 받을 수 있다고 짧게 격려해주세요.`;

  const messagesContent: any[] = [{ type: "text", text: prompt }, ...imageBlocks];

  const controller = new AbortController();
  // Give more time for multiple images
  const timeoutMs = hasPhotos ? 60000 : 45000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: hasPhotos ? "gpt-4o" : "gpt-4o-mini",
        messages: [{ role: "user", content: messagesContent }],
        max_tokens: 1000,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return (
      data?.choices?.[0]?.message?.content?.trim() ||
      "요약을 생성할 수 없습니다."
    );
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error(
        "AI 요약 시간이 너무 오래 걸려 중단했어요. 다시 시도해주세요."
      );
    }
    throw error;
  }
}

// ─── Save toast ─────────────────────────────────────────────────────────────

function SaveToast({
  visible,
  onDiscard,
  onHide,
  rs,
  colors,
}: {
  visible: boolean;
  onDiscard: () => void;
  onHide: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (visible) timer = setTimeout(() => onHide(), 6000);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 10,
          left: 0,
          right: 0,
          backgroundColor: "#2e2a22",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
          gap: 10,
          zIndex: 999,
          transform: [{ translateY }],
          opacity,
          paddingVertical: rs(14),
          paddingHorizontal: rs(18),
          borderRadius: rs(20),
          marginHorizontal: rs(16),
          marginTop: rs(55),
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: rs(10),
            padding: rs(7),
          }}
        >
          <AppIcon name="checkmark" size={rs(14)} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(13) }}>
            기록에 저장됐어요
          </Text>
          <Text style={{ color: "#aaa", marginTop: 1, fontSize: rs(11) }}>
            저장하지 않으려면 삭제하세요
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onDiscard}
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: rs(10),
          paddingVertical: rs(7),
          paddingHorizontal: rs(12),
        }}
        activeOpacity={0.75}
      >
        <Text style={{ color: colors.danger, fontWeight: "700", fontSize: rs(12) }}>
          삭제
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);

  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const sessionId = useRef(Date.now().toString()).current;

  const params = useLocalSearchParams<{
    noteText?: string;
    durationMs?: string;
    startTime?: string;
    photoUris?: string;
    subject?: string;
  }>();

  const noteText = params.noteText || "";
  const durationMs = Number(params.durationMs ?? 0);
  const startTime = params.startTime ?? new Date().toISOString();
  const photoUris = parsePhotoUris(params.photoUris);
  const subject = params.subject || "기타";

  const runFetch = (cancelled: { value: boolean }) => {
    setAiLoading(true);
    setAiError(null);

    fetchAiSummary(noteText, photoUris)
      .then(async (summary) => {
        // If the screen was cancelled *before* the AI response came back, stop.
        if (cancelled.value) return;
        
        setAiSummary(summary);
        setAiLoading(false);

        // Upload all photos in parallel
        let uploadedUrls: string[] = [];
        if (photoUris.length > 0) {
          uploadedUrls = await uploadPhotos(photoUris, sessionId);
        }

        // Fix: Removed the secondary 'if (cancelled.value) return;' check.
        // We always execute the save routine below so the PWA background 
        // operation completes properly even if UI states switch.
        return saveSession({
          id: sessionId,
          startTime: new Date(startTime).getTime(),
          durationMs,
          noteText: noteText || "",
          aiSummary: summary || "",
          subject: subject || "기타",
          photoUris: uploadedUrls,
        });
      })
      .then(() => {
        // Only update UI elements if the screen context is still alive
        if (!cancelled.value) {
          setToastVisible(true);
        }
      })
      .catch((err) => {
        if (!cancelled.value) {
          setAiError(err?.message ?? "Unknown error");
          setAiLoading(false);
        }
      });
  };

  useEffect(() => {
    setAiSummary("");
    setAiError(null);
    setToastVisible(false);
    setPreviewIdx(null);

    const cancelled = { value: false };
    runFetch(cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [noteText, params.photoUris, startTime, durationMs]);

  const handleRetry = () => {
    const cancelled = { value: false };
    runFetch(cancelled);
  };

  const handleDiscard = async () => {
    setToastVisible(false);
    await deleteSession(sessionId);
    router.replace("/");
  };

  // Photo grid dimensions
  const gridGap = rs(10);
  const sideMargin = rs(24);
  const tileSize = Math.floor(
    (width - sideMargin * 2 - gridGap * 2) / 3
  );

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    bg: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: rs(24),
      paddingBottom: rs(120),
    },
    topSection: {
      alignItems: "center",
      paddingTop: rs(24),
      paddingBottom: rs(28),
    },
    badgeCircle: {
      width: rs(80),
      height: rs(80),
      borderRadius: rs(40),
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(18),
    },
    title: {
      fontSize: Math.min(rs(26), 32),
      fontWeight: "bold",
      color: colors.text,
      marginBottom: rs(6),
    },
    sub: {
      fontSize: rs(14),
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: rs(22),
    },
    statsRow: { flexDirection: "row", gap: rs(12), marginBottom: rs(24) },
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
      textTransform: "uppercase",
    },
    statValue: {
      fontSize: Math.min(rs(20), 26),
      fontWeight: "bold",
      marginTop: rs(6),
      color: colors.text,
    },
    sectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "600",
      textTransform: "uppercase",
      marginBottom: rs(8),
    },
    noteCard: {
      backgroundColor: colors.surface,
      padding: rs(16),
      borderRadius: rs(18),
      marginBottom: rs(20),
    },
    noteText: { fontSize: rs(14), color: colors.text, lineHeight: rs(22) },

    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: gridGap,
      marginBottom: rs(20),
    },
    photoTile: {
      width: tileSize,
      height: tileSize,
      borderRadius: rs(14),
      overflow: "hidden",
    },
    photoTileImg: { width: "100%", height: "100%" },

    aiCard: {
      backgroundColor: colors.surfaceAlt,
      padding: rs(16),
      borderRadius: rs(18),
      marginBottom: rs(28),
    },
    aiHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: rs(6),
      marginBottom: rs(10),
    },
    aiTitle: { fontSize: rs(12), color: colors.primary, fontWeight: "bold" },
    aiText: { fontSize: rs(13), color: colors.textMuted, lineHeight: rs(22) },
    aiLoadingContainer: {
      alignItems: "center",
      paddingVertical: rs(20),
      gap: rs(10),
    },
    aiLoadingText: { fontSize: rs(13), color: colors.textFaint },
    aiErrorText: { fontSize: rs(13), color: colors.danger },
    retryBtn: {
      marginTop: rs(10),
      flexDirection: "row",
      alignItems: "center",
      gap: rs(4),
    },
    retryBtnText: {
      fontSize: rs(12),
      color: colors.primary,
      fontWeight: "600",
    },
    btnRow: { flexDirection: "row", gap: rs(10), marginBottom: rs(8) },
    homeBtn: {
      backgroundColor: colors.surface,
      padding: rs(18),
      borderRadius: rs(20),
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: rs(8),
      flex: 1,
    },
    homeBtnText: { color: colors.text, fontWeight: "700", fontSize: rs(14) },
    historyBtn: {
      backgroundColor: colors.primary,
      padding: rs(18),
      borderRadius: rs(20),
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: rs(8),
      flex: 1,
    },
    historyBtnText: {
      color: colors.onPrimary,
      fontWeight: "700",
      fontSize: rs(14),
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

  return (
    <SafeAreaView style={s.safe}
      edges={Platform.OS === "web" ? [] : ["top", "right", "bottom", "left"]}
    >
      <ScrollView
        style={s.bg}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topSection}>
          <View style={s.badgeCircle}>
            <AppIcon name="sparkles" size={rs(32)} color={colors.onPrimary} />
          </View>
          <Text style={s.title}>정리 완료!</Text>
          <Text style={s.sub}>오늘의 학습을 깔끔하게 정리했어요</Text>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>집중 시간</Text>
            <Text style={s.statValue}>{formatMs(durationMs)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>날짜</Text>
            <Text style={s.statValue}>{formatDate(startTime)}</Text>
          </View>
        </View>

        {photoUris.length > 0 && (
          <>
            <Text style={s.sectionLabel}>
              첨부 사진 ({photoUris.length})
            </Text>
            <View style={s.photoGrid}>
              {photoUris.map((uri, i) => (
                <TouchableOpacity
                  key={`${uri}-${i}`}
                  style={s.photoTile}
                  onPress={() => setPreviewIdx(i)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri }} style={s.photoTileImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={s.sectionLabel}>작성한 노트</Text>
        <View style={s.noteCard}>
          <Text style={s.noteText}>{noteText || "작성된 노트가 없습니다."}</Text>
        </View>

        <Text style={s.sectionLabel}>AI 요약</Text>
        <View style={s.aiCard}>
          <View style={s.aiHeader}>
            <AppIcon name="sparkles" size={rs(13)} color={colors.primary} />
            <Text style={s.aiTitle}>Study Summary</Text>
          </View>

          {aiLoading ? (
            <View style={s.aiLoadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.aiLoadingText}>
                {photoUris.length > 0
                  ? `사진 ${photoUris.length}장과 노트를 분석하는 중...`
                  : "노트를 분석하는 중..."}
              </Text>
            </View>
          ) : aiError ? (
            <>
              <Text style={s.aiErrorText}>요약 생성 실패:</Text>
              <Text style={s.aiErrorText}>{aiError}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handleRetry}>
                <AppIcon name="refresh-outline" size={rs(14)} color={colors.primary} />
                <Text style={s.retryBtnText}>다시 시도</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={s.aiText}>{aiSummary}</Text>
          )}
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={s.homeBtn}
            onPress={() => {
              setAiSummary("");
              setAiError(null);
              setToastVisible(false);
              router.replace("/");
            }}
            activeOpacity={0.85}
          >
            <AppIcon name="home-outline" size={rs(16)} color={colors.text} />
            <Text style={s.homeBtnText}>홈</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.historyBtn}
            onPress={() => {
              setAiSummary("");
              setAiError(null);
              setToastVisible(false);
              router.replace("/history");
            }}
            activeOpacity={0.85}
          >
            <AppIcon name="time-outline" size={rs(16)} color={colors.onPrimary} />
            <Text style={s.historyBtnText}>학습 기록 보기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SaveToast
        visible={toastVisible}
        onDiscard={handleDiscard}
        onHide={() => setToastVisible(false)}
        rs={rs}
        colors={colors}
      />

      {/* Fullscreen photo preview */}
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
              <AppIcon name="close" size={22} color="#fff" />
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