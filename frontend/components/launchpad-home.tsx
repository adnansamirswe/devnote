"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientWithProjects } from "@/types";
import { matchBrandIcon } from "@/lib/brand-icons";
import {
  formatShortHost,
  getRenewals,
  groupByAccount,
  resolveServiceEmail,
  safeHref,
} from "@/lib/workspace-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  Copy,
  FolderKanban,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Plus,
  Search,
  Server,
} from "lucide-react";

interface LaunchpadHomeProps {
  clients: ClientWithProjects[];
  onSelectClient: (clientId: string) => void;
  onSelectProject: (clientId: string, projectId: string) => void;
  onOpenAccounts: (email?: string) => void;
  onOpenRenewals: () => void;
  onNewClient: () => void;
  onNewProjectForClient: (clientId: string) => void;
  onOpenCommandPalette: () => void;
}

export function LaunchpadHome({
  clients,
  onSelectClient,
  onSelectProject,
  onOpenAccounts,
  onOpenRenewals,
  onNewClient,
  onNewProjectForClient,
  onOpenCommandPalette,
}: LaunchpadHomeProps) {
  const [filter, setFilter] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const allProjects = useMemo(() => {
    const items = clients.flatMap((client) =>
      client.projects.map((project) => {
        const emails = Array.from(
          new Set(project.services.map((s) => resolveServiceEmail(s)).filter(Boolean))
        );
        return { client, project, emails };
      })
    );
    return items.sort((a, b) => {
      // Active first, then most recently updated
      const rank = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
      const rDiff = rank(a.project.status || "active") - rank(b.project.status || "active");
      if (rDiff !== 0) return rDiff;
      return b.project.updatedAt - a.project.updatedAt;
    });
  }, [clients]);

  const { accounts } = useMemo(() => groupByAccount(clients), [clients]);
  const renewals = useMemo(() => getRenewals(clients), [clients]);
  const urgentRenewals = useMemo(
    () => renewals.filter((r) => r.daysUntil <= 30),
    [renewals]
  );

  const totalServices = useMemo(
    () => allProjects.reduce((sum, item) => sum + item.project.services.length, 0),
    [allProjects]
  );

  const filteredProjects = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allProjects;
    return allProjects.filter(({ client, project, emails }) => {
      if (project.name.toLowerCase().includes(q)) return true;
      if (client.name.toLowerCase().includes(q)) return true;
      if (project.liveUrl.toLowerCase().includes(q)) return true;
      if (project.repoUrl.toLowerCase().includes(q)) return true;
      if (emails.some((e) => e.includes(q))) return true;
      if (project.services.some((s) => s.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [allProjects, filter]);

  const copyEmail = async (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      toast.success(`Copied ${email}`);
      setTimeout(() => setCopiedEmail(null), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (clients.length === 0) {
    return (
      <div className="flex h-full min-h-[460px] items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Welcome to devnote
            </h1>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              Organize your stack as{" "}
              <span className="text-foreground font-medium">
                Client → Project → Service
              </span>{" "}
              so every dashboard link, owner email, and renewal date is one keystroke away.
            </p>
          </div>
          <Button onClick={onNewClient} className="h-10 px-5 text-[14px] gap-2">
            <Plus className="h-4 w-4" />
            <span>Create your first client</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-8 sm:px-10 sm:py-10 font-sans space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="text-[13px] text-muted-foreground">Workspace</p>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight text-foreground">
            Launchpad
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenCommandPalette}
            className="h-9 px-3 text-[13px] gap-2 border-border bg-card"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Quick jump</span>
            <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground border border-border">
              /
            </kbd>
          </Button>
          <Button
            size="sm"
            onClick={() => onNewProjectForClient(clients[0].id)}
            className="h-9 px-3.5 text-[13px] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </Button>
        </div>
      </div>

      {/* Compact Index Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-[12px] text-muted-foreground">Projects</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[20px] font-semibold tracking-tight text-foreground tabular-nums">
              {allProjects.length}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-[12px] text-muted-foreground">Services</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[20px] font-semibold tracking-tight text-foreground tabular-nums">
              {totalServices}
            </span>
            <span className="text-[12px] text-muted-foreground">tracked</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenAccounts()}
          className="text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors cursor-pointer"
        >
          <div className="text-[12px] text-muted-foreground flex items-center justify-between">
            <span>Accounts</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[20px] font-semibold tracking-tight text-foreground tabular-nums">
              {accounts.length}
            </span>
            <span className="text-[12px] text-primary font-medium">By email</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenRenewals}
          className="text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors cursor-pointer"
        >
          <div className="text-[12px] text-muted-foreground flex items-center justify-between">
            <span>Renewals (30d)</span>
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[20px] font-semibold tracking-tight text-foreground tabular-nums">
              {urgentRenewals.length}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {renewals.length} total
            </span>
          </div>
        </button>
      </div>

      {/* Upcoming Renewals Banner (only when renewals exist within 30 days) */}
      {urgentRenewals.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Upcoming renewals & expiries</span>
            </div>
            <button
              type="button"
              onClick={onOpenRenewals}
              className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              View all ({renewals.length})
            </button>
          </div>
          <div className="divide-y divide-border/70">
            {urgentRenewals.slice(0, 4).map((item) => {
              const href = safeHref(item.resolvedUrl);
              return (
                <div
                  key={item.service.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-[13px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectProject(item.client.id, item.project.id)}
                      className="font-medium text-foreground hover:text-primary transition-colors truncate cursor-pointer"
                    >
                      {item.service.name}
                    </button>
                    <span className="text-muted-foreground truncate">
                      {item.client.name} / {item.project.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium border ${
                        item.urgency === "overdue"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {item.label}
                    </span>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] text-foreground hover:border-primary/40 transition-colors"
                      >
                        Open
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top Accounts Quick Bar */}
      {accounts.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-foreground">Accounts</h2>
            <button
              type="button"
              onClick={() => onOpenAccounts()}
              className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              Inspect all accounts →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {accounts.slice(0, 6).map((acc) => (
              <div
                key={acc.email}
                className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden text-[12px]"
              >
                <button
                  type="button"
                  onClick={() => onOpenAccounts(acc.email)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-secondary/70 transition-colors cursor-pointer"
                >
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground">{acc.email}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[11px] text-muted-foreground">
                    {acc.entries.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => void copyEmail(acc.email, e)}
                  aria-label={`Copy ${acc.email}`}
                  className="inline-flex h-full items-center px-2 border-l border-border text-muted-foreground hover:bg-secondary/70 hover:text-foreground transition-colors cursor-pointer"
                >
                  {copiedEmail === acc.email ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick-Launch Projects Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-foreground">All projects</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
              {filteredProjects.length}
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects, services, or emails…"
              className="h-8 pl-8 text-[13px] bg-card"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong p-8 text-center space-y-2">
            <p className="text-[14px] font-medium text-foreground">
              {allProjects.length === 0 ? "No projects yet" : "No projects match that filter"}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {allProjects.length === 0
                ? "Create your first project to start mapping its accounts and dashboards."
                : "Try searching by client name, service provider, or owner email."}
            </p>
            {allProjects.length === 0 && (
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => onNewProjectForClient(clients[0].id)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New project
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map(({ client, project, emails }) => {
              const liveHref = safeHref(project.liveUrl);
              const repoHref = safeHref(project.repoUrl);
              const status = project.status || "active";
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(client.id, project.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectProject(client.id, project.id);
                    }
                  }}
                  className="group rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,border-color] duration-150 ease-out cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClient(client.id);
                          }}
                          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {client.name}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          <h3 className="text-[16px] font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                            {project.name}
                          </h3>
                          {status !== "active" && (
                            <span
                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${
                                status === "paused"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  : "border-border bg-secondary text-muted-foreground"
                              }`}
                            >
                              {status === "paused" ? "Paused" : "Archived"}
                            </span>
                          )}
                        </div>
                      </div>
                      <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>

                    {/* Quick Launch Links */}
                    {(liveHref || repoHref) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {liveHref && (
                          <a
                            href={liveHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[11px] text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          >
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[160px]">
                              {formatShortHost(liveHref)}
                            </span>
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                        {repoHref && (
                          <a
                            href={repoHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          >
                            <GitBranch className="h-3 w-3 text-muted-foreground" />
                            <span>Repo</span>
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom bar: Service Brand Badges + Account summary */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/70">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {project.services.slice(0, 5).map((service) => {
                        const brand = matchBrandIcon(service.name);
                        return (
                          <span
                            key={service.id}
                            title={service.name}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/80 bg-secondary/60 text-foreground"
                          >
                            {brand ? (
                              <span
                                className="h-3.5 w-3.5 flex items-center justify-center fill-current"
                                dangerouslySetInnerHTML={{ __html: brand.svg }}
                                aria-hidden="true"
                              />
                            ) : (
                              <Server className="h-3 w-3 text-muted-foreground" />
                            )}
                          </span>
                        );
                      })}
                      {project.services.length > 5 && (
                        <span className="text-[11px] font-mono text-muted-foreground pl-0.5">
                          +{project.services.length - 5}
                        </span>
                      )}
                      {project.services.length === 0 && (
                        <span className="text-[12px] text-muted-foreground">
                          No services
                        </span>
                      )}
                    </div>

                    <div className="text-[12px] text-muted-foreground truncate max-w-[180px]">
                      {emails.length === 1 ? (
                        <span className="font-mono text-[11px]">{emails[0]}</span>
                      ) : emails.length > 1 ? (
                        <span>{emails.length} accounts</span>
                      ) : (
                        <span>
                          {project.services.length}{" "}
                          {project.services.length === 1 ? "service" : "services"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
