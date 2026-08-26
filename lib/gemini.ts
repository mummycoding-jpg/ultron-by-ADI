// lib/gemini.ts
// Server-side helper that talks to Google Gemini.
// Requires GEMINI_API_KEY in your environment (Railway → Variables).
//
// Now supports:
// - Google Search grounding (ULTRON can look things up)
// - Function calling for "open a website" voice commands
// - Optional image input (for camera vision requests)

const GEMINI_MODEL = "gemini-3.1-flash-lite"; // more generous free-tier rate limit
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ChatMessage = { role: "user" | "model"; text: string };

export type GeminiAction = { type: "open_website"; url: string } | null;

export type GeminiResult = {
  reply: string;
  action: GeminiAction;
};

const ULTRON_SYSTEM_PROMPT = `
You are ULTRON, a witty, slightly dramatic AI assistant living inside a
holographic orb interface. Keep replies short (1-3 sentences) — they will
be spoken out loud, so avoid long paragraphs, markdown, or lists. Be
conversational, confident, and a little theatrical, but genuinely helpful.

You have two special abilities:
1. Web search — use it whenever the user asks about current events, facts
   you're unsure of, or anything time-sensitive.
2. Opening websites — if the user asks you to "open", "go to", "pull up",
   or "visit" a specific website (e.g. "open YouTube", "open github.com"),
   call the open_website function with the full https:// URL of that site.
   Only call it when the user clearly wants a site opened — not for normal
   questions.

If you were given an image, describe or answer about what's actually in it.
`.trim();

const OPEN_WEBSITE_FUNCTION = {
  name: "open_website",
  description:
    "Opens a website in a new browser tab for the user. Use this when the user asks to open, visit, go to, or pull up a specific website.",
  parameters: {
    type: "OBJECT",
    properties: {
      url: {
        type: "STRING",
        description:
          "The full https:// URL of the website to open, e.g. https://youtube.com",
      },
    },
    required: ["url"],
  },
};

export async function askGemini(
  history: ChatMessage[],
  newMessage: string,
  imageBase64?: string // optional data URL, e.g. "data:image/jpeg;base64,..."
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const newUserParts: any[] = [{ text: newMessage }];

  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      newUserParts.push({
        inlineData: { mimeType: match[1], data: match[2] },
      });
    }
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: newUserParts },
  ];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: ULTRON_SYSTEM_PROMPT }] },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [OPEN_WEBSITE_FUNCTION] },
      ],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 300,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  let reply = "";
  let action: GeminiAction = null;

  for (const part of parts) {
    if (part.text) {
      reply += part.text;
    }
    if (part.functionCall?.name === "open_website") {
      const url = part.functionCall.args?.url;
      if (url) {
        action = { type: "open_website", url };
        if (!reply) reply = `Opening ${url} for you now.`;
      }
    }
  }

  if (!reply && !action) {
    throw new Error("Gemini returned no usable content in response");
  }

  return { reply: reply.trim(), action };
}
