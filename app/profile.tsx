// app/profile.tsx
import AppIcon from "../components/AppIcon";
import { useFocusEffect, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  THEME_ORDER,
  ThemeMode,
  ThemePalette,
  THEMES
} from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { auth } from "../firebase";
import { getSessions, Session } from "../utils/storage";

const MONOTASK_API_BASE_URL =
  Platform.OS === "web" ? "" : "https://monotask-lock-in.vercel.app";


// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  name: string;
  email: string;
  avatarInitials: string;
};

type ModalType =
  | "login"
  | "signup"
  | "editProfile"
  | "changePassword"
  | "notifications"
  | "theme"
  | null;

// ─── Firebase → UI User ───────────────────────────────────────────────────────

function mapFirebaseUser(u: FirebaseUser): User {
  const email = u.email ?? "user@email.com";
  const name = u.displayName ?? email.split("@")[0] ?? "User";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return { name, email, avatarInitials: initials };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatHm(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

// ─── Shared Sheet Wrapper (uses RN Modal — fixes black-tab-overlay bug) ─────

function Sheet({
  visible,
  onClose,
  children,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  colors: ThemePalette;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <View
            style={{
              width: "100%",
              alignSelf: "stretch",
              backgroundColor: colors.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 40,
              marginBottom: keyboardOpen ? 0 : 88,
              maxHeight: "88%",
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Logged Out Screen ────────────────────────────────────────────────────────

function LoggedOut({
  onLogin,
  onSignup,
  rs,
  colors,
}: {
  onLogin: () => void;
  onSignup: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const s = StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: rs(32),
    },
    iconCircle: {
      width: rs(80),
      height: rs(80),
      borderRadius: rs(40),
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(20),
    },
    title: {
      fontSize: rs(22),
      fontWeight: "800",
      color: colors.text,
      marginBottom: rs(8),
      textAlign: "center",
    },
    sub: {
      fontSize: rs(14),
      color: colors.textFaint,
      textAlign: "center",
      lineHeight: rs(22),
      marginBottom: rs(36),
    },
    loginBtn: {
      width: "100%",
      backgroundColor: colors.primary,
      borderRadius: rs(20),
      paddingVertical: rs(16),
      alignItems: "center",
      marginBottom: rs(12),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    loginBtnText: { color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) },
    signupBtn: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      paddingVertical: rs(16),
      alignItems: "center",
    },
    signupBtnText: { color: colors.textMuted, fontWeight: "700", fontSize: rs(15) },
  });

  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <AppIcon name="person-outline" size={rs(34)} color={colors.textFaint} />
      </View>
      <Text style={s.title}>로그인이 필요해요</Text>
      <Text style={s.sub}>
        로그인하면 공부 기록을{"\n"}어디서든 확인할 수 있어요
      </Text>
      <TouchableOpacity style={s.loginBtn} onPress={onLogin} activeOpacity={0.85}>
        <Text style={s.loginBtnText}>로그인</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.signupBtn} onPress={onSignup} activeOpacity={0.85}>
        <Text style={s.signupBtnText}>회원가입</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({
  visible,
  onClose,
  rs,
  colors,
  initialIsSignup = false,
}: {
  visible: boolean;
  onClose: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
  initialIsSignup?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIsSignup(initialIsSignup);
    } else {
      setEmail("");
      setPassword("");
      setError(null);
      setMessage(null);
      setIsSignup(false);
      setLoading(false);
    }
  }, [visible, initialIsSignup]);

  const cleanEmail = email.trim();
  const cleanPassword = password.trim();
  const isValid = cleanEmail.includes("@") && cleanPassword.length >= 6 && !loading;

  const getErrorMsg = (code: string) => {
    const map: Record<string, string> = {
      "auth/email-already-in-use": "이미 가입된 이메일입니다.",
      "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
      "auth/user-not-found": "존재하지 않는 계정입니다.",
      "auth/wrong-password": "비밀번호가 틀렸습니다.",
      "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
      "auth/too-many-requests": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    };
    return map[code] ?? "오류가 발생했습니다.";
  };

  const submit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isSignup)
        await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      else await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      onClose();
    } catch (e: any) {
      setError(getErrorMsg(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (isSignup) return;

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setMessage(null);
      setError("비밀번호를 재설정할 이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${MONOTASK_API_BASE_URL}/api/request-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "비밀번호 재설정 이메일을 보내지 못했습니다."
        );
      }
      setPassword("");
      setMessage("비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요.");
    } catch (e: any) {
      setError(getErrorMsg(e.code));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: rs(14),
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    fontSize: rs(15),
    color: colors.text,
    marginBottom: rs(12),
  };

  return (
    <Sheet visible={visible} onClose={onClose} colors={colors}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: "absolute", top: rs(16), right: rs(20), zIndex: 1 }}
      >
        <AppIcon name="close" size={rs(22)} color={colors.textFaint} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: rs(20),
          fontWeight: "800",
          color: colors.text,
          marginBottom: rs(4),
        }}
      >
        {isSignup ? "회원가입" : "로그인"}
      </Text>
      <Text
        style={{ fontSize: rs(13), color: colors.textFaint, marginBottom: rs(20) }}
      >
        이메일과 비밀번호를 입력하세요
      </Text>
      <TextInput
        style={inputStyle}
        placeholder="example@email.com"
        placeholderTextColor={colors.textFaint}
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
          setMessage(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={inputStyle}
        placeholder="••••••••"
        placeholderTextColor={colors.textFaint}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
          setMessage(null);
        }}
        secureTextEntry
      />
      {error && (
        <Text
          style={{
            color: colors.danger,
            fontSize: rs(12),
            textAlign: "center",
            marginBottom: rs(8),
          }}
        >
          {error}
        </Text>
      )}

      {message && (
        <Text
          style={{
            color: colors.primary,
            fontSize: rs(12),
            textAlign: "center",
            marginBottom: rs(8),
            lineHeight: rs(18),
          }}
        >
          {message}
        </Text>
      )}
      <TouchableOpacity
        style={{
          backgroundColor: isValid ? colors.primary : colors.border,
          borderRadius: rs(20),
          paddingVertical: rs(16),
          alignItems: "center",
          marginTop: rs(4),
        }}
        disabled={!isValid}
        onPress={submit}
        activeOpacity={0.85}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) }}>
          {loading ? "..." : isSignup ? "회원가입하기" : "로그인하기"}
        </Text>
      </TouchableOpacity>
      {!isSignup && (
        <TouchableOpacity
          onPress={handlePasswordReset}
          disabled={loading}
          style={{ alignItems: "center", marginTop: rs(14) }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: rs(13), color: colors.primary, fontWeight: "700" }}>
            비밀번호를 잊으셨나요?
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => {
          setIsSignup(!isSignup);
          setError(null);
          setMessage(null);
        }}
        style={{ alignItems: "center", marginTop: rs(14) }}
      >
        <Text style={{ fontSize: rs(13), color: colors.textMuted }}>
          {isSignup ? "이미 계정이 있어요 → 로그인" : "계정이 없어요 → 회원가입"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  currentName,
  onSaved,
  rs,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  currentName: string;
  onSaved: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) setName(currentName);
  }, [visible, currentName]);

  const save = async () => {
    if (!name.trim() || !auth.currentUser) return;
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      onSaved();
      onClose();
    } catch {
      Alert.alert("오류", "프로필 업데이트에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} colors={colors}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: "absolute", top: rs(16), right: rs(20), zIndex: 1 }}
      >
        <AppIcon name="close" size={rs(22)} color={colors.textFaint} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: rs(20),
          fontWeight: "800",
          color: colors.text,
          marginBottom: rs(4),
        }}
      >
        프로필 수정
      </Text>
      <Text
        style={{ fontSize: rs(13), color: colors.textFaint, marginBottom: rs(20) }}
      >
        표시 이름을 변경하세요
      </Text>
      <Text
        style={{
          fontSize: rs(12),
          color: colors.textMuted,
          fontWeight: "600",
          marginBottom: rs(6),
        }}
      >
        이름
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          borderRadius: rs(14),
          paddingHorizontal: rs(16),
          paddingVertical: rs(14),
          fontSize: rs(15),
          color: colors.text,
          marginBottom: rs(20),
        }}
        value={name}
        onChangeText={setName}
        placeholder="홍길동"
        placeholderTextColor={colors.textFaint}
      />
      <TouchableOpacity
        style={{
          backgroundColor: name.trim() ? colors.primary : colors.border,
          borderRadius: rs(20),
          paddingVertical: rs(16),
          alignItems: "center",
        }}
        disabled={!name.trim()}
        onPress={save}
        activeOpacity={0.85}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) }}>
          {loading ? "저장 중..." : "저장하기"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

// ─── Change Password Modal ────────────────────────────────────────────────────

function ChangePasswordModal({
  visible,
  onClose,
  rs,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const isValid = current.length >= 6 && next.length >= 6 && next === confirm;

  const save = async () => {
    if (!isValid || !auth.currentUser?.email) return;
    setLoading(true);
    setError(null);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        current
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, next);
      Alert.alert("완료", "비밀번호가 변경되었습니다.");
      onClose();
    } catch (e: any) {
      if (e.code === "auth/wrong-password")
        setError("현재 비밀번호가 틀렸습니다.");
      else setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };


  const inputStyle = {
    backgroundColor: colors.surface,
    borderRadius: rs(14),
    paddingHorizontal: rs(16),
    paddingVertical: rs(14),
    fontSize: rs(15),
    color: colors.text,
    marginBottom: rs(12),
  };
  const labelStyle = {
    fontSize: rs(12),
    color: colors.textMuted,
    fontWeight: "600" as const,
    marginBottom: rs(6),
  };

  return (
    <Sheet visible={visible} onClose={onClose} colors={colors}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: "absolute", top: rs(16), right: rs(20), zIndex: 1 }}
      >
        <AppIcon name="close" size={rs(22)} color={colors.textFaint} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: rs(20),
          fontWeight: "800",
          color: colors.text,
          marginBottom: rs(4),
        }}
      >
        비밀번호 변경
      </Text>
      <Text
        style={{ fontSize: rs(13), color: colors.textFaint, marginBottom: rs(20) }}
      >
        현재 비밀번호를 먼저 입력하세요
      </Text>
      <Text style={labelStyle}>현재 비밀번호</Text>
      <TextInput
        style={inputStyle}
        placeholder="••••••••"
        placeholderTextColor={colors.textFaint}
        value={current}
        onChangeText={(t) => {
          setCurrent(t);
          setError(null);
        }}
        secureTextEntry
      />
      <Text style={labelStyle}>새 비밀번호</Text>
      <TextInput
        style={inputStyle}
        placeholder="••••••••"
        placeholderTextColor={colors.textFaint}
        value={next}
        onChangeText={(t) => {
          setNext(t);
          setError(null);
        }}
        secureTextEntry
      />
      <Text style={labelStyle}>새 비밀번호 확인</Text>
      <TextInput
        style={[
          inputStyle,
          confirm.length > 0 &&
          next !== confirm && {
            borderWidth: 1,
            borderColor: colors.danger,
          },
        ]}
        placeholder="••••••••"
        placeholderTextColor={colors.textFaint}
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setError(null);
        }}
        secureTextEntry
      />
      {confirm.length > 0 && next !== confirm && (
        <Text style={{ color: colors.danger, fontSize: rs(12), marginBottom: rs(8) }}>
          비밀번호가 일치하지 않습니다.
        </Text>
      )}
      {error && (
        <Text style={{ color: colors.danger, fontSize: rs(12), marginBottom: rs(8) }}>
          {error}
        </Text>
      )}
      <TouchableOpacity
        style={{
          backgroundColor: isValid ? colors.primary : colors.border,
          borderRadius: rs(20),
          paddingVertical: rs(16),
          alignItems: "center",
          marginTop: rs(4),
        }}
        disabled={!isValid}
        onPress={save}
        activeOpacity={0.85}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "800", fontSize: rs(15) }}>
          {loading ? "변경 중..." : "변경하기"}
        </Text>
      </TouchableOpacity>
    </Sheet>
  );
}

