// Apple-Health-Daten: welche Werte es gibt, wie sie heißen und wie aus Einzelmessungen Tageswerte werden.
// Wird vom Server (Import) und von der Oberfläche (Anzeige) benutzt. Keine Abhängigkeiten.

export const TZ = "Europe/Berlin";

// Tageswerte. agg: sum (Summe, je Quelle – höchste Quelle zählt, damit iPhone + Watch nicht doppelt zählen),
// avg (Durchschnitt), hr (min/Ø/max), stand (Stehstunden zählen), sleep (Schlafphasen), workout (Trainings)
// better: "high" / "low" = was eine Verbesserung ist (für die Pfeile in der Statistik)
export const METRICS = {
  steps:        { label: "Schritte", unit: "", dec: 0, agg: "sum", group: "Aktivität", better: "high" },
  dist:         { label: "Geh- & Laufstrecke", unit: "km", dec: 1, agg: "sum", group: "Aktivität", better: "high" },
  active_kcal:  { label: "Aktive Energie", unit: "kcal", dec: 0, agg: "sum", group: "Aktivität", better: "high" },
  exercise_min: { label: "Trainingsminuten", unit: "Min.", dec: 0, agg: "sum", group: "Aktivität", better: "high" },
  stand_h:      { label: "Stehstunden", unit: "h", dec: 0, agg: "stand", group: "Aktivität", better: "high" },
  stand_min:    { label: "Stehminuten", unit: "Min.", dec: 0, agg: "sum", group: "Aktivität", better: "high" },
  floors:       { label: "Etagen", unit: "", dec: 0, agg: "sum", group: "Aktivität", better: "high" },
  rhr:          { label: "Ruhepuls", unit: "bpm", dec: 0, agg: "avg", group: "Herz", better: "low" },
  hr_avg:       { label: "Puls Ø", unit: "bpm", dec: 0, agg: "derived", group: "Herz" },
  hr_min:       { label: "Puls min.", unit: "bpm", dec: 0, agg: "derived", group: "Herz" },
  hr_max:       { label: "Puls max.", unit: "bpm", dec: 0, agg: "derived", group: "Herz" },
  hrv:          { label: "HRV", unit: "ms", dec: 0, agg: "avg", group: "Herz", better: "high" },
  vo2:          { label: "VO₂max", unit: "", dec: 1, agg: "avg", group: "Herz", better: "high" },
  hr_recovery:  { label: "Puls-Erholung", unit: "bpm", dec: 0, agg: "avg", group: "Herz", better: "high" },
  walk_hr:      { label: "Gehpuls", unit: "bpm", dec: 0, agg: "avg", group: "Herz", better: "low" },
  spo2:         { label: "Blutsauerstoff", unit: "%", dec: 0, agg: "avg", group: "Herz" },
  bp_sys:       { label: "Blutdruck systolisch", unit: "mmHg", dec: 0, agg: "avg", group: "Herz" },
  bp_dia:       { label: "Blutdruck diastolisch", unit: "mmHg", dec: 0, agg: "avg", group: "Herz" },
  sleep_total:  { label: "Schlaf", unit: "h", dec: 1, agg: "derived", group: "Schlaf", better: "high" },
  sleep_deep:   { label: "Tiefschlaf", unit: "h", dec: 1, agg: "derived", group: "Schlaf" },
  sleep_rem:    { label: "REM", unit: "h", dec: 1, agg: "derived", group: "Schlaf" },
  sleep_core:   { label: "Kernschlaf", unit: "h", dec: 1, agg: "derived", group: "Schlaf" },
  sleep_awake:  { label: "Wach", unit: "h", dec: 1, agg: "derived", group: "Schlaf" },
  resp:         { label: "Atemfrequenz", unit: "/min", dec: 1, agg: "avg", group: "Schlaf" },
  wrist_temp:   { label: "Handgelenktemperatur", unit: "°C", dec: 2, agg: "avg", group: "Schlaf" },
  run_speed:    { label: "Laufgeschwindigkeit", unit: "km/h", dec: 1, agg: "avg", group: "Laufen", better: "high" },
  run_power:    { label: "Laufleistung", unit: "W", dec: 0, agg: "avg", group: "Laufen" },
  run_stride:   { label: "Schrittlänge", unit: "m", dec: 2, agg: "avg", group: "Laufen" },
  run_gct:      { label: "Bodenkontaktzeit", unit: "ms", dec: 0, agg: "avg", group: "Laufen", better: "low" },
  run_vo:       { label: "Vertikale Bewegung", unit: "cm", dec: 1, agg: "avg", group: "Laufen", better: "low" },
  weight:       { label: "Gewicht", unit: "kg", dec: 1, agg: "avg", group: "Körper" },
  bodyfat:      { label: "Körperfett", unit: "%", dec: 1, agg: "avg", group: "Körper", better: "low" },
  lean:         { label: "Fettfreie Masse", unit: "kg", dec: 1, agg: "avg", group: "Körper", better: "high" }
};
export const GROUPS = ["Herz", "Schlaf", "Aktivität", "Laufen", "Körper"];

