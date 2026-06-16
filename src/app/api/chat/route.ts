import { getSystemPrompt } from "@/data/chatbot-data";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
      console.error("API KEY IS MISSING IN .env.local");
      return NextResponse.json(
        { reply: "Configuration error: API key missing" },
        { status: 500 },
      );
    }

    // console.log("Sending request to Groq...");

    // Groq API Request
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
          messages: [
            {
              role: "system",
              content: getSystemPrompt(),
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    const data = await response.json();
    // console.log("Groq Response Data:", data);
    // Groq error handle panna
    if (data.error) {
      console.error("Groq API Error:", JSON.stringify(data.error));
      return NextResponse.json(
        { reply: "I'm having trouble connecting to my brain right now." },
        { status: 500 },
      );
    }

    // Response extract panna
    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { reply: "Something went wrong!" },
      { status: 500 },
    );
  }
}
