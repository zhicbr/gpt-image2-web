import { hasAccessConfig } from "../_lib/accessKey.js";

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    model: env.OPENAI_MODEL || env.OPENAI_IMAGE_MODEL || "gpt-5.4",
    hasApiKey: Boolean(env.OPENAI_API_KEY),
    hasAccessConfig: hasAccessConfig(env),
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