// Namen der Health-Typen, wie sie im Kurzbefehl heißen (deutsch und englisch). Vergleich ohne Groß/Klein, Leer- und Sonderzeichen.
const NAMES = {
  workout: ["Trainings", "Training", "Workouts", "Workout"],
  hr: ["Herzfrequenz", "Heart Rate", "Puls"],
  steps: ["Schritte", "Steps", "Schrittzahl"],
  dist: ["Walking + Running Distance", "Distance Walking Running", "Strecke (Gehen und Laufen)", "Geh- und Laufstrecke", "Gehen + Laufen (Distanz)", "Gehen + Laufen", "Gehen und Laufen", "Distanz (Gehen + Laufen)", "Walking + Running Distance", "Walking Running Distance"],
  active_kcal: ["Active Energy Burned", "Active Calories", "Aktivitätsenergie", "Aktive Energie", "Aktiver Energieverbrauch", "Active Energy", "Active Energy Burned"],
  exercise_min: ["Apple Exercise Time", "Exercise Time", "Trainingsminuten", "Trainingszeit", "Exercise Minutes", "Apple Exercise Time"],
  stand_h: ["Stehstunden", "Stehen", "Stand Hours", "Stand Hour", "Apple Stand Hour"],
  stand_min: ["Apple Stand Time", "Stehminuten", "Stand Minutes", "Apple Stand Time", "Stand Time"],
  floors: ["Treppensteigen", "Erklommene Etagen", "Etagen", "Flights Climbed"],
  rhr: ["Ruhepuls", "Ruheherzfrequenz", "Resting Heart Rate"],
  hrv: ["Herzfrequenzvariabilität", "Herzfrequenz-Variabilität", "HRV", "Heart Rate Variability"],
  vo2: ["VO2 Max", "VO₂ Max", "Cardiofitness", "Cardio-Fitness", "VO2 max", "VO2max", "VO₂max", "Cardio Fitness"],
  hr_recovery: ["Heart Rate Recovery One Minute", "Cardio Recovery", "Cardioerholung", "Herzfrequenz-Erholung", "Herzfrequenzerholung", "Cardio-Erholung", "Cardio Recovery", "Heart Rate Recovery"],
  walk_hr: ["Walking Heart Rate Average", "∅-Herzfrequenz (Gehen)", "Ø-Herzfrequenz (Gehen)", "Herzfrequenz (Gehen)", "Gehpuls-Durchschnitt", "Gehpuls", "Durchschnittliche Herzfrequenz beim Gehen", "Walking Heart Rate Average", "Walking Heart Rate"],
  spo2: ["Blood Oxygen Saturation", "Blutsauerstoff", "Sauerstoffsättigung", "Blood Oxygen", "Oxygen Saturation"],
  bp_sys: ["Blood Pressure Systolic", "Blutdruck (systolisch)", "Systolischer Blutdruck", "Blutdruck systolisch", "Blood Pressure Systolic", "Systolic Blood Pressure"],
  bp_dia: ["Blood Pressure Diastolic", "Blutdruck (diastolisch)", "Diastolischer Blutdruck", "Blutdruck diastolisch", "Blood Pressure Diastolic", "Diastolic Blood Pressure"],
  sleep: ["Sleep Analysis", "Schlaf", "Schlafanalyse", "Sleep", "Sleep Analysis"],
  resp: ["Atemfrequenz", "Respiratory Rate"],
  wrist_temp: ["Apple Sleeping Wrist Temperature", "Sleeping Wrist Temperature", "Temperatur am Handgelenk", "Handgelenktemperatur", "Handgelenktemperatur im Schlaf", "Temperatur am Handgelenk im Schlaf", "Wrist Temperature", "Sleeping Wrist Temperature"],
  run_speed: ["Laufgeschwindigkeit", "Running Speed"],
  run_power: ["Laufleistung", "Running Power"],
  run_stride: ["Schrittlänge beim Laufen", "Schrittlänge", "Running Stride Length"],
  run_gct: ["Bodenkontaktzeit", "Bodenkontaktzeit beim Laufen", "Running Ground Contact Time"],
  run_vo: ["Running Vertical Oscillation", "Vertical Oscillation", "Vertikale Oszillation", "Vertikale Bewegung beim Laufen", "Vertikale Bewegung", "Running Vertical Oscillation"],
  weight: ["Gewicht", "Körpergewicht", "Weight", "Body Mass"],
  bodyfat: ["Körperfettanteil", "Körperfett", "Body Fat Percentage", "Body Fat"],
  lean: ["Lean Body Mass", "Magere Körpermasse", "Fettfreie Körpermasse", "Fettfreie Masse", "Muskelmasse"]
};
const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/₂/g, "2").replace(/[^a-z0-9]/g, "");
const NAME_MAP = new Map();
for (const [k, list] of Object.entries(NAMES)) for (const n of list) NAME_MAP.set(norm(n), k);
export function typeKey(name) { return NAME_MAP.get(norm(name)) || null; }

