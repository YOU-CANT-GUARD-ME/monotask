// utils/webChrome.ts
// On the web, the strip behind the phone's status bar (and the browser's own
// toolbar tint) uses the page's theme-color and body background. Keep them in
// step with what's on screen so a dark screen doesn't get a light strip.
// Does nothing on iOS/Android.
//
// The theme sets the base colour. Anything that covers the page with its own
// background (the startup splash, the dark focus screen) sets a named
// override while it's showing; the most recently set override wins, and
// clearing it falls back to the next one or the base. This way it doesn't
// matter in which order React runs the effects.

import { Platform } from "react-native";

let baseColor: string | null = null;
const overrides = new Map<string, string>();

function apply() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const latestOverride = [...overrides.values()].pop();
  const color = latestOverride ?? baseColor;
  if (!color) return;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;

  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}

export function setWebChromeBaseColor(color: string) {
  baseColor = color;
  apply();
}

// Pass null to remove this override.
export function setWebChromeOverrideColor(key: string, color: string | null) {
  if (color === null) {
    overrides.delete(key);
  } else {
    // Re-insert so this override becomes the most recent one.
    overrides.delete(key);
    overrides.set(key, color);
  }
  apply();
}
