// components/UltronMicButton.tsx
// Drop this into your existing page alongside the orb. Clicking it starts
// listening; ULTRON replies out loud automatically once it's done thinking.
"use client";

import { useUltronBrain } from "@/hooks/useUltronBrain";

export default function UltronMicButton() {
  const { status, transcript, reply, error, startListening, stopListening } =
    useUltronBrain();

  const label =
    status === "listening"
      ? "LISTENING…"
      : status === "thinking"
      ? "THINKING…"
      : status === "speaking"
      ? "SPEAKING…"
      : "TALK TO ULTRON";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "thinking" || status === "speaking"}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "1px solid #f5a623",
          background: "transparent",
          color: "#f5a623",
          fontFamily: "monospace",
          letterSpacing: 1,
          cursor: "pointer",
        }}
      >
        {label}
      </button>

      {transcript && (
        <p style={{ color: "#888", fontSize: 12 }}>You said: {transcript}</p>
      )}
      {reply && (
        <p style={{ color: "#f5a623", fontSize: 14 }}>ULTRON: {reply}</p>
      )}
      {error && (
        <p style={{ color: "#ff5555", fontSize: 12 }}>⚠ {error}</p>
      )}
    </div>
  );
}
