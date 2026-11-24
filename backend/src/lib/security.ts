import bcrypt from "bcryptjs";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export const DEFAULT_ADMIN_EMAIL = "adnansamir.dev@gmail.com";
export const ACCESS_COOKIE = "devnote_access";
export const REFRESH_COOKIE = "devnote_refresh";

// Access token: 15 minutes; Refresh token: 30 days
export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

// Account lockout policy
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function getClientIp(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isLocalDevUrl(url: string): boolean {
  return (
    url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")
  );
}

/**
 * Persistent D1-backed rate limiter across Workers isolates.
 */
export async function checkRateLimit(
  db: DrizzleD1Database<typeof schema>,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .get();

  if (existing) {
    if (existing.blockedUntil && existing.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((existing.blockedUntil - now) / 1000),
      };
    }

    if (now - existing.windowStart < windowMs) {
      const nextCount = existing.count + 1;
      if (nextCount > maxRequests) {
        const blockedUntil = existing.windowStart + windowMs;
        await db
          .update(schema.rateLimits)
          .set({ count: nextCount, blockedUntil })
          .where(eq(schema.rateLimits.key, key));
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
        };
      }

      await db
        .update(schema.rateLimits)
        .set({ count: nextCount })
        .where(eq(schema.rateLimits.key, key));
      return { allowed: true, retryAfterSec: 0 };
    }

    // Window expired — reset
    await db
      .update(schema.rateLimits)
      .set({ count: 1, windowStart: now, blockedUntil: null })
      .where(eq(schema.rateLimits.key, key));
    return { allowed: true, retryAfterSec: 0 };
  }

  await db.insert(schema.rateLimits).values({
    key,
    count: 1,
    windowStart: now,
    blockedUntil: null,
  });
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Verify Origin header on state-changing requests to defend against CSRF.
 */
export function isValidCsrfOrigin(c: Context): boolean {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  const origin = c.req.header("Origin");
  if (!origin) {
    // Allow non-browser / same-origin requests without Origin only if Sec-Fetch-Site is not cross-site
    const fetchSite = c.req.header("Sec-Fetch-Site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return false;
    }
    return true;
  }

  const reqOrigin = new URL(c.req.url).origin;
  if (origin === reqOrigin) return true;

  // Allow localhost frontend in local dev
  if (
    isLocalDevUrl(c.req.url) &&
    (origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:"))
  ) {
    return true;
  }

  return false;
}
