export const MAX_TOTAL = 2; // lifetime sends allowed per UID
export const MAX_PER_DAY = 1; // sends allowed per UID per day

/* ---------- day helper (India time) ---------- */
export function today() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/* ---------- usage store ----------
   Uses Upstash / Vercel KV REST when these env vars exist:
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL + KV_REST_API_TOKEN)
   Without them it falls back to server memory, which can reset at any time. */
const mem = globalThis.__nf_mem || (globalThis.__nf_mem = new Map());

async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  return j.result ?? null;
}

export async function getUsage(uid) {
  const key = `nf:${uid}`;
  const raw = await redis(["GET", key]);
  if (raw === undefined) return mem.get(key) || { count: 0, last: "" };
  try {
    return raw ? JSON.parse(raw) : { count: 0, last: "" };
  } catch {
    return { count: 0, last: "" };
  }
}

export async function setUsage(uid, rec) {
  const key = `nf:${uid}`;
  const out = await redis(["SET", key, JSON.stringify(rec)]);
  if (out === undefined) mem.set(key, rec);
}

/* ---------- response cleaning: only whitelisted fields leave the server ---------- */
export function pick(obj, names) {
  if (!obj || typeof obj !== "object") return null;
  for (const n of names) {
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === n.toLowerCase() && obj[k] !== null && obj[k] !== undefined && obj[k] !== "") {
        return obj[k];
      }
    }
  }
  return null;
}
