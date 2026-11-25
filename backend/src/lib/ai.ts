import { and, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import * as schema from "../db/schema";

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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

export const aiActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create_client"),
      tempId: z.string().max(64).optional(),
      name: z.string().trim().min(1).max(100),
      notes: z.string().max(20000).optional().default(""),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_client"),
      clientId: z.string().min(1).max(64),
      clientName: z.string().max(100).optional(),
      name: z.string().trim().min(1).max(100).optional(),
      notes: z.string().max(20000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("delete_client"),
      clientId: z.string().min(1).max(64),
      clientName: z.string().max(100).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("create_project"),
      tempId: z.string().max(64).optional(),
      clientId: z.string().min(1).max(64),
      clientName: z.string().max(100).optional(),
      name: z.string().trim().min(1).max(100),
      details: z.string().max(50000).optional().default(""),
      liveUrl: optionalHttpUrl.optional().default(""),
      repoUrl: optionalHttpUrl.optional().default(""),
      status: z.enum(["active", "paused", "archived"]).optional().default("active"),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_project"),
      projectId: z.string().min(1).max(64),
      projectName: z.string().max(100).optional(),
      name: z.string().trim().min(1).max(100).optional(),
      details: z.string().max(50000).optional(),
      liveUrl: optionalHttpUrl.optional(),
      repoUrl: optionalHttpUrl.optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("delete_project"),
      projectId: z.string().min(1).max(64),
      projectName: z.string().max(100).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("create_service"),
      projectId: z.string().min(1).max(64),
      projectName: z.string().max(100).optional(),
      name: z.string().trim().min(1).max(100),
      description: z.string().max(50000).optional().default(""),
      ownerEmail: optionalOwnerEmail.optional().default(""),
      dashboardUrl: optionalHttpUrl.optional().default(""),
      tier: z.enum(["", "free", "paid", "trial"]).optional().default(""),
      renewalDate: optionalDateYmd.optional().default(""),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_service"),
      serviceId: z.string().min(1).max(64),
      serviceName: z.string().max(100).optional(),
      name: z.string().trim().min(1).max(100).optional(),
      description: z.string().max(50000).optional(),
      ownerEmail: optionalOwnerEmail.optional(),
      dashboardUrl: optionalHttpUrl.optional(),
      tier: z.enum(["", "free", "paid", "trial"]).optional(),
      renewalDate: optionalDateYmd.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("delete_service"),
      serviceId: z.string().min(1).max(64),
      serviceName: z.string().max(100).optional(),
    })
    .strict(),
]);

export type AiAction = z.infer<typeof aiActionSchema>;

export const aiChatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(4000),
          })
          .strict()
      )
      .min(1)
      .max(24),
    activeClientId: z.string().max(64).optional(),
    activeProjectId: z.string().max(64).optional(),
  })
  .strict();

export const aiExecuteRequestSchema = z
  .object({
    actions: z.array(aiActionSchema).min(1).max(20),
  })
  .strict();

interface ModelJsonReply {
  reply: string;
  proposedActions: AiAction[];
}

