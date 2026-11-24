"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const shortcuts = [
    { key: "⌘K / Ctrl+K", desc: "Open global command palette" },
    { key: "⌘J / Ctrl+J", desc: "Toggle AI assistant chat" },
    { key: "/", desc: "Focus active pane search / filter" },
    { key: "N", desc: "Create new item in active pane" },
    { key: "?", desc: "Show keyboard shortcuts" },
    { key: "Esc", desc: "Close active dialog or cancel editing" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 py-2">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-secondary font-mono text-foreground font-semibold border border-border/60">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
