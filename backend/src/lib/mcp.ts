import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "../db/schema";

const PROTOCOL_VERSION = "2024-11-05";

const EMAIL_EXTRACT_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "URL must start with http:// or https://");

const optionalOwnerEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email");

const optionalDateYmd = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date must be YYYY-MM-DD");

export const MCP_TOOLS = [
  {
    name: "get_workspace_tree",
    description:
      "Fetch the entire devnote hierarchy (Clients -> Projects -> Services) for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "search_workspace",
    description:
      "Search across all clients, projects, and services (names, owner emails, dashboard URLs, tiers, descriptions) by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive search keyword (e.g. 'supabase', 'acme', 'ops@')",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_by_account",
    description:
      "Reverse lookup: group all services and projects by owner email address. Optionally filter to one email address.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Optional email filter (case-insensitive substring or exact email)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "sync_project_stack",
    description:
      "Idempotently create or update a Client, Project (liveUrl, repoUrl, status, details), and its Services list in one call. Ideal for logging a repository's stack straight from your IDE.",
    inputSchema: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Client or group name (e.g. 'Personal', 'Byzo', 'Acme')" },
        projectName: { type: "string", description: "Project name (e.g. 'devnote', 'uuprint')" },
        details: { type: "string", description: "Optional project notes" },
        liveUrl: { type: "string", description: "Optional production URL (https://...)" },
        repoUrl: { type: "string", description: "Optional Git repository URL (https://...)" },
        status: {
          type: "string",
          enum: ["active", "paused", "archived"],
          description: "Project status (default: active)",
        },
        services: {
          type: "array",
          description: "List of services to upsert on this project (matched case-insensitively by name)",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              ownerEmail: { type: "string" },
              dashboardUrl: { type: "string" },
              tier: { type: "string", enum: ["", "free", "paid", "trial"] },
              renewalDate: { type: "string", description: "YYYY-MM-DD" },
              description: { type: "string" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["clientName", "projectName", "services"],
      additionalProperties: false,
    },
  },
  {
    name: "get_project",
    description:
      "Get full details and all services/accounts for a specific project by projectId.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID of the project" },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_client",
    description: "Create a new client in devnote.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Client name (1-100 chars)" },
        notes: { type: "string", description: "Optional markdown notes about the client" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_client",
    description: "Update an existing client's name or notes.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "UUID of the client" },
        name: { type: "string", description: "Updated client name" },
        notes: { type: "string", description: "Updated markdown notes" },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_client",
    description: "Delete a client and cascade-delete all its projects and services.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "UUID of the client to delete" },
      },
      required: ["clientId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_project",
    description: "Create a new project under an existing client.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "UUID of the parent client" },
        name: { type: "string", description: "Project name (1-100 chars)" },
        details: { type: "string", description: "Optional markdown notes" },
        liveUrl: { type: "string", description: "Optional live site URL (https://...)" },
        repoUrl: { type: "string", description: "Optional Git repository URL (https://...)" },
        status: { type: "string", enum: ["active", "paused", "archived"] },
      },
      required: ["clientId", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_project",
    description: "Update an existing project's name, notes, links, or status.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID of the project" },
        name: { type: "string", description: "Updated project name" },
        details: { type: "string", description: "Updated markdown notes" },
        liveUrl: { type: "string", description: "Updated live URL" },
        repoUrl: { type: "string", description: "Updated Git repo URL" },
        status: { type: "string", enum: ["active", "paused", "archived"] },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_project",
    description: "Delete a project and cascade-delete all its services.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID of the project to delete" },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_service",
    description:
      "Add a cloud service/account (e.g. Supabase, Vercel, Cloudflare, Stripe) to a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID of the parent project" },
        name: { type: "string", description: "Service name (e.g. 'Supabase', 'Vercel', 'Cloudflare')" },
        ownerEmail: { type: "string", description: "Owner account email address" },
        dashboardUrl: { type: "string", description: "Direct dashboard URL (https://...)" },
        tier: { type: "string", enum: ["", "free", "paid", "trial"] },
        renewalDate: { type: "string", description: "Optional renewal/expiry date (YYYY-MM-DD)" },
        description: { type: "string", description: "Additional markdown notes" },
      },
      required: ["projectId", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_service",
    description: "Update an existing service's name, owner email, dashboard URL, tier, renewal date, or description.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "UUID of the service" },
        name: { type: "string", description: "Updated service name" },
        ownerEmail: { type: "string", description: "Updated owner email" },
        dashboardUrl: { type: "string", description: "Updated dashboard URL" },
        tier: { type: "string", enum: ["", "free", "paid", "trial"] },
        renewalDate: { type: "string", description: "Updated renewal date (YYYY-MM-DD)" },
        description: { type: "string", description: "Updated markdown description" },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_service",
    description: "Delete a service card from a project.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "UUID of the service to delete" },
      },
      required: ["serviceId"],
      additionalProperties: false,
    },
  },
];

