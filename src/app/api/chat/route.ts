import { getSystemPrompt } from "@/data/chatbot-data";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Extract history and userName from the request body
    const { history, userName,botNickname } = await req.json();
    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
      console.error("API KEY IS MISSING IN .env.local");
      return NextResponse.json(
        { reply: "Configuration error: API key missing" },
        { status: 500 },
      );
    }

    // 2. Format history into the structure Groq/OpenAI expects
    type ChatMessage = {
      role: "user" | "assistant" | "system" | string;
      text: string;
    };

    const formattedMessages = history.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    }));

    // 3. Construct the message array with the system prompt first
    const messages = [
      {
        role: "system",
        content: getSystemPrompt(userName, botNickname),
      },
      ...formattedMessages,
    ];

    // 4. Send request to Groq
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", JSON.stringify(data.error));
      return NextResponse.json(
        { reply: "I'm having trouble connecting to my brain right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { reply: "Something went wrong!" },
      { status: 500 },
    );
  }
}