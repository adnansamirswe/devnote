export interface Client {
  id: string;
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
