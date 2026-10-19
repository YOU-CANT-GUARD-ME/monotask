// app/group-study.tsx
// Crew group study: up to 4 people studying together with cameras on (video
// only, no audio). The video itself runs in components/GroupVideo; this screen
// joins the room, keeps a heartbeat, and relays connection messages through
// Firestore. Time spent here is saved as a study session when you leave.
import { Camera } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GroupVideo, { type GroupVideoHandle } from "../components/GroupVideo";
import { useTheme } from "../contexts/ThemeContext";
import { auth, db } from "../firebase";
import { apiErrorMessage, joinCrewRoom, leaveCrewRoom } from "../utils/crews";
import { syncMyLeaderboardEntry } from "../utils/leaderboard";
import { saveSession } from "../utils/storage";
import { setWebChromeOverrideColor } from "../utils/webChrome";

const HEARTBEAT_MS = 10 * 1000;
// Must match ROOM_STALE_MS in api/crews.ts.
const STALE_MS = 30 * 1000;
const MIN_SAVE_MS = 10 * 1000;

type Participant = { uid: string; displayName: string; lastSeen: number };

function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function GroupStudyScreen() {
  const { width } = useWindowDimensions();
  const rs = (n: number) => Math.round(n * (width / 390));
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { crewId } = useLocalSearchParams<{ crewId?: string }>();

  const [phase, setPhase] = useState<"joining" | "in" | "error">("joining");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [maxSize, setMaxSize] = useState(4);
  const [elapsedMs, setElapsedMs] = useState(0);

  const videoRef = useRef<GroupVideoHandle>(null);
  const startRef = useRef<number | null>(null);
  const sessionIdRef = useRef(Date.now().toString());
  const leftRef = useRef(false);
  const rawParticipantsRef = useRef<Participant[]>([]);
  const signalSeqRef = useRef(0);

  const me = auth.currentUser;

  // Black strip behind the status bar on web while this screen is open.
  useFocusEffect(
    useCallback(() => {
      setWebChromeOverrideColor("group-study", "#000000");
      return () => setWebChromeOverrideColor("group-study", null);
    }, [])
  );

  // Leave the room and save the time studied. Safe to call more than once.
  const leave = useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    if (crewId) leaveCrewRoom(crewId).catch(() => {});
    const start = startRef.current;
    if (start) {
      const durationMs = Date.now() - start;
      if (durationMs > MIN_SAVE_MS) {
        try {
          await saveSession({
            id: sessionIdRef.current,
            startTime: start,
            durationMs,
            subject: "그룹 스터디",
          });
          syncMyLeaderboardEntry().catch(() => {});
        } catch (e) {
          console.warn("save group session failed:", e);
        }
      }
    }
  }, [crewId]);

  // Join the room (server enforces the 4-person limit).
  useEffect(() => {
    if (!crewId || !me) {
      setPhase("error");
      setErrorText("로그인이 필요해요.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS !== "web") {
          const { granted } = await Camera.requestCameraPermissionsAsync();
          if (!granted) throw new Error("camera-denied");
        }
        const { maxSize: size } = await joinCrewRoom(crewId);
        if (cancelled) {
          leaveCrewRoom(crewId).catch(() => {});
          return;
        }
        setMaxSize(size);
        startRef.current = Date.now();
        setPhase("in");
      } catch (e: any) {
        if (cancelled) return;
        setPhase("error");
        setErrorText(
          e?.message === "camera-denied"
            ? "카메라 권한이 필요해요. 설정에서 카메라를 허용해주세요."
            : apiErrorMessage(e, "그룹 스터디에 참여하지 못했어요.")
        );
      }
    })();
    return () => {
      cancelled = true;
      leave();
    };
  }, [crewId]);

  // While in the room: participants, incoming signals, heartbeat, timer.
  useEffect(() => {
    if (phase !== "in" || !crewId || !me) return;

    const roomRef = collection(db, "crews", crewId, "participants");
    const signalsRef = collection(db, "crews", crewId, "signals");

    function publishPeers() {
      const now = Date.now();
      const fresh = rawParticipantsRef.current.filter((p) => p.lastSeen >= now - STALE_MS);
      setParticipants(fresh);
      videoRef.current?.send({
        type: "peers",
        peers: fresh.filter((p) => p.uid !== me!.uid).map((p) => ({ uid: p.uid, name: p.displayName })),
      });
    }

    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        rawParticipantsRef.current = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            displayName: String(data.displayName || "User"),
            lastSeen: Number(data.lastSeen) || 0,
          };
        });
        publishPeers();
      },
      (e) => console.warn("room listener failed:", e)
    );

    const unsubSignals = onSnapshot(
      query(signalsRef, where("to", "==", me.uid)),
      (snap) => {
        const added = snap
          .docChanges()
          .filter((c) => c.type === "added")
          .map((c) => ({ ref: c.doc.ref, ...(c.doc.data() as any) }))
          .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq);
        for (const signal of added) {
          try {
            videoRef.current?.send({
              type: "signal",
              from: signal.from,
              data: JSON.parse(signal.payload),
            });
          } catch {
            // Ignore malformed messages.
          }
          deleteDoc(signal.ref).catch(() => {});
        }
      },
      (e) => console.warn("signal listener failed:", e)
    );

    const myDoc = doc(db, "crews", crewId, "participants", me.uid);
    const heartbeat = setInterval(() => {
      updateDoc(myDoc, { lastSeen: Date.now() }).catch(() => {
        // Our entry was cleaned up (e.g. the app was asleep): join again.
        joinCrewRoom(crewId).catch(() => {});
      });
      publishPeers();
    }, HEARTBEAT_MS);

    const ticker = setInterval(() => {
      if (startRef.current) setElapsedMs(Date.now() - startRef.current);
    }, 1000);

    return () => {
      unsubRoom();
      unsubSignals();
      clearInterval(heartbeat);
      clearInterval(ticker);
    };
  }, [phase, crewId]);

  function handleVideoMessage(message: any) {
    if (!me || !crewId) return;
    if (message?.type === "loaded") {
      videoRef.current?.send({
        type: "init",
        me: { uid: me.uid, name: me.displayName ?? me.email?.split("@")[0] ?? "User" },
      });
    } else if (message?.type === "signal" && typeof message.to === "string") {
      addDoc(collection(db, "crews", crewId, "signals"), {
        from: me.uid,
        to: message.to,
        payload: JSON.stringify(message.data),
        createdAt: Date.now(),
        seq: signalSeqRef.current++,
      }).catch((e) => console.warn("send signal failed:", e));
    } else if (message?.type === "error") {
      setPhase("error");
      setErrorText(
        message.reason === "denied"
          ? "카메라 권한이 필요해요. 설정에서 카메라를 허용해주세요."
          : "카메라를 시작할 수 없어요."
      );
      leave();
    }
  }

  async function handleLeave() {
    await leave();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/friends", params: { tab: "crews" } });
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    videoArea: { flex: 1 },
    bottom: {
      backgroundColor: colors.surfaceDark,
      paddingHorizontal: rs(24),
      paddingTop: rs(16),
      borderTopLeftRadius: rs(22),
      borderTopRightRadius: rs(22),
    },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: rs(14), fontWeight: "800", color: "#e0d8c4" },
    count: { fontSize: rs(13), fontWeight: "800", color: colors.primary },
    elapsed: {
      fontSize: Math.min(rs(36), 44),
      fontWeight: "600",
      color: "#e0d8c4",
      textAlign: "center",
      marginTop: rs(8),
    },
    elapsedLabel: { fontSize: rs(12), color: colors.primaryDark, textAlign: "center", marginBottom: rs(14) },
    leaveBtn: {
      backgroundColor: colors.primary,
      borderRadius: rs(18),
      paddingVertical: rs(15),
      alignItems: "center",
    },
    leaveText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: rs(24), backgroundColor: colors.surfaceDark },
    errorText: { color: "#e0d8c4", fontSize: rs(14), textAlign: "center", lineHeight: rs(21), marginBottom: rs(18) },
  });

  if (phase !== "in") {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        {phase === "joining" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={s.errorText}>{errorText}</Text>
            <TouchableOpacity style={[s.leaveBtn, { paddingHorizontal: rs(32) }]} onPress={handleLeave}>
              <Text style={s.leaveText}>돌아가기</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.videoArea, { paddingTop: insets.top }]}>
        <GroupVideo ref={videoRef} onMessage={handleVideoMessage} />
      </View>
      <View style={[s.bottom, { paddingBottom: insets.bottom + rs(16) }]}>
        <View style={s.topRow}>
          <Text style={s.title}>그룹 스터디 · 소리 없이 화면만 공유돼요</Text>
          <Text style={s.count}>
            {participants.length}/{maxSize}
          </Text>
        </View>
        <Text style={s.elapsed}>{formatElapsed(elapsedMs)}</Text>
        <Text style={s.elapsedLabel}>함께 공부한 시간</Text>
        <TouchableOpacity style={s.leaveBtn} onPress={handleLeave} activeOpacity={0.85}>
          <Text style={s.leaveText}>그룹 스터디 나가기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
