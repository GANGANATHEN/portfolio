import { getSystemPrompt } from "@/data/chatbot-data";
import { NextResponse } from "next/server";

// In-memory sliding window rate limiter
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(identifier: string, limit = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  // Clean old entries if map grows too large
  if (rateLimitMap.size > 2000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(req: Request) {
  try {
    // 1. Rate limiting by IP or forwarded header
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          reply:
            "You are sending messages too quickly. Please pause for a moment before asking again.",
          status: "rate_limited",
        },
        { status: 429 },
      );
    }

    // 2. Extract and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { reply: "Invalid request payload format." },
        { status: 400 },
      );
    }

    const { history, userName = "Visitor", botNickname = "Ganganathan's AI Assistant" } = body;

    if (!Array.isArray(history)) {
      return NextResponse.json(
        { reply: "Invalid chat history format." },
        { status: 400 },
      );
    }

    // Sanitized & bounded history (keep last 12 messages max)
    const boundedHistory = history.slice(-12);
    const lastMessage = boundedHistory[boundedHistory.length - 1];

    if (!lastMessage || typeof lastMessage.text !== "string" || !lastMessage.text.trim()) {
      return NextResponse.json(
        { reply: "Message cannot be empty." },
        { status: 400 },
      );
    }

    if (lastMessage.text.length > 800) {
      return NextResponse.json(
        { reply: "Your message is too long (limit is 800 characters). Please send a shorter message." },
        { status: 400 },
      );
    }

    // 3. Resolve API Key from GROQ_API_KEY or fallback API_KEY
    const API_KEY = process.env.GROQ_API_KEY || process.env.API_KEY;

    if (!API_KEY || API_KEY.trim() === "" || API_KEY.includes("your-groq-api-key")) {
      return NextResponse.json({
        reply:
          "My AI brain is currently in standby mode while my Groq API credentials are being updated. In the meantime, feel free to explore Ganganathan's featured projects and reach out directly through the Live Chat or Contact form!",
        status: "missing_credentials",
      });
    }

    // 4. Format history for Groq
    type ChatMessage = {
      role: "user" | "assistant" | "bot" | "system" | string;
      text: string;
    };

    const formattedMessages = boundedHistory.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: String(msg.text || "").slice(0, 1000),
    }));

    const messages = [
      {
        role: "system",
        content: getSystemPrompt(
          String(userName || "Visitor").slice(0, 50),
          String(botNickname || "Ganganathan's AI Assistant").slice(0, 50),
        ),
      },
      ...formattedMessages,
    ];

    // 5. Send request to Groq with timeout protection
    let groqRes: Response;
    try {
      groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: 0.7,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (fetchErr: unknown) {
      const err = fetchErr as Error;
      if (err.name === "TimeoutError") {
        return NextResponse.json({
          reply:
            "I'm taking a bit longer than usual to think. Please try asking again in a few seconds!",
          status: "timeout",
        });
      }
      return NextResponse.json({
        reply:
          "I'm having trouble connecting to my neural network right now. Please feel free to use the Live Chat or Contact form!",
        status: "network_error",
      });
    }

    const data = await groqRes.json().catch(() => null);

    if (!groqRes.ok || !data || data.error) {
      const errorCode = data?.error?.code || groqRes.statusText;
      console.warn(`[Groq AI] Upstream response ${groqRes.status}: ${errorCode}`);

      if (groqRes.status === 401 || errorCode === "invalid_api_key") {
        return NextResponse.json({
          reply:
            "My AI brain is currently waiting for renewed Groq API credentials. You can still message Ganganathan directly via the Live Chat button or the Contact form below!",
          status: "invalid_api_key",
        });
      }

      if (groqRes.status === 429) {
        return NextResponse.json({
          reply:
            "I've hit my conversation rate limit for the moment. Please wait a minute or connect directly via Live Chat!",
          status: "rate_limited",
        });
      }

      return NextResponse.json({
        reply:
          "I'm temporarily resting my circuits. Feel free to explore the portfolio or drop a direct message via Live Chat!",
        status: "upstream_error",
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return NextResponse.json({
        reply:
          "I heard you, but I couldn't formulate a reply right now. What else would you like to know about Ganganathan's work?",
      });
    }

    return NextResponse.json({ reply: reply.trim() });
  } catch (error) {
    console.error("[Chat API Internal Error]:", error);
    return NextResponse.json(
      { reply: "Something unexpected happened. Please try again in a moment." },
      { status: 500 },
    );
  }
}
