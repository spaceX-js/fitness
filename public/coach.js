// Coach: Empfehlungen zur Anpassung des Plans – nach Leistung, Gefühl, Krankheit und Einschränkungen.
// Reine Regeln, keine KI und kein Fremddienst. Jede Empfehlung erklärt ihren Grund und wird nur auf Knopfdruck übernommen.
import { EXERCISES, REGIONS, sessionFor, weekOf, dayIndex, planOf, slotOf } from "./plan.js";

export const SICK = {
  head: { label: "Erkältet (nur Kopf)", text: "Schnupfen, Halskratzen – nur oberhalb des Halses" },
  body: { label: "Krank (Körper / Fieber)", text: "Fieber, Gliederschmerzen, Husten, Magen-Darm" }
};
export const FEEL = ["", "Zu leicht", "Leicht", "Passend", "Schwer", "Zu schwer"];

export function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function daysBetween(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000); }

// Einheit eines Tages inkl. Status (krank / Einschränkungen) – so wird sie in der App angezeigt
export function plannedSession(date, state, today) {
  const s = sessionFor(date, state, today);
  const st = state.status || {};
  const limits = (st.limits || []).map(l => l.region);
  const notes = [];
  if (st.sick && st.sick.level === "body") { s.blocked = true; notes.push("Heute kein Training – erst gesund werden. Ein kurzer Spaziergang ist in Ordnung, wenn du dich danach fühlst."); }
  else if (st.sick && st.sick.level === "head") {
    s.easy = true;
    if (s.kind === "run") { notes.push("Erkältet: nur locker in Zone 1–2, höchstens 30 Minuten, keine Intervalle. Wird es schlechter: abbrechen."); s.short = "max. 30 Min. locker (erkältet)"; }
    if (s.kind === "strength") { notes.push("Erkältet: je Übung ein Satz weniger und deutlich leichter (3+ Wiederholungen im Tank)."); s.items.forEach(i => { i.sets = Math.max(1, i.sets - 1); }); }
  } else if (st.back && daysBetween(st.back, date) >= 0 && daysBetween(st.back, date) < 3) {
    s.easy = true;
    notes.push("Wiedereinstieg nach Krankheit: die ersten Tage locker – keine Intervalle, Kraft leichter als sonst.");
    if (s.kind === "strength") s.items.forEach(i => { i.sets = Math.max(1, i.sets - 1); });
  }
  if (s.kind === "strength") for (const it of s.items) {
    const hit = (EXERCISES[it.id].load || []).filter(r => limits.includes(r));
    if (hit.length) it.caution = hit.map(r => REGIONS[r]).join(", ");
  }
  if (s.kind === "run" && limits.some(r => r === "knie" || r === "fuss" || r === "huefte"))
    notes.push("Einschränkung an " + limits.filter(r => ["knie", "fuss", "huefte"].includes(r)).map(r => REGIONS[r]).join(", ") + ": Wenn Laufen schmerzt, stattdessen Rad oder Crosstrainer im gleichen Pulsbereich – oder zügig gehen.");
  s.notes = notes;
  return s;
}

const logsOf = (state, pred) => (state.logs || []).filter(pred).sort((a, b) => a.date < b.date ? -1 : 1);
function isWeighted(sets) { return sets.some(x => Number(x.w) > 0); }