function buildSystemPrompt(
  tree: schema.ClientWithProjects[],
  activeClientId?: string,
  activeProjectId?: string
): string {
  const workspaceSnapshot = tree.map((c) => ({
    id: c.id,
    name: c.name,
    notes: c.notes,
    projects: c.projects.map((p) => ({
      id: p.id,
      name: p.name,
      details: p.details,
      liveUrl: p.liveUrl,
      repoUrl: p.repoUrl,
      status: p.status,
      services: p.services.map((s) => ({
        id: s.id,
        name: s.name,
        ownerEmail: s.ownerEmail,
        dashboardUrl: s.dashboardUrl,
        tier: s.tier,
        renewalDate: s.renewalDate,
        description: s.description,
      })),
    })),
  }));

  return `You are the devnote AI assistant. You help developers query and manage their Clients -> Projects -> Services ledger.

CURRENT USER WORKSPACE DATA (JSON):
${JSON.stringify(workspaceSnapshot)}

ACTIVE SELECTION IN UI:
- activeClientId: ${activeClientId || "none"}
- activeProjectId: ${activeProjectId || "none"}

STRICT RULES:
1. READ QUERIES: When the user asks about clients, projects, or services (e.g., list services for a project, find which email owns Supabase, summarize everything under an email), answer accurately using ONLY the workspace data above. Format emails, domains, and IDs in inline code backticks so they become copyable chips.
2. WRITE INTENT (ADD / UPDATE / DELETE):
   - NEVER assume missing critical info. If you are not sure which client or project an item belongs to, or if the name/details are unclear, ask a brief, direct clarifying question and return "proposedActions": [].
   - Always populate structured fields when the user provides them:
     * Projects: "liveUrl" (https://...), "repoUrl" (https://github.com/...), "status" ("active" | "paused" | "archived")
     * Services: "ownerEmail" (email address), "dashboardUrl" (https://...), "tier" ("free" | "paid" | "trial" | ""), "renewalDate" ("YYYY-MM-DD")
   - When you have enough information to propose changes, populate "proposedActions" with exact structured actions AND write a concise "reply" summarizing what will be changed and asking the user to click "Confirm & Apply" or tell you what to modify.
   - If the user asks to change something in a previous unconfirmed proposal, output the updated "proposedActions" list and ask for confirmation again.
   - When creating a new client AND projects/services in the same proposal, assign a "tempId" (e.g., "temp_client_1", "temp_project_1") and reference it in the child action's "clientId" or "projectId".
   - Always include human-readable "clientName", "projectName", or "serviceName" alongside IDs for clarity in the confirmation card.
   - Never fabricate IDs for existing items; use only real IDs from the workspace JSON above or tempIds created earlier in the same proposedActions array.
3. OUTPUT FORMAT: Respond with ONLY a valid JSON object matching this exact shape:
{
  "reply": "Your concise markdown response to the user",
  "proposedActions": [
    // Zero or more action objects from the allowed types:
    // { "type": "create_client", "tempId"?: "temp_client_1", "name": "...", "notes"?: "..." }
    // { "type": "update_client", "clientId": "...", "clientName"?: "...", "name"?: "...", "notes"?: "..." }
    // { "type": "delete_client", "clientId": "...", "clientName"?: "..." }
    // { "type": "create_project", "tempId"?: "temp_project_1", "clientId": "...", "clientName"?: "...", "name": "...", "details"?: "...", "liveUrl"?: "...", "repoUrl"?: "...", "status"?: "active" }
    // { "type": "update_project", "projectId": "...", "projectName"?: "...", "name"?: "...", "details"?: "...", "liveUrl"?: "...", "repoUrl"?: "...", "status"?: "..." }
    // { "type": "delete_project", "projectId": "...", "projectName"?: "..." }
    // { "type": "create_service", "projectId": "...", "projectName"?: "...", "name": "...", "description"?: "...", "ownerEmail"?: "...", "dashboardUrl"?: "...", "tier"?: "free"|"paid"|"trial"|"", "renewalDate"?: "YYYY-MM-DD" }
    // { "type": "update_service", "serviceId": "...", "serviceName"?: "...", "name"?: "...", "description"?: "...", "ownerEmail"?: "...", "dashboardUrl"?: "...", "tier"?: "...", "renewalDate"?: "..." }
    // { "type": "delete_service", "serviceId": "...", "serviceName"?: "..." }
  ]
}`;
}

