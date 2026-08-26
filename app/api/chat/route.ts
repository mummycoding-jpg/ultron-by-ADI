// app/api/chat/route.ts
// POST { message: string, history?: ChatMessage[], image?: string }
// -> { reply: string, action: { type: "open_website", url: string } | null }

import { NextRequest, NextResponse } from "next/server";
import { askGemini, ChatMessage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body?.message;
    const history: ChatMessage[] = Array.isArray(body?.history)
      ? body.history
      : [];
    const image: string | undefined = body?.image;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing 'message' string in request body" },
        { status: 400 }
      );
    }

    const result = await askGemini(history, message, image);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("ULTRON /api/chat error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