// Alle aktuellen Empfehlungen. today = "YYYY-MM-DD"
export function suggestions(state, today) {
  const out = [];
  const st = state.status || {}, ov = state.overrides || {}, dec = state.decisions || {};
  const limits = (st.limits || []).map(l => l.region);
  const add = s => { if (!dec[s.key]) out.push(s); };

  // 1) Krankheit
  if (st.sick) {
    const days = daysBetween(st.sick.since, today);
    if (st.sick.level === "body") add({ key: "sick-body-" + st.sick.since, level: "stop", title: "Pause – du bist krank",
      text: "Bei Fieber oder Beschwerden unterhalb des Halses kein Training. Wieder anfangen, wenn du mindestens 24 Stunden fieberfrei bist, dann 2–3 Tage locker. Bei Brustschmerz, Herzstolpern oder Atemnot ärztlich abklären lassen.",
      actions: [{ label: "Bin wieder gesund", op: { type: "recovered" } }] });
    else add({ key: "sick-head-" + st.sick.since, level: "warn", title: "Erkältet – heute nur locker",
      text: "Nur Beschwerden oberhalb des Halses: lockeres Training ist meist in Ordnung. Keine Intervalle, Kraft leichter. Die Einheiten sind schon angepasst.",
      actions: [{ label: "Bin wieder gesund", op: { type: "recovered" } }] });
    if (days >= 6) add({ key: "sick-long-" + st.sick.since, level: "info", title: "Schon " + days + " Tage krank",
      text: "Nach einer Woche Pause ist es sinnvoll, die aktuelle Planwoche zu wiederholen statt einfach weiterzumachen.",
      actions: [{ label: "Plan um 1 Woche verschieben", op: { type: "shift", days: 7 } }] });
  }

  // 2) Einschränkungen: belastende Übungen ersetzen (eine Karte für alle betroffenen Übungen)
  const plan = planOf(state);
  const fixes = [], seen = new Set(), hitRegions = new Set();
  for (const w of Object.values(plan.workouts)) for (const item of w.items) {
    const slot = slotOf(item);
    if (seen.has(slot)) continue; seen.add(slot);
    const o = (ov.ex && ov.ex[slot]) || {};
    if (o.sets === 0) continue;
    const cur = o.swap || item.id;
    const hit = (EXERCISES[cur].load || []).filter(r => limits.includes(r));
    if (!hit.length) continue;
    hit.forEach(r => hitRegions.add(r));
    const alt = (EXERCISES[item.id].alt || []).find(a => a !== cur && !(EXERCISES[a].load || []).some(r => limits.includes(r)));
    fixes.push({ slot, cur, alt, op: alt ? { type: "swap", slot, to: alt, reason: "limit" } : { type: "sets", slot, sets: 0, reason: "limit" } });
  }
  if (fixes.length) add({ key: "limit-" + limits.slice().sort().join("+") + "-" + fixes.map(f => f.slot + ">" + (f.alt || 0)).join(","), level: "warn",
    title: "Einschränkung " + [...hitRegions].map(r => REGIONS[r]).join(" + ") + ": " + (fixes.length === 1 ? "1 Übung" : fixes.length + " Übungen") + " betroffen",
    text: "Vorschlag, bis es wieder geht (einzeln änderbar unter „Plan“):",
    list: fixes.map(f => EXERCISES[f.cur].name + " → " + (f.alt ? EXERCISES[f.alt].name : "weglassen")),
    actions: [{ label: "Alle anpassen", op: { type: "multi", ops: fixes.map(f => f.op) } }] });
  // … und wieder zurück, wenn die Einschränkung weg ist
  const planId = slot => { for (const w of Object.values(plan.workouts)) for (const i of w.items) if (slotOf(i) === slot) return i.id; return null; };
  const back = Object.entries(ov.ex || {}).filter(([slot, o]) => o.reason === "limit" && planId(slot) && !(EXERCISES[planId(slot)].load || []).some(r => limits.includes(r))).map(([slot]) => slot);
  if (back.length) add({ key: "unlimit-" + back.join(",") + "-" + limits.join("+"), level: "info", title: (back.length === 1 ? EXERCISES[planId(back[0])].name : back.length + " Übungen") + " wieder aufnehmen?",
    text: "Die Einschränkung ist nicht mehr eingetragen. Zurück in den Plan: " + back.map(s => EXERCISES[planId(s)].name).join(", ") + " – anfangs etwas leichter.",
    actions: [{ label: "Zurück zum Plan", op: { type: "multi", ops: back.map(slot => ({ type: "reset", slot })) } }] });

  // 3) Leistung je Übung (letzte zwei Einheiten mit dieser Übung)
  const strength = logsOf(state, l => l.kind === "strength" && l.data && l.data.ex);
  for (const w of Object.values(plan.workouts)) for (const item of w.items) {
    const slot = slotOf(item), reps = item.reps;
    const o = (ov.ex && ov.ex[slot]) || {};
    const id = o.swap || item.id;
    const range = Array.isArray(o.reps) ? o.reps : reps;
    const hist = strength.filter(l => l.data.ex[slot] && l.data.ex[slot].id === id && (l.data.ex[slot].sets || []).length).slice(-2);
    if (!hist.length) continue;
    const last = hist[hist.length - 1], sets = last.data.ex[slot].sets.filter(x => x.done);
    if (!sets.length) continue;
    const ex = EXERCISES[id];
    const top = s => (Number(s.r) || 0) >= range[1];
    const allTop = hist.length === 2 && hist.every(l => { const ss = (l.data.ex[slot].sets || []).filter(x => x.done); return ss.length && ss.every(top); });
    const lowCount = sets.filter(s => (Number(s.r) || 0) < range[0]).length;
    const w = Math.max(0, ...sets.map(s => Number(s.w) || 0));
    if (allTop && (last.data.feel || 3) <= 3) {
      const small = id === "lateralraise" || ex.type === "time";
      const step = small ? 1 : (w >= 40 ? 5 : 2.5);
      add({ key: "up-" + slot + "-" + last.date, level: "good", title: ex.name + ": steigern",
        text: (ex.type === "time" ? "Zweimal hintereinander die volle Zeit (" + range[1] + " s) gehalten." : "Zweimal hintereinander in allen Sätzen " + range[1] + "+ Wiederholungen geschafft.") +
          (w > 0 ? " Vorschlag: " + fmtKg(w + step) + " statt " + fmtKg(w) + "." : ex.type === "time" ? " Vorschlag: schwerere Variante (z. B. Beine strecken) oder +10 s." : " Vorschlag: schwerere Variante, Zusatzgewicht oder 3 Sekunden langsam ablassen."),
        actions: w > 0 ? [{ label: "Auf " + fmtKg(w + step), op: { type: "weight", slot, weight: w + step } }] : [{ label: "Notiz übernehmen", op: { type: "note", slot, note: ex.type === "time" ? "schwerere Variante / +10 s" : "langsam ablassen (3 s) oder Zusatzgewicht" } }] });
    } else if (lowCount * 2 >= sets.length && sets.length >= 2) {
      add({ key: "down-" + slot + "-" + last.date, level: "warn", title: ex.name + ": etwas zu schwer",
        text: "In " + lowCount + " von " + sets.length + " Sätzen unter " + range[0] + " Wiederholungen." + (w > 0 ? " Vorschlag: " + fmtKg(Math.max(0, roundKg(w * 0.9))) + " statt " + fmtKg(w) + "." : " Vorschlag: leichtere Variante (z. B. mit Band oder kürzerem Hebel)."),
        actions: w > 0 ? [{ label: "Auf " + fmtKg(roundKg(w * 0.9)), op: { type: "weight", slot, weight: roundKg(w * 0.9) } }] : [{ label: "Notiz übernehmen", op: { type: "note", slot, note: "leichtere Variante" } }] });
    }
  }

  // 4) Gefühl und Beschwerden
  const recent = logsOf(state, l => (l.kind === "strength" || l.kind === "run") && l.status !== "skipped" && l.data && l.data.feel).slice(-4);
  if (recent.length >= 3 && recent.filter(l => l.data.feel >= 5).length >= 2)
    add({ key: "tired-" + recent[recent.length - 1].date, level: "warn", title: "Mehrmals „zu schwer“",
      text: "Die letzten Einheiten waren oft zu schwer. Gut wäre eine leichtere Woche: weniger Sätze, Läufe nur locker – und auf Schlaf achten (7–8 Stunden).",
      actions: [{ label: "Diese Woche als Deload", op: { type: "deload", week: weekOf(state.start, today) } }] });
  const lastWithPain = logsOf(state, l => l.data && Array.isArray(l.data.pain) && l.data.pain.length).pop();
  if (lastWithPain && daysBetween(lastWithPain.date, today) <= 7)
    for (const r of lastWithPain.data.pain) if (REGIONS[r] && !limits.includes(r))
      add({ key: "pain-" + r + "-" + lastWithPain.date, level: "warn", title: "Beschwerden: " + REGIONS[r],
        text: "Am " + fmtDate(lastWithPain.date) + " hast du Beschwerden an " + REGIONS[r] + " angegeben. Als Einschränkung eintragen? Dann schlägt die App passende Ersatzübungen vor.",
        actions: [{ label: "Einschränkung eintragen", op: { type: "limit", region: r } }] });

  // 5) Läufe: Zone 2 zu schnell
  const z2 = logsOf(state, l => l.kind === "run" && l.data && l.data.run === "z2" && Number(l.data.hr) > 0).slice(-2);
  if (z2.length === 2 && z2.every(l => Number(l.data.hr) > 141))
    add({ key: "z2fast-" + z2[1].date, level: "info", title: "Zone-2-Läufe zu schnell",
      text: "Die letzten beiden lockeren Läufe lagen bei Ø " + z2.map(l => l.data.hr).join(" und ") + " bpm (Ziel 130–140). Langsamer laufen – Gehpausen sind völlig in Ordnung. Genau so wächst die Grundlage.", actions: [] });

  // 6) Verpasste Einheiten → Woche wiederholen
  const week = weekOf(state.start, today);
  if (week && week >= 2 && week <= plan.weeks) {
    let missed = 0;
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, -i);
      if (["recovery", "rest"].includes(plan.days[dayIndex(d)].kind)) continue;
      if (d < state.start) continue;
      const done = (state.logs || []).some(l => l.date === d && l.status !== "skipped");
      if (!done) missed++;
    }
    if (missed >= 3) add({ key: "missed-" + today.slice(0, 8) + Math.floor(Number(today.slice(8)) / 7), level: "info", title: missed + " Einheiten in den letzten 7 Tagen ausgefallen",
      text: "Kein Problem – lieber die Woche wiederholen als zu schnell steigern. Der Plan verschiebt sich dann um eine Woche.",
      actions: [{ label: "Plan um 1 Woche verschieben", op: { type: "shift", days: 7 } }] });
  }

  // 7) Plan geschafft
  if (week && week > plan.weeks) add({ key: "done-" + state.start, level: "good", title: plan.name + " geschafft",
    text: "Die " + plan.weeks + " Wochen sind um. Du kannst den Block wiederholen (mit deinen aktuellen Gewichten) – oder im Plan-Tab mit dem Planer einen neuen Plan anfragen.",
    actions: [{ label: "Ab nächstem Montag wiederholen", op: { type: "restart" } }] });

  const rank = { stop: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Übernimmt eine Empfehlung: gibt den neuen Zustand (start, overrides, status) zurück
export function applyOp(state, op, today) {
  if (op.type === "multi") return op.ops.reduce((s, o) => ({ ...s, ...applyOp({ ...state, ...s }, o, today) }), { start: state.start, overrides: state.overrides, status: state.status });
  const ov = JSON.parse(JSON.stringify(state.overrides || {}));
  ov.ex = ov.ex || {};
  const st = JSON.parse(JSON.stringify(state.status || {}));
  let start = state.start;
  const ex = slot => (ov.ex[slot] = ov.ex[slot] || {});
  switch (op.type) {
    case "swap": ex(op.slot).swap = op.to; ex(op.slot).reason = op.reason || "manual"; delete ex(op.slot).weight; break;
    case "sets": ex(op.slot).sets = op.sets; ex(op.slot).reason = op.reason || "manual"; break;
    case "weight": ex(op.slot).weight = op.weight; break;
    case "note": ex(op.slot).note = op.note; break;
    case "reset": delete ov.ex[op.slot]; break;
    case "shift": start = addDays(start, op.days); break;
    case "restart": { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); start = d.toISOString().slice(0, 10); break; }
    case "recovered": st.back = today; delete st.sick; break;
    case "limit": st.limits = (st.limits || []).filter(l => l.region !== op.region).concat([{ region: op.region, since: today }]); break;
    case "deload": ov.deload = Array.from(new Set([...(ov.deload || []), op.week])); break;
  }
  return { start, overrides: ov, status: st };
}

export function fmtKg(w) { return (Math.round(w * 4) / 4).toString().replace(".", ",") + " kg"; }
function roundKg(w) { const st = w >= 20 ? 2.5 : 0.5; return Math.round(w / st) * st; }
export function fmtDate(iso) { const [y, m, d] = iso.split("-"); return Number(d) + "." + Number(m) + "."; }
