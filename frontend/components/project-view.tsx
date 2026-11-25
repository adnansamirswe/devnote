"use client";

import React, { useRef, useState } from "react";
import { m } from "motion/react";
import { ClientWithProjects, ProjectStatus, ProjectWithServices, Service, ServiceTier } from "@/types";
import { formatShortHost, safeHref } from "@/lib/workspace-helpers";
import { SmartMarkdown } from "./smart-markdown";
import { ServiceCard } from "./service-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpRight,
  Check,
  GitBranch,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface ProjectViewProps {
  client: ClientWithProjects;
  project: ProjectWithServices;
  knownEmails: string[];
  onSelectClient: (clientId: string) => void;
  onUpdateProject: (data: {
    name?: string;
    details?: string;
    liveUrl?: string;
    repoUrl?: string;
    status?: ProjectStatus;
  }) => Promise<unknown>;
  onDeleteProject: (project: ProjectWithServices) => void;
  onAddService: () => void;
  onUpdateService: (
    serviceId: string,
    data: {
      name?: string;
      description?: string;
      ownerEmail?: string;
      dashboardUrl?: string;
      tier?: ServiceTier;
      renewalDate?: string;
    }
  ) => Promise<unknown>;
  onDuplicateService: (service: Service) => Promise<unknown>;
  onDeleteService: (service: Service) => Promise<unknown>;
}

