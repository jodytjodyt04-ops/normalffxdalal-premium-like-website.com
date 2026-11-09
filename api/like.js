import { passwordOk, getUsage, setUsage, today, pick, MAX_TOTAL, MAX_PER_DAY } from "./_lib.js";

// Set LIKE_KEY (service key) and SITE_PASSWORD in Vercel > Settings > Environment Variables.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!passwordOk(req.headers["x-access-key"])) {
    return res.status(401).json({ error: "Verification needed.", relock: true });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const uid = String(body.uid || "").trim();
  const region = String(body.region || "ind").trim().toLowerCase();

  if (!/^\d{5,15}$/.test(uid)) {
    return res.status(400).json({ error: "Enter a valid numeric UID (5 to 15 digits)." });
  }
  if (!["ind", "sg", "th", "vn", "pk", "bd", "tw", "me"].includes(region)) {
    return res.status(400).json({ error: "Invalid server." });
  }

  /* ---- fair-use limits: 1 per day, 2 in total, per UID ---- */
  const day = today();
  const usage = await getUsage(uid);

  if (usage.count >= MAX_TOTAL) {
    return res.status(429).json({
      error: "This UID has used all 2 likes. No more sends are available.",
      uses: usage.count,
      max: MAX_TOTAL,
    });
  }
  if (usage.last === day && usage.count >= MAX_PER_DAY) {
    return res.status(429).json({
      error: "Today's like for this UID is already used. Come back tomorrow.",
      uses: usage.count,
      max: MAX_TOTAL,
    });
  }

  /* ---- send ---- */
  const key = process.env.LIKE_KEY || "@RLX";
  const url =
    "https://rlxx-like.vercel.app/like" +
    `?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}&key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  const fail = (code, msg) => res.status(code).json({ error: msg, uses: usage.count, max: MAX_TOTAL });

  try {
    const upstream = await fetch(url, { signal: ctrl.signal });
    const text = await upstream.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }

    if (!upstream.ok || !data || typeof data !== "object" || data.error) {
      return fail(502, "Could not send likes right now. Check the UID and server, then try again.");
    }

    const added = pick(data, ["LikesGivenByAPI", "likes_given", "likes_added", "given", "added"]);
    const before = pick(data, ["LikesbeforeCommand", "likes_before", "before"]);
    const after = pick(data, ["LikesafterCommand", "likes_after", "after"]);
    const name = pick(data, ["PlayerNickname", "nickname", "name", "player"]);

    if (added !== null && Number(added) === 0) {
      return fail(409, "No likes were added this time. This was not counted. Try again later.");
    }

    const next = { count: usage.count + 1, last: day };
    await setUsage(uid, next);

    return res.status(200).json({
      ok: true,
      name: name ? String(name) : null,
      added: added !== null ? Number(added) : null,
      before: before !== null ? Number(before) : null,
      after: after !== null ? Number(after) : null,
      uses: next.count,
      max: MAX_TOTAL,
    });
  } catch (e) {
    return fail(504, e && e.name === "AbortError" ? "The server took too long. Try again." : "Could not send likes right now. Try again.");
  } finally {
    clearTimeout(timer);
  }
      }
      
