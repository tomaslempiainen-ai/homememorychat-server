import express from "express";
import cors from "cors";
import OpenAI from "openai";

// Renderissä ei yleensä ole .env-tiedostoa, vaan env-muuttujat asetetaan Renderin dashboardissa.
// Älä siis yritä pakolla lukea .env:ää täällä.

const app = express();

// Salli CORS (voit halutessasi myöhemmin rajata tiettyihin domaineihin)
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Terveystarkistus Renderille ja sinulle
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages (array)" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is missing on server" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "";

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "AI error" });
  }
});

// ✅ Render antaa portin env-muuttujassa PORT
const PORT = process.env.PORT || 3001;
// ✅ Renderissa kannattaa kuunnella 0.0.0.0
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`✅ AI server running on http://${HOST}:${PORT}`);
});