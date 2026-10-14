// components/CameraPresence.web.tsx
// Web version: watches the front camera with MediaPipe's on-device face
// detector and reports whether the user is in frame. Video never leaves the
// browser — frames are only fed to the local detector.

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type * as Vision from "@mediapipe/tasks-vision";
import type { CameraPresenceProps } from "./CameraPresence";

export type { CameraPresenceProps } from "./CameraPresence";

export const isCameraPresenceSupported =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

const MEDIAPIPE_VERSION = "1.1.0";
const MEDIAPIPE_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_BASE_URL = `${MEDIAPIPE_BASE_URL}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const CHECK_INTERVAL_MS = 250;
// How long the face must be missing before we report "away".
const ABSENT_AFTER_MS = 3000;
// Consecutive hits needed before we report "back", to ignore one-frame blips.
const PRESENT_AFTER_HITS = 2;
const MIN_FACE_SCORE = 0.5;

type Status = "loading" | "present" | "absent";

// MediaPipe can't go through Metro (it uses a dynamic import Metro rejects),
// so the browser loads the pinned version straight from the CDN. The npm
// package is only used for its TypeScript types.
let visionModule: Promise<typeof Vision> | null = null;
function loadVision(): Promise<typeof Vision> {
  if (!visionModule) {
    const nativeImport = new Function("url", "return import(url)") as (
      url: string
    ) => Promise<typeof Vision>;
    visionModule = nativeImport(`${MEDIAPIPE_BASE_URL}/vision_bundle.mjs`).catch(
      (error) => {
        visionModule = null;
        throw error;
      }
    );
  }
  return visionModule;
}

export default function CameraPresence({
  onPresenceChange,
  onError,
  accentColor,
}: CameraPresenceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Keep the latest callbacks without restarting the camera when they change.
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onErrorRef = useRef(onError);
  onPresenceChangeRef.current = onPresenceChange;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let detector: Vision.FaceDetector | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});

        // Loaded on demand so the detector isn't in the main bundle.
        const { FaceDetector, FilesetResolver } = await loadVision();
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          minDetectionConfidence: MIN_FACE_SCORE,
        });
        if (cancelled) {
          detector.close();
          return;
        }

        let reportedPresent = true;
        let lastSeenAt = Date.now();
        let hits = 0;
        setStatus("present");

        timer = setInterval(() => {
          if (!detector || video.readyState < 2) return;

          const now = Date.now();
          const result = detector.detectForVideo(video, performance.now());
          const seen = (result?.detections ?? []).some(
            (d) => (d.categories?.[0]?.score ?? 0) >= MIN_FACE_SCORE
          );

          if (seen) {
            lastSeenAt = now;
            hits++;
            if (!reportedPresent && hits >= PRESENT_AFTER_HITS) {
              reportedPresent = true;
              setStatus("present");
              onPresenceChangeRef.current(true);
            }
          } else {
            hits = 0;
            if (reportedPresent && now - lastSeenAt >= ABSENT_AFTER_MS) {
              reportedPresent = false;
              setStatus("absent");
              onPresenceChangeRef.current(false);
            }
          }
        }, CHECK_INTERVAL_MS);
      } catch (error: any) {
        if (cancelled) return;
        const denied =
          error?.name === "NotAllowedError" || error?.name === "SecurityError";
        onErrorRef.current(
          denied
            ? "카메라 권한이 거부되었어요. 브라우저 설정에서 카메라를 허용해주세요."
            : "카메라를 시작할 수 없어요. 다른 앱이 카메라를 쓰고 있지 않은지 확인해주세요."
        );
      }
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      detector?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const borderColor = status === "absent" ? "#D9534F" : accentColor;
  const label =
    status === "loading" ? "준비 중…" : status === "present" ? "감지됨" : "화면 밖";

  return (
    <View style={[styles.frame, { borderColor }]}>
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: "block",
        }}
      />
      <View style={[styles.badge, { backgroundColor: borderColor }]}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills its parent; the focus screen decides how big the camera is.
  frame: {
    flex: 1,
    width: "100%",
    borderBottomWidth: 3,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  badge: {
    position: "absolute",
    left: 16,
    bottom: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
