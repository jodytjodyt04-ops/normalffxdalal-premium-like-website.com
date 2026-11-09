import { passwordOk } from "./_lib.js";

export default async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (req.method !== "POST") {
res.setHeader("Allow", "POST");
return res.status(405).json({
ok: false,
error: "Method not allowed."
});
}

const password =
req.headers["x-access-key"] ||
req.body?.password ||
req.body?.key;

if (passwordOk(password)) {
return res.status(200).json({ ok: true });
}

await new Promise(resolve => setTimeout(resolve, 700));

return res.status(401).json({
ok: false,
error: "Wrong password."
});
}
