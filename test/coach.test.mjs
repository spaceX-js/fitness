// Tests für Plan und Coach-Regeln (laufen ohne Browser)
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionFor, runFor, weekOf, EXERCISES, DEFAULT_PLAN, validatePlan, diffPlans, swapDays } from "../public/plan.js";
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
  assert.equal(runFor(DEFAULT_PLAN, "interval", 6).short, "4 × 4 Min. schnell");
  assert.equal(runFor(DEFAULT_PLAN, "long", 8).km, 10);
  // Woche 5 = Deload: ein Satz weniger
  const w5 = sessionFor("2026-11-30", base);
  assert.equal(w5.week, 5);
  assert.equal(w5.items[0].sets, 3);
  assert.equal(DEFAULT_PLAN.mobility.length, 16);
});

test("Jede Übung hat eine Animation und Hinweise", () => {
  for (const [id, e] of Object.entries(EXERCISES)) { assert.ok(ANIMS[e.anim], id + " ohne Animation"); assert.ok(e.cues.length >= 2, id); }
  assert.ok(!validatePlan(DEFAULT_PLAN).error, validatePlan(DEFAULT_PLAN).error);
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

test("Plan prüfen und Unterschiede beschreiben", () => {
  const p = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  p.workouts.gym.items.find(i => i.id === "machinepress").sets = 3;
  p.workouts.homeA.items.splice(4, 1);
  p.workouts.homeB.items.push({ id: "plank", sets: 3, reps: [30, 60] });
  assert.deepEqual(diffPlans(DEFAULT_PLAN, p), ["Home Workout A: − Seitheben", "Schulterdrücken: 2 → 3 Sätze", "Home Workout B: + Unterarmstütz"]);
  assert.match(validatePlan({ ...p, days: p.days.slice(0, 6) }).error, /7 Wochentage/);
  const bad = JSON.parse(JSON.stringify(p)); bad.workouts.gym.items[0].id = "gibtsnicht";
  assert.match(validatePlan(bad).error, /ungültig/);
  const dup = JSON.parse(JSON.stringify(p)); dup.workouts.gym.items.push({ id: "legpress", sets: 2, reps: [8, 10] });
  assert.match(validatePlan(dup).error, /doppelt/);
});

test("Nur heute: überspringen, ersetzen, zusätzliche Übung", () => {
  const today = { skip: { pullup: true }, swap: { ringrow: "birddog" }, extra: [{ slot: "x1", id: "plank", sets: 3, reps: [30, 60] }] };
  const s = sessionFor("2026-11-16", base, today);
  assert.equal(s.items.find(i => i.slot === "pullup").skipped, true);
  const rr = s.items.find(i => i.slot === "ringrow");
  assert.equal(rr.id, "birddog"); assert.equal(rr.swappedToday, true);
  const x = s.items[s.items.length - 1];
  assert.equal(x.id, "plank"); assert.equal(x.extra, true);
  // ohne heutige Änderungen alles wie im Plan
  assert.equal(sessionFor("2026-11-16", base).items.length, 8);
});

test("Tage in der Woche tauschen, ohne den Plan zu ändern", () => {
  const ov = swapDays({}, "2026-11-18", "2026-11-17");    // Fitnessstudio Mi → Di
  assert.deepEqual(ov.moves["2026-11-16"], [0, 2, 1, 3, 4, 5, 6]);
  const st = { ...base, overrides: ov };
  assert.equal(sessionFor("2026-11-17", st).title, "Fitnessstudio");
  assert.equal(sessionFor("2026-11-17", st).movedFrom, 2);
  assert.equal(sessionFor("2026-11-18", st).title, "Lauf – Zone 2");
  assert.equal(sessionFor("2026-11-24", st).title, "Lauf – Zone 2", "nächste Woche wieder normal");
  assert.equal(swapDays(ov, "2026-11-17", "2026-11-18").moves["2026-11-16"], undefined, "zurücktauschen = wie im Plan");
});
