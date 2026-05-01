function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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

  if (!allowedFormats.has(outputFormat)) return { error: "Unsupported output format." };
  if (n !== 1) return { error: "The current version only supports generating 1 image at a time." };
  for (const referenceImage of referenceImages) {
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/u.test(referenceImage)) {
      return { error: "Unsupported reference image format." };
    }
  }
  if (maskImage && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/u.test(maskImage)) {
    return { error: "Unsupported mask image format." };
  }

  return { prompt, outputFormat, n, referenceImages, maskImage };
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is missing in Cloudflare Environment Variables." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const validated = validateGenerateInput(input);
  if (validated.error) {
    return new Response(JSON.stringify({ error: validated.error }), { status: 400 });
  }

  const openaiBaseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const responsesPath = env.OPENAI_RESPONSES_PATH
    ? (env.OPENAI_RESPONSES_PATH.startsWith("/") ? env.OPENAI_RESPONSES_PATH : `/${env.OPENAI_RESPONSES_PATH}`)
    : "/responses";
  const responsesModel = cleanString(env.OPENAI_MODEL, "gpt-5.4");

  const payload = {
    model: responsesModel,
    instructions: "You are powering a local image generation UI. You must call the image_generation tool exactly once. Do not answer with text only.",
    input: [{
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: validated.prompt },
        ...validated.referenceImages.map((imageUrl) => ({ type: "input_image", image_url: imageUrl })),
      ],
    }],
    tools: [{
      type: "image_generation",
      output_format: validated.outputFormat,
      action: validated.maskImage ? "edit" : "auto",
      ...(validated.maskImage ? { input_image_mask: { image_url: validated.maskImage } } : {}),
    }],
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
      let errorBody;
      try { errorBody = JSON.parse(rawText); } catch { errorBody = { error: rawText }; }
      return new Response(JSON.stringify(errorBody), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");
    headers.set("X-Accel-Buffering", "no");

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Failed to reach OpenAI." }), {
      status: 502, headers: { "Content-Type": "application/json" },
    });
  }
}
