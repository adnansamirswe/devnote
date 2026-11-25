export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  emailVerified: boolean;
  createdAt: number;
}

export interface AdminUserRow extends UserProfile {
  counts: {
    clients: number;
    projects: number;
    services: number;
  };
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    admins: number;
  };
  resources: {
    clients: number;
    projects: number;
    services: number;
  };
}

export interface Client {
  id: string;
  userId?: string | null;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type ProjectStatus = "active" | "paused" | "archived";
export type ServiceTier = "" | "free" | "paid" | "trial";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  details: string;
  liveUrl: string;
  repoUrl: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Service {
  id: string;
  projectId: string;
  name: string;
  description: string;
  ownerEmail: string;
  dashboardUrl: string;
  tier: ServiceTier;
  renewalDate: string;
  lastReminderSentAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWithServices extends Project {
  services: Service[];
}

export interface ClientWithProjects extends Client {
  projects: ProjectWithServices[];
}

export interface TreeData {
  clients: ClientWithProjects[];
}

export interface ExportData {
  version: number;
  exportedAt: string;
  clients: ClientWithProjects[];
}

export type AiAction =
  | { type: "create_client"; tempId?: string; name: string; notes?: string }
  | {
      type: "update_client";
      clientId: string;
      clientName?: string;
      name?: string;
      notes?: string;
    }
  | { type: "delete_client"; clientId: string; clientName?: string }
  | {
      type: "create_project";
      tempId?: string;
      clientId: string;
      clientName?: string;
      name: string;
      details?: string;
      liveUrl?: string;
      repoUrl?: string;
      status?: ProjectStatus;
    }
  | {
      type: "update_project";
      projectId: string;
      projectName?: string;
      name?: string;
      details?: string;
      liveUrl?: string;
      repoUrl?: string;
      status?: ProjectStatus;
    }
  | { type: "delete_project"; projectId: string; projectName?: string }
  | {
      type: "create_service";
      projectId: string;
      projectName?: string;
      name: string;
      description?: string;
      ownerEmail?: string;
      dashboardUrl?: string;
      tier?: ServiceTier;
      renewalDate?: string;
    }
  | {
      type: "update_service";
      serviceId: string;
      serviceName?: string;
      name?: string;
      description?: string;
      ownerEmail?: string;
      dashboardUrl?: string;
      tier?: ServiceTier;
      renewalDate?: string;
    }
  | { type: "delete_service"; serviceId: string; serviceName?: string };

export interface AiChatResponse {
  reply: string;
  proposedActions: AiAction[];
}

export interface AiExecuteResponse {
  ok: boolean;
  appliedCount: number;
  results: string[];
  focusClientId?: string;
  focusProjectId?: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: number | null;
  createdAt: number;
}
