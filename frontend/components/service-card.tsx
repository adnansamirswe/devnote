"use client";

import React, { useRef, useState } from "react";
import { m } from "motion/react";
import { toast } from "sonner";
import { Service, ServiceTier } from "@/types";
import { matchBrandIcon } from "@/lib/brand-icons";
import {
  formatRenewalStatus,
  resolveServiceEmail,
  resolveServiceUrl,
  safeHref,
} from "@/lib/workspace-helpers";
import { SmartMarkdown } from "./smart-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ArrowUpRight,
  CalendarClock,
  Check,
  Copy,
  CopyPlus,
  Mail,
  MoreHorizontal,
  Pencil,
  Server,
  Trash2,
} from "lucide-react";

interface ServiceCardProps {
  service: Service;
  knownEmails: string[];
  onUpdate: (data: {
    name?: string;
    description?: string;
    ownerEmail?: string;
    dashboardUrl?: string;
    tier?: ServiceTier;
    renewalDate?: string;
  }) => Promise<unknown>;
  onDuplicate: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

const TIER_OPTIONS: Array<{ value: ServiceTier; label: string }> = [
  { value: "", label: "None" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "trial", label: "Trial" },
];

export function ServiceCard({
  service,
  knownEmails,
  onUpdate,
  onDuplicate,
  onDelete,
}: ServiceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [ownerEmail, setOwnerEmail] = useState(service.ownerEmail || "");
  const [dashboardUrl, setDashboardUrl] = useState(service.dashboardUrl || "");
  const [tier, setTier] = useState<ServiceTier>(service.tier || "");
  const [renewalDate, setRenewalDate] = useState(service.renewalDate || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayName = isEditing ? name : service.name;
  const brand = matchBrandIcon(displayName);

  const startEditing = () => {
    setName(service.name);
    setDescription(service.description);
    setOwnerEmail(service.ownerEmail || "");
    setDashboardUrl(service.dashboardUrl || "");
    setTier(service.tier || "");
    setRenewalDate(service.renewalDate || "");
    setIsEditing(true);
  };

  const commitSave = async () => {
    const trimmedName = name.trim() || service.name;
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const cleanUrl = dashboardUrl.trim();
    const cleanDate = renewalDate.trim();

    if (
      trimmedName === service.name &&
      description === service.description &&
      cleanEmail === (service.ownerEmail || "") &&
      cleanUrl === (service.dashboardUrl || "") &&
      tier === (service.tier || "") &&
      cleanDate === (service.renewalDate || "")
    ) {
      setIsEditing(false);
      return;
    }

    setSaveStatus("saving");
    try {
      await onUpdate({
        name: trimmedName,
        description,
        ownerEmail: cleanEmail,
        dashboardUrl: cleanUrl,
        tier,
        renewalDate: cleanDate,
      });
      setIsEditing(false);
      setSaveStatus("saved");
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 1600);
    } catch {
      setSaveStatus("idle");
    }
  };

  const resolvedEmail = resolveServiceEmail(service);
  const resolvedHref = safeHref(resolveServiceUrl(service));
  const renewalStatus = formatRenewalStatus(service.renewalDate || "");

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resolvedEmail) return;
    try {
      await navigator.clipboard.writeText(resolvedEmail);
      setCopiedEmail(true);
      toast.success(`Copied ${resolvedEmail}`);
      setTimeout(() => setCopiedEmail(false), 1400);
    } catch {
      toast.error("Failed to copy email");
    }
  };

  return (
    <>
      <m.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className={`group relative flex flex-col rounded-xl border bg-card p-5 font-sans shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none transition-[transform,opacity,border-color] duration-150 ease-out ${
          isEditing
            ? "border-primary/50 ring-1 ring-primary/20"
            : "border-border hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border">
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
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Service name"
                aria-label="Service name"
                className="h-8 text-[14px] font-semibold"
              />
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  onClick={startEditing}
                  className="text-[15px] font-semibold tracking-tight text-foreground truncate rounded px-1 -mx-1 py-0.5 hover:bg-secondary/60 transition-colors cursor-text"
                >
                  {service.name}
                </h3>
                {service.tier && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium capitalize border ${
                      service.tier === "paid"
                        ? "border-primary/25 bg-accent text-primary"
                        : service.tier === "trial"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {service.tier}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <m.span
              initial={false}
              animate={{ opacity: saveStatus === "saved" ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground pointer-events-none mr-1"
            >
              <Check className="w-3 h-3 text-emerald-500" />
              Saved
            </m.span>

            {!isEditing && resolvedHref && (
              <a
                href={resolvedHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Open dashboard"
                aria-label={`Open ${service.name} dashboard`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                aria-label="Service actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={startEditing}
                  className="text-[13px] gap-2"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
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

        {/* Body */}
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void commitSave();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Owner email
              </label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@domain.com"
                className="h-8 text-[13px] font-mono"
              />
              {knownEmails.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {knownEmails.slice(0, 4).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setOwnerEmail(em)}
                      className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
                        ownerEmail.trim().toLowerCase() === em
                          ? "border-primary/40 bg-accent text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Dashboard URL
              </label>
              <Input
                type="url"
                value={dashboardUrl}
                onChange={(e) => setDashboardUrl(e.target.value)}
                placeholder="https://dash.cloudflare.com/..."
                className="h-8 text-[13px] font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Tier
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-secondary/50 p-0.5">
                  {TIER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "none"}
                      type="button"
                      onClick={() => setTier(opt.value)}
                      className={`h-7 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        tier === opt.value
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Renewal / expiry
                </label>
                <Input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="h-8 text-[12px] font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Region, project ID, account notes…"
                rows={3}
                className="w-full rounded-lg border border-border/80 bg-background/60 px-2.5 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none resize-y"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setName(service.name);
                  setDescription(service.description);
                  setOwnerEmail(service.ownerEmail || "");
                  setDashboardUrl(service.dashboardUrl || "");
                  setTier(service.tier || "");
                  setRenewalDate(service.renewalDate || "");
                  setIsEditing(false);
                }}
                className="h-8 text-[12px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveStatus === "saving"}
                className="h-8 text-[12px]"
              >
                {saveStatus === "saving" ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col gap-3">
            {/* Quick Metadata Strip: 1-click Copy Email + Renewal Pill */}
            {(resolvedEmail || renewalStatus) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {resolvedEmail && (
                  <button
                    type="button"
                    onClick={(e) => void handleCopyEmail(e)}
                    title="Click to copy owner email"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[12px] text-foreground hover:border-primary/40 hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{resolvedEmail}</span>
                    {copiedEmail ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )}

                {renewalStatus && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-medium ${
                      renewalStatus.urgency === "overdue"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : renewalStatus.urgency === "soon"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-border bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    <span>{renewalStatus.label}</span>
                  </span>
                )}
              </div>
            )}

            {/* Clickable Notes Area */}
            <div
              onClick={startEditing}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEditing();
                }
              }}
              className="flex-1 rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/40 transition-colors cursor-text min-h-[40px]"
            >
              <SmartMarkdown
                content={service.description}
                placeholder="Click to add owner email, dashboard URL, or notes…"
              />
            </div>
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
