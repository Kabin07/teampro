import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

// Constructed once at startup. If ANTHROPIC_API_KEY isn't set, keep the
// server running (so /api/health still works) but fail /api/chat clearly.
let anthropic;
try {
  anthropic = new Anthropic();
} catch {
  anthropic = null;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(anthropic) });
});

app.post("/api/chat", async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
    });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      // Disabled for this minimal demo endpoint so the whole max_tokens
      // budget goes to the visible reply. Switch to
      // thinking: { type: "adaptive" } for harder tasks.
      thinking: { type: "disabled" },
      messages,
    });

    const reply = response.content.find((block) => block.type === "text")?.text ?? "";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "AI request failed" });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI backend listening on http://localhost:${PORT}`);
});
