"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Lenis from "lenis";
import { useTheme } from "next-themes";
import { BlurFade } from "@/components/ui/blur-fade";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { Marquee } from "@/components/ui/marquee";
import { Button } from "@/components/ui/button";
import { matchBrandIcon } from "@/lib/brand-icons";
import {
  Terminal,
  Server,
  ArrowRight,
  Copy,
  Check,
  Sun,
  Moon,
  FolderKanban,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Command,
  Plus,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function BrandBadge({ name }: { name: string }) {
  const brand = matchBrandIcon(name);
  return (
    <span className="w-5 h-5 rounded bg-secondary text-foreground flex items-center justify-center shrink-0">
      {brand ? (
        <span
          className="w-3 h-3 fill-current flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: brand.svg }}
        />
      ) : (
        <Server className="w-3 h-3" />
      )}
    </span>
  );
}

const BRAND_MARQUEE = [
  "Supabase",
  "Vercel",
  "Cloudflare",
  "Stripe",
  "AWS",
  "Google Cloud",
  "PostgreSQL",
  "Redis",
  "Docker",
  "PlanetScale",
  "Neon",
  "Resend",
  "PostHog",
  "Sentry",
];

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [previewProject, setPreviewProject] = useState<"portal" | "sync">("portal");

  // Initialize smooth scrolling with Lenis for the landing page
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
    });

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  const copyDeployCommand = () => {
    const cmd =
      "git clone https://github.com/adnansamirswe/devnote.git && cd devnote && npm install && npm run deploy";
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const copyChip = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", { description: text, duration: 1500 });
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 font-mono font-bold text-sm">
              <img
                src="/logo.png"
                alt="devnote logo"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
              <span>devnote</span>
            </Link>
            <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
              by{" "}
              <a
                href="https://byzo.cc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground underline"
              >
                Byzo
              </a>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/adnansamirswe/devnote"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1.5 transition-colors"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Link href="/app">
              <Button size="sm" className="h-8 px-3 text-xs font-medium gap-1.5 shadow-sm">
                <span>Launch App</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <BlurFade delay={0.05} duration={0.6}>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-[1.12]">
            Never lose track of which account owns what service.
          </h1>
        </BlurFade>

        <BlurFade delay={0.15} duration={0.6}>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-sans leading-relaxed">
            A minimal, precision notepad for developers to organize{" "}
            <span className="text-foreground font-medium">clients → projects → services</span>. No
            surprise paused databases. No lost owner emails. Zero SaaS fluff.
          </p>
        </BlurFade>

        <BlurFade delay={0.25} duration={0.6}>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/app">
              <ShimmerButton
                shimmerColor="rgba(255, 255, 255, 0.35)"
                background="var(--primary)"
                className="h-11 px-6 font-medium text-sm text-white shadow-sm"
              >
                Open Live Workstation →
              </ShimmerButton>
            </Link>

            <a
              href="https://github.com/adnansamirswe/devnote"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
            >
              <GithubIcon className="w-4 h-4" /> Star on GitHub
            </a>
          </div>
        </BlurFade>
      </section>

      {/* Marquee of Supported Tech */}
      <section className="py-6 border-y border-border/60 bg-card/30 overflow-hidden">
        <Marquee pauseOnHover className="[--duration:28s]">
          {BRAND_MARQUEE.map((tech, idx) => (
            <div
              key={idx}
              className="mx-4 flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <span>{tech}</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* Interactive 2-Pane Dashboard Preview */}
      <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <BlurFade delay={0.2} duration={0.8}>
          <div className="rounded-2xl border border-border bg-background shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-2xl overflow-hidden font-sans">
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
              {/* Left Sidebar Tree (matching redesigned /app) */}
              <div className="md:col-span-4 lg:col-span-3 flex flex-col border-b md:border-b-0 md:border-r border-sidebar-border bg-sidebar select-none">
                {/* Sidebar Header */}
                <div className="p-3.5 space-y-2.5 border-b border-sidebar-border">
                  <div className="flex items-center gap-2 px-1 text-[14px] font-semibold tracking-tight text-foreground">
                    <img
                      src="/logo.png"
                      alt="devnote logo"
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                    <span>devnote</span>
                  </div>

                  <div className="flex h-8 w-full items-center justify-between rounded-lg border border-border-strong bg-background px-2.5 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5" />
                      <span>Search…</span>
                    </span>
                    <kbd className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border">
                      <Command className="h-2.5 w-2.5" />K
                    </kbd>
                  </div>

                  <div className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-foreground">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>New client</span>
                  </div>
                </div>

                {/* Expandable Tree */}
                <div className="flex-1 p-2.5 space-y-1">
                  {/* Expanded Selected Client */}
                  <div className="space-y-0.5">
                    <div className="relative flex items-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-[13px] font-semibold text-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-primary">
                      <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">Acme Global</span>
                      <span className="text-[11px] font-normal text-muted-foreground pr-1">
                        2 projects
                      </span>
                    </div>

                    {/* Nested Projects with Guide Line */}
                    <div className="ml-4 pl-2.5 border-l border-border space-y-0.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewProject("portal")}
                        className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors cursor-pointer ${
                          previewProject === "portal"
                            ? "bg-accent text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">B2B Customer Portal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewProject("sync")}
                        className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors cursor-pointer ${
                          previewProject === "sync"
                            ? "bg-accent text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">Warehouse Queue Sync</span>
                      </button>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-muted-foreground/75">
                        <Plus className="h-3 w-3" />
                        <span>New project</span>
                      </div>
                    </div>
                  </div>

                  {/* Collapsed Clients */}
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] text-foreground/80">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">HyperScale AI</span>
                    <span className="text-[11px] text-muted-foreground pr-1">1 project</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] text-foreground/80">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">NextGen Commerce</span>
                    <span className="text-[11px] text-muted-foreground pr-1">1 project</span>
                  </div>
                </div>
              </div>

              {/* Right Main Project Canvas (matching redesigned /app) */}
              <div className="md:col-span-8 lg:col-span-9 p-6 sm:p-8 bg-background">
                {/* Project Header above 1px divider */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-border">
                  <div className="space-y-0.5">
                    <div className="text-[12px] text-muted-foreground">Acme Global</div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[22px] sm:text-[24px] font-semibold tracking-tight text-foreground">
                        {previewProject === "portal"
                          ? "B2B Customer Portal"
                          : "Warehouse Queue Sync"}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Saved
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground">
                      <Plus className="h-3.5 w-3.5" />
                      Add service
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                {/* Notes Panel */}
                <div className="py-6 border-b border-border space-y-2">
                  <div className="text-[13px] font-semibold text-foreground">Notes</div>
                  <div className="group relative rounded-xl border border-border bg-notes-surface p-3 text-[13px] text-foreground/85 leading-relaxed">
                    <span className="pointer-events-none absolute top-2.5 right-3 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to edit
                    </span>
                    {previewProject === "portal"
                      ? "Next.js dashboard hosted on Vercel, Supabase backend in us-east-1, and Stripe billing integration."
                      : "Real-time edge event consumer processing warehouse stock updates via Cloudflare Queues and Redis."}
                  </div>
                </div>

                {/* Services Section */}
                <div className="pt-6 space-y-3.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">Services</span>
                      <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        2
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Accounts and tools this project depends on
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {previewProject === "portal" ? (
                      <>
                        {/* Supabase Card */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,opacity,border-color] duration-150">
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                            <div className="flex items-center gap-2">
                              <BrandBadge name="Supabase" />
                              <span className="text-[14px] font-semibold text-foreground">
                                Supabase
                              </span>
                            </div>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                          <p className="text-[13px] text-foreground/85 leading-relaxed">
                            Pro tier (no auto-pause) in{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("us-east-1")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              us-east-1 <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            . Owner:{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("infra-acme@byzo.cc")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              infra-acme@byzo.cc{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </p>
                        </div>

                        {/* Vercel Card */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,opacity,border-color] duration-150">
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                            <div className="flex items-center gap-2">
                              <BrandBadge name="Vercel" />
                              <span className="text-[14px] font-semibold text-foreground">
                                Vercel
                              </span>
                            </div>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                          <p className="text-[13px] text-foreground/85 leading-relaxed">
                            Team Pro deployments on{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("portal.acmeglobal.com")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              portal.acmeglobal.com{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            . Admin:{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("lead-dev@byzo.cc")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              lead-dev@byzo.cc{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Cloudflare Card */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,opacity,border-color] duration-150">
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                            <div className="flex items-center gap-2">
                              <BrandBadge name="Cloudflare" />
                              <span className="text-[14px] font-semibold text-foreground">
                                Cloudflare
                              </span>
                            </div>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                          <p className="text-[13px] text-foreground/85 leading-relaxed">
                            Worker{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("order-sync-pipeline")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              order-sync-pipeline{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            . Zone owner:{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("acme-network@byzo.cc")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              acme-network@byzo.cc{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </p>
                        </div>

                        {/* Redis Card */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none hover:border-primary/40 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-[transform,opacity,border-color] duration-150">
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                            <div className="flex items-center gap-2">
                              <BrandBadge name="Redis" />
                              <span className="text-[14px] font-semibold text-foreground">
                                Redis
                              </span>
                            </div>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                          <p className="text-[13px] text-foreground/85 leading-relaxed">
                            Upstash host{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("us1-acme-sync.upstash.io")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              us1-acme-sync.upstash.io{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            . Owner:{" "}
                            <button
                              type="button"
                              onClick={() => copyChip("systems@byzo.cc")}
                              className="inline-flex items-center gap-1 rounded-md border border-chip-border bg-chip-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-primary/40 cursor-pointer"
                            >
                              systems@byzo.cc{" "}
                              <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlurFade>
      </section>

      {/* Bento Grid: 4 Core Highlights */}
      <section className="py-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Crafted for engineers who value precision.
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Everything you need to eliminate cloud infrastructure confusion, built without excess
            complexity.
          </p>
        </div>

        <BentoGrid className="grid-cols-1 md:grid-cols-3 gap-4">
          <BentoCard
            name="Living Brand Badges"
            className="md:col-span-2"
            background={
              <div className="absolute inset-0 p-5 pb-0 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { name: "Supabase", tag: "Database" },
                    { name: "Vercel", tag: "Hosting" },
                    { name: "Cloudflare", tag: "Edge & DNS" },
                    { name: "Stripe", tag: "Payments" },
                    { name: "AWS", tag: "Cloud" },
                    { name: "Neon", tag: "Postgres" },
                    { name: "Redis", tag: "Cache" },
                    { name: "Resend", tag: "Email" },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-2.5 py-2 transition-transform duration-300 group-hover:-translate-y-0.5"
                    >
                      <BrandBadge name={item.name} />
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-foreground truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {item.tag}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
            Icon={Server}
            description="Fuzzy matching detects brands like Supabase, Vercel, Cloudflare, AWS, and Stripe, rendering crisp monochrome SVG brand iconography."
            href="/app"
            cta="Explore badges"
          />

          <BentoCard
            name="Smart Copy Pills"
            className="md:col-span-1"
            background={
              <div className="absolute inset-0 p-5 pb-0 [mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)]">
                <div className="rounded-lg border border-border/80 bg-background/80 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>PARSED TOKENS</span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Copied
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["ops@acme.io", "us-east-1", "prj_8f92a1c", "api.acme.io"].map((pill) => (
                      <span
                        key={pill}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/80 px-2 py-0.5 font-mono text-[10px] text-foreground"
                      >
                        {pill}
                        <Copy className="w-2.5 h-2.5 text-muted-foreground" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            }
            Icon={Copy}
            description="Parsed markdown descriptions auto-tokenize email addresses, credentials, and URLs into one-click copy chips."
            href="/app"
            cta="Test chips"
          />

          <BentoCard
            name="2-Pane Sidebar Tree"
            className="md:col-span-1"
            background={
              <div className="absolute inset-0 p-5 pb-0 [mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)]">
                <div className="grid grid-cols-12 gap-2 h-32 rounded-lg border border-border bg-background/80 p-2">
                  <div className="col-span-5 space-y-1.5 border-r border-border pr-2">
                    <div className="h-3.5 w-full rounded bg-accent border-l-2 border-primary" />
                    <div className="ml-2 pl-1.5 border-l border-border space-y-1">
                      <div className="h-3 w-full rounded bg-accent/80" />
                      <div className="h-3 w-4/5 rounded bg-secondary/70" />
                    </div>
                    <div className="h-3 w-4/5 rounded bg-secondary/50" />
                  </div>
                  <div className="col-span-7 space-y-1.5">
                    <div className="flex items-center justify-between pb-1 border-b border-border/70">
                      <div className="h-2.5 w-14 rounded bg-muted-foreground/30" />
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                        Saved
                      </span>
                    </div>
                    <div className="h-6 w-full rounded bg-notes-surface border border-border" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="h-9 rounded border border-border bg-card" />
                      <div className="h-9 rounded border border-border bg-card" />
                    </div>
                  </div>
                </div>
              </div>
            }
            Icon={FolderKanban}
            description="Expandable client-to-project tree on the left, calm click-to-edit page on the right with 600ms autosave."
            href="/app"
            cta="View workstation"
          />

          <BentoCard
            name="Single-User Password Vault"
            className="md:col-span-2"
            background={
              <div className="absolute inset-0 p-5 pb-0 [mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)]">
                <div className="rounded-lg border border-border/80 bg-background/80 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        POST
                      </span>
                      <span className="text-foreground">/api/login</span>
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                      200 OK · Set-Cookie
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 font-mono text-[10px]">
                    {[
                      "HttpOnly",
                      "Secure",
                      "SameSite=Lax",
                      "JWT · 30d expiry",
                      "D1 SQLite",
                      "JSON Export / Import",
                    ].map((flag) => (
                      <span
                        key={flag}
                        className="rounded-md border border-border bg-secondary/70 px-2 py-1 text-foreground"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            }
            Icon={ShieldCheck}
            description="Secure single-password gate backed by signed HttpOnly SameSite cookies. Deploy cleanly without multi-tenant overhead."
            href="/app"
            cta="Launch dashboard"
          />
        </BentoGrid>
      </section>

      {/* Self-Host in 5 Minutes Section */}
      <section className="py-16 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary border border-border">
            <Terminal className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Self-host on Cloudflare Workers in 5 minutes
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Runs completely on the Cloudflare free tier. One Worker serves both the static Next.js
            export and the D1 SQLite database API.
          </p>

          <div className="mt-4 max-w-2xl mx-auto flex items-center justify-between p-3 rounded-xl bg-secondary/70 dark:bg-black/70 border border-border font-mono text-xs overflow-x-auto">
            <code className="text-foreground truncate pr-3 text-left">
              git clone https://github.com/adnansamirswe/devnote.git && cd devnote && npm install && npm run
              deploy
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyDeployCommand}
              className="h-7 px-2.5 text-xs gap-1 shrink-0"
            >
              {copiedCmd ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedCmd ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 text-center text-xs text-muted-foreground font-mono space-y-2">
        <p>
          Open-source showcase project by{" "}
          <a
            href="https://byzo.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline font-semibold inline-flex items-center gap-0.5"
          >
            Byzo <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        </p>
        <p>Licensed under MIT • Free to fork, customize, and self-host</p>
      </footer>
    </div>
  );
}
