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

export interface Project {
  id: string;
  clientId: string;
  name: string;
  details: string;
  createdAt: number;
  updatedAt: number;
}

export interface Service {
  id: string;
  projectId: string;
  name: string;
  description: string;
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
