import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 3789);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.use(cors({ origin: [/^https:\/\/mail\.google\.com$/, /^chrome-extension:\/\//] }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/generate", async (request, response) => {
  const { thread, instruction = "", mode = "professional", sliders = {} } = request.body || {};

  if (!thread || !Array.isArray(thread.messages)) {
    response.status(400).json({ error: "Missing Gmail thread messages." });
    return;
  }

  const messages = thread.messages
    .map((message) => String(message).trim())
    .filter(Boolean)
    .slice(-8);

  if (!messages.length) {
    response.status(400).json({ error: "No readable Gmail messages found." });
    return;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      response.json({
        mock: true,
        reply: buildMockReply({ instruction, mode, sliders, subject: thread.subject })
      });
      return;
    }

    const reply = await generateWithOpenAI({
      subject: thread.subject || "",
      messages,
      instruction,
      mode,
      sliders
    });

    response.json({ reply });
  } catch (error) {
    response.status(500).json({ error: error.message || "Failed to generate reply." });
  }
});

async function generateWithOpenAI({ subject, messages, instruction, mode, sliders }) {
  const prompt = [
    `Subject: ${subject || "(no subject found)"}`,
    "",
    "Visible Gmail thread:",
    messages.map((message, index) => `Message ${index + 1}:\n${message}`).join("\n\n---\n\n"),
    "",
    `User instruction: ${instruction || "Draft the best helpful reply."}`,
    `Mode: ${mode}`,
    `Tone sliders: ${JSON.stringify(sliders)}`
  ].join("\n");

  const result = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: [
            "You draft Gmail replies from the visible email thread.",
            "Return only the reply body, no subject line, no commentary.",
            "Respect the user's requested intent and tone controls.",
            "Do not invent facts that are not in the thread or instruction.",
            "If the mode is professionalize, rewrite the intended response into polished professional email prose."
          ].join(" ")
        },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await result.json();
  if (!result.ok) {
    throw new Error(data.error?.message || "OpenAI request failed.");
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

function buildMockReply({ instruction, mode, sliders, subject }) {
  const warmth = Number(sliders.warm || 5) > 6 ? "I hope you are doing well.\n\n" : "";
  const concise = Number(sliders.concise || 5) > 7;
  const funny = Number(sliders.funny || 0) > 6;
  const professional = mode === "professionalize" || mode === "professional" || Number(sliders.professional || 0) > 6;
  const opener = professional ? "Thanks for the note." : "Thanks for reaching out.";
  const body = instruction
    ? `I wanted to follow up and ${instruction.replace(/\.$/, "")}.`
    : `I wanted to follow up on${subject ? ` "${subject}"` : " this thread"}.`;
  const closer = funny ? "Appreciate it, and I will keep this mercifully brief." : "Please let me know what works best.";

  if (concise) {
    return `${opener}\n\n${body}\n\n${closer}`;
  }

  return `${warmth}${opener}\n\n${body}\n\n${closer}\n\nBest,`;
}

app.listen(port, () => {
  console.log(`Professionalize server listening on http://localhost:${port}`);
});
