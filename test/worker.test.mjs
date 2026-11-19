// Testet den Worker gegen eine lokale SQLite-Datenbank, die sich wie D1 verhält.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { checkLog, cleanJson } from "../src/index.js";
import { sha256, totpAt, checkTotp, base32, unbase32 } from "../src/auth.js";

function makeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../d1-schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    sql, args, bind: (...a) => stmt(sql, a),
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async run() { db.prepare(sql).run(...args); return { results: [] }; }
  });
  return {
    raw: db, prepare: sql => stmt(sql),
    async batch(list) {
      db.exec("BEGIN");
      try { const out = list.map(s => { db.prepare(s.sql).run(...s.args); return { results: [] }; }); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  };
}
const ASSETS = { fetch: async req => new Response("asset " + new URL(req.url).pathname) };
const call = (env, path, opts = {}) => worker.fetch(new Request("https://fit.test" + path, opts), env);
const form = o => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const ip = n => ({ "CF-Connecting-IP": "10.0.0." + n });
const setting = (env, k) => (env.DB.raw.prepare("SELECT value FROM settings WHERE key = ?").get(k) || {}).value;

async function freshEnv() {
  const DB = makeD1();
  DB.raw.prepare("INSERT INTO settings (key, value) VALUES ('setup_hash', ?)").run(await sha256("ABCD-1234"));
  return { DB, ASSETS };
}
async function setupDone() {
  const env = await freshEnv();
  await call(env, "/setup", { method: "POST", body: form({ einrichtungscode: "abcd-1234", passwort: "sehr-geheim-123", passwort2: "sehr-geheim-123" }), headers: ip(1) });
  const secret = setting(env, "pending_totp");
  const code = await totpAt(secret, Math.floor(Date.now() / 30000));
  const res = await call(env, "/setup/confirm", { method: "POST", body: form({ einrichtungscode: "ABCD-1234", code }), headers: ip(1) });
  const cookie = res.headers.get("Set-Cookie").split(";")[0];
  const codes = (await res.text()).match(/<pre class="codes">([^<]+)<\/pre>/)[1].split("\n");
  return { env, secret, cookie, codes };
}
const post = (env, cookie, path, body) => call(env, path, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "X-Fit": "1" }, body: JSON.stringify(body) });

