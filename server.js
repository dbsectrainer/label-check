// Minimal dependency-free server for running Label Check outside Claude.
//   ANTHROPIC_API_KEY=sk-ant-... node server.js
// Serves index.html and matcher.js, and exposes POST /api/extract, which sends the label
// image to the Anthropic Messages API and returns the transcribed fields as JSON.
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const LM = require("./matcher.js");

const PORT = Number(process.env.PORT) || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_BODY = 15 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const HEAD =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  "<style>body{margin:0}</style></head><body>";

function send(res, status, type, body) {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
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

async function extract(req, res) {
  if (!KEY)
    return send(
      res,
      503,
      "application/json",
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server" }),
    );
  let input;
  try {
    input = JSON.parse(await readBody(req));
  } catch (e) {
    return send(
      res,
      e.status || 400,
      "application/json",
      JSON.stringify({ error: "bad request" }),
    );
  }
  if (!TYPES.includes(input.mediaType) || typeof input.data !== "string") {
    return send(
      res,
      400,
      "application/json",
      JSON.stringify({ error: "unsupported image" }),
    );
  }
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
            // The prompt is fixed on the server; the client's copy is ignored.
            {
              type: "text",
              text: "The label image is attached.\n\n" + LM.EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }),
  });
  if (!upstream.ok)
    return send(
      res,
      upstream.status === 429 ? 429 : 502,
      "application/json",
      JSON.stringify({ error: "upstream " + upstream.status }),
    );
  const body = await upstream.json();
  const text = (body.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    send(res, 200, "application/json", JSON.stringify(parseJsonLoose(text)));
  } catch (e) {
    send(
      res,
      502,
      "application/json",
      JSON.stringify({ error: "unreadable reply" }),
    );
  }
}

http
  .createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "OPTIONS") {
      return send(res, 204, "text/plain", "");
    }
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      return send(
        res,
        200,
        "text/html; charset=utf-8",
        HEAD +
          fs.readFileSync(path.join(__dirname, "index.html"), "utf8") +
          "</body></html>",
      );
    }
    if (req.method === "GET" && url === "/matcher.js") {
      return send(
        res,
        200,
        "text/javascript; charset=utf-8",
        fs.readFileSync(path.join(__dirname, "matcher.js")),
      );
    }
    if (req.method === "GET" && url === "/config.js") {
      return send(
        res,
        200,
        "text/javascript; charset=utf-8",
        fs.readFileSync(path.join(__dirname, "config.js")),
      );
    }
    if (req.method === "POST" && url === "/api/extract") {
      return extract(req, res).catch(() =>
        send(res, 502, "application/json", JSON.stringify({ error: "failed" })),
      );
    }
    send(res, 404, "text/plain", "Not found");
  })
  .listen(PORT, () =>
    console.log(
      "Label Check on http://localhost:" +
        PORT +
        (KEY ? "" : "  (set ANTHROPIC_API_KEY to enable label reading)"),
    ),
  );
