import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check (Render käyttää tätä)
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({ error: "Missing messages" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    res.json({
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "AI error" });
  }
});

// ⚠️ TÄRKEÄ: Render käyttää PORT-ympäristömuuttujaa
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ AI server running on port ${PORT}`);
});