test("TOTP: Testvektor aus RFC 6238 und Base32", async () => {
  const secret = base32(new TextEncoder().encode("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(new TextDecoder().decode(unbase32(secret)), "12345678901234567890");
  assert.equal(await totpAt(secret, Math.floor(59 / 30)), "287082");
  assert.equal(await totpAt(secret, Math.floor(1111111109 / 30)), "081804");
  const st = await checkTotp(secret, "081804", -1, 1111111109000);
  assert.ok(st > 0);
  assert.equal(await checkTotp(secret, "081804", st, 1111111109000), -1, "derselbe Code darf nicht zweimal gehen");
});

test("ohne Freischaltung keine Einrichtung; falscher Einrichtungscode wird abgelehnt", async () => {
  const env = { DB: makeD1(), ASSETS };
  assert.match(await (await call(env, "/")).text(), /noch nicht freigeschaltet/);
  const env2 = await freshEnv();
  const r = await call(env2, "/setup", { method: "POST", body: form({ einrichtungscode: "FALSCH", passwort: "x".repeat(12), passwort2: "x".repeat(12) }), headers: ip(2) });
  assert.match(await r.text(), /Einrichtungscode stimmt nicht/);
  assert.equal(setting(env2, "pending_totp"), undefined);
});

test("Einrichtung, dann ist der Einrichtungscode verbraucht und die App erreichbar", async () => {
  const { env, cookie, codes } = await setupDone();
  assert.equal(codes.length, 8);
  assert.equal(setting(env, "setup_hash"), undefined);
  assert.ok(setting(env, "pw_hash"));
  assert.match(cookie, /^__Host-fit=[a-f0-9]{64}$/);
  // Sitzung liegt nur als Hash in der DB
  const row = env.DB.raw.prepare("SELECT id FROM sessions").get();
  assert.notEqual(row.id, cookie.split("=")[1]);
  const st = await call(env, "/api/state", { headers: { Cookie: cookie } });
  assert.equal(st.status, 200);
  assert.equal((await call(env, "/app.js", { headers: { Cookie: cookie } })).status, 200);
});

test("ohne Anmeldung: nur Login, CSS und Icon", async () => {
  const { env } = await setupDone();
  assert.match(await (await call(env, "/")).text(), /Authenticator-App/);
  assert.equal((await call(env, "/api/state")).status, 401);
  assert.equal((await call(env, "/app.js")).status, 302);
  assert.equal((await call(env, "/plan.js")).status, 302);
  assert.equal((await call(env, "/style.css")).status, 200);
  const res = await call(env, "/");
  assert.match(res.headers.get("Content-Security-Policy"), /script-src 'self'/);
  assert.match(res.headers.get("Strict-Transport-Security"), /max-age/);
});

test("Anmeldung braucht Passwort UND Code; Notfall-Code geht genau einmal", async () => {
  const { env, secret, codes } = await setupDone();
  const login = (pw, code, n = 3) => call(env, "/login", { method: "POST", body: form({ passwort: pw, code }), headers: ip(n) });
  let r = await login("sehr-geheim-123", "000000");
  assert.equal(r.headers.get("Location"), "/?fehler=falsch");
  r = await login("falsch-falsch-1", await totpAt(secret, Math.floor(Date.now() / 30000) + 1), 4);
  assert.equal(r.headers.get("Location"), "/?fehler=falsch");
  r = await login("sehr-geheim-123", codes[0].toLowerCase(), 5);
  assert.match(r.headers.get("Set-Cookie") || "", /__Host-fit=/);
  r = await login("sehr-geheim-123", codes[0], 6);
  assert.equal(r.headers.get("Location"), "/?fehler=falsch");
});

test("Sperre nach 5 Fehlversuchen", async () => {
  const { env } = await setupDone();
  for (let i = 0; i < 5; i++) await call(env, "/login", { method: "POST", body: form({ passwort: "x", code: "123456" }), headers: ip(9) });
  const r = await call(env, "/login", { method: "POST", body: form({ passwort: "sehr-geheim-123", code: "123456" }), headers: ip(9) });
  assert.equal(r.headers.get("Location"), "/?fehler=gesperrt");
});

test("API: Schutz vor fremden Seiten (Header und Herkunft)", async () => {
  const { env, cookie } = await setupDone();
  const body = JSON.stringify({ start: "2026-11-16" });
  let r = await call(env, "/api/settings", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body });
  assert.equal(r.status, 403);
  r = await call(env, "/api/settings", { method: "POST", headers: { Cookie: cookie, "X-Fit": "1", Origin: "https://boese.example" }, body });
  assert.equal(r.status, 403);
  r = await post(env, cookie, "/api/settings", { start: "2026-11-16" });
  assert.equal(r.status, 200);
});

test("Protokoll speichern, lesen, löschen; ungültige Daten abgelehnt", async () => {
  const { env, cookie } = await setupDone();
  let r = await post(env, cookie, "/api/log", { id: "2026-11-17-run", date: "2026-11-17", kind: "run", status: "done", data: { km: 7.2, min: 45, hr: 136, feel: 4, "<x>": 1 } });
  assert.equal(r.status, 200);
  const st = await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  assert.equal(st.logs.length, 1);
  assert.deepEqual(st.logs[0].data, { km: 7.2, min: 45, hr: 136, feel: 4 });
  assert.equal((await post(env, cookie, "/api/log", { id: "2026-11-18-run", date: "2026-11-17", kind: "run", status: "done" })).status, 400);
  assert.equal((await post(env, cookie, "/api/log", { id: "2026-11-17-run", date: "2026-11-17", kind: "hack", status: "done" })).status, 400);
  r = await post(env, cookie, "/api/log/delete", { id: "2026-11-17-run" });
  assert.equal(r.status, 200);
  assert.equal((await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json()).logs.length, 0);
});

test("Abmelden beendet die Sitzung; Passwort ändern meldet andere Geräte ab", async () => {
  const { env, cookie, secret } = await setupDone();
  const r1 = await call(env, "/login", { method: "POST", body: form({ passwort: "sehr-geheim-123", code: await totpAt(secret, Math.floor(Date.now() / 30000) + 1) }), headers: ip(7) });
  const cookie2 = r1.headers.get("Set-Cookie").split(";")[0];
  assert.equal((await post(env, cookie2, "/api/password", { old: "sehr-geheim-123", new: "noch-geheimer-456" })).status, 200);
  assert.equal((await call(env, "/api/state", { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await call(env, "/api/state", { headers: { Cookie: cookie2 } })).status, 200);
  await call(env, "/logout", { method: "POST", headers: { Cookie: cookie2 } });
  assert.equal((await call(env, "/api/state", { headers: { Cookie: cookie2 } })).status, 401);
});

test("cleanJson und checkLog", () => {
  assert.deepEqual(cleanJson({ a: [1, "x", { b: NaN }], "bad key": 1 }, 0), { a: [1, "x", {}] });
  assert.equal(checkLog({ id: "2026-11-17-gym", date: "2026-11-17", kind: "strength", status: "done", data: [] }), null);
});

test("Pläne: Version 1 automatisch, neue Version, wiederherstellen", async () => {
  const { env, cookie } = await setupDone();
  const get = async () => (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  let st = await get();
  assert.equal(st.plan.version, 1);
  assert.equal(st.plan.data.workouts.gym.items[5].sets, 2);
  const d = JSON.parse(JSON.stringify(st.plan.data));
  d.workouts.gym.items[5].sets = 3;
  assert.equal((await post(env, cookie, "/api/plan/save", { data: st.plan.data })).status, 400, "ohne Änderung keine neue Version");
  let r = await post(env, cookie, "/api/plan/save", { data: d, note: "mehr Schulter" });
  assert.equal(r.status, 200);
  st = await get();
  assert.equal(st.plan.version, 2);
  assert.deepEqual(st.plan.changes, ["Schulterdrücken: 2 → 3 Sätze"]);
  assert.equal(st.plans.length, 2);
  r = await post(env, cookie, "/api/plan/restore", { id: st.plans.find(p => p.version === 1).id });
  st = await get();
  assert.equal(st.plan.version, 3);
  assert.equal(st.plan.data.workouts.gym.items[5].sets, 2);
  const bad = JSON.parse(JSON.stringify(d)); bad.workouts.gym.items[0].id = "<script>";
  assert.equal((await post(env, cookie, "/api/plan/save", { data: bad })).status, 400);
});

test("Pläne: Entwurf anwenden archiviert den alten, Archiv wieder aktivieren", async () => {
  const { env, cookie } = await setupDone();
  const get = async () => (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  const st0 = await get();
  const draft = JSON.parse(JSON.stringify(st0.plan.data)); draft.name = "Phase 3"; draft.weeks = 6;
  env.DB.raw.prepare("INSERT INTO plans (family, name, version, status, data, changes, note, created_at) VALUES ('neu', 'Phase 3', 1, 'draft', ?, '[]', 'Vorschlag', ?)").run(JSON.stringify(draft), new Date().toISOString());
  let st = await get();
  const dr = st.plans.find(p => p.status === "draft");
  assert.equal((await post(env, cookie, "/api/plan/apply", { id: dr.id })).status, 400, "Startdatum nötig");
  assert.equal((await post(env, cookie, "/api/plan/apply", { id: dr.id, start: "2026-11-25" })).status, 200);
  st = await get();
  assert.equal(st.plan.name, "Phase 3");
  assert.equal(st.start, "2026-11-23");
  const arch = st.plans.find(p => p.status === "archived");
  assert.equal(arch.name, "Phase 2");
  assert.equal((await post(env, cookie, "/api/plan/apply", { id: arch.id, start: "2026-11-30" })).status, 200);
  st = await get();
  assert.equal(st.plan.name, "Phase 2");
  assert.equal(st.plans.find(p => p.status === "archived").name, "Phase 3");
});

test("Planer speichert Angaben", async () => {
  const { env, cookie } = await setupDone();
  assert.equal((await post(env, cookie, "/api/planner", { answers: { goals: ["Muskelaufbau"], weeks: "8", other: "Halbmarathon im April" } })).status, 200);
  const st = await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  assert.equal(st.planner.status, "offen");
  assert.deepEqual(st.planner.answers.goals, ["Muskelaufbau"]);
});

test("Health-Import: nur mit Schlüssel speichern, im Browser auswerten, Ergebnis übernehmen, Schlüssel sperrbar", async () => {
  const { env, cookie } = await setupDone();
  const { processUpload } = await import("../public/health.js");
  const imp = (key, body) => call(env, "/api/import", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json", "CF-Connecting-IP": "10.9.9.9" }, body: JSON.stringify(body) });
  const body = { typ: "Resting Heart Rate\nResting Heart Rate\nGibtsnicht", werte: "60\n58\n1", start: "18.11.2026, 06:00\n19.11.2026, 06:00\n19.11.2026, 07:00" };
  assert.equal((await imp("Bearer fit_" + "0".repeat(48), body)).status, 401);
  const k = await (await post(env, cookie, "/api/health/key", {})).json();
  assert.match(k.key, /^fit_[a-f0-9]{48}$/);
  assert.equal((await imp(k.key, body)).status, 200, "Schlüssel auch ohne „Bearer“");
  let st = await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  assert.equal(st.health.pending, 1);
  // Der Import-Schlüssel kann nichts lesen
  assert.equal((await call(env, "/api/health/raw", { headers: { Authorization: "Bearer " + k.key } })).status, 401);
  const raw = await (await call(env, "/api/health/raw", { headers: { Cookie: cookie } })).json();
  const out = processUpload(raw.data, raw.receivedAt);
  out.daily.push({ date: "2026-11-19", metric: "<script>", value: 1 });
  const ap = await (await post(env, cookie, "/api/health/apply", { batch: raw.batch, ...out })).json();
  assert.equal(ap.left, 0);
  st = await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json();
  assert.deepEqual(st.health.daily.map(d => [d.date, d.metric, d.value]), [["2026-11-19", "rhr", 58]]);
  assert.deepEqual(st.health.last.unknown, ["Gibtsnicht"]);
  assert.equal(st.health.pending, 0);
  await post(env, cookie, "/api/health/revoke", {});
  assert.equal((await imp("Bearer " + k.key, body)).status, 401);
  await post(env, cookie, "/api/health/delete", {});
  assert.equal((await (await call(env, "/api/state", { headers: { Cookie: cookie } })).json()).health.daily.length, 0);
});
