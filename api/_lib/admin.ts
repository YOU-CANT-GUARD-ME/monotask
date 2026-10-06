/// <reference types="node" />
// api/_lib/admin.ts
// Shared server helpers for the API routes. Files under api/_lib are not
// deployed as routes by Vercel because the folder name starts with "_".

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function ensureApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is missing");
    }

    const serviceAccount = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    );

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

export function adminAuth() {
  ensureApp();
  return getAuth();
}

export function adminDb() {
  ensureApp();
  return getFirestore();
}

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>"
// and returns the caller's uid.
export async function requireUser(req: any): Promise<string> {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    throw new HttpError(401, "로그인이 필요해요.");
  }

  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new HttpError(401, "로그인이 만료되었어요. 다시 로그인해주세요.");
  }
}

// Fixed-window rate limit stored in Firestore (rateLimits collection, which
// clients cannot read or write). Throws 429 once `limit` is used up.
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(key.replace(/\//g, "_"));
  const now = Date.now();

  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (!data || now - data.windowStart >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1, expiresAt: now + windowMs });
      return true;
    }

    if (data.count >= limit) return false;

    tx.update(ref, { count: data.count + 1 });
    return true;
  });

  if (!allowed) {
    throw new HttpError(429, "요청이 너무 많아요. 잠시 후 다시 시도해주세요.");
  }
}

export function clientIp(req: any): string {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || "unknown";
}

export function sendError(res: any, error: any, fallback: string) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error?.message || fallback });
}
