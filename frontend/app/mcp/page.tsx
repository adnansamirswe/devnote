"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Moon,
  ShieldCheck,
  Sun,
  Terminal,
} from "lucide-react";

const MCP_TOOL_DOCS = [
  {
    name: "get_workspace_tree",
    kind: "Read",
    args: "none",
    desc: "Returns your entire Clients → Projects → Services tree.",
  },
  {
    name: "search_workspace",
    kind: "Read",
    args: "{ query }",
    desc: "Searches clients, projects, owner emails, dashboard URLs, tiers, and notes.",
  },
  {
    name: "list_by_account",
    kind: "Read",
    args: "{ email? }",
    desc: "Reverse lookup grouping every service and project by owner email address.",
  },
  {
    name: "sync_project_stack",
    kind: "Write",
    args: "{ clientName, projectName, liveUrl?, repoUrl?, services[] }",
    desc: "Idempotently creates or updates a Client, Project, and full Services list in one call.",
  },
  {
    name: "get_project",
    kind: "Read",
    args: "{ projectId }",
    desc: "Returns a single project's links, notes, and all attached services.",
  },
  {
    name: "create_client",
    kind: "Write",
    args: "{ name, notes? }",
    desc: "Creates a new client in your workspace.",
  },
  {
    name: "update_client",
    kind: "Write",
    args: "{ clientId, name?, notes? }",
    desc: "Updates a client's name or notes.",
  },
  {
    name: "delete_client",
    kind: "Delete",
    args: "{ clientId }",
    desc: "Deletes a client and cascades its projects and services.",
  },
  {
    name: "create_project",
    kind: "Write",
    args: "{ clientId, name, details? }",
    desc: "Creates a new project under an existing client.",
  },
  {
    name: "update_project",
    kind: "Write",
    args: "{ projectId, name?, details? }",
    desc: "Updates a project's name or markdown notes.",
  },
  {
    name: "delete_project",
    kind: "Delete",
    args: "{ projectId }",
    desc: "Deletes a project and all its services.",
  },
  {
    name: "create_service",
    kind: "Write",
    args: "{ projectId, name, description? }",
    desc: "Adds a service card (Supabase, Vercel, Cloudflare, etc.) to a project.",
  },
  {
    name: "update_service",
    kind: "Write",
    args: "{ serviceId, name?, description? }",
    desc: "Updates a service's name or markdown description.",
  },
  {
    name: "delete_service",
    kind: "Delete",
    args: "{ serviceId }",
    desc: "Removes a service card from a project.",
  },
];

export default function McpDocsPage() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<"http" | "antigravity" | "stdio">("http");
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://devnote.byzo.cc";

  const snippets: Record<"http" | "antigravity" | "stdio", string> = {
    http: JSON.stringify(
      {
        mcpServers: {
          devnote: {
            url: `${origin}/api/mcp`,
            headers: {
              Authorization: "Bearer dn_live_YOUR_API_KEY_HERE",
            },
          },
        },
      },
      null,
      2
    ),
    antigravity: JSON.stringify(
      {
        mcpServers: {
          devnote: {
            serverUrl: `${origin}/api/mcp`,
            headers: {
              Authorization: "Bearer dn_live_YOUR_API_KEY_HERE",
            },
          },
        },
      },
      null,
      2
    ),
    stdio: JSON.stringify(
      {
        mcpServers: {
          devnote: {
            command: "node",
            args: ["/absolute/path/to/devnote/mcp/server.mjs"],
            env: {
              DEVNOTE_API_URL: origin,
              DEVNOTE_API_KEY: "dn_live_YOUR_API_KEY_HERE",
            },
          },
        },
      },
      null,
      2
    ),
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    toast.success("MCP config copied");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-bold text-foreground hover:text-primary transition-colors"
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
            <span className="text-muted-foreground">/</span>
            <span className="text-[13px] font-medium text-foreground">MCP</span>
          </div>

          <div className="flex items-center gap-2">
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
            <Link href="/app/">
              <Button size="sm" className="h-8 px-3 text-xs font-medium gap-1.5">
                <span>Generate API Key</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 space-y-12">
        {/* Hero Header */}
        <section className="pb-8 border-b border-border space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to devnote
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Connect your IDE AI with devnote MCP
          </h1>
          <p className="max-w-2xl text-[15px] text-muted-foreground leading-relaxed">
            Give Antigravity, Cursor, Claude Code, Windsurf, or VS Code direct read and write access to your{" "}
            <span className="text-foreground font-medium">Clients → Projects → Services</span> ledger over the Model Context Protocol.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/app/">
              <Button className="h-10 px-4 text-[13px] gap-2">
                <KeyRound className="h-4 w-4" />
                <span>Create API Key in Settings</span>
              </Button>
            </Link>
            <a
              href="#tools"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground hover:border-primary/40 transition-colors"
            >
              Browse 12 MCP tools
            </a>
          </div>
        </section>

        {/* Quickstart Steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Generate a Personal API Key",
              body: "Sign in at /app/, open Settings → API Keys & MCP, name your key, and copy the one-time dn_live_... secret.",
            },
            {
              step: "2",
              title: "Paste into your IDE config",
              body: "Connect via Remote HTTP (/api/mcp) with zero local installation, or use the Node stdio bridge in mcp/server.mjs.",
            },
            {
              step: "3",
              title: "Ask your IDE AI anything",
              body: "Ask “Which email owns Supabase for Acme?” or “Add Cloudflare R2 to my B2B Portal project” right inside your editor.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none space-y-2"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent font-mono text-xs font-semibold text-accent-foreground">
                {item.step}
              </span>
              <h2 className="text-[15px] font-semibold text-foreground">
                {item.title}
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </section>

        {/* Configuration Templates */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Configuration Templates
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Replace <code className="font-mono text-foreground">dn_live_YOUR_API_KEY_HERE</code> with your personal API key.
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-border bg-secondary/70 p-0.5 text-[12px] self-start">
              {(
                [
                  { id: "http", label: "Cursor / Claude (HTTP)" },
                  { id: "antigravity", label: "Antigravity" },
                  { id: "stdio", label: "Local Stdio" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors cursor-pointer ${
                    tab === t.id
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/70 hover:bg-secondary px-2.5 py-1 text-[12px] font-medium text-foreground cursor-pointer"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </button>
            <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed text-foreground pr-28">
              <code>{snippets[tab]}</code>
            </pre>
          </div>
        </section>

        {/* Exposed Tools Table */}
        <section id="tools" className="space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Available MCP Tools
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
              {MCP_TOOL_DOCS.length}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-[12px] font-medium text-muted-foreground">
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Arguments</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {MCP_TOOL_DOCS.map((tool) => (
                    <tr key={tool.name} className="hover:bg-secondary/25">
                      <td className="py-3 px-4 font-mono text-[12px] font-semibold text-foreground whitespace-nowrap">
                        {tool.name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            tool.kind === "Delete"
                              ? "bg-destructive/10 text-destructive"
                              : tool.kind === "Write"
                                ? "bg-accent text-accent-foreground"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {tool.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                        {tool.args}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {tool.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Security Note */}
        <section className="rounded-xl border border-border bg-notes-surface p-5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-[13px] text-muted-foreground leading-relaxed">
            <div className="font-semibold text-foreground">
              Scoped & revocable by default
            </div>
            <p>
              Personal API keys are stored only as SHA-256 hashes in Cloudflare D1, rate-limited to 120 MCP calls per 15 minutes, strictly scoped to your own workspace data, and blocked from Admin or API key management endpoints. Revoke any key in one click from Settings.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
