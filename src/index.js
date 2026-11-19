// Fitness – Cloudflare Worker
// Bindungen: DB (D1-Datenbank „fitness-db“) und ASSETS (Ordner public/).
// Sicherheit: Passwort (PBKDF2) + Zwei-Faktor-Code (TOTP), Sitzungen nur als Hash in der Datenbank,
// strenge Content-Security-Policy, Sperre nach Fehlversuchen. Ohne Anmeldung ist außer Login, Icon und CSS nichts erreichbar.
import { pbkdf2, sha256, newTotpSecret, checkTotp, otpauthUrl, randomHex, randomCode, safeEqual } from "./auth.js";
import { DEFAULT_PLAN, validatePlan, diffPlans } from "../public/plan.js";
import { METRICS } from "../public/health.js";

const COOKIE = "__Host-fit";
const VERSION = "0.5.1";   // ändert die Adressen von CSS und Skript bei jedem Update → kein alter Zwischenspeicher
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
      // CSS immer frisch prüfen (sonst zeigt das iPhone nach einem Update bis zu einer Stunde die alte Gestaltung); Icons dürfen zwischengespeichert werden
      if (PUBLIC.has(path)) return withHeaders(await env.ASSETS.fetch(request), { "Cache-Control": path === "/style.css" || path === "/manifest.webmanifest" ? "no-cache" : "public, max-age=86400", ...SEC });

      // Formulare und API nur von der eigenen Seite (Schutz gegen fremde Seiten, die im Namen des Browsers Anfragen stellen)
      if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("Origin"), site = request.headers.get("Sec-Fetch-Site");
        if ((origin && origin !== "null" && origin !== url.origin) || site === "cross-site" || site === "same-site") return json({ error: "Fremde Herkunft." }, 403);
      }

      const settings = await getSettings(env);
      // Apple-Health-Import vom Kurzbefehl: eigener Schlüssel, darf nur schreiben
      if (path === "/api/import" && request.method === "POST") return await importHealth(request, env, settings);
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
      if ((path === "/" || path === "/index.html") && res.ok) {
        const html0 = (await res.text()).replaceAll("__V__", VERSION);
        return new Response(html0, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ...SEC } });
      }
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
    const plan = await activePlan(env, settings);
    const { results } = await env.DB.prepare("SELECT id, date, kind, status, data, updated_at FROM logs WHERE date >= ? ORDER BY date").bind(since).all();
    const plans = (await env.DB.prepare("SELECT id, family, name, version, status, changes, note, start, created_at, applied_at, archived_at FROM plans WHERE status <> 'discarded' ORDER BY id DESC").all()).results
      .map(p => ({ id: p.id, family: p.family, name: p.name, version: p.version, status: p.status, changes: parseArr(p.changes), note: p.note || "", start: p.start,
        createdAt: p.created_at, appliedAt: p.applied_at, archivedAt: p.archived_at }));
    return json({
      start: plan.start, plan: planOut(plan), plans, health: await healthData(env, settings, 40),
      overrides: parseObj(settings.overrides), status: parseObj(settings.status), decisions: parseObj(settings.decisions), planner: parseObj(settings.planner),
      logs: results.map(r => ({ id: r.id, date: r.date, kind: r.kind, status: r.status, data: parseObj(r.data), updatedAt: r.updated_at })),
      sessions: Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?").bind(new Date().toISOString()).first()).n)
    });
  }

  /* --- Pläne: Versionen, Archiv, Entwürfe --- */
  if (path === "/api/plan" && method === "GET") {
    const id = Number(url.searchParams.get("id"));
    const row = Number.isInteger(id) ? await env.DB.prepare("SELECT * FROM plans WHERE id = ?").bind(id).first() : null;
    if (!row) return json({ error: "Plan nicht gefunden." }, 404);
    return json(planOut(row));
  }
  if (path === "/api/plan/save" && method === "POST") {      // Änderungen am aktiven Plan → neue Version
    const b = await readJson(request, 120000);
    const cur = await activePlan(env, settings);
    const v = validatePlan(b && b.data);
    if (v.error) return json({ error: v.error }, 400);
    const changes = diffPlans(parseObj(cur.data), v.plan);
    if (!changes.length) return json({ error: "Keine Änderungen." }, 400);
    const row = await newVersion(env, cur, v.plan, changes, typeof b.note === "string" ? b.note.slice(0, 200) : "");
    return json({ ok: true, plan: planOut(row) });
  }
  if (path === "/api/plan/restore" && method === "POST") {   // ältere Version wieder aktiv machen (als neue Version)
    const b = await readJson(request, 1000);
    const cur = await activePlan(env, settings);
    const old = await env.DB.prepare("SELECT * FROM plans WHERE id = ? AND family = ?").bind(Number(b && b.id), cur.family).first();
    if (!old) return json({ error: "Version nicht gefunden." }, 404);
    const v = validatePlan(parseObj(old.data));
    if (v.error) return json({ error: v.error }, 400);
    const changes = ["Wiederhergestellt aus Version " + old.version, ...diffPlans(parseObj(cur.data), v.plan)];
    const row = await newVersion(env, cur, v.plan, changes, "");
    return json({ ok: true, plan: planOut(row) });
  }
  if (path === "/api/plan/apply" && method === "POST") {     // Entwurf oder archivierten Plan anwenden; aktueller Plan → Archiv
    const b = await readJson(request, 1000);
    if (!b || !isDate(b.start)) return json({ error: "Bitte ein Startdatum wählen." }, 400);
    const row = await env.DB.prepare("SELECT * FROM plans WHERE id = ? AND status IN ('draft', 'archived')").bind(Number(b.id)).first();
    if (!row) return json({ error: "Plan nicht gefunden." }, 404);
    const v = validatePlan(parseObj(row.data));
    if (v.error) return json({ error: "Der Plan ist fehlerhaft: " + v.error }, 400);
    const cur = await activePlan(env, settings);
    const now = new Date().toISOString(), start = mondayOf(b.start), ov = parseObj(settings.overrides);
    delete ov.deload;
    await env.DB.batch([
      env.DB.prepare("UPDATE plans SET status = 'archived', archived_at = ? WHERE id = ?").bind(now, cur.id),
      env.DB.prepare("UPDATE plans SET status = 'active', start = ?, applied_at = ?, archived_at = NULL, data = ? WHERE id = ?").bind(start, now, JSON.stringify(v.plan), row.id),
      setSetting(env, "plan_start", start), setSetting(env, "overrides", JSON.stringify(ov))
    ]);
    return json({ ok: true });
  }
  if (path === "/api/plan/discard" && method === "POST") {
    const b = await readJson(request, 1000);
    await env.DB.prepare("UPDATE plans SET status = 'discarded' WHERE id = ? AND status = 'draft'").bind(Number(b && b.id)).run();
    return json({ ok: true });
  }
  if (path === "/api/planner" && method === "POST") {        // Fragebogen für einen neuen Plan
    const b = await readJson(request, 20000);
    const answers = cleanJson(b && b.answers, 0);
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return json({ error: "Ungültige Angaben." }, 400);
    await env.DB.batch([setSetting(env, "planner", JSON.stringify({ answers, at: new Date().toISOString(), status: "offen" }))]);
    return json({ ok: true });
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
    if ("start" in b) { if (!isDate(b.start)) return json({ error: "Ungültiges Datum." }, 400);
      const cur = await activePlan(env, settings);
      ops.push(setSetting(env, "plan_start", mondayOf(b.start)), env.DB.prepare("UPDATE plans SET start = ? WHERE id = ?").bind(mondayOf(b.start), cur.id)); }
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

  /* --- Apple Health --- */
  if (path === "/api/health" && method === "GET") {
    const days = Math.min(730, Math.max(7, Number(url.searchParams.get("days")) || 120));
    return json(await healthData(env, settings, days));
  }
  if (path === "/api/health/raw" && method === "GET") {        // älteste noch nicht ausgewertete Übertragung
    const first = await env.DB.prepare("SELECT batch, received_at FROM health_raw ORDER BY id LIMIT 1").first();
    if (!first) return json({ batch: null });
    const { results } = await env.DB.prepare("SELECT data FROM health_raw WHERE batch = ? ORDER BY part").bind(first.batch).all();
    const left = (await env.DB.prepare("SELECT COUNT(DISTINCT batch) AS n FROM health_raw").first()).n;
    return json({ batch: first.batch, receivedAt: first.received_at, data: results.map(r => r.data).join(""), left });
  }
  if (path === "/api/health/apply" && method === "POST") {      // Ergebnis der Auswertung aus dem Browser speichern
    const b = await readJson(request, 2000000);
    if (!b || (b.batch !== null && (typeof b.batch !== "string" || !/^[a-f0-9]{16}$/.test(b.batch)))) return json({ error: "Ungültige Anfrage." }, 400);
    const daily = Array.isArray(b.daily) ? b.daily.slice(0, 5000) : [], wos = Array.isArray(b.workouts) ? b.workouts.slice(0, 500) : [];
    const now = new Date().toISOString(), ops = [], f = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
    for (const r of daily) if (r && isDate(r.date) && METRICS[r.metric] && Number.isFinite(r.value))
      ops.push(env.DB.prepare("INSERT INTO health_daily (date, metric, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(date, metric) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(r.date, r.metric, r.value, now));
    for (const x of wos) if (x && typeof x.id === "string" && x.id.length < 40 && isDate(x.date))
      ops.push(env.DB.prepare(`INSERT INTO workouts (id, date, start, end, kind, run, min, km, kcal, hr_avg, hr_max, speed, power, stride, gct, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET end = excluded.end, kind = excluded.kind, run = excluded.run, min = excluded.min,
        km = COALESCE(excluded.km, workouts.km), kcal = COALESCE(excluded.kcal, workouts.kcal), hr_avg = COALESCE(excluded.hr_avg, workouts.hr_avg), hr_max = COALESCE(excluded.hr_max, workouts.hr_max),
        speed = COALESCE(excluded.speed, workouts.speed), power = COALESCE(excluded.power, workouts.power), stride = COALESCE(excluded.stride, workouts.stride), gct = COALESCE(excluded.gct, workouts.gct), updated_at = excluded.updated_at`)
        .bind(x.id, x.date, String(x.start || "").slice(0, 30), String(x.end || "").slice(0, 30), String(x.kind || "Training").slice(0, 60), x.run ? 1 : 0, f(x.min), f(x.km), f(x.kcal), f(x.hr_avg), f(x.hr_max), f(x.speed), f(x.power), f(x.stride), f(x.gct), String(x.source || "").slice(0, 60), now));
    if (b.batch) ops.push(env.DB.prepare("DELETE FROM health_raw WHERE batch = ?").bind(b.batch));
    for (let k = 0; k < ops.length; k += 80) if (ops.length) await env.DB.batch(ops.slice(k, k + 80));
    const left = (await env.DB.prepare("SELECT COUNT(*) AS n FROM health_raw").first()).n;
    if (b.batch) { const s = cleanJson(b.summary || {}, 0) || {}; await saveImportLast(env, { ...s, at: now, ok: true, pending: left > 0 }); }
    return json({ ok: true, left });
  }
  if (path === "/api/health/key" && method === "POST") {      // neuen Import-Schlüssel erzeugen (wird nur einmal angezeigt)
    const key = "fit_" + randomHex(24);
    await env.DB.batch([setSetting(env, "import_hash", await sha256(key)), setSetting(env, "import_created", new Date().toISOString())]);
    return json({ ok: true, key, url: url.origin + "/api/import" });
  }
  if (path === "/api/health/revoke" && method === "POST") {
    await env.DB.prepare("DELETE FROM settings WHERE key IN ('import_hash', 'import_created')").run();
    return json({ ok: true });
  }
  if (path === "/api/health/delete" && method === "POST") {
    await env.DB.batch([env.DB.prepare("DELETE FROM health_daily"), env.DB.prepare("DELETE FROM workouts"), env.DB.prepare("DELETE FROM health_raw"), env.DB.prepare("DELETE FROM workout_marks"), env.DB.prepare("DELETE FROM settings WHERE key = 'import_last'")]);
    return json({ ok: true });
  }

  if (path === "/api/export" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT id, date, kind, status, data, updated_at FROM logs ORDER BY date").all();
    const plans = (await env.DB.prepare("SELECT * FROM plans WHERE status <> 'discarded' ORDER BY id").all()).results.map(planOut);
    const health = { daily: (await env.DB.prepare("SELECT date, metric, value FROM health_daily ORDER BY date").all()).results,
      workouts: (await env.DB.prepare("SELECT * FROM workouts ORDER BY start").all()).results };
    const out = { exportedAt: new Date().toISOString(), start: settings.plan_start || null, plans, health, overrides: parseObj(settings.overrides), status: parseObj(settings.status),
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
/* ---------- Apple Health ---------- */
async function importHealth(request, env, settings) {
  const ip = "import:" + ipOf(request);   // eigener Zähler – ein falsch eingerichteter Kurzbefehl sperrt nicht die Anmeldung
  if (await tooManyFails(env, ip)) return json({ error: "Zu viele Versuche." }, 429);
  const m = (request.headers.get("Authorization") || "").trim().match(/^(?:Bearer\s+)?(fit_[a-f0-9]{48})$/i);   // „Bearer“ davor ist optional
  if (!m || !settings.import_hash || !safeEqual(await sha256(m[1]), settings.import_hash)) { await fail(env, ip); return json({ error: "Schlüssel ungültig." }, 401); }
  // Nur speichern, nicht auswerten: Die Auswertung vieler Messungen braucht mehr Rechenzeit, als der kostenlose Tarif pro Anfrage erlaubt.
  // Ausgewertet wird beim nächsten Öffnen der App im Browser; dort werden nur die Ergebnisse zurückgeschickt.
  const t = await request.text();
  if (!t.trim()) return json({ error: "Keine Daten." }, 400);
  // Kurze Meldung der Apple-Watch-Automation: {"training": "Krafttraining"} – Ende = jetzt
  if (t.length < 2000) {
    let b = null; try { b = JSON.parse(t); } catch (e) {}
    if (b && typeof b === "object" && typeof b.training === "string" && b.training.trim()) {
      const kind = b.training.replace(/[^\p{L}\p{N} \-()\/]/gu, "").trim().slice(0, 60) || "Training";
      await env.DB.prepare("INSERT INTO workout_marks (id, kind, end_at) VALUES (?, ?, ?)").bind(randomHex(8), kind, new Date().toISOString()).run();
      return json({ ok: true, training: kind, hinweis: "Training gespeichert." });
    }
  }
  if (t.length > 12000000) return json({ error: "Zu viele Daten auf einmal – bitte weniger Tage übertragen." }, 413);
  const batch = randomHex(8), now = new Date().toISOString(), CH = 400000, parts = Math.ceil(t.length / CH), ops = [];
  for (let p = 0; p < parts; p++) ops.push(env.DB.prepare("INSERT INTO health_raw (batch, part, parts, received_at, data) VALUES (?, ?, ?, ?, ?)").bind(batch, p, parts, now, t.slice(p * CH, (p + 1) * CH)));
  for (let k = 0; k < ops.length; k += 10) await env.DB.batch(ops.slice(k, k + 10));
  const prev = parseObj(settings.import_last);
  await saveImportLast(env, { ...prev, received: now, bytes: t.length, pending: true });
  return json({ ok: true, gespeichert: true, hinweis: "Wird beim nächsten Öffnen der Fitness-App ausgewertet." });
}
// JSON lesen; Kurzbefehle schicken manchmal Text statt Listen – dann trotzdem versuchen
function parseLoose(t) {
  if (typeof t !== "string") return t;
  const s = t.trim(); if (!s) return null;
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse("[" + s.replace(/}\s*[\r\n,]+\s*{/g, "},{") + "]"); } catch (e) {}   // mehrere Objekte untereinander
  return s;
}
async function saveImportLast(env, o) { await setSetting(env, "import_last", JSON.stringify(o)).run(); }
async function healthData(env, settings, days) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const daily = (await env.DB.prepare("SELECT date, metric, value FROM health_daily WHERE date >= ? ORDER BY date").bind(since).all()).results;
  const workouts = (await env.DB.prepare("SELECT id, date, start, end, kind, run, min, km, kcal, hr_avg, hr_max, speed, power, stride, gct, source FROM workouts WHERE date >= ? ORDER BY start DESC").bind(since).all()).results;
  const pending = (await env.DB.prepare("SELECT COUNT(DISTINCT batch) AS n FROM health_raw").first()).n;
  const marks = (await env.DB.prepare("SELECT id, kind, end_at AS end FROM workout_marks WHERE end_at >= ? ORDER BY end_at DESC LIMIT 200").bind(since).all()).results;
  return { daily, workouts, marks, pending, hasKey: !!settings.import_hash, keyCreated: settings.import_created || null, last: parseObj(settings.import_last) };
}

/* ---------- Pläne ---------- */
// Aktiver Plan; gibt es noch keinen (erste Version), wird der Standardplan als Version 1 angelegt.
async function activePlan(env, settings) {
  let row = await env.DB.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();
  if (row) return row;
  const now = new Date().toISOString(), start = settings.plan_start ? mondayOf(settings.plan_start) : mondayOf(now.slice(0, 10));
  await env.DB.prepare("INSERT INTO plans (family, name, version, status, data, changes, note, start, created_at, applied_at) VALUES (?, ?, 1, 'active', ?, ?, '', ?, ?, ?)")
    .bind(randomHex(8), DEFAULT_PLAN.name, JSON.stringify(DEFAULT_PLAN), JSON.stringify(["Erste Version (Trainingsplan-Bild)"]), start, now, now).run();
  return await env.DB.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();
}
async function newVersion(env, cur, data, changes, note) {
  const now = new Date().toISOString();
  const max = await env.DB.prepare("SELECT MAX(version) AS v FROM plans WHERE family = ?").bind(cur.family).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE plans SET status = 'old' WHERE id = ?").bind(cur.id),
    env.DB.prepare("INSERT INTO plans (family, name, version, status, data, changes, note, start, created_at, applied_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)")
      .bind(cur.family, data.name, (max && max.v || cur.version) + 1, JSON.stringify(data), JSON.stringify(changes.slice(0, 60)), note, cur.start, now, now)
  ]);
  return await env.DB.prepare("SELECT * FROM plans WHERE status = 'active' ORDER BY id DESC LIMIT 1").first();
}
function planOut(r) {
  return { id: r.id, family: r.family, name: r.name, version: r.version, status: r.status, start: r.start, note: r.note || "", changes: parseArr(r.changes),
    createdAt: r.created_at, appliedAt: r.applied_at, archivedAt: r.archived_at, data: parseObj(r.data) };
}
function parseArr(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
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
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f3f4f6" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="/style.css?v=${VERSION}"><title>Fitness – ${esc(title)}</title></head>
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
