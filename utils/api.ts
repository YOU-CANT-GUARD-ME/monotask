// utils/api.ts
// Calls our own Vercel API routes, sending the Firebase login token so the
// server knows who is asking.

import { Platform } from "react-native";
import { auth } from "../firebase";

export const MONOTASK_API_BASE_URL =
  Platform.OS === "web" ? "" : "https://monotask-lock-in.vercel.app";

export async function apiPost<T = any>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  const token = await user.getIdToken();

  const response = await fetch(`${MONOTASK_API_BASE_URL}${path}`, {
    method: "POST",
    signal: options.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : JSON.stringify(data?.error || data);
    throw new Error(`API Error ${response.status}: ${message}`);
  }

  return data as T;
}
