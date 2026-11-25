import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import * as schema from "./db/schema";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SEC,
  checkRateLimit,
  DEFAULT_ADMIN_EMAIL,
  generateOpaqueToken,
  getClientIp,
  hashPassword,
  isLocalDevUrl,
  isValidCsrfOrigin,
  LOCKOUT_MS,
  MAX_FAILED_LOGINS,
  REFRESH_COOKIE,
  REFRESH_TTL_SEC,
  sha256Hex,
  verifyPassword,
} from "./lib/security";

import {
  aiChatRequestSchema,
  aiExecuteRequestSchema,
  executeAiActions,
  runAiChat,
} from "./lib/ai";
import { handleMcpJsonRpc } from "./lib/mcp";
import {
  buildNewDeviceLoginEmail,
  buildPasswordResetEmail,
  buildRenewalReminderEmail,
  buildSignupVerificationEmail,
  generateSixDigitCode,
  maskEmail,
  type RenewalAlertItem,
  sendMail,
} from "./lib/mailer";

export type Bindings = {
  DB: D1Database;
  AI: Ai;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
  BYZO_MAIL_API_URL?: string;
  BYZO_MAIL_API_KEY?: string;
};

const DEVICE_COOKIE = "devnote_device";
const DEVICE_TTL_SEC = 90 * 24 * 60 * 60;
const OTP_EXPIRY_MS = 15 * 60 * 1000;
const DEVICE_OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  emailVerified: boolean;
  createdAt: number;
}

type Variables = {
  user: PublicUser;
  authMethod: "cookie" | "api_key";
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Dummy bcrypt hash used to equalize response timing when an account doesn't exist
const DUMMY_BCRYPT_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8d2J6C6J/8uP3oU5hG6q6E0z9K9r6W";

function toPublicUser(u: schema.User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role === "admin" ? "admin" : "user",
    status: u.status === "suspended" ? "suspended" : "active",
    emailVerified: u.emailVerified === 1,
    createdAt: u.createdAt,
  };
}

function getJwtSecret(c: Context<{ Bindings: Bindings; Variables: Variables }>): string {
  return c.env.JWT_SECRET || "devnote-fallback-local-jwt-secret";
}

async function issueAuthCookies(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  user: PublicUser,
  refreshToken: string
) {
  const isDev = isLocalDevUrl(c.req.url);
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC;
  const accessToken = await sign(
    { sub: user.id, role: user.role, exp },
    getJwtSecret(c),
    "HS256"
  );

  setCookie(c, ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "Lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });

  setCookie(c, REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "Lax",
    path: "/",
    maxAge: REFRESH_TTL_SEC,
  });
}

function clearAuthCookies(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const isDev = isLocalDevUrl(c.req.url);
  deleteCookie(c, ACCESS_COOKIE, {
    path: "/",
    secure: !isDev,
    sameSite: "Lax",
  });
  deleteCookie(c, REFRESH_COOKIE, {
    path: "/",
    secure: !isDev,
    sameSite: "Lax",
  });
}

// 1. Security Headers on all API responses
app.use("/api/*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
});

// 2. Development CORS support for localhost:3000
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (
        !origin ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return origin || "http://localhost:3000";
      }
      return "";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Set-Cookie"],
  })
);

// 3. CSRF Origin check on state-changing cookie-authenticated API requests
app.use("/api/*", async (c, next) => {
  const authHeader = c.req.header("Authorization") || "";
  const isBearer = authHeader.startsWith("Bearer dn_live_");
  if (!isBearer && !isValidCsrfOrigin(c)) {
    return c.json({ error: "Forbidden origin" }, 403);
  }
  await next();
});

// Strict Zod schemas (reject unknown fields)
const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email is required").max(160),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must be at least 3 characters")
      .max(32, "Username must be at most 32 characters")
      .regex(
        /^[a-z0-9_-]+$/,
        "Username may only contain lowercase letters, numbers, hyphens, and underscores"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
  })
  .strict();

const loginSchema = z
  .object({
    identifier: z.string().trim().toLowerCase().min(1, "Email or username is required").max(160),
    password: z.string().min(1, "Password is required").max(128),
  })
  .strict();

const verifyEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email is required").max(160),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  })
  .strict();

const resendVerificationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email is required").max(160),
  })
  .strict();

const verifyDeviceSchema = z
  .object({
    challengeId: z.string().min(1).max(64),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  })
  .strict();

const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email is required").max(160),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email is required").max(160),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
  })
  .strict();

const clientCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    notes: z.string().max(20000).optional().default(""),
  })
  .strict();

const clientUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    notes: z.string().max(20000).optional(),
  })
  .strict();

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "URL must start with http:// or https://"
  );

const optionalOwnerEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Valid email is required"
  );

const optionalRenewalDateSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date must be YYYY-MM-DD");

const projectCreateSchema = z
  .object({
    clientId: z.string().min(1, "Client ID is required").max(64),
    name: z.string().trim().min(1, "Name is required").max(100),
    details: z.string().max(50000).optional().default(""),
    liveUrl: optionalHttpUrlSchema.optional().default(""),
    repoUrl: optionalHttpUrlSchema.optional().default(""),
    status: z.enum(["active", "paused", "archived"]).optional().default("active"),
  })
  .strict();

const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    details: z.string().max(50000).optional(),
    liveUrl: optionalHttpUrlSchema.optional(),
    repoUrl: optionalHttpUrlSchema.optional(),
    status: z.enum(["active", "paused", "archived"]).optional(),
  })
  .strict();

const serviceCreateSchema = z
  .object({
    projectId: z.string().min(1, "Project ID is required").max(64),
    name: z.string().trim().min(1, "Name is required").max(100),
    description: z.string().max(50000).optional().default(""),
    ownerEmail: optionalOwnerEmailSchema.optional().default(""),
    dashboardUrl: optionalHttpUrlSchema.optional().default(""),
    tier: z.enum(["", "free", "paid", "trial"]).optional().default(""),
    renewalDate: optionalRenewalDateSchema.optional().default(""),
  })
  .strict();

const serviceUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    description: z.string().max(50000).optional(),
    ownerEmail: optionalOwnerEmailSchema.optional(),
    dashboardUrl: optionalHttpUrlSchema.optional(),
    tier: z.enum(["", "free", "paid", "trial"]).optional(),
    renewalDate: optionalRenewalDateSchema.optional(),
  })
  .strict();

const adminUpdateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict();

const apiKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Key name is required").max(60),
  })
  .strict();

const importSchema = z
  .object({
    clients: z.array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(100),
        notes: z.string().max(20000).default(""),
        createdAt: z.number(),
        updatedAt: z.number(),
        projects: z.array(
          z.object({
            id: z.string().min(1).max(64),
            clientId: z.string().min(1).max(64),
            name: z.string().min(1).max(100),
            details: z.string().max(50000).default(""),
            liveUrl: optionalHttpUrlSchema.optional().default(""),
            repoUrl: optionalHttpUrlSchema.optional().default(""),
            status: z.enum(["active", "paused", "archived"]).optional().default("active"),
            createdAt: z.number(),
            updatedAt: z.number(),
            services: z.array(
              z.object({
                id: z.string().min(1).max(64),
                projectId: z.string().min(1).max(64),
                name: z.string().min(1).max(100),
                description: z.string().max(50000).default(""),
                ownerEmail: optionalOwnerEmailSchema.optional().default(""),
                dashboardUrl: optionalHttpUrlSchema.optional().default(""),
                tier: z.enum(["", "free", "paid", "trial"]).optional().default(""),
                renewalDate: optionalRenewalDateSchema.optional().default(""),
                createdAt: z.number(),
                updatedAt: z.number(),
              })
            ),
          })
        ),
      })
    ),
  })
  .strict();

// Helper to resolve current user from Bearer API key, access token, or refresh token
async function authenticateRequest(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<{ user: PublicUser; method: "cookie" | "api_key" } | null> {
  const db = drizzle(c.env.DB, { schema });

  // 1. Check Personal API Key in Authorization: Bearer dn_live_...
  const authHeader = c.req.header("Authorization") || "";
  if (authHeader.startsWith("Bearer dn_live_")) {
    const rawKey = authHeader.slice("Bearer ".length).trim();
    if (!rawKey) return null;

    const keyHash = await sha256Hex(rawKey);
    const keyRow = await db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
      .get();

    if (!keyRow) return null;

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, keyRow.userId))
      .get();

    if (!userRow || userRow.status !== "active") return null;

    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: Date.now() })
      .where(eq(schema.apiKeys.id, keyRow.id));

    return { user: toPublicUser(userRow), method: "api_key" };
  }

  // 2. Check JWT access cookie
  const accessToken = getCookie(c, ACCESS_COOKIE);

  if (accessToken) {
    try {
      const payload = await verify(accessToken, getJwtSecret(c), "HS256");
      const userId = typeof payload.sub === "string" ? payload.sub : "";
      if (userId) {
        const userRow = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .get();
        if (userRow && userRow.status === "active") {
          if (
            userRow.email === DEFAULT_ADMIN_EMAIL &&
            userRow.role !== "admin"
          ) {
            await db
              .update(schema.users)
              .set({ role: "admin", updatedAt: Date.now() })
              .where(eq(schema.users.id, userRow.id));
            userRow.role = "admin";
          }
          return { user: toPublicUser(userRow), method: "cookie" };
        }
      }
    } catch {
      // Access token expired or invalid — fall through to refresh token check
    }
  }

  // 3. Try silent rotation with refresh cookie
  const refreshToken = getCookie(c, REFRESH_COOKIE);
  if (!refreshToken) return null;

  const refreshHash = await sha256Hex(refreshToken);
  const sessionRow = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.refreshTokenHash, refreshHash))
    .get();

  if (!sessionRow) return null;

  const now = Date.now();
  if (sessionRow.revokedAt) {
    await db
      .update(schema.sessions)
      .set({ revokedAt: now })
      .where(eq(schema.sessions.userId, sessionRow.userId));
    clearAuthCookies(c);
    return null;
  }

  if (sessionRow.expiresAt <= now) {
    clearAuthCookies(c);
    return null;
  }

  const userRow = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, sessionRow.userId))
    .get();

  if (!userRow || userRow.status !== "active") {
    clearAuthCookies(c);
    return null;
  }

  const newRefresh = generateOpaqueToken();
  const newRefreshHash = await sha256Hex(newRefresh);

  await db
    .update(schema.sessions)
    .set({ revokedAt: now })
    .where(eq(schema.sessions.id, sessionRow.id));

  await db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    userId: userRow.id,
    refreshTokenHash: newRefreshHash,
    expiresAt: now + REFRESH_TTL_SEC * 1000,
    revokedAt: null,
    userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
    ipAddress: getClientIp(c),
    createdAt: now,
  });

  const pubUser = toPublicUser(userRow);
  await issueAuthCookies(c, pubUser, newRefresh);
  return { user: pubUser, method: "cookie" };
}

async function isTrustedDevice(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: string
): Promise<boolean> {
  const deviceToken = getCookie(c, DEVICE_COOKIE);
  if (!deviceToken) return false;

  const deviceHash = await sha256Hex(deviceToken);
  const row = await db
    .select()
    .from(schema.trustedDevices)
    .where(
      and(
        eq(schema.trustedDevices.userId, userId),
        eq(schema.trustedDevices.deviceTokenHash, deviceHash)
      )
    )
    .get();

  if (!row) return false;

  await db
    .update(schema.trustedDevices)
    .set({ lastSeenAt: Date.now(), ipAddress: getClientIp(c) })
    .where(eq(schema.trustedDevices.id, row.id));
  return true;
}

