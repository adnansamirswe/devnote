import {
  AdminStats,
  AdminUserRow,
  ClientWithProjects,
  ExportData,
  Client,
  Project,
  Service,
  UserProfile,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:8787"
    : "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson.error === "string") {
        errMsg = errJson.error;
      } else if (errJson?.error?.issues?.[0]?.message) {
        errMsg = errJson.error.issues[0].message;
      }
    } catch {
      // fallback
    }
    throw new ApiError(errMsg, res.status);
  }

  return res.json();
}

export const api = {
  // Auth
  async signup(data: {
    email: string;
    username: string;
    password: string;
  }): Promise<{ ok: boolean; user: UserProfile }> {
    return request<{ ok: boolean; user: UserProfile }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async login(data: {
    identifier: string;
    password: string;
  }): Promise<{ ok: boolean; user: UserProfile }> {
    return request<{ ok: boolean; user: UserProfile }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
    });
  },

  async me(): Promise<{ authenticated: boolean; user: UserProfile }> {
    return request<{ authenticated: boolean; user: UserProfile }>("/api/me", {
      method: "GET",
    });
  },

  // Tree
  async getTree(): Promise<{ clients: ClientWithProjects[] }> {
    return request<{ clients: ClientWithProjects[] }>("/api/tree", {
      method: "GET",
    });
  },

  // Clients
  async createClient(data: { name: string; notes?: string }): Promise<ClientWithProjects> {
    return request<ClientWithProjects>("/api/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateClient(id: string, data: { name?: string; notes?: string }): Promise<Client> {
    return request<Client>(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteClient(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/clients/${id}`, {
      method: "DELETE",
    });
  },

  // Projects
  async createProject(data: {
    clientId: string;
    name: string;
    details?: string;
  }): Promise<Project & { services: Service[] }> {
    return request<Project & { services: Service[] }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProject(id: string, data: { name?: string; details?: string }): Promise<Project> {
    return request<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/projects/${id}`, {
      method: "DELETE",
    });
  },

  // Services
  async createService(data: {
    projectId: string;
    name: string;
    description?: string;
  }): Promise<Service> {
    return request<Service>("/api/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateService(
    id: string,
    data: { name?: string; description?: string }
  ): Promise<Service> {
    return request<Service>(`/api/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteService(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/services/${id}`, {
      method: "DELETE",
    });
  },

  // Export / Import
  async exportData(): Promise<ExportData> {
    return request<ExportData>("/api/export", {
      method: "GET",
    });
  },

  async importData(data: {
    clients: ClientWithProjects[];
  }): Promise<{ ok: boolean; count: number }> {
    return request<{ ok: boolean; count: number }>("/api/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Admin
  async getAdminStats(): Promise<AdminStats> {
    return request<AdminStats>("/api/admin/stats", { method: "GET" });
  },

  async getAdminUsers(q?: string): Promise<{ users: AdminUserRow[] }> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<{ users: AdminUserRow[] }>(`/api/admin/users${query}`, {
      method: "GET",
    });
  },

  async updateAdminUser(
    id: string,
    data: { role?: "user" | "admin"; status?: "active" | "suspended" }
  ): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteAdminUser(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/admin/users/${id}`, {
      method: "DELETE",
    });
  },
};