// ─── Notifications Modal ──────────────────────────────────────────────────────

function NotificationsModal({
  visible,
  onClose,
  rs,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakReminder, setStreakReminder] = useState(true);
  const [reviewReminder, setReviewReminder] = useState(false);

  const rows = [
    {
      label: "매일 공부 알림",
      sub: "매일 오전 9시에 알려드려요",
      value: dailyReminder,
      onToggle: setDailyReminder,
    },
    {
      label: "연속 기록 알림",
      sub: "스트릭이 끊길 것 같으면 알려드려요",
      value: streakReminder,
      onToggle: setStreakReminder,
    },
    {
      label: "복습 노트 알림",
      sub: "미작성 노트가 있으면 알려드려요",
      value: reviewReminder,
      onToggle: setReviewReminder,
    },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} colors={colors}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: "absolute", top: rs(16), right: rs(20), zIndex: 1 }}
      >
        <AppIcon name="close" size={rs(22)} color={colors.textFaint} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: rs(20),
          fontWeight: "800",
          color: colors.text,
          marginBottom: rs(4),
        }}
      >
        알림 설정
      </Text>
      <Text
        style={{ fontSize: rs(13), color: colors.textFaint, marginBottom: rs(24) }}
      >
        받고 싶은 알림을 선택하세요
      </Text>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: rs(14),
            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
            borderBottomColor: colors.borderSoft,
          }}
        >
          <View style={{ flex: 1, gap: rs(2) }}>
            <Text style={{ fontSize: rs(14), fontWeight: "700", color: colors.text }}>
              {row.label}
            </Text>
            <Text style={{ fontSize: rs(12), color: colors.textFaint }}>
              {row.sub}
            </Text>
          </View>
          <Switch
            value={row.value}
            onValueChange={row.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </Sheet>
  );
}

