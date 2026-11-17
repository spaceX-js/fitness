// Fitness – Cloudflare Worker
// Bindungen: DB (D1-Datenbank „fitness-db“) und ASSETS (Ordner public/).
// Sicherheit: Passwort (PBKDF2) + Zwei-Faktor-Code (TOTP), Sitzungen nur als Hash in der Datenbank,
// strenge Content-Security-Policy, Sperre nach Fehlversuchen. Ohne Anmeldung ist außer Login, Icon und CSS nichts erreichbar.
import { pbkdf2, sha256, newTotpSecret, checkTotp, otpauthUrl, randomHex, randomCode, safeEqual } from "./auth.js";

const COOKIE = "__Host-fit";
const SESSION_DAYS = 30;
const MAX_FAILS_IP = 5, MAX_FAILS_ALL = 30;          // pro 15 Minuten je Adresse / pro Stunde insgesamt
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOG_ID_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9]{1,20}$/;
const PUBLIC = new Set(["/style.css", "/icon.png", "/icon-512.png", "/manifest.webmanifest"]);

export default {
  async fetch(request, env) {
    try {
      if (!env.DB) return text("Einrichtung unvollständig: Die Datenbank-Verbindung „DB“ fehlt.", 500);
      const url = new URL(request.url);
      const path = url.pathname;
      if (PUBLIC.has(path)) return withHeaders(await env.ASSETS.fetch(request), { "Cache-Control": "public, max-age=3600", ...SEC });

      // Formulare und API nur von der eigenen Seite (Schutz gegen fremde Seiten, die im Namen des Browsers Anfragen stellen)
      if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("Origin"), site = request.headers.get("Sec-Fetch-Site");
        if ((origin && origin !== "null" && origin !== url.origin) || site === "cross-site" || site === "same-site") return json({ error: "Fremde Herkunft." }, 403);
      }

      const settings = await getSettings(env);
      if (!settings.pw_hash) return await setupFlow(request, env, settings, url);

      if (path === "/login" && request.method === "POST") return await login(request, env, settings);
      if (path === "/logout" && request.method === "POST") {
        const tok = readCookie(request);
        if (tok) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(tok)).run();
        return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": clearCookie(), ...SEC } });
      }

      const session = await currentSession(request, env);
      if (path.startsWith("/api/")) {
        if (!session) return json({ error: "Nicht angemeldet." }, 401);
        if (request.method === "POST" && request.headers.get("X-Fit") !== "1") return json({ error: "Ungültige Anfrage." }, 403);
        return await api(request, env, settings, url, session);
      }
      if (!session) {
        if (path === "/" || path === "/index.html") return html(page("Anmelden", loginForm(url.searchParams.get("fehler"))));
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
      const res = await env.ASSETS.fetch(path === "/index.html" ? new Request(new URL("/", url), request) : request);
      return withHeaders(res, { "Cache-Control": "no-cache", ...SEC });
    } catch (e) {
      return json({ error: "Serverfehler." }, 500);   // keine Details nach außen
    }
  }
};

