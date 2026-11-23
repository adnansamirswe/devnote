"use client";

import React, { useEffect, useState } from "react";
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
  FolderKanban,
  Server,
  User,
  Plus,
  SunMoon,
  Download,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { useTheme } from "next-themes";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientWithProjects[];
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

  // Listen for keyboard shortcut Cmd+K / Ctrl+K
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search clients, projects, services, or commands..." />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No matching items found.</CommandEmpty>

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

        {/* Projects */}
        <CommandGroup heading="Projects">
          {clients.flatMap((client) =>
            client.projects.map((project) => (
              <CommandItem
                key={`project-${project.id}`}
                value={`project ${project.name} ${client.name} ${project.details}`}
                onSelect={() => {
                  onSelectProject(client.id, project.id);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <FolderKanban className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">{project.name}</span>
                <span className="text-xs text-muted-foreground ml-1.5">in {client.name}</span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {project.services.length} {project.services.length === 1 ? "service" : "services"}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        {/* Services */}
        <CommandGroup heading="Services">
          {clients.flatMap((client) =>
            client.projects.flatMap((project) =>
              project.services.map((service) => (
                <CommandItem
                  key={`service-${service.id}`}
                  value={`service ${service.name} ${service.description} ${project.name} ${client.name}`}
                  onSelect={() => {
                    onSelectProject(client.id, project.id);
                    onOpenChange(false);
                  }}
                  className="gap-2"
                >
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{service.name}</span>
                  <span className="text-xs text-muted-foreground ml-1 truncate max-w-[200px]">
                    {client.name} / {project.name}
                  </span>
                </CommandItem>
              ))
            )
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading="Actions">
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