// Strict Zod schemas for tool arguments
const searchArgs = z.object({ query: z.string().trim().min(1).max(200) }).strict();
const listByAccountArgs = z
  .object({ email: z.string().trim().toLowerCase().max(160).optional() })
  .strict();
const syncStackArgs = z
  .object({
    clientName: z.string().trim().min(1).max(100),
    projectName: z.string().trim().min(1).max(100),
    details: z.string().max(50000).optional(),
    liveUrl: optionalHttpUrl.optional(),
    repoUrl: optionalHttpUrl.optional(),
    status: z.enum(["active", "paused", "archived"]).optional(),
    services: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            ownerEmail: optionalOwnerEmail.optional(),
            dashboardUrl: optionalHttpUrl.optional(),
            tier: z.enum(["", "free", "paid", "trial"]).optional(),
            renewalDate: optionalDateYmd.optional(),
            description: z.string().max(50000).optional(),
          })
          .strict()
      )
      .max(40),
  })
  .strict();
const getProjectArgs = z.object({ projectId: z.string().min(1).max(64) }).strict();
const createClientArgs = z
  .object({
    name: z.string().trim().min(1).max(100),
    notes: z.string().max(20000).optional().default(""),
  })
  .strict();
const updateClientArgs = z
  .object({
    clientId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100).optional(),
    notes: z.string().max(20000).optional(),
  })
  .strict();
const deleteClientArgs = z.object({ clientId: z.string().min(1).max(64) }).strict();

const createProjectArgs = z
  .object({
    clientId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100),
    details: z.string().max(50000).optional().default(""),
    liveUrl: optionalHttpUrl.optional().default(""),
    repoUrl: optionalHttpUrl.optional().default(""),
    status: z.enum(["active", "paused", "archived"]).optional().default("active"),
  })
  .strict();
const updateProjectArgs = z
  .object({
    projectId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100).optional(),
    details: z.string().max(50000).optional(),
    liveUrl: optionalHttpUrl.optional(),
    repoUrl: optionalHttpUrl.optional(),
    status: z.enum(["active", "paused", "archived"]).optional(),
  })
  .strict();
const deleteProjectArgs = z.object({ projectId: z.string().min(1).max(64) }).strict();

const createServiceArgs = z
  .object({
    projectId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(50000).optional().default(""),
    ownerEmail: optionalOwnerEmail.optional().default(""),
    dashboardUrl: optionalHttpUrl.optional().default(""),
    tier: z.enum(["", "free", "paid", "trial"]).optional().default(""),
    renewalDate: optionalDateYmd.optional().default(""),
  })
  .strict();
const updateServiceArgs = z
  .object({
    serviceId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(50000).optional(),
    ownerEmail: optionalOwnerEmail.optional(),
    dashboardUrl: optionalHttpUrl.optional(),
    tier: z.enum(["", "free", "paid", "trial"]).optional(),
    renewalDate: optionalDateYmd.optional(),
  })
  .strict();
const deleteServiceArgs = z.object({ serviceId: z.string().min(1).max(64) }).strict();

