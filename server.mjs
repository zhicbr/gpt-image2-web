import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, "public");
const runtimeLogPath = join(__dirname, "server.runtime.log");

loadLocalEnv(join(__dirname, ".env"));

const port = Number.parseInt(process.env.PORT || "3000", 10);
const openaiBaseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const apiKey = process.env.OPENAI_API_KEY;
const responsesModel = cleanString(process.env.OPENAI_MODEL, "gpt-5.4");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return;
  const source = readFileSync(filePath, "utf8");
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function safePublicPath(urlPath) {
  const target = urlPath === "/" ? "/index.html" : urlPath;
  const candidate = normalize(join(publicDir, target));
  return candidate.startsWith(publicDir) ? candidate : null;
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 2 * 1024 * 1024) {
      throw new Error("Request body exceeds 2MB");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function logRuntime(event, details = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...details,
  });
  appendFileSync(runtimeLogPath, `${line}\n`, "utf8");
}

function validateGenerateInput(input) {
  const prompt = cleanString(input.prompt);
  if (!prompt) {
    return { error: "Prompt is required." };
  }

  const allowedSizes = new Set([
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "2048x2048",
    "2048x1152",
    "1152x2048",
  ]);
  const allowedQuality = new Set(["low", "medium", "high", "auto"]);
  const allowedFormats = new Set(["png", "jpeg", "webp"]);
  const allowedBackgrounds = new Set(["auto", "opaque"]);
  const allowedModeration = new Set(["low", "auto"]);

  const size = cleanString(input.size, "1024x1024");
  const quality = cleanString(input.quality, "high");
  const outputFormat = cleanString(input.outputFormat, "png");
  const background = cleanString(input.background, "auto");
  const moderation = cleanString(input.moderation, "low");
  const n = Math.max(1, Math.min(Number.parseInt(input.n || "1", 10) || 1, 4));

  if (!allowedSizes.has(size)) {
    return { error: "Unsupported size." };
  }
  if (!allowedQuality.has(quality)) {
    return { error: "Unsupported quality." };
  }
  if (!allowedFormats.has(outputFormat)) {
    return { error: "Unsupported output format." };
  }
  if (!allowedBackgrounds.has(background)) {
    return { error: "Unsupported background mode." };
  }
  if (!allowedModeration.has(moderation)) {
    return { error: "Unsupported moderation mode." };
  }
  if (n !== 1) {
    return { error: "The current local version only supports generating 1 image at a time." };
  }

  return {
    prompt,
    size,
    quality,
    outputFormat,
    background,
    moderation,
    n,
  };
}

function getResponsesPath() {
  const configured = cleanString(process.env.OPENAI_RESPONSES_PATH);
  if (configured) {
    return configured.startsWith("/") ? configured : `/${configured}`;
  }
  return "/responses";
}

function buildResponsesUrl() {
  return `${openaiBaseUrl}${getResponsesPath()}`;
}

function buildResponsesPayload(input) {
  const prompt = [
    "Generate exactly one image that matches the request below.",
    "Use the image_generation tool rather than replying with plain text.",
    `Preferred size/aspect: ${input.size}.`,
    `Preferred quality: ${input.quality}.`,
    `Preferred background: ${input.background}.`,
    `App moderation hint: ${input.moderation}.`,
    "",
    "User request:",
    input.prompt,
  ].join("\n");

  return {
    model: responsesModel,
    instructions: [
      "You are powering a local image generation UI.",
      "You must call the image_generation tool exactly once.",
      "Do not answer with text only.",
    ].join(" "),
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        output_format: input.outputFormat,
      },
    ],
    tool_choice: "required",
    parallel_tool_calls: false,
    stream: true,
  };
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/u);
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  const payload = dataLines.join("\n").trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return { type: "invalid_json_event", raw: payload };
  }
}

async function collectSseResponse(upstream, outputFormat) {
  if (!upstream.body) {
    return {
      images: [],
      eventTypes: [],
      assistantText: [],
    };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const images = [];
  const eventTypes = [];
  const assistantText = [];

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/u);
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) continue;
      eventTypes.push(event.type || "unknown");

      if (event.type === "response.output_item.done" && event.item?.type === "image_generation_call") {
        if (typeof event.item.result === "string" && event.item.result.length) {
          images.push({
            id: images.length + 1,
            mimeType: `image/${outputFormat === "jpeg" ? "jpeg" : outputFormat}`,
            base64: event.item.result,
            revisedPrompt: event.item.revised_prompt || null,
          });
        }
      }

      if (event.type === "response.output_item.done" && event.item?.type === "message") {
        const content = Array.isArray(event.item.content) ? event.item.content : [];
        for (const entry of content) {
          if (entry?.type === "output_text" && typeof entry.text === "string") {
            assistantText.push(entry.text);
          }
        }
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseFrame(buffer);
    if (event) {
      eventTypes.push(event.type || "unknown");
    }
  }

  return { images, eventTypes, assistantText, rawText: null };
}

function collectSseText(rawText, outputFormat) {
  const frames = rawText.split(/\r?\n\r?\n/u);
  const images = [];
  const eventTypes = [];
  const assistantText = [];

  for (const frame of frames) {
    const event = parseSseFrame(frame);
    if (!event) continue;
    eventTypes.push(event.type || "unknown");

    if (event.type === "response.output_item.done" && event.item?.type === "image_generation_call") {
      if (typeof event.item.result === "string" && event.item.result.length) {
        images.push({
          id: images.length + 1,
          mimeType: `image/${outputFormat === "jpeg" ? "jpeg" : outputFormat}`,
          base64: event.item.result,
          revisedPrompt: event.item.revised_prompt || null,
        });
      }
    }

    if (event.type === "response.output_item.done" && event.item?.type === "message") {
      const content = Array.isArray(event.item.content) ? event.item.content : [];
      for (const entry of content) {
        if (entry?.type === "output_text" && typeof entry.text === "string") {
          assistantText.push(entry.text);
        }
      }
    }

    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      assistantText.push(event.delta);
    }
  }

  return { images, eventTypes, assistantText, rawText };
}

