import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

const USER_JWT_SECRET = process.env.USER_JWT_SECRET!;
const USER_JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN ?? "180d";

export interface UserTokenPayload {
  sub: string;       // userId (User.id from DB)
  number: string;    // 10-digit mobile number
  name: string;
  companyId: string;
  companyName: string;
  role: "USER";
  iat?: number;
  exp?: number;
}

export function signUserToken(
  payload: Omit<UserTokenPayload, "role">
): string {
  return jwt.sign(
    { ...payload, role: "USER" },
    USER_JWT_SECRET,
    { expiresIn: USER_JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, USER_JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): UserTokenPayload | null {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;
  return verifyUserToken(token);
}

/**
 * Build a deterministic device fingerprint from browser signals.
 * Called client-side; result is sent to server with each auth request.
 * NOT a security control — only used for UX session persistence.
 */
export async function getDeviceHash(): Promise<string> {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface DecodedHeader {
  alg: string;
  kid: string;
  typ: string;
}

export interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  auth_time: number;
  phone_number?: string;
  [key: string]: any;
}

let googlePublicKeysCache: Record<string, string> | null = null;
let googlePublicKeysCacheExpiry = 0;

async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googlePublicKeysCache && now < googlePublicKeysCacheExpiry) {
    return googlePublicKeysCache;
  }

  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) {
    throw new Error("Failed to fetch Firebase public keys from Google");
  }

  const cacheControl = res.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  const keys = await res.json();
  googlePublicKeysCache = keys;
  googlePublicKeysCacheExpiry = now + maxAge * 1000;

  return keys;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string
): Promise<FirebaseTokenPayload> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header) {
    throw new Error("Malformed JWT token");
  }

  const header = decoded.header as DecodedHeader;
  if (!header.kid) {
    throw new Error("Firebase ID token missing 'kid' header claim");
  }

  const publicKeys = await fetchGooglePublicKeys();
  const publicKey = publicKeys[header.kid];
  if (!publicKey) {
    throw new Error("Firebase ID token signed with unknown kid");
  }

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
  }) as FirebaseTokenPayload;

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Invalid token issuer: expected ${expectedIssuer}, got ${payload.iss}`);
  }

  if (payload.aud !== projectId) {
    throw new Error(`Invalid token audience: expected ${projectId}, got ${payload.aud}`);
  }

  if (!payload.sub) {
    throw new Error("Firebase ID token subject claim is empty");
  }

  return payload;
}
