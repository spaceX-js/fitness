// Klicktest im Browser gegen den lokalen Testserver (test/dev.mjs). Braucht Playwright:
//   PLAYWRIGHT=/pfad/zu/playwright node --experimental-sqlite test/e2e.mjs [ordner-für-screenshots]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { totpAt } from "../src/auth.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const out = process.argv[2] || "/tmp/fitness-shots";
const port = 8791, base = "http://localhost:" + port;
import { DatabaseSync } from "node:sqlite";
import { rmSync } from "node:fs";
const dbFile = "/tmp/fitness-e2e.sqlite"; rmSync(dbFile, { force: true });
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", new URL("./dev.mjs", import.meta.url).pathname, String(port), dbFile], { stdio: "inherit" });
await new Promise(r => setTimeout(r, 800));
const fail = (m) => { console.error("FEHLER:", m); srv.kill(); process.exit(1); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", colorScheme: process.env.DARK ? "dark" : "light", locale: "de-DE", timezoneId: "Europe/Berlin" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/401/.test(m.text())) errors.push(m.text()); });
const tooWide = [];
const shot = async (name, full = false) => {
  const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll(".sheet")].map(s => s.scrollWidth)));
  if (w > 390) tooWide.push(name + " (" + w + " px)");
  const bad = await page.evaluate(() => [...document.querySelectorAll("button,a,input,.chip")].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1; }).map(el => el.textContent.trim().slice(0, 20)));
  if (bad.length) tooWide.push(name + ": " + bad.join(" / "));
  return page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
};

await page.goto(base + "/");
await shot("01-einrichtung");
await page.fill("[name=einrichtungscode]", "test-code-1234");
await page.fill("[name=passwort]", "mein-sicheres-pw-1");
await page.fill("[name=passwort2]", "mein-sicheres-pw-1");
await page.click("button[type=submit]");
await shot("02-zwei-faktor");
const key = (await page.textContent("code.key")).replace(/\s/g, "");
await page.fill("[name=code]", await totpAt(key, Math.floor(Date.now() / 30000)));
await page.click("button[type=submit]");
if (!(await page.textContent("body")).includes("Notfall-Codes")) fail("Einrichtung nicht abgeschlossen");
await shot("03-notfallcodes");
await page.click("a.btn");
await page.waitForSelector(".hero");

