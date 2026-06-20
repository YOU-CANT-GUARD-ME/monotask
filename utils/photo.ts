// utils/photos.ts
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "../firebase";

/**
 * Uploads a local photo (file:// URI) to Firebase Storage under the current
 * user's folder and returns a permanent https download URL.
 *
 * If the uri is already an https URL (i.e. already uploaded), it's returned
 * as-is. If there's no logged-in user or no uri, returns the original uri.
 */
export async function uploadPhoto(
  localUri: string,
  sessionId: string
): Promise<string> {
  if (!localUri) return "";

  // Already a remote URL — nothing to upload
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri;
  }

  const user = auth.currentUser;
  if (!user) {
    console.warn("uploadPhoto: no logged-in user, keeping local uri");
    return localUri;
  }

  try {
    // Fetch the local file as a blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Derive a file extension from the uri
    const ext = localUri.split(".").pop()?.toLowerCase() || "jpg";
    const path = `users/${user.uid}/sessions/${sessionId}.${ext}`;

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (e) {
    console.warn("uploadPhoto failed, keeping local uri:", e);
    // Fall back to local uri so the session still saves
    return localUri;
  }
}

/**
 * Uploads multiple photos in parallel. Returns an array of URLs (or local URIs
 * on failure). Order is preserved.
 */
export async function uploadPhotos(
  localUris: string[],
  sessionId: string
): Promise<string[]> {
  if (!localUris.length) return [];
  return Promise.all(
    localUris.map((uri, idx) => uploadPhoto(uri, `${sessionId}_${idx}`))
  );
}