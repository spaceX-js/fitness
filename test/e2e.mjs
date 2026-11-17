// Klicktest im Browser gegen den lokalen Testserver (test/dev.mjs). Braucht Playwright:
//   PLAYWRIGHT=/pfad/zu/playwright node --experimental-sqlite test/e2e.mjs [ordner-für-screenshots]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { totpAt } from "../src/auth.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const out = process.argv[2] || "/tmp/fitness-shots";
const port = 8791, base = "http://localhost:" + port;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", new URL("./dev.mjs", import.meta.url).pathname, String(port)], { stdio: "inherit" });
await new Promise(r => setTimeout(r, 800));
const fail = (m) => { console.error("FEHLER:", m); srv.kill(); process.exit(1); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? "dark" : "light", locale: "de-DE", timezoneId: "Europe/Berlin" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/401/.test(m.text())) errors.push(m.text()); });
const shot = async (name, full = false) => page.screenshot({ path: `${out}/${name}.png`, fullPage: full });

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

// Abmelden → Login-Seite, API gesperrt
await page.goto(base + "/#/mehr"); await page.click("form[action='/logout'] button");
await page.waitForSelector("[name=code]");
await shot("12-anmeldung");
const st = await page.evaluate(() => fetch("/api/state").then(r => r.status));
if (st !== 401) fail("API nach Abmelden noch offen");

if (errors.length) fail("Fehler im Browser: " + errors.join(" | "));
console.log("OK – Screenshots in " + out);
await browser.close(); srv.kill();
