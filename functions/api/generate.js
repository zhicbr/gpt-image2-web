function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildErrorBody(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return { error: rawText };
  }
}

function buildSsePayload(base64, revisedPrompt = null) {
  const event = {
    type: "response.output_item.done",
    item: {
      type: "image_generation_call",
      result: base64,
      ...(revisedPrompt ? { revised_prompt: revisedPrompt } : {}),
    },
  };
  return `data: ${JSON.stringify(event)}\n\n` + "data: [DONE]\n\n";
}

function sseResponseFromBase64(base64, revisedPrompt = null) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(buildSsePayload(base64, revisedPrompt)));
      controller.close();
    },
  });

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  return new Response(stream, { status: 200, headers });
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/u);
  if (!match) {
    throw new Error("Unsupported image data URL.");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function validateGenerateInput(input) {
  const prompt = cleanString(input.prompt);
  if (!prompt) return { error: "Prompt is required." };

  const allowedFormats = new Set(["png", "jpeg", "webp"]);
  const outputFormat = cleanString(input.outputFormat, "png");
  const n = Math.max(1, Math.min(Number.parseInt(input.n || "1", 10) || 1, 4));
  const referenceImages = Array.isArray(input.referenceImages)
    ? input.referenceImages.map((item) => cleanString(item)).filter(Boolean)
    : [];
  const maskImage = cleanString(input.maskImage);
  const backend = cleanString(input.backend, "auto");

  if (!allowedFormats.has(outputFormat)) return { error: "Unsupported output format." };
  if (n !== 1) return { error: "The current version only supports generating 1 image at a time." };
  if (!["auto", "images", "responses"].includes(backend)) return { error: "Unsupported backend." };

  for (const referenceImage of referenceImages) {
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/u.test(referenceImage)) {
      return { error: "Unsupported reference image format." };
    }
  }

  if (maskImage && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/u.test(maskImage)) {
    return { error: "Unsupported mask image format." };
  }

  return { prompt, outputFormat, n, referenceImages, maskImage, backend };
}

function shouldUseEditsBackend(validated, env) {
  const forceBackend = cleanString(env.IMAGE_BACKEND, "auto");
  if (forceBackend === "responses") return true;
  if (forceBackend === "images") return false;

  if (validated.backend === "responses") return true;
  if (validated.backend === "images") return false;

  return validated.referenceImages.length > 0 || Boolean(validated.maskImage);
}

async function handleImagesBackend(validated, env, apiKey) {
  const imageBaseUrl = (env.OPENAI_IMAGE_BASE_URL || "https://sapi.micosoft.icu/v1").replace(/\/+$/, "");
  const imagesPath = env.OPENAI_IMAGES_PATH
    ? (env.OPENAI_IMAGES_PATH.startsWith("/") ? env.OPENAI_IMAGES_PATH : `/${env.OPENAI_IMAGES_PATH}`)
    : "/images/generations";
  const imageModel = cleanString(env.OPENAI_IMAGE_MODEL, "gpt-image-2");

  const size = cleanString(inputSizeFromPrompt(validated.prompt), "1024x1024");
  const payload = {
    model: imageModel,
    prompt: validated.prompt,
    size,
    response_format: "b64_json",
  };

  const upstream = await fetch(`${imageBaseUrl}${imagesPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const rawText = await upstream.text();
    return jsonResponse(buildErrorBody(rawText), upstream.status);
  }

  const body = await upstream.json();
  const base64 = body?.data?.[0]?.b64_json;
  if (!base64) {
    return jsonResponse({ error: "No image was returned from images/generations." }, 502);
  }

  return sseResponseFromBase64(base64);
}

async function handleEditsBackend(validated, env, apiKey) {
  const imageBaseUrl = (env.OPENAI_IMAGE_BASE_URL || "https://sapi.micosoft.icu/v1").replace(/\/+$/, "");
  const editsPath = env.OPENAI_EDITS_PATH
    ? (env.OPENAI_EDITS_PATH.startsWith("/") ? env.OPENAI_EDITS_PATH : `/${env.OPENAI_EDITS_PATH}`)
    : "/images/edits";
  const imageModel = cleanString(env.OPENAI_IMAGE_MODEL, "gpt-image-2");

  const formData = new FormData();
  formData.set("model", imageModel);
  formData.set("prompt", validated.prompt);

  validated.referenceImages.forEach((imageUrl, index) => {
    formData.append("image", dataUrlToBlob(imageUrl), `reference-${index + 1}.png`);
  });

  if (validated.maskImage) {
    formData.set("mask", dataUrlToBlob(validated.maskImage), "mask.png");
  }

  const upstream = await fetch(`${imageBaseUrl}${editsPath}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!upstream.ok) {
    const rawText = await upstream.text();
    return jsonResponse(buildErrorBody(rawText), upstream.status);
  }

  const body = await upstream.json();
  const base64 = body?.data?.[0]?.b64_json;
  if (!base64) {
    return jsonResponse({ error: "No image was returned from images/edits." }, 502);
  }

  return sseResponseFromBase64(base64, body?.data?.[0]?.revised_prompt || null);
}

function inputSizeFromPrompt(prompt) {
  const match = prompt.match(/\b(1024x1024|1024x1536|1536x1024|2048x2048|2048x1152|1152x2048)\b/i);
  return match ? match[1].toLowerCase() : "";
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "OPENAI_API_KEY is missing in Cloudflare Environment Variables." }, 500);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const validated = validateGenerateInput(input);
  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400);
  }

  try {
    if (shouldUseEditsBackend(validated, env)) {
      return await handleEditsBackend(validated, env, apiKey);
    }
    return await handleImagesBackend(validated, env, apiKey);
  } catch (error) {
    return jsonResponse({ error: error.message || "Failed to reach upstream image service." }, 502);
  }
}
