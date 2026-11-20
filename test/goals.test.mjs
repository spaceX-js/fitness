import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGoal, parseGoalValue, fmtGoal, cleanGoals, trendOf } from "../public/goals.js";

const days = (n, f, end = "2026-11-20") => Array.from({ length: n }, (_, i) => { const d = new Date(Date.parse(end + "T12:00:00Z") - (n - 1 - i) * 86400000).toISOString().slice(0, 10); return { date: d, value: f(i) }; });

test("Gewichtsziel: Fortschritt, Prognose, Warnung bei zu schnell", () => {
  const st = { health: { daily: days(28, i => 75 - i * 0.05).map(r => ({ ...r, metric: "weight" })) }, logs: [] };
  const g = { id: "a1", type: "weight", target: 70, start: 75 };
  const e = evaluateGoal(g, st, "2026-11-20");
  assert.ok(e.current < 74 && e.current > 73.3, "geglättet: " + e.current);
  assert.ok(e.progress > 0.2 && e.progress < 0.3);
  assert.equal(e.status, "ok"); assert.match(e.text, /erreicht um den/);
  assert.equal(e.warn, "");
  const fast = { health: { daily: days(21, i => 80 - i * 0.2).map(r => ({ ...r, metric: "weight" })) }, logs: [] };
  assert.match(evaluateGoal({ ...g, start: 80 }, fast, "2026-11-20").warn, /0,7 kg/);
  const slow = evaluateGoal({ ...g, until: "2026-12-10" }, st, "2026-11-20");
  assert.equal(slow.status, "slow");
  const done = evaluateGoal({ ...g, target: 74 }, st, "2026-11-20");
  assert.equal(done.status, "done"); assert.equal(done.progress, 1);
});

test("Pace-Ziel aus Läufen, VO2max ohne Werte, Kraftziel aus Sätzen", () => {
  assert.equal(parseGoalValue("pace", "5:30"), 5.5); assert.ok(Number.isNaN(parseGoalValue("pace", "5:75")));
  assert.equal(fmtGoal({ type: "pace" }, 5.5), "5:30 min/km");
  const logs = [["2026-11-01", 36, 6], ["2026-11-08", 35, 6], ["2026-11-15", 34, 6]].map(([date, min, km]) => ({ date, kind: "run", status: "done", data: { min, km } }));
  const e = evaluateGoal({ type: "pace", target: 5.5, start: 6 }, { logs, health: {} }, "2026-11-20");
  assert.equal(Math.round(e.current * 100) / 100, 5.83); assert.equal(e.dir, -1); assert.equal(e.status, "ok");
  assert.equal(evaluateGoal({ type: "vo2", target: 52 }, { logs: [], health: {} }, "2026-11-20").status, "wait");
  const sl = [{ date: "2026-11-10", kind: "strength", data: { ex: { a1: { id: "pullup", sets: [{ r: "6", done: true }, { r: "8", done: true }, { r: "12", done: false }] } } } }];
  const k = evaluateGoal({ type: "exercise", ex: "pullup", mode: "reps", target: 10 }, { logs: sl, health: {} }, "2026-11-20");
  assert.equal(k.current, 8); assert.equal(fmtGoal(k.goal, 8), "8 Wdh.");
});

test("Ziele werden geprüft", () => {
  const c = cleanGoals([{ type: "weight", target: 70, start: 73, until: "2027-03-01", id: "abcd1234" }, { type: "x", target: 1 }, { type: "exercise", ex: "nope", target: 3 }, { type: "pace", target: -1 }, { type: "exercise", ex: "pullup", target: 10, mode: "<b>" }]);
  assert.equal(c.length, 2); assert.equal(c[1].mode, "reps"); assert.equal(c[0].until, "2027-03-01");
  assert.equal(trendOf([{ date: "2026-11-19", v: 1 }, { date: "2026-11-20", v: 2 }], "2026-11-20"), null);
});
