/**
 * Cloudflare Pages Functions 共用工具：JSON 响应、错误处理、身份验证
 */

export interface Env {
  VOCAB_KV: KVNamespace;
  SESSION_SECRET: string;
  ADMIN_INITIAL_PASSWORD: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface SessionPayload {
  userId: number;
  role: "admin" | "user";
  exp: number;
}

export interface PublicUser {
  id: number;
  username: string;
  role: "admin" | "user";
}

export function jsonOk<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data, error: null };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 400): Response {
  const body: ApiResponse<never> = {
    success: false,
    data: null,
    error: message,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function parseBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// ── HMAC session token ──────────────────────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signToken(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const header = base64url(
    enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const sigInput = `${header}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sigInput));
  return `${sigInput}.${base64url(sig)}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payloadB64, sigB64] = parts;
  const sigInput = `${header}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sigBytes = base64urlDecode(sigB64);
  const enc = new TextEncoder();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    enc.encode(sigInput),
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64)),
    ) as SessionPayload;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticate(
  req: Request,
  secret: string,
): Promise<SessionPayload | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7), secret);
}

// ── PBKDF2 password hashing ────────────────────────────────────────────────

export async function hashPassword(
  password: string,
  salt?: string,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const saltBytes = salt
    ? Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...saltBytes));
  const iterations = 100_000;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hashBuf = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return { hash: base64url(hashBuf), salt: saltB64, iterations };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}