async function trustCurrentDevice(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: string
) {
  const rawToken = generateOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();

  await db.insert(schema.trustedDevices).values({
    id: crypto.randomUUID(),
    userId,
    deviceTokenHash: tokenHash,
    userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
    ipAddress: getClientIp(c),
    lastSeenAt: now,
    createdAt: now,
  });

  const isDev = isLocalDevUrl(c.req.url);
  setCookie(c, DEVICE_COOKIE, rawToken, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "Lax",
    path: "/",
    maxAge: DEVICE_TTL_SEC,
  });
}

async function createAndSendSignupOtp(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  db: ReturnType<typeof drizzle<typeof schema>>,
  userId: string,
  email: string
) {
  const now = Date.now();
  const code = generateSixDigitCode();
  const tokenHash = await sha256Hex(`verify:${userId}:${code}`);

  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.userId, userId));

  await db.insert(schema.verificationTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    attempts: 0,
    expiresAt: now + OTP_EXPIRY_MS,
    usedAt: null,
    createdAt: now,
  });

  const mail = buildSignupVerificationEmail(code);
  return sendMail(c.env, { to: email, ...mail });
}

// Public Auth Routes
app.post("/api/auth/signup", zValidator("json", signupSchema), async (c) => {
  const { email, username, password } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });
  const ip = getClientIp(c);

  // Rate limit: 5 signups / hour per IP
  const rl = await checkRateLimit(db, `signup:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json(
      { error: "Too many signup attempts. Please try again later." },
      429
    );
  }

  const existingEmail = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (existingEmail) {
    return c.json({ error: "An account with this email already exists." }, 409);
  }

  const existingUsername = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (existingUsername) {
    return c.json({ error: "This username is already taken." }, 409);
  }

  const now = Date.now();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const role = email === DEFAULT_ADMIN_EMAIL ? "admin" : "user";

  const newUser: schema.NewUser = {
    id: userId,
    email,
    username,
    passwordHash,
    role,
    status: "active",
    emailVerified: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.users).values(newUser);

  if (role === "admin") {
    await db
      .update(schema.clients)
      .set({ userId })
      .where(isNull(schema.clients.userId));
  }

  const mailRes = await createAndSendSignupOtp(c, db, userId, email);
  if (!mailRes.success) {
    return c.json(
      {
        error:
          "Account created, but we could not send the verification email. Please try resending in a moment.",
      },
      502
    );
  }

  return c.json(
    {
      ok: true,
      requiresVerification: true,
      email,
    },
    201
  );
});

app.post(
  "/api/auth/verify-email",
  zValidator("json", verifyEmailSchema),
  async (c) => {
    const { email, code } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });
    const ip = getClientIp(c);

    const rl = await checkRateLimit(db, `verify:ip:${ip}`, 15, 15 * 60 * 1000);
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json({ error: "Too many attempts. Please wait a few minutes." }, 429);
    }

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (!userRow || userRow.status !== "active") {
      return c.json({ error: "Invalid or expired verification code." }, 400);
    }

    const tokenRow = await db
      .select()
      .from(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.userId, userRow.id),
          isNull(schema.verificationTokens.usedAt)
        )
      )
      .orderBy(desc(schema.verificationTokens.createdAt))
      .get();

    const now = Date.now();
    if (!tokenRow || tokenRow.expiresAt <= now) {
      return c.json({ error: "Verification code expired. Request a new code." }, 400);
    }

    if (tokenRow.attempts >= MAX_OTP_ATTEMPTS) {
      return c.json(
        { error: "Too many incorrect codes. Please request a new code." },
        429
      );
    }

    const expectedHash = await sha256Hex(`verify:${userRow.id}:${code}`);
    if (expectedHash !== tokenRow.tokenHash) {
      await db
        .update(schema.verificationTokens)
        .set({ attempts: tokenRow.attempts + 1 })
        .where(eq(schema.verificationTokens.id, tokenRow.id));
      return c.json({ error: "Invalid verification code." }, 400);
    }

    await db
      .update(schema.verificationTokens)
      .set({ usedAt: now })
      .where(eq(schema.verificationTokens.id, tokenRow.id));

    await db
      .update(schema.users)
      .set({ emailVerified: 1, updatedAt: now })
      .where(eq(schema.users.id, userRow.id));

    userRow.emailVerified = 1;

    // Trust this device and issue session cookies
    await trustCurrentDevice(c, db, userRow.id);

    const refreshToken = generateOpaqueToken();
    const refreshHash = await sha256Hex(refreshToken);

    await db.insert(schema.sessions).values({
      id: crypto.randomUUID(),
      userId: userRow.id,
      refreshTokenHash: refreshHash,
      expiresAt: now + REFRESH_TTL_SEC * 1000,
      revokedAt: null,
      userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
      ipAddress: ip,
      createdAt: now,
    });

    const pubUser = toPublicUser(userRow);
    await issueAuthCookies(c, pubUser, refreshToken);

    return c.json({ ok: true, user: pubUser });
  }
);

app.post(
  "/api/auth/resend-verification",
  zValidator("json", resendVerificationSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });
    const ip = getClientIp(c);

    const rl = await checkRateLimit(
      db,
      `resend:${ip}:${email}`,
      3,
      15 * 60 * 1000
    );
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json(
        { error: "Please wait a few minutes before requesting another code." },
        429
      );
    }

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (userRow && userRow.status === "active" && userRow.emailVerified === 0) {
      await createAndSendSignupOtp(c, db, userRow.id, userRow.email);
    }

    // Uniform response to avoid account enumeration
    return c.json({ ok: true });
  }
);

app.post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
  const { identifier, password } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });
  const ip = getClientIp(c);

  const ipLimit = await checkRateLimit(db, `login:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    c.header("Retry-After", String(ipLimit.retryAfterSec));
    return c.json(
      { error: "Too many login attempts. Please wait a few minutes." },
      429
    );
  }

  const idLimit = await checkRateLimit(
    db,
    `login:id:${identifier}`,
    10,
    15 * 60 * 1000
  );
  if (!idLimit.allowed) {
    c.header("Retry-After", String(idLimit.retryAfterSec));
    return c.json(
      { error: "Too many login attempts for this account. Please try again later." },
      429
    );
  }

  const userRow = await db
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.email, identifier), eq(schema.users.username, identifier)))
    .get();

  const now = Date.now();

  if (!userRow) {
    await verifyPassword(password, DUMMY_BCRYPT_HASH);
    return c.json({ error: "Invalid email, username, or password" }, 401);
  }

  if (userRow.lockedUntil && userRow.lockedUntil > now) {
    const mins = Math.ceil((userRow.lockedUntil - now) / 60000);
    return c.json(
      { error: `Account temporarily locked. Try again in ${mins} minute(s).` },
      423
    );
  }

  if (userRow.status !== "active") {
    return c.json({ error: "This account has been suspended." }, 403);
  }

  const valid = await verifyPassword(password, userRow.passwordHash);
  if (!valid) {
    const nextAttempts = userRow.failedLoginAttempts + 1;
    const lockedUntil = nextAttempts >= MAX_FAILED_LOGINS ? now + LOCKOUT_MS : null;
    await db
      .update(schema.users)
      .set({
        failedLoginAttempts: nextAttempts,
        lockedUntil,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userRow.id));

    return c.json({ error: "Invalid email, username, or password" }, 401);
  }

  const resolvedRole =
    userRow.email === DEFAULT_ADMIN_EMAIL ? "admin" : userRow.role;

  await db
    .update(schema.users)
    .set({
      role: resolvedRole,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(eq(schema.users.id, userRow.id));

  userRow.role = resolvedRole;

  // 1. Require email verification if unverified
  if (userRow.emailVerified === 0) {
    await createAndSendSignupOtp(c, db, userRow.id, userRow.email);
    return c.json({
      ok: true,
      requiresVerification: true,
      email: userRow.email,
    });
  }

  // 2. Check trusted device cookie; if unrecognized, send 6-digit new-device code
  const trusted = await isTrustedDevice(c, db, userRow.id);
  if (!trusted) {
    const code = generateSixDigitCode();
    const challengeId = crypto.randomUUID();
    const codeHash = await sha256Hex(`device:${challengeId}:${code}`);

    await db.insert(schema.loginChallenges).values({
      id: challengeId,
      userId: userRow.id,
      codeHash,
      attempts: 0,
      expiresAt: now + DEVICE_OTP_EXPIRY_MS,
      usedAt: null,
      createdAt: now,
    });

    const mail = buildNewDeviceLoginEmail(code, {
      ip,
      userAgent: c.req.header("User-Agent") || "",
    });
    const mailRes = await sendMail(c.env, { to: userRow.email, ...mail });
    if (!mailRes.success) {
      return c.json(
        { error: "Unable to send new-device verification email. Please try again." },
        502
      );
    }

    return c.json({
      ok: true,
      requiresDeviceVerification: true,
      challengeId,
      maskedEmail: maskEmail(userRow.email),
    });
  }

  // 3. Trusted device — issue session cookies immediately
  const refreshToken = generateOpaqueToken();
  const refreshHash = await sha256Hex(refreshToken);

  await db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    userId: userRow.id,
    refreshTokenHash: refreshHash,
    expiresAt: now + REFRESH_TTL_SEC * 1000,
    revokedAt: null,
    userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
    ipAddress: ip,
    createdAt: now,
  });

  const pubUser = toPublicUser(userRow);
  await issueAuthCookies(c, pubUser, refreshToken);

  return c.json({ ok: true, user: pubUser });
});