async function loadUserTree(
  db: DrizzleD1Database<typeof schema>,
  userId: string
): Promise<schema.ClientWithProjects[]> {
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

async function callMcpTool(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  name: string,
  rawArgs: unknown
): Promise<unknown> {
  const args = rawArgs ?? {};
  const now = Date.now();

  switch (name) {
    case "get_workspace_tree": {
      const clients = await loadUserTree(db, userId);
      return { clients };
    }

    case "search_workspace": {
      const { query } = searchArgs.parse(args);
      const q = query.toLowerCase();
      const tree = await loadUserTree(db, userId);

      const matchingClients = tree
        .filter((c) => c.name.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q))
        .map((c) => ({ id: c.id, name: c.name, notes: c.notes }));

      const matchingProjects: Array<{
        id: string;
        clientId: string;
        clientName: string;
        name: string;
        details: string;
        liveUrl: string;
        repoUrl: string;
        status: string;
      }> = [];
      const matchingServices: Array<{
        id: string;
        projectId: string;
        projectName: string;
        clientId: string;
        clientName: string;
        name: string;
        ownerEmail: string;
        dashboardUrl: string;
        tier: string;
        renewalDate: string;
        description: string;
      }> = [];

      for (const c of tree) {
        for (const p of c.projects) {
          if (
            p.name.toLowerCase().includes(q) ||
            p.details.toLowerCase().includes(q) ||
            p.liveUrl.toLowerCase().includes(q) ||
            p.repoUrl.toLowerCase().includes(q)
          ) {
            matchingProjects.push({
              id: p.id,
              clientId: c.id,
              clientName: c.name,
              name: p.name,
              details: p.details,
              liveUrl: p.liveUrl,
              repoUrl: p.repoUrl,
              status: p.status,
            });
          }
          for (const s of p.services) {
            if (
              s.name.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              s.ownerEmail.toLowerCase().includes(q) ||
              s.dashboardUrl.toLowerCase().includes(q) ||
              s.tier.toLowerCase().includes(q)
            ) {
              matchingServices.push({
                id: s.id,
                projectId: p.id,
                projectName: p.name,
                clientId: c.id,
                clientName: c.name,
                name: s.name,
                ownerEmail: s.ownerEmail,
                dashboardUrl: s.dashboardUrl,
                tier: s.tier,
                renewalDate: s.renewalDate,
                description: s.description,
              });
            }
          }
        }
      }

      return {
        query,
        clients: matchingClients,
        projects: matchingProjects,
        services: matchingServices,
      };
    }

    case "list_by_account": {
      const { email } = listByAccountArgs.parse(args);
      const tree = await loadUserTree(db, userId);
      const groups = new Map<
        string,
        Array<{
          serviceId: string;
          serviceName: string;
          tier: string;
          dashboardUrl: string;
          renewalDate: string;
          projectId: string;
          projectName: string;
          clientId: string;
          clientName: string;
        }>
      >();

      for (const c of tree) {
        for (const p of c.projects) {
          for (const s of p.services) {
            const resolvedEmail = (
              s.ownerEmail ||
              s.description.match(EMAIL_EXTRACT_RE)?.[0] ||
              ""
            )
              .trim()
              .toLowerCase();
            if (!resolvedEmail) continue;
            if (email && !resolvedEmail.includes(email)) continue;

            const list = groups.get(resolvedEmail) || [];
            list.push({
              serviceId: s.id,
              serviceName: s.name,
              tier: s.tier,
              dashboardUrl: s.dashboardUrl,
              renewalDate: s.renewalDate,
              projectId: p.id,
              projectName: p.name,
              clientId: c.id,
              clientName: c.name,
            });
            groups.set(resolvedEmail, list);
          }
        }
      }

      return {
        accounts: Array.from(groups.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .map(([accountEmail, services]) => ({
            email: accountEmail,
            serviceCount: services.length,
            services,
          })),
      };
    }

    case "sync_project_stack": {
      const data = syncStackArgs.parse(args);
      const tree = await loadUserTree(db, userId);

      let client = tree.find(
        (c) => c.name.trim().toLowerCase() === data.clientName.toLowerCase()
      );
      let clientId = client?.id;

      if (!clientId) {
        clientId = crypto.randomUUID();
        await db.insert(schema.clients).values({
          id: clientId,
          userId,
          name: data.clientName,
          notes: "",
          createdAt: now,
          updatedAt: now,
        });
      }

      let project = client?.projects.find(
        (p) => p.name.trim().toLowerCase() === data.projectName.toLowerCase()
      );
      let projectId = project?.id;

      if (!projectId) {
        projectId = crypto.randomUUID();
        await db.insert(schema.projects).values({
          id: projectId,
          clientId,
          name: data.projectName,
          details: data.details ?? "",
          liveUrl: data.liveUrl ?? "",
          repoUrl: data.repoUrl ?? "",
          status: data.status ?? "active",
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const patch: Partial<schema.NewProject> = { updatedAt: now };
        if (data.details !== undefined) patch.details = data.details;
        if (data.liveUrl !== undefined) patch.liveUrl = data.liveUrl;
        if (data.repoUrl !== undefined) patch.repoUrl = data.repoUrl;
        if (data.status !== undefined) patch.status = data.status;
        await db
          .update(schema.projects)
          .set(patch)
          .where(eq(schema.projects.id, projectId));
      }

      const existingServices = project?.services ?? [];
      let createdServices = 0;
      let updatedServices = 0;

      for (const svc of data.services) {
        const match = existingServices.find(
          (s) => s.name.trim().toLowerCase() === svc.name.toLowerCase()
        );
        if (match) {
          const patch: Partial<schema.NewService> = { updatedAt: now };
          if (svc.ownerEmail !== undefined) patch.ownerEmail = svc.ownerEmail;
          if (svc.dashboardUrl !== undefined) patch.dashboardUrl = svc.dashboardUrl;
          if (svc.tier !== undefined) patch.tier = svc.tier;
          if (svc.renewalDate !== undefined) patch.renewalDate = svc.renewalDate;
          if (svc.description !== undefined) patch.description = svc.description;
          await db
            .update(schema.services)
            .set(patch)
            .where(eq(schema.services.id, match.id));
          updatedServices++;
        } else {
          await db.insert(schema.services).values({
            id: crypto.randomUUID(),
            projectId,
            name: svc.name,
            description: svc.description ?? "",
            ownerEmail: svc.ownerEmail ?? "",
            dashboardUrl: svc.dashboardUrl ?? "",
            tier: svc.tier ?? "",
            renewalDate: svc.renewalDate ?? "",
            lastReminderSentAt: null,
            createdAt: now,
            updatedAt: now,
          });
          createdServices++;
        }
      }

      return {
        ok: true,
        clientId,
        projectId,
        createdServices,
        updatedServices,
      };
    }

    case "get_project": {
      const { projectId } = getProjectArgs.parse(args);
      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!project) throw new Error("Project not found");

      const client = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!client) throw new Error("Project not found");

      const services = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.projectId, projectId))
        .orderBy(asc(schema.services.createdAt));

      return {
        client: { id: client.id, name: client.name },
        project: { ...project, services },
      };
    }

    case "create_client": {
      const data = createClientArgs.parse(args);
      const client = {
        id: crypto.randomUUID(),
        userId,
        name: data.name,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.clients).values(client);
      return { created: client };
    }

    case "update_client": {
      const { clientId, name: newName, notes } = updateClientArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!existing) throw new Error("Client not found");

      const patch: Partial<schema.NewClient> = { updatedAt: now };
      if (newName !== undefined) patch.name = newName;
      if (notes !== undefined) patch.notes = notes;

      await db
        .update(schema.clients)
        .set(patch)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)));
      const updated = await db
        .select()
        .from(schema.clients)
        .where(eq(schema.clients.id, clientId))
        .get();
      return { updated };
    }

    case "delete_client": {
      const { clientId } = deleteClientArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!existing) throw new Error("Client not found");

      const projs = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.clientId, clientId));
      const pIds = projs.map((p) => p.id);
      if (pIds.length > 0) {
        await db.delete(schema.services).where(inArray(schema.services.projectId, pIds));
        await db.delete(schema.projects).where(eq(schema.projects.clientId, clientId));
      }
      await db
        .delete(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)));
      return { deletedClientId: clientId, name: existing.name };
    }

    case "create_project": {
      const data = createProjectArgs.parse(args);
      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, data.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Parent client not found");

      const project = {
        id: crypto.randomUUID(),
        clientId: data.clientId,
        name: data.name,
        details: data.details,
        liveUrl: data.liveUrl,
        repoUrl: data.repoUrl,
        status: data.status,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.projects).values(project);
      return { created: project };
    }

    case "update_project": {
      const { projectId, name: newName, details, liveUrl, repoUrl, status } =
        updateProjectArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!existing) throw new Error("Project not found");

      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(
          and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, userId))
        )
        .get();
      if (!ownerClient) throw new Error("Project not found");

      const patch: Partial<schema.NewProject> = { updatedAt: now };
      if (newName !== undefined) patch.name = newName;
      if (details !== undefined) patch.details = details;
      if (liveUrl !== undefined) patch.liveUrl = liveUrl;
      if (repoUrl !== undefined) patch.repoUrl = repoUrl;
      if (status !== undefined) patch.status = status;

      await db.update(schema.projects).set(patch).where(eq(schema.projects.id, projectId));
      const updated = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      return { updated };
    }

    case "delete_project": {
      const { projectId } = deleteProjectArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!existing) throw new Error("Project not found");

      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(
          and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, userId))
        )
        .get();
      if (!ownerClient) throw new Error("Project not found");

      await db.delete(schema.services).where(eq(schema.services.projectId, projectId));
      await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
      return { deletedProjectId: projectId, name: existing.name };
    }

    case "create_service": {
      const data = createServiceArgs.parse(args);
      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, data.projectId))
        .get();
      if (!project) throw new Error("Parent project not found");

      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(
          and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId))
        )
        .get();
      if (!ownerClient) throw new Error("Parent project not found");

      const service = {
        id: crypto.randomUUID(),
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        ownerEmail: data.ownerEmail,
        dashboardUrl: data.dashboardUrl,
        tier: data.tier,
        renewalDate: data.renewalDate,
        lastReminderSentAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.services).values(service);
      return { created: service };
    }

    case "update_service": {
      const {
        serviceId,
        name: newName,
        description,
        ownerEmail,
        dashboardUrl,
        tier,
        renewalDate,
      } = updateServiceArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, serviceId))
        .get();
      if (!existing) throw new Error("Service not found");

      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, existing.projectId))
        .get();
      if (!project) throw new Error("Service not found");

      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(
          and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId))
        )
        .get();
      if (!ownerClient) throw new Error("Service not found");

      const patch: Partial<schema.NewService> = { updatedAt: now };
      if (newName !== undefined) patch.name = newName;
      if (description !== undefined) patch.description = description;
      if (ownerEmail !== undefined) patch.ownerEmail = ownerEmail;
      if (dashboardUrl !== undefined) patch.dashboardUrl = dashboardUrl;
      if (tier !== undefined) patch.tier = tier;
      if (renewalDate !== undefined) {
        patch.renewalDate = renewalDate;
        if (renewalDate !== existing.renewalDate) {
          patch.lastReminderSentAt = null;
        }
      }

      await db.update(schema.services).set(patch).where(eq(schema.services.id, serviceId));
      const updated = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, serviceId))
        .get();
      return { updated };
    }

    case "delete_service": {
      const { serviceId } = deleteServiceArgs.parse(args);
      const existing = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, serviceId))
        .get();
      if (!existing) throw new Error("Service not found");

      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, existing.projectId))
        .get();
      if (!project) throw new Error("Service not found");

      const ownerClient = await db
        .select()
        .from(schema.clients)
        .where(
          and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId))
        )
        .get();
      if (!ownerClient) throw new Error("Service not found");

      await db.delete(schema.services).where(eq(schema.services.id, serviceId));
      return { deletedServiceId: serviceId, name: existing.name };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export async function handleMcpJsonRpc(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  payload: unknown
): Promise<Record<string, unknown> | null> {
  if (!payload || typeof payload !== "object") {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    };
  }

  const req = payload as JsonRpcRequest;
  const id = req.id !== undefined ? req.id : null;

  if (req.method === "notifications/initialized" || req.method === "notifications/cancelled") {
    return null;
  }

  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "devnote-mcp",
          version: "1.1.0",
        },
      },
    };
  }

  if (req.method === "ping") {
    return {
      jsonrpc: "2.0",
      id,
      result: {},
    };
  }

  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (req.method === "tools/call") {
    const toolName =
      req.params && typeof req.params.name === "string" ? req.params.name : "";
    const toolArgs = req.params?.arguments ?? {};

    if (!toolName) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Missing tool name" },
      };
    }

    try {
      const output = await callMcpTool(db, userId, toolName, toolArgs);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(output, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tool execution failed";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Error: ${msg}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${req.method}` },
  };
}
