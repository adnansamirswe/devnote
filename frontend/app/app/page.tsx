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
import { ClientWithProjects, ProjectWithServices, Service, ServiceTier } from "@/types";
import { matchBrandIcon } from "@/lib/brand-icons";
import { extractKnownEmails, SERVICE_PRESETS } from "@/lib/workspace-helpers";
import { SidebarTree, WorkspaceViewMode } from "@/components/sidebar-tree";
import { LaunchpadHome } from "@/components/launchpad-home";
import { AccountsView, DirectoryTab } from "@/components/accounts-view";
import { ClientOverview } from "@/components/client-overview";
import { ProjectView } from "@/components/project-view";
import { AiAssistant } from "@/components/ai-assistant";
import { McpKeysDialog } from "@/components/mcp-keys-dialog";
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

import { Loader2, Menu, MessageSquare, Search, Server } from "lucide-react";

const TIER_CHOICES: Array<{ value: ServiceTier; label: string }> = [
  { value: "", label: "None" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "trial", label: "Trial" },
];

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
  const { user, isAuthenticated, isLoading: authLoading, login, signup, logout } =
    useAuth();
  const { data: clients = [], isLoading: treeLoading } =
    useTree(isAuthenticated);
  const { createClient, updateClient, deleteClient } = useClientMutations();
  const { createProject, updateProject, deleteProject } = useProjectMutations();
  const { createService, updateService, deleteService } = useServiceMutations();

  // URL state
  const viewParam = searchParams.get("v") || "";
  const emailParam = searchParams.get("email") || "";
  const selectedClientId = searchParams.get("c") || "";
  const selectedProjectId = searchParams.get("p") || "";

  // Mobile Vaul Drawer & AI Assistant Panel
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Dialogs
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mcpKeysOpen, setMcpKeysOpen] = useState(false);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");

  const [newProjectClientId, setNewProjectClientId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLiveUrl, setNewProjectLiveUrl] = useState("");
  const [newProjectRepoUrl, setNewProjectRepoUrl] = useState("");
  const [newProjectDetails, setNewProjectDetails] = useState("");

  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceOwnerEmail, setNewServiceOwnerEmail] = useState("");
  const [newServiceDashboardUrl, setNewServiceDashboardUrl] = useState("");
  const [newServiceTier, setNewServiceTier] = useState<ServiceTier>("");
  const [newServiceRenewalDate, setNewServiceRenewalDate] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  // Delete confirmation targets
  const [deleteClientTarget, setDeleteClientTarget] =
    useState<ClientWithProjects | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] =
    useState<ProjectWithServices | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  const knownEmails = useMemo(
    () => extractKnownEmails(clients, user?.email),
    [clients, user?.email]
  );

  // Resolve active client & project
  const currentClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const currentProject = useMemo(() => {
    if (!currentClient || !selectedProjectId) return null;
    return currentClient.projects.find((p) => p.id === selectedProjectId) || null;
  }, [currentClient, selectedProjectId]);

  const activeView: WorkspaceViewMode = useMemo(() => {
    if (viewParam === "accounts" || viewParam === "providers" || viewParam === "renewals") {
      return viewParam;
    }
    if (currentClient && currentProject) return "project";
    if (currentClient) return "client";
    return "home";
  }, [viewParam, currentClient, currentProject]);

  const targetClientForNewProject = useMemo(
    () => clients.find((c) => c.id === newProjectClientId) || null,
    [clients, newProjectClientId]
  );

  // URL navigation helpers
  const navigateHome = () => {
    router.replace("/app/");
  };

  const navigateDirectory = (tab: DirectoryTab, email?: string) => {
    const params = new URLSearchParams();
    params.set("v", tab);
    if (email) params.set("email", email);
    router.replace(`/app/?${params.toString()}`);
  };

  const updateUrl = (cId: string, pId?: string) => {
    const params = new URLSearchParams();
    if (cId) params.set("c", cId);
    if (pId) params.set("p", pId);
    const query = params.toString();
    router.replace(query ? `/app/?${query}` : "/app/");
  };

  const selectClient = (cId: string) => updateUrl(cId);
  const selectProject = (cId: string, pId: string) => updateUrl(cId, pId);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
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
        liveUrl: newProjectLiveUrl.trim(),
        repoUrl: newProjectRepoUrl.trim(),
      });
      const targetClientId = newProjectClientId;
      setNewProjectClientId(null);
      setNewProjectName("");
      setNewProjectLiveUrl("");
      setNewProjectRepoUrl("");
      setNewProjectDetails("");
      selectProject(targetClientId, created.id);
      toast.success("Project created");
    } catch {
      // handled in mutation onError
    }
  };

  const resetNewServiceForm = () => {
    setNewServiceName("");
    setNewServiceOwnerEmail("");
    setNewServiceDashboardUrl("");
    setNewServiceTier("");
    setNewServiceRenewalDate("");
    setNewServiceDesc("");
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newServiceName.trim()) return;
    try {
      await createService.mutateAsync({
        projectId: currentProject.id,
        name: newServiceName.trim(),
        ownerEmail: newServiceOwnerEmail.trim().toLowerCase(),
        dashboardUrl: newServiceDashboardUrl.trim(),
        tier: newServiceTier,
        renewalDate: newServiceRenewalDate.trim(),
        description: newServiceDesc.trim(),
      });
      setNewServiceOpen(false);
      resetNewServiceForm();
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
      ownerEmail: service.ownerEmail,
      dashboardUrl: service.dashboardUrl,
      tier: service.tier,
      renewalDate: service.renewalDate,
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
            ownerEmail: deleted.ownerEmail,
            dashboardUrl: deleted.dashboardUrl,
            tier: deleted.tier,
            renewalDate: deleted.renewalDate,
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
    return <LoginView onLogin={login} onSignup={signup} />;
  }

  const mobileTitle =
    activeView === "accounts"
      ? "Accounts"
      : activeView === "providers"
        ? "Providers"
        : activeView === "renewals"
          ? "Renewals"
          : currentProject?.name || currentClient?.name || "Launchpad";

  const sidebarElement = (onNavigate?: () => void) => (
    <SidebarTree
      user={user}
      clients={clients}
      isLoading={treeLoading}
      activeView={activeView}
      selectedClientId={selectedClientId}
      selectedProjectId={selectedProjectId}
      onSelectHome={navigateHome}
      onSelectAccounts={() => navigateDirectory("accounts")}
      onSelectRenewals={() => navigateDirectory("renewals")}
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
      onToggleAssistant={() => {
        onNavigate?.();
        setAssistantOpen((prev) => !prev);
      }}
      assistantOpen={assistantOpen}
      onOpenShortcuts={() => {
        onNavigate?.();
        setShortcutsOpen(true);
      }}
      onOpenMcpKeys={() => {
        onNavigate?.();
        setMcpKeysOpen(true);
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
          {mobileTitle}
        </span>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            aria-label="Open AI assistant"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-secondary transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
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
        ) : activeView === "accounts" ||
          activeView === "providers" ||
          activeView === "renewals" ? (
          <AccountsView
            key={`${activeView}-${emailParam}`}
            clients={clients}
            activeTab={activeView}
            emailFilter={emailParam}
            onChangeTab={(tab, email) => navigateDirectory(tab, email)}
            onSelectProject={selectProject}
          />
        ) : currentClient && currentProject ? (
          <ProjectView
            key={currentProject.id}
            client={currentClient}
            project={currentProject}
            knownEmails={knownEmails}
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
          <LaunchpadHome
            clients={clients}
            onSelectClient={selectClient}
            onSelectProject={selectProject}
            onOpenAccounts={(email) => navigateDirectory("accounts", email)}
            onOpenRenewals={() => navigateDirectory("renewals")}
            onNewClient={() => setNewClientOpen(true)}
            onNewProjectForClient={(cId) => setNewProjectClientId(cId)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
        )}
      </main>

      {/* AI Assistant Floating Widget */}
      <AiAssistant
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        activeClientId={selectedClientId}
        activeProjectId={selectedProjectId}
        onFocusItem={(cId, pId) => {
          if (cId && pId) selectProject(cId, pId);
          else if (cId) selectClient(cId);
        }}
      />

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
                Add a client or group (e.g. Personal, Byzo, Acme) to organize projects.
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
                  placeholder="Personal, Byzo, Acme Corp…"
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
        <DialogContent className="sm:max-w-[460px]">
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
                  Project name
                </label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="uuprint, Customer Portal…"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">
                    Live URL (optional)
                  </label>
                  <Input
                    type="url"
                    value={newProjectLiveUrl}
                    onChange={(e) => setNewProjectLiveUrl(e.target.value)}
                    placeholder="https://uuprint.byzo.cc"
                    className="font-mono text-[12px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">
                    Repository URL (optional)
                  </label>
                  <Input
                    type="url"
                    value={newProjectRepoUrl}
                    onChange={(e) => setNewProjectRepoUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="font-mono text-[12px]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Notes
                </label>
                <Textarea
                  value={newProjectDetails}
                  onChange={(e) => setNewProjectDetails(e.target.value)}
                  placeholder="Architecture, environments, or stack notes…"
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

      {/* Zero-Friction New Service Dialog with Presets & Email Chips */}
      <Dialog
        open={newServiceOpen}
        onOpenChange={(open) => {
          setNewServiceOpen(open);
          if (!open) resetNewServiceForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateService}>
            <DialogHeader>
              <DialogTitle>Add service</DialogTitle>
              <DialogDescription>
                Pick a preset or enter a service for{" "}
                <span className="font-medium text-foreground">
                  {currentProject?.name}
                </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 1-click Provider Presets */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">
                  Quick presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_PRESETS.map((preset) => {
                    const brand = matchBrandIcon(preset.name);
                    const isSelected =
                      newServiceName.trim().toLowerCase() ===
                      preset.name.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setNewServiceName(preset.name);
                          if (preset.dashboardUrl !== "https://") {
                            setNewServiceDashboardUrl(preset.dashboardUrl);
                          }
                          setNewServiceTier(preset.defaultTier);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "border-primary/50 bg-accent text-primary"
                            : "border-border bg-secondary/50 text-foreground hover:border-primary/30 hover:bg-secondary"
                        }`}
                      >
                        {brand ? (
                          <span
                            className="h-3 w-3 flex items-center justify-center fill-current"
                            dangerouslySetInnerHTML={{ __html: brand.svg }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Server className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              {/* Owner Email + Known Email Chips */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Owner email
                </label>
                <Input
                  type="email"
                  value={newServiceOwnerEmail}
                  onChange={(e) => setNewServiceOwnerEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="font-mono text-[13px]"
                />
                {knownEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {knownEmails.slice(0, 5).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setNewServiceOwnerEmail(em)}
                        className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
                          newServiceOwnerEmail.trim().toLowerCase() === em
                            ? "border-primary/50 bg-accent text-primary"
                            : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Dashboard URL
                </label>
                <Input
                  type="url"
                  value={newServiceDashboardUrl}
                  onChange={(e) => setNewServiceDashboardUrl(e.target.value)}
                  placeholder="https://vercel.com/..."
                  className="font-mono text-[13px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">
                    Tier
                  </label>
                  <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
                    {TIER_CHOICES.map((opt) => (
                      <button
                        key={opt.value || "none"}
                        type="button"
                        onClick={() => setNewServiceTier(opt.value)}
                        className={`h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                          newServiceTier === opt.value
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">
                    Renewal / expiry (optional)
                  </label>
                  <Input
                    type="date"
                    value={newServiceRenewalDate}
                    onChange={(e) => setNewServiceRenewalDate(e.target.value)}
                    className="font-mono text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Notes (optional)
                </label>
                <Textarea
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  placeholder="Region, project ref, billing cycle, or extra notes…"
                  className="h-20 text-[13px]"
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
                  navigateHome();
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
        onSelectHome={navigateHome}
        onSelectAccounts={(email) => navigateDirectory("accounts", email)}
        onSelectProviders={() => navigateDirectory("providers")}
        onSelectRenewals={() => navigateDirectory("renewals")}
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

      {/* Personal API Keys & MCP Config Dialog */}
      <McpKeysDialog open={mcpKeysOpen} onOpenChange={setMcpKeysOpen} />
    </div>
  );
}