app.post(
  "/api/auth/verify-device",
  zValidator("json", verifyDeviceSchema),
  async (c) => {
    const { challengeId, code } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });
    const ip = getClientIp(c);

    const rl = await checkRateLimit(
      db,
      `verify-device:ip:${ip}`,
      15,
      15 * 60 * 1000
    );
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json({ error: "Too many attempts. Please try again later." }, 429);
    }

    const challenge = await db
      .select()
      .from(schema.loginChallenges)
      .where(
        and(
          eq(schema.loginChallenges.id, challengeId),
          isNull(schema.loginChallenges.usedAt)
        )
      )
      .get();

    const now = Date.now();
    if (!challenge || challenge.expiresAt <= now) {
      return c.json({ error: "Sign-in code expired. Please sign in again." }, 400);
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      return c.json(
        { error: "Too many incorrect attempts. Please sign in again." },
        429
      );
    }

    const expectedHash = await sha256Hex(`device:${challengeId}:${code}`);
    if (expectedHash !== challenge.codeHash) {
      await db
        .update(schema.loginChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(schema.loginChallenges.id, challengeId));
      return c.json({ error: "Invalid verification code." }, 400);
    }

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, challenge.userId))
      .get();

    if (!userRow || userRow.status !== "active") {
      return c.json({ error: "Account unavailable." }, 403);
    }

    await db
      .update(schema.loginChallenges)
      .set({ usedAt: now })
      .where(eq(schema.loginChallenges.id, challengeId));

    await trustCurrentDevice(c, db, userRow.id);

    const refreshToken = generateOpaqueToken();
    const refreshHash = await sha256Hex(refreshToken);

    await db.insert(schema.sessions).values({
      id: crypto.randomUUID(),
      userId: userRow.id,
      refreshTokenHash: refreshHash,
      expiresAt: now + REFRESH_TTL_SEC * 1000,
      revokedAt: null,
      userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
      ipAddress: ip,
      createdAt: now,
    });

    const pubUser = toPublicUser(userRow);
    await issueAuthCookies(c, pubUser, refreshToken);

    return c.json({ ok: true, user: pubUser });
  }
);