// ─── Theme Picker Modal ───────────────────────────────────────────────────────

function ThemeModal({
  visible,
  onClose,
  rs,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  const { themeKey, themeMode, resolvedMode, setThemeKey, setThemeMode } = useTheme();

  const modes: { key: ThemeMode; label: string; icon: any }[] = [
    { key: "light", label: "라이트", icon: "sunny-outline" },
    { key: "dark", label: "다크", icon: "moon-outline" },
    { key: "system", label: "시스템", icon: "phone-portrait-outline" },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} colors={colors}>
      <TouchableOpacity
        onPress={onClose}
        style={{ position: "absolute", top: rs(16), right: rs(20), zIndex: 1 }}
      >
        <AppIcon name="close" size={rs(22)} color={colors.textFaint} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: rs(20),
          fontWeight: "800",
          color: colors.text,
          marginBottom: rs(4),
        }}
      >
        테마 설정
      </Text>
      <Text
        style={{ fontSize: rs(13), color: colors.textFaint, marginBottom: rs(20) }}
      >
        원하는 색상과 모드를 선택하세요
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Mode segmented control ── */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: rs(14),
            padding: rs(4),
            marginBottom: rs(24),
          }}
        >
          {modes.map((m) => {
            const selected = themeMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setThemeMode(m.key)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: rs(6),
                  paddingVertical: rs(10),
                  borderRadius: rs(11),
                  backgroundColor: selected ? colors.bg : "transparent",
                }}
              >
                <AppIcon
                  name={m.icon}
                  size={rs(14)}
                  color={selected ? colors.primary : colors.textFaint}
                />
                <Text
                  style={{
                    fontSize: rs(13),
                    fontWeight: "700",
                    color: selected ? colors.text : colors.textFaint,
                  }}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Theme grid (2 columns) ── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: 'space-between',
            gap: rs(10),
          }}
        >
          {THEME_ORDER.map((key) => {
            const t = THEMES[key];
            const preview = resolvedMode === "dark" ? t.dark : t.light;
            const selected = themeKey === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setThemeKey(key)}
                activeOpacity={0.85}
                style={{
                  width: "47.5%",
                  borderRadius: rs(18),
                  backgroundColor: preview.bg,
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : preview.border,
                  padding: rs(14),
                  gap: rs(10),
                }}
              >
                <View style={{ flexDirection: "row", gap: rs(6) }}>
                  <View
                    style={{
                      width: rs(28),
                      height: rs(28),
                      borderRadius: rs(8),
                      backgroundColor: preview.primary,
                    }}
                  />
                  <View
                    style={{
                      width: rs(20),
                      height: rs(28),
                      borderRadius: rs(7),
                      backgroundColor: preview.surface,
                      borderWidth: 1,
                      borderColor: preview.borderSoft,
                    }}
                  />
                  <View
                    style={{
                      width: rs(16),
                      height: rs(28),
                      borderRadius: rs(6),
                      backgroundColor: preview.surfaceAlt,
                    }}
                  />
                  <View style={{ flex: 1 }} />
                  {selected && (
                    <View
                      style={{
                        width: rs(22),
                        height: rs(22),
                        borderRadius: rs(11),
                        backgroundColor: preview.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AppIcon
                        name="checkmark"
                        size={rs(13)}
                        color={preview.onPrimary}
                      />
                    </View>
                  )}
                </View>

                <Text
                  style={{
                    fontSize: rs(14),
                    fontWeight: "700",
                    color: preview.text,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: rs(8) }} />
      </ScrollView>
    </Sheet>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  value,
  green,
  rs,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  green?: boolean;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: green ? colors.primary : colors.surface,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
        gap: 4,
      }}
    >
      <AppIcon
        name={icon as any}
        size={rs(14)}
        color={green ? "rgba(244,241,234,0.85)" : colors.primary}
      />
      <Text
        style={{
          fontSize: rs(17),
          fontWeight: "800",
          color: green ? colors.onPrimary : colors.text,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: rs(10),
          color: green ? "rgba(244,241,234,0.7)" : colors.textFaint,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Menu Row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  onPress,
  destructive,
  rs,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  rs: (n: number) => number;
  colors: ThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: rs(14),
        paddingVertical: rs(15),
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSoft,
      }}
    >
      <AppIcon
        name={icon as any}
        size={rs(15)}
        color={destructive ? colors.danger : colors.primary}
        style={{ width: rs(20) }}
      />
      <Text
        style={{
          flex: 1,
          fontSize: rs(14),
          color: destructive ? colors.danger : colors.text,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      {!destructive && (
        <AppIcon name="chevron-forward" size={rs(14)} color={colors.border} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const scale = width / 390;
  const rs = (n: number) => Math.round(n * scale);
  const router = useRouter();
  const { colors } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? mapFirebaseUser(u) : null);
    });
    return unsub;
  }, []);

  const refreshUser = () => {
    if (auth.currentUser) setUser(mapFirebaseUser(auth.currentUser));
  };

  const load = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stats = useMemo(() => {
    const todayTs = startOfDay(Date.now());
    const dailyMap = new Map<number, number>();
    let totalMs = 0;
    for (const s of sessions) {
      const key = startOfDay(s.startTime);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.durationMs);
      totalMs += s.durationMs;
    }
    let streak = 0;
    let check = todayTs;
    while (dailyMap.has(check)) {
      streak++;
      check -= 86400000;
    }
    const todayMs = dailyMap.get(todayTs) ?? 0;
    return { totalMs, streak, todayMs, totalDays: dailyMap.size };
  }, [sessions]);

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: rs(48) },
    header: {
      paddingHorizontal: rs(24),
      paddingTop: rs(20),
      paddingBottom: rs(16),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: rs(22),
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.5,
    },
    avatarSection: {
      alignItems: "center",
      paddingTop: rs(12),
      paddingBottom: rs(28),
    },
    avatarCircle: {
      width: rs(88),
      height: rs(88),
      borderRadius: rs(44),
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: rs(14),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 6,
    },
    avatarText: { fontSize: rs(30), fontWeight: "800", color: colors.onPrimary },
    userName: {
      fontSize: rs(20),
      fontWeight: "800",
      color: colors.text,
      marginBottom: rs(4),
    },
    userEmail: { fontSize: rs(13), color: colors.textFaint },
    statsRow: {
      flexDirection: "row",
      gap: rs(10),
      paddingHorizontal: rs(24),
      marginBottom: rs(16),
    },
    sectionCard: {
      marginHorizontal: rs(24),
      marginBottom: rs(16),
      backgroundColor: colors.surface,
      borderRadius: rs(20),
      paddingHorizontal: rs(20),
      paddingTop: rs(6),
      paddingBottom: rs(4),
    },
    sectionLabel: {
      fontSize: rs(11),
      color: colors.textFaint,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingTop: rs(16),
      paddingBottom: rs(4),
    },
  });

  return (
    <SafeAreaView style={s.safe}
      edges={Platform.OS === "web" ? [] : ["top"]}
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>프로필</Text>
        {user && (
          <TouchableOpacity onPress={() => signOut(auth)}>
            <AppIcon name="log-out-outline" size={rs(20)} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      {!user ? (
        <LoggedOut
          rs={rs}
          colors={colors}
          onLogin={() => setActiveModal("login")}
          onSignup={() => setActiveModal("signup")}
        />
      ) : (
        <Animated.ScrollView
          style={[s.scroll, { opacity: fadeAnim }]}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.avatarSection}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{user.avatarInitials}</Text>
            </View>
            <Text style={s.userName}>{user.name}</Text>
            <Text style={s.userEmail}>{user.email}</Text>
          </View>

          <View style={s.statsRow}>
            <StatPill
              icon="fire"
              label="연속"
              value={`${stats.streak}일`}
              green
              rs={rs}
              colors={colors}
            />
            <StatPill
              icon="clock-o"
              label="오늘"
              value={formatHm(stats.todayMs)}
              rs={rs}
              colors={colors}
            />
          </View>
          <View style={s.statsRow}>
            <StatPill
              icon="calendar-check-o"
              label="공부한 날"
              value={`${stats.totalDays}일`}
              rs={rs}
              colors={colors}
            />
            <StatPill
              icon="book"
              label="누적 시간"
              value={formatHm(stats.totalMs)}
              rs={rs}
              colors={colors}
            />
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>계정</Text>
            <MenuRow
              icon="user-o"
              label="프로필 수정"
              onPress={() => setActiveModal("editProfile")}
              rs={rs}
              colors={colors}
            />
            <MenuRow
              icon="lock"
              label="비밀번호 변경"
              onPress={() => setActiveModal("changePassword")}
              rs={rs}
              colors={colors}
            />
            <MenuRow
              icon="bell-o"
              label="알림 설정"
              onPress={() => setActiveModal("notifications")}
              rs={rs}
              colors={colors}
            />
            <MenuRow
              icon="paint-brush"
              label="테마 설정"
              onPress={() => setActiveModal("theme")}
              rs={rs}
              colors={colors}
            />
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>앱</Text>
            <MenuRow
              icon="bar-chart"
              label="통계 보기"
              onPress={() => router.push("/stats")}
              rs={rs}
              colors={colors}
            />
            <MenuRow
              icon="history"
              label="공부 기록"
              onPress={() => router.push("/history")}
              rs={rs}
              colors={colors}
            />
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionLabel}>기타</Text>
            <MenuRow
              icon="sign-out"
              label="로그아웃"
              onPress={() => signOut(auth)}
              destructive
              rs={rs}
              colors={colors}
            />
          </View>
        </Animated.ScrollView>
      )}
      <LoginModal
        visible={activeModal === "login" || activeModal === "signup"}
        onClose={() => setActiveModal(null)}
        rs={rs}
        colors={colors}
        initialIsSignup={activeModal === "signup"}
      />
      <EditProfileModal
        visible={activeModal === "editProfile"}
        onClose={() => setActiveModal(null)}
        currentName={user?.name ?? ""}
        onSaved={refreshUser}
        rs={rs}
        colors={colors}
      />
      <ChangePasswordModal
        visible={activeModal === "changePassword"}
        onClose={() => setActiveModal(null)}
        rs={rs}
        colors={colors}
      />
      <NotificationsModal
        visible={activeModal === "notifications"}
        onClose={() => setActiveModal(null)}
        rs={rs}
        colors={colors}
      />
      <ThemeModal
        visible={activeModal === "theme"}
        onClose={() => setActiveModal(null)}
        rs={rs}
        colors={colors}
      />
    </SafeAreaView>
  );
}
