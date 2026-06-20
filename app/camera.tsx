import { Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MAX_PHOTOS = 6;

function parsePhotoUris(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const params = useLocalSearchParams<{
    noteText?: string;
    durationMs?: string;
    startTime?: string;
    existingPhotoUris?: string;
  }>();

  const existing = parsePhotoUris(params.existingPhotoUris);
  const remaining = Math.max(0, MAX_PHOTOS - existing.length);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  function returnWithPhotos(newUris: string[]) {
    const merged = [...existing, ...newUris].slice(0, MAX_PHOTOS);
    router.replace({
      pathname: "/study-end",
      params: {
        photoUris: JSON.stringify(merged),
        noteText: params.noteText ?? "",
        durationMs: params.durationMs ?? "0",
        startTime: params.startTime ?? new Date().toISOString(),
      },
    });
  }

  async function takePhoto() {
    if (!cameraRef.current || remaining === 0) return;
    const photo = await cameraRef.current.takePictureAsync();
    returnWithPhotos([photo.uri]);
  }

  async function pickFromGallery() {
    if (remaining === 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri);
      returnWithPhotos(uris);
    }
  }

  function handleClose() {
    // Return without changing anything — pass existing photos back
    router.replace({
      pathname: "/study-end",
      params: {
        photoUris: JSON.stringify(existing),
        noteText: params.noteText ?? "",
        durationMs: params.durationMs ?? "0",
        startTime: params.startTime ?? new Date().toISOString(),
      },
    });
  }

  if (hasPermission === null)
    return <View style={styles.center}><Text style={styles.centerText}>Requesting permission...</Text></View>;
  if (hasPermission === false)
    return <View style={styles.center}><Text style={styles.centerText}>No access to camera</Text></View>;

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />

      <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* Counter pill */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {existing.length} / {MAX_PHOTOS}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.galleryBtn, remaining === 0 && styles.btnDisabled]}
          onPress={pickFromGallery}
          activeOpacity={0.8}
          disabled={remaining === 0}
        >
          <Text style={styles.galleryIcon}>⊞</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, remaining === 0 && styles.btnDisabled]}
          onPress={takePhoto}
          activeOpacity={0.8}
          disabled={remaining === 0}
        >
          <View style={styles.innerCircle} />
        </TouchableOpacity>

        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },

  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: "white", fontSize: 18, fontWeight: "600" },

  counter: {
    position: "absolute",
    top: 60,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: { color: "white", fontSize: 13, fontWeight: "700" },

  controls: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },

  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  galleryIcon: { fontSize: 26, color: "white" },

  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },

  btnDisabled: { opacity: 0.35 },

  spacer: { width: 56 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "black" },
  centerText: { color: "white" },
});