app.post(
  "/api/auth/forgot-password",
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });
    const ip = getClientIp(c);

    const rl = await checkRateLimit(db, `forgot:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json(
        { error: "Too many reset requests. Please try again later." },
        429
      );
    }

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (userRow && userRow.status === "active") {
      const now = Date.now();
      const code = generateSixDigitCode();
      const tokenHash = await sha256Hex(`reset:${userRow.id}:${code}`);

      await db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, userRow.id));

      await db.insert(schema.passwordResetTokens).values({
        id: crypto.randomUUID(),
        userId: userRow.id,
        tokenHash,
        attempts: 0,
        expiresAt: now + OTP_EXPIRY_MS,
        usedAt: null,
        createdAt: now,
      });

      const mail = buildPasswordResetEmail(code);
      await sendMail(c.env, { to: userRow.email, ...mail });
    }

    // Always return 200 to prevent account enumeration
    return c.json({ ok: true });
  }
);

app.post(
  "/api/auth/reset-password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { email, code, newPassword } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });
    const ip = getClientIp(c);

    const rl = await checkRateLimit(db, `reset:ip:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json({ error: "Too many attempts. Please wait a few minutes." }, 429);
    }

    const userRow = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (!userRow || userRow.status !== "active") {
      return c.json({ error: "Invalid or expired reset code." }, 400);
    }

    const tokenRow = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(
        and(
          eq(schema.passwordResetTokens.userId, userRow.id),
          isNull(schema.passwordResetTokens.usedAt)
        )
      )
      .orderBy(desc(schema.passwordResetTokens.createdAt))
      .get();

    const now = Date.now();
    if (!tokenRow || tokenRow.expiresAt <= now) {
      return c.json({ error: "Reset code expired. Request a new code." }, 400);
    }

    if (tokenRow.attempts >= MAX_OTP_ATTEMPTS) {
      return c.json(
        { error: "Too many incorrect codes. Please request a new reset code." },
        429
      );
    }

    const expectedHash = await sha256Hex(`reset:${userRow.id}:${code}`);
    if (expectedHash !== tokenRow.tokenHash) {
      await db
        .update(schema.passwordResetTokens)
        .set({ attempts: tokenRow.attempts + 1 })
        .where(eq(schema.passwordResetTokens.id, tokenRow.id));
      return c.json({ error: "Invalid reset code." }, 400);
    }

    const newHash = await hashPassword(newPassword);

    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(schema.passwordResetTokens.id, tokenRow.id));

    await db
      .update(schema.users)
      .set({
        passwordHash: newHash,
        emailVerified: 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userRow.id));

    // Revoke all existing sessions on password reset
    await db
      .update(schema.sessions)
      .set({ revokedAt: now })
      .where(eq(schema.sessions.userId, userRow.id));

    return c.json({ ok: true });
  }
);

