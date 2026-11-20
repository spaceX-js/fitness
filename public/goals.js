// Ziele: Zielwert setzen, Verlauf aus Health-Daten und Trainingseinträgen, Fortschritt, Trend und Einschätzung.
// Reine Funktionen ohne DOM – im Browser und in Tests nutzbar.
import { EXERCISES } from "./plan.js";

export const GOAL_TYPES = {
  weight:   { label: "Gewicht", short: "Gewicht", unit: "kg", dec: 1, src: "health", metric: "weight", smooth: 7 },
  bodyfat:  { label: "Körperfett", short: "Körperfett", unit: "%", dec: 1, src: "health", metric: "bodyfat", smooth: 7 },
  lean:     { label: "Muskelmasse (fettfreie Masse)", short: "Fettfreie Masse", unit: "kg", dec: 1, src: "health", metric: "lean", smooth: 7 },
  vo2:      { label: "VO₂max (Cardiofitness)", short: "VO₂max", unit: "", dec: 1, src: "health", metric: "vo2", smooth: 0 },
  rhr:      { label: "Ruhepuls", short: "Ruhepuls", unit: "bpm", dec: 0, src: "health", metric: "rhr", smooth: 7 },
  pace:     { label: "Ø Pace beim Laufen", short: "Ø Pace", unit: "min/km", dec: 2, src: "runs" },
  exercise: { label: "Kraftziel (Übung)", short: "Übung", unit: "", dec: 1, src: "logs" },
};
export const GOAL_KEYS = Object.keys(GOAL_TYPES);
const DAY = 86400000;
const t = d => Date.parse(d + "T12:00:00Z");
const iso = ms => new Date(ms).toISOString().slice(0, 10);

export function unitOf(g) { return g.type === "exercise" ? (g.mode === "kg" ? "kg" : EXERCISES[g.ex] && EXERCISES[g.ex].type === "time" ? "s" : "Wdh.") : GOAL_TYPES[g.type].unit; }
export function fmtPace(v) { if (!(v > 0)) return "–"; let m = Math.floor(v), s = Math.round((v - m) * 60); if (s === 60) { m++; s = 0; } return m + ":" + String(s).padStart(2, "0"); }
export function parseGoalValue(type, txt) {
  const s = String(txt || "").trim().replace(",", ".");
  if (type === "pace") { const m = s.match(/^(\d{1,2})[:.](\d{1,2})$/); if (m && +m[2] < 60) return +m[1] + +m[2] / 60; const n = Number(s); return n > 2 && n < 20 ? n : NaN; }
  const n = Number(s); return Number.isFinite(n) && n > 0 ? n : NaN;
}
export function fmtGoal(g, v) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (g.type === "pace") return fmtPace(v) + " min/km";
  const u = unitOf(g), dec = g.type === "exercise" ? (g.mode === "kg" ? 1 : 0) : GOAL_TYPES[g.type].dec;
  return (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString("de-DE", { maximumFractionDigits: dec }) + (u ? (u === "%" ? " %" : " " + u) : "");
}
export function titleOf(g) {
  if (g.type === "exercise") { const e = EXERCISES[g.ex]; return (e ? e.name : "Übung") + (g.mode === "kg" ? " – Gewicht" : ""); }
  return GOAL_TYPES[g.type].short;
}

