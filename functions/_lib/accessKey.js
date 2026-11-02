async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hasAccessConfig(env) {
  return Boolean(env?.SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY);
}

function jsonError(message, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function lookupAccessKey(env, keyHash) {
  const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${baseUrl}/rest/v1/access_keys?key_hash=eq.${encodeURIComponent(keyHash)}&enabled=eq.true&select=id,name&limit=1`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to validate access key.");
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function touchLastUsed(env, id) {
  const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await fetch(`${baseUrl}/rest/v1/access_keys?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    });
  } catch {
    // Best-effort only; do not block generation.
  }
}

/**
 * Validate X-Access-Key against Supabase access_keys (sha256 hash, enabled=true).
 * Returns { ok: true, name } or { ok: false, response }.
 */
export async function requireAccessKey(request, env) {
  if (!hasAccessConfig(env)) {
    return {
      ok: false,
      response: jsonError("Access key validation is not configured on the server.", 500),
    };
  }

  const plaintext = (request.headers.get("X-Access-Key") || "").trim();
  if (!plaintext) {
    return {
      ok: false,
      response: jsonError("Access key is required. Provide X-Access-Key header."),
    };
  }

  try {
    const keyHash = await sha256Hex(plaintext);
    const row = await lookupAccessKey(env, keyHash);
    if (!row) {
      return {
        ok: false,
        response: jsonError("Invalid or disabled access key."),
      };
    }

    touchLastUsed(env, row.id);
    return { ok: true, name: row.name || null };
  } catch (error) {
    return {
      ok: false,
      response: jsonError(error?.message || "Failed to validate access key.", 502),
    };
  }
}

export { hasAccessConfig, sha256Hex };
