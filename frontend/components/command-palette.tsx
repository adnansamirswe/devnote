"use client";

import React, { useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ClientWithProjects } from "@/types";
import {
  flattenServices,
  groupByAccount,
  safeHref,
} from "@/lib/workspace-helpers";
import {
  ArrowUpRight,
  CalendarClock,
  Compass,
  Copy,
  Download,
  FolderKanban,
  HelpCircle,
  Layers,
  LogOut,
  Mail,
  Plus,
  Server,
  SunMoon,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientWithProjects[];
  onSelectHome: () => void;
  onSelectAccounts: (email?: string) => void;
  onSelectProviders: () => void;
  onSelectRenewals: () => void;
  onSelectClient: (clientId: string) => void;
  onSelectProject: (clientId: string, projectId: string) => void;
  onNewClient: () => void;
  onNewProject: () => void;
  onNewService: () => void;
  onExport: () => void;
  onLogout: () => void;
  onOpenShortcuts: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  clients,
  onSelectHome,
  onSelectAccounts,
  onSelectProviders,
  onSelectRenewals,
  onSelectClient,
  onSelectProject,
  onNewClient,
  onNewProject,
  onNewService,
  onExport,
  onLogout,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const { theme, setTheme } = useTheme();

  const { accounts } = useMemo(() => groupByAccount(clients), [clients]);
  const flatServices = useMemo(() => flattenServices(clients), [clients]);
  const launchableServices = useMemo(
    () => flatServices.filter((item) => Boolean(safeHref(item.resolvedUrl))),
    [flatServices]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${value}`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to project, open dashboard, copy email, or run action…" />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No matching items found.</CommandEmpty>

        {/* Quick Launch Dashboards */}
        {launchableServices.length > 0 && (
          <CommandGroup heading="Open Dashboard">
            {launchableServices.map((item) => {
              const href = safeHref(item.resolvedUrl);
              if (!href) return null;
              return (
                <CommandItem
                  key={`launch-${item.service.id}`}
                  value={`open launch dashboard ${item.service.name} ${item.project.name} ${item.client.name} ${item.resolvedEmail}`}
                  onSelect={() => {
                    window.open(href, "_blank", "noopener,noreferrer");
                    onOpenChange(false);
                  }}
                  className="gap-2"
                >
                  <ArrowUpRight className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">
                    Open {item.service.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {item.project.name}
                  </span>
                  {item.resolvedEmail && (
                    <span className="text-xs text-muted-foreground ml-auto font-mono truncate max-w-[160px]">
                      {item.resolvedEmail}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Accounts (Emails) */}
        {accounts.length > 0 && (
          <CommandGroup heading="Accounts (By Email)">
            {accounts.map((acc) => (
              <CommandItem
                key={`account-${acc.email}`}
                value={`account email ${acc.email}`}
                onSelect={() => {
                  onSelectAccounts(acc.email);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <Mail className="w-4 h-4 text-primary" />
                <span className="font-mono text-[13px] text-foreground">
                  {acc.email}
                </span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {acc.entries.length} {acc.entries.length === 1 ? "service" : "services"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Projects */}
        <CommandGroup heading="Projects">
          {clients.flatMap((client) =>
            client.projects.map((project) => (
              <CommandItem
                key={`project-${project.id}`}
                value={`project ${project.name} ${client.name} ${project.liveUrl} ${project.details}`}
                onSelect={() => {
                  onSelectProject(client.id, project.id);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <FolderKanban className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{project.name}</span>
                <span className="text-xs text-muted-foreground ml-1">in {client.name}</span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {project.services.length} {project.services.length === 1 ? "service" : "services"}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        {/* Services (jump or copy email) */}
        <CommandGroup heading="Services">
          {flatServices.map((item) => (
            <CommandItem
              key={`service-${item.service.id}`}
              value={`service ${item.service.name} ${item.resolvedEmail} ${item.service.description} ${item.project.name} ${item.client.name}`}
              onSelect={() => {
                onSelectProject(item.client.id, item.project.id);
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {item.service.name}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                {item.client.name} / {item.project.name}
              </span>
              {item.resolvedEmail && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(item.resolvedEmail);
                    onOpenChange(false);
                  }}
                  title={`Copy ${item.resolvedEmail}`}
                  className="ml-auto inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[130px]">{item.resolvedEmail}</span>
                </button>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Clients */}
        {clients.length > 0 && (
          <CommandGroup heading="Clients">
            {clients.map((client) => (
              <CommandItem
                key={`client-${client.id}`}
                value={`client ${client.name} ${client.notes}`}
                onSelect={() => {
                  onSelectClient(client.id);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{client.name}</span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {client.projects.length} {client.projects.length === 1 ? "project" : "projects"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Views & Quick Actions */}
        <CommandGroup heading="Views & Actions">
          <CommandItem
            onSelect={() => {
              onSelectHome();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Compass className="w-4 h-4 text-muted-foreground" />
            <span>Go to Launchpad</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onSelectAccounts();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>View Accounts by Email</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onSelectProviders();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span>View Services by Provider</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onSelectRenewals();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <span>View Upcoming Renewals</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNewClient();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>New Client</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNewProject();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>New Project</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNewService();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>New Service</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <SunMoon className="w-4 h-4 text-muted-foreground" />
            <span>Toggle Theme ({theme === "dark" ? "Switch to Light" : "Switch to Dark"})</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onExport();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
            <span>Export Backup (JSON)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenShortcuts();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span>Keyboard Shortcuts</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onLogout();
              onOpenChange(false);
            }}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
