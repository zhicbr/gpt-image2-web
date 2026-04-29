export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    model: env.OPENAI_MODEL || "gpt-5.4",
    hasApiKey: Boolean(env.OPENAI_API_KEY)
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}