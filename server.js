// عجلة قرعة بسيرفر - بدون أي مكتبات خارجية (Node 18+)
const http = require("http");
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
const PAGES = {
  "index.html": "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>عجلة القرعة</title>\n<style>\n:root{--bg:#faf7f2;--fg:#1f1b16;--card:#fff;--line:#e5ded3;--acc:#d9480f;--mut:#7a7165}\n@media (prefers-color-scheme:dark){:root{--bg:#17140f;--fg:#f3ede3;--card:#221e17;--line:#3a3328;--acc:#ff8a4c;--mut:#a69d8f;color-scheme:dark}}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,\"Segoe UI\",Tahoma,sans-serif;display:flex;justify-content:center}\nmain{width:100%;max-width:480px;padding:16px;display:flex;flex-direction:column;gap:14px}\nh1{margin:4px 0;font-size:22px;text-align:center}\n.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}\n.wrap{position:relative;width:100%;max-width:340px;aspect-ratio:1;margin:0 auto}\ncanvas{width:100%;height:100%;display:block}\n.ptr{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:26px solid var(--acc);filter:drop-shadow(0 2px 2px rgba(0,0,0,.3));z-index:2}\nbutton{font:inherit;border:0;border-radius:10px;padding:12px 16px;cursor:pointer;background:var(--acc);color:#fff;font-weight:700;width:100%;margin-top:8px}\nbutton:disabled{opacity:.5;cursor:default}\n#res{text-align:center;font-size:20px;font-weight:700;min-height:30px;margin-top:6px}\nol{margin:6px 0 0;padding-inline-start:24px}\n.mut{color:var(--mut);font-size:13px}\n</style>\n</head>\n<body>\n<main>\n  <h1>🎡 عجلة القرعة</h1>\n  <div class=\"card\">\n    <div class=\"wrap\"><div class=\"ptr\"></div><canvas id=\"c\" width=\"680\" height=\"680\"></canvas></div>\n    <div id=\"res\"></div>\n    <button id=\"spin\" disabled>لف العجلة</button>\n    <div id=\"st\" class=\"mut\" style=\"text-align:center;margin-top:8px\">بيتصل بالسيرفر...</div>\n  </div>\n  <div class=\"card\">\n    <b>اللي خرجوا</b>\n    <ol id=\"win\"></ol>\n    <div id=\"none\" class=\"mut\">لسه محدش خرج</div>\n  </div>\n</main>\n<script>\n(function(){\nvar COLORS=[\"#e8590c\",\"#1c7ed6\",\"#2f9e44\",\"#ae3ec9\",\"#f08c00\",\"#0c8599\",\"#c2255c\",\"#5f3dc4\"];\nvar cv=document.getElementById(\"c\"),ctx=cv.getContext(\"2d\");\nvar $=function(i){return document.getElementById(i)};\nvar names=[],winners=[],rot=0,spinning=false,serverBusy=false,pending=null,connected=false;\nfunction wrap(t){\n  var w=t.split(\" \"),L=[],cur=\"\";\n  w.forEach(function(x){if(cur&&(cur+\" \"+x).length>12){L.push(cur);cur=x}else cur=cur?cur+\" \"+x:x});\n  if(cur)L.push(cur);return L.slice(0,3);\n}\nfunction draw(){\n  var W=cv.width,R=W/2-8,n=names.length;\n  ctx.clearRect(0,0,W,W);ctx.save();ctx.translate(W/2,W/2);\n  if(!n){ctx.fillStyle=\"#888\";ctx.font=\"bold 44px sans-serif\";ctx.textAlign=\"center\";ctx.fillText(\"خلصت \\ud83c\\udf89\",0,14);ctx.restore();return}\n  var a=2*Math.PI/n;\n  for(var i=0;i<n;i++){\n    var s=rot+i*a-Math.PI/2;\n    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,s,s+a);ctx.closePath();\n    ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();\n    ctx.strokeStyle=\"rgba(255,255,255,.85)\";ctx.lineWidth=3;ctx.stroke();\n    ctx.save();ctx.rotate(s+a/2);ctx.textAlign=\"right\";ctx.fillStyle=\"#fff\";ctx.textBaseline=\"middle\";\n    var fs=n>3?30:36,ls=fs+4,L=wrap(names[i]);\n    ctx.font=\"bold \"+fs+\"px sans-serif\";\n    L.forEach(function(line,j){ctx.fillText(line,R-22,(j-(L.length-1)/2)*ls)});\n    ctx.restore();\n  }\n  ctx.beginPath();ctx.arc(0,0,26,0,7);ctx.fillStyle=\"#fff\";ctx.fill();ctx.strokeStyle=\"#ccc\";ctx.lineWidth=3;ctx.stroke();\n  ctx.restore();\n}\nfunction ui(){\n  draw();\n  var o=$(\"win\");o.innerHTML=\"\";\n  winners.forEach(function(w){var l=document.createElement(\"li\");l.textContent=w;o.appendChild(l)});\n  $(\"none\").style.display=winners.length?\"none\":\"block\";\n  $(\"spin\").disabled=!connected||spinning||serverBusy||!names.length;\n  $(\"st\").textContent=!connected?\"بيتصل بالسيرفر...\":(names.length?(\"فاضل \"+names.length):\"\");\n}\nfunction applyState(s){\n  names=s.names.slice();winners=s.winners.slice();serverBusy=!!s.spinning;rot=0;ui();\n}\nfunction onState(s){\n  if(spinning){pending=s;return}\n  if(!s.winners.length)$(\"res\").textContent=\"\";\n  applyState(s);\n}\nfunction onSpin(m){\n  names=m.names.slice();serverBusy=true;spinning=true;$(\"res\").textContent=\"\";ui();\n  var n=names.length,a=2*Math.PI/n,TAU=2*Math.PI;\n  var target=-((m.pick+.5)*a)+m.jit*a*.7;\n  var d=(((target-rot)%TAU)+TAU)%TAU;\n  var r0=rot,r1=r0+m.turns*TAU+d,t0=performance.now(),dur=m.ms;\n  (function f(now){\n    var q=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-q,4);\n    rot=r0+(r1-r0)*e;draw();\n    if(q<1)requestAnimationFrame(f);else{\n      $(\"res\").textContent=\"\\ud83c\\udf89 \"+m.winner;\n      spinning=false;\n      if(pending){var p=pending;pending=null;applyState(p)}else ui();\n    }\n  })(t0);\n}\nvar es=new EventSource(\"/events\");\nes.addEventListener(\"open\",function(){connected=true;ui()});\nes.addEventListener(\"error\",function(){connected=false;ui()});\nes.addEventListener(\"state\",function(e){connected=true;onState(JSON.parse(e.data))});\nes.addEventListener(\"spin\",function(e){connected=true;onSpin(JSON.parse(e.data))});\n$(\"spin\").onclick=function(){\n  $(\"spin\").disabled=true;\n  fetch(\"/spin\",{method:\"POST\"}).then(function(r){if(!r.ok)ui()}).catch(ui);\n};\nui();\n})();\n</script>\n</body>\n</html>\n",
  "admin.html": "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>إدارة العجلة</title>\n<style>\nbody{font-family:system-ui,Tahoma,sans-serif;max-width:480px;margin:0 auto;padding:16px;background:#faf7f2;color:#1f1b16}\n@media (prefers-color-scheme:dark){body{background:#17140f;color:#f3ede3}}\ntextarea{width:100%;min-height:160px;font:inherit;padding:10px;border-radius:10px;border:1px solid #bbb;background:transparent;color:inherit}\nbutton{font:inherit;width:100%;margin-top:10px;padding:12px;border:0;border-radius:10px;background:#d9480f;color:#fff;font-weight:700;cursor:pointer}\n#m{margin-top:10px;font-weight:700}\n</style></head><body>\n<h2>إدارة العجلة</h2>\n<p>اكتب اسم في كل سطر. الضغط على الزرار بيرجّع القرعة من الأول عند كل المتصفحين.</p>\n<textarea id=\"ta\"></textarea>\n<button id=\"go\">حفظ وابدأ من جديد</button>\n<div id=\"m\"></div>\n<script>\nvar key=new URLSearchParams(location.search).get(\"key\");\nvar es=new EventSource(\"/events\");\nvar filled=false;\nes.addEventListener(\"state\",function(e){\n  if(filled)return;filled=true;\n  document.getElementById(\"ta\").value=JSON.parse(e.data).names.join(\"\\n\");\n});\ndocument.getElementById(\"go\").onclick=async function(){\n  var names=document.getElementById(\"ta\").value.split(\"\\n\");\n  var r=await fetch(\"/admin/set?key=\"+encodeURIComponent(key),{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({names:names})});\n  document.getElementById(\"m\").textContent=r.ok?\"تم ✅\":(r.status===409?\"العجلة بتلف دلوقتي، جرّب بعد ثواني\":\"حصل خطأ\");\n};\n</script></body></html>\n",
};
function file(res, name) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(PAGES[name]);
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
