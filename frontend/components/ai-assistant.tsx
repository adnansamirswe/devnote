"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { TREE_QUERY_KEY } from "@/lib/queries";
import { AiAction } from "@/types";
import { SmartMarkdown } from "./smart-markdown";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedActions?: AiAction[];
  proposalState?: "pending" | "applying" | "applied" | "dismissed";
  appliedResults?: string[];
}

interface AiAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeClientId?: string;
  activeProjectId?: string;
  onFocusItem: (clientId?: string, projectId?: string) => void;
}

const STARTER_PROMPTS = [
  "Show all services and emails for my current project",
  "Add a new client with a project and Supabase service",
  "Which email owns Supabase across my projects?",
];

function describeAction(action: AiAction): {
  verb: "Create" | "Update" | "Delete";
  entity: "Client" | "Project" | "Service";
  title: string;
  subtitle?: string;
  body?: string;
} {
  switch (action.type) {
    case "create_client":
      return {
        verb: "Create",
        entity: "Client",
        title: action.name,
        body: action.notes,
      };
    case "update_client":
      return {
        verb: "Update",
        entity: "Client",
        title: action.name || action.clientName || action.clientId,
        body: action.notes,
      };
    case "delete_client":
      return {
        verb: "Delete",
        entity: "Client",
        title: action.clientName || action.clientId,
      };
    case "create_project":
      return {
        verb: "Create",
        entity: "Project",
        title: action.name,
        subtitle: action.clientName ? `Under ${action.clientName}` : undefined,
        body: action.details,
      };
    case "update_project":
      return {
        verb: "Update",
        entity: "Project",
        title: action.name || action.projectName || action.projectId,
        body: action.details,
      };
    case "delete_project":
      return {
        verb: "Delete",
        entity: "Project",
        title: action.projectName || action.projectId,
      };
    case "create_service":
      return {
        verb: "Create",
        entity: "Service",
        title: action.name,
        subtitle: action.projectName ? `In ${action.projectName}` : undefined,
        body: action.description,
      };
    case "update_service":
      return {
        verb: "Update",
        entity: "Service",
        title: action.name || action.serviceName || action.serviceId,
        body: action.description,
      };
    case "delete_service":
      return {
        verb: "Delete",
        entity: "Service",
        title: action.serviceName || action.serviceId,
      };
  }
}

export function AiAssistant({
  open,
  onOpenChange,
  activeClientId,
  activeProjectId,
  onFocusItem,
}: AiAssistantProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Keyboard shortcut: Cmd+J / Ctrl+J toggles assistant
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const history = nextMessages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.aiChat({
        messages: history,
        activeClientId: activeClientId || undefined,
        activeProjectId: activeProjectId || undefined,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        proposedActions: res.proposedActions,
        proposalState:
          res.proposedActions && res.proposedActions.length > 0
            ? "pending"
            : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errText =
        err instanceof ApiError
          ? err.message
          : "Could not reach the AI assistant. Please try again.";
      toast.error(errText);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${errText}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmActions = async (messageId: string, actions: AiAction[]) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, proposalState: "applying" } : m
      )
    );

    try {
      const res = await api.aiExecute(actions);
      await queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, proposalState: "applied", appliedResults: res.results }
            : m
        )
      );

      toast.success(
        res.results.length === 1
          ? res.results[0]
          : `Applied ${res.appliedCount} changes`
      );

      if (res.focusClientId) {
        onFocusItem(res.focusClientId, res.focusProjectId);
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, proposalState: "pending" } : m
        )
      );
      toast.error(
        err instanceof ApiError ? err.message : "Failed to apply changes"
      );
    }
  };

  const handleDismissActions = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, proposalState: "dismissed" } : m
      )
    );
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end font-sans pointer-events-none">
      {/* Floating Chatbox Popover */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="pointer-events-auto mb-3 flex h-[540px] max-h-[calc(100vh-6.5rem)] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          >
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <span className="text-[14px] font-semibold text-foreground">
                  devnote AI
                </span>
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘J
                </span>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMessages([])}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Clear conversation"
                    title="Clear chat"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-background/60 px-4 py-4 space-y-3.5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-center space-y-4 py-4">
                  <div className="space-y-1">
                    <h3 className="text-[14px] font-semibold text-foreground">
                      How can I help with your workspace?
                    </h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      Ask about any client, project, or service, or tell me what to add or update. I’ll always ask you to confirm before saving.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="w-full text-left rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] text-foreground/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-primary/40 hover:bg-accent/40 transition-colors cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-2 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-relaxed text-primary-foreground">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none">
                          <SmartMarkdown
                            content={msg.content}
                            className="text-[13px]"
                          />
                        </div>

                        {/* Confirmation Preview Card */}
                        {msg.proposedActions && msg.proposedActions.length > 0 && (
                          <div className="rounded-xl border border-primary/40 bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                            <div className="flex items-center justify-between border-b border-border bg-accent/50 px-3 py-2">
                              <span className="text-[12px] font-semibold text-foreground">
                                Confirm changes ({msg.proposedActions.length})
                              </span>
                              {msg.proposalState === "applied" && (
                                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <Check className="h-3.5 w-3.5" /> Applied
                                </span>
                              )}
                              {msg.proposalState === "dismissed" && (
                                <span className="text-[12px] text-muted-foreground">
                                  Cancelled
                                </span>
                              )}
                            </div>

                            <div className="divide-y divide-border">
                              {msg.proposedActions.map((action, idx) => {
                                const info = describeAction(action);
                                const verbColor =
                                  info.verb === "Delete"
                                    ? "bg-destructive/10 text-destructive"
                                    : info.verb === "Update"
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";

                                return (
                                  <div
                                    key={idx}
                                    className="p-3 space-y-1 text-[12px]"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${verbColor}`}
                                      >
                                        {info.verb} {info.entity}
                                      </span>
                                      <span className="font-semibold text-foreground">
                                        {info.title}
                                      </span>
                                      {info.subtitle && (
                                        <span className="text-muted-foreground">
                                          · {info.subtitle}
                                        </span>
                                      )}
                                    </div>
                                    {info.body && (
                                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4 pt-0.5">
                                        {info.body}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {(msg.proposalState === "pending" ||
                              msg.proposalState === "applying") && (
                              <div className="border-t border-border bg-secondary/30 px-3 py-2.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    disabled={msg.proposalState === "applying"}
                                    onClick={() =>
                                      void handleConfirmActions(
                                        msg.id,
                                        msg.proposedActions || []
                                      )
                                    }
                                    className="h-8 flex-1 text-[12px] gap-1.5"
                                  >
                                    {msg.proposalState === "applying" ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Applying…
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        Confirm & Apply
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={msg.proposalState === "applying"}
                                    onClick={() => handleDismissActions(msg.id)}
                                    className="h-8 text-[12px]"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Need edits? Reply below before confirming.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {sending && (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Thinking…</span>
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
              className="border-t border-border bg-card p-3 shrink-0"
            >
              <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-background px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="Ask or tell me what to add/update…"
                  rows={1}
                  className="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none py-0.5"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !input.trim()}
                  className="h-8 w-8 shrink-0 rounded-lg"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating Launcher Bubble */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(76,61,143,0.35)] hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0 transition-[transform,opacity] duration-150 cursor-pointer"
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
