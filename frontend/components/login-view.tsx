"use client";

import React, { useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, AtSign, Loader2, Lock, Mail, User } from "lucide-react";

interface LoginViewProps {
  onLogin: (data: { identifier: string; password: string }) => Promise<unknown>;
  onSignup: (data: {
    email: string;
    username: string;
    password: string;
  }) => Promise<unknown>;
}

export function LoginView({ onLogin, onSignup }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [forgotNotice, setForgotNotice] = useState(false);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setErrorMessage("");
    setForgotNotice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");
    setForgotNotice(false);

    try {
      if (mode === "login") {
        await onLogin({ identifier: identifier.trim(), password });
      } else {
        await onSignup({
          email: email.trim(),
          username: username.trim().toLowerCase(),
          password,
        });
      }
    } catch (err: unknown) {
      setErrorShake(true);
      setErrorMessage(
        err instanceof Error ? err.message : "Authentication failed"
      );
      setTimeout(() => setErrorShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.10),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.14),rgba(0,0,0,0))] pointer-events-none" />

      <m.div
        animate={errorShake ? { x: [-10, 10, -7, 7, -3, 3, 0] } : {}}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[400px] relative z-10"
      >
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
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
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {mode === "login" ? "Sign in to devnote" : "Create your account"}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {mode === "login"
                ? "Use your email or username and password"
                : "Track your clients, projects, and cloud services"}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/70 p-1 mb-5 border border-border/60">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`h-8 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                mode === "login"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`h-8 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "login" ? (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Email or username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder="you@example.com or username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-10 text-[14px]"
                    autoFocus
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      className="pl-9 h-10 text-[14px]"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">
                    Username
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      autoComplete="username"
                      placeholder="adnan_dev"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase());
                        if (errorMessage) setErrorMessage("");
                      }}
                      className="pl-9 h-10 text-[14px]"
                      minLength={3}
                      maxLength={32}
                      pattern="[a-z0-9_-]+"
                      required
                    />
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    3–32 characters: lowercase letters, numbers, hyphens, or underscores.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-foreground">
                  Password
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setForgotNotice(true)}
                    className="text-[12px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={
                    mode === "login" ? "Enter your password" : "Minimum 8 characters"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  className={`pl-9 h-10 text-[14px] ${
                    errorMessage ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  minLength={mode === "signup" ? 8 : 1}
                  required
                />
              </div>
            </div>

            {forgotNotice && (
              <div className="rounded-lg border border-border bg-notes-surface px-3 py-2 text-[12px] text-muted-foreground">
                Password reset via email will be enabled once SMTP is configured. Contact your workspace admin for assistance.
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 text-[14px] font-medium gap-2 mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === "login" ? "Signing in…" : "Creating account…"}</span>
                </>
              ) : (
                <>
                  <span>{mode === "login" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <Link
              href="/"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to homepage
            </Link>
          </div>
        </div>
      </m.div>
    </div>
  );
}