app.post("/api/auth/refresh", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const ip = getClientIp(c);

  const rl = await checkRateLimit(db, `refresh:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Too many requests" }, 429);
  }

  const authResult = await authenticateRequest(c);
  if (!authResult) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ ok: true, user: authResult.user });
});

app.post("/api/auth/logout", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const refreshToken = getCookie(c, REFRESH_COOKIE);
  if (refreshToken) {
    const refreshHash = await sha256Hex(refreshToken);
    await db
      .update(schema.sessions)
      .set({ revokedAt: Date.now() })
      .where(eq(schema.sessions.refreshTokenHash, refreshHash));
  }
  clearAuthCookies(c);
  return c.json({ ok: true });
});

// Auth middleware for all protected /api/* routes
const PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/verify-device",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

app.use("/api/*", async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path) || c.req.method === "OPTIONS") {
    return next();
  }

  const authResult = await authenticateRequest(c);
  if (!authResult) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", authResult.user);
  c.set("authMethod", authResult.method);
  await next();
});

app.get("/api/me", (c) => {
  const user = c.get("user");
  return c.json({ authenticated: true, user });
});

// Helper: fetch user's full tree
async function getUserTree(db: ReturnType<typeof drizzle<typeof schema>>, userId: string) {
  const clientList = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.userId, userId))
    .orderBy(asc(schema.clients.createdAt));

  const clientIds = clientList.map((c) => c.id);
  if (clientIds.length === 0) return [];

  const projectList = await db
    .select()
    .from(schema.projects)
    .where(inArray(schema.projects.clientId, clientIds))
    .orderBy(asc(schema.projects.createdAt));

  const projectIds = projectList.map((p) => p.id);
  const serviceList =
    projectIds.length > 0
      ? await db
          .select()
          .from(schema.services)
          .where(inArray(schema.services.projectId, projectIds))
          .orderBy(asc(schema.services.createdAt))
      : [];

  const servicesByProject = new Map<string, schema.Service[]>();
  for (const s of serviceList) {
    const list = servicesByProject.get(s.projectId) || [];
    list.push(s);
    servicesByProject.set(s.projectId, list);
  }

  const projectsByClient = new Map<
    string,
    Array<schema.Project & { services: schema.Service[] }>
  >();
  for (const p of projectList) {
    const list = projectsByClient.get(p.clientId) || [];
    list.push({ ...p, services: servicesByProject.get(p.id) || [] });
    projectsByClient.set(p.clientId, list);
  }

  return clientList.map((client) => ({
    ...client,
    projects: projectsByClient.get(client.id) || [],
  }));
}

// Tree endpoint (scoped to authenticated user)
app.get("/api/tree", async (c) => {
  const user = c.get("user");
  const db = drizzle(c.env.DB, { schema });
  const clients = await getUserTree(db, user.id);
  return c.json({ clients });
});

// Clients CRUD (scoped to user.id)
app.post("/api/clients", zValidator("json", clientCreateSchema), async (c) => {
  const user = c.get("user");
  const { name, notes } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });
  const now = Date.now();
  const newClient = {
    id: crypto.randomUUID(),
    userId: user.id,
    name,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.clients).values(newClient);
  return c.json({ ...newClient, projects: [] }, 201);
});

app.patch("/api/clients/:id", zValidator("json", clientUpdateSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)))
    .get();
  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  await db
    .update(schema.clients)
    .set({ ...data, updatedAt: Date.now() })
    .where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)));

  const result = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, id))
    .get();
  return c.json(result);
});

app.delete("/api/clients/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)))
    .get();
  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  const projList = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.clientId, id));
  const projectIds = projList.map((p) => p.id);
  if (projectIds.length > 0) {
    await db.delete(schema.services).where(inArray(schema.services.projectId, projectIds));
    await db.delete(schema.projects).where(eq(schema.projects.clientId, id));
  }
  await db
    .delete(schema.clients)
    .where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)));

  return c.json({ ok: true });
});

// Projects CRUD (ownership checked via parent client)
app.post("/api/projects", zValidator("json", projectCreateSchema), async (c) => {
  const user = c.get("user");
  const { clientId, name, details, liveUrl, repoUrl, status } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const client = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, user.id)))
    .get();
  if (!client) {
    return c.json({ error: "Client not found" }, 404);
  }

  const now = Date.now();
  const newProject = {
    id: crypto.randomUUID(),
    clientId,
    name,
    details,
    liveUrl,
    repoUrl,
    status,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.projects).values(newProject);
  return c.json({ ...newProject, services: [] }, 201);
});

app.patch("/api/projects/:id", zValidator("json", projectUpdateSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const ownerClient = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, user.id))
    )
    .get();
  if (!ownerClient) {
    return c.json({ error: "Project not found" }, 404);
  }

  await db
    .update(schema.projects)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(schema.projects.id, id));
  const result = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  return c.json(result);
});

app.delete("/api/projects/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .get();
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const ownerClient = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, user.id))
    )
    .get();
  if (!ownerClient) {
    return c.json({ error: "Project not found" }, 404);
  }

  await db.delete(schema.services).where(eq(schema.services.projectId, id));
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  return c.json({ ok: true });
});

// Services CRUD (ownership checked via parent project -> client)
app.post("/api/services", zValidator("json", serviceCreateSchema), async (c) => {
  const user = c.get("user");
  const { projectId, name, description, ownerEmail, dashboardUrl, tier, renewalDate } =
    c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const project = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const ownerClient = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, user.id))
    )
    .get();
  if (!ownerClient) {
    return c.json({ error: "Project not found" }, 404);
  }

  const now = Date.now();
  const newService = {
    id: crypto.randomUUID(),
    projectId,
    name,
    description,
    ownerEmail,
    dashboardUrl,
    tier,
    renewalDate,
    lastReminderSentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.services).values(newService);
  return c.json(newService, 201);
});

app.patch("/api/services/:id", zValidator("json", serviceUpdateSchema), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const project = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, existing.projectId))
    .get();
  if (!project) {
    return c.json({ error: "Service not found" }, 404);
  }

  const ownerClient = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, user.id))
    )
    .get();
  if (!ownerClient) {
    return c.json({ error: "Service not found" }, 404);
  }

  const updatePatch: Partial<schema.NewService> = {
    ...data,
    updatedAt: Date.now(),
  };
  if (
    data.renewalDate !== undefined &&
    data.renewalDate !== existing.renewalDate
  ) {
    updatePatch.lastReminderSentAt = null;
  }

  await db
    .update(schema.services)
    .set(updatePatch)
    .where(eq(schema.services.id, id));
  const result = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();
  return c.json(result);
});

app.delete("/api/services/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const project = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, existing.projectId))
    .get();
  if (!project) {
    return c.json({ error: "Service not found" }, 404);
  }

  const ownerClient = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(
      and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, user.id))
    )
    .get();
  if (!ownerClient) {
    return c.json({ error: "Service not found" }, 404);
  }

  await db.delete(schema.services).where(eq(schema.services.id, id));
  return c.json({ ok: true });
});

// Export / Import (strictly scoped to user.id)
app.get("/api/export", async (c) => {
  const user = c.get("user");
  const db = drizzle(c.env.DB, { schema });
  const clients = await getUserTree(db, user.id);

  return c.json({
    version: 2,
    exportedAt: new Date().toISOString(),
    clients,
  });
});

app.post("/api/import", zValidator("json", importSchema), async (c) => {
  const user = c.get("user");
  const { clients: importedClients } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  // Delete only the authenticated user's existing data
  const userClients = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.userId, user.id));
  const userClientIds = userClients.map((cl) => cl.id);

  if (userClientIds.length > 0) {
    const userProjects = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(inArray(schema.projects.clientId, userClientIds));
    const userProjectIds = userProjects.map((p) => p.id);
    if (userProjectIds.length > 0) {
      await db
        .delete(schema.services)
        .where(inArray(schema.services.projectId, userProjectIds));
    }
    await db
      .delete(schema.projects)
      .where(inArray(schema.projects.clientId, userClientIds));
    await db.delete(schema.clients).where(eq(schema.clients.userId, user.id));
  }

  // Generate fresh UUIDs on import to prevent cross-user PK collisions
  for (const client of importedClients) {
    const newClientId = crypto.randomUUID();
    await db.insert(schema.clients).values({
      id: newClientId,
      userId: user.id,
      name: client.name,
      notes: client.notes || "",
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });

    for (const project of client.projects) {
      const newProjectId = crypto.randomUUID();
      await db.insert(schema.projects).values({
        id: newProjectId,
        clientId: newClientId,
        name: project.name,
        details: project.details || "",
        liveUrl: project.liveUrl || "",
        repoUrl: project.repoUrl || "",
        status: project.status || "active",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });

      for (const service of project.services) {
        await db.insert(schema.services).values({
          id: crypto.randomUUID(),
          projectId: newProjectId,
          name: service.name,
          description: service.description || "",
          ownerEmail: service.ownerEmail || "",
          dashboardUrl: service.dashboardUrl || "",
          tier: service.tier || "",
          renewalDate: service.renewalDate || "",
          lastReminderSentAt: null,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
        });
      }
    }
  }

  return c.json({ ok: true, count: importedClients.length });
});

// ================= AI ASSISTANT API (/api/ai/*) =================
app.post("/api/ai/chat", zValidator("json", aiChatRequestSchema), async (c) => {
  const user = c.get("user");
  const { messages, activeClientId, activeProjectId } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  // Rate limit: 30 AI requests / 15 min per user
  const rl = await checkRateLimit(db, `ai:user:${user.id}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json(
      { error: "AI rate limit reached. Please wait a few minutes." },
      429
    );
  }

  if (!c.env.AI) {
    return c.json(
      { error: "Cloudflare Workers AI binding is not configured." },
      503
    );
  }

  try {
    const tree = await getUserTree(db, user.id);
    const response = await runAiChat(
      c.env.AI,
      tree,
      messages,
      activeClientId,
      activeProjectId
    );
    return c.json(response);
  } catch (err) {
    console.error("AI chat error:", err);
    return c.json(
      { error: "Assistant failed to respond. Please try again." },
      502
    );
  }
});