// Messreihe [{date, v}] aufsteigend
export function seriesOf(g, st) {
  const def = GOAL_TYPES[g.type]; if (!def) return [];
  if (def.src === "health") {
    const H = st.health || {}, rows = [...(H.recent || []), ...(H.daily || [])].filter(r => r.metric === def.metric);
    const m = new Map(); for (const r of rows) m.set(r.date, r.value);
    return [...m].map(([date, v]) => ({ date, v })).sort((a, b) => a.date < b.date ? -1 : 1);
  }
  if (def.src === "runs") {
    const out = new Map();
    for (const l of st.logs || []) if (l.kind === "run" && l.status === "done" && l.data && l.data.km >= 2 && l.data.min > 0) out.set(l.date, l.data.min / l.data.km);
    for (const w of (st.health && st.health.workouts) || []) if (w.run && w.km >= 2 && w.min > 0 && !out.has(w.date)) out.set(w.date, w.min / w.km);
    return [...out].map(([date, v]) => ({ date, v })).sort((a, b) => a.date < b.date ? -1 : 1);
  }
  const out = [];
  for (const l of st.logs || []) {
    if (l.kind !== "strength" || !l.data || !l.data.ex) continue;
    let best = 0;
    for (const e of Object.values(l.data.ex)) if (e && e.id === g.ex) for (const s of e.sets || []) if (s.done) best = Math.max(best, Number(String(g.mode === "kg" ? s.w : s.r).replace(",", ".")) || 0);
    if (best > 0) out.push({ date: l.date, v: best });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
// Aktueller Wert: Waage und Ruhepuls geglättet (Ø 7 Tage bis zum letzten Messtag), Pace Ø der letzten 3 Läufe
export function currentOf(g, series) {
  if (!series.length) return null;
  const last = series[series.length - 1], def = GOAL_TYPES[g.type];
  if (g.type === "pace") { const l = series.slice(-3); return l.reduce((a, b) => a + b.v, 0) / l.length; }
  if (def.smooth) { const from = iso(t(last.date) - (def.smooth - 1) * DAY), l = series.filter(p => p.date >= from); return l.reduce((a, b) => a + b.v, 0) / l.length; }
  return last.v;
}
// Steigung pro Tag (lineare Regression) über die letzten 6 Wochen; null bei zu wenig Daten
export function trendOf(series, today) {
  const from = iso(t(today) - 42 * DAY), p = series.filter(x => x.date >= from);
  if (p.length < 3 || t(p[p.length - 1].date) - t(p[0].date) < 7 * DAY) return null;
  const xs = p.map(x => (t(x.date) - t(p[0].date)) / DAY), ys = p.map(x => x.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? num / den : null;
}

// Alles für eine Zielkarte
export function evaluateGoal(g, st, today) {
  const series = seriesOf(g, st), cur = currentOf(g, series);
  const start = Number.isFinite(g.start) ? g.start : series.length ? series[0].v : null;
  const dir = start == null ? (g.type === "pace" || g.type === "rhr" || g.type === "bodyfat" ? -1 : 1) : Math.sign(g.target - start) || 1;
  const out = { goal: g, title: titleOf(g), series, current: cur, start, dir, progress: 0, trend: null, status: "wait", text: "", warn: "" };
  if (cur == null) { out.text = g.type === "pace" ? "Noch keine Läufe mit Dauer und Strecke." : g.type === "exercise" ? "Noch keine Sätze eingetragen." : "Noch keine Werte aus Apple Health."; return out; }
  const total = g.target - start;
  out.progress = total ? Math.max(0, Math.min(1, (cur - start) / total)) : 1;
  const left = g.target - cur;
  if (Math.sign(left) !== dir || Math.abs(left) < 1e-9) { out.status = "done"; out.progress = 1; out.text = "Ziel erreicht 🎉"; return out; }
  const slope = trendOf(series, today); out.trend = slope;
  const perWeek = v => fmtGoal(g, Math.abs(v) * 7).replace(/ min\/km$/, "") + (g.type === "pace" ? " min/km" : "") + " pro Woche";
  const daysLeft = g.until ? Math.round((t(g.until) - t(today)) / DAY) : null;
  if (daysLeft != null && daysLeft <= 0) { out.status = "late"; out.text = "Zieldatum vorbei – noch " + fmtGoal(g, Math.abs(left)) + " bis zum Ziel."; }
  else if (slope == null) { out.status = "wait"; out.text = "Noch zu wenige Werte für eine Prognose." + (daysLeft ? " Nötig: " + perWeek(left / daysLeft) + "." : ""); }
  else if (Math.sign(slope) !== dir || Math.abs(slope) < 1e-6) { out.status = "off"; out.text = "Der Trend geht noch nicht Richtung Ziel." + (daysLeft ? " Nötig: " + perWeek(left / daysLeft) + "." : ""); }
  else {
    const eta = iso(t(today) + Math.ceil(left / slope) * DAY);
    if (daysLeft == null) { out.status = "ok"; out.text = "Bei diesem Tempo erreicht um den " + fmtD(eta) + "."; }
    else if (Math.abs(slope) >= 0.85 * Math.abs(left / daysLeft)) { out.status = "ok"; out.text = "Im Plan – voraussichtlich am " + fmtD(eta) + "."; }
    else { out.status = "slow"; out.text = "Etwas zu langsam: nötig " + perWeek(left / daysLeft) + ", aktuell " + perWeek(slope) + "."; }
  }
  // Gesundheits-Hinweise
  if (g.type === "weight" && slope != null && slope < -0.1) out.warn = "Du nimmst mehr als 0,7 kg pro Woche ab – dabei gehen leicht Muskeln verloren. Etwas mehr essen, vor allem Eiweiß.";
  else if (g.type === "weight" && dir < 0 && daysLeft > 0 && -left / daysLeft * 7 > 0.7 && !out.warn) out.warn = "Ehrgeiziges Datum: mehr als 0,7 kg pro Woche. Ein späteres Datum schont die Muskeln.";
  if (g.type === "lean" && slope != null && slope < -0.03) out.warn = "Die fettfreie Masse sinkt – mehr Eiweiß und Krafttraining nicht auslassen.";
  return out;
}
function fmtD(d) { const [y, m, dd] = d.split("-"); return +dd + "." + +m + "." + (y !== String(new Date().getFullYear()) ? y : ""); }

// Eingabe prüfen (auch auf dem Server genutzt)
export function cleanGoals(list) {
  const out = [];
  for (const g of Array.isArray(list) ? list.slice(0, 10) : []) {
    if (!g || !GOAL_TYPES[g.type] || !(typeof g.target === "number" && g.target > 0 && g.target < 10000)) continue;
    if (g.type === "exercise" && !EXERCISES[g.ex]) continue;
    const id = typeof g.id === "string" && /^[a-z0-9]{4,16}$/.test(g.id) ? g.id : Math.random().toString(36).slice(2, 10);
    const date = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    out.push({ id, type: g.type, target: g.target, start: typeof g.start === "number" && g.start > 0 ? g.start : null, created: date(g.created), until: date(g.until),
      ...(g.type === "exercise" ? { ex: g.ex, mode: g.mode === "kg" ? "kg" : "reps" } : {}) });
  }
  return out;
}
