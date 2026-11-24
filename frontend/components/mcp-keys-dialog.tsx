"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";

const API_KEYS_QUERY_KEY = ["api-keys"];
const PLACEHOLDER_KEY = "dn_live_YOUR_API_KEY_HERE";

interface McpKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildMcpSnippet(
  mode: "http" | "stdio",
  origin: string,
  apiKey: string
): string {
  if (mode === "http") {
    return JSON.stringify(
      {
        mcpServers: {
          devnote: {
            url: `${origin}/api/mcp`,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      mcpServers: {
        devnote: {
          command: "node",
          args: ["/absolute/path/to/devnote/mcp/server.mjs"],
          env: {
            DEVNOTE_API_URL: origin,
            DEVNOTE_API_KEY: apiKey,
          },
        },
      },
    },
    null,
    2
  );
}

export function McpKeysDialog({ open, onOpenChange }: McpKeysDialogProps) {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedReadyConfig, setCopiedReadyConfig] = useState(false);
  const [copiedPlaceholderConfig, setCopiedPlaceholderConfig] = useState(false);
  const [configTab, setConfigTab] = useState<"http" | "stdio">("http");

  const keysQuery = useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getApiKeys();
      return res.keys;
    },
    enabled: open,
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey(name),
    onSuccess: (res) => {
      setNewKeyName("");
      setJustCreatedKey(res.rawKey);
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
      toast.success("API key created — copy your ready config below");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to create key");
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
      toast.success("API key revoked");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke key");
    },
  });

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://devnote.vecna.workers.dev";

  const readySnippetWithKey = justCreatedKey
    ? buildMcpSnippet(configTab, origin, justCreatedKey)
    : null;

  const placeholderSnippet = buildMcpSnippet(configTab, origin, PLACEHOLDER_KEY);

  const copySecret = () => {
    if (!justCreatedKey) return;
    navigator.clipboard.writeText(justCreatedKey);
    setCopiedSecret(true);
    toast.success("API key copied");
    setTimeout(() => setCopiedSecret(false), 1800);
  };

  const copyReadyConfig = () => {
    if (!readySnippetWithKey) return;
    navigator.clipboard.writeText(readySnippetWithKey);
    setCopiedReadyConfig(true);
    toast.success("Ready MCP config (with your API key) copied");
    setTimeout(() => setCopiedReadyConfig(false), 1800);
  };

  const copyPlaceholderConfig = () => {
    navigator.clipboard.writeText(placeholderSnippet);
    setCopiedPlaceholderConfig(true);
    toast.success("Template MCP config copied");
    setTimeout(() => setCopiedPlaceholderConfig(false), 1800);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Clear one-time raw key when modal closes
      setJustCreatedKey(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[17px]">
            <KeyRound className="h-4 w-4 text-primary shrink-0" />
            <span>API Keys & IDE MCP Server</span>
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Connect your IDE AI (Antigravity, Cursor, Claude Code, VS Code) to read and update your clients, projects, and services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 min-w-0">
          {/* 1. Create New API Key */}
          <div className="space-y-2.5 min-w-0">
            <label className="text-[13px] font-semibold text-foreground block">
              Create personal API key
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newKeyName.trim()) return;
                createKeyMutation.mutate(newKeyName.trim());
              }}
              className="flex items-center gap-2 min-w-0"
            >
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Antigravity IDE, Cursor)"
                className="h-9 flex-1 min-w-0 text-[13px]"
                maxLength={60}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
                className="h-9 px-3.5 text-[13px] gap-1.5 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Generate key</span>
              </Button>
            </form>

            {/* One-time Ready Config & Key Banner (shown only right after generating) */}
            {justCreatedKey && readySnippetWithKey && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                    New key generated (shown once — copy your ready config now):
                  </span>
                  <button
                    type="button"
                    onClick={() => setJustCreatedKey(null)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Done, hide key
                  </button>
                </div>

                {/* Raw key row */}
                <div className="flex items-center justify-between gap-2 rounded-lg bg-background/90 border border-border/80 px-2.5 py-1.5 min-w-0">
                  <code className="truncate font-mono text-[12px] text-foreground select-all">
                    {justCreatedKey}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-[11px] font-semibold text-foreground border border-border hover:border-primary/40 shrink-0 cursor-pointer"
                  >
                    {copiedSecret ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedSecret ? "Copied" : "Copy key"}</span>
                  </button>
                </div>

                {/* Ready-to-paste MCP Config with actual key */}
                <div className="relative rounded-lg bg-background/90 border border-border/80 p-3 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Ready-to-paste MCP config (with your new key pre-filled):
                    </span>
                    <button
                      type="button"
                      onClick={copyReadyConfig}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-95 shrink-0 cursor-pointer"
                    >
                      {copiedReadyConfig ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>
                        {copiedReadyConfig ? "Copied config" : "Copy ready config"}
                      </span>
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">
                    <code>{readySnippetWithKey}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* 2. Active Keys List */}
          <div className="space-y-2 min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              Active API keys
            </div>
            <div className="rounded-xl border border-border bg-background/60 divide-y divide-border overflow-hidden">
              {keysQuery.isLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-8 w-full rounded" />
                </div>
              ) : !keysQuery.data || keysQuery.data.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-muted-foreground">
                  No API keys created yet.
                </div>
              ) : (
                keysQuery.data.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {k.name}
                        </span>
                        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {k.keyPrefix}…
                        </code>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt
                          ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                          : " · Never used"}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteKeyMutation.isPending}
                      onClick={() => deleteKeyMutation.mutate(k.id)}
                      className="h-7 px-2.5 text-[12px] text-muted-foreground hover:text-destructive hover:border-destructive/40 gap-1 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Revoke</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Permanent IDE MCP Config Template (always uses placeholder) */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-foreground">
                IDE MCP configuration template
              </span>
              <div className="inline-flex rounded-lg border border-border bg-secondary/70 p-0.5 text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setConfigTab("http")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                    configTab === "http"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Remote HTTP
                </button>
                <button
                  type="button"
                  onClick={() => setConfigTab("stdio")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                    configTab === "stdio"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Local Stdio
                </button>
              </div>
            </div>

            <div className="relative rounded-xl border border-border bg-notes-surface p-3.5 min-w-0">
              <button
                type="button"
                onClick={copyPlaceholderConfig}
                className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 cursor-pointer"
              >
                {copiedPlaceholderConfig ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>
                  {copiedPlaceholderConfig ? "Copied" : "Copy template"}
                </span>
              </button>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11.5px] leading-relaxed text-foreground pr-28">
                <code>{placeholderSnippet}</code>
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