function parseModelResponse(raw: unknown): ModelJsonReply {
  let parsedObj: unknown = null;

  if (raw && typeof raw === "object" && "response" in raw) {
    const inner = (raw as { response: unknown }).response;
    if (typeof inner === "object" && inner !== null) {
      parsedObj = inner;
    } else if (typeof inner === "string") {
      const cleaned = inner
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      try {
        parsedObj = JSON.parse(cleaned);
      } catch {
        return { reply: inner.trim(), proposedActions: [] };
      }
    }
  } else if (typeof raw === "string") {
    try {
      parsedObj = JSON.parse(raw);
    } catch {
      return { reply: raw.trim(), proposedActions: [] };
    }
  }

  if (parsedObj && typeof parsedObj === "object") {
    const obj = parsedObj as Record<string, unknown>;
    const reply =
      typeof obj.reply === "string" && obj.reply.trim()
        ? obj.reply.trim()
        : "Please review the proposed changes below and confirm, or let me know what you'd like to adjust.";

    const rawActions = Array.isArray(obj.proposedActions)
      ? obj.proposedActions
      : [];

    const validActions: AiAction[] = [];
    for (const item of rawActions) {
      const result = aiActionSchema.safeParse(item);
      if (result.success) {
        validActions.push(result.data);
      }
    }

    return { reply, proposedActions: validActions };
  }

  return {
    reply: "I couldn't process that request. Could you rephrase what you'd like to look up or change?",
    proposedActions: [],
  };
}

export async function runAiChat(
  ai: Ai,
  tree: schema.ClientWithProjects[],
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  activeClientId?: string,
  activeProjectId?: string
): Promise<ModelJsonReply> {
  const systemPrompt = buildSystemPrompt(tree, activeClientId, activeProjectId);

  const modelMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const result = await ai.run(AI_MODEL as Parameters<Ai["run"]>[0], {
    messages: modelMessages,
    response_format: { type: "json_object" },
    max_tokens: 1400,
    temperature: 0.2,
  });

  return parseModelResponse(result);
}

