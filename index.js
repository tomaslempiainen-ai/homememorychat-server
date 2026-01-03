import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";

const app = express();

// Render/proxy-ympäristössä hyvä käytäntö
app.set("trust proxy", 1);

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
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --------------------
// Health check (julkinen)
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
// Rate limit per user (kun käyttäjä on tunnistettu)
// --------------------
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 3,             // max 20 pyyntöä / minuutti / käyttäjä
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, // tärkein: per-user
  handler: (req, res) => {
    return res.status(429).json({
      error: "Rate limit: liikaa pyyntöjä. Odota hetki ja yritä uudelleen.",
    });
  },
});

// --------------------
// Pieni lokitus-apuri
// --------------------
function logEvent(type, obj) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${type}`, JSON.stringify(obj));
}

// --------------------
// Chat endpoint (auth + rate limit)
// --------------------
app.post("/chat", requireSupabaseAuth, chatLimiter, async (req, res) => {
  const userId = req.user?.id || "unknown";

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      logEvent("CHAT_BAD_REQUEST", { userId, reason: "missing_messages" });
      return res.status(400).json({
        error: "Missing messages (array required)",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      logEvent("CHAT_SERVER_ERROR", { userId, reason: "missing_openai_key" });
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on server",
      });
    }

    // Lokitus: pyyntö
    const lastUserMsg = [...messages].reverse().find((m) => m?.role === "user");
    const lastLen = (lastUserMsg?.content || "").length;

    logEvent("CHAT_REQUEST", {
      userId,
      messagesCount: messages.length,
      lastUserMsgLen: lastLen,
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "";

    // Lokitus: vastaus
    logEvent("CHAT_RESPONSE", { userId, replyLen: reply.length });

    return res.status(200).json({ reply });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.error?.message || error?.message || "AI error";

    logEvent("CHAT_ERROR", { userId, status, message });

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
});