"use client";
import React, { useEffect, useState, useCallback, useId } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileArchive,
  FileSpreadsheet,
  Film,
  Music,
  ExternalLink,
  Layers,
} from "lucide-react";

export interface ViewerAttachment {
  id: string;
  conversationId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt?: string;
}

interface AttachmentViewerModalProps {
  attachment: ViewerAttachment | null;
  allAttachments?: ViewerAttachment[];
  onClose: () => void;
  onNavigate?: (attachment: ViewerAttachment) => void;
}

export default function AttachmentViewerModal({
  attachment,
  allAttachments = [],
  onClose,
  onNavigate,
}: AttachmentViewerModalProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const titleId = useId();

  // Find index in active list
  const activeList = allAttachments.length > 0 ? allAttachments : attachment ? [attachment] : [];
  const currentIndex = activeList.findIndex((a) => a.id === attachment?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activeList.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(activeList[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, activeList, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(activeList[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, activeList, onNavigate]);

  // Handle keyboard events (Escape, Left, Right)
  useEffect(() => {
    if (!attachment) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attachment, onClose, goToPrev, goToNext]);

  // Lock background scroll while viewer is open
  useEffect(() => {
    if (!attachment) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [attachment]);

  // Download all files sequentially
  const handleDownloadAll = async () => {
    if (activeList.length === 0 || downloadingAll) return;
    setDownloadingAll(true);

    try {
      for (let i = 0; i < activeList.length; i++) {
        const item = activeList[i];
        const a = document.createElement("a");
        a.href = `/api/live-chat/attachments/${item.id}?download=true`;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Small interval between triggers to prevent browser popup suppression
        if (i < activeList.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  if (!attachment) return null;

  const mime = attachment.mimeType.toLowerCase();
  const isImg = mime.startsWith("image/");
  const isVid = mime.startsWith("video/");
  const isAud = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf" || attachment.fileName.toLowerCase().endsWith(".pdf");
  const isZip =
    mime.includes("zip") ||
    mime.includes("compressed") ||
    attachment.fileName.toLowerCase().endsWith(".zip");
  const isSheet =
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    attachment.fileName.endsWith(".csv");

  const streamUrl = `/api/live-chat/attachments/${attachment.id}`;
  const downloadUrl = `${streamUrl}?download=true`;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-70 bg-black/95 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <header
        className="w-full p-4 sm:px-6 flex items-center justify-between bg-black/40 border-b border-white/10 shrink-0 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <span className="p-2 rounded-xl bg-white/10 text-cyan-400 shrink-0">
            {isImg && <FileText className="w-4 h-4" />}
            {isVid && <Film className="w-4 h-4" />}
            {isAud && <Music className="w-4 h-4" />}
            {isPdf && <FileText className="w-4 h-4 text-red-400" />}
            {isZip && <FileArchive className="w-4 h-4 text-amber-400" />}
            {isSheet && <FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
            {!isImg && !isVid && !isAud && !isPdf && !isZip && !isSheet && (
              <FileText className="w-4 h-4 text-gray-400" />
            )}
          </span>
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-sm font-semibold text-white truncate max-w-[260px] sm:max-w-md md:max-w-lg font-mono"
              title={attachment.fileName}
            >
              {attachment.fileName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
              <span>{formatSize(attachment.fileSize)}</span>
              {activeList.length > 1 && (
                <>
                  <span>•</span>
                  <span className="text-cyan-300 font-bold">
                    {currentIndex + 1} of {activeList.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeList.length > 1 && (
            <button
              type="button"
              disabled={downloadingAll}
              onClick={handleDownloadAll}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer"
              title="Download all attachments in this message"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{downloadingAll ? "Saving..." : `Save All (${activeList.length})`}</span>
            </button>
          )}

          <a
            href={downloadUrl}
            download={attachment.fileName}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors cursor-pointer"
            title="Download this file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close attachment viewer"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div
        className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0"
        onClick={(e) => {
          // Clicking the surrounding empty area closes
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Previous Button */}
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label="Previous attachment"
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-cyan-500 hover:text-black border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Button */}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label="Next attachment"
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-cyan-500 hover:text-black border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Content Preview Container */}
        <div
          className="max-w-5xl max-h-[78vh] w-full flex flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Image Viewer */}
          {isImg && (
            <div className="relative max-h-[76vh] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamUrl}
                alt={attachment.fileName}
                className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
              />
            </div>
          )}

          {/* 2. Video Player */}
          {isVid && (
            <div className="w-full max-w-3xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
              <video
                controls
                autoPlay={false}
                playsInline
                preload="metadata"
                className="w-full max-h-[70vh] bg-black outline-none"
              >
                <source src={streamUrl} type={attachment.mimeType} />
                Your browser does not support HTML5 video playback.
              </video>
            </div>
          )}

          {/* 3. Audio Player */}
          {isAud && (
            <div className="w-full max-w-md p-6 rounded-2xl bg-[#17212b] border border-white/10 shadow-2xl flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Music className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-white font-mono font-bold text-sm truncate max-w-xs">
                  {attachment.fileName}
                </h4>
                <p className="text-xs text-gray-400 mt-1">{formatSize(attachment.fileSize)}</p>
              </div>
              <audio controls autoPlay={false} className="w-full mt-2">
                <source src={streamUrl} type={attachment.mimeType} />
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* 4. PDF In-Modal Responsive Viewer */}
          {isPdf && (
            <div className="w-full max-w-4xl h-[75vh] rounded-2xl overflow-hidden bg-[#17212b] border border-white/10 shadow-2xl flex flex-col">
              <iframe
                src={`${streamUrl}#toolbar=1`}
                className="w-full flex-1 border-0 bg-white"
                title={attachment.fileName}
              />
            </div>
          )}

          {/* 5. Generic Document / Archive File Card */}
          {!isImg && !isVid && !isAud && !isPdf && (
            <div className="w-full max-w-md p-8 rounded-3xl bg-[#17212b] border border-white/15 shadow-2xl flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 text-cyan-400 flex items-center justify-center border border-white/10">
                {isZip && <FileArchive className="w-10 h-10 text-amber-400" />}
                {isSheet && <FileSpreadsheet className="w-10 h-10 text-emerald-400" />}
                {!isZip && !isSheet && <FileText className="w-10 h-10 text-cyan-400" />}
              </div>
              <div>
                <h4 className="text-white font-mono font-bold text-base truncate max-w-sm">
                  {attachment.fileName}
                </h4>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {formatSize(attachment.fileSize)} • {attachment.mimeType}
                </p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                This file format cannot be previewed directly in the browser. You can save the original file to view it on your device.
              </p>
              <div className="flex gap-3 mt-2 w-full">
                <a
                  href={downloadUrl}
                  download={attachment.fileName}
                  className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <footer
        className="w-full p-3 sm:px-6 flex items-center justify-between bg-black/40 border-t border-white/10 shrink-0 z-10 text-xs text-gray-400 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">Esc</kbd> to close</span>
          {activeList.length > 1 && (
            <span className="hidden sm:inline">
              Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">←</kbd> and{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">→</kbd> to browse
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeList.length > 1 && (
            <button
              type="button"
              disabled={downloadingAll}
              onClick={handleDownloadAll}
              className="sm:hidden text-cyan-300 font-bold hover:underline"
            >
              {downloadingAll ? "Saving..." : "Save All"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  );
}

