// components/GroupVideo.tsx
// iOS/Android host for the group-study video page (groupVideoPage.ts), shown
// in a WebView so it works in Expo Go. See GroupVideo.web.tsx for web.

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { GROUP_VIDEO_HTML } from "./groupVideoPage";

export type GroupVideoHandle = {
  send: (message: object) => void;
};

export type GroupVideoProps = {
  onMessage: (message: any) => void;
};

// Camera access needs a secure (https) origin; nothing is loaded from it.
const PAGE_BASE_URL = "https://localhost/";

const GroupVideo = forwardRef<GroupVideoHandle, GroupVideoProps>(function GroupVideo(
  { onMessage },
  ref
) {
  const webviewRef = useRef<WebView>(null);
  const loadedRef = useRef(false);
  const queueRef = useRef<object[]>([]);

  function deliver(message: object) {
    webviewRef.current?.injectJavaScript(
      `window.__onHostMessage && window.__onHostMessage(${JSON.stringify(message)}); true;`
    );
  }

  useImperativeHandle(ref, () => ({
    send(message) {
      if (loadedRef.current) deliver(message);
      else queueRef.current.push(message);
    },
  }));

  function handleMessage(event: WebViewMessageEvent) {
    let message: any;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message?.type === "loaded") {
      loadedRef.current = true;
      queueRef.current.splice(0).forEach(deliver);
    }
    onMessage(message);
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: GROUP_VIDEO_HTML, baseUrl: PAGE_BASE_URL }}
      originWhitelist={["*"]}
      style={styles.webview}
      onMessage={handleMessage}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      scrollEnabled={false}
      bounces={false}
    />
  );
});

export default GroupVideo;

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#000" },
});
