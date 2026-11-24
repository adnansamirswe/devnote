"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ClientWithProjects, ProjectWithServices, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  Command,
  Download,
  HelpCircle,
  KeyRound,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";

interface SidebarTreeProps {
  user: UserProfile | null;
  clients: ClientWithProjects[];
  isLoading: boolean;
  selectedClientId: string;
  selectedProjectId: string;
  onSelectClient: (clientId: string) => void;
  onSelectProject: (clientId: string, projectId: string) => void;
  onNewClient: () => void;
  onNewProjectForClient: (clientId: string) => void;
  onDeleteClient: (client: ClientWithProjects) => void;
  onDeleteProject: (project: ProjectWithServices) => void;
  onOpenCommandPalette: () => void;
  onToggleAssistant: () => void;
  assistantOpen: boolean;
  onOpenShortcuts: () => void;
  onOpenMcpKeys: () => void;
  onExport: () => void;
  onTriggerImport: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
}

export function SidebarTree({
  user,
  clients,
  isLoading,
  selectedClientId,
  selectedProjectId,
  onSelectClient,
  onSelectProject,
  onNewClient,
  onNewProjectForClient,
  onDeleteClient,
  onDeleteProject,
  onOpenCommandPalette,
  onToggleAssistant,
  assistantOpen,
  onOpenShortcuts,
  onOpenMcpKeys,
  onExport,
  onTriggerImport,
  onLogout,
  onNavigate,
}: SidebarTreeProps) {
  const { theme, setTheme } = useTheme();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Auto-expand the currently selected client
  useEffect(() => {
    if (selectedClientId) {
      setExpandedIds((prev) =>
        prev[selectedClientId] ? prev : { ...prev, [selectedClientId]: true }
      );
    }
  }, [selectedClientId]);

  const toggleExpand = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar font-sans select-none">
      {/* Top: Brand + Search (with own border above divider) */}
      <div className="p-3.5 space-y-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-between px-1">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            <img
              src="/logo.png"
              alt="devnote logo"
              width={22}
              height={22}
              className="h-5.5 w-5.5 object-contain"
            />
            <span>devnote</span>
          </Link>
        </div>

        {/* Single Search Trigger (own visible border, opens ⌘K) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-border-strong bg-background px-2.5 text-[13px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors duration-150 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
          </span>
          <kbd className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground border border-border">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* + New Client */}
        <Button
          variant="outline"
          size="sm"
          onClick={onNewClient}
          className="w-full h-8 justify-start gap-2 text-[13px] font-medium border-border bg-card hover:bg-secondary/70"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span>New client</span>
        </Button>
      </div>

      {/* Expandable Client -> Project Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : clients.length === 0 ? (
          <p className="px-2 py-4 text-[13px] text-muted-foreground">
            No clients yet.
          </p>
        ) : (
          clients.map((client) => {
            const isExpanded = !!expandedIds[client.id];
            const isClientSelected = client.id === selectedClientId;
            const isClientPageActive = isClientSelected && !selectedProjectId;
            const projectCount = client.projects.length;

            return (
              <div key={client.id} className="space-y-0.5">
                {/* Client Row: accent tint + 2px left accent bar when selected */}
                <div
                  onClick={() => {
                    setExpandedIds((prev) => ({ ...prev, [client.id]: true }));
                    onSelectClient(client.id);
                    onNavigate?.();
                  }}
                  className={`group relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-[14px] cursor-pointer transition-colors duration-150 ${
                    isClientSelected
                      ? "bg-accent text-accent-foreground font-semibold before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary"
                      : "text-foreground/85 hover:bg-secondary/80 hover:text-foreground"
                  } ${isClientPageActive ? "" : ""}`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(client.id, e)}
                    aria-label={isExpanded ? "Collapse client" : "Expand client"}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  <span className="flex-1 truncate">{client.name}</span>

                  {/* Labeled muted count on client row; swaps to menu on hover */}
                  <span className="shrink-0 text-[12px] font-normal text-muted-foreground group-hover:hidden pr-1">
                    {projectCount} {projectCount === 1 ? "project" : "projects"}
                  </span>

                  <div className="hidden group-hover:flex items-center shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Client actions"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onNewProjectForClient(client.id);
                          }}
                          className="text-[13px] gap-2"
                        >
                          <Plus className="h-3.5 w-3.5" /> New project
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClient(client);
                          }}
                          className="text-[13px] gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete client
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Nested Projects with thin vertical guide line */}
                {isExpanded && (
                  <div className="ml-4 pl-2.5 border-l border-border space-y-0.5 py-0.5">
                    {client.projects.map((project) => {
                      const isProjectActive =
                        isClientSelected && project.id === selectedProjectId;
                      return (
                        <div
                          key={project.id}
                          onClick={() => {
                            onSelectProject(client.id, project.id);
                            onNavigate?.();
                          }}
                          className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] cursor-pointer transition-colors duration-150 ${
                            isProjectActive
                              ? "bg-accent text-primary font-medium"
                              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          }`}
                        >
                          <span className="truncate">{project.name}</span>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-opacity"
                              aria-label="Project actions"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProject(project);
                                }}
                                className="text-[13px] gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete project
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}

                    {/* Subtle + New project row at end of expanded client */}
                    <button
                      type="button"
                      onClick={() => onNewProjectForClient(client.id)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground/80 hover:bg-secondary/70 hover:text-foreground transition-colors duration-150 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New project</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Utility Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenShortcuts}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Keyboard shortcuts"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <div className="px-2.5 py-2 border-b border-border/70">
                  <div className="text-[13px] font-medium text-foreground truncate">
                    @{user.username}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </>
            )}
            {user?.role === "admin" && (
              <>
                <DropdownMenuItem className="p-0">
                  <Link
                    href="/admin/"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] font-medium text-primary"
                  >
                    <Shield className="h-3.5 w-3.5" /> Admin dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={onOpenMcpKeys}
              className="gap-2 text-[13px]"
            >
              <KeyRound className="h-3.5 w-3.5" /> API Keys & MCP
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExport} className="gap-2 text-[13px]">
              <Download className="h-3.5 w-3.5" /> Export backup (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onTriggerImport}
              className="gap-2 text-[13px]"
            >
              <Upload className="h-3.5 w-3.5" /> Import backup (JSON)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className="gap-2 text-[13px] text-destructive focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
