import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { drizzle } from "drizzle-orm/d1";
import { eq, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import * as schema from "./db/schema";

export type Bindings = {
  DB: D1Database;
  APP_PASSWORD?: string;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Development CORS support for localhost:3000
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
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

// Zod schemas
const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  notes: z.string().optional().default(""),
});

const clientUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  notes: z.string().optional(),
});

const projectCreateSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  name: z.string().trim().min(1, "Name is required").max(100),
  details: z.string().optional().default(""),
});

const projectUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  details: z.string().optional(),
});

const serviceCreateSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().optional().default(""),
});

const serviceUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  description: z.string().optional(),
});

const importSchema = z.object({
  clients: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      notes: z.string().default(""),
      createdAt: z.number(),
      updatedAt: z.number(),
      projects: z.array(
        z.object({
          id: z.string(),
          clientId: z.string(),
          name: z.string(),
          details: z.string().default(""),
          createdAt: z.number(),
          updatedAt: z.number(),
          services: z.array(
            z.object({
              id: z.string(),
              projectId: z.string(),
              name: z.string(),
              description: z.string().default(""),
              createdAt: z.number(),
              updatedAt: z.number(),
            })
          ),
        })
      ),
    })
  ),
});

// Auth helper
const COOKIE_NAME = "devnote_token";

const getJwtSecret = (c: any) => c.env.JWT_SECRET || "devnote-fallback-local-jwt-secret";
const getAppPassword = (c: any) => c.env.APP_PASSWORD || "devnote-secret";

// Auth Middleware for protected routes
app.use("/api/*", async (c, next) => {
  // Public routes
  if (c.req.path === "/api/login" || c.req.method === "OPTIONS") {
    return next();
  }

  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verify(token, getJwtSecret(c), "HS256");
    if (!payload || (payload as any).role !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// Auth endpoints
app.post("/api/login", zValidator("json", loginSchema), async (c) => {
  const { password } = c.req.valid("json");
  const expected = getAppPassword(c);

  // Constant-time string comparison
  const enc = new TextEncoder();
  const a = enc.encode(password);
  const b = enc.encode(expected);

  let match = a.length === b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) {
      match = false;
    }
  }

  if (!match) {
    return c.json({ error: "Invalid password" }, 401);
  }

  // 30 days expiry in seconds
  const thirtyDays = 30 * 24 * 60 * 60;
  const exp = Math.floor(Date.now() / 1000) + thirtyDays;
  const token = await sign({ role: "admin", exp }, getJwtSecret(c), "HS256");

  const isDev = c.req.url.startsWith("http://localhost") || c.req.url.startsWith("http://127.0.0.1");
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "Lax",
    path: "/",
    maxAge: thirtyDays,
  });

  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  const isDev = c.req.url.startsWith("http://localhost") || c.req.url.startsWith("http://127.0.0.1");
  deleteCookie(c, COOKIE_NAME, {
    path: "/",
    secure: !isDev,
    sameSite: "Lax",
  });
  return c.json({ ok: true });
});

app.get("/api/me", (c) => {
  return c.json({ authenticated: true });
});

// Tree endpoint: returns all clients with nested projects and services
app.get("/api/tree", async (c) => {
  const db = drizzle(c.env.DB, { schema });

  const clientList = await db.select().from(schema.clients).orderBy(asc(schema.clients.createdAt));
  const projectList = await db.select().from(schema.projects).orderBy(asc(schema.projects.createdAt));
  const serviceList = await db.select().from(schema.services).orderBy(asc(schema.services.createdAt));

  const servicesByProject = new Map<string, typeof serviceList>();
  for (const s of serviceList) {
    const list = servicesByProject.get(s.projectId) || [];
    list.push(s);
    servicesByProject.set(s.projectId, list);
  }

  const projectsByClient = new Map<string, Array<schema.Project & { services: schema.Service[] }>>();
  for (const p of projectList) {
    const list = projectsByClient.get(p.clientId) || [];
    list.push({
      ...p,
      services: servicesByProject.get(p.id) || [],
    });
    projectsByClient.set(p.clientId, list);
  }

  const tree = clientList.map((client) => ({
    ...client,
    projects: projectsByClient.get(client.id) || [],
  }));

  return c.json({ clients: tree });
});

