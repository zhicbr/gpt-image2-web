// functions/api/generate.js

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validateGenerateInput(input) {
  const prompt = cleanString(input.prompt);
  if (!prompt) return { error: "Prompt is required." };

  const allowedFormats = new Set(["png", "jpeg", "webp"]);
  const outputFormat = cleanString(input.outputFormat, "png");
  const n = Math.max(1, Math.min(Number.parseInt(input.n || "1", 10) || 1, 4));

  if (!allowedFormats.has(outputFormat)) return { error: "Unsupported output format." };
  if (n !== 1) return { error: "The current version only supports generating 1 image at a time." };

  return { prompt, outputFormat, n };
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/u);
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
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
  if (!upstream.body) return { images: [], eventTypes: [], assistantText: [] };

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
  return { images, eventTypes, assistantText, rawText: null };
}

function findImageGenerationCalls(value, images, outputFormat) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) findImageGenerationCalls(item, images, outputFormat);
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

// 这是 Cloudflare Pages Functions 的入口函数
export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is missing in Cloudflare Environment Variables." }), { 
      status: 500, headers: { "Content-Type": "application/json" } 
    });
  }

  let input;
  try {
    input = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const validated = validateGenerateInput(input);
  if (validated.error) {
    return new Response(JSON.stringify({ error: validated.error }), { status: 400 });
  }

  const openaiBaseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const responsesPath = env.OPENAI_RESPONSES_PATH ? (env.OPENAI_RESPONSES_PATH.startsWith("/") ? env.OPENAI_RESPONSES_PATH : `/${env.OPENAI_RESPONSES_PATH}`) : "/responses";
  const responsesModel = cleanString(env.OPENAI_MODEL, "gpt-5.4");

  const payload = {
    model: responsesModel,
    instructions: "You are powering a local image generation UI. You must call the image_generation tool exactly once. Do not answer with text only.",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: validated.prompt }] }],
    tools: [{ type: "image_generation", output_format: validated.outputFormat }],
    tool_choice: "required",
    parallel_tool_calls: false,
    stream: true,
  };

  try {
    const upstream = await fetch(`${openaiBaseUrl}${responsesPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const rawText = await upstream.text();
      return new Response(rawText, { status: upstream.status, headers: { "Content-Type": "application/json" } });
    }

    const parsedResult = await collectSseResponse(upstream, validated.outputFormat);

    if (!parsedResult.images.length) {
      return new Response(JSON.stringify({ error: "No image generation output found." }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      created: Date.now(),
      images: parsedResult.images,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to reach OpenAI." }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}