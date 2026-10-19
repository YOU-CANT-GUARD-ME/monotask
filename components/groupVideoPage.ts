// components/groupVideoPage.ts
// The video page for crew group study. It runs inside a WebView on iOS/Android
// (components/GroupVideo.tsx) and an iframe on web (GroupVideo.web.tsx), so the
// WebRTC code exists once and works in Expo Go.
//
// Video only: the microphone is never requested. Every pair of participants
// gets its own direct connection (max 4 people, so at most 3 per device). The
// page doesn't talk to Firebase itself; the app passes messages both ways:
//
//   app -> page  {type:"init", me:{uid,name}}
//                {type:"peers", peers:[{uid,name}]}   everyone else in the room
//                {type:"signal", from, data}          offer / answer / ice
//   page -> app  {type:"loaded"}  script running, ready for "init"
//                {type:"ready"}   camera started
//                {type:"signal", to, data}
//                {type:"error", reason:"denied"|"failed"}

export const GROUP_VIDEO_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #grid { display: grid; width: 100%; height: 100%; gap: 4px; padding: 4px; box-sizing: border-box; }
    .tile { position: relative; background: #15170f; border-radius: 14px; overflow: hidden; min-height: 0; }
    .tile video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .tile.me video { transform: scaleX(-1); }
    .label { position: absolute; left: 8px; bottom: 8px; background: rgba(0,0,0,0.55); color: #fff;
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
    .status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.75); font-size: 13px; text-align: center; padding: 12px; }
    .status:empty { display: none; }
  </style>
