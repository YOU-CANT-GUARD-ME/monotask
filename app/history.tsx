// app/history.tsx
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemePalette } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { getQuizAttempts, QuizAttempt } from "../utils/storage";
import { deleteSession, loadSessions, StudySession } from "./summary";

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function groupSessions(sessions: StudySession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  const map = new Map<string, StudySession[]>();

  for (const s of sessions) {
    const d = new Date(s.startTime);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let label: string;
    if (dayStart === today) label = "오늘";
    else if (dayStart === yesterday) label = "어제";
    else label = formatDate(s.startTime);

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }

  const groups: { label: string; sessions: StudySession[] }[] = [];
  map.forEach((sess, label) => {
    groups.push({ label, sessions: sess });
  });
  return groups;
}

function DetailModal({
  session,
  onClose,
  onDelete,
  rs,
  colors,
}: {
  session: StudySession | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [reviewAttempt, setReviewAttempt] = useState<QuizAttempt | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  React.useEffect(() => {
    if (!session) {
      setAttempts([]);
      return;
    }
    getQuizAttempts().then((all) => {
      const mine = all.filter((a) => a.sessionId === session.id);
      setAttempts(mine);
    });
  }, [session?.id]);

  React.useEffect(() => {
    if (session) {
      console.log("photoUris:", session.photoUris);
      console.log("photoUri:", session.photoUri);
    }
  }, [session?.id]);

  if (!session) return null;

  const handleStartQuiz = () => {
    if (!session.noteText?.trim() && !session.aiSummary?.trim()) {
      Alert.alert(
        "퀴즈를 만들 수 없어요",
        "노트나 AI 요약이 있어야 퀴즈를 만들 수 있습니다."
      );
      return;
    }

    onClose();
    setTimeout(() => {
      router.push({
        pathname: "/quiz",
        params: {
          noteText: session.noteText ?? "",
          aiSummary: session.aiSummary ?? "",
          subject: session.subject ?? "기타",
          sessionId: session.id,
        },
      });
    }, 250);
  };

  const handleAddNote = () => {
    onClose();
    setTimeout(() => {
      router.push({
        pathname: "/study-end",
        params: {
          sessionId: session.id,
          mode: "addNote",
          startTime: session.startTime,
          durationMs: String(session.durationMs),
          photoUris: JSON.stringify(
            session.photoUris && session.photoUris.length > 0
              ? session.photoUris
              : session.photoUri
                ? [session.photoUri]
                : []
          ),
        },
      });
    }, 250);
  };

  const modal = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 22,
      paddingTop: 14,
      maxHeight: "82%",
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 18,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerTitle: { fontWeight: "800", color: colors.text, marginBottom: 3 },
    headerSub: { color: colors.textFaint },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    infoRow: { flexDirection: "row" },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      flex: 1,
      gap: 5,
    },
    infoLabel: {
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    infoValue: { color: colors.text, fontWeight: "800" },
    sectionLabel: {
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      marginBottom: 8,
    },
    contentCard: { backgroundColor: colors.surfaceAlt },
    contentText: { color: colors.text },
    photoThumb: {
      width: "100%",
      height: rs(180),
      borderRadius: rs(18),
      marginBottom: rs(18),
      overflow: "hidden",
    },
    photoThumbImg: { width: "100%", height: "100%" },
    photoExpandBadge: {
      position: "absolute",
      bottom: rs(10),
      right: rs(10),
      backgroundColor: "rgba(0,0,0,0.35)",
      borderRadius: rs(20),
      padding: rs(6),
    },
    deleteBtn: {
      backgroundColor: "rgba(255,107,107,0.08)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    deleteBtnText: { color: colors.danger, fontWeight: "700" },
    fsBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    fsCloseBtn: {
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
    fsImage: { width: "100%", height: "80%" },

    // Custom Popups Style Sheet Tokens
    popBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    popCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      maxWidth: 320,
      alignItems: "center",
    },
    popIconWrapper: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255, 107, 107, 0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    popTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    popDesc: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    popActionGrid: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    popCancelBtn: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    popCancelLabel: {
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 14,
    },
    popConfirmBtn: {
      flex: 1,
      backgroundColor: colors.danger,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    popConfirmLabel: {
      color: "#ffffff",
      fontWeight: "600",
      fontSize: 14,
    },
  });

  return (
    <>
      <Modal
        visible={!!session}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <StatusBar hidden={false} />

        <TouchableWithoutFeedback onPress={onClose}>
          <View style={modal.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[modal.sheet, { paddingBottom: rs(36) }]}>
          <View style={modal.handle} />

          <View style={[modal.header, { marginBottom: rs(18) }]}>
            <View style={{ flex: 1 }}>
              <Text style={[modal.headerTitle, { fontSize: rs(18) }]}>
                {session.subject || "공부 세션"}
              </Text>
              <Text style={[modal.headerSub, { fontSize: rs(12) }]}>
                {formatDate(session.startTime)} · {formatTime(session.startTime)}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
              <AppIcon name="close" size={rs(18)} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[modal.infoRow, { marginBottom: rs(20) }]}>
            <View style={[modal.infoCard, { padding: rs(14) }]}>
              <AppIcon name="time-outline" size={rs(18)} color={colors.primary} />
              <Text style={[modal.infoLabel, { fontSize: rs(11) }]}>집중 시간</Text>
              <Text style={[modal.infoValue, { fontSize: rs(18) }]}>
                {formatMs(session.durationMs)}
              </Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: rs(20) }}
          >
            {/* Photo Block with updated fallback layout */}
            {((session.photoUris && session.photoUris.length > 0) || session.photoUri) ? (
              <>
                <Text style={[modal.sectionLabel, { fontSize: rs(11) }]}>
                  첨부 사진 ({(session.photoUris?.length ?? 0) || 1})
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: rs(8),
                    marginBottom: rs(18),
                  }}
                >
                  {(session.photoUris && session.photoUris.length > 0
                    ? session.photoUris
                    : session.photoUri
                      ? [session.photoUri]
                      : []
                  ).map((uri, i) => (
                    <TouchableOpacity
                      key={`${uri}-${i}`}
                      onPress={() => setPhotoFullscreen(true)}
                      activeOpacity={0.9}
                      style={{
                        width: Math.floor((width - 22 * 2 - rs(8) * 2) / 3) - 1,
                        height: Math.floor((width - 22 * 2 - rs(8) * 2) / 3) - 1,
                        borderRadius: rs(12),
                        overflow: "hidden",
                        backgroundColor: colors.surfaceAlt,
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[modal.sectionLabel, { fontSize: rs(11) }]}>작성한 노트</Text>
            <View
              style={[
                modal.contentCard,
                { borderRadius: rs(18), padding: rs(16), marginBottom: rs(18) },
              ]}
            >
              <Text style={[modal.contentText, { fontSize: rs(14), lineHeight: rs(24) }]}>
                {session.noteText?.trim() ? session.noteText : "작성된 노트가 없습니다."}
              </Text>
            </View>

            <Text style={[modal.sectionLabel, { fontSize: rs(11) }]}>AI 요약</Text>
            <View
              style={[modal.contentCard, { borderRadius: rs(18), padding: rs(16) }]}
            >
              <Text style={[modal.contentText, { fontSize: rs(14), lineHeight: rs(24) }]}>
                {session.aiSummary?.trim() ? session.aiSummary : "AI 요약이 없습니다."}
              </Text>
            </View>

            {attempts.length > 0 && (
              <>
                <Text
                  style={[
                    modal.sectionLabel,
                    { fontSize: rs(11), marginTop: rs(18) },
                  ]}
                >
                  퀴즈 기록 ({attempts.length}회)
                </Text>
                {attempts.map((a) => {
                  const date = new Date(a.takenAt);
                  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date
                    .getHours()
                    .toString()
                    .padStart(2, "0")}:${date
                      .getMinutes()
                      .toString()
                      .padStart(2, "0")}`;
                  const isBest =
                    a.percentage ===
                    Math.max(...attempts.map((x) => x.percentage));
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setReviewAttempt(a)}
                      activeOpacity={0.75}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: rs(14),
                        paddingVertical: rs(12),
                        paddingHorizontal: rs(14),
                        marginBottom: rs(8),
                        flexDirection: "row",
                        alignItems: "center",
                        gap: rs(12),
                      }}
                    >
                      <View
                        style={{
                          width: rs(40),
                          height: rs(40),
                          borderRadius: rs(20),
                          backgroundColor:
                            a.percentage >= 80
                              ? colors.primary
                              : a.percentage >= 50
                                ? colors.primarySoft
                                : colors.surfaceAlt,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: rs(13),
                            fontWeight: "800",
                            color:
                              a.percentage >= 80
                                ? colors.onPrimary
                                : colors.primary,
                          }}
                        >
                          {a.percentage}%
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: rs(6),
                          }}
                        >
                          <Text
                            style={{
                              fontSize: rs(13),
                              fontWeight: "700",
                              color: colors.text,
                            }}
                          >
                            {a.score}/{a.total}
                          </Text>
                          {isBest && attempts.length > 1 && (
                            <View
                              style={{
                                backgroundColor: colors.primarySoft,
                                paddingHorizontal: rs(6),
                                paddingVertical: rs(2),
                                borderRadius: rs(6),
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: rs(9),
                                  fontWeight: "800",
                                  color: colors.primary,
                                }}
                              >
                                BEST
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: rs(11),
                            color: colors.textFaint,
                            marginTop: rs(2),
                          }}
                        >
                          {dateStr}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleStartQuiz}
              style={[
                modal.deleteBtn,
                {
                  marginTop: rs(22),
                  paddingVertical: rs(15),
                  borderRadius: rs(16),
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <AppIcon name="help-circle-outline" size={rs(18)} color={colors.primary} />
              <Text
                style={[
                  modal.deleteBtnText,
                  { fontSize: rs(14), color: colors.primary },
                ]}
              >
                OX 퀴즈 풀기
              </Text>
            </TouchableOpacity>

            {!session.noteText?.trim() && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleAddNote}
                style={[
                  modal.deleteBtn,
                  {
                    marginTop: rs(10),
                    paddingVertical: rs(15),
                    borderRadius: rs(16),
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <AppIcon name="create-outline" size={rs(18)} color={colors.primary} />
                <Text
                  style={[
                    modal.deleteBtnText,
                    { fontSize: rs(14), color: colors.primary },
                  ]}
                >
                  노트 추가하기
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowDeleteConfirm(true)}
              style={[
                modal.deleteBtn,
                { marginTop: rs(10), paddingVertical: rs(15), borderRadius: rs(16) },
              ]}
            >
              <AppIcon name="trash-outline" size={rs(18)} color={colors.danger} />
              <Text style={[modal.deleteBtnText, { fontSize: rs(14) }]}>기록 삭제</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        {/* Quiz attempt review modal */}
        <Modal
          visible={!!reviewAttempt}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setReviewAttempt(null)}
        >
          <TouchableWithoutFeedback onPress={() => setReviewAttempt(null)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
          </TouchableWithoutFeedback>

          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: rs(22),
              paddingTop: rs(14),
              paddingBottom: rs(36),
              maxHeight: "88%",
            }}
          >
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: rs(18),
              }}
            />

            {reviewAttempt && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: rs(20) }}
              >
                <TouchableOpacity
                  onPress={() => setReviewAttempt(null)}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                >
                  <AppIcon name="close" size={rs(18)} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={{ alignItems: "center", paddingTop: rs(8), paddingBottom: rs(20) }}>
                  <View
                    style={{
                      width: rs(120),
                      height: rs(120),
                      borderRadius: rs(60),
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: rs(14),
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.25,
                      shadowRadius: 14,
                      elevation: 6,
                    }}
                  >
                    <Text style={{ fontSize: rs(40), fontWeight: "800", color: colors.onPrimary }}>
                      {reviewAttempt.score}
                      <Text style={{ fontSize: rs(22), opacity: 0.75 }}>
                        /{reviewAttempt.total}
                      </Text>
                    </Text>
                    <Text
                      style={{
                        fontSize: rs(11),
                        color: "rgba(244,241,234,0.85)",
                        fontWeight: "600",
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        marginTop: rs(-2),
                      }}
                    >
                      {reviewAttempt.percentage}%
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: rs(20),
                      fontWeight: "800",
                      color: colors.text,
                      marginBottom: rs(4),
                    }}
                  >
                    {reviewAttempt.percentage === 100
                      ? "완벽해요!"
                      : reviewAttempt.percentage >= 80
                        ? "훌륭해요!"
                        : reviewAttempt.percentage >= 60
                          ? "잘했어요!"
                          : reviewAttempt.percentage >= 40
                            ? "괜찮아요"
                            : "다시 복습해봐요"}
                  </Text>
                  <Text style={{ fontSize: rs(13), color: colors.textMuted }}>
                    {reviewAttempt.score}개 정답, {reviewAttempt.total - reviewAttempt.score}개 오답
                  </Text>
                  <Text style={{ fontSize: rs(11), color: colors.textFaint, marginTop: rs(4) }}>
                    {new Date(reviewAttempt.takenAt).toLocaleString("ko-KR")}
                  </Text>
                </View>

                {reviewAttempt.questions && reviewAttempt.questions.length > 0 ? (
                  <>
                    <Text style={[modal.sectionLabel, { fontSize: rs(11), marginBottom: rs(12) }]}>
                      문제 해설
                    </Text>
                    {reviewAttempt.questions.map((q, i) => {
                      const isCorrect = q.userAnswer === q.answer;
                      return (
                        <View
                          key={i}
                          style={{
                            backgroundColor: colors.surface,
                            borderRadius: rs(18),
                            padding: rs(16),
                            marginBottom: rs(10),
                            flexDirection: "row",
                            gap: rs(12),
                          }}
                        >
                          <View
                            style={{
                              width: rs(28),
                              height: rs(28),
                              borderRadius: rs(14),
                              backgroundColor: isCorrect ? colors.primary : colors.danger,
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: rs(1),
                            }}
                          >
                            <AppIcon
                              name={isCorrect ? "checkmark" : "close"}
                              size={rs(16)}
                              color={colors.onPrimary}
                            />
                          </View>
                          <View style={{ flex: 1, gap: rs(6) }}>
                            <Text
                              style={{
                                fontSize: rs(14),
                                fontWeight: "700",
                                color: colors.text,
                                lineHeight: rs(20),
                              }}
                            >
                              {i + 1}. {q.question}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: rs(8),
                                marginTop: rs(2),
                              }}
                            >
                              <Text style={{ fontSize: rs(11), color: colors.textFaint, fontWeight: "600" }}>
                                정답:
                              </Text>
                              <Text style={{ fontSize: rs(12), fontWeight: "800", color: colors.primary }}>
                                {q.answer}
                              </Text>
                              {!isCorrect && (
                                <>
                                  <Text style={{ fontSize: rs(11), color: colors.textFaint, fontWeight: "600" }}>
                                    · 내 답:
                                  </Text>
                                  <Text style={{ fontSize: rs(12), fontWeight: "800", color: colors.danger }}>
                                    {q.userAnswer || "-"}
                                  </Text>
                                </>
                              )}
                            </View>
                            <Text
                              style={{
                                fontSize: rs(12),
                                color: colors.textMuted,
                                lineHeight: rs(18),
                                marginTop: rs(4),
                              }}
                            >
                              {q.explanation}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: rs(18),
                      padding: rs(20),
                      alignItems: "center",
                      gap: rs(8),
                    }}
                  >
                    <AppIcon
                      name="information-circle-outline"
                      size={rs(24)}
                      color={colors.textFaint}
                    />
                    <Text
                      style={{
                        fontSize: rs(13),
                        color: colors.textFaint,
                        textAlign: "center",
                        lineHeight: rs(20),
                      }}
                    >
                      이 퀴즈는 옛 버전에서 만들어져{"\n"}문제 내역이 저장되어 있지 않아요
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* Fullscreen photo viewer */}
        <Modal
          visible={photoFullscreen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setPhotoFullscreen(false)}
        >
          <StatusBar hidden />
          <TouchableWithoutFeedback onPress={() => setPhotoFullscreen(false)}>
            <View style={modal.fsBackdrop}>
              <TouchableOpacity
                style={modal.fsCloseBtn}
                onPress={() => setPhotoFullscreen(false)}
              >
                <AppIcon name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableWithoutFeedback>
                <Image
                  source={{ uri: session.photoUris?.[0] || session.photoUri }}
                  style={modal.fsImage}
                  resizeMode="contain"
                />
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </Modal>

      {/* Integrated Matching Design Popover Window */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={modal.popBackdrop}>
          <View style={modal.popCard}>
            <View style={modal.popIconWrapper}>
              <AppIcon name="trash-outline" size={24} color={colors.danger} />
            </View>
            <Text style={modal.popTitle}>세션 삭제</Text>
            <Text style={modal.popDesc}>이 학습 기록을 삭제하시겠어요?</Text>

            <View style={modal.popActionGrid}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={modal.popCancelBtn}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={modal.popCancelLabel}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={modal.popConfirmBtn}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  onDelete(session.id);
                }}
              >
                <Text style={modal.popConfirmLabel}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SessionCard({
  session,
  isLast,
  onPress,
  rs,
  colors,
}: {
  session: StudySession;
  isLast: boolean;
  onPress: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {

  const card = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    accent: {
      width: 3,
      height: 42,
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
    info: { flex: 1, gap: 5 },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    subject: { fontWeight: "700", color: colors.text },
    durationBadge: {
      backgroundColor: colors.primarySoft,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    durationText: { color: colors.primary, fontWeight: "700" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { color: colors.textFaint },
    notePreview: { color: colors.textMuted, marginTop: 2, lineHeight: 18 },
    photoTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    pendingTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
  });

  const needsNote = !session.noteText?.trim();

  return (
    <View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[card.row, !isLast && card.rowBorder, { paddingVertical: rs(14) }]}
      >
        <View style={[card.accent, { borderRadius: rs(3) }]} />
        <View style={card.info}>
          <View style={card.topRow}>
            <Text style={[card.subject, { fontSize: rs(15) }]}>
              {session.subject || "공부 세션"}
            </Text>
            <View style={[card.durationBadge, { borderRadius: rs(8) }]}>
              <Text style={[card.durationText, { fontSize: rs(11) }]}>
                {formatMs(session.durationMs)}
              </Text>
            </View>
          </View>
          <View style={card.metaRow}>
            <AppIcon name="time-outline" size={rs(11)} color={colors.textFaint} />
            <Text style={[card.metaText, { fontSize: rs(12) }]}>
              {formatTime(session.startTime)}
            </Text>
            {/* Little camera icon if this session has a photo */}
            {(!!session.photoUri || (session.photoUris && session.photoUris.length > 0)) && (
              <View style={card.photoTag}>
                <AppIcon name="image-outline" size={rs(11)} color={colors.primary} />
              </View>
            )}
          </View>
          {needsNote ? (
            <View style={card.pendingTag}>
              <AppIcon name="create-outline" size={rs(11)} color={colors.textFaint} />
              <Text style={[card.metaText, { fontSize: rs(11) }]}>노트 미작성</Text>
            </View>
          ) : (
            !!session.noteText?.trim() && (
              <Text
                style={[card.notePreview, { fontSize: rs(12) }]}
                numberOfLines={2}
              >
                {session.noteText}
              </Text>
            )
          )}
        </View>
        <AppIcon name="chevron-forward" size={rs(14)} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

export default function HistoryScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors } = useTheme();

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selected, setSelected] = useState<StudySession | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, [])
  );

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    const updated = await loadSessions();
    setSessions(updated);
    setSelected(null);
  };

  const groups = groupSessions(sessions);
  const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: rs(24), paddingBottom: rs(48) },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: rs(20),
      marginBottom: rs(20),
    },
    headerTitle: {
      fontSize: Math.min(rs(26), 32),
      fontWeight: "800",
      color: colors.text,
    },
    headerSub: { fontSize: rs(13), color: colors.textFaint, marginTop: rs(2) },
    strip: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      marginBottom: rs(24),
      overflow: "hidden",
    },
    stripItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: rs(16),
      gap: rs(4),
    },
    stripDivider: { width: 1, backgroundColor: colors.border, marginVertical: rs(12) },
    stripLabel: {
      fontSize: rs(10),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    stripValue: {
      fontSize: Math.min(rs(18), 24),
      fontWeight: "800",
      color: colors.text,
    },
    groupLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: rs(10),
      marginTop: rs(4),
    },
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      paddingHorizontal: rs(16),
      marginBottom: rs(16),
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: rs(64),
      gap: rs(12),
    },
    emptyText: {
      fontSize: rs(14),
      color: colors.textFaint,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={Platform.OS === "web" ? [] : ["top"]}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.content}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>학습 기록</Text>
              <Text style={s.headerSub}>그동안 쌓아온 집중의 시간들</Text>
            </View>
          </View>

          <View style={s.strip}>
            <View style={s.stripItem}>
              <Text style={s.stripLabel}>총 세션</Text>
              <Text style={s.stripValue}>{sessions.length}회</Text>
            </View>
            <View style={s.stripDivider} />
            <View style={s.stripItem}>
              <Text style={s.stripLabel}>총 집중 시간</Text>
              <Text style={s.stripValue}>{formatMs(totalMs)}</Text>
            </View>
          </View>

          {groups.length === 0 ? (
            <View style={s.emptyContainer}>
              <AppIcon name="calendar-outline" size={rs(32)} color={colors.textFaint} />
              <Text style={s.emptyText}>아직 기록된 세션이 없습니다.</Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.label}>
                <Text style={s.groupLabel}>{group.label}</Text>
                <View style={s.groupCard}>
                  {group.sessions.map((session, index) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isLast={index === group.sessions.length - 1}
                      onPress={() => setSelected(session)}
                      rs={rs}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <DetailModal
        session={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        rs={rs}
        colors={colors}
      />
    </SafeAreaView>
  );
}