// hooks/useUltronBrain.ts
// Client-side hook: browser mic -> Web Speech API (STT) -> /api/chat (Gemini)
// -> Web Speech Synthesis (TTS). No API keys needed in the browser.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "model"; text: string };

export type UltronStatus = "idle" | "listening" | "thinking" | "speaking";

export function useUltronBrain() {
  const [status, setStatus] = useState<UltronStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<ChatMessage[]>([]);
  const recognitionRef = useRef<any>(null);

  // Set up SpeechRecognition once on mount
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
      setError(`Mic error: ${event.error}`);
      setStatus("idle");
    };

    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setError("This browser doesn't support speech output.");
      setStatus("idle");
      return;
    }
    window.speechSynthesis.cancel(); // stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.9;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleUserSpeech = useCallback(
    async (text: string) => {
      setStatus("thinking");
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: historyRef.current,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Request failed");

        const userMsg: ChatMessage = { role: "user", text };
        const modelMsg: ChatMessage = { role: "model", text: data.reply };

        historyRef.current = [
          ...historyRef.current,
          userMsg,
          modelMsg,
        ].slice(-10); // keep last 10 turns

        setReply(data.reply);
        speak(data.reply);
      } catch (err: any) {
        setError(err?.message ?? "Something went wrong talking to ULTRON");
        setStatus("idle");
      }
    },
    [speak]
  );

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
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
    recognitionRef.current?.stop();
  }, []);

  return {
    status, // "idle" | "listening" | "thinking" | "speaking"
    transcript, // last thing the user said
    reply, // last thing ULTRON said
    error,
    startListening,
    stopListening,
  };
}
