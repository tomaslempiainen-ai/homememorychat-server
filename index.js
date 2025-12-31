import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

// Middlewaret
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --------------------
// Health check
// --------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// --------------------
// Chat endpoint
// --------------------
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Missing messages (array required)",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on server",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply =
      completion?.choices?.[0]?.message?.content || "";

    res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ OpenAI error:", error);
    res.status(500).json({ error: "AI error" });
  }
});

// --------------------
// Server start (Render)
// --------------------
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
});