import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "../db/schema";

const PROTOCOL_VERSION = "2024-11-05";

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
      "Search across all clients, projects, and service descriptions (emails, domains, tiers, notes) by keyword.",
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
        details: {
          type: "string",
          description: "Optional markdown notes/architecture details for the project",
        },
      },
      required: ["clientId", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_project",
    description: "Update an existing project's name or markdown notes.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID of the project" },
        name: { type: "string", description: "Updated project name" },
        details: { type: "string", description: "Updated markdown notes" },
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
        name: {
          type: "string",
          description: "Service name (e.g. 'Supabase', 'Vercel', 'Cloudflare')",
        },
        description: {
          type: "string",
          description: "Markdown description: owner email, tier, region, domain, or notes",
        },
      },
      required: ["projectId", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_service",
    description: "Update an existing service's name or markdown description.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: { type: "string", description: "UUID of the service" },
        name: { type: "string", description: "Updated service name" },
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
  })
  .strict();
const updateProjectArgs = z
  .object({
    projectId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100).optional(),
    details: z.string().max(50000).optional(),
  })
  .strict();
const deleteProjectArgs = z.object({ projectId: z.string().min(1).max(64) }).strict();

const createServiceArgs = z
  .object({
    projectId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(50000).optional().default(""),
  })
  .strict();
const updateServiceArgs = z
  .object({
    serviceId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(50000).optional(),
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
      }> = [];
      const matchingServices: Array<{
        id: string;
        projectId: string;
        projectName: string;
        clientId: string;
        clientName: string;
        name: string;
        description: string;
      }> = [];

      for (const c of tree) {
        for (const p of c.projects) {
          if (p.name.toLowerCase().includes(q) || p.details.toLowerCase().includes(q)) {
            matchingProjects.push({
              id: p.id,
              clientId: c.id,
              clientName: c.name,
              name: p.name,
              details: p.details,
            });
          }
          for (const s of p.services) {
            if (
              s.name.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q)
            ) {
              matchingServices.push({
                id: s.id,
                projectId: p.id,
                projectName: p.name,
                clientId: c.id,
                clientName: c.name,
                name: s.name,
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
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.projects).values(project);
      return { created: project };
    }

    case "update_project": {
      const { projectId, name: newName, details } = updateProjectArgs.parse(args);
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
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.services).values(service);
      return { created: service };
    }

    case "update_service": {
      const { serviceId, name: newName, description } = updateServiceArgs.parse(args);
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

  // Notifications have no id and expect no response object
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
          version: "1.0.0",
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
