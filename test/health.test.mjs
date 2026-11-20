// Tests für die Auswertung der Apple-Health-Daten (so, wie ein Kurzbefehl sie schicken kann)
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, parseTime, parseNum, typeKey, localDate, fmtVal } from "../public/health.js";

test("Namen, Zahlen und Zeiten in verschiedenen Formen", () => {
  assert.equal(typeKey("Herzfrequenzvariabilität"), "hrv");
  assert.equal(typeKey("Resting Heart Rate"), "rhr");
  assert.equal(typeKey("Geh- und Laufstrecke"), "dist");
  assert.equal(typeKey("VO₂max"), "vo2");
  assert.equal(typeKey("Banane"), null);
  assert.deepEqual(parseNum("60,5"), { n: 60.5, unit: "" });
  assert.deepEqual(parseNum("1.234,5 km"), { n: 1234.5, unit: "km" });
  assert.equal(parseNum("abc"), null);
  assert.equal(parseNum("6.627018749713898e-05").n, 6.627018749713898e-05);
  assert.equal(parseNum("1.5E+3 m").n, 1500);
  const iso = Date.parse("2026-11-19T06:30:00Z");
  assert.equal(parseTime("2026-11-19T07:30:00+01:00"), iso);
  assert.equal(parseTime("2026-11-19T07:30:00"), iso, "ohne Zeitzone = deutsche Zeit");
  assert.equal(parseTime("19.11.2026, 07:30"), iso);
  assert.equal(parseTime("19.11.26 um 07:30:00"), iso);
  assert.equal(parseTime("19. Nov. 2026 um 07:30"), iso);
  assert.equal(parseTime("2026-07-01T08:00:00"), Date.parse("2026-07-01T06:00:00Z"), "Sommerzeit");
  assert.equal(localDate(Date.parse("2026-11-18T23:30:00Z")), "2026-11-19");
});

test("Tageswerte: Summen ohne Doppelzählung, Durchschnitte, Puls, erster Tag weggelassen", () => {
  const { daily, summary } = aggregate([
    { typ: "Schritte", werte: [1000, 2000, 500, 2600, 4000, 300], start: ["2026-11-17T10:00:00+01:00", "2026-11-18T09:00:00+01:00", "2026-11-18T12:00:00+01:00", "2026-11-18T08:50:00+01:00", "2026-11-19T08:00:00+01:00", "2026-11-19T09:00:00+01:00"],
      ende: ["2026-11-17T10:10:00+01:00", "2026-11-18T09:20:00+01:00", "2026-11-18T12:10:00+01:00", "2026-11-18T09:30:00+01:00", "2026-11-19T08:10:00+01:00", "2026-11-19T09:10:00+01:00"],
      quelle: ["iPhone", "iPhone", "iPhone", "Apple Watch", "iPhone", "iPhone"] },
    { typ: "Ruhepuls", werte: "58\n61\n57", start: "18.11.2026, 06:00\n19.11.2026, 06:00\n17.11.2026, 06:00", einheit: "count/min" },
    { typ: "Herzfrequenz", werte: [70, 120, 55, 90], start: ["2026-11-18T10:00:00", "2026-11-18T18:00:00", "2026-11-19T03:00:00", "2026-11-19T10:00:00"] },
    { typ: "Gewicht", werte: ["162 lb"], start: ["2026-11-19T07:00:00"] },
    { typ: "Unbekannt", werte: [1], start: ["2026-11-19T07:00:00"] }
  ]);
  const v = (d, m) => (daily.find(r => r.date === d && r.metric === m) || {}).value;
  assert.equal(v("2026-11-17", "steps"), undefined, "erster Tag ist unvollständig");
  assert.equal(v("2026-11-18", "steps"), 3100, "Watch zählt; iPhone nur, wo die Watch nichts gemessen hat");
  assert.equal(v("2026-11-19", "steps"), 4300);
  assert.equal(v("2026-11-18", "rhr"), 58);
  assert.equal(v("2026-11-19", "rhr"), 61);
  assert.equal(v("2026-11-19", "hr_min"), 55);
  assert.equal(v("2026-11-18", "hr_avg"), undefined);
  assert.equal(Math.round(v("2026-11-19", "weight") * 10) / 10, 73.5);
  assert.equal(summary.find(s => s.typ === "Unbekannt").key, null);
});

