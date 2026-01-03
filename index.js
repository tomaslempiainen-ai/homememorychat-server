import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();

// --------------------
// Middlewaret
// --------------------
app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// --------------------
// Supabase client (backend)
// --------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --------------------
// Health check (julkinen) – VERSION TEST
// --------------------
app.get("/healthz", (req, res) => {
  res.status(200).send("ok-v2");
});

// --------------------
// Auth middleware: vaadi Supabase access token
// --------------------
async function requireSupabaseAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(401).json({ error: "Auth check failed" });
  }
}

// --------------------
// Chat endpoint (suojattu Supabase-tokenilla)
// --------------------
app.post("/chat", requireSupabaseAuth, async (req, res) => {
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

    console.log("🤖 Chat request from user:", req.user.id);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ reply });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.error?.message || error?.message || "AI error";

    console.error("❌ OpenAI error:", status, message);

    if (status === 401) {
      return res
        .status(500)
        .json({ error: "OpenAI auth failed (check OPENAI_API_KEY)" });
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