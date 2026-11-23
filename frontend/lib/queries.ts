import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { ClientWithProjects, Client, Project, Service } from "@/types";
import { toast } from "sonner";

export const TREE_QUERY_KEY = ["tree"];
export const AUTH_QUERY_KEY = ["auth"];

export function useAuth() {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await api.me();
        return res.authenticated;
      } catch {
        return false;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: (password: string) => api.login(password),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, true);
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, false);
      queryClient.removeQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  return {
    isAuthenticated: !!authQuery.data,
    isLoading: authQuery.isLoading,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutateAsync,
  };
}

export function useTree() {
  return useQuery({
    queryKey: TREE_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getTree();
      return res.clients;
    },
    staleTime: 60 * 1000,
  });
}

export function useClientMutations() {
  const queryClient = useQueryClient();

  const createClient = useMutation({
    mutationFn: (data: { name: string; notes?: string }) => api.createClient(data),
    onMutate: async (newClient) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      const optimisticClient: ClientWithProjects = {
        id: "temp-" + Date.now(),
        name: newClient.name,
        notes: newClient.notes || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projects: [],
      };

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(TREE_QUERY_KEY, [
          ...previousTree,
          optimisticClient,
        ]);
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to create client");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const updateClient = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; notes?: string } }) =>
      api.updateClient(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => (c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to update client");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const deleteClient = useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.filter((c) => c.id !== id)
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to delete client");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  return { createClient, updateClient, deleteClient };
}

export function useProjectMutations() {
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: (data: { clientId: string; name: string; details?: string }) =>
      api.createProject(data),
    onMutate: async (newProject) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      const optimisticProject = {
        id: "temp-proj-" + Date.now(),
        clientId: newProject.clientId,
        name: newProject.name,
        details: newProject.details || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        services: [],
      };

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) =>
            c.id === newProject.clientId
              ? { ...c, projects: [...c.projects, optimisticProject] }
              : c
          )
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to create project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; details?: string } }) =>
      api.updateProject(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => ({
            ...c,
            projects: c.projects.map((p) =>
              p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
            ),
          }))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to update project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => ({
            ...c,
            projects: c.projects.filter((p) => p.id !== id),
          }))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to delete project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  return { createProject, updateProject, deleteProject };
}

export function useServiceMutations() {
  const queryClient = useQueryClient();

  const createService = useMutation({
    mutationFn: (data: { projectId: string; name: string; description?: string }) =>
      api.createService(data),
    onMutate: async (newService) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      const optimisticService: Service = {
        id: "temp-srv-" + Date.now(),
        projectId: newService.projectId,
        name: newService.name,
        description: newService.description || "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => ({
            ...c,
            projects: c.projects.map((p) =>
              p.id === newService.projectId
                ? { ...p, services: [...p.services, optimisticService] }
                : p
            ),
          }))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to create service");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const updateService = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      api.updateService(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => ({
            ...c,
            projects: c.projects.map((p) => ({
              ...p,
              services: p.services.map((s) =>
                s.id === id ? { ...s, ...data, updatedAt: Date.now() } : s
              ),
            })),
          }))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to update service");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  const deleteService = useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TREE_QUERY_KEY });
      const previousTree = queryClient.getQueryData<ClientWithProjects[]>(TREE_QUERY_KEY);

      if (previousTree) {
        queryClient.setQueryData<ClientWithProjects[]>(
          TREE_QUERY_KEY,
          previousTree.map((c) => ({
            ...c,
            projects: c.projects.map((p) => ({
              ...p,
              services: p.services.filter((s) => s.id !== id),
            })),
          }))
        );
      }

      return { previousTree };
    },
    onError: (err, _, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(TREE_QUERY_KEY, context.previousTree);
      }
      toast.error(err instanceof ApiError ? err.message : "Failed to delete service");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
    },
  });

  return { createService, updateService, deleteService };
}