test("Schlaf: Phasen, Überlappung von iPhone und Watch, Nacht = Aufwachtag", () => {
  const { daily } = aggregate([{ typ: "Schlaf",
    werte: ["Kern", "Tief", "REM", "Kern", "Wach", "Im Bett", "Kern", "Kern"],
    start: ["2026-11-18T23:00:00", "2026-11-19T01:00:00", "2026-11-19T02:00:00", "2026-11-19T03:00:00", "2026-11-19T06:00:00", "2026-11-18T22:45:00", "2026-11-18T23:00:00", "2026-11-17T23:00:00"],
    ende: ["2026-11-19T01:00:00", "2026-11-19T02:00:00", "2026-11-19T03:00:00", "2026-11-19T06:00:00", "2026-11-19T06:15:00", "2026-11-19T06:30:00", "2026-11-19T00:30:00", "2026-11-18T06:00:00"] }]);
  const v = (d, m) => (daily.find(r => r.date === d && r.metric === m) || {}).value;
  assert.equal(v("2026-11-19", "sleep_total"), 7);
  assert.equal(v("2026-11-19", "sleep_deep"), 1);
  assert.equal(v("2026-11-19", "sleep_core"), 5);
  assert.equal(v("2026-11-19", "sleep_awake"), 0.25);
  assert.equal(fmtVal("sleep_total", 7.25), "7:15 h");
});

test("Training: Distanz, Puls und Energie aus dem Trainingszeitraum", () => {
  const { workouts } = aggregate([
    { typ: "Trainings", werte: ["Laufen"], start: ["2026-11-19T07:00:00+01:00"], ende: ["2026-11-19T07:45:00+01:00"], quelle: ["Apple Watch"] },
    { typ: "Geh- und Laufstrecke", werte: [3000, 3500, 800, 3200, 3600], einheit: "m", quelle: ["Apple Watch", "Apple Watch", "Apple Watch", "iPhone", "iPhone"],
      start: ["2026-11-19T07:01:00+01:00", "2026-11-19T07:20:00+01:00", "2026-11-19T12:00:00+01:00", "2026-11-19T07:02:00+01:00", "2026-11-19T07:21:00+01:00"],
      ende: ["2026-11-19T07:20:00+01:00", "2026-11-19T07:40:00+01:00", "2026-11-19T12:05:00+01:00", "2026-11-19T07:20:00+01:00", "2026-11-19T07:40:00+01:00"] },
    { typ: "Herzfrequenz", werte: [130, 140, 150, 70], start: ["2026-11-19T07:05:00+01:00", "2026-11-19T07:20:00+01:00", "2026-11-19T07:40:00+01:00", "2026-11-19T09:00:00+01:00"] }
  ]);
  assert.equal(workouts.length, 1);
  const w = workouts[0];
  assert.equal(w.run, true); assert.equal(w.min, 45); assert.equal(w.km, 6.5); assert.equal(w.hr_avg, 140); assert.equal(w.hr_max, 150);
  assert.equal(w.date, "2026-11-19");
});

