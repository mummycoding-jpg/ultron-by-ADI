// hooks/useUltronBrain.ts
// Client-side hook: browser mic -> Web Speech API (STT) -> /api/chat (Gemini)
// -> Web Speech Synthesis (TTS).
//
// Extra abilities:
// - Remembers conversation across visits (localStorage)
// - Captures one camera photo when you say a "look/see" phrase, and sends
//   it to Gemini for vision
// - Opens websites when Gemini calls the open_website function
// - Reports a synthetic 0-1 "speech level" via onSpeechLevel while talking,
//   driven by word-boundary events (real amplitude isn't exposed by
//   speechSynthesis), for orb particle reactions.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "model"; text: string };

export type UltronStatus =
  | "idle"
  | "listening"
  | "seeing"
  | "thinking"
  | "speaking";

const HISTORY_KEY = "ultron_chat_history";
const LOOK_TRIGGERS = [
  "look at this",
  "look at that",
  "what do you see",
  "what is this",
  "what's this",
  "can you see",
  "show you",
  "take a look",
];

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: ChatMessage[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage full or unavailable — not critical, just skip
  }
}

async function captureCameraFrame(): Promise<string | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 480, height: 360 },
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 300));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    stream.getTracks().forEach((t) => t.stop());

    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

export interface UseUltronBrainOptions {
  /** Called continuously with a synthetic 0-1 "speech level" while Ultron talks. */
  onSpeechLevel?: (level: number) => void;
}

export function useUltronBrain(options: UseUltronBrainOptions = {}) {
  const { onSpeechLevel } = options;

  const [status, setStatus] = useState<UltronStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);

  const historyRef = useRef<ChatMessage[]>([]);
  const recognitionRef = useRef<any>(null);
  const autoListenRef = useRef(autoListen);
  const manuallyStoppedRef = useRef(false);
  const onSpeechLevelRef = useRef(onSpeechLevel);
  const pulseRafRef = useRef<number | null>(null);
  const pulseTargetRef = useRef(0);
  const pulseCurrentRef = useRef(0);

  useEffect(() => {
    onSpeechLevelRef.current = onSpeechLevel;
  }, [onSpeechLevel]);

  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  useEffect(() => {
    historyRef.current = loadHistory();
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "This browser doesn't support voice input. Try Chrome or Edge."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleUserSpeech(text);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Mic error: ${event.error}`);
      }
      setStatus("idle");
    };

    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    manuallyStoppedRef.current = false;
    setError(null);
    setTranscript("");
    setStatus("listening");
    try {
      recognitionRef.current.start();
    } catch {
      // already started — ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    manuallyStoppedRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  // ——— Synthetic speech-level pulse loop ———
  // Runs while speaking; eases pulseCurrent toward pulseTarget each frame
  // and reports it via onSpeechLevel. Word-boundary events bump the
  // target up; it decays back down between words.
  const startPulseLoop = useCallback(() => {
    const tick = () => {
      pulseCurrentRef.current +=
        (pulseTargetRef.current - pulseCurrentRef.current) * 0.3;
      // gentle decay so it doesn't hang at a high plateau between words
      pulseTargetRef.current *= 0.92;
      onSpeechLevelRef.current?.(pulseCurrentRef.current);
      pulseRafRef.current = requestAnimationFrame(tick);
    };
    pulseRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPulseLoop = useCallback(() => {
    if (pulseRafRef.current !== null) {
      cancelAnimationFrame(pulseRafRef.current);
      pulseRafRef.current = null;
    }
    pulseTargetRef.current = 0;
    pulseCurrentRef.current = 0;
    onSpeechLevelRef.current?.(0);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        setError("This browser doesn't support speech output.");
        setStatus("idle");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.9;

      utterance.onstart = () => {
        setStatus("speaking");
        startPulseLoop();
      };

      // Fires roughly per word — bump the pulse target so the loop above
      // eases toward it, giving a rhythmic "talking" feel.
      utterance.onboundary = (event: any) => {
        if (event.name === "word" || event.name === undefined) {
          pulseTargetRef.current = 0.55 + Math.random() * 0.45;
        }
      };

      utterance.onend = () => {
        stopPulseLoop();
        setStatus("idle");
        if (autoListenRef.current && !manuallyStoppedRef.current) {
          setTimeout(() => startListening(), 500);
        }
      };
      utterance.onerror = () => {
        stopPulseLoop();
        setStatus("idle");
      };
      window.speechSynthesis.speak(utterance);
    },
    [startListening, startPulseLoop, stopPulseLoop]
  );

  const handleUserSpeech = useCallback(
    async (text: string) => {
      setError(null);

      const wantsVision = LOOK_TRIGGERS.some((phrase) =>
        text.toLowerCase().includes(phrase)
      );

      let image: string | undefined;
      if (wantsVision) {
        setStatus("seeing");
        const frame = await captureCameraFrame();
        if (frame) {
          image = frame;
        } else {
          setError("Couldn't access the camera for that.");
        }
      }

      setStatus("thinking");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: historyRef.current,
            image,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Request failed");

        const userMsg: ChatMessage = { role: "user", text };
        const modelMsg: ChatMessage = { role: "model", text: data.reply };

        historyRef.current = [...historyRef.current, userMsg, modelMsg].slice(
          -10
        );
        saveHistory(historyRef.current);

        setReply(data.reply);
        speak(data.reply);

        if (data.action?.type === "open_website" && data.action.url) {
          window.open(data.action.url, "_blank");
        }
      } catch (err: any) {
        setError(err?.message ?? "Something went wrong talking to ULTRON");
        setStatus("idle");
      }
    },
    [speak]
  );

  const toggleAutoListen = useCallback(() => {
    setAutoListen((v) => !v);
  }, []);

  const clearMemory = useCallback(() => {
    historyRef.current = [];
    saveHistory([]);
  }, []);

  useEffect(() => {
    return () => stopPulseLoop();
  }, [stopPulseLoop]);

  return {
    status,
    transcript,
    reply,
    error,
    autoListen,
    toggleAutoListen,
    startListening,
    stopListening,
    clearMemory,
  };
}