// Liste der Typen für die Anleitung (deutsche Namen wie in der Kurzbefehle-App)
// Liste der Typen für den Kurzbefehl – genau so geschrieben wie in der Kurzbefehle-App (iOS, deutsch)
export const SHORTCUT_TYPES = ["Schritte", "Strecke (Gehen und Laufen)", "Aktivitätsenergie", "Trainingsminuten", "Stehminuten", "Treppensteigen",
  "Ruheherzfrequenz", "Herzfrequenz", "Herzfrequenzvariabilität", "Cardiofitness", "Cardioerholung", "Blutsauerstoff",
  "Systolischer Blutdruck", "Diastolischer Blutdruck", "Schlaf", "Atemfrequenz", "Temperatur am Handgelenk",
  "Laufgeschwindigkeit", "Laufleistung", "Schrittlänge beim Laufen", "Bodenkontaktzeit", "Vertikale Oszillation", "Gewicht", "Körperfettanteil", "Magere Körpermasse"];

/* ---------- Werte lesen (Kurzbefehle liefern Listen oder Text mit Zeilenumbrüchen) ---------- */
export function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(/\r?\n/).map(s => s.trim()).filter(s => s.length);
  return [v];
}
// Zahl aus "60", 60, "60,5", "8,2 km", "1.234,5" …; gibt { n, unit } zurück
export function parseNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? { n: v, unit: "" } : null;
  const s = String(v == null ? "" : v).trim();
  const sci = s.match(/^(-?\d+(?:\.\d+)?[eE][+-]?\d+)\s*(.*)$/);   // z. B. 6.627e-05 (kleine Strecken)
  if (sci) { const n = Number(sci[1]); return Number.isFinite(n) ? { n, unit: sci[2].trim() } : null; }
  const m = s.match(/^(-?[\d.,]+)\s*(.*)$/);
  if (!m) return null;
  let t = m[1];
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? { n, unit: m[2].trim() } : null;
}