test("Namen aus der deutschen Kurzbefehle-App und Läufe aus Laufwerten erkennen", () => {
  for (const [n, k] of [["Ruheherzfrequenz", "rhr"], ["Strecke (Gehen und Laufen)", "dist"], ["Aktivitätsenergie", "active_kcal"], ["Treppensteigen", "floors"],
    ["Cardioerholung", "hr_recovery"], ["∅-Herzfrequenz (Gehen)", "walk_hr"], ["Temperatur am Handgelenk", "wrist_temp"], ["Vertikale Oszillation", "run_vo"], ["Stehminuten", "stand_min"],
    ["Systolischer Blutdruck", "bp_sys"], ["Diastolischer Blutdruck", "bp_dia"]]) assert.equal(typeKey(n), k, n);
  const sp = [], st = [];
  for (let m = 0; m <= 40; m += 2) { sp.push(9.5); st.push(`2026-11-19T07:${String(m).padStart(2, "0")}:00+01:00`); }
  const { workouts } = aggregate([{ typ: "Laufgeschwindigkeit", werte: sp, start: st, einheit: "km/h" },
    { typ: "Herzfrequenz", werte: [135, 139], start: ["2026-11-19T07:10:00+01:00", "2026-11-19T07:30:00+01:00"] },
    { typ: "Laufgeschwindigkeit", werte: [9], start: ["2026-11-19T12:00:00+01:00"] }]);
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].run, true); assert.equal(workouts[0].min, 40); assert.equal(workouts[0].hr_avg, 137); assert.equal(workouts[0].speed, 9.5);
});

test("Ein Wörterbuch mit allen Messungen (Typ je Zeile, deutsche Datumsangaben)", () => {
  const { daily } = aggregate([{ typ: "Schritte\nSchritte\nRuheherzfrequenz\nRuheherzfrequenz\nSchritte",
    werte: "1200\n800\n58\n60\n500", start: "18.11.2026, 09:00\n19.11.2026, 10:00\n18.11.2026, 06:00\n19.11.2026, 06:00\n19.11.2026, 11:00",
    ende: "18.11.2026, 09:10\n19.11.2026, 10:10\n18.11.2026, 06:00\n19.11.2026, 06:00\n19.11.2026, 11:05", quelle: "iPhone\niPhone\nWatch\nWatch\niPhone" }]);
  const v = (d, m) => (daily.find(r => r.date === d && r.metric === m) || {}).value;
  assert.equal(v("2026-11-19", "steps"), 1300);
  assert.equal(v("2026-11-19", "rhr"), 60);
  assert.equal(v("2026-11-18", "steps"), undefined, "erster Tag weggelassen");
});

test("Watch-Training: Dauer aus dichtem Puls, sonst Schätzung", async () => {
  const { processUpload } = await import("../public/health.js");
  const t0 = Date.parse("2026-11-17T17:00:00Z"), hr = [], st = [];
  hr.push(70); st.push(new Date(t0 - 3600000).toISOString());          // vorher: einzelne Messung
  for (let i = 0; i <= 50 * 6; i++) { hr.push(110 + (i % 20)); st.push(new Date(t0 + i * 10000).toISOString()); }   // 50 Min. alle 10 s
  const text = JSON.stringify({ typ: "Heart Rate", werte: hr.join("\n"), start: st.join("\n") });
  const marks = [{ id: "abc", kind: "Krafttraining", end: new Date(t0 + 51 * 60000).toISOString() }];
  const w = processUpload(text, null, { marks }).workouts.find(x => x.id === "w_abc");
  assert.ok(w && Math.abs(w.min - 50) < 1, "Dauer ~50 Min: " + (w && w.min));
  assert.equal(w.start, new Date(t0).toISOString());
  assert.ok(w.hr_avg > 110 && w.hr_max === 129);
  const e = processUpload("", null, { marks: [{ id: "x1", kind: "Core-Training", end: new Date(t0).toISOString() }] }).workouts[0];
  assert.equal(e.min, 15);
  assert.equal(processUpload("", null, { marks: [{ id: "x1", kind: "Core-Training", end: new Date(t0).toISOString() }], known: ["w_x1"] }).workouts.length, 0, "vorhandenes nicht mit Schätzung überschreiben");
});

