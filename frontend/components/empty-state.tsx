import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed border-border/80 bg-card/40 my-auto">
      <div className="h-12 w-12 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center text-muted-foreground mb-3.5">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="sm"
          className="mt-4 h-8 px-3 text-xs gap-1.5 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
