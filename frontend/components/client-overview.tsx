"use client";

import React, { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { ClientWithProjects } from "@/types";
import { SmartMarkdown } from "./smart-markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, FolderKanban, MoreHorizontal, Plus, Trash2 } from "lucide-react";

interface ClientOverviewProps {
  client: ClientWithProjects;
  onUpdateClient: (data: { name?: string; notes?: string }) => Promise<unknown>;
  onDeleteClient: (client: ClientWithProjects) => void;
  onSelectProject: (clientId: string, projectId: string) => void;
  onNewProject: () => void;
}

export function ClientOverview({
  client,
  onUpdateClient,
  onDeleteClient,
  onSelectProject,
  onNewProject,
}: ClientOverviewProps) {
  const [name, setName] = useState(client.name);
  const [notes, setNotes] = useState(client.notes);
  const [editingNotes, setEditingNotes] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setName(client.name);
    setNotes(client.notes);
    setEditingNotes(false);
    setSaveState("idle");
  }, [client.id, client.name, client.notes]);

  const commitSave = async (nextName: string, nextNotes: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmedName = nextName.trim() || client.name;
    if (trimmedName === client.name && nextNotes === client.notes) return;

    setSaveState("saving");
    try {
      await onUpdateClient({ name: trimmedName, notes: nextNotes });
      setSaveState("saved");
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("idle");
    }
  };

  const scheduleSave = (nextName: string, nextNotes: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(() => {
      void commitSave(nextName, nextNotes);
    }, 600);
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8 sm:px-10 sm:py-10 font-sans">
      {/* Header above 1px divider */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-border">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[13px] text-muted-foreground">Client</div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                scheduleSave(e.target.value, notes);
              }}
              onBlur={() => void commitSave(name, notes)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              aria-label="Client name"
              className="w-full max-w-xl bg-transparent text-[28px] font-semibold tracking-tight leading-tight text-foreground rounded-md px-1.5 -mx-1.5 py-0.5 border border-transparent hover:bg-secondary/70 focus:bg-card focus:border-border-strong focus:outline-none transition-colors duration-150 cursor-text"
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
          <Button onClick={onNewProject} size="sm" className="h-9 px-3.5 text-[13px] gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors duration-150"
              aria-label="Client options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onDeleteClient(client)}
                className="text-[13px] gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Notes section with 40px vertical spacing and divider */}
      <section className="py-10 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-foreground">Notes</h2>
        </div>
        {editingNotes ? (
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              scheduleSave(name, e.target.value);
            }}
            onBlur={() => {
              setEditingNotes(false);
              void commitSave(name, notes);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            placeholder="Add notes about this client…"
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
                content={notes}
                placeholder="Add notes about this client…"
              />
            </div>
          </div>
        )}
      </section>

      {/* Projects section */}
      <section className="pt-10 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-foreground">Projects</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
              {client.projects.length}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Select a project to manage its notes, services, and accounts
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.projects.map((project) => {
            const serviceCount = project.services.length;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(client.id, project.id)}
                className="group text-left rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,opacity,border-color] duration-150 ease-out cursor-pointer flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors duration-150 truncate">
                      {project.name}
                    </span>
                    <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {project.details.trim() || "No project notes yet."}
                  </p>
                </div>
                <div className="pt-3 border-t border-border/70 text-[13px] text-muted-foreground">
                  {serviceCount} {serviceCount === 1 ? "service" : "services"}
                </div>
              </button>
            );
          })}

          {/* Dashed + New project card */}
          <button
            type="button"
            onClick={onNewProject}
            className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-border-strong bg-transparent p-5 text-[14px] font-medium text-muted-foreground hover:border-primary/50 hover:bg-accent/50 hover:text-foreground transition-[transform,opacity,border-color,background-color] duration-150 ease-out cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </button>
        </div>
      </section>
    </div>
  );
}
