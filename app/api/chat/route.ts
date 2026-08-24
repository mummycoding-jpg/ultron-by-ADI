// app/api/chat/route.ts
// POST { message: string, history?: ChatMessage[] } -> { reply: string }

import { NextRequest, NextResponse } from "next/server";
import { askGemini, ChatMessage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body?.message;
    const history: ChatMessage[] = Array.isArray(body?.history)
      ? body.history
      : [];

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing 'message' string in request body" },
        { status: 400 }
      );
    }

    const reply = await askGemini(history, message);

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("ULTRON /api/chat error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
