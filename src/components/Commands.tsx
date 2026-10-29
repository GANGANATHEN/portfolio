"use client";
import React, { useState, useEffect, useCallback, useId } from "react";
import {
  Terminal,
  Copy,
  Check,
  Maximize2,
  X,
  Send,
  AlertTriangle,
  RefreshCw,
  Code2,
  Tag,
  Clock,
  User,
  Sparkles,
} from "lucide-react";
import type { PublicCommand } from "@/lib/commands/types";

const CATEGORIES = ["All", "Git", "Docker", "Linux", "CLI", "Web", "General"];

export default function Commands() {
  const [commands, setCommands] = useState<PublicCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Form submission state
  const [authorName, setAuthorName] = useState("");
  const [commandText, setCommandText] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Git");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Copy state per command ID
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dedicated Long-Command Modal state
  const [expandedCommand, setExpandedCommand] = useState<PublicCommand | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

  // Unique IDs for accessibility
  const authorInputId = useId();
  const commandInputId = useId();
  const titleInputId = useId();
  const categorySelectId = useId();

  // Fetch public commands from backend
  const fetchCommands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commands", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.commands)) {
        setCommands(data.commands);
      } else {
        throw new Error(data.error || "Malformed response structure");
      }
    } catch (err: any) {
      console.warn("[Commands] Failed to fetch public commands:", err);
      setError("Unable to load commands from the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  // Handle Copy Action
  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }, []);

  const handleModalCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    } catch (err) {
      console.error("Modal clipboard copy failed:", err);
    }
  }, []);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandText.trim();
    const author = authorName.trim();

    if (!cmd || !author || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmd,
          author_name: author,
          title: title.trim() || undefined,
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit command");
      }

      // Prepend newly submitted command to UI
      if (data.command) {
        setCommands((prev) => [data.command, ...prev]);
      }

      setSubmitSuccess("Command submitted successfully! It is now live in the terminal.");
      setCommandText("");
      setTitle("");
      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit command. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation & scroll locking for Modal
  useEffect(() => {
    if (!expandedCommand) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedCommand(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [expandedCommand]);

  // Filter commands by category
  const filteredCommands = commands.filter((c) => {
    if (selectedCategory === "All") return true;
    return (c.category || "General").toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <section
      id="commands"
      className="py-16 md:py-24 px-4 sm:px-6 md:px-12 lg:px-20 bg-[#07090e] border-y border-white/5 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-xs mb-3">
              <Terminal className="w-3.5 h-3.5" />
              <span>TERMINAL KNOWLEDGE BASE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
              Community <span className="text-cyan-400">Commands</span>
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-xl">
              Curated terminal one-liners, automation scripts, and workflow shortcuts shared by developers.
            </p>
          </div>

          {/* Stats Badge */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <span className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-mono text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {commands.length} {commands.length === 1 ? "COMMAND" : "COMMANDS"}
            </span>
          </div>
        </div>

        {/* Command Submission Terminal Form */}
        <div className="mb-12 rounded-2xl bg-[#0c1017] border border-white/10 overflow-hidden shadow-2xl transition-all">
          {/* Terminal Titlebar */}
          <div className="px-4 py-3 bg-[#090d14] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-gray-400 font-mono text-xs ml-2 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                submit-command.sh
              </span>
            </div>
            <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">
              POST /api/commands
            </span>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Author Handle */}
              <div>
                <label
                  htmlFor={authorInputId}
                  className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1.5"
                >
                  Author Handle <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id={authorInputId}
                    type="text"
                    required
                    maxLength={80}
                    placeholder="@yourhandle or name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              {/* Title / Summary */}
              <div>
                <label
                  htmlFor={titleInputId}
                  className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1.5"
                >
                  Purpose / Title <span className="text-gray-500 text-[10px]">(optional)</span>
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Delete merged git branches"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor={categorySelectId}
                  className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1.5"
                >
                  Category
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <select
                    id={categorySelectId}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#0e141e] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
                  >
                    <option value="Git">Git</option>
                    <option value="Docker">Docker</option>
                    <option value="Linux">Linux</option>
                    <option value="CLI">CLI</option>
                    <option value="Web">Web</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Command Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={commandInputId}
                  className="block text-xs font-mono text-gray-400 uppercase tracking-wider"
                >
                  Terminal Command <span className="text-cyan-400">*</span>
                </label>
                <span className="text-[11px] font-mono text-gray-500">
                  {commandText.length}/4000
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-white/10 focus-within:border-cyan-400 transition-colors bg-black/60">
                <div className="absolute left-3 top-3 text-cyan-500 font-mono text-xs select-none pointer-events-none">
                  $
                </div>
                <textarea
                  id={commandInputId}
                  required
                  rows={3}
                  maxLength={4000}
                  placeholder="Enter multi-line bash, zsh, docker, or git command..."
                  value={commandText}
                  onChange={(e) => setCommandText(e.target.value)}
                  className="w-full bg-transparent pl-8 pr-3 py-2.5 font-mono text-xs sm:text-sm text-cyan-300 placeholder:text-gray-600 focus:outline-none resize-y min-h-[80px]"
                />
              </div>
            </div>

            {/* Feedback Notifications */}
            {submitSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-xs text-gray-500 font-mono">
                Respectful submissions only. Commands are reviewed and indexed publicly.
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !commandText.trim() || !authorName.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>POSTING...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>POST COMMAND</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                  : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content States: Loading, Error, Empty, List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#0c1017] border border-white/5 animate-pulse flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 bg-white/10 rounded" />
                  <div className="h-4 w-16 bg-white/10 rounded-full" />
                </div>
                <div className="h-16 bg-black/40 rounded-xl" />
                <div className="h-3 w-32 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center flex flex-col items-center justify-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <h3 className="text-white font-bold text-base">Commands Unavailable</h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">{error}</p>
            <button
              type="button"
              onClick={fetchCommands}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[#0c1017] border border-white/5 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
              <Terminal className="w-7 h-7" />
            </div>
            <h3 className="text-white font-bold text-lg sm:text-xl">
              No commands have been posted yet.
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">
              Commands shared by the community will appear here. Be the first to share a workflow snippet using the submission box above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredCommands.map((cmd) => {
              const isCopied = copiedId === cmd.id;
              const isLong = cmd.command.length > 140 || cmd.command.includes("\n");

              return (
                <div
                  key={cmd.id}
                  className="group rounded-2xl bg-[#0c1017] border border-white/5 hover:border-cyan-500/30 transition-all p-5 sm:p-6 flex flex-col justify-between shadow-lg hover:shadow-cyan-500/5 relative overflow-hidden"
                >
                  <div>
                    {/* Card Top: Category & Time */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono font-semibold uppercase tracking-wider">
                          {cmd.category || "General"}
                        </span>
                        {cmd.title && (
                          <h4 className="text-white font-bold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-[240px]">
                            {cmd.title}
                          </h4>
                        )}
                      </div>
                      <span className="text-gray-500 text-[11px] font-mono flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(cmd.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Terminal Command Code Box */}
                    <div className="relative rounded-xl bg-black/60 border border-white/5 p-3.5 my-2 group-hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-1.5 text-gray-500 font-mono text-[10px]">
                        <span>bash</span>
                        <div className="flex items-center gap-1">
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => setExpandedCommand(cmd)}
                              title="Expand full command in modal"
                              aria-label="Expand full command in modal"
                              className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(cmd.id, cmd.command)}
                            title="Copy command to clipboard"
                            aria-label="Copy command to clipboard"
                            className="p-1 hover:text-cyan-300 rounded hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <pre className="font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-28 scrollbar-thin">
                        <code>{cmd.command}</code>
                      </pre>
                    </div>

                    {/* Description if present */}
                    {cmd.description && (
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                        {cmd.description}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Author & Expand */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-linear-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                        {cmd.author_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-400 text-xs font-mono">
                        @{cmd.author_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => setExpandedCommand(cmd)}
                          className="text-[11px] font-mono text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          View Full →
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(cmd.id, cmd.command)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-gray-400" />
                            <span>COPY</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Long-Command Detail Modal */}
      {expandedCommand && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-modal-title"
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setExpandedCommand(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#0c1017] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-white relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#090d14] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="command-modal-title" className="text-base font-bold text-white">
                    {expandedCommand.title || "Full Terminal Command"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                    <span>@{expandedCommand.author_name}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{expandedCommand.category || "General"}</span>
                    <span>•</span>
                    <span>{new Date(expandedCommand.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedCommand(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Complete Command without truncation */}
            <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
              {expandedCommand.description && (
                <div className="mb-4 p-3.5 rounded-xl bg-white/5 border border-white/5 text-gray-300 text-xs sm:text-sm">
                  {expandedCommand.description}
                </div>
              )}

              <div className="rounded-2xl bg-black/80 border border-white/10 p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-xs font-mono text-gray-500 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>Original Source (Preserved Indentation & Whitespace)</span>
                  </div>
                  <span>{expandedCommand.command.length} characters</span>
                </div>

                <pre className="font-mono text-xs sm:text-sm text-cyan-300 whitespace-pre overflow-x-auto leading-relaxed select-all">
                  <code>{expandedCommand.command}</code>
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#090d14] border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 font-mono hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-gray-300 text-[10px]">Esc</kbd> to close
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setExpandedCommand(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleModalCopy(expandedCommand.command)}
                  className={`px-5 py-2 rounded-xl font-bold font-mono text-xs transition-all flex items-center gap-2 cursor-pointer ${
                    modalCopied
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                      : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20"
                  }`}
                >
                  {modalCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>COPIED TO CLIPBOARD!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY ENTIRE COMMAND</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