// Zeitpunkt → Millisekunden. ISO (mit/ohne Zeitzone), „19.11.2026, 08:31(:05)“, „19.11.26 um 8:31“, englische Formate.
// Zeitzonen-Versatz (Minuten) – je Stunde zwischengespeichert, weil Intl sonst bei vielen Messungen sehr langsam ist
let TZF = null;
const OFF = new Map();
function tzOffsetMin(ms) {
  const hk = Math.floor(ms / 3600000);
  let o = OFF.get(hk);
  if (o !== undefined) return o;
  TZF = TZF || new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const t = hk * 3600000, p = TZF.formatToParts(new Date(t)), g = k => Number(p.find(x => x.type === k).value);
  o = (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - t) / 60000;
  OFF.set(hk, o);
  return o;
}
function localToMs(y, mo, d, h, mi, s) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let ms = guess - tzOffsetMin(guess) * 60000;
  ms = guess - tzOffsetMin(ms) * 60000;
  return ms;
}
const PT = new Map();
export function parseTime(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const s = String(v).trim();
  const c = PT.get(s); if (c !== undefined) return c;
  const r = parseTime0(s);
  if (PT.size > 200000) PT.clear();
  PT.set(s, r);
  return r;
}
function parseTime0(s) {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    if (m[7]) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] || "00"}${m[7].length === 5 ? m[7].slice(0, 3) + ":" + m[7].slice(3) : m[7]}`);
    return localToMs(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(?:um\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return localToMs(y, +m[2], +m[1], +m[4], +m[5], +(m[6] || 0)); }
  m = s.match(/^(\d{1,2})\.\s*([A-Za-zäÄ]+)\.?\s*(\d{4}),?\s*(?:um\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const mon = ["jan", "feb", "mär", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"].findIndex(x => m[2].toLowerCase().replace("ae", "ä").startsWith(x)) + 1;
    if (mon > 0) return localToMs(+m[3], mon, +m[1], +m[4], +m[5], +(m[6] || 0));
  }
  const p = Date.parse(s.replace(/\s+at\s+/i, " ").replace(/\s+um\s+/i, " "));
  return p;
}
export function localDate(ms) {
  return new Date(ms + tzOffsetMin(ms) * 60000).toISOString().slice(0, 10);
}

// Einheiten angleichen
function convert(key, n, unit) {
  const u = String(unit || "").toLowerCase().replace(/\s/g, "");
  if (key === "dist") return u === "m" ? n / 1000 : u === "mi" ? n * 1.609344 : u === "yd" ? n * 0.0009144 : n;
  if (key === "active_kcal") return u === "kj" ? n / 4.184 : n;
  if (key === "weight" || key === "lean") return u === "lb" || u === "lbs" ? n * 0.45359237 : u === "g" ? n / 1000 : n;
  if (key === "spo2" || key === "bodyfat") return n <= 1 && u !== "%" ? n * 100 : n;
  if (key === "run_speed") return u === "m/s" || u === "ms" ? n * 3.6 : u === "mi/h" || u === "mph" ? n * 1.609344 : n;
  if (key === "run_stride") return u === "cm" ? n / 100 : n;
  if (key === "run_gct") return u === "s" ? n * 1000 : n;
  if (key === "run_vo") return u === "m" ? n * 100 : u === "mm" ? n / 10 : n;
  if (key === "wrist_temp") return u.includes("f") ? n * 5 / 9 : n;   // Abweichung in °F → °C
  if (key === "exercise_min") return u === "s" ? n / 60 : u === "h" || u === "hr" ? n * 60 : n;
  return n;
}

// Summe ohne Doppelzählung wie in der Health-App: Die Quelle mit den meisten Messungen (meist die Watch) zählt voll,
// andere Quellen (iPhone) nur für Zeiten, in denen die Hauptquelle nichts gemessen hat.
function dedupSum(list, val) {
  const ok = list.map(x => ({ x, v: val(x) })).filter(o => Number.isFinite(o.v));
  if (!ok.length) return null;
  const cnt = new Map(); for (const o of ok) cnt.set(o.x.src, (cnt.get(o.x.src) || 0) + 1);
  const srcs = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
  const main = (srcs.find(([s]) => /watch/i.test(s)) || srcs[0])[0];
  const mainIv = ok.filter(o => o.x.src === main).map(o => [o.x.s, Math.max(o.x.e, o.x.s + 60000)]).sort((a, b) => a[0] - b[0]);
  const maxEnd = []; let m = -Infinity; for (const iv of mainIv) { m = Math.max(m, iv[1]); maxEnd.push(m); }
  const covered = (s, e) => {   // gibt es ein Intervall der Hauptquelle, das [s, e] überlappt?
    let lo = 0, hi = mainIv.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (mainIv[mid][0] < e) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    return idx >= 0 && maxEnd[idx] > s;
  };
  let sum = 0;
  for (const o of ok) if (o.x.src === main || !covered(o.x.s, Math.max(o.x.e, o.x.s + 60000))) sum += o.v;
  return sum;
}
function union(intervals) {
  const a = intervals.filter(i => i[1] > i[0]).sort((x, y) => x[0] - y[0]);
  let total = 0, cs = -1, ce = -1;
  for (const [s, e] of a) { if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; } else if (e > ce) ce = e; }
  if (ce > cs) total += ce - cs;
  return total;
}
function sleepStage(v) {
  const t = String(v || "").toLowerCase();
  if (/bett|inbed|in bed/.test(t)) return "inbed";
  if (/wach|awake/.test(t)) return "awake";
  if (/tief|deep/.test(t)) return "deep";
  if (/rem/.test(t)) return "rem";
  if (/kern|core|leicht|light/.test(t)) return "core";
  if (/schlaf|asleep|sleep/.test(t)) return "asleep";
  const n = Number(t);   // HealthKit-Codes: 0 im Bett, 1 schlafend, 2 wach, 3 Kern, 4 Tief, 5 REM
  return ["inbed", "asleep", "awake", "core", "deep", "rem"][n] || null;
}

/* ---------- Auswertung einer Übertragung ---------- */
// items: [{ typ, werte, start, ende, quelle, einheit }] – Felder als Liste oder Text.
// Gibt { daily: [{date, metric, value}], workouts: [...], summary: [{typ, key, count, days}] } zurück.
// Ein Eintrag darf auch viele Typen enthalten (typ als Liste, eine Zeile je Messung) – dann wird er nach Typ aufgeteilt.
export function splitByType(items) {
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== "object") continue;
    const typs = asList(it.typ ?? it.type ?? it.Typ);
    if (typs.length <= 1) { out.push(it); continue; }
    const f = k => asList(it[k] ?? it[k.charAt(0).toUpperCase() + k.slice(1)]);
    const W = f("werte"), S = f("start"), E = f("ende"), Q = f("quelle"), U = f("einheit");
    const groups = new Map();
    typs.forEach((t, i) => {
      if (!groups.has(t)) groups.set(t, { typ: t, werte: [], start: [], ende: [], quelle: [], einheit: [] });
      const g = groups.get(t); g.werte.push(W[i]); g.start.push(S[i]); g.ende.push(E[i] ?? S[i]); g.quelle.push(Q[i] ?? ""); g.einheit.push(U[i] ?? "");
    });
    out.push(...groups.values());
  }
  return out;
}
export function aggregate(items0, opts = {}) {
  const items = splitByType(items0);
  const samples = {}, summary = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const typ = String(it.typ ?? it.type ?? it.Typ ?? "").slice(0, 60);
    const key = typeKey(typ);
    const vals = asList(it.werte ?? it.wert ?? it.values ?? it.Werte), st = asList(it.start ?? it.starts ?? it.Startdatum), en = asList(it.ende ?? it.ends ?? it.Enddatum);
    const src = asList(it.quelle ?? it.sources ?? it.Quelle), units = asList(it.einheit ?? it.unit ?? it.Einheit);
    const list = [];
    const n = Math.max(vals.length, st.length);
    for (let i = 0; i < n && i < 50000; i++) {
      const s = parseTime(st[i]), e = parseTime(en[i] ?? st[i]);
      if (!Number.isFinite(s)) continue;
      list.push({ v: vals[i], s, e: Number.isFinite(e) && e >= s ? e : s, src: String(src[i] ?? src[0] ?? ""), unit: String(units[i] ?? units[0] ?? "") });
    }
    summary.push({ typ, key, count: list.length, days: new Set(list.map(x => localDate(x.s))).size });
    if (key && list.length) (samples[key] = samples[key] || []).push(...list);
  }
  const daily = [];
  const put = (date, metric, value) => { if (Number.isFinite(value)) daily.push({ date, metric, value: Math.round(value * 1000) / 1000 }); };
  const num = (key, x) => { const p = parseNum(x.v); return p ? convert(key, p.n, x.unit || p.unit) : NaN; };
  const byDay = (list, f = x => x.s) => { const m = new Map(); for (const x of list) { const d = localDate(f(x)); if (!m.has(d)) m.set(d, []); m.get(d).push(x); } return m; };
  // Der früheste Tag einer Übertragung ist meist nur teilweise enthalten → weglassen, wenn mehrere Tage da sind
  const drop = m => { if (m.size > 1) m.delete([...m.keys()].sort()[0]); return m; };

  for (const [key, list] of Object.entries(samples)) {
    const def = METRICS[key];
    if (key === "workout" || key === "sleep") continue;
    if (key === "hr") {
      for (const [d, l] of drop(byDay(list))) { const v = l.map(x => num(key, x)).filter(Number.isFinite); if (!v.length) continue;
        put(d, "hr_avg", v.reduce((a, b) => a + b, 0) / v.length); put(d, "hr_min", Math.min(...v)); put(d, "hr_max", Math.max(...v)); }
      continue;
    }
    if (!def) continue;
    for (const [d, l] of drop(byDay(list))) {
      if (def.agg === "sum") {
        const v = dedupSum(l, x => num(key, x));
        if (v != null) put(d, key, v);
      } else if (def.agg === "stand") {
        const v = l.map(x => parseNum(x.v));
        if (v.every(Boolean)) put(d, key, v.reduce((a, p) => a + p.n, 0));
        else { const hours = new Set(l.filter(x => /steh|stand/i.test(String(x.v)) && !/nicht|idle|untätig/i.test(String(x.v))).map(x => Math.floor(x.s / 3600000))); put(d, key, hours.size); }
      } else {
        const v = l.map(x => num(key, x)).filter(Number.isFinite);
        if (v.length) put(d, key, v.reduce((a, b) => a + b, 0) / v.length);
      }
    }
  }

  // Schlaf: Nacht = Tag des Aufwachens; überlappende Quellen (iPhone + Watch) nur einmal zählen
  if (samples.sleep) {
    // Schlaf zählt zur Nacht, in der er endet – wie Apple Health mit Grenze 18 Uhr: was nach 18 Uhr endet, gehört zum nächsten Tag
    // (sonst landet z. B. 22:30–23:59 beim Vortag und fehlt in der Nacht)
    const nights = drop(byDay(samples.sleep, x => x.e + 6 * 3600000));
    for (const [d, l] of nights) {
      const st = {}; for (const x of l) { const k = sleepStage(x.v); if (k) (st[k] = st[k] || []).push([x.s, x.e]); }
      const h = ms => ms / 3600000;
      const asleep = [...(st.asleep || []), ...(st.core || []), ...(st.deep || []), ...(st.rem || [])];
      if (asleep.length) put(d, "sleep_total", h(union(asleep)));
      else if (st.inbed) put(d, "sleep_total", h(union(st.inbed)));
      for (const k of ["deep", "rem", "core", "awake"]) if (st[k]) put(d, "sleep_" + k, h(union(st[k])));
    }
  }

  // Trainings: Distanz, Energie, Puls und Laufwerte aus den Messungen im Zeitraum des Trainings
  const workouts = [];
  const inWin = (key, w) => (samples[key] || []).filter(x => x.s >= w.s - 30000 && x.s <= w.e + 30000);
  const sumBest = (key, w) => dedupSum(inWin(key, w), x => num(key, x));
  const avgOf = (key, w) => { const v = inWin(key, w).map(x => num(key, x)).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // Die Kurzbefehle-App liefert keine Trainings. Laufwerte (Geschwindigkeit, Leistung …) misst die Watch aber nur beim Laufen:
  // daraus Läufe erkennen – Messungen mit weniger als 10 Minuten Abstand gehören zusammen, mindestens 8 Minuten lang.
  let wlist = samples.workout || [];
  if (!wlist.length) {
    const rs = ["run_speed", "run_power", "run_stride", "run_gct", "run_vo"].flatMap(k => samples[k] || []).sort((a, b) => a.s - b.s);
    let cur = null;
    for (const x of rs) {
      if (cur && x.s - cur.e <= 600000) cur.e = Math.max(cur.e, x.e);
      else { if (cur) wlist.push(cur); cur = { s: x.s, e: x.e, v: "Laufen (erkannt)", src: x.src }; }
    }
    if (cur) wlist.push(cur);
    wlist = wlist.filter(w => w.e - w.s >= 480000);
  }
  const seen = new Set();
  for (const w of wlist) {
    const id = new Date(Math.round(w.s / 60000) * 60000).toISOString();
    if (seen.has(id)) continue; seen.add(id);
    const label = parseNum(w.v) ? "Training" : String(w.v || "Training").slice(0, 60);
    const hr = inWin("hr", w).map(x => num("hr", x)).filter(Number.isFinite);
    const r = x => x == null ? null : Math.round(x * 100) / 100;
    workouts.push({ id, date: localDate(w.s), start: new Date(w.s).toISOString(), end: new Date(w.e).toISOString(), kind: label,
      run: /lauf|run|jog/i.test(label), min: r((w.e - w.s) / 60000), km: r(sumBest("dist", w)), kcal: r(sumBest("active_kcal", w)),
      hr_avg: hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null, hr_max: hr.length ? Math.max(...hr) : null,
      speed: r(avgOf("run_speed", w)), power: r(avgOf("run_power", w)), stride: r(avgOf("run_stride", w)), gct: r(avgOf("run_gct", w)), source: w.src.slice(0, 60) });
  }
  // Trainings von der Apple-Watch-Automation („Training beendet“): Beginn aus dem dichten Puls während des Trainings
  const hrAll = (samples.hr || []).slice().sort((a, b) => a.s - b.s), removed = [], fromMarks = [];
  for (const m of [...(opts.marks || [])].sort((a, b) => a.end < b.end ? -1 : 1)) {
    const end = Date.parse(m.end), id = "w_" + m.id;
    if (!Number.isFinite(end) || seen.has(id)) continue;
    let j = -1;
    for (let k = hrAll.length - 1; k >= 0; k--) if (hrAll[k].s <= end + 180000) { j = k; break; }
    let start = null, endT = end;
    if (j >= 0 && end - hrAll[j].s < 300000) {
      endT = Math.max(hrAll[j].s, Math.min(end, hrAll[j].e));
      let k = j;
      while (k > 0 && hrAll[k].s - hrAll[k - 1].s <= 120000 && end - hrAll[k - 1].s <= 3 * 3600000) k--;
      if (endT - hrAll[k].s >= 300000) start = hrAll[k].s;
    }
    if (start == null) {
      // Puls nach dem Ende vorhanden, aber kein Trainingsblock: abgebrochenes/verworfenes Training (Watch meldet trotzdem „beendet“)
      if (hrAll.length && hrAll[hrAll.length - 1].s >= end) { removed.push(id); continue; }
      if ((opts.known || []).includes(id)) continue;
      start = end - (/core|mobil|yoga|dehn|flex/i.test(m.kind) ? 15 : 45) * 60000;
    } else {
      // Doppelte Meldung für denselben Trainingsblock: nur einmal speichern
      const dup = fromMarks.find(x => x.s < endT && start < x.e);
      if (dup) { removed.push(id); continue; }
      fromMarks.push({ s: start, e: endT });
    }
    seen.add(id);
    const w = { s: start, e: endT };
    const hr = inWin("hr", w).map(x => num("hr", x)).filter(Number.isFinite);
    const r = x => x == null ? null : Math.round(x * 100) / 100;
    workouts.push({ id, date: localDate(end), start: new Date(start).toISOString(), end: new Date(endT).toISOString(), kind: String(m.kind).slice(0, 60), run: /lauf|run|jog/i.test(m.kind),
      min: r((endT - start) / 60000), km: null, kcal: r(sumBest("active_kcal", w)) || null,
      hr_avg: hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null, hr_max: hr.length ? Math.max(...hr) : null,
      speed: null, power: null, stride: null, gct: null, source: "Apple Watch" });
  }
  return { daily, workouts, summary, removed };
}

/* ---------- Für die Anzeige ---------- */
export function fmtVal(key, v) {
  const d = METRICS[key];
  if (v == null || !Number.isFinite(v)) return "–";
  if (d && d.unit === "h" && key.startsWith("sleep")) { const m = Math.round(v * 60); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") + " h"; }
  const s = v.toFixed(d ? d.dec : 1).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return s + (d && d.unit ? " " + d.unit : "");
}
// Durchschnitt eines Werts über Tage [von, bis] (inklusive), nur vorhandene Tage
export function avgRange(daily, metric, from, to) {
  const v = daily.filter(r => r.metric === metric && r.date >= from && r.date <= to).map(r => r.value);
  return v.length ? { v: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null;
}

/* ---------- Übertragung lesen (im Browser) ---------- */
function parseLoose(t) {
  if (typeof t !== "string") return t;
  const s = t.trim(); if (!s) return null;
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse("[" + s.replace(/}\s*[\r\n,]+\s*{/g, "},{") + "]"); } catch (e) {}
  return s;
}
export function itemsFromText(text) {
  const body = parseLoose(text);
  const items = Array.isArray(body) ? body : body && (body.typ || body.werte) ? [body] : body && (body.daten || body.items || body.data);
  return (Array.isArray(items) ? items : typeof items === "string" ? [parseLoose(items)].flat() : []).flat().map(x => typeof x === "string" ? parseLoose(x) : x).filter(x => x && typeof x === "object");
}
// Kleine Stichprobe je Typ für die Fehlersuche (Einheiten, Quellen) – keine vollständigen Daten
export function probeOf(list) {
  try {
    return splitByType(list).slice(0, 30).map(it => {
      const v = asList(it.werte), q = asList(it.quelle), s = asList(it.start), u = asList(it.einheit);
      const src = {}; q.forEach(x => { const k = String(x).slice(0, 40); src[k] = (src[k] || 0) + 1; });
      return { typ: String(it.typ).slice(0, 50), n: v.length, werte: v.slice(0, 3).map(x => String(x).slice(0, 30)), start: s.slice(0, 1).map(String), einheit: u.slice(0, 1).map(String), quellen: src };
    });
  } catch (e) { return []; }
}
// Ganze Auswertung einer Übertragung: Ergebnis für /api/health/apply
export function processUpload(text, receivedAt, opts = {}) {
  const list = itemsFromText(text);
  const { daily, workouts, summary, removed } = aggregate(list, opts);
  return { daily, workouts, removed, summary: { received: receivedAt || null, items: summary.slice(0, 60), days: daily.length, workouts: workouts.length,
    unknown: summary.filter(s => !s.key).map(s => s.typ).slice(0, 20), empty: summary.filter(s => s.key && !s.count).map(s => s.typ).slice(0, 30),
    sample: list.length ? "" : String(text || "").slice(0, 300), probe: probeOf(list) } };
}