app.post(
  "/api/ai/execute",
  zValidator("json", aiExecuteRequestSchema),
  async (c) => {
    const user = c.get("user");
    const { actions } = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });

    const rl = await checkRateLimit(
      db,
      `ai-exec:user:${user.id}`,
      30,
      15 * 60 * 1000
    );
    if (!rl.allowed) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return c.json({ error: "Too many requests. Please wait a moment." }, 429);
    }

    try {
      const outcome = await executeAiActions(db, user.id, actions);
      return c.json({ ok: true, ...outcome });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply changes";
      return c.json({ error: message }, 400);
    }
  }
);

// ================= PERSONAL API KEYS & MCP (/api/keys, /api/mcp) =================
app.get("/api/keys", async (c) => {
  if (c.get("authMethod") !== "cookie") {
    return c.json({ error: "Browser session required to manage API keys" }, 403);
  }
  const user = c.get("user");
  const db = drizzle(c.env.DB, { schema });

  const keys = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.userId, user.id), isNull(schema.apiKeys.revokedAt)))
    .orderBy(desc(schema.apiKeys.createdAt));

  return c.json({ keys });
});

app.post("/api/keys", zValidator("json", apiKeyCreateSchema), async (c) => {
  if (c.get("authMethod") !== "cookie") {
    return c.json({ error: "Browser session required to create API keys" }, 403);
  }
  const user = c.get("user");
  const { name } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const rl = await checkRateLimit(db, `keys:user:${user.id}`, 15, 60 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Too many keys created. Try again later." }, 429);
  }

  const rawSecret = `dn_live_${generateOpaqueToken().slice(0, 40)}`;
  const keyPrefix = rawSecret.slice(0, 14);
  const keyHash = await sha256Hex(rawSecret);
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.insert(schema.apiKeys).values({
    id,
    userId: user.id,
    name,
    keyPrefix,
    keyHash,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
  });

  return c.json(
    {
      key: {
        id,
        name,
        keyPrefix,
        lastUsedAt: null,
        createdAt: now,
      },
      rawKey: rawSecret,
    },
    201
  );
});

app.delete("/api/keys/:id", async (c) => {
  if (c.get("authMethod") !== "cookie") {
    return c.json({ error: "Browser session required to revoke API keys" }, 403);
  }
  const user = c.get("user");
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  await db
    .update(schema.apiKeys)
    .set({ revokedAt: Date.now() })
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, user.id)));

  return c.json({ ok: true });
});

// Remote Streamable HTTP MCP Endpoint (JSON-RPC 2.0)
app.post("/api/mcp", async (c) => {
  const user = c.get("user");
  const db = drizzle(c.env.DB, { schema });

  const rl = await checkRateLimit(db, `mcp:user:${user.id}`, 120, 15 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Rate limit exceeded" },
      },
      429
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      400
    );
  }

  const response = await handleMcpJsonRpc(db, user.id, body);
  if (response === null) {
    return c.body(null, 202);
  }
  return c.json(response);
});

// ================= ADMIN API (/api/admin/*) =================
app.use("/api/admin/*", async (c, next) => {
  const user = c.get("user");
  if (
    !user ||
    c.get("authMethod") !== "cookie" ||
    user.role !== "admin" ||
    user.status !== "active"
  ) {
    return c.json({ error: "Forbidden: Admin access required" }, 403);
  }
  await next();
});

app.get("/api/admin/stats", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const allUsers = await db.select().from(schema.users);
  const allClients = await db.select({ id: schema.clients.id }).from(schema.clients);
  const allProjects = await db.select({ id: schema.projects.id }).from(schema.projects);
  const allServices = await db.select({ id: schema.services.id }).from(schema.services);

  return c.json({
    users: {
      total: allUsers.length,
      active: allUsers.filter((u) => u.status === "active").length,
      suspended: allUsers.filter((u) => u.status === "suspended").length,
      admins: allUsers.filter((u) => u.role === "admin").length,
    },
    resources: {
      clients: allClients.length,
      projects: allProjects.length,
      services: allServices.length,
    },
  });
});

