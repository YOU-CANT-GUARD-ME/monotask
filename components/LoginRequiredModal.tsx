import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

type LoginRequiredModalProps = {
  visible: boolean;
  onClose: () => void;
  onGoProfile: () => void;
};

export default function LoginRequiredModal({
  visible,
  onClose,
  onGoProfile,
}: LoginRequiredModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>로그인이 필요해요</Text>

          <Text style={styles.body}>
            집중 세션을 저장하려면 먼저 로그인해주세요.{"\n"}
            프로필 화면에서 로그인할 수 있어요.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={onGoProfile}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmButtonText}>프로필로 가기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#F4F1EA",
    borderRadius: 24,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#26221A",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#5F654F",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(135,152,106,0.16)",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6A7A52",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F4F1EA",
  },
});
