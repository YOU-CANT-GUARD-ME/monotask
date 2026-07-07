// utils/photo.ts
import * as ImageManipulator from "expo-image-manipulator";

export async function uploadPhoto(
  localUri: string,
  sessionId: string
): Promise<string> {
  if (!localUri) return "";

  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri;
  }

  if (localUri.startsWith("data:")) {
    return localUri;
  }

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 400 } }], // smaller width
      {
        compress: 0.4, // more aggressive compression
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      console.warn("uploadPhoto: no base64 returned");
      return localUri;
    }

    // Check size — if still too large, compress further
    const base64 = manipulated.base64;
    const sizeKB = (base64.length * 3) / 4 / 1024;
    console.log(`Photo size: ${Math.round(sizeKB)}KB`);

    if (sizeKB > 200) {
      // Try again with even more compression
      const smaller = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 300 } }],
        { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return `data:image/jpeg;base64,${smaller.base64}`;
    }

    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.warn("uploadPhoto failed:", e);
    return localUri;
  }
}

export async function uploadPhotos(
  localUris: string[],
  sessionId: string
): Promise<string[]> {
  if (!localUris.length) return [];
  return Promise.all(
    localUris.map((uri, idx) => uploadPhoto(uri, `${sessionId}_${idx}`))
  );
}