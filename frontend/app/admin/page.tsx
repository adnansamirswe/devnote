"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ADMIN_STATS_KEY,
  ADMIN_USERS_KEY,
  useAuth,
} from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import { AdminUserRow } from "@/types";
import { LoginView } from "@/components/login-view";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  FolderKanban,
  Loader2,
  LogOut,
  Moon,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Sun,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

const DEFAULT_ADMIN_EMAIL = "adnansamir.dev@gmail.com";

export default function AdminDashboardPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading, login, signup, logout } =
    useAuth();

  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  const isAdmin = isAuthenticated && user?.role === "admin";

  const statsQuery = useQuery({
    queryKey: ADMIN_STATS_KEY,
    queryFn: () => api.getAdminStats(),
    enabled: isAdmin,
  });

  const usersQuery = useQuery({
    queryKey: [...ADMIN_USERS_KEY, search],
    queryFn: async () => {
      const res = await api.getAdminUsers(search);
      return res.users;
    },
    enabled: isAdmin,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { role?: "user" | "admin"; status?: "active" | "suspended" };
    }) => api.updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_STATS_KEY });
      toast.success("User updated");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to update user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_STATS_KEY });
      toast.success("User deleted");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete user");
    },
  });

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={login} onSignup={signup} />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center font-sans">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-7 space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">
              Admin access required
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Your account (<span className="font-mono text-foreground">{user?.email}</span>) does not have administrator permissions.
            </p>
          </div>
          <Link href="/app/" className="inline-block w-full">
            <Button className="w-full h-9 text-[13px] gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const userRows = usersQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-sidebar-border bg-sidebar">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/app/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Workspace</span>
            </Link>
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="devnote logo"
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
              <BrandWordmark className="text-[16px]" />
              <span className="text-muted-foreground">/</span>
              <span className="text-[13px] font-medium text-foreground">
                Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block font-mono text-[12px] text-muted-foreground pr-2">
              {user?.email}
            </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => void logout()}
              className="h-8 px-2.5 text-[12px] gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
        {/* Page Header */}
        <div className="pb-6 border-b border-border">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Monitor accounts, manage roles, and suspend or remove users across devnote.
          </p>
        </div>

        {/* Summary Metric Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsQuery.isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>Total users</span>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {stats?.users.total ?? 0}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {stats?.users.admins ?? 0} admin(s)
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>Active accounts</span>
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {stats?.users.active ?? 0}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {stats?.users.suspended ?? 0} suspended
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>Clients & projects</span>
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {stats?.resources.clients ?? 0}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {stats?.resources.projects ?? 0} projects tracked
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>Tracked services</span>
                  <Server className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {stats?.resources.services ?? 0}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Across all workspaces
                </div>
              </div>
            </>
          )}
        </section>

        {/* Users Table */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold text-foreground">Users</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
                {userRows.length}
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or username…"
                className="pl-9 h-9 text-[13px] bg-card border-border-strong"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            {usersQuery.isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : usersQuery.isError ? (
              <div className="p-8 text-center text-[13px] text-destructive">
                Failed to load users. Please refresh and try again.
              </div>
            ) : userRows.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-muted-foreground">
                No matching users found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-[12px] font-medium text-muted-foreground">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Usage</th>
                      <th className="py-3 px-4">Joined</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[13px]">
                    {userRows.map((row) => {
                      const isSelf = row.id === user?.id;
                      const isProtectedAdmin = row.email === DEFAULT_ADMIN_EMAIL;
                      const cannotModify = isSelf || isProtectedAdmin;

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-foreground">
                              @{row.username}
                              {isSelf && (
                                <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[12px] text-muted-foreground">
                              {row.email}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                                row.role === "admin"
                                  ? "bg-accent text-accent-foreground border border-primary/30"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {row.role === "admin" && (
                                <Shield className="h-3 w-3" />
                              )}
                              {row.role}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                                row.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {row.status === "active" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Ban className="h-3 w-3" />
                              )}
                              {row.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[12px] text-muted-foreground">
                            {row.counts.clients} clients · {row.counts.projects} projects ·{" "}
                            {row.counts.services} services
                          </td>

                          <td className="py-3.5 px-4 text-[12px] text-muted-foreground whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={cannotModify || updateUserMutation.isPending}
                                onClick={() =>
                                  updateUserMutation.mutate({
                                    id: row.id,
                                    data: {
                                      role: row.role === "admin" ? "user" : "admin",
                                    },
                                  })
                                }
                                className="h-7 px-2 text-[12px]"
                              >
                                {row.role === "admin" ? "Make user" : "Make admin"}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                disabled={cannotModify || updateUserMutation.isPending}
                                onClick={() =>
                                  updateUserMutation.mutate({
                                    id: row.id,
                                    data: {
                                      status:
                                        row.status === "active"
                                          ? "suspended"
                                          : "active",
                                    },
                                  })
                                }
                                className="h-7 px-2 text-[12px]"
                              >
                                {row.status === "active" ? "Suspend" : "Activate"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={cannotModify || deleteUserMutation.isPending}
                                onClick={() => setDeleteTarget(row)}
                                aria-label={`Delete ${row.username}`}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Delete User Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <span className="font-semibold text-foreground">
                @{deleteTarget?.username}
              </span>{" "}
              (<span className="font-mono">{deleteTarget?.email}</span>) and all of
              their clients, projects, and services? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                const targetId = deleteTarget.id;
                setDeleteTarget(null);
                await deleteUserMutation.mutateAsync(targetId);
              }}
            >
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
