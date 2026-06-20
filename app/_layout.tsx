// app/_layout.tsx
import { FontAwesome } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";

function ThemedTabs() {
  const { colors, resolvedMode } = useTheme();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: resolvedMode === "dark" ? colors.primary : colors.onPrimary,
          tabBarInactiveTintColor:
            resolvedMode === "dark"
              ? colors.textFaint
              : "rgba(255,255,255,0.55)",
            tabBarStyle: {
              backgroundColor: resolvedMode === "dark" ? colors.bg : colors.primary,
              borderTopColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : colors.primaryDark,
              borderTopWidth: 1,
              height: 88,
              paddingBottom: 28,
              paddingTop: 10,
            },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "홈",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "기록",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "통계",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="bar-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "프로필",
            tabBarIcon: ({ color, size }) => (
              <FontAwesome name="user" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
        <Tabs.Screen name="summary" options={{ href: null }} />
        <Tabs.Screen
          name="camera"
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
        <Tabs.Screen name="study-end" options={{ href: null }} />
        <Tabs.Screen
          name="quiz"
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
      </Tabs>
      <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedTabs />
    </ThemeProvider>
  );
}