export async function executeAiActions(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  actions: AiAction[]
): Promise<{
  appliedCount: number;
  results: string[];
  focusClientId?: string;
  focusProjectId?: string;
}> {
  const tempClientIds = new Map<string, string>();
  const tempProjectIds = new Map<string, string>();
  const results: string[] = [];
  let focusClientId: string | undefined;
  let focusProjectId: string | undefined;

  for (const action of actions) {
    const now = Date.now();

    if (action.type === "create_client") {
      const id = crypto.randomUUID();
      await db.insert(schema.clients).values({
        id,
        userId,
        name: action.name,
        notes: action.notes ?? "",
        createdAt: now,
        updatedAt: now,
      });
      if (action.tempId) tempClientIds.set(action.tempId, id);
      focusClientId = id;
      results.push(`Created client "${action.name}"`);
    } else if (action.type === "update_client") {
      const clientId = tempClientIds.get(action.clientId) ?? action.clientId;
      const existing = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!existing) throw new Error(`Client not found: ${action.clientName || clientId}`);

      const patch: Partial<schema.NewClient> = { updatedAt: now };
      if (action.name !== undefined) patch.name = action.name;
      if (action.notes !== undefined) patch.notes = action.notes;

      await db
        .update(schema.clients)
        .set(patch)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)));
      focusClientId = clientId;
      results.push(`Updated client "${action.name ?? existing.name}"`);
    } else if (action.type === "delete_client") {
      const clientId = tempClientIds.get(action.clientId) ?? action.clientId;
      const existing = await db
        .select()
        .from(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!existing) throw new Error(`Client not found: ${action.clientName || clientId}`);

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
      results.push(`Deleted client "${existing.name}"`);
    } else if (action.type === "create_project") {
      const clientId = tempClientIds.get(action.clientId) ?? action.clientId;
      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error(`Client not found for project "${action.name}"`);

      const id = crypto.randomUUID();
      await db.insert(schema.projects).values({
        id,
        clientId,
        name: action.name,
        details: action.details ?? "",
        liveUrl: action.liveUrl ?? "",
        repoUrl: action.repoUrl ?? "",
        status: action.status ?? "active",
        createdAt: now,
        updatedAt: now,
      });
      if (action.tempId) tempProjectIds.set(action.tempId, id);
      focusClientId = clientId;
      focusProjectId = id;
      results.push(`Created project "${action.name}"`);
    } else if (action.type === "update_project") {
      const projectId = tempProjectIds.get(action.projectId) ?? action.projectId;
      const existing = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!existing) throw new Error(`Project not found: ${action.projectName || projectId}`);

      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Project not found");

      const patch: Partial<schema.NewProject> = { updatedAt: now };
      if (action.name !== undefined) patch.name = action.name;
      if (action.details !== undefined) patch.details = action.details;
      if (action.liveUrl !== undefined) patch.liveUrl = action.liveUrl;
      if (action.repoUrl !== undefined) patch.repoUrl = action.repoUrl;
      if (action.status !== undefined) patch.status = action.status;

      await db.update(schema.projects).set(patch).where(eq(schema.projects.id, projectId));
      focusClientId = existing.clientId;
      focusProjectId = projectId;
      results.push(`Updated project "${action.name ?? existing.name}"`);
    } else if (action.type === "delete_project") {
      const projectId = tempProjectIds.get(action.projectId) ?? action.projectId;
      const existing = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!existing) throw new Error(`Project not found: ${action.projectName || projectId}`);

      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, existing.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Project not found");

      await db.delete(schema.services).where(eq(schema.services.projectId, projectId));
      await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
      results.push(`Deleted project "${existing.name}"`);
    } else if (action.type === "create_service") {
      const projectId = tempProjectIds.get(action.projectId) ?? action.projectId;
      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .get();
      if (!project) throw new Error(`Project not found for service "${action.name}"`);

      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Project not found");

      await db.insert(schema.services).values({
        id: crypto.randomUUID(),
        projectId,
        name: action.name,
        description: action.description ?? "",
        ownerEmail: action.ownerEmail ?? "",
        dashboardUrl: action.dashboardUrl ?? "",
        tier: action.tier ?? "",
        renewalDate: action.renewalDate ?? "",
        lastReminderSentAt: null,
        createdAt: now,
        updatedAt: now,
      });
      focusClientId = project.clientId;
      focusProjectId = projectId;
      results.push(`Added service "${action.name}"`);
    } else if (action.type === "update_service") {
      const existing = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, action.serviceId))
        .get();
      if (!existing) throw new Error(`Service not found: ${action.serviceName || action.serviceId}`);

      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, existing.projectId))
        .get();
      if (!project) throw new Error("Service not found");

      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Service not found");

      const patch: Partial<schema.NewService> = { updatedAt: now };
      if (action.name !== undefined) patch.name = action.name;
      if (action.description !== undefined) patch.description = action.description;
      if (action.ownerEmail !== undefined) patch.ownerEmail = action.ownerEmail;
      if (action.dashboardUrl !== undefined) patch.dashboardUrl = action.dashboardUrl;
      if (action.tier !== undefined) patch.tier = action.tier;
      if (action.renewalDate !== undefined) {
        patch.renewalDate = action.renewalDate;
        if (action.renewalDate !== existing.renewalDate) {
          patch.lastReminderSentAt = null;
        }
      }

      await db
        .update(schema.services)
        .set(patch)
        .where(eq(schema.services.id, action.serviceId));
      focusClientId = project.clientId;
      focusProjectId = project.id;
      results.push(`Updated service "${action.name ?? existing.name}"`);
    } else if (action.type === "delete_service") {
      const existing = await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, action.serviceId))
        .get();
      if (!existing) throw new Error(`Service not found: ${action.serviceName || action.serviceId}`);

      const project = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, existing.projectId))
        .get();
      if (!project) throw new Error("Service not found");

      const ownerClient = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.id, project.clientId), eq(schema.clients.userId, userId)))
        .get();
      if (!ownerClient) throw new Error("Service not found");

      await db.delete(schema.services).where(eq(schema.services.id, action.serviceId));
      focusClientId = project.clientId;
      focusProjectId = project.id;
      results.push(`Deleted service "${existing.name}"`);
    }
  }

  return {
    appliedCount: results.length,
    results,
    focusClientId,
    focusProjectId,
  };
}