export function ProjectView({
  client,
  project,
  knownEmails,
  onSelectClient,
  onUpdateProject,
  onDeleteProject,
  onAddService,
  onUpdateService,
  onDuplicateService,
  onDeleteService,
}: ProjectViewProps) {
  const [name, setName] = useState(project.name);
  const [details, setDetails] = useState(project.details);
  const [liveUrl, setLiveUrl] = useState(project.liveUrl || "");
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || "");
  const [status, setStatus] = useState<ProjectStatus>(project.status || "active");
  const [editingLinks, setEditingLinks] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = () => {
    setSaveState("saved");
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    savedFadeRef.current = setTimeout(() => setSaveState("idle"), 1800);
  };

  const commitSave = async (nextName: string, nextDetails: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmedName = nextName.trim() || project.name;
    if (trimmedName === project.name && nextDetails === project.details) return;

    setSaveState("saving");
    try {
      await onUpdateProject({ name: trimmedName, details: nextDetails });
      markSaved();
    } catch {
      setSaveState("idle");
    }
  };

  const scheduleSave = (nextName: string, nextDetails: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(() => {
      void commitSave(nextName, nextDetails);
    }, 600);
  };

  const commitMetaSave = async (next: {
    liveUrl?: string;
    repoUrl?: string;
    status?: ProjectStatus;
  }) => {
    setSaveState("saving");
    try {
      await onUpdateProject(next);
      markSaved();
    } catch {
      setSaveState("idle");
    }
  };

  const liveHref = safeHref(liveUrl);
  const repoHref = safeHref(repoUrl);

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8 sm:px-10 sm:py-10 font-sans">
      {/* 1. Header + Launch Bar */}
      <div className="pb-6 border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <button
              type="button"
              onClick={() => onSelectClient(client.id)}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
            >
              {client.name}
            </button>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  scheduleSave(e.target.value, details);
                }}
                onBlur={() => void commitSave(name, details)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Project name"
                className="w-full max-w-2xl bg-transparent text-[28px] font-semibold tracking-tight leading-tight text-foreground rounded-md px-1.5 -mx-1.5 py-0.5 border border-transparent hover:bg-secondary/70 focus:bg-card focus:border-border-strong focus:outline-none transition-colors duration-150 cursor-text"
              />
              <m.span
                initial={false}
                animate={{ opacity: saveState === "saved" ? 1 : 0 }}
                transition={{ duration: 0.18 }}
                className="inline-flex items-center gap-1 text-[13px] text-muted-foreground shrink-0 pointer-events-none"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Saved
              </m.span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:pt-5">
            <Button onClick={onAddService} size="sm" className="h-9 px-3.5 text-[13px] gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Add service</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors duration-150"
                aria-label="Project options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => setEditingLinks((prev) => !prev)}
                  className="text-[13px] gap-2"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit links
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteProject(project)}
                  className="text-[13px] gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Project Launch Bar */}
        {editingLinks ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEditingLinks(false);
              void commitMetaSave({
                liveUrl: liveUrl.trim(),
                repoUrl: repoUrl.trim(),
                status,
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 rounded-xl border border-border bg-card p-3"
          >
            <div className="sm:col-span-5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Live URL
              </label>
              <Input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://app.example.com"
                className="h-8 mt-1 text-[13px] font-mono"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Repository URL
              </label>
              <Input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="h-8 mt-1 text-[13px] font-mono"
              />
            </div>
            <div className="sm:col-span-2 flex items-end justify-end gap-1.5">
              <Button type="submit" size="sm" className="h-8 w-full text-[12px]">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Selector Pill */}
            <select
              aria-label="Project status"
              value={status}
              onChange={(e) => {
                const nextStatus = e.target.value as ProjectStatus;
                setStatus(nextStatus);
                void commitMetaSave({ status: nextStatus });
              }}
              className={`h-7 rounded-lg border px-2 text-[12px] font-medium focus:outline-none focus:border-primary/50 cursor-pointer ${
                status === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : status === "paused"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>

            {liveHref ? (
              <a
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 font-mono text-[12px] text-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formatShortHost(liveHref)}</span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setEditingLinks(true)}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-dashed border-border-strong px-2.5 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer"
              >
                <Globe className="h-3 w-3" />
                <span>Add live URL</span>
              </button>
            )}

            {repoHref ? (
              <a
                href={repoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Repository</span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setEditingLinks(true)}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-dashed border-border-strong px-2.5 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer"
              >
                <GitBranch className="h-3 w-3" />
                <span>Add repo</span>
              </button>
            )}

            {(liveHref || repoHref) && (
              <button
                type="button"
                onClick={() => setEditingLinks(true)}
                aria-label="Edit project links"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Notes section */}
      <section className="py-8 border-b border-border space-y-3">
        <h2 className="text-[14px] font-semibold text-foreground">Notes</h2>
        {editingNotes ? (
          <textarea
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              scheduleSave(name, e.target.value);
            }}
            onBlur={() => {
              setEditingNotes(false);
              void commitSave(name, details);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            placeholder="Add notes about this project…"
            rows={4}
            autoFocus
            className="w-full rounded-xl border border-primary/40 bg-card p-3 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-y"
          />
        ) : (
          <div
            onClick={() => setEditingNotes(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditingNotes(true);
              }
            }}
            className="group relative rounded-xl border border-border bg-notes-surface p-3 hover:border-primary/40 transition-colors duration-150 cursor-text min-h-[48px]"
          >
            <span className="pointer-events-none absolute top-2.5 right-3 text-[12px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              Click to edit
            </span>
            <div className="pr-24">
              <SmartMarkdown
                content={details}
                placeholder="Add notes about this project…"
              />
            </div>
          </div>
        )}
      </section>

      {/* 3. Services section */}
      <section className="pt-8 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-foreground">Services</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
              {project.services.length}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Accounts, dashboards, and renewal dates for this project
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {project.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              knownEmails={knownEmails}
              onUpdate={(data) => onUpdateService(service.id, data)}
              onDuplicate={() => onDuplicateService(service)}
              onDelete={() => onDeleteService(service)}
            />
          ))}

          {/* Dashed + Add service card */}
          <button
            type="button"
            onClick={onAddService}
            className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border-strong bg-transparent p-5 text-[14px] font-medium text-muted-foreground hover:border-primary/50 hover:bg-accent/50 hover:text-foreground transition-[transform,opacity,border-color,background-color] duration-150 ease-out cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add service</span>
          </button>
        </div>
      </section>
    </div>
  );
}
