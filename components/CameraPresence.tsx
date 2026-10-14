// components/CameraPresence.tsx
// iOS/Android version: shows a small page (cameraPresencePage.ts, bundled
// with the app) in a WebView. That page runs the same on-device face detector
// as the web version and posts presence changes back here. Using a WebView
// keeps this working in Expo Go, which can't load custom native camera/ML
// modules.

import { Camera } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { CAMERA_PRESENCE_HTML } from "./cameraPresencePage";

export type CameraPresenceProps = {
  // Called with false once the user has been out of frame for a few
  // seconds, and with true when they come back.
  onPresenceChange: (present: boolean) => void;
  onError: (message: string) => void;
  accentColor: string;
};

export const isCameraPresenceSupported = true;

// Camera access needs a secure (https) origin, so the inline page is given an
// https base URL. Nothing is loaded from it; it only sets the page's origin.
const PAGE_BASE_URL = "https://localhost/";
// The detector downloads ~13MB the first time, so allow time on slow networks.
const READY_TIMEOUT_MS = 45000;

const DENIED_MESSAGE = "카메라 권한이 거부되었어요. 설정에서 카메라를 허용해주세요.";
const FAILED_MESSAGE = "카메라를 시작할 수 없어요. 네트워크 연결을 확인하고 다시 시도해주세요.";

type Status = "permission" | "loading" | "present" | "absent";

export default function CameraPresence({
  onPresenceChange,
  onError,
  accentColor,
}: CameraPresenceProps) {
  const [status, setStatus] = useState<Status>("permission");

  // Keep the latest callbacks without reloading the WebView when they change.
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onErrorRef = useRef(onError);
  onPresenceChangeRef.current = onPresenceChange;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    Camera.requestCameraPermissionsAsync()
      .then(({ granted }) => {
        if (cancelled) return;
        if (granted) setStatus("loading");
        else onErrorRef.current(DENIED_MESSAGE);
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current(FAILED_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => onErrorRef.current(FAILED_MESSAGE), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  function handleMessage(event: WebViewMessageEvent) {
    let message: any;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (message?.type === "ready") {
      setStatus("present");
    } else if (message?.type === "presence") {
      const present = message.present === true;
      setStatus(present ? "present" : "absent");
      onPresenceChangeRef.current(present);
    } else if (message?.type === "error") {
      onErrorRef.current(message.reason === "denied" ? DENIED_MESSAGE : FAILED_MESSAGE);
    }
  }

  const borderColor = status === "absent" ? "#D9534F" : accentColor;
  const label =
    status === "present" ? "감지됨" : status === "absent" ? "화면 밖" : "준비 중…";

  return (
    <View style={[styles.frame, { borderColor }]}>
      {status !== "permission" && (
        <WebView
          source={{ html: CAMERA_PRESENCE_HTML, baseUrl: PAGE_BASE_URL }}
          originWhitelist={["*"]}
          style={styles.webview}
          onMessage={handleMessage}
          onError={() => onErrorRef.current(FAILED_MESSAGE)}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          scrollEnabled={false}
          bounces={false}
        />
      )}
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
  webview: {
    flex: 1,
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