function findImageGenerationCalls(value, images, outputFormat) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      findImageGenerationCalls(item, images, outputFormat);
    }
    return;
  }

  if (value.type === "image_generation_call" && typeof value.result === "string" && value.result.length) {
    images.push({
      id: images.length + 1,
      mimeType: `image/${outputFormat === "jpeg" ? "jpeg" : outputFormat}`,
      base64: value.result,
      revisedPrompt: value.revised_prompt || null,
    });
  }

  for (const nested of Object.values(value)) {
    findImageGenerationCalls(nested, images, outputFormat);
  }
}

async function collectJsonResponse(upstream, outputFormat) {
  const rawText = await upstream.text();
  if (/^\s*data:/u.test(rawText) || rawText.includes("\ndata:")) {
    return collectSseText(rawText, outputFormat);
  }

  let parsed;
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { raw: rawText };
  }

  const images = [];
  findImageGenerationCalls(parsed, images, outputFormat);
  return {
    parsed,
    images,
    eventTypes: [],
    assistantText: [],
    rawText,
  };
}

async function handleGenerate(req, res) {
  if (!apiKey) {
    logRuntime("generate.reject", { reason: "missing_api_key" });
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY is missing. Add it to your environment before starting the server.",
    });
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    logRuntime("generate.bad_json", { message: error.message || "Invalid JSON body" });
    return sendJson(res, 400, { error: error.message || "Invalid JSON body." });
  }

  const validated = validateGenerateInput(input);
  if (validated.error) {
    logRuntime("generate.bad_request", { message: validated.error });
    return sendJson(res, 400, { error: validated.error });
  }

  logRuntime("generate.request", {
    promptChars: validated.prompt.length,
    size: validated.size,
    quality: validated.quality,
    outputFormat: validated.outputFormat,
    background: validated.background,
    moderation: validated.moderation,
    n: validated.n,
    model: responsesModel,
    responsesUrl: buildResponsesUrl(),
  });

  try {
    const upstream = await fetch(buildResponsesUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildResponsesPayload(validated)),
    });

    if (!upstream.ok) {
      const rawText = await upstream.text();
      let parsed;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsed = { raw: rawText };
      }
      const errorMessage =
        parsed?.error?.message ||
        parsed?.message ||
        parsed?.raw ||
        "Responses image generation failed.";
      logRuntime("generate.upstream_error", {
        status: upstream.status,
        message: errorMessage,
        details: parsed?.error || parsed,
      });
      return sendJson(res, upstream.status, {
        error: errorMessage,
        details: parsed?.error || parsed,
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    const parsedResult = contentType.includes("text/event-stream")
      ? await collectSseResponse(upstream, validated.outputFormat)
      : await collectJsonResponse(upstream, validated.outputFormat);

    if (!parsedResult.images.length) {
      const assistantSummary = parsedResult.assistantText.join("\n").trim();
      const errorMessage = assistantSummary || "No image_generation_call was returned from /responses.";
      const rawPreview =
        typeof parsedResult.rawText === "string" && parsedResult.rawText.length
          ? parsedResult.rawText.slice(0, 1200)
          : null;
      logRuntime("generate.no_image_call", {
        message: errorMessage,
        eventTypes: parsedResult.eventTypes,
        contentType,
        rawPreview,
      });
      return sendJson(res, 502, {
        error: errorMessage,
        details: {
          eventTypes: parsedResult.eventTypes,
          contentType,
          rawPreview,
        },
      });
    }

    logRuntime("generate.success", {
      imageCount: parsedResult.images.length,
      contentType,
      eventTypes: parsedResult.eventTypes,
    });
    return sendJson(res, 200, {
      created: Date.now(),
      images: parsedResult.images,
    });
  } catch (error) {
    logRuntime("generate.fetch_failed", {
      message: error.message || "Failed to reach OpenAI.",
      cause: error.cause?.message || null,
    });
    return sendJson(res, 502, {
      error: error.message || "Failed to reach OpenAI.",
    });
  }
}

async function handleStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const target = safePublicPath(requestUrl.pathname);
  if (!target || !existsSync(target)) {
    return sendText(res, 404, "Not found");
  }

  const extension = extname(target).toLowerCase();
  const type = mimeTypes.get(extension) || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(target).pipe(res);
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    return sendText(res, 400, "Bad request");
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  logRuntime("http.request", {
    method: req.method,
    path: requestUrl.pathname,
  });

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      model: responsesModel,
      hasApiKey: Boolean(apiKey),
      openaiBaseUrl,
      responsesUrl: buildResponsesUrl(),
    });
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/generate") {
    return handleGenerate(req, res);
  }

  if (req.method === "GET") {
    return handleStatic(req, res);
  }

  return sendText(res, 405, "Method not allowed");
});

server.listen(port, () => {
  logRuntime("server.listen", {
    port,
    openaiBaseUrl,
    responsesUrl: buildResponsesUrl(),
    model: responsesModel,
    hasApiKey: Boolean(apiKey),
  });
  console.log(`gpt-image2-web listening on http://localhost:${port}`);
  if (!apiKey) {
    console.warn("OPENAI_API_KEY is not set. The UI will load, but generation requests will fail.");
  }
});

process.on("uncaughtException", (error) => {
  logRuntime("process.uncaught_exception", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logRuntime("process.unhandled_rejection", {
    reason: typeof reason === "object" && reason ? JSON.stringify(reason) : String(reason),
  });
});
