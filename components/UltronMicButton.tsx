// components/UltronMicButton.tsx
// Mic button + AUTO toggle + memory clear, all fixed above GESTURES ON.
"use client";

import { useUltronBrain } from "@/hooks/useUltronBrain";

export default function UltronMicButton() {
  const {
    status,
    transcript,
    reply,
    error,
    autoListen,
    toggleAutoListen,
    startListening,
    stopListening,
    clearMemory,
  } = useUltronBrain();

  const label =
    status === "listening"
      ? "LISTENING…"
      : status === "seeing"
      ? "LOOKING…"
      : status === "thinking"
      ? "THINKING…"
      : status === "speaking"
      ? "SPEAKING…"
      : "TALK TO ULTRON";

  const pillStyle = (active: boolean) => ({
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? "#4caf50" : "#666"}`,
    background: "rgba(0,0,0,0.7)",
    color: active ? "#4caf50" : "#888",
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 1,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 170,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        maxWidth: 340,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
        <button onClick={toggleAutoListen} style={pillStyle(autoListen)}>
          AUTO {autoListen ? "ON" : "OFF"}
        </button>
        <button onClick={clearMemory} style={pillStyle(false)}>
          FORGET ME
        </button>
      </div>

      <button
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "thinking" || status === "speaking" || status === "seeing"}
        style={{
          pointerEvents: "auto",
          padding: "10px 20px",
          borderRadius: 8,
          border: "1px solid #f5a623",
          background: "rgba(0,0,0,0.7)",
          color: "#f5a623",
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: 1,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        🎤 {label}
      </button>

      <p
        style={{
          pointerEvents: "auto",
          color: "#666",
          fontSize: 10,
          margin: 0,
          textAlign: "right",
        }}
      >
        Try: "open YouTube" · "look at this" · "what's the weather today"
      </p>

      {transcript && (
        <p style={{ pointerEvents: "auto", color: "#ccc", fontSize: 12, background: "rgba(0,0,0,0.7)", padding: 6, borderRadius: 4, margin: 0, textAlign: "right" }}>
          You said: {transcript}
        </p>
      )}
      {reply && (
        <p style={{ pointerEvents: "auto", color: "#f5a623", fontSize: 14, background: "rgba(0,0,0,0.7)", padding: 6, borderRadius: 4, margin: 0, textAlign: "right" }}>
          ULTRON: {reply}
        </p>
      )}
      {error && (
        <p style={{ pointerEvents: "auto", color: "#ff5555", fontSize: 12, background: "rgba(0,0,0,0.7)", padding: 6, borderRadius: 4, margin: 0, textAlign: "right" }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
