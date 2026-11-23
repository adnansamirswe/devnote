"use client";

import React, { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { Service } from "@/types";
import { matchBrandIcon } from "@/lib/brand-icons";
import { SmartMarkdown } from "./smart-markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  CopyPlus,
  MoreHorizontal,
  Server,
  Trash2,
} from "lucide-react";

interface ServiceCardProps {
  service: Service;
  onUpdate: (data: { name?: string; description?: string }) => Promise<unknown>;
  onDuplicate: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export function ServiceCard({
  service,
  onUpdate,
  onDuplicate,
  onDelete,
}: ServiceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brand = matchBrandIcon(name);

  useEffect(() => {
    if (!isEditing) {
      setName(service.name);
      setDescription(service.description);
    }
  }, [service.name, service.description, isEditing]);

  const commitSave = async (nextName: string, nextDesc: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const trimmedName = nextName.trim() || service.name;
    if (trimmedName === service.name && nextDesc === service.description) return;

    setSaveStatus("saving");
    try {
      await onUpdate({ name: trimmedName, description: nextDesc });
      setSaveStatus("saved");
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 1600);
    } catch {
      setSaveStatus("idle");
    }
  };

  const scheduleSave = (nextName: string, nextDesc: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSaveStatus("saving");
    debounceTimerRef.current = setTimeout(() => {
      void commitSave(nextName, nextDesc);
    }, 600);
  };

  const handleCardBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    if (e.relatedTarget && cardRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsEditing(false);
    void commitSave(name, description);
  };

  return (
    <>
      <m.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        onBlur={isEditing ? handleCardBlur : undefined}
        className={`group relative flex flex-col rounded-xl border bg-card p-5 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none transition-[transform,opacity,border-color] duration-150 ease-out ${
          isEditing
            ? "border-primary/50 ring-1 ring-primary/20"
            : "border-border hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
        }`}
      >
        {/* Header: Brand icon + Name + Menu separated by 1px divider */}
        <div className="flex items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-secondary/60 text-foreground">
              {brand ? (
                <div
                  className="h-4 w-4 flex items-center justify-center fill-current"
                  dangerouslySetInnerHTML={{ __html: brand.svg }}
                  aria-hidden="true"
                />
              ) : (
                <span className="text-[13px] font-semibold text-primary">
                  {name.trim().charAt(0).toUpperCase() || (
                    <Server className="w-4 h-4" />
                  )}
                </span>
              )}
            </div>

            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  scheduleSave(e.target.value, description);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    void commitSave(name, description);
                  }
                }}
                placeholder="Service name"
                aria-label="Service name"
                className="w-full bg-transparent text-[15px] font-semibold tracking-tight text-foreground rounded px-1.5 -mx-1.5 py-0.5 border border-border/80 focus:border-primary/50 focus:outline-none"
              />
            ) : (
              <h3
                onClick={() => setIsEditing(true)}
                className="text-[15px] font-semibold tracking-tight text-foreground truncate rounded px-1.5 -mx-1.5 py-0.5 hover:bg-secondary/60 transition-colors cursor-text"
              >
                {name}
              </h3>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <m.span
              initial={false}
              animate={{ opacity: saveStatus === "saved" ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground pointer-events-none"
            >
              <Check className="w-3 h-3 text-emerald-500" />
              Saved
            </m.span>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                aria-label="Service actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => void onDuplicate()}
                  className="text-[13px] gap-2"
                >
                  <CopyPlus className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-[13px] gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body: Rendered markdown or inline textarea */}
        {isEditing ? (
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              scheduleSave(name, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsEditing(false);
                void commitSave(name, description);
              }
            }}
            placeholder="Account email, tier, region, or links…"
            rows={4}
            autoFocus
            className="w-full rounded-lg border border-border/80 bg-background/60 px-2.5 py-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none resize-y"
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsEditing(true);
              }
            }}
            className="flex-1 rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/40 transition-colors cursor-text min-h-[52px]"
          >
            <SmartMarkdown
              content={description}
              placeholder="Add account email, tier, or notes…"
            />
          </div>
        )}
      </m.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete service</DialogTitle>
            <DialogDescription>
              Remove <span className="font-semibold text-foreground">{name}</span>? You can undo
              this from the notification toast for 6 seconds.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeleteConfirmOpen(false);
                await onDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
