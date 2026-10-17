// عجلة قرعة بسيرفر - بدون أي مكتبات خارجية (Node 18+)
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(4).toString("hex");
const DEFAULT_NAMES = (process.env.NAMES ||
  "ورشه كليم|ورشه خشب ( مشربيه و خرط )|ورشه فخار|ورشه زجاج معشق|ورشه فضه")
  .split("|").map(s => s.trim()).filter(Boolean);
const SPIN_MS = 5600;

let state = { names: DEFAULT_NAMES.slice(), winners: [], spinning: false, v: 1 };
const clients = new Set();

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(event, data) { for (const c of clients) send(c, event, data); }
function pub() { return { names: state.names, winners: state.winners, spinning: state.spinning, v: state.v }; }

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", d => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function file(res, name) {
  fs.readFile(path.join(__dirname, "public", name), (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(buf);
  });
}
function authed(url) { return url.searchParams.get("key") === ADMIN_KEY; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/") return file(res, "index.html");

  if (req.method === "GET" && url.pathname === "/admin") {
    if (!authed(url)) { res.writeHead(403); return res.end("forbidden"); }
    return file(res, "admin.html");
  }

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 2000\n\n");
    send(res, "state", pub());
    clients.add(res);
    const ka = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  if (req.method === "POST" && url.pathname === "/spin") {
    if (state.spinning) return json(res, 409, { error: "busy" });
    if (!state.names.length) return json(res, 409, { error: "empty" });
    const pick = crypto.randomInt(state.names.length);
    const jit = crypto.randomInt(-1000, 1001) / 1000;
    const turns = 5 + crypto.randomInt(3);
    const names = state.names.slice();
    const winner = names[pick];
    state.spinning = true;
    broadcast("spin", { id: crypto.randomUUID(), names, pick, jit, turns, winner, ms: SPIN_MS - 400 });
    setTimeout(() => {
      state.names = state.names.filter((_, i) => i !== pick);
      state.winners.push(winner);
      state.spinning = false;
      state.v++;
      broadcast("state", pub());
    }, SPIN_MS);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/admin/set") {
    if (!authed(url)) return json(res, 403, { error: "forbidden" });
    if (state.spinning) return json(res, 409, { error: "busy" });
    const body = await readBody(req);
    const names = Array.isArray(body.names)
      ? body.names.map(s => String(s).trim()).filter(Boolean).slice(0, 40) : [];
    if (!names.length) return json(res, 400, { error: "no names" });
    state = { names, winners: [], spinning: false, v: state.v + 1 };
    broadcast("state", pub());
    return json(res, 200, { ok: true });
  }

  res.writeHead(404); res.end("not found");
});

server.listen(PORT, () => {
  console.log(`Wheel running on port ${PORT}`);
  console.log(`Admin page: /admin?key=${ADMIN_KEY}`);
});
