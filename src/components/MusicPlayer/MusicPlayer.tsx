"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Upload,
  RotateCcw,
  X,
  Music,
  Disc3,
  AlertCircle,
  RefreshCw,
  FileAudio,
} from "lucide-react";

const DEFAULT_TRACK_PATH = "/audio/default-ambient.wav";
const DEFAULT_TRACK_TITLE = "Ambient Horizon";
const DEFAULT_TRACK_GENRE = "Ambient Instrumental (Royalty-Free)";
const DEFAULT_VOLUME = 0.3;

const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".weba",
];

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"default" | "custom">("default");
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const customUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize single HTMLAudioElement instance on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.loop = true;
    audio.preload = "metadata";
    audio.volume = DEFAULT_VOLUME;
    audio.src = DEFAULT_TRACK_PATH;
    audioRef.current = audio;

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Unable to load or decode audio track. Please check file format.");
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
      if (customUrlRef.current) {
        URL.revokeObjectURL(customUrlRef.current);
        customUrlRef.current = null;
      }
    };
  }, []);

  // Update volume on audio instance
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Close panel on outside click
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isPanelOpen]);

  // Close panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        setIsPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  // Switch audio source safely on the single audio instance
  const switchSource = useCallback(
    async (newSrc: string, shouldPlay: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;

      setError(null);
      setIsLoading(true);

      const wasPlaying = !audio.paused || shouldPlay;

      audio.pause();
      audio.src = newSrc;
      audio.load();

      if (wasPlaying) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn("[MusicPlayer] Playback error:", err);
          setIsPlaying(false);
          if (err instanceof DOMException && err.name === "NotAllowedError") {
            setError(
              "Browser blocked playback. Click Play to start listening."
            );
          } else {
            setError("Could not play track. Please check file format.");
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    []
  );

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setError(null);
      setIsLoading(true);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("[MusicPlayer] Play failed:", err);
        setIsPlaying(false);
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError(
            "Browser blocked autoplay. Please click Play to interact with audio."
          );
        } else {
          setError("Failed to play track. Please check audio source.");
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [isPlaying]);

  // Handle switching to Default Music mode
  const handleSelectDefaultMode = useCallback(() => {
    if (mode === "default") return;
    setMode("default");
    setError(null);
    switchSource(DEFAULT_TRACK_PATH, isPlaying);
  }, [mode, isPlaying, switchSource]);

  // Handle switching to Custom Music mode
  const handleSelectCustomMode = useCallback(() => {
    if (mode === "custom") return;
    setMode("custom");
    setError(null);

    if (customFileUrl) {
      switchSource(customFileUrl, isPlaying);
    } else {
      // Prompt user to pick an audio file
      fileInputRef.current?.click();
    }
  }, [mode, customFileUrl, isPlaying, switchSource]);

  // Handle user picking a custom audio file
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      // Validate audio file
      const fileNameLower = file.name.toLowerCase();
      const isAudioType = file.type.startsWith("audio/");
      const hasSupportedExtension = SUPPORTED_AUDIO_EXTENSIONS.some((ext) =>
        fileNameLower.endsWith(ext)
      );

      if (!isAudioType && !hasSupportedExtension) {
        setError(
          "Unsupported audio file format. Please choose an MP3, WAV, OGG, or AAC file."
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Revoke previous object URL to avoid memory leaks
      if (customUrlRef.current) {
        URL.revokeObjectURL(customUrlRef.current);
        customUrlRef.current = null;
      }

      // Create new safe browser object URL
      const newUrl = URL.createObjectURL(file);
      customUrlRef.current = newUrl;
      setCustomFileUrl(newUrl);
      setCustomFileName(file.name);
      setMode("custom");

      // Switch audio source immediately and continue or start playback
      switchSource(newUrl, isPlaying);

      // Reset file input value so user can re-pick the same file if desired
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [isPlaying, switchSource]
  );

  // Volume slider change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
    }
  };

  // Mute toggle
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Button title and aria labels
  const currentTitle =
    mode === "default"
      ? DEFAULT_TRACK_TITLE
      : customFileName || "Custom Audio";

  return (
    <div className="relative flex items-center" ref={containerRef}>
      {/* Hidden Custom Audio File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba"
        className="hidden"
        aria-hidden="true"
      />

      {/* Main Navbar Music Button (Reused Design System) */}
      <button
        type="button"
        onClick={() => setIsPanelOpen((prev) => !prev)}
        aria-expanded={isPanelOpen}
        aria-haspopup="dialog"
        aria-label={
          isPlaying
            ? `Audio playing: ${currentTitle}. Click to open music panel.`
            : "Audio paused. Click to open music panel."
        }
        title={
          isPlaying
            ? `Playing: ${currentTitle} (Click for music controls)`
            : "Ambient Music (Click for music controls)"
        }
        className={`group flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 select-none ${
          isPlaying
            ? "bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.3)] text-cyan-300"
            : isPanelOpen
            ? "bg-white/10 border-cyan-400/50 text-white"
            : "bg-black/40 border-white/15 hover:border-white/30 text-gray-300 hover:text-white shadow-sm"
        }`}
      >
        {/* Quick Play/Pause trigger inside the pill */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              togglePlay();
            }
          }}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          title={isPlaying ? "Pause audio" : "Play audio"}
          className="p-1 rounded-full bg-white/10 group-hover:scale-110 transition-transform flex items-center justify-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-300"
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 fill-current ml-0.5" />
          )}
        </span>

        {/* Animated Equalizer Sound Wave Bars */}
        <div className="flex items-end gap-1 h-4 w-5 sm:w-6" aria-hidden="true">
          <span
            className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
              isPlaying
                ? "animate-[soundWave_0.8s_ease-in-out_infinite_alternate]"
                : "h-1.5 opacity-40"
            }`}
            style={{ height: isPlaying ? undefined : "4px" }}
          />
          <span
            className={`w-1 rounded-full bg-cyan-300 transition-all duration-300 ${
              isPlaying
                ? "animate-[soundWave_1.2s_ease-in-out_infinite_alternate_0.2s]"
                : "h-2.5 opacity-40"
            }`}
            style={{ height: isPlaying ? undefined : "8px" }}
          />
          <span
            className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
              isPlaying
                ? "animate-[soundWave_0.9s_ease-in-out_infinite_alternate_0.4s]"
                : "h-1 opacity-40"
            }`}
            style={{ height: isPlaying ? undefined : "3px" }}
          />
          <span
            className={`w-1 rounded-full bg-cyan-300 transition-all duration-300 ${
              isPlaying
                ? "animate-[soundWave_1.1s_ease-in-out_infinite_alternate_0.1s]"
                : "h-2 opacity-40"
            }`}
            style={{ height: isPlaying ? undefined : "6px" }}
          />
        </div>

        <span className="hidden sm:inline-block text-xs font-mono font-medium tracking-wide">
          {isPlaying ? "Audio ON" : "Ambient"}
        </span>
      </button>

      {/* Accessible Responsive Music Popover Panel */}
      {isPanelOpen && (
        <div
          role="dialog"
          aria-label="Portfolio Music Controls"
          data-lenis-prevent
          data-lenis-prevent-touch
          className="fixed top-16 right-3 left-3 sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-2.5 sm:w-88 max-w-[calc(100vw-24px)] bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 shadow-2xl z-50 text-white space-y-3.5 max-h-[82vh] overflow-y-auto custom-scrollbar settings-scrollbar overscroll-contain animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10 select-none">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide">
                  Background Music
                </h3>
                <p className="text-[10px] text-gray-400 font-mono">
                  Ambient audio player
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close music panel"
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Selection Tabs (Default vs Custom) */}
          <div className="flex bg-[#0b0f19] p-1 rounded-xl text-xs font-mono border border-white/10 select-none">
            <button
              type="button"
              onClick={handleSelectDefaultMode}
              className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer font-medium flex items-center justify-center gap-1.5 ${
                mode === "default"
                  ? "bg-cyan-500 text-black font-bold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" />
              <span>Default Music</span>
            </button>

            <button
              type="button"
              onClick={handleSelectCustomMode}
              className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer font-medium flex items-center justify-center gap-1.5 ${
                mode === "custom"
                  ? "bg-cyan-500 text-black font-bold shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Custom Music</span>
            </button>
          </div>

          {/* Current Track Card */}
          <div className="bg-[#17212b] border border-white/10 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-mono font-semibold">
                  {mode === "default" ? "Built-in Soundtrack" : "Your Audio Track"}
                </p>
                <h4 className="text-xs font-bold text-white truncate" title={currentTitle}>
                  {currentTitle}
                </h4>
                <p className="text-[10px] text-gray-400 font-mono truncate">
                  {mode === "default" ? DEFAULT_TRACK_GENRE : "Device Audio File"}
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {isLoading ? (
                  <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Loading
                  </span>
                ) : isPlaying ? (
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Playing
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                    Paused
                  </span>
                )}
              </div>
            </div>

            {/* Prominent Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-xl text-xs font-bold font-mono transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                isPlaying
                  ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20"
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading Audio...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Playback</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play Soundtrack</span>
                </>
              )}
            </button>
          </div>

          {/* Custom Mode Controls & File Picker */}
          {mode === "custom" && (
            <div className="bg-[#17212b] border border-cyan-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-200">
                  Custom File Source
                </span>
                {customFileName && (
                  <button
                    type="button"
                    onClick={handleSelectDefaultMode}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>

              {customFileName ? (
                <div className="flex items-center justify-between gap-2 bg-[#0e1621] p-2 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-[11px] text-gray-300 font-mono truncate" title={customFileName}>
                      {customFileName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-mono cursor-pointer shrink-0 transition-colors"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/20 hover:border-cyan-400/60 bg-[#0e1621] text-gray-300 hover:text-white transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 text-center"
                >
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold">Choose Audio from Device</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Supports MP3, WAV, OGG, M4A, AAC
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Volume Control */}
          <div className="bg-[#17212b] border border-white/10 rounded-xl p-3 space-y-2 select-none">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                  className="text-gray-400 hover:text-cyan-400 cursor-pointer transition-colors p-0.5 rounded"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                  )}
                </button>
                <span className="font-mono text-[11px]">
                  {isMuted ? "Muted" : "Volume"}
                </span>
              </span>

              <span className="text-[11px] font-mono text-cyan-400 font-bold">
                {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Adjust audio volume"
                className="w-full h-1.5 bg-[#0e1621] rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Helper Footnote */}
          <p className="text-[10px] text-gray-400 text-center font-mono leading-tight pt-1 border-t border-white/5 select-none">
            Soundtrack plays continuously while browsing the portfolio.
          </p>
        </div>
      )}
    </div>
  );
}