// Beispieldaten: Plan seit 2 Wochen, einige Einheiten erledigt
await page.evaluate(async () => {
  const post = (p, b) => fetch(p, { method: "POST", headers: { "Content-Type": "application/json", "X-Fit": "1" }, body: JSON.stringify(b) });
  await post("/api/settings", { start: "2026-11-02" });
  const L = (date, kind, status, data) => post("/api/log", { id: date + "-main", date, kind, status, data });
  await L("2026-11-02", "strength", "done", { workout: "homeA", feel: 3, ex: { pullup: { id: "pullup", sets: [{ r: "10", w: "", done: true }, { r: "10", w: "", done: true }, { r: "10", w: "", done: true }, { r: "10", w: "", done: true }] }, dbpress: { id: "dbpress", sets: [{ r: "10", w: "14", done: true }, { r: "9", w: "14", done: true }, { r: "8", w: "14", done: true }] } } });
  await L("2026-11-03", "run", "done", { run: "z2", min: 42, km: 6.1, hr: 136, feel: 2 });
  await L("2026-11-04", "strength", "done", { workout: "gym", feel: 4, ex: { legpress: { id: "legpress", sets: [{ r: "10", w: "90", done: true }, { r: "9", w: "90", done: true }, { r: "8", w: "90", done: true }] } } });
  await L("2026-11-05", "recovery", "done", { items: { catcow: true, cobra: true }, walk: 30 });
  await L("2026-11-06", "run", "done", { run: "interval", min: 41, km: 6.8, hr: 151, feel: 4 });
  await L("2026-11-07", "strength", "done", { workout: "homeB", feel: 3, ex: {} });
  await L("2026-11-08", "run", "done", { run: "long", min: 56, km: 8.0, hr: 138, feel: 3 });
  await L("2026-11-09", "strength", "done", { workout: "homeA", feel: 3, pain: ["schulter"], ex: { pullup: { id: "pullup", sets: [{ r: "10", w: "", done: true }, { r: "10", w: "", done: true }, { r: "10", w: "", done: true }, { r: "10", w: "", done: true }] }, dbpress: { id: "dbpress", sets: [{ r: "12", w: "14", done: true }, { r: "11", w: "14", done: true }, { r: "10", w: "14", done: true }] } } });
  await L("2026-11-10", "run", "done", { run: "z2", min: 43, km: 6.4, hr: 134, feel: 2 });
  await L("2026-11-11", "strength", "done", { workout: "gym", feel: 3, ex: { legpress: { id: "legpress", sets: [{ r: "10", w: "95", done: true }, { r: "10", w: "95", done: true }, { r: "9", w: "95", done: true }] } } });
  await L("2026-11-13", "run", "done", { run: "interval", min: 42, km: 7.0, hr: 153, feel: 4 });
  await L("2026-11-14", "strength", "skipped", {});
  await L("2026-11-15", "run", "done", { run: "long", min: 61, km: 9.0, hr: 137, feel: 3 });
});
await page.goto(base + "/#/heute"); await page.reload(); await page.waitForSelector(".hero");
await shot("04-heute", true);
const today = new Date().toISOString().slice(0, 10);
const mon = (() => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; })();
const dayOf = i => { const d = new Date(mon); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };
const other = dayOf(dayOf(2) === today ? 4 : 2);
await page.click(`[data-day='${other}']`); await page.waitForTimeout(200);
await shot("04b-anderer-tag");
await page.click("#toToday"); await page.waitForTimeout(200);
if (!(await page.textContent(".hero .k")).startsWith("Heute")) fail("Zurück zu heute geht nicht");
// Fitnessstudio (Mi) auf Dienstag tauschen
await page.click(`[data-day='${dayOf(2)}']`); await page.click("#swapDay"); await page.waitForTimeout(200);
await shot("04d-tauschen");
await page.click(`[data-to='${dayOf(1)}']`); await page.waitForTimeout(500);
if (!(await page.textContent(".hero")).includes("Lauf")) fail("Tausch nicht angekommen (heute sollte jetzt Laufen sein)");
await shot("04e-getauscht");
if (await page.evaluate(() => document.documentElement.scrollWidth) > 390) fail("Startseite breiter als der iPhone-Bildschirm");
const versions = await page.evaluate(() => fetch("/api/state").then(r => r.json()).then(j => j.plans.length));
if (versions !== 1) fail("Tauschen hat eine Planversion erzeugt");
// Auslassen auf der Startseite und rückgängig
await page.click("#skipDayHome"); await page.click("[data-r='Keine Zeit']"); await shot("04g-auslassen"); await page.click("#skipOk"); await page.waitForTimeout(400);
if (!(await page.textContent(".hero")).includes("Ausgelassen")) fail("Auslassen auf der Startseite geht nicht");
await page.click("#unskipDay"); await page.waitForTimeout(400);
if (!(await page.$("#skipDayHome"))) fail("Rückgängig geht nicht");
await page.click("#swapDay"); await page.waitForTimeout(300); await shot("04f-sheet"); await page.click("#resetWeek", { timeout: 5000 }); await page.waitForTimeout(400);
if (!(await page.textContent("body")).includes("Klimmzüge: steigern")) fail("Empfehlung 'steigern' fehlt");

await page.goto(base + "/#/tag/2026-11-21"); await page.waitForSelector(".ex");
await page.waitForTimeout(700);
await shot("05-training");
await page.click("[data-check='ringdip'][data-k='0']");
await page.waitForTimeout(400);
await shot("06-satz-pause");
await page.goto(base + "/#/tag/2026-11-17"); await page.waitForSelector(".steps");
await shot("07-lauf", true);
await page.goto(base + "/#/tag/2026-11-19"); await page.waitForSelector(".ex");
await page.click("[data-open='m-catcow']"); await page.waitForTimeout(500);
await shot("08-mobility");
await page.goto(base + "/#/plan"); await page.waitForSelector(".weeks");
await shot("09-plan", true);
await page.goto(base + "/#/statistik"); await page.waitForSelector(".kpis");
await shot("10-statistik", true);
await page.goto(base + "/#/mehr"); await page.waitForSelector("[data-lim]");
await page.click("[data-lim='schulter']"); await page.waitForTimeout(600);
await page.goto(base + "/#/heute"); await page.waitForSelector(".hero");
await shot("11-heute-einschraenkung", true);
if (!(await page.textContent("body")).includes("Einschränkung Schulter")) fail("Ersatz-Vorschlag bei Einschränkung fehlt");

