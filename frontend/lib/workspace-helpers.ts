import { ClientWithProjects, ProjectWithServices, Service } from "@/types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_RE = /https?:\/\/[^\s)>"'`]+/i;

export interface ServicePreset {
  name: string;
  dashboardUrl: string;
  defaultTier: "" | "free" | "paid" | "trial";
}

export const SERVICE_PRESETS: ServicePreset[] = [
  { name: "Cloudflare", dashboardUrl: "https://dash.cloudflare.com", defaultTier: "free" },
  { name: "Vercel", dashboardUrl: "https://vercel.com/dashboard", defaultTier: "free" },
  { name: "Supabase", dashboardUrl: "https://supabase.com/dashboard", defaultTier: "free" },
  { name: "Neon", dashboardUrl: "https://console.neon.tech", defaultTier: "free" },
  { name: "GitHub", dashboardUrl: "https://github.com", defaultTier: "free" },
  { name: "Dokploy", dashboardUrl: "https://", defaultTier: "paid" },
  { name: "Stripe", dashboardUrl: "https://dashboard.stripe.com", defaultTier: "paid" },
  { name: "Resend", dashboardUrl: "https://resend.com/emails", defaultTier: "free" },
  { name: "Upstash", dashboardUrl: "https://console.upstash.com", defaultTier: "free" },
  { name: "Railway", dashboardUrl: "https://railway.app/dashboard", defaultTier: "free" },
  { name: "AWS", dashboardUrl: "https://console.aws.amazon.com", defaultTier: "paid" },
  { name: "Domain / DNS", dashboardUrl: "https://dash.cloudflare.com", defaultTier: "paid" },
];

export function safeHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function formatShortHost(raw: string): string {
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

/** Resolve email from structured ownerEmail or fallback to first email inside markdown notes */
export function resolveServiceEmail(service: Service): string {
  if (service.ownerEmail && service.ownerEmail.trim()) {
    return service.ownerEmail.trim().toLowerCase();
  }
  const match = service.description.match(EMAIL_RE);
  return match ? match[0].toLowerCase() : "";
}

/** Resolve dashboard URL from structured dashboardUrl or fallback to first http(s) URL in notes */
export function resolveServiceUrl(service: Service): string {
  if (service.dashboardUrl && safeHref(service.dashboardUrl)) {
    return service.dashboardUrl.trim();
  }
  const match = service.description.match(URL_RE);
  return match && safeHref(match[0]) ? match[0] : "";
}

export function getDaysUntilRenewal(ymd: string): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const target = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatRenewalStatus(ymd: string): {
  label: string;
  urgency: "overdue" | "soon" | "upcoming";
  days: number;
} | null {
  const days = getDaysUntilRenewal(ymd);
  if (days === null) return null;
  if (days < 0) {
    return { label: `${Math.abs(days)}d overdue`, urgency: "overdue", days };
  }
  if (days === 0) {
    return { label: "Due today", urgency: "overdue", days };
  }
  if (days <= 7) {
    return { label: `In ${days}d`, urgency: "soon", days };
  }
  return { label: ymd, urgency: "upcoming", days };
}

export interface FlattenedServiceEntry {
  client: ClientWithProjects;
  project: ProjectWithServices;
  service: Service;
  resolvedEmail: string;
  resolvedUrl: string;
}

export function flattenServices(clients: ClientWithProjects[]): FlattenedServiceEntry[] {
  const list: FlattenedServiceEntry[] = [];
  for (const client of clients) {
    for (const project of client.projects) {
      for (const service of project.services) {
        list.push({
          client,
          project,
          service,
          resolvedEmail: resolveServiceEmail(service),
          resolvedUrl: resolveServiceUrl(service),
        });
      }
    }
  }
  return list;
}

export function extractKnownEmails(
  clients: ClientWithProjects[],
  userEmail?: string
): string[] {
  const counts = new Map<string, number>();
  for (const entry of flattenServices(clients)) {
    if (entry.resolvedEmail) {
      counts.set(entry.resolvedEmail, (counts.get(entry.resolvedEmail) || 0) + 1);
    }
  }
  if (userEmail) {
    const clean = userEmail.trim().toLowerCase();
    if (clean && !counts.has(clean)) {
      counts.set(clean, 0);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([email]) => email);
}

export interface AccountGroup {
  email: string;
  entries: FlattenedServiceEntry[];
  projectCount: number;
}

export function groupByAccount(clients: ClientWithProjects[]): {
  accounts: AccountGroup[];
  unassigned: FlattenedServiceEntry[];
} {
  const byEmail = new Map<string, FlattenedServiceEntry[]>();
  const unassigned: FlattenedServiceEntry[] = [];

  for (const entry of flattenServices(clients)) {
    if (!entry.resolvedEmail) {
      unassigned.push(entry);
      continue;
    }
    const list = byEmail.get(entry.resolvedEmail) || [];
    list.push(entry);
    byEmail.set(entry.resolvedEmail, list);
  }

  const accounts: AccountGroup[] = Array.from(byEmail.entries())
    .map(([email, entries]) => ({
      email,
      entries,
      projectCount: new Set(entries.map((e) => e.project.id)).size,
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.email.localeCompare(b.email));

  return { accounts, unassigned };
}

export interface ProviderGroup {
  provider: string;
  entries: FlattenedServiceEntry[];
  uniqueEmails: string[];
}

export function groupByProvider(clients: ClientWithProjects[]): ProviderGroup[] {
  const byKey = new Map<string, { label: string; entries: FlattenedServiceEntry[] }>();

  for (const entry of flattenServices(clients)) {
    const label = entry.service.name.trim() || "Unnamed";
    const key = label.toLowerCase();
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.entries.push(entry);
    } else {
      byKey.set(key, { label, entries: [entry] });
    }
  }

  return Array.from(byKey.values())
    .map((b) => ({
      provider: b.label,
      entries: b.entries,
      uniqueEmails: Array.from(
        new Set(b.entries.map((e) => e.resolvedEmail).filter(Boolean))
      ),
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.provider.localeCompare(b.provider));
}

export interface RenewalEntry extends FlattenedServiceEntry {
  daysUntil: number;
  urgency: "overdue" | "soon" | "upcoming";
  label: string;
}

export function getRenewals(clients: ClientWithProjects[]): RenewalEntry[] {
  const list: RenewalEntry[] = [];
  for (const entry of flattenServices(clients)) {
    if (!entry.service.renewalDate) continue;
    const status = formatRenewalStatus(entry.service.renewalDate);
    if (!status) continue;
    list.push({
      ...entry,
      daysUntil: status.days,
      urgency: status.urgency,
      label: status.label,
    });
  }
  return list.sort((a, b) => a.daysUntil - b.daysUntil);
}
