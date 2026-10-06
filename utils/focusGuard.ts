import { Platform } from "react-native";

type FocusGuardNativeModule = {
  start(
    startTime: number,
    bg: string,
    titleColor: string,
    timerColor: string,
    descColor: string,
    buttonBg: string,
    buttonTextColor: string
  ): Promise<void>;
  setAppInForeground(foreground: boolean): Promise<void>;
  stop(): Promise<void>;
};

let nativeModule: FocusGuardNativeModule | null = null;

if (Platform.OS === "android") {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    nativeModule = requireNativeModule("FocusGuard");
  } catch (error) {
    console.log("FocusGuard requires an Android development build:", error);
  }
}

export const isNativeFocusGuardAvailable = () => nativeModule !== null;

type FocusGuardColors = {
  bg: string;
  onPrimary: string;
  primary: string;
};

function blendHex(fg: string, bg: string, alpha: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [fr, fg_, fb] = parse(fg);
  const [br, bgc, bb] = parse(bg);
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(fr, br))}${toHex(mix(fg_, bgc))}${toHex(mix(fb, bb))}`;
}

export async function startFocusGuard(startTime: number, colors: FocusGuardColors) {
  const descColor = blendHex(colors.onPrimary, colors.bg, 0.72);
  await nativeModule?.start(
    startTime,
    colors.bg,
    colors.onPrimary,
    colors.primary,
    descColor,
    colors.primary,
    colors.onPrimary
  );
}

export async function setFocusGuardAppInForeground(foreground: boolean) {
  await nativeModule?.setAppInForeground(foreground);
}

export async function stopFocusGuard() {
  await nativeModule?.stop();
}