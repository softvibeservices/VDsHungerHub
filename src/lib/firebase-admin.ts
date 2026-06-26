import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let _auth: Auth | null = null;

/**
 * Lazy getter — only initialises Firebase Admin when first called at runtime,
 * not at module import time (which would fail during `next build` with placeholder keys).
 */
export function getFirebaseAdmin(): Auth {
  if (_auth) return _auth;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        // Env vars sometimes escape the newlines — restore them, and strip surrounding double quotes on Vercel
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
      }),
    });
  }

  _auth = getAuth();
  return _auth;
}
