// Serverless function for Vercel deployment: POST /api/extract
"use strict";
const LM = require("../matcher.js");
const { createLimiter } = require("../ratelimit.js");

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
// Unset means same-origin only: no CORS headers are sent. Set it to the Pages URL for a split deployment.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const allow = createLimiter(
  Number(process.env.RATE_LIMIT_PER_MIN) || 120,
  60 * 1000,
);

function setCorsHeaders(res) {
  if (!ALLOWED_ORIGIN) return;
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Vercel sets x-forwarded-for itself, so its first entry is the real client address.
function clientKey(req) {
  const xff = req.headers["x-forwarded-for"];
  return (
    (xff ? String(xff).split(",")[0].trim() : "") ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown"
  );
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    /* fall through */
  }
  const a = text.indexOf("{"),
    b = text.lastIndexOf("}");
  if (a !== -1 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("no JSON in reply");
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!allow(clientKey(req))) {
    return res.status(429).json({ error: "Too many requests" });
  }

  if (!KEY) {
    return res
      .status(503)
      .json({ error: "ANTHROPIC_API_KEY is not set on the server" });
  }

  let input = req.body;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch (e) {
      return res.status(400).json({ error: "bad request body" });
    }
  }

  if (
    !input ||
    !TYPES.includes(input.mediaType) ||
    typeof input.data !== "string"
  ) {
    return res.status(400).json({ error: "unsupported or missing image data" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mediaType,
                  data: input.data,
                },
              },
              {
                type: "text",
                text: "The label image is attached.\n\n" + LM.EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({ error: "upstream " + upstream.status });
    }

    const body = await upstream.json();
    const text = (body.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      const parsed = parseJsonLoose(text);
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(502).json({ error: "unreadable reply from model" });
    }
  } catch (err) {
    return res
      .status(502)
      .json({ error: "request failed: " + (err.message || "unknown error") });
  }
};
