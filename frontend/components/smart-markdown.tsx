"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SmartMarkdownProps {
  content: string;
  placeholder?: string;
  className?: string;
}

function CopyChip({
  text,
  label,
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied", {
      description: text,
      duration: 1500,
    });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCopy(e);
        }
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 my-0.5 mx-0.5 text-[12px] font-mono font-medium rounded-md bg-chip-surface hover:bg-accent/70 text-foreground border border-chip-border hover:border-primary/40 transition-colors duration-150 cursor-pointer select-all group align-baseline"
      title={`Copy ${text}`}
    >
      <span className="truncate max-w-[240px]">{label || text}</span>
      <span className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">
        {copied ? (
          <Check className="w-3 h-3 text-emerald-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </span>
    </span>
  );
}

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function SmartMarkdown({
  content,
  placeholder = "Add notes…",
  className = "",
}: SmartMarkdownProps) {
  if (!content || !content.trim()) {
    return (
      <p className="text-[14px] text-muted-foreground/60 select-none">
        {placeholder}
      </p>
    );
  }

  const renderTextWithEmails = (children: React.ReactNode): React.ReactNode => {
    if (typeof children !== "string") return children;

    const parts = children.split(EMAIL_REGEX);
    if (parts.length === 1) return children;

    return parts.map((part, index) => {
      if (part.match(EMAIL_REGEX)) {
        return <CopyChip key={index} text={part} />;
      }
      return part;
    });
  };

  return (
    <div
      className={`font-sans text-[14px] leading-relaxed text-foreground/90 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">
              {React.Children.map(children, renderTextWithEmails)}
            </p>
          ),
          a: ({ href, children }) => {
            const url = href || "";
            return (
              <span className="inline-flex items-center gap-1">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {children}
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
                <CopyChip text={url} label="copy" />
              </span>
            );
          },
          code: ({ children }) => {
            const codeText = String(children).replace(/\n$/, "");
            const isMultiLine = codeText.includes("\n");

            if (isMultiLine) {
              return (
                <div className="relative group my-2">
                  <pre className="p-3 rounded-lg bg-secondary/70 border border-border font-mono text-[12px] overflow-x-auto text-foreground">
                    <code>{codeText}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(codeText);
                      toast.success("Copied");
                    }}
                    className="absolute top-2 right-2 p-1 rounded bg-card hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return <CopyChip text={codeText} />;
          },
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[14px]">
              {React.Children.map(children, renderTextWithEmails)}
            </li>
          ),
          h1: ({ children }) => (
            <h1 className="text-[16px] font-semibold tracking-tight mt-3 mb-1 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-semibold tracking-tight mt-2.5 mb-1 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[14px] font-medium text-foreground mt-2 mb-1">
              {children}
            </h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
