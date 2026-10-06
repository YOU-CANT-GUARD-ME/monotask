// app/_layout.tsx
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import MonoIcon from "../components/MonoIcon";
import ResumeFocusSession from "../components/ResumeFocusSession";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { watchAuthAndSyncProfile } from "../utils/userProfile";

const TAB_BAR_BASE_HEIGHT = 80;
const TAB_BAR_TOP_PADDING = 6;
const TAB_BAR_BOTTOM_PADDING = 6;

let hasShownGlobalSplash = false;

function GlobalSplashOverlay({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0.88)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(wordScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(dotScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
      ]),
      Animated.delay(900),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        StyleSheet.absoluteFill,
        { 
          opacity: overlayOpacity, 
          zIndex: 2147483647, 
          elevation: 2147483647,
          top: -200,
          paddingTop: 200,
        },
      ]}
    >
      <View style={{ flex: 1, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: colors.primary, opacity: 0.12, transform: [{ scaleX: 1.6 }] }} />
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginBottom: 16, transform: [{ scale: dotScale }] }} />
        <Animated.Text style={{ fontSize: 42, fontWeight: "800", color: "#e0d8c4", letterSpacing: -1.5, opacity: wordOpacity, transform: [{ scale: wordScale }] }}>
          Monotask
        </Animated.Text>
        <Animated.Text style={{ marginTop: 10, fontSize: 13, color: colors.primaryDark, fontWeight: "500", letterSpacing: 1.5, opacity: tagOpacity }}>
          깊은 집중, 간편하게
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

function ThemedTabs() {
  const { colors, resolvedMode } = useTheme();
  const tabBarBackground = resolvedMode === "dark" ? colors.bg : colors.primary;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarActiveTintColor: resolvedMode === "dark" ? colors.primary : colors.onPrimary,
          tabBarInactiveTintColor: resolvedMode === "dark" ? colors.textFaint : "rgba(255,255,255,0.55)",
          tabBarStyle: {
            backgroundColor: tabBarBackground,
            borderTopColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : colors.primaryDark,
            borderTopWidth: 1,
            height: Platform.OS === "web" ? ("88px" as any) : TAB_BAR_BASE_HEIGHT,
            paddingTop: TAB_BAR_TOP_PADDING,
            paddingBottom: Platform.OS === "web" ? ("6px" as any) : TAB_BAR_BOTTOM_PADDING,
            zIndex: 9999,
            elevation: 20,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 0 },
          tabBarIconStyle: { marginTop: 0, marginBottom: -1 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "홈", tabBarIcon: ({ color, size }) => <MonoIcon name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="history" options={{ title: "기록", tabBarIcon: ({ color, size }) => <MonoIcon name="book" size={size} color={color} /> }} />
        <Tabs.Screen name="friends" options={{ title: "친구", tabBarIcon: ({ color, size }) => <MonoIcon name="people" size={size} color={color} /> }} />
        <Tabs.Screen name="stats" options={{ title: "통계", tabBarIcon: ({ color, size }) => <MonoIcon name="stats" size={size} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: "프로필", tabBarIcon: ({ color, size }) => <MonoIcon name="user" size={size} color={color} /> }} />
        <Tabs.Screen name="focus" options={{ href: null, tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="summary" options={{ href: null }} />
        <Tabs.Screen name="camera" options={{ href: null, tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="study-end" options={{ href: null, tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="quiz" options={{ href: null, tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="reset-password" options={{ href: null, tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="friend-profile" options={{ href: null }} />
      </Tabs>
      <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
    </>
  );
}

function ThemedRoot() {
  const { colors, resolvedMode, loading } = useTheme();
  const [showSplash, setShowSplash] = useState(!hasShownGlobalSplash);

  useEffect(() => {
    const unsub = watchAuthAndSyncProfile();
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      // Always set splash color immediately, no loading check needed
      if (showSplash) {
        document.body.style.backgroundColor = colors.surfaceDark;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.surfaceDark);
      }
    }
  }, [showSplash, colors.surfaceDark]);
  
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !themeLoaded) {
      setThemeLoaded(true);
    }
  }, [loading]);
  
  useEffect(() => {
    if (Platform.OS === "web") {
      if (!themeLoaded) return;
      if (showSplash) return;
      document.body.style.backgroundColor = colors.bg;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.bg);
    }
  }, [colors.bg, themeLoaded, showSplash]);

  function handleSplashDone() {
    hasShownGlobalSplash = true;
    setShowSplash(false);
    if (Platform.OS === "web") {
      setTimeout(() => {
        document.body.style.backgroundColor = colors.bg;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors.bg);
      }, 600);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ResumeFocusSession />
      <ThemedTabs />
      {showSplash && <GlobalSplashOverlay onDone={handleSplashDone} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}