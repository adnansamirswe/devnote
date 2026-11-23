"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer as VaulDrawer } from "vaul";
import { toast } from "sonner";
import {
  useAuth,
  useTree,
  useClientMutations,
  useProjectMutations,
  useServiceMutations,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { ClientWithProjects, ProjectWithServices, Service } from "@/types";
import { SidebarTree } from "@/components/sidebar-tree";
import { ClientOverview } from "@/components/client-overview";
import { ProjectView } from "@/components/project-view";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { LoginView } from "@/components/login-view";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Layers, Loader2, Menu, Plus, Search } from "lucide-react";

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardWorkstation />
    </Suspense>
  );
}

function DashboardWorkstation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Queries & Mutations
  const { isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const { data: clients = [], isLoading: treeLoading } = useTree();
  const { createClient, updateClient, deleteClient } = useClientMutations();
  const { createProject, updateProject, deleteProject } = useProjectMutations();
  const { createService, updateService, deleteService } = useServiceMutations();

  // Active Selection from URL
  const selectedClientId = searchParams.get("c") || "";
  const selectedProjectId = searchParams.get("p") || "";

  // Mobile Vaul Drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Dialogs
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");

  const [newProjectClientId, setNewProjectClientId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDetails, setNewProjectDetails] = useState("");

  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  // Delete confirmation targets
  const [deleteClientTarget, setDeleteClientTarget] =
    useState<ClientWithProjects | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] =
    useState<ProjectWithServices | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Resolve active client & project
  const currentClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const currentProject = useMemo(() => {
    if (!currentClient || !selectedProjectId) return null;
    return currentClient.projects.find((p) => p.id === selectedProjectId) || null;
  }, [currentClient, selectedProjectId]);

  const targetClientForNewProject = useMemo(
    () => clients.find((c) => c.id === newProjectClientId) || null,
    [clients, newProjectClientId]
  );

  // URL navigation helpers
  const updateUrl = (cId: string, pId?: string) => {
    const params = new URLSearchParams();
    if (cId) params.set("c", cId);
    if (pId) params.set("p", pId);
    const query = params.toString();
    router.replace(query ? `/app/?${query}` : "/app/");
  };

  const selectClient = (cId: string) => {
    updateUrl(cId);
  };

  const selectProject = (cId: string, pId: string) => {
    updateUrl(cId, pId);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (currentProject) {
          setNewServiceOpen(true);
        } else if (currentClient) {
          setNewProjectClientId(currentClient.id);
        } else {
          setNewClientOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentClient, currentProject]);

  // Export & Import backup
  const handleExport = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Failed to export backup");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.clients || !Array.isArray(parsed.clients)) {
        throw new Error("Invalid backup JSON format");
      }
      await api.importData({ clients: parsed.clients });
      toast.success("Backup restored");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid file";
      toast.error(`Import failed: ${msg}`);
    } finally {
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  // Creation handlers
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const created = await createClient.mutateAsync({
        name: newClientName.trim(),
        notes: newClientNotes.trim(),
      });
      setNewClientOpen(false);
      setNewClientName("");
      setNewClientNotes("");
      selectClient(created.id);
      toast.success("Client created");
    } catch {
      // handled in mutation onError
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectClientId || !newProjectName.trim()) return;
    try {
      const created = await createProject.mutateAsync({
        clientId: newProjectClientId,
        name: newProjectName.trim(),
        details: newProjectDetails.trim(),
      });
      const targetClientId = newProjectClientId;
      setNewProjectClientId(null);
      setNewProjectName("");
      setNewProjectDetails("");
      selectProject(targetClientId, created.id);
      toast.success("Project created");
    } catch {
      // handled in mutation onError
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newServiceName.trim()) return;
    try {
      await createService.mutateAsync({
        projectId: currentProject.id,
        name: newServiceName.trim(),
        description: newServiceDesc.trim(),
      });
      setNewServiceOpen(false);
      setNewServiceName("");
      setNewServiceDesc("");
      toast.success("Service added");
    } catch {
      // handled in mutation onError
    }
  };

  const handleDuplicateService = async (service: Service) => {
    await createService.mutateAsync({
      projectId: service.projectId,
      name: `${service.name} (copy)`,
      description: service.description,
    });
    toast.success("Service duplicated");
  };

  const handleDeleteService = async (service: Service) => {
    const deleted = { ...service };
    await deleteService.mutateAsync(service.id);
    toast("Service deleted", {
      description: deleted.name,
      action: {
        label: "Undo",
        onClick: async () => {
          await createService.mutateAsync({
            projectId: deleted.projectId,
            name: deleted.name,
            description: deleted.description,
          });
          toast.success("Service restored");
        },
      },
      duration: 6000,
    });
  };

  // Auth gate
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={login} />;
  }

  const sidebarElement = (onNavigate?: () => void) => (
    <SidebarTree
      clients={clients}
      isLoading={treeLoading}
      selectedClientId={selectedClientId}
      selectedProjectId={selectedProjectId}
      onSelectClient={selectClient}
      onSelectProject={selectProject}
      onNewClient={() => {
        onNavigate?.();
        setNewClientOpen(true);
      }}
      onNewProjectForClient={(clientId) => {
        onNavigate?.();
        setNewProjectClientId(clientId);
      }}
      onDeleteClient={(client) => setDeleteClientTarget(client)}
      onDeleteProject={(project) => setDeleteProjectTarget(project)}
      onOpenCommandPalette={() => {
        onNavigate?.();
        setCommandPaletteOpen(true);
      }}
      onOpenShortcuts={() => {
        onNavigate?.();
        setShortcutsOpen(true);
      }}
      onExport={handleExport}
      onTriggerImport={() => importFileRef.current?.click()}
      onLogout={() => void logout()}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="flex h-screen w-screen flex-col md:flex-row bg-background text-foreground overflow-hidden font-sans">
      {/* Slim Mobile Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="text-[14px] font-semibold tracking-tight text-foreground truncate px-2">
          {currentProject?.name || currentClient?.name || "devnote"}
        </span>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
        </button>
      </header>

      {/* Mobile Vaul Slide-In Sidebar Drawer */}
      <VaulDrawer.Root
        direction="left"
        open={mobileDrawerOpen}
        onOpenChange={setMobileDrawerOpen}
      >
        <VaulDrawer.Portal>
          <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
          <VaulDrawer.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar outline-none md:hidden"
          >
            <VaulDrawer.Title className="sr-only">Navigation</VaulDrawer.Title>
            {sidebarElement(() => setMobileDrawerOpen(false))}
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>

      {/* Desktop Fixed Left Sidebar (~280px) */}
      <div className="hidden md:flex md:w-[280px] md:shrink-0 md:border-r md:border-sidebar-border h-full bg-sidebar">
        {sidebarElement()}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background">
        {treeLoading ? (
          <div className="mx-auto max-w-[900px] px-6 py-10 sm:px-10 space-y-6">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          </div>
        ) : clients.length === 0 ? (
          /* First-Run Onboarding Empty State */
          <div className="flex h-full min-h-[420px] items-center justify-center px-6">
            <div className="max-w-md text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                  Welcome to devnote
                </h1>
                <p className="text-[14px] text-muted-foreground leading-relaxed">
                  Organize your work as <span className="text-foreground font-medium">Client → Project → Service</span> so you always know which account owns every tool.
                </p>
              </div>
              <Button
                onClick={() => setNewClientOpen(true)}
                className="h-10 px-5 text-[14px] gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create your first client</span>
              </Button>
            </div>
          </div>
        ) : currentClient && currentProject ? (
          <ProjectView
            client={currentClient}
            project={currentProject}
            onSelectClient={selectClient}
            onUpdateProject={(data) =>
              updateProject.mutateAsync({ id: currentProject.id, data })
            }
            onDeleteProject={(project) => setDeleteProjectTarget(project)}
            onAddService={() => setNewServiceOpen(true)}
            onUpdateService={(serviceId, data) =>
              updateService.mutateAsync({ id: serviceId, data })
            }
            onDuplicateService={handleDuplicateService}
            onDeleteService={handleDeleteService}
          />
        ) : currentClient ? (
          <ClientOverview
            client={currentClient}
            onUpdateClient={(data) =>
              updateClient.mutateAsync({ id: currentClient.id, data })
            }
            onDeleteClient={(client) => setDeleteClientTarget(client)}
            onSelectProject={selectProject}
            onNewProject={() => setNewProjectClientId(currentClient.id)}
          />
        ) : (
          /* Nothing selected */
          <div className="flex h-full min-h-[420px] items-center justify-center px-6">
            <div className="max-w-sm text-center space-y-3">
              <h2 className="text-[16px] font-semibold text-foreground">
                Select or create a client
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Pick a client or project from the sidebar, or create a new client to get started.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewClientOpen(true)}
                className="h-9 px-3.5 text-[13px] gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New client</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Hidden Import File Input */}
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* New Client Dialog */}
      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleCreateClient}>
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
              <DialogDescription>
                Add a client or organization to group their projects and services.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Name
                </label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Notes
                </label>
                <Textarea
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="Contacts, billing notes, or general context…"
                  className="h-20 text-[14px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewClientOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newClientName.trim()}>
                Create client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog
        open={!!newProjectClientId}
        onOpenChange={(open) => !open && setNewProjectClientId(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Create a project under{" "}
                <span className="font-medium text-foreground">
                  {targetClientForNewProject?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Name
                </label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Customer Portal"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Notes
                </label>
                <Textarea
                  value={newProjectDetails}
                  onChange={(e) => setNewProjectDetails(e.target.value)}
                  placeholder="Repository links, environments, or stack notes…"
                  className="h-20 text-[14px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewProjectClientId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newProjectName.trim()}>
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Service Dialog */}
      <Dialog open={newServiceOpen} onOpenChange={setNewServiceOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={handleCreateService}>
            <DialogHeader>
              <DialogTitle>Add service</DialogTitle>
              <DialogDescription>
                Record a tool or account used by{" "}
                <span className="font-medium text-foreground">
                  {currentProject?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3.5 py-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Service name
                </label>
                <Input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Supabase, Vercel, Cloudflare…"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Description
                </label>
                <Textarea
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Owner email, plan tier, region, or links…"
                  className="h-24 text-[14px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewServiceOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newServiceName.trim()}>
                Add service
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Client Confirmation */}
      <Dialog
        open={!!deleteClientTarget}
        onOpenChange={(open) => !open && setDeleteClientTarget(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete client</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-semibold text-foreground">
                {deleteClientTarget?.name}
              </span>{" "}
              and all its projects and services?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteClientTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const target = deleteClientTarget;
                if (!target) return;
                setDeleteClientTarget(null);
                await deleteClient.mutateAsync(target.id);
                if (selectedClientId === target.id) {
                  updateUrl("");
                }
                toast("Client deleted", { description: target.name });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog
        open={!!deleteProjectTarget}
        onOpenChange={(open) => !open && setDeleteProjectTarget(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-semibold text-foreground">
                {deleteProjectTarget?.name}
              </span>{" "}
              and all its services?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteProjectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const target = deleteProjectTarget;
                if (!target) return;
                setDeleteProjectTarget(null);
                await deleteProject.mutateAsync(target.id);
                if (selectedProjectId === target.id) {
                  updateUrl(target.clientId);
                }
                toast("Project deleted", { description: target.name });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Command Palette (⌘K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        clients={clients}
        onSelectClient={selectClient}
        onSelectProject={selectProject}
        onNewClient={() => setNewClientOpen(true)}
        onNewProject={() => {
          if (currentClient) {
            setNewProjectClientId(currentClient.id);
          } else if (clients[0]) {
            setNewProjectClientId(clients[0].id);
          } else {
            setNewClientOpen(true);
          }
        }}
        onNewService={() => {
          if (currentProject) {
            setNewServiceOpen(true);
          } else {
            toast("Select a project first to add a service");
          }
        }}
        onExport={handleExport}
        onLogout={() => void logout()}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Keyboard Shortcuts Dialog */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
