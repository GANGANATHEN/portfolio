"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Terminal,
  Lock,
  Search,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  X,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Inbox,
  ArrowLeft,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import type { AdminCommand, CommandStats } from "@/lib/commands/types";

export default function AdminCommandsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Commands state
  const [commands, setCommands] = useState<AdminCommand[]>([]);
  const [stats, setStats] = useState<CommandStats>({ total: 0, visible: 0, hidden: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "visible" | "hidden" | "deleted">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Modals & Active Viewers
  const [viewingCommand, setViewingCommand] = useState<AdminCommand | null>(null);
  const [commandToDelete, setCommandToDelete] = useState<AdminCommand | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Verify authentication on mount
  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth/check");
        const data = await res.json();
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
        }
      } catch {
        if (active) setIsAuthenticated(false);
      }
    };
    verifyAuth();
    return () => {
      active = false;
    };
  }, []);

  // Fetch admin commands and stats
  const fetchAdminCommands = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/commands");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setCommands(data.commands || []);
        if (data.stats) setStats(data.stats);
      } else {
        throw new Error(data.error || "Failed to load commands");
      }
    } catch (err: any) {
      console.error("[Admin Commands] Fetch error:", err);
      setError(err.message || "Unable to fetch commands from server.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    fetchAdminCommands(true);
    const interval = setInterval(() => {
      if (active) fetchAdminCommands(false);
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, fetchAdminCommands]);

  // Handle Admin Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim() || isLoggingIn) return;

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setLoginError(data.error || "Authentication failed. Incorrect password.");
      }
    } catch {
      setLoginError("Login failed due to a network connection error.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {}
    setIsAuthenticated(false);
  };

  // Handle Copy
  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Handle Moderation Action: Hide, Restore, Delete
  const handleAction = async (id: string, action: "hide" | "restore" | "delete") => {
    setIsActionPending(true);
    try {
      const res = await fetch("/api/admin/commands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        // Optimistic state update
        setCommands((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            if (action === "hide") return { ...c, is_hidden: true };
            if (action === "restore") return { ...c, is_hidden: false };
            if (action === "delete") return { ...c, is_deleted: true };
            return c;
          })
        );

        // Update stats
        if (action === "hide") {
          setStats((prev) => ({ ...prev, visible: Math.max(0, prev.visible - 1), hidden: prev.hidden + 1 }));
          setActionSuccessMsg("Command hidden from public view.");
        } else if (action === "restore") {
          setStats((prev) => ({ ...prev, visible: prev.visible + 1, hidden: Math.max(0, prev.hidden - 1) }));
          setActionSuccessMsg("Command restored and active publicly.");
        } else if (action === "delete") {
          setStats((prev) => ({ ...prev, deleted: prev.deleted + 1 }));
          setActionSuccessMsg("Command marked as deleted.");
          setCommandToDelete(null);
        }

        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error(`Failed to execute ${action} on command ${id}:`, err);
      alert(`Action failed. Please try again.`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Keyboard navigation for viewing modal
  useEffect(() => {
    if (!viewingCommand && !commandToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewingCommand(null);
        setCommandToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingCommand, commandToDelete]);

  // Loading Screen while auth state is resolving
  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Unauthenticated Login Card
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0c1017] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Commands Portal</h1>
            <p className="text-xs text-gray-400 mt-1">
              Authenticate to manage community commands, moderation states, and submission telemetry.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-mono text-gray-400 block mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400 transition-colors font-mono"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-rose-400 text-xs flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{loginError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !passwordInput}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Access Command Dashboard</span>
              )}
            </button>
          </form>

          <div className="pt-2 flex items-center justify-between text-xs text-gray-400 font-mono">
            <Link href="/admin/inbox" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <Inbox className="w-3.5 h-3.5" />
              <span>Live Inbox</span>
            </Link>
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Portfolio</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Filter & Search Logic
  const filteredCommands = commands.filter((cmd) => {
    // Status Filter
    if (filterStatus === "visible" && (cmd.is_hidden || cmd.is_deleted)) return false;
    if (filterStatus === "hidden" && (!cmd.is_hidden || cmd.is_deleted)) return false;
    if (filterStatus === "deleted" && !cmd.is_deleted) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCmd = cmd.command.toLowerCase().includes(q);
      const matchAuthor = cmd.author_name.toLowerCase().includes(q);
      const matchTitle = (cmd.title || "").toLowerCase().includes(q);
      const matchCat = (cmd.category || "").toLowerCase().includes(q);
      const matchIp = (cmd.metadata?.ip || "").toLowerCase().includes(q);
      if (!matchCmd && !matchAuthor && !matchTitle && !matchCat && !matchIp) return false;
    }

    return true;
  });

  // Sort Logic
  const sortedCommands = [...filteredCommands].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortBy === "newest" ? timeB - timeA : timeA - timeB;
  });

  return (
    <main className="min-h-screen bg-[#07090e] text-white p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Admin Commands Console</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  PROTECTED
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Moderation, visibility control, telemetry metadata, and community commands management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <Link
              href="/admin/inbox"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Inbox className="w-4 h-4 text-cyan-400" />
              <span>Live Inbox</span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Portfolio</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-mono text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Action Notification Toast */}
        {actionSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button type="button" onClick={() => setActionSuccessMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metrics Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0c1017] border border-white/10 flex flex-col justify-between">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Total Indexed</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-2">
              {stats.total}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#0c1017] border border-emerald-500/20 flex flex-col justify-between">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Active Public
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-2">
              {stats.visible}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#0c1017] border border-amber-500/20 flex flex-col justify-between">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Hidden
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-2">
              {stats.hidden}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-[#0c1017] border border-rose-500/20 flex flex-col justify-between">
            <span className="text-xs font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Deleted
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400 mt-2">
              {stats.deleted}
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1017] border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by command, author, title, category, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Filter Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(["all", "visible", "hidden", "deleted"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono capitalize transition-all cursor-pointer shrink-0 ${
                  filterStatus === st
                    ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                    : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Selector & Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="bg-[#0e141e] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <button
              type="button"
              onClick={() => fetchAdminCommands(true)}
              title="Refresh commands list"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Commands Table / Cards List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#0c1017] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center flex flex-col items-center justify-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <h3 className="text-white font-bold text-base">Error Loading Admin Data</h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => fetchAdminCommands(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Fetch</span>
            </button>
          </div>
        ) : sortedCommands.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[#0c1017] border border-white/5 text-center flex flex-col items-center justify-center gap-3">
            <Terminal className="w-8 h-8 text-gray-500" />
            <h3 className="text-white font-bold text-base">No Matching Commands</h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">
              {searchQuery
                ? `No commands match search query "${searchQuery}".`
                : `No commands found for filter "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCommands.map((cmd) => {
              const isCopied = copiedId === cmd.id;
              const meta = cmd.metadata;

              return (
                <div
                  key={cmd.id}
                  className={`p-5 sm:p-6 rounded-2xl bg-[#0c1017] border transition-all flex flex-col gap-4 shadow-lg ${
                    cmd.is_deleted
                      ? "border-rose-500/20 opacity-70 bg-rose-950/5"
                      : cmd.is_hidden
                      ? "border-amber-500/20 bg-amber-950/5"
                      : "border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  {/* Card Header: Status, Author, Category, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Status Badge */}
                      {cmd.is_deleted ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                          DELETED
                        </span>
                      ) : cmd.is_hidden ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          HIDDEN
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          ACTIVE PUBLIC
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-400 font-mono text-[10px] uppercase font-semibold">
                        {cmd.category || "General"}
                      </span>

                      <div className="flex items-center gap-1.5 text-xs font-mono text-gray-300">
                        <span className="text-gray-500">by</span>
                        <span className="text-white font-semibold">@{cmd.author_name}</span>
                      </div>

                      {cmd.title && (
                        <span className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">
                          • {cmd.title}
                        </span>
                      )}
                    </div>

                    {/* Timestamp with timezone info */}
                    <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(cmd.created_at).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZoneName: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Terminal Code Snippet */}
                  <div className="rounded-xl bg-black/60 border border-white/5 p-3.5 relative group/code">
                    <pre className="font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-24 scrollbar-thin">
                      <code>{cmd.command}</code>
                    </pre>

                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(cmd.id, cmd.command)}
                        title="Copy command"
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingCommand(cmd)}
                        title="View full detail"
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Submission Telemetry Metadata (Admin Only) */}
                  <div className="p-3 rounded-xl bg-white/3 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-gray-400">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Device Type */}
                      <div className="flex items-center gap-1.5" title="Detected device category">
                        {meta?.deviceType === "mobile" ? (
                          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        ) : meta?.deviceType === "tablet" ? (
                          <Tablet className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span className="capitalize">{meta?.deviceType || "Not available"}</span>
                      </div>

                      {/* OS & Browser */}
                      <div className="flex items-center gap-1.5" title="Operating System & Browser family">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {meta?.osFamily && meta.osFamily !== "Unknown" ? meta.osFamily : "OS Not available"} •{" "}
                          {meta?.browserFamily && meta.browserFamily !== "Other" ? meta.browserFamily : "Browser Not available"}
                        </span>
                      </div>

                      {/* Moderation IP */}
                      <div className="flex items-center gap-1.5 text-gray-500" title="Client IP address for moderation">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        <span>IP: {meta?.ip || "Not available"}</span>
                      </div>
                    </div>

                    {/* Moderation Action Buttons */}
                    <div className="flex items-center gap-2">
                      {cmd.is_hidden ? (
                        <button
                          type="button"
                          disabled={isActionPending}
                          onClick={() => handleAction(cmd.id, "restore")}
                          className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore (Unhide)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isActionPending}
                          onClick={() => handleAction(cmd.id, "hide")}
                          className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>Hide</span>
                        </button>
                      )}

                      {!cmd.is_deleted && (
                        <button
                          type="button"
                          disabled={isActionPending}
                          onClick={() => setCommandToDelete(cmd)}
                          className="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin View Full Command Detail Modal */}
      {viewingCommand && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setViewingCommand(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#0c1017] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-white relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-[#090d14] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {viewingCommand.title || "Command Detail"}
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">
                    ID: {viewingCommand.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCommand(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
              {/* Telemetry Grid */}
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-gray-500 block">Author</span>
                  <span className="text-white font-semibold">@{viewingCommand.author_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Category</span>
                  <span className="text-cyan-400">{viewingCommand.category || "General"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Device</span>
                  <span className="text-white capitalize">{viewingCommand.metadata?.deviceType || "Not available"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">IP Address</span>
                  <span className="text-amber-400">{viewingCommand.metadata?.ip || "Not available"}</span>
                </div>
              </div>

              {/* Original Full Command */}
              <div className="rounded-2xl bg-black/80 border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3 text-xs font-mono text-gray-500 border-b border-white/5 pb-2">
                  <span>Full Command Source</span>
                  <span>{viewingCommand.command.length} characters</span>
                </div>
                <pre className="font-mono text-xs sm:text-sm text-cyan-300 whitespace-pre overflow-x-auto leading-relaxed select-all">
                  <code>{viewingCommand.command}</code>
                </pre>
              </div>

              {/* Raw User-Agent */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs font-mono text-gray-400">
                <span className="text-gray-500 block mb-1">User Agent Header:</span>
                <span className="break-all">{viewingCommand.metadata?.userAgent || "Not available"}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#090d14] border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewingCommand(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleCopy(viewingCommand.id, viewingCommand.command)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Command</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {commandToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setCommandToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-[#0c1017] border border-rose-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 text-white relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400 block font-bold">
                  Destructive Action
                </span>
                <h3 className="text-lg font-bold text-white">Delete Command?</h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Are you sure you want to delete this command by{" "}
              <strong className="text-white">@{commandToDelete.author_name}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-gray-400 truncate">
              {commandToDelete.command}
            </div>

            <p className="text-[11px] text-gray-500 font-mono">
              The command will be immediately removed from the public website and marked as deleted in the admin system.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10 mt-1">
              <button
                type="button"
                onClick={() => setCommandToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionPending}
                onClick={() => handleAction(commandToDelete.id, "delete")}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

