// lib/gemini.ts
// Server-side helper that talks to Google Gemini.
// Requires GEMINI_API_KEY in your environment (Railway → Variables).

const GEMINI_MODEL = "gemini-3.6-flash"; // current Flash model, still free-tier eligible
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ChatMessage = {
  role: "user" | "model";
  text: string;
};

const ULTRON_SYSTEM_PROMPT = `
You are ULTRON, a witty, slightly dramatic AI assistant living inside a
holographic orb interface. Keep replies short (1-3 sentences) — they will
be spoken out loud, so avoid long paragraphs, markdown, or lists. Be
conversational, confident, and a little theatrical, but genuinely helpful.
`.trim();

export async function askGemini(
  history: ChatMessage[],
  newMessage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: newMessage }] },
  ];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: ULTRON_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 200,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const reply: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) {
    throw new Error("Gemini returned no text in response");
  }

  return reply.trim();
}
