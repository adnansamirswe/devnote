"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientWithProjects } from "@/types";
import { matchBrandIcon } from "@/lib/brand-icons";
import {
  FlattenedServiceEntry,
  getRenewals,
  groupByAccount,
  groupByProvider,
  safeHref,
} from "@/lib/workspace-helpers";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  Copy,
  Layers,
  Mail,
  Search,
  Server,
  X,
} from "lucide-react";

export type DirectoryTab = "accounts" | "providers" | "renewals";

interface AccountsViewProps {
  clients: ClientWithProjects[];
  activeTab: DirectoryTab;
  emailFilter?: string;
  onChangeTab: (tab: DirectoryTab, email?: string) => void;
  onSelectProject: (clientId: string, projectId: string) => void;
}

export function AccountsView({
  clients,
  activeTab,
  emailFilter = "",
  onChangeTab,
  onSelectProject,
}: AccountsViewProps) {
  const [query, setQuery] = useState(emailFilter);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const { accounts, unassigned } = useMemo(() => groupByAccount(clients), [clients]);
  const providers = useMemo(() => groupByProvider(clients), [clients]);
  const renewals = useMemo(() => getRenewals(clients), [clients]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredAccounts = useMemo(() => {
    if (!normalizedQuery) return accounts;
    return accounts
      .map((group) => {
        if (group.email.includes(normalizedQuery)) return group;
        const matchingEntries = group.entries.filter(
          (e) =>
            e.service.name.toLowerCase().includes(normalizedQuery) ||
            e.project.name.toLowerCase().includes(normalizedQuery) ||
            e.client.name.toLowerCase().includes(normalizedQuery)
        );
        return matchingEntries.length > 0
          ? { ...group, entries: matchingEntries }
          : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [accounts, normalizedQuery]);

  const filteredProviders = useMemo(() => {
    if (!normalizedQuery) return providers;
    return providers
      .map((group) => {
        if (group.provider.toLowerCase().includes(normalizedQuery)) return group;
        const matchingEntries = group.entries.filter(
          (e) =>
            e.resolvedEmail.includes(normalizedQuery) ||
            e.project.name.toLowerCase().includes(normalizedQuery) ||
            e.client.name.toLowerCase().includes(normalizedQuery)
        );
        return matchingEntries.length > 0
          ? { ...group, entries: matchingEntries }
          : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [providers, normalizedQuery]);

  const filteredRenewals = useMemo(() => {
    if (!normalizedQuery) return renewals;
    return renewals.filter(
      (r) =>
        r.service.name.toLowerCase().includes(normalizedQuery) ||
        r.project.name.toLowerCase().includes(normalizedQuery) ||
        r.client.name.toLowerCase().includes(normalizedQuery) ||
        r.resolvedEmail.includes(normalizedQuery)
    );
  }, [renewals, normalizedQuery]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      toast.success(`Copied ${text}`);
      setTimeout(() => setCopiedValue(null), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const renderServiceRow = (entry: FlattenedServiceEntry, showEmail: boolean) => {
    const brand = matchBrandIcon(entry.service.name);
    const href = safeHref(entry.resolvedUrl);
    return (
      <div
        key={entry.service.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-secondary/60 text-foreground">
            {brand ? (
              <span
                className="h-3.5 w-3.5 flex items-center justify-center fill-current"
                dangerouslySetInnerHTML={{ __html: brand.svg }}
                aria-hidden="true"
              />
            ) : (
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectProject(entry.client.id, entry.project.id)}
                className="text-[14px] font-medium text-foreground hover:text-primary transition-colors cursor-pointer truncate"
              >
                {entry.service.name}
              </button>
              {entry.service.tier && (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                  {entry.service.tier}
                </span>
              )}
              {entry.service.renewalDate && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  Renews {entry.service.renewalDate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground mt-0.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectProject(entry.client.id, entry.project.id)}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {entry.client.name} / {entry.project.name}
              </button>
              {showEmail && entry.resolvedEmail && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(entry.resolvedEmail)}
                    className="font-mono text-[11px] text-foreground/90 hover:text-primary transition-colors cursor-pointer"
                  >
                    {entry.resolvedEmail}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-10 sm:pl-0">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span>Open</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onSelectProject(entry.client.id, entry.project.id)}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            Project
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-8 sm:px-10 sm:py-10 font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="text-[13px] text-muted-foreground">Reverse Lookup</p>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight text-foreground">
            {activeTab === "accounts"
              ? "Accounts by email"
              : activeTab === "providers"
                ? "Services by provider"
                : "Renewals & expiries"}
          </h1>
        </div>

        {/* Segmented Switcher */}
        <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-1 self-start">
          <button
            type="button"
            onClick={() => onChangeTab("accounts")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
              activeTab === "accounts"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Accounts</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {accounts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("providers")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
              activeTab === "providers"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Providers</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {providers.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("renewals")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
              activeTab === "renewals"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>Renewals</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {renewals.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            activeTab === "accounts"
              ? "Filter by email, provider, or project…"
              : activeTab === "providers"
                ? "Filter by provider (Vercel, Neon, Cloudflare)…"
                : "Filter upcoming renewals…"
          }
          className="h-9 pl-9 pr-8 text-[13px] bg-card"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              if (emailFilter) onChangeTab(activeTab);
            }}
            aria-label="Clear filter"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* TAB 1: By Account Email */}
      {activeTab === "accounts" && (
        <div className="space-y-5">
          {filteredAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-8 text-center space-y-1.5">
              <p className="text-[14px] font-medium text-foreground">
                No accounts found
              </p>
              <p className="text-[13px] text-muted-foreground">
                Add an Owner Email to any service card (or include an email in its notes) to group your cloud footprint automatically.
              </p>
            </div>
          ) : (
            filteredAccounts.map((group) => (
              <section
                key={group.email}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-notes-surface">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono text-[14px] font-semibold text-foreground truncate">
                      {group.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy(group.email)}
                      aria-label={`Copy ${group.email}`}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copiedValue === group.email ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[12px] text-muted-foreground">
                    {group.entries.length}{" "}
                    {group.entries.length === 1 ? "service" : "services"} across{" "}
                    {group.projectCount}{" "}
                    {group.projectCount === 1 ? "project" : "projects"}
                  </span>
                </div>
                <div className="divide-y divide-border/70">
                  {group.entries.map((entry) => renderServiceRow(entry, false))}
                </div>
              </section>
            ))
          )}

          {!normalizedQuery && unassigned.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-notes-surface">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  No owner email set ({unassigned.length})
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Open a project to tag these services
                </span>
              </div>
              <div className="divide-y divide-border/70">
                {unassigned.map((entry) => renderServiceRow(entry, false))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: By Provider */}
      {activeTab === "providers" && (
        <div className="space-y-5">
          {filteredProviders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-8 text-center space-y-1.5">
              <p className="text-[14px] font-medium text-foreground">
                No providers match
              </p>
              <p className="text-[13px] text-muted-foreground">
                Services across all your clients and projects appear grouped here by provider name.
              </p>
            </div>
          ) : (
            filteredProviders.map((group) => {
              const brand = matchBrandIcon(group.provider);
              return (
                <section
                  key={group.provider.toLowerCase()}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-notes-surface">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                        {brand ? (
                          <span
                            className="h-3.5 w-3.5 flex items-center justify-center fill-current"
                            dangerouslySetInnerHTML={{ __html: brand.svg }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Server className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[14px] font-semibold text-foreground">
                        {group.provider}
                      </span>
                    </div>
                    <span className="text-[12px] text-muted-foreground">
                      {group.entries.length}{" "}
                      {group.entries.length === 1 ? "instance" : "instances"}
                      {group.uniqueEmails.length > 0
                        ? ` · ${group.uniqueEmails.length} ${
                            group.uniqueEmails.length === 1 ? "email" : "emails"
                          }`
                        : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-border/70">
                    {group.entries.map((entry) => renderServiceRow(entry, true))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: Renewals */}
      {activeTab === "renewals" && (
        <div className="space-y-4">
          {filteredRenewals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-8 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                <CalendarClock className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-medium text-foreground">
                No renewal or expiry dates tracked yet
              </p>
              <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                Add a renewal date to any domain, VPS, paid plan, or free trial card. DevNote will automatically email you 7 days before it renews or expires.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/70">
              {filteredRenewals.map((item) => {
                const brand = matchBrandIcon(item.service.name);
                const href = safeHref(item.resolvedUrl);
                return (
                  <div
                    key={item.service.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
                        {brand ? (
                          <span
                            className="h-4 w-4 flex items-center justify-center fill-current"
                            dangerouslySetInnerHTML={{ __html: brand.svg }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Server className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onSelectProject(item.client.id, item.project.id)}
                            className="text-[14px] font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                          >
                            {item.service.name}
                          </button>
                          <span className="text-[12px] text-muted-foreground">
                            {item.client.name} / {item.project.name}
                          </span>
                        </div>
                        {item.resolvedEmail && (
                          <div className="font-mono text-[12px] text-muted-foreground mt-0.5">
                            {item.resolvedEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 pl-11 sm:pl-0">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium border ${
                          item.urgency === "overdue"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : item.urgency === "soon"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {item.service.renewalDate}
                      </span>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                        >
                          <span>Open</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