// Clients CRUD
app.post("/api/clients", zValidator("json", clientCreateSchema), async (c) => {
  const { name, notes } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });
  const now = Date.now();
  const newClient = {
    id: crypto.randomUUID(),
    name,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.clients).values(newClient);
  return c.json({ ...newClient, projects: [] }, 201);
});

app.patch("/api/clients/:id", zValidator("json", clientUpdateSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db.select().from(schema.clients).where(eq(schema.clients.id, id)).get();
  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  const updated = {
    ...data,
    updatedAt: Date.now(),
  };

  await db.update(schema.clients).set(updated).where(eq(schema.clients.id, id));
  const result = await db.select().from(schema.clients).where(eq(schema.clients.id, id)).get();
  return c.json(result);
});

app.delete("/api/clients/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  // Cascade delete in SQLite
  // D1 supports foreign keys when enabled, or manual cascade for safety
  const projects = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.clientId, id));
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length > 0) {
    await db.delete(schema.services).where(inArray(schema.services.projectId, projectIds));
    await db.delete(schema.projects).where(eq(schema.projects.clientId, id));
  }
  await db.delete(schema.clients).where(eq(schema.clients.id, id));

  return c.json({ ok: true });
});

// Projects CRUD
app.post("/api/projects", zValidator("json", projectCreateSchema), async (c) => {
  const { clientId, name, details } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const client = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).get();
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
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const updated = {
    ...data,
    updatedAt: Date.now(),
  };

  await db.update(schema.projects).set(updated).where(eq(schema.projects.id, id));
  const result = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  return c.json(result);
});

app.delete("/api/projects/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  await db.delete(schema.services).where(eq(schema.services.projectId, id));
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  return c.json({ ok: true });
});

// Services CRUD
app.post("/api/services", zValidator("json", serviceCreateSchema), async (c) => {
  const { projectId, name, description } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const project = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!project) {
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
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  const existing = await db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const updated = {
    ...data,
    updatedAt: Date.now(),
  };

  await db.update(schema.services).set(updated).where(eq(schema.services.id, id));
  const result = await db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  return c.json(result);
});

app.delete("/api/services/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  await db.delete(schema.services).where(eq(schema.services.id, id));
  return c.json({ ok: true });
});

// Export / Import
app.get("/api/export", async (c) => {
  const db = drizzle(c.env.DB, { schema });

  const clientList = await db.select().from(schema.clients).orderBy(asc(schema.clients.createdAt));
  const projectList = await db.select().from(schema.projects).orderBy(asc(schema.projects.createdAt));
  const serviceList = await db.select().from(schema.services).orderBy(asc(schema.services.createdAt));

  const servicesByProject = new Map<string, typeof serviceList>();
  for (const s of serviceList) {
    const list = servicesByProject.get(s.projectId) || [];
    list.push(s);
    servicesByProject.set(s.projectId, list);
  }

  const projectsByClient = new Map<string, Array<schema.Project & { services: schema.Service[] }>>();
  for (const p of projectList) {
    const list = projectsByClient.get(p.clientId) || [];
    list.push({
      ...p,
      services: servicesByProject.get(p.id) || [],
    });
    projectsByClient.set(p.clientId, list);
  }

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    clients: clientList.map((client) => ({
      ...client,
      projects: projectsByClient.get(client.id) || [],
    })),
  };

  return c.json(exportData);
});

app.post("/api/import", zValidator("json", importSchema), async (c) => {
  const { clients: importedClients } = c.req.valid("json");
  const db = drizzle(c.env.DB, { schema });

  // Clear existing
  await db.delete(schema.services);
  await db.delete(schema.projects);
  await db.delete(schema.clients);

  for (const client of importedClients) {
    await db.insert(schema.clients).values({
      id: client.id,
      name: client.name,
      notes: client.notes || "",
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });

    for (const project of client.projects) {
      await db.insert(schema.projects).values({
        id: project.id,
        clientId: client.id,
        name: project.name,
        details: project.details || "",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });

      for (const service of project.services) {
        await db.insert(schema.services).values({
          id: service.id,
          projectId: project.id,
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

export default app;
