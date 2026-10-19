// components/GroupVideo.web.tsx
// Web host for the group-study video page (groupVideoPage.ts), shown in an
// iframe. The iframe shares this page's origin, so the camera works there.

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { GroupVideoHandle, GroupVideoProps } from "./GroupVideo";
import { GROUP_VIDEO_HTML } from "./groupVideoPage";

export type { GroupVideoHandle, GroupVideoProps } from "./GroupVideo";

const GroupVideo = forwardRef<GroupVideoHandle, GroupVideoProps>(function GroupVideo(
  { onMessage },
  ref
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);
  const queueRef = useRef<object[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  function deliver(message: object) {
    frameRef.current?.contentWindow?.postMessage({ __groupStudyHost: true, data: message }, "*");
  }

  useImperativeHandle(ref, () => ({
    send(message) {
      if (loadedRef.current) deliver(message);
      else queueRef.current.push(message);
    },
  }));

  useEffect(() => {
    function handle(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (!event.data?.__groupStudy) return;
      let message: any;
      try {
        message = JSON.parse(event.data.data);
      } catch {
        return;
      }
      if (message?.type === "loaded") {
        loadedRef.current = true;
        queueRef.current.splice(0).forEach(deliver);
      }
      onMessageRef.current(message);
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  return (
    <iframe
      ref={frameRef}
      srcDoc={GROUP_VIDEO_HTML}
      allow="camera; autoplay"
      title="group study video"
      style={{ border: 0, width: "100%", height: "100%", display: "block", background: "#000" }}
    />
  );
});

export default GroupVideo;
