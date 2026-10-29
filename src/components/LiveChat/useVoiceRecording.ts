"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// Web Speech API interfaces
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface IWindowSpeech extends Window {
  SpeechRecognition?: {
    new (): ISpeechRecognition;
  };
  webkitSpeechRecognition?: {
    new (): ISpeechRecognition;
  };
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export function useVoiceRecording({
  onTranscript,
  onAudioReady,
}: {
  onTranscript?: (transcript: string) => void;
  onAudioReady?: (file: File) => void;
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef<string>("");

  // Clean up all tracks on unmount or cancel
  const stopAllTracks = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      audioStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAllTracks();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [stopAllTracks]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setRecordingDuration(0);
    fullTranscriptRef.current = "";
    audioChunksRef.current = [];

    // Check device / browser media support
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setErrorMessage("Voice recording is not supported in this browser.");
      return;
    }

    try {
      // 1. Explicitly request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      // 2. Setup MediaRecorder
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mimeType = "audio/ogg;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }

        try {
          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          recorder.onstop = () => {
            if (audioChunksRef.current.length > 0 && onAudioReady) {
              const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
              const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
              const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, {
                type: mimeType,
              });
              onAudioReady(audioFile);
            }
            stopAllTracks();
          };

          recorder.start(250);
        } catch {
          // If MediaRecorder fails, continue with SpeechRecognition if available
        }
      }

      // 3. Setup Web Speech Recognition if available
      const win = window as unknown as IWindowSpeech;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let current = "";
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            if (current.trim()) {
              fullTranscriptRef.current = current.trim();
              if (onTranscript) {
                onTranscript(current.trim());
              }
            }
          };

          recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
              console.warn("[SpeechRecognition] error:", e.error);
            }
          };

          recognition.onend = () => {
            // Keep running until user explicitly stops
            if (isRecording) {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Speech recognition optional
        }
      }

      setIsRecording(true);

      // Start duration counter
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      stopAllTracks();
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setErrorMessage("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setErrorMessage("No microphone detected on your device.");
      } else {
        setErrorMessage("Could not start microphone recording. Please try again.");
      }
    }
  }, [isRecording, onAudioReady, onTranscript, stopAllTracks]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    } else {
      stopAllTracks();
    }
  }, [isRecording, stopAllTracks]);

  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }

    stopAllTracks();
  }, [stopAllTracks]);

  return {
    isRecording,
    recordingDuration,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError: () => setErrorMessage(null),
  };
}

