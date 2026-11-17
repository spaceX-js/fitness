// Tests für Plan und Coach-Regeln (laufen ohne Browser)
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionFor, runFor, weekOf, EXERCISES, WORKOUTS, MOBILITY } from "../public/plan.js";
import { suggestions, applyOp, plannedSession } from "../public/coach.js";
import { ANIMS } from "../public/anim.js";

const base = { start: "2026-11-02", overrides: {}, status: {}, decisions: {}, logs: [] };
const sets = (r, w = "") => Array.from({ length: 4 }, () => ({ r: String(r), w: String(w), done: true }));

test("Plan: Wochen und Tage wie im Trainingsplan", () => {
  assert.equal(weekOf("2026-11-02", "2026-11-17"), 3);
  assert.equal(sessionFor("2026-11-16", base).title, "Home Workout A");
  assert.equal(sessionFor("2026-11-17", base).title, "Lauf – Zone 2");
  assert.equal(sessionFor("2026-11-18", base).title, "Fitnessstudio");
  assert.equal(sessionFor("2026-11-19", base).kind, "recovery");
  assert.equal(runFor("interval", 6).short, "4 × 4 Min. schnell");
  assert.equal(runFor("long", 8).km, 10);
  // Woche 5 = Deload: ein Satz weniger
  const w5 = sessionFor("2026-11-30", base);
  assert.equal(w5.week, 5);
  assert.equal(w5.items[0].sets, 3);
  assert.equal(MOBILITY.length, 16);
});

test("Jede Übung hat eine Animation und Hinweise", () => {
  for (const [id, e] of Object.entries(EXERCISES)) { assert.ok(ANIMS[e.anim], id + " ohne Animation"); assert.ok(e.cues.length >= 2, id); }
  for (const w of Object.values(WORKOUTS)) for (const [id] of w.items) assert.ok(EXERCISES[id], id);
});

test("Steigern nach zwei Einheiten am oberen Ende; mit Gewicht konkret", () => {
  const logs = [
    { id: "2026-11-02-main", date: "2026-11-02", kind: "strength", status: "done", data: { feel: 3, ex: { pullup: { id: "pullup", sets: sets(10) }, dbpress: { id: "dbpress", sets: sets(12, 14) } } } },
    { id: "2026-11-09-main", date: "2026-11-09", kind: "strength", status: "done", data: { feel: 3, ex: { pullup: { id: "pullup", sets: sets(11) }, dbpress: { id: "dbpress", sets: sets(12, 14) } } } }
  ];
  const s = suggestions({ ...base, logs }, "2026-11-10");
  assert.ok(s.find(x => x.key.startsWith("up-pullup")));
  const db = s.find(x => x.key.startsWith("up-dbpress"));
  assert.match(db.text, /16,5 kg/);
  const n = applyOp({ ...base, logs }, db.actions[0].op, "2026-11-10");
  assert.equal(n.overrides.ex.dbpress.weight, 16.5);
  assert.equal(sessionFor("2026-11-16", { ...base, overrides: n.overrides }).items[3].weight, 16.5);
});

test("Einschränkung Knie: Ersatz für betroffene Übungen, danach zurück", () => {
  const st = { ...base, status: { limits: [{ region: "knie", since: "2026-11-10" }] } };
  const s = suggestions(st, "2026-11-10").find(x => x.key.startsWith("limit-"));
  assert.ok(s);
  assert.ok(s.list.some(l => l.startsWith("Beinpresse")));
  const n = applyOp(st, s.actions[0].op, "2026-11-10");
  assert.equal(n.overrides.ex.splitsquat.swap, "glutebridge");
  assert.equal(sessionFor("2026-11-21", { ...st, overrides: n.overrides }).items[2].name, "Glute Bridge");
  const back = suggestions({ ...base, overrides: n.overrides }, "2026-11-20").find(x => x.key.startsWith("unlimit-"));
  assert.ok(back);
  assert.deepEqual(applyOp({ ...base, overrides: n.overrides }, back.actions[0].op, "2026-11-20").overrides.ex, {});
});

test("Krank: Körper = Pause, Kopf = locker; nach einer Woche Plan verschieben", () => {
  const body = { ...base, status: { sick: { level: "body", since: "2026-11-10" } } };
  assert.equal(plannedSession("2026-11-17", body).blocked, true);
  const s = suggestions(body, "2026-11-17");
  assert.equal(s[0].level, "stop");
  const shift = s.find(x => x.key.startsWith("sick-long"));
  assert.equal(applyOp(body, shift.actions[0].op, "2026-11-17").start, "2026-11-09");
  const head = { ...base, status: { sick: { level: "head", since: "2026-11-16" } } };
  assert.match(plannedSession("2026-11-17", head).short, /max. 30 Min/);
  assert.equal(plannedSession("2026-11-16", head).items[0].sets, 3);
  const rec = applyOp(head, { type: "recovered" }, "2026-11-18");
  assert.equal(rec.status.sick, undefined);
  assert.equal(rec.status.back, "2026-11-18");
});

test("Abgelehnte Empfehlungen kommen nicht wieder", () => {
  const st = { ...base, status: { limits: [{ region: "knie", since: "2026-11-10" }] } };
  const s = suggestions(st, "2026-11-10")[0];
  assert.equal(suggestions({ ...st, decisions: { [s.key]: "dismissed" } }, "2026-11-10").find(x => x.key === s.key), undefined);
});