test("Schlaf über Mitternacht gehört zur Nacht, in der er endet", async () => {
  const { aggregate } = await import("../public/health.js");
  const r = aggregate([{ typ: "Sleep", werte: "Kern\nKern\nTief\nKern\nKern", start: "18.11.2026, 23:00\n19.11.2026, 22:30\n20.11.2026, 00:00\n20.11.2026, 01:00\n20.11.2026, 13:00",
    ende: "19.11.2026, 06:00\n19.11.2026, 23:59\n20.11.2026, 01:00\n20.11.2026, 06:16\n20.11.2026, 13:30" }]);
  const v = Object.fromEntries(r.daily.filter(x => x.metric === "sleep_total").map(x => [x.date, Math.round(x.value * 60)]));
  assert.equal(v["2026-11-20"], 89 + 60 + 316 + 30, "1:29 + 1:00 + 5:16 + 0:30 Mittagsschlaf");
  assert.equal(v["2026-11-19"], undefined, "frühester (unvollständiger) Tag fällt weg");
});

test("Watch: abgebrochenes und doppelt gemeldetes Training wird verworfen", async () => {
  const { processUpload } = await import("../public/health.js");
  const t0 = Date.parse("2026-11-20T11:40:00Z"), hr = [], st = [];
  for (let i = 0; i < 6; i++) { hr.push(70); st.push(new Date(t0 - 60 * 60000 + i * 8 * 60000).toISOString()); }   // vorher locker verteilt
  for (let i = 0; i <= 12 * 6; i++) { hr.push(100); st.push(new Date(t0 + i * 10000).toISOString()); }            // 12 Min. Training
  hr.push(72); st.push(new Date(t0 + 30 * 60000).toISOString());
  const text = JSON.stringify({ typ: "Heart Rate", werte: hr.join("\n"), start: st.join("\n") });
  const marks = [{ id: "a".repeat(16), kind: "Core-Training", end: new Date(t0 - 2 * 60000).toISOString() },
    { id: "b".repeat(16), kind: "Core-Training", end: new Date(t0 + 15 * 60000).toISOString() },
    { id: "c".repeat(16), kind: "Core-Training", end: new Date(t0 + 16 * 60000).toISOString() }];
  const out = processUpload(text, null, { marks });
  const w = out.workouts.filter(x => x.id.startsWith("w_"));
  assert.equal(w.length, 1); assert.equal(w[0].id, "w_" + "b".repeat(16)); assert.ok(Math.abs(w[0].min - 12) < 0.5);
  assert.deepEqual(out.removed.sort(), ["w_" + "a".repeat(16), "w_" + "c".repeat(16)]);
});

test("Watch: Pause mitten im Training ergibt ein Training ohne Pausenzeit", async () => {
  const { processUpload } = await import("../public/health.js");
  const t0 = Date.parse("2026-11-20T11:00:00Z"), hr = [], st = [];
  const add = (from, n) => { for (let i = 0; i <= n; i++) { hr.push(100); st.push(new Date(from + i * 10000).toISOString()); } };
  add(t0, 6 * 8); add(t0 + 12 * 60000, 6 * 10); hr.push(70); st.push(new Date(t0 + 40 * 60000).toISOString());   // 8 Min., 4 Min. Pause, 10 Min.
  const text = JSON.stringify({ typ: "Heart Rate", werte: hr.join("\n"), start: st.join("\n") });
  const out = processUpload(text, null, { marks: [{ id: "1".repeat(16), kind: "Core-Training", end: new Date(t0 + 8.5 * 60000).toISOString() }, { id: "2".repeat(16), kind: "Core-Training", end: new Date(t0 + 23 * 60000).toISOString() }] });
  const w = out.workouts.filter(x => x.id.startsWith("w_"));
  assert.equal(w.length, 1); assert.ok(Math.abs(w[0].min - 18) < 0.5, "8 + 10 Min.: " + w[0].min);
  assert.equal(w[0].start, new Date(t0).toISOString()); assert.deepEqual(out.removed, ["w_" + "2".repeat(16)]);
});
