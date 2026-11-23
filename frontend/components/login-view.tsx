"use client";

import React, { useState } from "react";
import { m } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface LoginViewProps {
  onLogin: (password: string) => Promise<any>;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      await onLogin(password);
    } catch (err: any) {
      setErrorShake(true);
      setErrorMessage(err.message || "Invalid password");
      setTimeout(() => setErrorShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Subtle background ambient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.12),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.15),rgba(0,0,0,0))] pointer-events-none" />

      <m.div
        animate={errorShake ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/60 border border-border p-2 mb-3">
              <img
                src="/logo.png"
                alt="devnote logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">devnote</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your access password to unlock your workstation
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  className={`pl-9 pr-3 h-10 font-mono text-sm ${
                    errorMessage ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  autoFocus
                />
              </div>
              {errorMessage && (
                <p className="text-[12px] font-medium text-destructive mt-1.5">{errorMessage}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full h-10 font-medium gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Unlocking...
                </>
              ) : (
                <>
                  Unlock Workstation <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Landing Page
            </Link>
          </div>
        </div>
      </m.div>
    </div>
  );
}