// v0.2: im Training überspringen und Übung hinzufügen
await page.goto(base + "/#/tag/2026-11-21"); await page.waitForSelector(".ex");
await page.click("[data-menu='chinup']"); await page.click("[data-act='skip']"); await page.waitForTimeout(300);
if (!(await page.textContent("#ex-chinup")).includes("übersprungen")) fail("Überspringen geht nicht");
await page.click("#addEx"); await page.fill("#q", "plank"); await page.click(".pick[data-id='plank']"); await page.waitForTimeout(300);
if (!(await page.textContent("body")).includes("zusätzlich")) fail("Zusätzliche Übung fehlt");
await shot("13-training-angepasst");
await page.click("[data-menu='ringdip']"); await page.waitForTimeout(200);
await shot("14-uebung-menue");
await page.click("[data-act='swapToday']"); await page.waitForTimeout(200);
await shot("15-uebung-auswahl");
await page.click(".pick[data-id='inclinepushup']"); await page.waitForTimeout(300);
if (!(await page.textContent("#ex-ringdip")).includes("heute ersetzt")) fail("Heute ersetzen geht nicht");

// Plan bearbeiten → Version 2
await page.goto(base + "/#/plan/bearbeiten"); await page.waitForSelector("#pname");
const gymRows = await page.$$("[data-item^='gym:']");
await gymRows[5].click(); await page.fill("#sets", "3"); await page.click("#ok"); await page.waitForTimeout(200);
await shot("16-bearbeiten", true);
await page.fill("#pnote", "Schulter stärker trainieren"); await page.click("#psave"); await page.waitForTimeout(600);
await page.goto(base + "/#/plan/versionen"); await page.waitForSelector(".card");
if (!(await page.textContent("body")).includes("Schulterdrücken: 2 → 3 Sätze")) fail("Versionierung fehlt");
if ((await page.textContent("body")).includes("NaN")) fail("Datum fehlt im Verlauf");
await shot("17-versionen", true);

// Planer und Vorschlag anwenden
await page.goto(base + "/#/plan/planer"); await page.waitForSelector("#send");
await page.click("[data-o='Mehr Abwechslung']"); await page.fill("[data-t='other']", "Halbmarathon im April");
await shot("18-planer", true);
await page.click("#send"); await page.waitForTimeout(500);
const db = new DatabaseSync(dbFile);
const cur = JSON.parse(db.prepare("SELECT data FROM plans WHERE status = 'active'").get().data);
cur.name = "Phase 3 – Halbmarathon"; cur.weeks = 10;
db.prepare("INSERT INTO plans (family, name, version, status, data, changes, note, created_at) VALUES ('p3', ?, 1, 'draft', ?, ?, ?, ?)")
  .run(cur.name, JSON.stringify(cur), JSON.stringify(["10 statt 8 Wochen", "Langer Lauf steigt bis 18 km"]), "Mehr Laufumfang für den Halbmarathon, Kraft bleibt 3× pro Woche.", new Date().toISOString());
await page.reload(); await page.goto(base + "/#/plan"); await page.waitForSelector(".card");
await shot("19-plan-mit-vorschlag", true);
if ((await page.textContent("body")).includes("Planer-Angaben vom")) fail("Hinweis trotz Vorschlag");
await page.click("a[href^='#/plan/ansehen/']"); await page.waitForSelector("#papply");
await shot("20-vorschlag", true);
await page.click("#papply"); await page.waitForTimeout(700);
if (!(await page.textContent("body")).includes("Phase 3 – Halbmarathon")) fail("Vorschlag nicht angewendet");
await page.goto(base + "/#/plan/archiv"); await page.waitForSelector(".card");
if (!(await page.textContent("body")).includes("Phase 2")) fail("Archiv fehlt");

// Abmelden → Login-Seite, API gesperrt
await page.goto(base + "/#/mehr"); await page.click("form[action='/logout'] button");
await page.waitForSelector("[name=code]");
await shot("12-anmeldung");
const st = await page.evaluate(() => fetch("/api/state").then(r => r.status));
if (st !== 401) fail("API nach Abmelden noch offen");

const wide = await page.evaluate(() => document.documentElement.scrollWidth);
if (wide > 390) fail("Seite breiter als der iPhone-Bildschirm: " + wide);
if (tooWide.length) fail("Breiter als der iPhone-Bildschirm: " + tooWide.join(", "));
if (errors.length) fail("Fehler im Browser: " + errors.join(" | "));
console.log("OK – Screenshots in " + out);
await browser.close(); srv.kill();
