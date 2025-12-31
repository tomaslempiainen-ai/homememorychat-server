import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

// Middlewaret
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --------------------
// Health check (julkinen)
// --------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// --------------------
// API-lukitus: vaadi client key /chat:ille
// --------------------
function requireClientKey(req, res, next) {
  const clientKey = req.headers["x-client-key"]; // header-nimi: x-client-key
  const expectedKey = process.env.CLIENT_API_KEY;

  if (!expectedKey) {
    // Renderissä pitäisi olla CLIENT_API_KEY asetettuna
    return res.status(500).json({ error: "CLIENT_API_KEY is missing on server" });
  }

  if (!clientKey || clientKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// --------------------
// Chat endpoint (lukittu)
// --------------------
app.post("/chat", requireClientKey, async (req, res) => {
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

    const reply = completion?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ reply });
  } catch (error) {
    // Yritetään poimia OpenAI:n virheestä järkevä viesti
    const status = error?.status || 500;
    const message =
      error?.error?.message ||
      error?.message ||
      "AI error";

    console.error("❌ OpenAI error:", status, message);

    // Esim. quota / rate limit -> 429
    if (status === 401) {
      return res.status(500).json({ error: "OpenAI auth failed (check OPENAI_API_KEY)" });
    }
    if (status === 429) {
      return res.status(429).json({ error: message });
    }

    return res.status(500).json({ error: "AI error" });
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