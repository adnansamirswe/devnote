"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "motion/react";
import { toast } from "sonner";
import { api, AuthStepResponse } from "@/lib/api";
import { AUTH_QUERY_KEY, TREE_QUERY_KEY } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

type AuthStep =
  | "login"
  | "signup"
  | "verify-email"
  | "verify-device"
  | "forgot-email"
  | "forgot-reset";

interface LoginViewProps {
  onLogin: (data: {
    identifier: string;
    password: string;
  }) => Promise<AuthStepResponse>;
  onSignup: (data: {
    email: string;
    username: string;
    password: string;
  }) => Promise<AuthStepResponse>;
}

export function LoginView({ onLogin, onSignup }: LoginViewProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<AuthStep>("login");

  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [pendingEmail, setPendingEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const triggerError = (err: unknown, fallback: string) => {
    setErrorShake(true);
    setErrorMessage(err instanceof Error ? err.message : fallback);
    setTimeout(() => setErrorShake(false), 500);
  };

  const switchStep = (next: AuthStep) => {
    setStep(next);
    setErrorMessage("");
    setOtpCode("");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await onLogin({ identifier: identifier.trim(), password });
      if (res.requiresVerification && res.email) {
        setPendingEmail(res.email);
        setOtpCode("");
        setStep("verify-email");
        toast.info("Verification code sent to your email");
      } else if (res.requiresDeviceVerification && res.challengeId) {
        setChallengeId(res.challengeId);
        setMaskedEmail(res.maskedEmail || "your email");
        setOtpCode("");
        setStep("verify-device");
        toast.info("New device detected — enter the 6-digit code sent to your email");
      }
    } catch (err) {
      triggerError(err, "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await onSignup({
        email: email.trim(),
        username: username.trim().toLowerCase(),
        password,
      });
      if (res.requiresVerification && res.email) {
        setPendingEmail(res.email);
        setOtpCode("");
        setStep("verify-email");
        toast.success("6-digit verification code sent to your email");
      }
    } catch (err) {
      triggerError(err, "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await api.verifyEmail({
        email: pendingEmail,
        code: otpCode.trim(),
      });
      queryClient.setQueryData(AUTH_QUERY_KEY, res.user);
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
      toast.success("Email verified — welcome to devnote");
    } catch (err) {
      triggerError(err, "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resending || !pendingEmail) return;
    setResending(true);
    setErrorMessage("");
    try {
      await api.resendVerification(pendingEmail);
      toast.success("A new 6-digit code has been sent");
    } catch (err) {
      triggerError(err, "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  const handleVerifyDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await api.verifyDevice({
        challengeId,
        code: otpCode.trim(),
      });
      queryClient.setQueryData(AUTH_QUERY_KEY, res.user);
      queryClient.invalidateQueries({ queryKey: TREE_QUERY_KEY });
      toast.success("Device verified");
    } catch (err) {
      triggerError(err, "Invalid sign-in code");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      await api.forgotPassword(cleanEmail);
      setPendingEmail(cleanEmail);
      setOtpCode("");
      setNewPassword("");
      setStep("forgot-reset");
      toast.success("If an account exists, a 6-digit reset code was sent");
    } catch (err) {
      triggerError(err, "Could not send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMessage("");
    try {
      await api.resetPassword({
        email: pendingEmail,
        code: otpCode.trim(),
        newPassword,
      });
      toast.success("Password updated — please sign in with your new password");
      setIdentifier(pendingEmail);
      setPassword("");
      switchStep("login");
    } catch (err) {
      triggerError(err, "Failed to reset password");
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
        className="w-full max-w-[410px] relative z-10"
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

            {step === "login" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Sign in to devnote
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Use your email or username and password
                </p>
              </>
            )}
            {step === "signup" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Create your account
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  We’ll send a 6-digit verification code to your email
                </p>
              </>
            )}
            {step === "verify-email" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Verify your email
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-mono text-foreground">{pendingEmail}</span>
                </p>
              </>
            )}
            {step === "verify-device" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Verify new device
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  We sent a 6-digit sign-in code to{" "}
                  <span className="font-mono text-foreground">{maskedEmail}</span>
                </p>
              </>
            )}
            {step === "forgot-email" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Reset your password
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Enter your account email to receive a 6-digit reset code
                </p>
              </>
            )}
            {step === "forgot-reset" && (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Set a new password
                </h1>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-mono text-foreground">{pendingEmail}</span>
                </p>
              </>
            )}
          </div>

          {/* Mode Tabs (only on login / signup) */}
          {(step === "login" || step === "signup") && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/70 p-1 mb-5 border border-border/60">
              <button
                type="button"
                onClick={() => switchStep("login")}
                className={`h-8 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                  step === "login"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchStep("signup")}
                className={`h-8 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                  step === "signup"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign up
              </button>
            </div>
          )}

          {/* STEP 1: Login */}
          {step === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-foreground">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (identifier.includes("@")) setEmail(identifier);
                      switchStep("forgot-email");
                    }}
                    className="text-[12px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-10 text-[14px]"
                    required
                  />
                </div>
              </div>

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
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* STEP 2: Signup */}
          {step === "signup" && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
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

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-10 text-[14px]"
                    minLength={8}
                    required
                  />
                </div>
              </div>

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
                    <span>Sending verification code…</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* STEP 3: Verify Email (Signup OTP) */}
          {step === "verify-email" && (
            <form onSubmit={handleVerifyEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  6-digit verification code
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-11 font-mono text-lg tracking-[0.35em] text-center"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
              </div>

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
                disabled={loading || otpCode.length !== 6}
                className="w-full h-10 text-[14px] font-medium gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <span>Verify & enter workspace</span>
                )}
              </Button>

              <div className="flex items-center justify-between text-[12px] pt-1">
                <button
                  type="button"
                  onClick={() => switchStep("login")}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  disabled={resending}
                  onClick={() => void handleResendVerification()}
                  className="text-primary hover:underline font-medium cursor-pointer disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Verify New Device (Login OTP) */}
          {step === "verify-device" && (
            <form onSubmit={handleVerifyDeviceSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  6-digit sign-in code
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-11 font-mono text-lg tracking-[0.35em] text-center"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  This browser will be remembered as a trusted device for 90 days.
                </p>
              </div>

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
                disabled={loading || otpCode.length !== 6}
                className="w-full h-10 text-[14px] font-medium gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying device…</span>
                  </>
                ) : (
                  <span>Verify device & sign in</span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchStep("login")}
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </form>
          )}

          {/* STEP 5: Forgot Password (Request Code) */}
          {step === "forgot-email" && (
            <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  Account email
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
                className="w-full h-10 text-[14px] font-medium gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending reset code…</span>
                  </>
                ) : (
                  <span>Send reset code</span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchStep("login")}
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </form>
          )}

          {/* STEP 6: Reset Password (Code + New Password) */}
          {step === "forgot-reset" && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  6-digit reset code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-10 font-mono text-base tracking-[0.3em]"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="pl-9 h-10 text-[14px]"
                    minLength={8}
                    required
                  />
                </div>
              </div>

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
                disabled={loading || otpCode.length !== 6 || newPassword.length < 8}
                className="w-full h-10 text-[14px] font-medium gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating password…</span>
                  </>
                ) : (
                  <span>Update password</span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchStep("login")}
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </form>
          )}

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
