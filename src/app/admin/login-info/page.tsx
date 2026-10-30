"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Lock,
  Search,
  RefreshCw,
  LogOut,
  Inbox,
  Terminal,
  ArrowLeft,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";
import type { AuthSessionHistoryRecord } from "@/lib/live-chat/types";

interface SessionSummary {
  totalActive: number;
  adminActive: number;
  visitorActive: number;
  totalSuperseded: number;
}

export default function AdminLoginInfoPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sessions and Summary State
  const [sessions, setSessions] = useState<AuthSessionHistoryRecord[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({
    totalActive: 0,
    adminActive: 0,
    visitorActive: 0,
    totalSuperseded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccountType, setFilterAccountType] = useState<"all" | "admin" | "visitor">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "superseded" | "logged_out" | "expired">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Verify authentication on mount
  useEffect(() => {
    let active = true;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/admin/auth/check");
        const data = await res.json();
        if (active) {
          setIsAuthenticated(Boolean(data.authenticated));
          if (!data.authenticated && (data.code === "SESSION_SUPERSEDED" || data.error?.includes("another device"))) {
            setLoginError("Your account was signed in on another device. Please log in again.");
          }
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

  // Fetch session history & telemetry
  const fetchSessionData = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: "15",
      });
      if (filterAccountType !== "all") params.set("accountType", filterAccountType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/admin/login-info?${params.toString()}`);
      if (res.status === 401) {
        const errJson = await res.json().catch(() => ({}));
        setIsAuthenticated(false);
        if (errJson.code === "SESSION_SUPERSEDED" || errJson.error?.includes("another device")) {
          setLoginError("Your account was signed in on another device. Please log in again.");
        }
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
        if (data.summary) setSummary(data.summary);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || 0);
        }
      } else {
        throw new Error(data.error || "Failed to load telemetry.");
      }
    } catch (err: unknown) {
      console.error("Failed to fetch session history:", err);
      setError((err as Error).message || "Failed to load session history.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentPage, filterAccountType, filterStatus, searchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessionData(true);
    }
  }, [isAuthenticated, fetchSessionData]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
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
        fetchSessionData(true);
      } else {
        setLoginError(data.error || "Incorrect admin password.");
      }
    } catch {
      setLoginError("Network error. Please try again.");
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

  // Format Duration Helper
  const formatDuration = (loginAt: string, logoutAt?: string | null, status?: string) => {
    const start = new Date(loginAt).getTime();
    const end = logoutAt ? new Date(logoutAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let durationStr = "";
    if (days > 0) durationStr = `${days}d ${hours % 24}h`;
    else if (hours > 0) durationStr = `${hours}h ${minutes % 60}m`;
    else if (minutes > 0) durationStr = `${minutes}m ${seconds % 60}s`;
    else durationStr = `${seconds}s`;

    if (status === "active") return `Active for ${durationStr}`;
    return `Lasted ${durationStr}`;
  };

  // Format Date Helper
  const formatDate = (isoStr: string) => {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Device Icon Helper
  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "tablet":
        return <Tablet className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>ACTIVE</span>
          </span>
        );
      case "superseded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>SUPERSEDED</span>
          </span>
        );
      case "logged_out":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-gray-500/15 text-gray-400 border border-gray-500/30">
            <XCircle className="w-3 h-3" />
            <span>LOGGED OUT</span>
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <Clock className="w-3 h-3" />
            <span>EXPIRED</span>
          </span>
        );
      default:
        return <span className="text-gray-400 text-xs font-mono">{status}</span>;
    }
  };

  // Loading Screen while auth state is resolving
  if (isAuthenticated === null) {
    return (
      <main className="h-dvh max-h-dvh w-full bg-[#07090e] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Unauthenticated Login Card
  if (!isAuthenticated) {
    return (
      <main className="h-dvh max-h-dvh w-full bg-[#07090e] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0c1017] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Session Registry</h1>
            <p className="text-xs text-gray-400 mt-1">
              Authenticate to view account login history, active session status, and telemetry.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-mono text-gray-400 block mb-1.5">
                Admin Access Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-[#121824] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400 transition-colors"
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-red-400 text-xs flex items-center gap-1.5 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
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
                <span>Access Telemetry Portal</span>
              )}
            </button>
          </form>

          <div className="pt-2">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-mono"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Portfolio</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="h-dvh max-h-dvh w-full overflow-hidden flex flex-col bg-[#07090e] text-white font-sans select-none">
      {/* Top Header Shell */}
      <header className="shrink-0 z-20 bg-[#07090e]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 md:px-10 py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Login Information & Active Sessions</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                SINGLE ACTIVE SESSION
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
              Centralized audit trail of authenticated accounts, active devices, superseded logins, and telemetry.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link
            href="/admin/inbox"
            className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Inbox className="w-4 h-4 text-cyan-400" />
            <span>Live Inbox</span>
          </Link>
          <Link
            href="/admin/commands"
            className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Commands</span>
          </Link>
          <Link
            href="/"
            className="px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Portfolio</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 sm:p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Internal Scroll Area */}
      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">

        {/* KPI Stat Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1017] border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
              <span>Active Sessions</span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
              {summary.totalActive}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">Currently authenticated</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1017] border border-cyan-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
              <span>Admin Sessions</span>
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
              {summary.adminActive}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">Single active admin lock</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1017] border border-blue-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
              <span>Visitor Accounts</span>
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 font-mono">
              {summary.visitorActive}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">Active verified visitors</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1017] border border-amber-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
              <span>Superseded Logins</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
              {summary.totalSuperseded}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">Multi-device invalidations</span>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="bg-[#0c1017] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by account email, IP, city, or browser..."
                className="w-full bg-[#121824] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-gray-500 outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            {/* Account Type Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs text-gray-400 font-mono mr-1 hidden sm:inline">Type:</span>
              {(["all", "admin", "visitor"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setFilterAccountType(type);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-colors cursor-pointer shrink-0 ${
                    filterAccountType === type
                      ? "bg-cyan-500 text-black font-bold"
                      : "bg-white/5 hover:bg-white/10 text-gray-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs text-gray-400 font-mono mr-1 hidden sm:inline">Status:</span>
              {(["all", "active", "superseded", "logged_out"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setFilterStatus(st);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-colors cursor-pointer shrink-0 ${
                    filterStatus === st
                      ? "bg-cyan-500 text-black font-bold"
                      : "bg-white/5 hover:bg-white/10 text-gray-300"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}

              <button
                type="button"
                onClick={() => fetchSessionData(true)}
                disabled={loading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Refresh sessions"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Sessions Content: Mobile Card View (<768px) and Desktop Table (≥768px) */}
        <section className="bg-[#0c1017] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          {loading && sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading session telemetry records...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400 text-xs font-mono space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-red-400" />
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fetchSessionData(true)}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <Shield className="w-8 h-8 text-gray-600 mx-auto" />
              <p className="text-sm font-bold text-gray-300">No session records match your filters.</p>
              <p className="text-xs text-gray-500">Try modifying your search or resetting filter parameters.</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-gray-400 font-mono text-[11px] uppercase">
                      <th className="py-3 px-4">Account & Type</th>
                      <th className="py-3 px-4">Session Status</th>
                      <th className="py-3 px-4">Login Time & Duration</th>
                      <th className="py-3 px-4">Device & Browser</th>
                      <th className="py-3 px-4">Approximate Location</th>
                      <th className="py-3 px-4">Invalidation Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Account & Type */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                s.accountType === "admin"
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              }`}
                            >
                              {s.accountType === "admin" ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate max-w-[180px] lg:max-w-xs">{s.accountId}</p>
                              <span className="text-[10px] font-mono uppercase text-gray-400">
                                {s.accountType}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">{renderStatusBadge(s.status)}</td>

                        {/* Login Time & Duration */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <p className="text-white">{formatDate(s.loginAt)}</p>
                          <span className="text-gray-400">
                            {formatDuration(s.loginAt, s.logoutAt, s.status)}
                          </span>
                        </td>

                        {/* Device & Browser */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(s.deviceType)}
                            <div className="min-w-0">
                              <p className="text-white font-mono text-[11px] truncate">
                                {s.browser || "Unknown"} {s.browserVersion ? `v${s.browserVersion}` : ""}
                              </p>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {s.os || "OS"} ({s.deviceType || "desktop"})
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Approximate Location */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-gray-300 text-[11px]">
                              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="font-mono">
                                {s.city || s.region || s.country
                                  ? [s.city, s.region, s.country].filter(Boolean).join(", ")
                                  : "Unavailable (No Geo Headers)"}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono block">
                              IP: {s.ipAddress || "Unavailable"} (Approximate)
                            </span>
                          </div>
                        </td>

                        {/* Invalidation Reason */}
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {s.invalidationReason ? (
                            <span className="text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {s.invalidationReason.replace(/_/g, " ")}
                            </span>
                          ) : s.status === "active" ? (
                            <span className="text-emerald-400 text-[10px]">Active Session</span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD VIEW (< md) */}
              <div className="md:hidden divide-y divide-white/10">
                {sessions.map((s) => (
                  <div key={s.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            s.accountType === "admin"
                              ? "bg-cyan-500/20 text-cyan-300"
                              : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {s.accountType === "admin" ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate max-w-[200px]">{s.accountId}</p>
                          <span className="text-[10px] font-mono text-gray-400 uppercase">{s.accountType}</span>
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(s.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-gray-500 block text-[10px]">LOGIN TIME</span>
                        <span className="text-white">{formatDate(s.loginAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px]">DURATION</span>
                        <span className="text-gray-300">{formatDuration(s.loginAt, s.logoutAt, s.status)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-300">
                        {getDeviceIcon(s.deviceType)}
                        <span className="font-mono text-[11px]">
                          {s.browser || "Unknown"} on {s.os || "Device"} ({s.deviceType || "desktop"})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono">
                          {s.city || s.region || s.country
                            ? [s.city, s.country].filter(Boolean).join(", ")
                            : "Approximate: Unavailable"}
                        </span>
                      </div>
                      {s.invalidationReason && (
                        <div className="text-[10px] font-mono text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 mt-1">
                          Reason: {s.invalidationReason.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Footer */}
              <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-gray-400">
                <div>
                  Showing {(currentPage - 1) * 15 + 1} to {Math.min(currentPage * 15, totalCount)} of {totalCount} records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || loading}
                    className="p-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <span className="px-2 text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || loading}
                    className="p-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        </div>
      </main>
    </div>
  );
}

