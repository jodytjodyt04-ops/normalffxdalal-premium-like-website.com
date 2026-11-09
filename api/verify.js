import { passwordOk } from "./_lib.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  if (passwordOk(req.headers["x-access-key"])) {
    return res.status(200).json({ ok: true });
  }
  await new Promise((r) => setTimeout(r, 700)); // slows down guessing
  return res.status(401).json({ ok: false, error: "Wrong password." });
}
