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

export type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
};

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

// 3. CSRF Origin check on state-changing API requests
app.use("/api/*", async (c, next) => {
  if (!isValidCsrfOrigin(c)) {
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

const projectCreateSchema = z
  .object({
    clientId: z.string().min(1, "Client ID is required").max(64),
    name: z.string().trim().min(1, "Name is required").max(100),
    details: z.string().max(50000).optional().default(""),
  })
  .strict();

const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    details: z.string().max(50000).optional(),
  })
  .strict();

const serviceCreateSchema = z
  .object({
    projectId: z.string().min(1, "Project ID is required").max(64),
    name: z.string().trim().min(1, "Name is required").max(100),
    description: z.string().max(50000).optional().default(""),
  })
  .strict();

const serviceUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    description: z.string().max(50000).optional(),
  })
  .strict();

const adminUpdateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
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
            createdAt: z.number(),
            updatedAt: z.number(),
            services: z.array(
              z.object({
                id: z.string().min(1).max(64),
                projectId: z.string().min(1).max(64),
                name: z.string().min(1).max(100),
                description: z.string().max(50000).default(""),
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

// Helper to resolve current user from access token or rotate via refresh token
async function authenticateRequest(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<PublicUser | null> {
  const db = drizzle(c.env.DB, { schema });
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
          // Ensure default admin email always retains admin role
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
          return toPublicUser(userRow);
        }
      }
    } catch {
      // Access token expired or invalid — fall through to refresh token check
    }
  }

  // Try silent rotation with refresh cookie
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
    // Reuse of a revoked token: revoke all sessions for this user
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

  // Rotate refresh token
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
  return pubUser;
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

  // If the default admin signs up, claim any legacy unowned clients rows
  if (role === "admin") {
    await db
      .update(schema.clients)
      .set({ userId })
      .where(isNull(schema.clients.userId));
  }

  const refreshToken = generateOpaqueToken();
  const refreshHash = await sha256Hex(refreshToken);

  await db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    userId,
    refreshTokenHash: refreshHash,
    expiresAt: now + REFRESH_TTL_SEC * 1000,
    revokedAt: null,
    userAgent: c.req.header("User-Agent")?.slice(0, 200) || "",
    ipAddress: ip,
    createdAt: now,
  });

  const pubUser = toPublicUser(newUser as schema.User);
  await issueAuthCookies(c, pubUser, refreshToken);

  return c.json({ ok: true, user: pubUser }, 201);
});

app.post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
  const { identifier, password } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });
  const ip = getClientIp(c);

  // Rate limit: 10 attempts / 15 min per IP and per identifier
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
    // Timing equalization
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

  // Ensure default admin email always has admin role
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

app.post("/api/auth/refresh", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const ip = getClientIp(c);

  const rl = await checkRateLimit(db, `refresh:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Too many requests" }, 429);
  }

  const user = await authenticateRequest(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ ok: true, user });
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
  "/api/auth/refresh",
  "/api/auth/logout",
]);

app.use("/api/*", async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path) || c.req.method === "OPTIONS") {
    return next();
  }

  const user = await authenticateRequest(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
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
  const { clientId, name, details } = c.req.valid("json");
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
  const { projectId, name, description } = c.req.valid("json");
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

  await db
    .update(schema.services)
    .set({ ...data, updatedAt: Date.now() })
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
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });

      for (const service of project.services) {
        await db.insert(schema.services).values({
          id: crypto.randomUUID(),
          projectId: newProjectId,
          name: service.name,
          description: service.description || "",
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
        });
      }
    }
  }

  return c.json({ ok: true, count: importedClients.length });
});

// ================= ADMIN API (/api/admin/*) =================
app.use("/api/admin/*", async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin" || user.status !== "active") {
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

export default app;