</head>
<body>
  <div id="grid"></div>
  <script>
    const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
    // A connection that hasn't recovered after this long is rebuilt.
    const RETRY_MS = 4000;
    // A peer we first heard from through an incoming offer is kept this long
    // even if the app's participant list hasn't caught up yet.
    const NEW_PEER_GRACE_MS = 15000;

    const grid = document.getElementById("grid");
    let me = null;
    let localStream = null;
    let ready = false;
    const waiting = [];         // host messages that arrived before the camera started
    const peers = new Map();    // uid -> { name, pc, tile, pendingIce, createdAt, fromSignal, retryTimer }

    function send(message) {
      const text = JSON.stringify(message);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
      else window.parent.postMessage({ __groupStudy: true, data: text }, "*");
    }

    function makeTile(name, isMe) {
      const tile = document.createElement("div");
      tile.className = "tile" + (isMe ? " me" : "");
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = isMe ? name + " (나)" : name;
      const status = document.createElement("div");
      status.className = "status";
      status.textContent = isMe ? "" : "연결 중…";
      tile.append(video, status, label);
      grid.appendChild(tile);
      layout();
      return { tile, video, label, status };
    }

    function layout() {
      const n = grid.children.length;
      const wide = window.innerWidth > window.innerHeight;
      if (n <= 1) { grid.style.gridTemplateColumns = "1fr"; grid.style.gridTemplateRows = "1fr"; }
      else if (n === 2) {
        grid.style.gridTemplateColumns = wide ? "1fr 1fr" : "1fr";
        grid.style.gridTemplateRows = wide ? "1fr" : "1fr 1fr";
      } else { grid.style.gridTemplateColumns = "1fr 1fr"; grid.style.gridTemplateRows = "1fr 1fr"; }
    }
    window.addEventListener("resize", layout);

    function setStatus(peer, text) {
      peer.tile.status.textContent = text;
    }

    function closeConnection(peer) {
      clearTimeout(peer.retryTimer);
      if (peer.pc) {
        peer.pc.ontrack = peer.pc.onicecandidate = peer.pc.onconnectionstatechange = null;
        peer.pc.close();
      }
      peer.pc = null;
      peer.pendingIce = [];
    }

    function removePeer(uid) {
      const peer = peers.get(uid);
      if (!peer) return;
      closeConnection(peer);
      peer.tile.tile.remove();
      peers.delete(uid);
      layout();
    }

    function getPeer(uid, name, fromSignal) {
      let peer = peers.get(uid);
      if (!peer) {
        peer = { name: name || "…", pc: null, tile: makeTile(name || "…", false), pendingIce: [],
          createdAt: Date.now(), fromSignal: !!fromSignal, retryTimer: null };
        peers.set(uid, peer);
      } else if (name && peer.name !== name) {
        peer.name = name;
        peer.tile.label.textContent = name;
      }
      return peer;
    }

    // The participant with the smaller uid starts each connection.
    function iStart(uid) {
      return me.uid < uid;
    }

    function newConnection(uid, peer) {
      closeConnection(peer);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peer.pc = pc;
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      pc.ontrack = (e) => {
        peer.tile.video.srcObject = e.streams[0];
        peer.tile.video.play().catch(() => {});
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "signal", to: uid, data: { kind: "ice", candidate: e.candidate.toJSON() } });
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          clearTimeout(peer.retryTimer);
          setStatus(peer, "");
        } else if (state === "failed" || state === "disconnected") {
          setStatus(peer, state === "failed" ? "연결이 끊겼어요. 다시 연결하는 중…" : "연결이 불안정해요…");
          clearTimeout(peer.retryTimer);
          if (iStart(uid)) peer.retryTimer = setTimeout(() => startConnection(uid), RETRY_MS);
        }
      };
      return pc;
    }

    async function startConnection(uid) {
      const peer = peers.get(uid);
      if (!peer || !ready) return;
      setStatus(peer, "연결 중…");
      const pc = newConnection(uid, peer);
      try {
        await pc.setLocalDescription(await pc.createOffer());
        send({ type: "signal", to: uid, data: { kind: "offer", sdp: pc.localDescription.toJSON() } });
      } catch (err) {
        setStatus(peer, "연결하지 못했어요.");
      }
    }

    async function flushIce(peer) {
      const list = peer.pendingIce;
      peer.pendingIce = [];
      for (const c of list) await peer.pc.addIceCandidate(c).catch(() => {});
    }

    async function handleSignal(from, data) {
      const peer = getPeer(from, null, true);
      try {
        if (data.kind === "offer") {
          // A new offer always means a fresh connection (e.g. they rejoined).
          const pc = newConnection(from, peer);
          await pc.setRemoteDescription(data.sdp);
          await flushIce(peer);
          await pc.setLocalDescription(await pc.createAnswer());
          send({ type: "signal", to: from, data: { kind: "answer", sdp: pc.localDescription.toJSON() } });
        } else if (data.kind === "answer") {
          if (peer.pc && peer.pc.signalingState === "have-local-offer") {
            await peer.pc.setRemoteDescription(data.sdp);
            await flushIce(peer);
          }
        } else if (data.kind === "ice") {
          if (peer.pc && peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pendingIce.push(data.candidate);
        }
      } catch (err) {
        setStatus(peer, "연결하지 못했어요.");
      }
    }

    function syncPeers(list) {
      const now = Date.now();
      const wanted = new Map(list.filter((p) => p.uid !== me.uid).map((p) => [p.uid, p.name]));
      for (const [uid, peer] of peers) {
        const inGrace = peer.fromSignal && now - peer.createdAt < NEW_PEER_GRACE_MS;
        if (!wanted.has(uid) && !inGrace) removePeer(uid);
      }
      for (const [uid, name] of wanted) {
        const isNew = !peers.has(uid);
        const peer = getPeer(uid, name);
        peer.fromSignal = false;
        if (isNew && iStart(uid) && !peer.pc) startConnection(uid);
      }
    }

    function handleHost(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "init") {
        if (!me) start(message.me);
        return;
      }
      if (!ready) { waiting.push(message); return; }
      if (message.type === "peers") syncPeers(message.peers || []);
      else if (message.type === "signal") handleSignal(message.from, message.data || {});
    }

    async function start(self) {
      me = self;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
          audio: false,
        });
      } catch (error) {
        const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
        send({ type: "error", reason: denied ? "denied" : "failed" });
        return;
      }
      const mine = makeTile(me.name, true);
      mine.video.srcObject = localStream;
      mine.video.play().catch(() => {});
      ready = true;
      send({ type: "ready" });
      while (waiting.length) handleHost(waiting.shift());
    }

    window.__onHostMessage = handleHost;
    window.addEventListener("message", (e) => {
      if (e.source === window.parent && e.data && e.data.__groupStudyHost) handleHost(e.data.data);
    });
    window.addEventListener("pagehide", () => {
      for (const uid of [...peers.keys()]) removePeer(uid);
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    });
    send({ type: "loaded" });
  </script>
</body>
</html>`;
