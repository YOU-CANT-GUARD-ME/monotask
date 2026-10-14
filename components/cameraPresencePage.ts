// components/cameraPresencePage.ts
// The page shown inside the WebView by components/CameraPresence.tsx. It is
// bundled with the app (not hosted anywhere) so camera focus mode works in
// Expo Go without deploying anything. It runs MediaPipe's on-device face
// detector and posts presence changes back to the app; video frames never
// leave the phone. Keep the detection settings in sync with
// components/CameraPresence.web.tsx.

export const CAMERA_PRESENCE_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Camera presence</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block; }
  </style>
</head>
<body>
  <video id="video" muted playsinline autoplay></video>
  <script type="module">
    // Keep these in sync with components/CameraPresence.web.tsx.
    const MEDIAPIPE_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0";
    const MODEL_URL =
      "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
    const CHECK_INTERVAL_MS = 250;
    const ABSENT_AFTER_MS = 3000;
    const PRESENT_AFTER_HITS = 2;
    const MIN_FACE_SCORE = 0.5;

    function post(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }

    async function start() {
      const video = document.getElementById("video");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        video.srcObject = stream;
        await video.play().catch(() => {});

        const { FaceDetector, FilesetResolver } = await import(\`\${MEDIAPIPE_BASE_URL}/vision_bundle.mjs\`);
        const fileset = await FilesetResolver.forVisionTasks(\`\${MEDIAPIPE_BASE_URL}/wasm\`);
        const detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          minDetectionConfidence: MIN_FACE_SCORE,
        });

        let reportedPresent = true;
        let lastSeenAt = Date.now();
        let hits = 0;
        post({ type: "ready" });

        setInterval(() => {
          if (video.readyState < 2) return;
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
              post({ type: "presence", present: true });
            }
          } else {
            hits = 0;
            if (reportedPresent && now - lastSeenAt >= ABSENT_AFTER_MS) {
              reportedPresent = false;
              post({ type: "presence", present: false });
            }
          }
        }, CHECK_INTERVAL_MS);
      } catch (error) {
        const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
        post({ type: "error", reason: denied ? "denied" : "failed", detail: String(error?.message || error) });
      }
    }

    start();
  </script>
</body>
</html>
`;