/* ---------- API ---------- */
async function api(request, env, settings, url, session) {
  const path = url.pathname, method = request.method;

  if (path === "/api/state" && method === "GET") {
    const since = isDate(url.searchParams.get("since")) ? url.searchParams.get("since") : "0000-00-00";
    const { results } = await env.DB.prepare("SELECT id, date, kind, status, data, updated_at FROM logs WHERE date >= ? ORDER BY date").bind(since).all();
    return json({
      start: settings.plan_start ? mondayOf(settings.plan_start) : mondayOf(new Date().toISOString().slice(0, 10)),
      overrides: parseObj(settings.overrides), status: parseObj(settings.status), decisions: parseObj(settings.decisions),
      logs: results.map(r => ({ id: r.id, date: r.date, kind: r.kind, status: r.status, data: parseObj(r.data), updatedAt: r.updated_at })),
      sessions: Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?").bind(new Date().toISOString()).first()).n)
    });
  }

  if (path === "/api/log" && method === "POST") {
    const b = await readJson(request, 32000);
    const it = checkLog(b);
    if (!it) return json({ error: "Ungültiger Eintrag." }, 400);
    await env.DB.prepare(`INSERT INTO logs (id, date, kind, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET date = excluded.date, kind = excluded.kind, status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`)
      .bind(it.id, it.date, it.kind, it.status, JSON.stringify(it.data), new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (path === "/api/log/delete" && method === "POST") {
    const b = await readJson(request, 1000);
    if (!b || typeof b.id !== "string" || !LOG_ID_RE.test(b.id)) return json({ error: "Ungültige Anfrage." }, 400);
    await env.DB.prepare("DELETE FROM logs WHERE id = ?").bind(b.id).run();
    return json({ ok: true });
  }

  // Einstellungen: Planstart, Anpassungen, Status (krank / Einschränkungen), Entscheidungen zu Empfehlungen
  if (path === "/api/settings" && method === "POST") {
    const b = await readJson(request, 64000);
    if (!b || typeof b !== "object") return json({ error: "Ungültige Anfrage." }, 400);
    const ops = [];
    if ("start" in b) { if (!isDate(b.start)) return json({ error: "Ungültiges Datum." }, 400); ops.push(setSetting(env, "plan_start", mondayOf(b.start))); }
    for (const k of ["overrides", "status", "decisions"]) {
      if (!(k in b)) continue;
      const clean = cleanJson(b[k], 0);
      if (!clean || typeof clean !== "object" || Array.isArray(clean)) return json({ error: "Ungültige Daten." }, 400);
      const s = JSON.stringify(clean);
      if (s.length > 30000) return json({ error: "Zu viele Daten." }, 400);
      ops.push(setSetting(env, k, s));
    }
    if (!ops.length) return json({ error: "Nichts zu speichern." }, 400);
    await env.DB.batch(ops);
    return json({ ok: true });
  }

  if (path === "/api/export" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, date, kind, status, data, updated_at FROM logs ORDER BY date").all();
    const out = { exportedAt: new Date().toISOString(), start: settings.plan_start || null, overrides: parseObj(settings.overrides), status: parseObj(settings.status),
      logs: results.map(r => ({ ...r, data: parseObj(r.data) })) };
    return new Response(JSON.stringify(out, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="fitness-export-${out.exportedAt.slice(0, 10)}.json"`, "Cache-Control": "no-store", ...SEC } });
  }

  if (path === "/api/logout-all" && method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE id <> ?").bind(session.id).run();
    return json({ ok: true });
  }

  if (path === "/api/password" && method === "POST") {
    const b = await readJson(request, 2000);
    if (!b || typeof b.new !== "string" || b.new.length < 12) return json({ error: "Das neue Passwort braucht mindestens 12 Zeichen." }, 400);
    if (!(await checkPassword(String(b.old || ""), settings))) { await sleep(1000); return json({ error: "Das aktuelle Passwort stimmt nicht." }, 400); }
    const salt = randomHex(16);
    await env.DB.batch([setSetting(env, "pw_salt", salt), setSetting(env, "pw_hash", await pbkdf2(b.new, salt)),
      env.DB.prepare("DELETE FROM sessions WHERE id <> ?").bind(session.id)]);
    return json({ ok: true });
  }

  return json({ error: "Nicht gefunden." }, 404);
}

/* ---------- Prüfen ---------- */
function isDate(v) { return typeof v === "string" && DATE_RE.test(v) && !isNaN(Date.parse(v + "T00:00:00Z")); }
export function checkLog(b) {
  if (!b || typeof b !== "object" || typeof b.id !== "string" || !LOG_ID_RE.test(b.id) || !isDate(b.date) || !b.id.startsWith(b.date)) return null;
  if (!["strength", "run", "recovery", "mobility", "other"].includes(b.kind)) return null;
  if (!["done", "partial", "skipped"].includes(b.status)) return null;
  const data = cleanJson(b.data || {}, 0);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return { id: b.id, date: b.date, kind: b.kind, status: b.status, data };
}
// Erlaubt nur einfache JSON-Werte (Text, Zahl, ja/nein, Listen, Objekte), begrenzt Tiefe und Längen.
export function cleanJson(v, depth) {
  if (depth > 6) return undefined;
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") return v.slice(0, 500);
  if (Array.isArray(v)) return v.slice(0, 200).map(x => cleanJson(x, depth + 1)).filter(x => x !== undefined);
  if (typeof v === "object") {
    const o = {}; let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (n++ >= 200 || !/^[A-Za-z0-9_-]{1,40}$/.test(k)) continue;
      const c = cleanJson(x, depth + 1); if (c !== undefined) o[k] = c;
    }
    return o;
  }
  return undefined;
}
function parseObj(s) { try { const o = JSON.parse(s || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
export function mondayOf(iso) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

/* ---------- Einrichtung (einmalig) ---------- */
// Freigeschaltet wird sie über einen Einrichtungscode, dessen Hash in settings.setup_hash steht (von Claude in D1 eingetragen).
async function setupFlow(request, env, settings, url) {
  const path = url.pathname;
  if (!settings.setup_hash) return html(page("Einrichtung", `<h1>Fitness</h1><p>Die Einrichtung ist noch nicht freigeschaltet.</p>`));
  const ip = ipOf(request);
  if (request.method === "POST" && (path === "/setup" || path === "/setup/confirm")) {
    if (await tooManyFails(env, ip)) return html(page("Einrichtung", setupForm("Zu viele Versuche. Bitte in 15 Minuten nochmal probieren.")));
    const form = await request.formData();
    const code = String(form.get("einrichtungscode") || "").trim().toUpperCase();
    if (!safeEqual(await sha256(code), settings.setup_hash)) { await fail(env, ip); return html(page("Einrichtung", setupForm("Der Einrichtungscode stimmt nicht."))); }

    if (path === "/setup") {
      const pw = String(form.get("passwort") || ""), pw2 = String(form.get("passwort2") || "");
      if (pw.length < 12) return html(page("Einrichtung", setupForm("Das Passwort braucht mindestens 12 Zeichen.")));
      if (pw !== pw2) return html(page("Einrichtung", setupForm("Die beiden Passwörter sind verschieden.")));
      const salt = randomHex(16), secret = newTotpSecret();
      await env.DB.batch([setSetting(env, "pending_salt", salt), setSetting(env, "pending_hash", await pbkdf2(pw, salt)), setSetting(env, "pending_totp", secret)]);
      return html(page("Zwei-Faktor einrichten", totpForm(code, secret, "")));
    }
    // Schritt 2: Code aus der Authenticator-App bestätigen
    const secret = settings.pending_totp;
    if (!secret) return html(page("Einrichtung", setupForm("Bitte noch einmal von vorn beginnen.")));
    const step = await checkTotp(secret, String(form.get("code") || "").trim());
    if (step < 0) { await fail(env, ip); return html(page("Zwei-Faktor einrichten", totpForm(code, secret, "Der Code passt nicht. Uhrzeit am Handy prüfen und den aktuellen Code eingeben."))); }
    const codes = Array.from({ length: 8 }, randomCode);
    const tok = randomHex(32);
    await env.DB.batch([
      setSetting(env, "pw_salt", settings.pending_salt), setSetting(env, "pw_hash", settings.pending_hash),
      setSetting(env, "totp_secret", secret), setSetting(env, "totp_last", String(step)),
      setSetting(env, "recovery", JSON.stringify(await Promise.all(codes.map(c => sha256(c))))),
      env.DB.prepare("DELETE FROM settings WHERE key IN ('pending_salt', 'pending_hash', 'pending_totp', 'setup_hash')"),
      await newSession(env, tok, request)
    ]);
    return html(page("Fertig", `<h1>Fertig eingerichtet</h1>
<p>Bitte diese <b>Notfall-Codes</b> sicher aufheben (z. B. in einer Notiz mit Code-Sperre oder ausgedruckt). Jeder Code funktioniert einmal statt des Zwei-Faktor-Codes, falls du dein Handy verlierst.</p>
<pre class="codes">${codes.join("\n")}</pre><a class="btn" href="/">Zur App</a>`), { "Set-Cookie": sessionCookie(tok) });
  }
  return html(page("Einrichtung", setupForm("")));
}

/* ---------- Anmeldung ---------- */
async function login(request, env, settings) {
  const ip = ipOf(request);
  if (await tooManyFails(env, ip)) return redirect("/?fehler=gesperrt");
  const form = await request.formData();
  const pw = String(form.get("passwort") || ""), code = String(form.get("code") || "").replace(/\s/g, "").toUpperCase();
  let ok = await checkPassword(pw, settings), extra = null;
  if (ok) {
    if (/^\d{6}$/.test(code)) {
      const step = await checkTotp(settings.totp_secret, code, Number(settings.totp_last || -1));
      if (step < 0) ok = false; else extra = setSetting(env, "totp_last", String(step));
    } else {
      // Notfall-Code (einmalig)
      const list = JSON.parse(settings.recovery || "[]"), h = await sha256(code.replace(/^(.{4})-?(.{4})-?(.{4})$/, "$1-$2-$3"));
      const i = list.findIndex(x => safeEqual(x, h));
      if (i < 0) ok = false; else { list.splice(i, 1); extra = setSetting(env, "recovery", JSON.stringify(list)); }
    }
  }
  if (!ok) { await fail(env, ip); await sleep(700); return redirect("/?fehler=falsch"); }
  const tok = randomHex(32);
  await env.DB.batch([extra, await newSession(env, tok, request),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()),
    env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip)].filter(Boolean));
  return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": sessionCookie(tok), ...SEC } });
}
async function tooManyFails(env, ip) {
  const t15 = new Date(Date.now() - 15 * 60000).toISOString(), t60 = new Date(Date.now() - 3600000).toISOString();
  const a = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ts > ?").bind(ip, t15).first();
  const b = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ts > ?").bind(t60).first();
  return (a && a.n >= MAX_FAILS_IP) || (b && b.n >= MAX_FAILS_ALL);
}
async function fail(env, ip) {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO login_attempts (ip, ts) VALUES (?, ?)").bind(ip, new Date().toISOString()),
    env.DB.prepare("DELETE FROM login_attempts WHERE ts < ?").bind(new Date(Date.now() - 86400000).toISOString())
  ]);
}
async function newSession(env, tok, request) {
  const now = Date.now();
  return env.DB.prepare("INSERT INTO sessions (id, created_at, expires_at, agent) VALUES (?, ?, ?, ?)")
    .bind(await sha256(tok), new Date(now).toISOString(), new Date(now + SESSION_DAYS * 86400000).toISOString(), String(request.headers.get("User-Agent") || "").slice(0, 120));
}
async function currentSession(request, env) {
  const tok = readCookie(request);
  if (!tok) return null;
  const id = await sha256(tok);
  const row = await env.DB.prepare("SELECT id, expires_at FROM sessions WHERE id = ?").bind(id).first();
  if (!row || row.expires_at < new Date().toISOString()) return null;
  return row;
}
function readCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-fit=([a-f0-9]{64})/);
  return m ? m[1] : null;
}
function sessionCookie(tok) { return `${COOKIE}=${tok}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`; }
function clearCookie() { return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }
async function checkPassword(pw, s) {
  if (!s.pw_salt || !s.pw_hash) return false;
  return safeEqual(await pbkdf2(pw, s.pw_salt), s.pw_hash);
}
function ipOf(request) { return request.headers.get("CF-Connecting-IP") || "unbekannt"; }

/* ---------- Datenbank ---------- */
async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = {}; for (const r of results) s[r.key] = r.value; return s;
}
function setSetting(env, k, v) { return env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v); }

/* ---------- Antworten ---------- */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'";
const SEC = {
  "Content-Security-Policy": CSP, "Strict-Transport-Security": "max-age=31536000; includeSubDomains", "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "Cross-Origin-Opener-Policy": "same-origin"
};
function withHeaders(res, h) { const r = new Response(res.body, res); for (const [k, v] of Object.entries(h)) r.headers.set(k, v); return r; }
function html(body, extra = {}) { return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra } }); }
function json(o, status = 200, extra = {}) { return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...extra } }); }
function text(t, status = 200) { return new Response(t, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
function redirect(to) { return new Response(null, { status: 303, headers: { Location: to, ...SEC } }); }
async function readJson(req, max) {
  try { const t = await req.text(); if (t.length > max) return null; return JSON.parse(t); } catch (e) { return null; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function page(title, body) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Fitness"><meta name="robots" content="noindex, nofollow">
<link rel="apple-touch-icon" href="/icon.png"><link rel="icon" href="/icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/style.css"><title>Fitness – ${esc(title)}</title></head>
<body class="auth"><main class="authbox"><img src="/icon.png" alt="" class="logo">${body}</main></body></html>`;
}
function loginForm(fehler) {
  const msg = fehler === "falsch" ? "Passwort oder Code stimmt nicht." : fehler === "gesperrt" ? "Zu viele Versuche. Bitte in 15 Minuten nochmal probieren." : "";
  return `<h1>Fitness</h1><p>Passwort und Code aus der Authenticator-App.</p>${msg ? `<div class="err">${msg}</div>` : ""}
<form method="post" action="/login">
<input type="password" name="passwort" autocomplete="current-password" placeholder="Passwort" required autofocus>
<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="6-stelliger Code (oder Notfall-Code)" required maxlength="14">
<button type="submit">Anmelden</button></form>`;
}
function setupForm(msg) {
  return `<h1>Fitness einrichten</h1><p>Einmalig: Einrichtungscode eingeben und ein eigenes Passwort festlegen (mindestens 12 Zeichen).</p>${msg ? `<div class="err">${esc(msg)}</div>` : ""}
<form method="post" action="/setup">
<input name="einrichtungscode" placeholder="Einrichtungscode" autocomplete="off" required autocapitalize="characters">
<input type="password" name="passwort" autocomplete="new-password" placeholder="Neues Passwort" required minlength="12">
<input type="password" name="passwort2" autocomplete="new-password" placeholder="Passwort wiederholen" required minlength="12">
<button type="submit">Weiter</button></form>`;
}
function totpForm(code, secret, msg) {
  const grouped = secret.match(/.{1,4}/g).join(" ");
  return `<h1>Zwei-Faktor-Code</h1>
<p>Damit niemand mit deinem Passwort allein hineinkommt. Auf dem iPhone: Link antippen – er öffnet „Passwörter“ (oder deine Authenticator-App).</p>
<a class="btn alt" href="${esc(otpauthUrl(secret))}">Code-Geber hinzufügen</a>
<p class="small">Oder den Schlüssel von Hand eintragen:<br><code class="key">${esc(grouped)}</code></p>
${msg ? `<div class="err">${esc(msg)}</div>` : ""}
<form method="post" action="/setup/confirm">
<input type="hidden" name="einrichtungscode" value="${esc(code)}">
<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="Angezeigter 6-stelliger Code" required maxlength="6">
<button type="submit">Bestätigen</button></form>`;
}
