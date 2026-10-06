// contexts/ThemeContext.tsx
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
    DEFAULT_THEME_KEY,
    DEFAULT_THEME_MODE,
    ResolvedMode,
    ThemeKey,
    ThemeMeta,
    ThemeMode,
    ThemePalette,
    THEMES,
} from "../constants/themes";
import { auth, db } from "../firebase";

type ThemeContextValue = {
  themeKey: ThemeKey;
  themeMode: ThemeMode;          // user preference (light / dark / system)
  resolvedMode: ResolvedMode;    // actual mode in use (light or dark)
  theme: ThemeMeta;
  colors: ThemePalette;          // resolves to the right palette automatically
  setThemeKey: (key: ThemeKey) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(
  mode: ThemeMode,
  systemScheme: ColorSchemeName | null | undefined
): ResolvedMode {
  if (mode === "system") return systemScheme === "dark" ? "dark" : "light";
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName | null | undefined>(
    Appearance.getColorScheme()
  );
  const [loading, setLoading] = useState(true);

  // ── Listen for system dark/light mode changes ──────────────────────────
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  // ── Load saved theme/mode from Firestore when user changes ─────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setThemeKeyState(DEFAULT_THEME_KEY);
        setThemeModeState(DEFAULT_THEME_MODE);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data();
        const savedKey = data?.themeKey as ThemeKey | undefined;
        const savedMode = data?.themeMode as ThemeMode | undefined;

        if (savedKey && THEMES[savedKey]) {
          setThemeKeyState(savedKey);
        } else {
          setThemeKeyState(DEFAULT_THEME_KEY);
        }

        if (savedMode === "light" || savedMode === "dark" || savedMode === "system") {
          setThemeModeState(savedMode);
        } else {
          setThemeModeState(DEFAULT_THEME_MODE);
        }
      } catch (e) {
        console.warn("Failed to load theme from Firestore:", e);
        setThemeKeyState(DEFAULT_THEME_KEY);
        setThemeModeState(DEFAULT_THEME_MODE);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // ── Save to Firestore ──────────────────────────────────────────────────
  const persist = async (key: ThemeKey, mode: ThemeMode) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { themeKey: key, themeMode: mode },
        { merge: true }
      );
    } catch (e) {
      console.warn("Failed to save theme to Firestore:", e);
    }
  };

  const setThemeKey = async (key: ThemeKey) => {
    if (!THEMES[key]) return;
    setThemeKeyState(key);
    await persist(key, themeMode);
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await persist(themeKey, mode);
  };

  const resolvedMode = resolveMode(themeMode, systemScheme);
  const theme = THEMES[themeKey];
  const colors = resolvedMode === "dark" ? theme.dark : theme.light;

  const value: ThemeContextValue = {
    themeKey,
    themeMode,
    resolvedMode,
    theme,
    colors,
    setThemeKey,
    setThemeMode,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}