app.get("/api/admin/users", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const q = (c.req.query("q") || "").trim().toLowerCase();

  const allUsers = await db
    .select()
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));

  const allClients = await db
    .select({ id: schema.clients.id, userId: schema.clients.userId })
    .from(schema.clients);
  const allProjects = await db
    .select({ id: schema.projects.id, clientId: schema.projects.clientId })
    .from(schema.projects);
  const allServices = await db
    .select({ id: schema.services.id, projectId: schema.services.projectId })
    .from(schema.services);

  const clientOwner = new Map<string, string>();
  const clientCountByUser = new Map<string, number>();
  for (const cl of allClients) {
    if (cl.userId) {
      clientOwner.set(cl.id, cl.userId);
      clientCountByUser.set(cl.userId, (clientCountByUser.get(cl.userId) || 0) + 1);
    }
  }

  const projectOwner = new Map<string, string>();
  const projectCountByUser = new Map<string, number>();
  for (const p of allProjects) {
    const uid = clientOwner.get(p.clientId);
    if (uid) {
      projectOwner.set(p.id, uid);
      projectCountByUser.set(uid, (projectCountByUser.get(uid) || 0) + 1);
    }
  }

  const serviceCountByUser = new Map<string, number>();
  for (const s of allServices) {
    const uid = projectOwner.get(s.projectId);
    if (uid) {
      serviceCountByUser.set(uid, (serviceCountByUser.get(uid) || 0) + 1);
    }
  }

  const filtered = allUsers
    .filter((u) => {
      if (!q) return true;
      return u.email.includes(q) || u.username.includes(q);
    })
    .map((u) => ({
      ...toPublicUser(u),
      counts: {
        clients: clientCountByUser.get(u.id) || 0,
        projects: projectCountByUser.get(u.id) || 0,
        services: serviceCountByUser.get(u.id) || 0,
      },
    }));

  return c.json({ users: filtered });
});

app.patch(
  "/api/admin/users/:id",
  zValidator("json", adminUpdateUserSchema),
  async (c) => {
    const currentAdmin = c.get("user");
    const targetId = c.req.param("id");
    const data = c.req.valid("json");
    const db = drizzle(c.env.DB, { schema });

    const target = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetId))
      .get();

    if (!target) {
      return c.json({ error: "User not found" }, 404);
    }

    if (target.id === currentAdmin.id) {
      return c.json(
        { error: "You cannot modify your own role or status." },
        400
      );
    }

    if (
      target.email === DEFAULT_ADMIN_EMAIL &&
      (data.role === "user" || data.status === "suspended")
    ) {
      return c.json(
        { error: "The default system admin cannot be demoted or suspended." },
        400
      );
    }

    const now = Date.now();
    await db
      .update(schema.users)
      .set({ ...data, updatedAt: now })
      .where(eq(schema.users.id, targetId));

    // If suspending user, revoke all their active sessions immediately
    if (data.status === "suspended") {
      await db
        .update(schema.sessions)
        .set({ revokedAt: now })
        .where(eq(schema.sessions.userId, targetId));
    }

    const updated = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetId))
      .get();

    return c.json({ user: updated ? toPublicUser(updated) : null });
  }
);

app.delete("/api/admin/users/:id", async (c) => {
  const currentAdmin = c.get("user");
  const targetId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const target = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, targetId))
    .get();

  if (!target) {
    return c.json({ error: "User not found" }, 404);
  }

  if (target.id === currentAdmin.id) {
    return c.json({ error: "You cannot delete your own account." }, 400);
  }

  if (target.email === DEFAULT_ADMIN_EMAIL) {
    return c.json({ error: "The default system admin cannot be deleted." }, 400);
  }

  // Cascade delete user's clients -> projects -> services, sessions, and user
  const userClients = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.userId, targetId));
  const clientIds = userClients.map((cl) => cl.id);

  if (clientIds.length > 0) {
    const userProjects = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(inArray(schema.projects.clientId, clientIds));
    const projectIds = userProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      await db
        .delete(schema.services)
        .where(inArray(schema.services.projectId, projectIds));
    }
    await db
      .delete(schema.projects)
      .where(inArray(schema.projects.clientId, clientIds));
    await db.delete(schema.clients).where(eq(schema.clients.userId, targetId));
  }

  await db.delete(schema.sessions).where(eq(schema.sessions.userId, targetId));
  await db.delete(schema.users).where(eq(schema.users.id, targetId));

  return c.json({ ok: true });
});

// Daily scheduled job: email users when services renew/expire within 7 days
async function runRenewalReminders(env: Bindings): Promise<void> {
  const db = drizzle(env.DB, { schema });
  const now = Date.now();
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const todayMs = todayUtc.getTime();
  const reminderCooldownMs = 7 * 24 * 60 * 60 * 1000;

  const activeUsers = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.status, "active"));

  for (const user of activeUsers) {
    if (user.emailVerified !== 1) continue;
    const tree = await getUserTree(db, user.id);
    const dueItems: Array<{ serviceId: string; item: RenewalAlertItem }> = [];

    for (const client of tree) {
      for (const project of client.projects) {
        if (project.status === "archived") continue;
        for (const service of project.services) {
          if (!service.renewalDate || !/^\d{4}-\d{2}-\d{2}$/.test(service.renewalDate)) {
            continue;
          }
          const targetMs = Date.parse(`${service.renewalDate}T00:00:00Z`);
          if (Number.isNaN(targetMs)) continue;
          const daysUntil = Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));
          // Alert if overdue by up to 3 days or due within next 7 days
          if (daysUntil > 7 || daysUntil < -3) continue;
          if (
            service.lastReminderSentAt &&
            now - service.lastReminderSentAt < reminderCooldownMs
          ) {
            continue;
          }

          dueItems.push({
            serviceId: service.id,
            item: {
              clientName: client.name,
              projectName: project.name,
              serviceName: service.name,
              ownerEmail: service.ownerEmail,
              tier: service.tier,
              renewalDate: service.renewalDate,
              daysUntil,
              dashboardUrl: service.dashboardUrl,
            },
          });
        }
      }
    }

    if (dueItems.length === 0) continue;

    const mail = buildRenewalReminderEmail(dueItems.map((d) => d.item));
    const sent = await sendMail(env, { to: user.email, ...mail });
    if (sent.success) {
      const ids = dueItems.map((d) => d.serviceId);
      await db
        .update(schema.services)
        .set({ lastReminderSentAt: now })
        .where(inArray(schema.services.id, ids));
    }
  }
}

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runRenewalReminders(env));
  },
};
