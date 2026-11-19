// Fitness – Oberfläche. Läuft nur nach Anmeldung; Daten kommen von /api (Cloudflare Worker + D1).
import { EXERCISES, DAY_NAMES, REGIONS, ZONES, PROFILE, weekOf, dayIndex, slotOf, defaultsFor, sourceDay, swapDays, validatePlan, diffPlans, runFor, focusFor } from "./plan.js";
import { plannedSession, suggestions, applyOp, addDays, daysBetween, fmtKg, fmtDate, FEEL, SICK, readiness } from "./coach.js";
import { METRICS, GROUPS as HGROUPS, SHORTCUT_TYPES, fmtVal, avgRange, processUpload } from "./health.js";
import { mount, still } from "./anim.js";

const $app = document.getElementById("app"), $rest = document.getElementById("rest");
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const KIND_LABEL = { strength: "Kraft", run: "Laufen", recovery: "Erholung", rest: "Ruhetag" };
let S = null;                 // Daten vom Server
let stops = [];               // laufende Animationen
let ui = { planWeek: null, open: null };

/* ---------- Server ---------- */
async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Fit": "1" }, body: JSON.stringify(body) };
  const res = await fetch(path, { credentials: "same-origin", ...opt });
  if (res.status === 401) { location.reload(); throw new Error("abgemeldet"); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Fehler " + res.status);
  return j;
}
async function load() { S = await api("/api/state"); loadedAt = Date.now(); if (S.health && S.health.pending) await processHealthUploads(); }
// Übertragungen vom Kurzbefehl hier im Browser auswerten (der kostenlose Server hat dafür zu wenig Rechenzeit)
let processing = false;
async function processHealthUploads() {
  if (processing) return; processing = true;
  try {
    for (let i = 0; i < 20; i++) {
      const r = await api("/api/health/raw");
      if (!r.batch) break;
      const out = processUpload(r.data, r.receivedAt);
      const res = await api("/api/health/apply", { batch: r.batch, ...out });
      if (!res.left) break;
    }
    S = await api("/api/state");
  } catch (e) { console.warn("Health-Auswertung:", e.message); }
  processing = false;
}
async function saveSettings(patch) {
  Object.assign(S, patch);
  await api("/api/settings", patch);
}
function logById(id) { return S.logs.find(l => l.id === id); }
async function saveLog(log) {
  const i = S.logs.findIndex(l => l.id === log.id);
  if (i >= 0) S.logs[i] = log; else S.logs.push(log);
  await api("/api/log", log);
}
let saveTimer = null, pending = null;
function saveLater(log) { const i = S.logs.findIndex(l => l.id === log.id); if (i >= 0) S.logs[i] = log; else S.logs.push(log); pending = log; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900); }
function flush() { if (pending) { const p = pending; pending = null; saveLog(p).catch(e => toast("Nicht gespeichert: " + e.message)); } }
let loadedAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return flush();
  // Zurück in der App (z. B. am nächsten Tag): Daten frisch laden, aber nicht mitten im Eintragen
  if (Date.now() - loadedAt > 60000 && !pending && !document.querySelector(".sheet-bg")) { ui.selDay = null; load().then(render).catch(() => {}); }
});

/* ---------- Hilfen ---------- */
function todayIso() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function longDate(iso) { const [y, m, d] = iso.split("-").map(Number); return DAY_NAMES[dayIndex(iso)] + ", " + d + ". " + MONTHS[m - 1]; }
function planState() { return { start: S.start, plan: S.plan.data, overrides: S.overrides, status: S.status, logs: S.logs, health: S.health }; }
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function stopAnims() { stops.forEach(f => f()); stops = []; }
const num = v => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const icon = k => k === "strength" ? "🏋️" : k === "run" ? "🏃" : k === "rest" ? "😴" : "🧘";
function mainLog(date) { return logById(date + "-main"); }
function paceOf(min, km) { if (!(min > 0 && km > 0)) return ""; const p = min / km; return Math.floor(p) + ":" + String(Math.round((p % 1) * 60)).padStart(2, "0"); }

// Ton und Vibration am Ende einer Pause / eines Timers
let audio = null;
document.addEventListener("pointerdown", () => { if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }, { once: true });
function signal() {
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  if (!audio) return;
  try {
    [0, 0.25].forEach(t => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15); });
  } catch (e) {}
}
// Bildschirm während des Trainings anlassen
let wake = null;
async function keepAwake(on) {
  try { if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); if (!on && wake) { await wake.release(); wake = null; } } catch (e) {}
}

/* ---------- Navigation ---------- */
window.addEventListener("hashchange", render);
function route() { const h = location.hash.replace(/^#\/?/, ""); return h ? h.split("/") : ["heute"]; }
function render() {
  if (!S) return;
  stopAnims();
  const r = route();
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === r[0] || (r[0] === "tag" && a.dataset.tab === "heute")));
  keepAwake(r[0] === "tag");
  if (rest && location.hash !== rest.hash) stopRest();
  if (r[0] === "tag" && /^\d{4}-\d{2}-\d{2}$/.test(r[1] || "")) return r[2] === "mob" ? viewMobility(r[1], true) : viewDay(r[1]);
  if (r[0] !== "heute") ui.selDay = null;
  if (r[0] === "plan") return r[1] === "bearbeiten" ? viewPlanEdit() : r[1] === "versionen" ? viewVersions() : r[1] === "archiv" ? viewArchive()
    : r[1] === "planer" ? viewPlanner() : r[1] === "ansehen" ? viewPlanById(Number(r[2])) : viewPlan();
  if (r[0] === "statistik") return viewStats();
  if (r[0] === "mehr") return r[1] === "health" ? viewHealthSetup() : viewMore();
  return viewToday();
}
window.scrollToTop = () => window.scrollTo(0, 0);

/* ---------- Heute ---------- */
function viewToday() {
  const today = todayIso(), ps = planState();
  const week = weekOf(S.start, today);
  const P = S.plan.data;
  const mon = addDays(today, -dayIndex(today));
  if (!ui.selDay || ui.selDay < mon || ui.selDay > addDays(mon, 6)) ui.selDay = today;   // Standard: heute
  const day = ui.selDay, isToday = day === today;
  const log = mainLog(day);
  const s = plannedSession(day, ps, log && log.data && log.data.today);
  const sugs = suggestions(ps, today);
  const st = S.status || {};
  const chips = [];
  if (st.sick) chips.push(`<span class="badge warn">${esc(SICK[st.sick.level].label)} seit ${fmtDate(st.sick.since)}</span>`);
  for (const l of st.limits || []) chips.push(`<span class="badge warn">Einschränkung: ${esc(REGIONS[l.region])}</span>`);
  const heroKind = s.blocked && isToday ? "blocked" : s.kind;
  const doneTxt = log ? (log.status === "done" ? "✓ Erledigt" : log.status === "skipped" ? "Ausgelassen" : "Angefangen") : "";
  const sub = s.kind === "strength" ? s.sub + (s.minutes ? " · " + s.minutes + " Min." : "") : s.kind === "run" ? s.short : s.sub;
  const mob = logById(today + "-mob");
  let weekHtml = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), l = mainLog(d), src = sourceDay(ps, d), k = P.days[src].kind;
    const cls = l && l.status === "done" ? "done" : l && l.status === "skipped" ? "skip" : "";
    weekHtml += `<button data-day="${d}" class="${d === day ? "sel" : ""} ${d === today ? "today" : ""} ${src !== i ? "moved" : ""}" aria-pressed="${d === day}" aria-label="${DAY_NAMES[i]}${d === today ? " (heute)" : ""}">
      <span class="lbl">${d === today ? "Heute" : DAY_NAMES[i].slice(0, 2)}</span><span class="ic ${cls}">${cls === "done" ? "✓" : cls === "skip" ? "–" : icon(k)}</span>${src !== i ? `<span class="mv">↔</span>` : ""}</button>`;
  }
  $app.innerHTML = `
    <p class="mute small" style="margin:0">${esc(longDate(today))}</p>
    <h1>${week == null ? "Plan startet am " + fmtDate(S.start) : week > P.weeks ? "Plan geschafft 🎉" : "Woche " + week + " von " + P.weeks}</h1>
    <p class="mute small" style="margin:0 0 14px">${esc(P.name)} · Version ${S.plan.version}${week && week <= P.weeks ? " · " + esc(focusFor(P, week).text) : ""}</p>
    ${chips.length ? `<div class="row wrap" style="margin-bottom:12px">${chips.join("")}</div>` : ""}
    ${healthLine()}
    <div class="weekstrip" style="margin-bottom:12px">${weekHtml}</div>
    <div class="hero ${heroKind}">
      <div class="row"><div class="k grow">${isToday ? "Heute" : esc(DAY_NAMES[dayIndex(day)] + ", " + fmtDate(day))} · ${esc(KIND_LABEL[s.kind])}${s.movedFrom != null ? " · getauscht mit " + esc(DAY_NAMES[s.movedFrom]) : ""}</div>
        ${isToday ? "" : `<button class="pill" id="toToday">Zu heute</button>`}</div>
      <h2>${esc(s.title)}</h2>
      <p>${esc(sub)}</p>
      ${shortPreview(s)}
      <div class="row wrap">${doneTxt ? `<span class="done">${doneTxt}</span>` : ""}<a class="btn" href="#/tag/${day}">${log ? "Öffnen" : !isToday ? "Ansehen" : s.blocked ? "Ansehen" : "Starten"}</a>
      ${log && log.status === "skipped" ? `<button class="btn swap" id="unskipDay">Doch trainieren</button>` : ""}
      ${!log && s.kind !== "rest" ? `<button class="btn swap" id="skipDayHome">Auslassen</button>` : ""}
      ${!log ? `<button class="btn swap" id="swapDay">Tag tauschen</button>` : ""}</div>
    </div>
    ${isToday ? s.notes.map(n => `<div class="note">${esc(n)}</div>`).join("") : ""}
    ${sugs.length ? `<h2>Vorschläge für dich</h2>` + sugs.map(sugCard).join("") : ""}
    <a class="card row" href="#/tag/${today}/mob" style="text-decoration:none;color:inherit">
      <span class="dot recovery"></span><div class="grow"><b>Morgenroutine Mobility</b><div class="mute small">optional · 10–15 Min.</div></div>
      ${mob && mob.status === "done" ? `<span class="ok">✓</span>` : `<span class="mute">›</span>`}</a>`;
  $app.querySelectorAll("[data-day]").forEach(b => b.addEventListener("click", () => { ui.selDay = b.dataset.day; render(); }));
  const tt = $app.querySelector("#toToday"); if (tt) tt.addEventListener("click", () => { ui.selDay = today; render(); });
  const sw = $app.querySelector("#swapDay"); if (sw) sw.addEventListener("click", () => swapSheet(day, mon));
  const sk = $app.querySelector("#skipDayHome");
  if (sk) sk.addEventListener("click", () => {
    const bg = sheet(`<h2 style="margin-top:0">${esc(s.title)} auslassen?</h2>
      <p class="mute small" style="margin-top:-6px">${esc(isToday ? "Heute" : DAY_NAMES[dayIndex(day)] + ", " + fmtDate(day))} wird als ausgelassen eingetragen. Du kannst das jederzeit rückgängig machen.</p>
      <label class="f">Grund (optional)</label>
      <div class="row wrap">${["Keine Zeit", "Müde / erschöpft", "Krank", "Schmerzen", "Bewusste Pause"].map(r => `<span class="chip" data-r="${r}">${r}</span>`).join("")}</div>
      <button class="btn full" id="skipOk" style="margin-top:16px">Auslassen</button><button class="btn ghost full" id="skipNo" style="margin-top:6px">Abbrechen</button>`);
    let reason = "";
    bg.querySelectorAll("[data-r]").forEach(c => c.addEventListener("click", () => { reason = reason === c.dataset.r ? "" : c.dataset.r; bg.querySelectorAll("[data-r]").forEach(x => x.classList.toggle("on", x.dataset.r === reason)); }));
    bg.querySelector("#skipNo").addEventListener("click", () => bg.remove());
    bg.querySelector("#skipOk").addEventListener("click", async () => {
      try { await saveLog({ id: day + "-main", date: day, kind: s.kind === "rest" ? "other" : s.kind, status: "skipped", data: reason ? { reason, pv: planRef() } : { pv: planRef() } }); bg.remove(); toast("Ausgelassen"); render(); }
      catch (e) { toast(e.message); }
    });
  });
  const us = $app.querySelector("#unskipDay");
  if (us) us.addEventListener("click", async () => {
    try { await api("/api/log/delete", { id: day + "-main" }); S.logs = S.logs.filter(l => l.id !== day + "-main"); toast("Wieder offen"); render(); } catch (e) { toast(e.message); }
  });
  bindSuggestions(sugs);
}
// Tage innerhalb der laufenden Woche tauschen – ohne neue Planversion
function swapSheet(day, mon) {
  const ps = planState(), s0 = plannedSession(day, ps);
  if (mainLog(day)) return toast("Für " + DAY_NAMES[dayIndex(day)] + " ist schon etwas eingetragen – erst zurücksetzen, dann tauschen.");
  const others = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(mon, i)).filter(d => d !== day);
  const m = (S.overrides.moves || {})[mon];
  const bg = sheet(`<h2 style="margin-top:0">${esc(DAY_NAMES[dayIndex(day)])}: ${esc(s0.title)}</h2>
    <p class="mute small" style="margin-top:-6px">Tauschen mit … (nur diese Woche, der Plan bleibt gleich)</p>
    <div class="list">${others.map(d => { const s = plannedSession(d, ps), busy = !!mainLog(d);
      return `<button class="pickday" data-to="${d}" ${busy ? "disabled" : ""}><span class="dot ${s.kind === "rest" ? "recovery" : s.kind}"></span><div class="grow"><b>${DAY_NAMES[dayIndex(d)]}</b> <span class="mute small">${fmtDate(d)}</span><div class="small">${esc(s.title)}${busy ? " · <span class=\"mute\">schon eingetragen</span>" : ""}</div></div><span class="mute">↔</span></button>`; }).join("")}</div>
    ${Array.isArray(m) ? `<button class="btn ghost full" id="resetWeek" style="margin-top:10px">Woche wieder wie im Plan</button>` : ""}`);
  const save = async ov => { try { await saveSettings({ overrides: ov }); bg.remove(); render(); } catch (e) { toast(e.message); } };
  bg.querySelectorAll("[data-to]").forEach(b => b.addEventListener("click", async () => {
    await save(swapDays(S.overrides, day, b.dataset.to)); ui.selDay = todayIso(); render();
    toast(s0.title + " jetzt am " + DAY_NAMES[dayIndex(b.dataset.to)]);
  }));
  const rw = bg.querySelector("#resetWeek");
  if (rw) rw.addEventListener("click", async () => {
    const ov = JSON.parse(JSON.stringify(S.overrides)); delete ov.moves[mon];
    const busy = [0, 1, 2, 3, 4, 5, 6].some(i => { const d = addDays(mon, i); return mainLog(d) && sourceDay(planState(), d) !== i; });
    if (busy && !window.confirm("An getauschten Tagen ist schon etwas eingetragen. Trotzdem zurücksetzen?")) return;
    await save(ov); toast("Woche wieder wie im Plan");
  });
}
// Kurzfassung einer Einheit für die Startseite
function shortPreview(s) {
  if (s.kind === "strength") {
    const list = s.items.filter(i => !i.skipped);
    return `<ul class="mini">${list.map(i => `<li><span>${esc(i.name)}</span><span>${i.sets} × ${i.reps[0]}–${i.reps[1]}${i.type === "time" ? " s" : ""}</span></li>`).join("")}</ul>`;
  }
  if (s.kind === "run") {
    const st = s.steps, hard = st.filter(x => x.hard), pause = st.find(x => !x.hard && /pause/i.test(x.label));
    const parts = hard.length
      ? [st[0].label + " " + st[0].min + " Min.", hard.length + " × " + hard[0].min + " Min. schnell" + (pause ? " (" + pause.min + " Min. Trabpause)" : ""), st[st.length - 1].label + " " + st[st.length - 1].min + " Min."]
      : st.map(x => x.detail);
    return `<ul class="mini">${parts.map(t => `<li><span>${esc(t)}</span></li>`).join("")}</ul>`;
  }
  if (s.kind === "recovery") return `<ul class="mini"><li><span>${s.items.length} Mobility-Übungen (15–20 Min.)</span></li><li><span>Spaziergang</span></li></ul>`;
  return "";
}
function sugCard(s, i) {
  const label = { stop: "Wichtig", warn: "Anpassung", good: "Fortschritt", info: "Hinweis" }[s.level];
  return `<div class="card sug ${s.level}"><div class="row"><span class="badge ${s.level === "good" ? "good" : s.level === "info" ? "" : "warn"}">${label}</span></div>
    <h3 style="margin-top:8px">${esc(s.title)}</h3><p>${esc(s.text)}</p>
    ${s.list ? `<ul class="cues small mute">${s.list.slice(0, 5).map(x => `<li>${esc(x)}</li>`).join("")}${s.list.length > 5 ? `<li>und ${s.list.length - 5} weitere</li>` : ""}</ul>` : ""}
    <div class="row wrap">${s.actions.map((a, j) => `<button class="btn sm" data-sug="${i}" data-act="${j}">${esc(a.label)}</button>`).join("")}
    <button class="btn sm ghost" data-sug="${i}" data-act="no">${s.actions.length ? "Nicht jetzt" : "Verstanden"}</button></div></div>`;
}
function bindSuggestions(sugs) {
  $app.querySelectorAll("[data-sug]").forEach(b => b.addEventListener("click", async () => {
    const s = sugs[Number(b.dataset.sug)];
    const decisions = pruneDecisions({ ...(S.decisions || {}), [s.key]: b.dataset.act === "no" ? "dismissed:" + todayIso() : "accepted:" + todayIso() });
    try {
      if (b.dataset.act === "no") await saveSettings({ decisions });
      else { const n = applyOp(planState(), s.actions[Number(b.dataset.act)].op, todayIso()); await saveSettings({ ...n, decisions }); toast("Übernommen"); }
    } catch (e) { toast(e.message); }
    render();
  }));
}
function pruneDecisions(d) { const e = Object.entries(d); return Object.fromEntries(e.slice(Math.max(0, e.length - 250))); }

/* ---------- Tag (Training) ---------- */
function viewDay(date) {
  const log = mainLog(date);
  const s = plannedSession(date, planState(), log && log.data && log.data.today);
  if (s.kind === "strength") return viewStrength(date, s);
  if (s.kind === "run") return viewRun(date, s);
  if (s.kind === "rest") return viewRest(date, s);
  return viewMobility(date, false, s);
}
function header(date, s, extra = "") {
  return `<div class="top"><a class="back" href="#/heute" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">${esc(longDate(date))} · Woche ${s.week}</div><h1 style="font-size:24px">${esc(s.title)}</h1></div>${extra}</div>
  ${s.notes && s.notes.length ? s.notes.map(n => `<div class="note">${esc(n)}</div>`).join("") : ""}`;
}
function viewRest(date, s) {
  $app.innerHTML = header(date, s) + `<div class="card"><p style="margin:0 0 12px">${esc(s.sub)}</p><a class="btn alt" href="#/tag/${date}/mob">Mobility öffnen</a></div>`;
}

// Letzte Werte einer Übung (für Vorschläge beim Eintragen)
function lastSets(slot, id, before) {
  const l = S.logs.filter(l => l.kind === "strength" && l.date < before && l.data && l.data.ex && l.data.ex[slot] && l.data.ex[slot].id === id && (l.data.ex[slot].sets || []).some(x => x.done))
    .sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return l ? { date: l.date, sets: l.data.ex[slot].sets.filter(x => x.done) } : null;
}
const planRef = () => ({ id: S.plan.id, v: S.plan.version });

function viewStrength(date) {
  const id = date + "-main";
  const log = logById(id);
  const data = log ? JSON.parse(JSON.stringify(log.data)) : {};
  data.ex = data.ex || {};
  data.today = data.today || {};
  const s = plannedSession(date, planState(), data.today);
  data.workout = s.workout;
  for (const it of s.items) {
    const e = data.ex[it.slot];
    if (!e || e.id !== it.id) data.ex[it.slot] = { id: it.id, sets: Array.from({ length: it.sets }, () => ({ r: "", w: "", done: false })) };
    const sets = data.ex[it.slot].sets;
    while (sets.length < it.sets) sets.push({ r: "", w: "", done: false });
    while (sets.length > it.sets && !sets[sets.length - 1].done) sets.pop();
  }
  const complete = it => it.skipped || data.ex[it.slot].sets.every(x => x.done);
  const active = s.items.filter(i => !i.skipped);
  if (!ui.open || ui.openDate !== date || !active.some(i => i.slot === ui.open)) { const f = active.find(i => !complete(i)); ui.open = f ? f.slot : null; ui.openDate = date; }
  const persist = (status) => { data.pv = planRef(); const l = { id, date, kind: "strength", status: status || (log && log.status === "done" ? "done" : "partial"), data }; saveLater(l); return l; };

  let n = 0;
  const exHtml = s.items.map(it => {
    const ex = EXERCISES[it.id], open = ui.open === it.slot && !it.skipped, e = data.ex[it.slot];
    if (it.skipped) return `<div class="card ex skipped" id="ex-${it.slot}"><div class="head"><span class="num">–</span><div class="grow"><b>${esc(it.name)}</b><div class="mute small">heute übersprungen</div></div>
      <button class="btn sm ghost" data-unskip="${it.slot}">Doch machen</button></div></div>`;
    n++;
    const last = lastSets(it.slot, it.id, date);
    const target = it.sets + " × " + it.reps[0] + "–" + it.reps[1] + (it.type === "time" ? " s" : "") + (it.side ? " je Seite" : "");
    const lastTxt = last ? "Letztes Mal (" + fmtDate(last.date) + "): " + last.sets.map(x => (x.r || "–") + (it.type === "time" ? " s" : "") + (num(x.w) ? " @ " + fmtKg(num(x.w)) : "")).join(" · ") : "";
    const wDefault = it.weight || (last ? Math.max(0, ...last.sets.map(x => num(x.w))) : 0);
    const rows = e.sets.map((x, k) => `
      <span class="lab">${k + 1}</span>
      <input type="text" inputmode="numeric" data-f="r" data-s="${it.slot}" data-k="${k}" value="${esc(x.r)}" placeholder="${it.type === "time" ? it.reps[1] + " s" : it.reps[0] + "–" + it.reps[1]}" aria-label="${it.type === "time" ? "Sekunden" : "Wiederholungen"} Satz ${k + 1}">
      <input type="text" inputmode="decimal" data-f="w" data-s="${it.slot}" data-k="${k}" value="${esc(x.w)}" placeholder="${wDefault ? String(wDefault).replace(".", ",") + " kg" : "kg"}" aria-label="Gewicht Satz ${k + 1}">
      ${it.type === "time" && !x.done ? `<button class="timerbtn" data-hold="${it.slot}" data-k="${k}" aria-label="Timer starten">▶</button>` : `<button class="check ${x.done ? "on" : ""}" data-check="${it.slot}" data-k="${k}" aria-label="Satz ${k + 1} erledigt">✓</button>`}`).join("");
    const badges = (it.extra ? `<span class="badge good">zusätzlich</span> ` : "") + (it.swappedToday ? `<span class="badge">heute ersetzt</span> ` : it.swapped ? `<span class="badge">ersetzt</span> ` : "") + (it.caution ? `<span class="badge warn">Vorsicht: ${esc(it.caution)}</span>` : "");
    return `<div class="card ex ${complete(it) ? "complete" : ""}" id="ex-${it.slot}">
      <div class="head" data-open="${it.slot}"><span class="num">${complete(it) ? "✓" : n}</span>
        <div class="grow"><b>${esc(it.name)}</b> ${badges}
        <div class="mute small">${esc(target)}${it.note ? " · " + esc(it.note) : ""}</div></div>
        ${open ? "" : `<span class="thumb">${still(ex.anim)}</span>`}
        <button class="more" data-menu="${it.slot}" aria-label="Optionen für ${esc(it.name)}">⋯</button></div>
      ${open ? `<div class="body"><div class="figwrap" data-anim="${esc(ex.anim)}"></div>
        <ul class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
        ${lastTxt ? `<p class="mute small" style="margin:0 0 10px">${esc(lastTxt)}</p>` : ""}
        <div class="sets"><span></span><span class="lab">${it.type === "time" ? "Sekunden" : "Wdh."}</span><span class="lab">Gewicht</span><span></span>${rows}</div>
        <p class="mute tiny" style="margin:10px 0 0">Pause nach jedem Satz: ${it.rest} s · Ziel: ${esc(s.focus.rir)} Wdh. im Tank</p></div>` : ""}
    </div>`;
  }).join("");
  const doneCount = active.filter(complete).length;
  $app.innerHTML = header(date, s, `<span class="badge">${doneCount}/${active.length}</span>`) + `
    <p class="mute small" style="margin:-4px 0 12px">${esc(s.sub)} · ${esc(s.minutes)} Min. · ${esc(s.focus.text)}</p>
    <p class="mute tiny" style="margin:-6px 0 12px">Aufwärmen: 5–10 Minuten locker bewegen, danach dehnen. Mit ⋯ kannst du eine Übung überspringen, ersetzen oder entfernen.</p>
    ${exHtml}
    <button class="btn alt full" id="addEx" style="margin:0 0 12px">+ Übung hinzufügen</button>
    <button class="btn full" id="finish">${log && log.status === "done" ? "Abschluss ändern" : "Training abschließen"}</button>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" id="skip">Heute auslassen</button>${log ? `<button class="btn ghost sm" id="reset">Zurücksetzen</button>` : ""}</div>`;

  $app.querySelectorAll("[data-anim]").forEach(el => stops.push(mount(el, el.dataset.anim)));
  $app.querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", ev => {
    if (ev.target.closest("[data-menu]")) return;
    ui.open = ui.open === h.dataset.open ? null : h.dataset.open; render();
    setTimeout(() => { const el = document.getElementById("ex-" + h.dataset.open); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
  }));
  $app.querySelectorAll("input[data-f]").forEach(inp => inp.addEventListener("input", () => {
    data.ex[inp.dataset.s].sets[Number(inp.dataset.k)][inp.dataset.f] = inp.value.trim().slice(0, 8); persist();
  }));
  const markDone = (slot, k) => {
    const it = s.items.find(i => i.slot === slot), x = data.ex[slot].sets[k];
    const inpR = $app.querySelector(`input[data-f="r"][data-s="${slot}"][data-k="${k}"]`), inpW = $app.querySelector(`input[data-f="w"][data-s="${slot}"][data-k="${k}"]`);
    if (inpR) x.r = inpR.value.trim() || x.r;
    if (inpW) x.w = inpW.value.trim() || x.w;
    if (!x.r) x.r = String(it.type === "time" ? it.reps[1] : ((lastSets(slot, it.id, date) || { sets: [] }).sets[k] || {}).r || it.reps[1]);
    if (!x.w && inpW && inpW.placeholder !== "kg") x.w = inpW.placeholder.replace(" kg", "");
    x.done = true;
    const allDone = data.ex[slot].sets.every(y => y.done);
    const lastOfAll = allDone && active.every(i => data.ex[i.slot].sets.every(y => y.done));
    if (allDone) { const nx = active.find(i => !data.ex[i.slot].sets.every(y => y.done)); ui.open = nx ? nx.slot : null; }
    persist();
    if (!lastOfAll) startRest(it.rest, allDone ? "Nächste Übung" : "Satz " + (k + 2));
    render();
    if (allDone && ui.open) setTimeout(() => { const el = document.getElementById("ex-" + ui.open); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
    if (lastOfAll) toast("Alle Übungen geschafft 💪");
  };
  $app.querySelectorAll("[data-check]").forEach(b => b.addEventListener("click", () => {
    const slot = b.dataset.check, k = Number(b.dataset.k), x = data.ex[slot].sets[k];
    if (x.done) { x.done = false; persist(); render(); } else markDone(slot, k);
  }));
  $app.querySelectorAll("[data-hold]").forEach(b => b.addEventListener("click", () => {
    const slot = b.dataset.hold, k = Number(b.dataset.k), it = s.items.find(i => i.slot === slot);
    const inp = $app.querySelector(`input[data-f="r"][data-s="${slot}"][data-k="${k}"]`);
    const secs = Math.max(5, Math.min(600, Math.round(num(inp && inp.value) || it.reps[1])));
    holdTimer(it.name, secs, it.side, EXERCISES[it.id].anim, () => { data.ex[slot].sets[k].r = String(secs); markDone(slot, k); });
  }));
  $app.querySelectorAll("[data-unskip]").forEach(b => b.addEventListener("click", () => { delete data.today.skip[b.dataset.unskip]; persist(); render(); }));
  $app.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", () => exerciseMenu(s, s.items.find(i => i.slot === b.dataset.menu), data, persist)));
  $app.querySelector("#addEx").addEventListener("click", () => pickExercise("Übung hinzufügen", null, eid => {
    const d = defaultsFor(eid, S.plan.data);
    const slot = "x" + Date.now().toString(36);
    data.today.extra = (data.today.extra || []).concat([{ slot, id: eid, sets: d.sets, reps: d.reps }]);
    ui.open = slot; persist(); render();
    setTimeout(() => { const el = document.getElementById("ex-" + slot); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
  }));
  $app.querySelector("#finish").addEventListener("click", () => finishSheet(date, data.feel, data.pain, data.note, async (feel, pain, note) => {
    Object.assign(data, { feel, pain, note, pv: planRef() });
    clearTimeout(saveTimer); pending = null;
    await saveLog({ id, date, kind: "strength", status: "done", data });
    stopRest(); toast("Gespeichert"); location.hash = "#/heute";
  }));
  $app.querySelector("#skip").addEventListener("click", () => skipDay(date, "strength", data));
  const rb = $app.querySelector("#reset"); if (rb) rb.addEventListener("click", () => resetDay(id));
}

// Menü einer Übung im Training: nur heute oder dauerhaft (neue Planversion)
function exerciseMenu(s, it, data, persist) {
  const t = data.today;
  const btn = (act, label, cls = "alt") => `<button class="btn full ${cls}" data-act="${act}" style="margin-bottom:8px">${label}</button>`;
  const bg = sheet(`<h2 style="margin-top:0">${esc(it.name)}</h2>
    <p class="mute small" style="margin-top:-6px">Nur für heute</p>
    ${it.extra ? btn("dropExtra", "Wieder entfernen") : btn("skip", "Heute überspringen") + btn("swapToday", "Heute durch andere Übung ersetzen")}
    ${it.swappedToday ? btn("unswap", "Ersetzung zurücknehmen") : ""}
    <p class="mute small">Dauerhaft im Plan <span class="tiny">(neue Planversion)</span></p>
    ${it.extra ? btn("keepExtra", "In den Plan übernehmen") : btn("swapPlan", "Im Plan ersetzen") + btn("removePlan", "Aus dem Plan entfernen", "danger")}
    <button class="btn ghost full" data-act="close">Abbrechen</button>`);
  const close = () => bg.remove();
  const workoutKey = s.workout;
  const changePlan = async (fn, note) => {
    const draft = JSON.parse(JSON.stringify(S.plan.data));
    fn(draft.workouts[workoutKey]);
    try { const r = await api("/api/plan/save", { data: draft, note }); await load(); toast("Plan gespeichert als Version " + r.plan.version); render(); }
    catch (e) { toast(e.message); }
  };
  bg.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
    const a = b.dataset.act; close();
    if (a === "skip") { t.skip = { ...(t.skip || {}), [it.slot]: true }; persist(); render(); }
    if (a === "unswap") { delete t.swap[it.slot]; persist(); render(); }
    if (a === "dropExtra") { t.extra = (t.extra || []).filter(x => x.slot !== it.slot); delete data.ex[it.slot]; persist(); render(); }
    if (a === "swapToday") pickExercise("Heute ersetzen: " + it.name, it.planId, eid => { t.swap = { ...(t.swap || {}), [it.slot]: eid }; ui.open = it.slot; persist(); render(); });
    if (a === "swapPlan") pickExercise("Im Plan ersetzen: " + EXERCISES[it.planId].name, it.planId, eid => changePlan(w => {
      const i = w.items.find(x => slotOf(x) === it.slot); const d = defaultsFor(eid, S.plan.data);
      if (EXERCISES[i.id].type !== EXERCISES[eid].type) i.reps = d.reps;
      i.slot = slotOf(i); i.id = eid; if (i.slot === eid) delete i.slot;
    }, "Im Training ersetzt"));
    if (a === "removePlan" && window.confirm(EXERCISES[it.planId].name + " dauerhaft aus „" + s.title + "“ entfernen? Die alte Version bleibt im Verlauf.")) changePlan(w => { w.items = w.items.filter(x => slotOf(x) !== it.slot); }, "Im Training entfernt");
    if (a === "keepExtra") changePlan(w => { w.items.push({ id: it.id, ...(w.items.some(x => slotOf(x) === it.id) ? { slot: it.slot } : {}), sets: it.sets, reps: it.reps.slice() }); }, "Im Training hinzugefügt");
  }));
  bg.querySelector("[data-act=close]");
}

// Übungsauswahl aus dem gesamten Bestand
const GROUPS = [
  ["Oberkörper", ["pullup", "chinup", "ringrow", "latpulldown", "cablerow", "ringpushup", "inclinepushup", "chestpress", "ringdip", "dbpress", "machinepress", "lateralraise"]],
  ["Beine & Hüfte", ["legpress", "legcurl", "splitsquat", "singlerdl", "glutebridge", "wallsit", "backext"]],
  ["Core", ["hangingraise", "ringfallout", "sideplank", "copenhagen", "lsit", "pallof", "reversecrunch", "cablecrunch", "deadbug", "birddog", "plank", "hollow"]]
];
function pickExercise(title, forId, onPick) {
  const alts = forId ? (EXERCISES[forId].alt || []) : [];
  const listed = new Set(GROUPS.flatMap(g => g[1]));
  const groups = [...(alts.length ? [["Passende Ersatzübungen", alts]] : []), ...GROUPS,
    ["Weitere", Object.keys(EXERCISES).filter(k => !EXERCISES[k].mob && !listed.has(k))], ["Mobility", Object.keys(EXERCISES).filter(k => EXERCISES[k].mob)]].filter(g => g[1].length);
  const bg = sheet(`<h2 style="margin-top:0">${esc(title)}</h2><input type="search" id="q" placeholder="Suchen …" autocomplete="off" style="margin-bottom:6px">
    <div id="pl">${groups.map(([g, ids]) => `<div class="grp"><p class="mute small" style="margin:14px 0 2px;font-weight:600">${esc(g)}</p>${ids.filter(k => k !== forId).map(k => `<div class="pick" data-id="${k}" data-n="${esc((EXERCISES[k].name + " " + (EXERCISES[k].hint || "") + " " + k).toLowerCase())}"><span class="thumb">${still(EXERCISES[k].anim)}</span><div class="grow">${esc(EXERCISES[k].name)}<div class="mute tiny">${esc(EXERCISES[k].hint || (EXERCISES[k].type === "time" ? "halten" : ""))}</div></div></div>`).join("")}</div>`).join("")}</div>`);
  bg.querySelector("#q").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    bg.querySelectorAll(".pick").forEach(p => { p.style.display = !q || p.dataset.n.includes(q) ? "" : "none"; });
    bg.querySelectorAll(".grp").forEach(g => { g.style.display = [...g.querySelectorAll(".pick")].some(p => p.style.display !== "none") ? "" : "none"; });
  });
  bg.querySelectorAll(".pick").forEach(p => p.addEventListener("click", () => { bg.remove(); onPick(p.dataset.id); }));
}

async function skipDay(date, kind, data) {
  if (!confirmSheetSync("Diese Einheit als ausgelassen markieren?")) return;
  clearTimeout(saveTimer); pending = null;
  await saveLog({ id: date + "-main", date, kind, status: "skipped", data: { ...data } });
  location.hash = "#/heute";
}
function confirmSheetSync(q) { return window.confirm(q); }
async function resetDay(id) {
  if (!window.confirm("Alle Einträge für diese Einheit löschen?")) return;
  clearTimeout(saveTimer); pending = null;
  await api("/api/log/delete", { id }); S.logs = S.logs.filter(l => l.id !== id); render();
}

// Abschluss: Gefühl, Beschwerden, Notiz
function finishSheet(date, feel0, pain0, note0, done) {
  let feel = feel0 || 0; const pain = new Set(pain0 || []);
  const bg = sheet(`<h2 style="margin-top:0">Wie war's?</h2>
    <div class="feel">${[1, 2, 3, 4, 5].map(i => `<span class="chip ${feel === i ? "on" : ""}" data-feel="${i}">${FEEL[i]}</span>`).join("")}</div>
    <label class="f">Beschwerden oder Schmerzen? (optional)</label>
    <div class="row wrap">${Object.entries(REGIONS).map(([k, v]) => `<span class="chip ${pain.has(k) ? "on" : ""}" data-pain="${k}">${esc(v)}</span>`).join("")}</div>
    <label class="f">Notiz (optional)</label><textarea id="note" maxlength="400">${esc(note0 || "")}</textarea>
    <button class="btn full" id="ok" style="margin-top:14px">Speichern</button>`);
  bg.querySelectorAll("[data-feel]").forEach(c => c.addEventListener("click", () => { feel = Number(c.dataset.feel); bg.querySelectorAll("[data-feel]").forEach(x => x.classList.toggle("on", x === c)); }));
  bg.querySelectorAll("[data-pain]").forEach(c => c.addEventListener("click", () => { const k = c.dataset.pain; pain.has(k) ? pain.delete(k) : pain.add(k); c.classList.toggle("on"); }));
  bg.querySelector("#ok").addEventListener("click", async () => {
    try { await done(feel || 3, [...pain], bg.querySelector("#note").value.trim().slice(0, 400)); bg.remove(); } catch (e) { toast(e.message); }
  });
}
function sheet(inner) {
  const bg = document.createElement("div"); bg.className = "sheet-bg";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${inner}</div>`;
  bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg); return bg;
}

/* ---------- Pausen-Timer ---------- */
let rest = null;
function startRest(secs, label) {
  rest = { end: Date.now() + secs * 1000, label, hash: location.hash };
  tickRest();
}
function stopRest() { rest = null; $rest.innerHTML = ""; }
function tickRest() {
  if (!rest) return;
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  if (left <= 0 && !rest.rang) { rest.rang = true; signal(); setTimeout(() => { if (rest && rest.rang) stopRest(); }, 4000); }
  const go = left <= 0;
  $rest.innerHTML = `<div class="restbar ${go ? "go" : ""}"><span class="t">${go ? "Los!" : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0")}</span>
    <span class="grow small">${go ? esc(rest.label) : "Pause · dann " + esc(rest.label)}</span>
    ${go ? "" : `<button class="btn sm" data-r="-15">−15</button><button class="btn sm" data-r="15">+15</button>`}<button class="btn sm" data-r="x">✕</button></div>`;
  $rest.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.r === "x") return stopRest();
    rest.end += Number(b.dataset.r) * 1000; tickRest();
  }));
  clearTimeout(tickRest.t); tickRest.t = setTimeout(tickRest, 250);
}

// Halte-Timer (Plank, L-Sit, Dehnungen): 3 s Vorlauf, bei „je Seite“ zweimal mit 5 s Wechsel
function holdTimer(name, secs, side, anim, onDone) {
  const phases = [{ t: 3, label: "Gleich geht's los" }, { t: secs, label: side ? "Links" : "Halten", work: true }];
  if (side) phases.push({ t: 5, label: "Seite wechseln" }, { t: secs, label: "Rechts", work: true });
  const bg = sheet(`<h3>${esc(name)}</h3><div class="figwrap" id="hfig" style="margin-top:10px"></div><div class="mute" id="hlab" style="text-align:center"></div><div class="bigtimer" id="hnum"></div>
    <button class="btn alt full" id="hstop">Abbrechen</button>`);
  const stopA = mount(bg.querySelector("#hfig"), anim);
  let i = 0, end = Date.now() + phases[0].t * 1000, alive = true;
  const tick = () => {
    if (!alive) return;
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0) {
      if (phases[i].work || i === 0) signal();
      i++;
      if (i >= phases.length) { alive = false; stopA(); bg.remove(); onDone(); return; }
      end = Date.now() + phases[i].t * 1000;
    }
    bg.querySelector("#hlab").textContent = phases[i].label;
    bg.querySelector("#hnum").textContent = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    setTimeout(tick, 200);
  };
  bg.querySelector("#hstop").addEventListener("click", () => { alive = false; stopA(); bg.remove(); });
  tick();
}

/* ---------- Laufen ---------- */
function viewRun(date, s) {
  const id = date + "-main", log = logById(id);
  const data = log ? JSON.parse(JSON.stringify(log.data)) : { run: s.run, steps: [] };
  const zoneBar = `<div class="zones">${ZONES.map(z => `<div class="${z.z === s.zone || (s.run === "long" && z.z === 3 && /Zone 3|moderat|zügig/.test(s.steps[0].detail)) ? "" : "dim"}" style="background:${z.color}">Z${z.z}<br>${z.z === 1 ? "<" + (z.to + 1) : z.z === 5 ? "≥" + z.from : z.from + "–" + z.to}</div>`).join("")}</div>`;
  $app.innerHTML = header(date, s) + `
    <div class="card"><div class="row"><span class="badge run">${esc(s.short)}</span><span class="mute small">Anstrengung (RPE) ${esc(s.rpe)}</span></div>
      ${zoneBar}
      <ul class="steps">${s.steps.map((st, i) => `<li class="${st.hard ? "hard" : ""}"><button class="check ${data.steps[i] ? "on" : ""}" data-step="${i}" aria-label="${esc(st.label)} erledigt">✓</button>
        <div class="grow"><b class="t">${esc(st.label)}</b><div class="mute small">${esc(st.detail)}</div></div></li>`).join("")}</ul></div>
    ${(() => { const w = workoutFor(date); return w ? `<div class="card sug good"><b>Von Apple Health: ${esc(w.kind)}</b>
      <p style="margin:6px 0 10px">${[w.min ? Math.round(w.min) + " Min." : "", w.km ? String(w.km.toFixed(2)).replace(".", ",") + " km" : "", w.km && w.min ? paceOf(w.min, w.km) + " min/km" : "", w.hr_avg ? "Ø " + Math.round(w.hr_avg) + " bpm" : ""].filter(Boolean).map(esc).join(" · ")}</p>
      <button class="btn sm" id="fromHealth">Werte übernehmen</button></div>` : ""; })()}
    <div class="card"><b>Tipps</b><ul class="cues" style="margin-top:6px">${s.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="mute tiny" style="margin:0">Pulszonen (Apple Watch): Ruhepuls ${PROFILE.restHr}, Maximalpuls ${PROFILE.maxHr}.</p></div>
    <div class="card"><b>Werte eintragen</b> <span class="mute small">(optional, für die Statistik)</span>
      <div class="grid3" style="margin-top:6px">
        <div><label class="f">Dauer (Min.)</label><input type="text" inputmode="decimal" id="min" value="${esc(data.min || "")}"></div>
        <div><label class="f">Distanz (km)</label><input type="text" inputmode="decimal" id="km" value="${esc(data.km || "")}"></div>
        <div><label class="f">Ø Puls</label><input type="text" inputmode="numeric" id="hr" value="${esc(data.hr || "")}"></div>
      </div><p class="mute small" id="pace" style="margin:8px 0 0"></p></div>
    <button class="btn full" id="finish">${log && log.status === "done" ? "Abschluss ändern" : "Lauf erledigt"}</button>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" id="skip">Heute auslassen</button>${log ? `<button class="btn ghost sm" id="reset">Zurücksetzen</button>` : ""}</div>`;
  const readVals = () => { for (const k of ["min", "km", "hr"]) { const v = num($app.querySelector("#" + k).value); if (v > 0) data[k] = v; else delete data[k]; } };
  const showPace = () => { readVals(); const p = paceOf(data.min, data.km); $app.querySelector("#pace").textContent = p ? "Pace " + p + " min/km" + (data.hr ? " bei Ø " + data.hr + " bpm" : "") : ""; };
  showPace();
  const persist = st => saveLater({ id, date, kind: "run", status: st || (log && log.status === "done" ? "done" : "partial"), data });
  $app.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => { const i = Number(b.dataset.step); data.steps[i] = !data.steps[i]; b.classList.toggle("on", data.steps[i]); persist(); }));
  ["min", "km", "hr"].forEach(k => $app.querySelector("#" + k).addEventListener("input", () => { showPace(); persist(); }));
  const fh = $app.querySelector("#fromHealth");
  if (fh) fh.addEventListener("click", () => {
    const w = workoutFor(date);
    if (w.min) $app.querySelector("#min").value = String(Math.round(w.min));
    if (w.km) $app.querySelector("#km").value = String(Math.round(w.km * 100) / 100).replace(".", ",");
    if (w.hr_avg) $app.querySelector("#hr").value = String(Math.round(w.hr_avg));
    data.health = w.id; showPace(); persist(); toast("Werte übernommen – jetzt „Lauf erledigt“ tippen");
  });
  $app.querySelector("#finish").addEventListener("click", () => { readVals(); finishSheet(date, data.feel, data.pain, data.note, async (feel, pain, note) => {
    Object.assign(data, { feel, pain, note, run: s.run, steps: s.steps.map((_, i) => true), pv: planRef() });
    clearTimeout(saveTimer); pending = null;
    await saveLog({ id, date, kind: "run", status: "done", data }); toast("Gespeichert"); location.hash = "#/heute";
  }); });
  $app.querySelector("#skip").addEventListener("click", () => skipDay(date, "run", data));
  const rb = $app.querySelector("#reset"); if (rb) rb.addEventListener("click", () => resetDay(id));
}

/* ---------- Mobility / Erholung ---------- */
function viewMobility(date, morning, s0) {
  const s = s0 || { week: weekOf(S.start, date) || 1, title: "Morgenroutine Mobility", notes: [] };
  const id = date + (morning ? "-mob" : "-main"), log = logById(id);
  const data = log ? JSON.parse(JSON.stringify(log.data)) : { items: {} };
  data.items = data.items || {};
  const items = S.plan.data.mobility.map(m => ({ id: m.id, ex: EXERCISES[m.id], amount: m.amount, unit: m.unit === "s" ? "s" : "Wdh." }));
  const doneN = items.filter(i => data.items[i.id]).length;
  $app.innerHTML = header(date, s, `<span class="badge rec">${doneN}/${items.length}</span>`) + `
    <p class="mute small" style="margin:-4px 0 12px">${morning ? "Optional, ca. 10–15 Minuten. Nimm dir, was dir heute guttut." : items.length + " Übungen, 15–20 Minuten – dazu ein Spaziergang."}</p>
    ${items.map((it, n) => {
      const open = ui.open === "m-" + it.id;
      return `<div class="card ex ${data.items[it.id] ? "complete" : ""}" id="ex-m-${it.id}"><div class="head" data-open="m-${it.id}"><span class="num">${data.items[it.id] ? "✓" : n + 1}</span>
        <div class="grow"><b>${esc(it.ex.name)}</b><div class="mute small">${it.amount} ${it.unit}${it.ex.side ? " je Seite" : ""}</div></div>
        ${it.unit === "s" ? `<button class="timerbtn" data-hold="${it.id}" aria-label="Timer starten">▶</button>` : ""}
        <button class="check ${data.items[it.id] ? "on" : ""}" data-check="${it.id}" aria-label="erledigt">✓</button></div>
        ${open ? `<div class="body"><div class="figwrap" data-anim="${esc(it.ex.anim)}"></div><ul class="cues">${it.ex.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}</div>`;
    }).join("")}
    ${morning ? "" : `<div class="card"><label class="f" style="margin-top:0">Spaziergang (Minuten, optional)</label><input type="text" inputmode="numeric" id="walk" value="${esc(data.walk || "")}"></div>`}
    <button class="btn full" id="finish">Fertig</button>
    ${log ? `<div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" id="reset">Zurücksetzen</button></div>` : ""}`;
  const persist = st => saveLater({ id, date, kind: morning ? "mobility" : "recovery", status: st || (log && log.status === "done" ? "done" : "partial"), data });
  $app.querySelectorAll("[data-anim]").forEach(el => stops.push(mount(el, el.dataset.anim)));
  $app.querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", e => { if (e.target.closest("button")) return; ui.open = ui.open === h.dataset.open ? null : h.dataset.open; render(); }));
  $app.querySelectorAll("[data-check]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.check; data.items[k] = !data.items[k]; persist(); render(); }));
  $app.querySelectorAll("[data-hold]").forEach(b => b.addEventListener("click", () => {
    const it = items.find(i => i.id === b.dataset.hold);
    holdTimer(it.ex.name, it.amount, it.ex.side, it.ex.anim, () => { data.items[it.id] = true; persist(); render(); });
  }));
  const walk = $app.querySelector("#walk"); if (walk) walk.addEventListener("input", () => { const v = num(walk.value); if (v > 0) data.walk = v; else delete data.walk; persist(); });
  $app.querySelector("#finish").addEventListener("click", async () => {
    clearTimeout(saveTimer); pending = null;
    await saveLog({ id, date, kind: morning ? "mobility" : "recovery", status: "done", data }); toast("Gespeichert"); location.hash = "#/heute";
  });
  const rb = $app.querySelector("#reset"); if (rb) rb.addEventListener("click", () => resetDay(id));
}

/* ---------- Plan ---------- */
const famVersions = () => S.plans.filter(p => p.family === S.plan.family).sort((a, b) => b.version - a.version);
function nextMonday() { const t = todayIso(); return addDays(t, 7 - dayIndex(t)); }

function viewPlan() {
  const today = todayIso(), P = S.plan.data, cur = Math.max(1, Math.min(P.weeks, weekOf(S.start, today) || 1));
  const w = Math.min(ui.planWeek || cur, P.weeks);
  const ps = planState();
  let days = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(S.start, (w - 1) * 7 + i), s = plannedSession(d, ps), l = mainLog(d);
    const sub = s.kind === "strength" ? s.sub : s.kind === "run" ? s.short : s.sub;
    days += `<a href="#/tag/${d}"><span class="dot ${s.kind}"></span><div class="grow"><b>${DAY_NAMES[dayIndex(d)]}</b> <span class="mute small">${fmtDate(d)}</span><div class="small">${esc(s.title)} · <span class="mute">${esc(sub)}</span></div></div>
      ${l ? (l.status === "done" ? `<span class="ok">✓</span>` : l.status === "skipped" ? `<span class="mute">–</span>` : `<span class="badge">läuft</span>`) : d === today ? `<span class="badge">heute</span>` : ""}</a>`;
  }
  const drafts = S.plans.filter(p => p.status === "draft");
  const archived = S.plans.filter(p => p.status === "archived");
  const pl = S.planner || {};
  const waiting = pl.status === "offen" && !drafts.some(d => d.createdAt > pl.at);
  const editing = ui.edit && ui.editBase === S.plan.id && diffPlans(S.plan.data, ui.edit).length;
  $app.innerHTML = `<h1>Plan</h1>
    <div class="card"><div class="row"><div class="grow"><h3>${esc(P.name)}</h3><div class="mute small">Version ${S.plan.version} · ${P.weeks} Wochen · Start ${fmtDate(S.start)}</div></div><span class="badge good">aktiv</span></div>
      ${P.goal ? `<p class="small" style="margin:8px 0 0">${esc(P.goal)}</p>` : ""}
      <div class="row wrap" style="margin-top:12px"><a class="btn sm" href="#/plan/bearbeiten">${editing ? "Bearbeitung fortsetzen" : "Bearbeiten"}</a>
      <a class="btn sm alt" href="#/plan/versionen">Verlauf (${famVersions().length})</a><a class="btn sm alt" href="#/plan/planer">Neuer Plan</a></div></div>
    ${drafts.map(d => `<a class="card sug good" href="#/plan/ansehen/${d.id}" style="display:block;text-decoration:none;color:inherit"><span class="badge good">Vorschlag</span>
      <h3 style="margin-top:8px">${esc(d.name)}</h3>${d.note ? `<p>${esc(d.note)}</p>` : ""}<span class="btn sm" style="margin-top:4px">Ansehen</span></a>`).join("")}
    ${waiting ? `<div class="note" style="background:var(--acc-soft);color:var(--acc)">Deine Planer-Angaben vom ${fmtDate(pl.at.slice(0, 10))} sind gespeichert. Sag Claude im Chat „Planer ist ausgefüllt“ – dann kommen hier Vorschläge für den neuen Plan.</div>` : ""}
    <div class="weeks">${Array.from({ length: P.weeks }, (_, k) => k + 1).map(n => `<button data-w="${n}" class="${n === w ? "on" : ""} ${n === cur ? "now" : ""}">W${n}</button>`).join("")}</div>
    <div class="card list">${days}</div>
    ${archived.length ? `<a class="card row" href="#/plan/archiv" style="text-decoration:none;color:inherit"><div class="grow"><b>Archiv</b><div class="mute small">${archived.length} ${archived.length === 1 ? "früherer Plan" : "frühere Pläne"}</div></div><span class="mute">›</span></a>` : ""}`;
  $app.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { ui.planWeek = Number(b.dataset.w); render(); }));
}

// Bearbeiten: Änderungen sammeln, dann als neue Version speichern
function viewPlanEdit() {
  if (!ui.edit || ui.editBase !== S.plan.id) { ui.edit = JSON.parse(JSON.stringify(S.plan.data)); ui.editBase = S.plan.id; }
  const E = ui.edit, changes = diffPlans(S.plan.data, E);
  $app.innerHTML = `<div class="top"><a class="back" href="#/plan" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">Version ${S.plan.version} bearbeiten</div><h1 style="font-size:24px">${esc(E.name)}</h1></div></div>
    <div class="card"><label class="f" style="margin-top:0">Name des Plans</label><input type="text" id="pname" maxlength="60" value="${esc(E.name)}"></div>
    ${Object.entries(E.workouts).map(([k, w]) => `<div class="card"><b>${esc(w.title)}</b> <span class="mute small">${esc(w.sub)}</span><div class="list">
      ${w.items.map((i, n) => `<div class="it"><div class="grow" data-item="${k}:${n}" role="button" tabindex="0"><div>${esc(EXERCISES[i.id].name)}</div><div class="mute small">${i.sets} × ${i.reps.join("–")}${EXERCISES[i.id].type === "time" ? " s" : ""}${EXERCISES[i.id].side ? " je Seite" : ""}</div></div>
        <button class="more" data-up="${k}:${n}" aria-label="nach oben" ${n === 0 ? "disabled" : ""}>↑</button><button class="more" data-down="${k}:${n}" aria-label="nach unten" ${n === w.items.length - 1 ? "disabled" : ""}>↓</button></div>`).join("")}
      </div><button class="btn sm alt" data-add="${k}" style="margin-top:8px">+ Übung</button></div>`).join("")}
    <div class="card ${changes.length ? "sug good" : ""}"><b>${changes.length ? changes.length + (changes.length === 1 ? " Änderung" : " Änderungen") : "Noch keine Änderungen"}</b>
      ${changes.length ? `<ul class="cues small" style="margin-top:6px">${changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
      <label class="f">Grund (optional)</label><input type="text" id="pnote" maxlength="200" placeholder="z. B. Schulter schonen">
      <button class="btn full" id="psave" style="margin-top:12px">Als Version ${Math.max(...famVersions().map(v => v.version), S.plan.version) + 1} speichern</button>
      <button class="btn ghost full" id="pdrop" style="margin-top:6px">Änderungen verwerfen</button>` : `<p class="mute small" style="margin:6px 0 0">Tippe auf eine Übung, um sie zu ändern. Gespeichert wird erst, wenn du auf „Als Version … speichern“ tippst – die bisherige Version bleibt im Verlauf.</p>`}</div>`;
  $app.querySelector("#pname").addEventListener("change", e => { const v = e.target.value.trim(); if (v) { E.name = v.slice(0, 60); render(); } });
  const at = s => { const [k, n] = s.split(":"); return [E.workouts[k], Number(n)]; };
  $app.querySelectorAll("[data-up],[data-down]").forEach(b => b.addEventListener("click", () => {
    const [w, n] = at(b.dataset.up || b.dataset.down), m = b.dataset.up ? n - 1 : n + 1;
    [w.items[n], w.items[m]] = [w.items[m], w.items[n]]; render();
  }));
  $app.querySelectorAll("[data-item]").forEach(b => b.addEventListener("click", () => { const [w, n] = at(b.dataset.item); editItem(w, n); }));
  $app.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => {
    const w = E.workouts[b.dataset.add];
    pickExercise("Übung zu „" + w.title + "“ hinzufügen", null, eid => {
      const d = defaultsFor(eid, S.plan.data), item = { id: eid, sets: d.sets, reps: d.reps };
      if (w.items.some(x => slotOf(x) === eid)) item.slot = eid + "2";
      w.items.push(item); render();
    });
  }));
  const sv = $app.querySelector("#psave");
  if (sv) sv.addEventListener("click", async () => {
    const v = validatePlan(E); if (v.error) return toast(v.error);
    sv.disabled = true;
    try { const r = await api("/api/plan/save", { data: v.plan, note: $app.querySelector("#pnote").value.trim() }); ui.edit = null; await load(); toast("Gespeichert als Version " + r.plan.version); location.hash = "#/plan"; }
    catch (e) { sv.disabled = false; toast(e.message); }
  });
  const dr = $app.querySelector("#pdrop");
  if (dr) dr.addEventListener("click", () => { ui.edit = null; location.hash = "#/plan"; });
}
function editItem(w, n) {
  const i = w.items[n], ex = EXERCISES[i.id], unit = ex.type === "time" ? "Sekunden" : "Wiederholungen";
  const bg = sheet(`<h2 style="margin-top:0">${esc(ex.name)}</h2>
    <button class="btn alt full" id="chg">Andere Übung wählen</button>
    <div class="grid3"><div><label class="f">Sätze</label><input id="sets" type="text" inputmode="numeric" value="${i.sets}"></div>
    <div><label class="f">${unit} von</label><input id="r0" type="text" inputmode="numeric" value="${i.reps[0]}"></div><div><label class="f">bis</label><input id="r1" type="text" inputmode="numeric" value="${i.reps[1]}"></div></div>
    <button class="btn full" id="ok" style="margin-top:14px">Übernehmen</button><button class="btn danger full" id="del" style="margin-top:8px">Aus dem Plan entfernen</button>`);
  bg.querySelector("#chg").addEventListener("click", () => { bg.remove(); pickExercise("Ersetzen: " + ex.name, i.id, eid => {
    i.slot = slotOf(i);   // Platz behält seinen Namen – so passen Einträge von heute und Gewichte weiter
    if (EXERCISES[eid].type !== ex.type) i.reps = defaultsFor(eid, S.plan.data).reps;
    i.id = eid; if (i.slot === eid) delete i.slot; render(); editItem(w, n);
  }); });
  bg.querySelector("#ok").addEventListener("click", () => {
    const sets = Math.round(num(bg.querySelector("#sets").value)), r0 = Math.round(num(bg.querySelector("#r0").value)), r1 = Math.round(num(bg.querySelector("#r1").value));
    if (!(sets >= 1 && sets <= 10)) return toast("Sätze: 1 bis 10");
    if (!(r0 >= 1 && r1 >= r0 && r1 <= 900)) return toast("Bitte gültige Wiederholungen eingeben");
    Object.assign(i, { sets, reps: [r0, r1] }); bg.remove(); render();
  });
  bg.querySelector("#del").addEventListener("click", () => { w.items.splice(n, 1); bg.remove(); render(); });
}

function viewVersions() {
  const list = famVersions();
  $app.innerHTML = `<div class="top"><a class="back" href="#/plan" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">Verlauf</div><h1 style="font-size:24px">${esc(S.plan.name)}</h1></div></div>
    ${list.map(v => `<div class="card"><div class="row"><b class="grow">Version ${v.version}</b>${v.status === "active" ? `<span class="badge good">aktiv</span>` : ""}<span class="mute small">${fmtDate((v.createdAt || "").slice(0, 10))}</span></div>
      ${v.changes.length ? `<ul class="cues small" style="margin:8px 0">${v.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}${v.note ? `<p class="mute small" style="margin:0 0 8px">Grund: ${esc(v.note)}</p>` : ""}
      <a class="btn sm alt" href="#/plan/ansehen/${v.id}">Ansehen</a></div>`).join("")}`;
}
function viewArchive() {
  const list = S.plans.filter(p => p.status === "archived");
  $app.innerHTML = `<div class="top"><a class="back" href="#/plan" aria-label="Zurück">‹</a><div class="grow"><h1 style="font-size:24px">Archiv</h1></div></div>
    ${list.length ? list.map(p => `<a class="card row" href="#/plan/ansehen/${p.id}" style="text-decoration:none;color:inherit"><div class="grow"><b>${esc(p.name)}</b> <span class="mute small">Version ${p.version}</span>
      <div class="mute small">Start ${p.start ? fmtDate(p.start) : "–"} · archiviert ${fmtDate((p.archivedAt || "").slice(0, 10))}</div></div><span class="mute">›</span></a>`).join("") : `<p class="mute">Noch keine früheren Pläne.</p>`}`;
}

async function viewPlanById(id) {
  const meta = S.plans.find(p => p.id === id);
  if (!meta) { $app.innerHTML = `<div class="card">Plan nicht gefunden. <a href="#/plan">Zurück</a></div>`; return; }
  ui.planCache = ui.planCache || {};
  if (!ui.planCache[id]) { $app.innerHTML = `<p class="mute">Lädt …</p>`; try { ui.planCache[id] = await api("/api/plan?id=" + id); } catch (e) { $app.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; } if (route()[2] !== String(id)) return; }
  const p = ui.planCache[id], P = p.data;
  const back = meta.status === "draft" || meta.status === "active" ? "#/plan" : meta.status === "archived" ? "#/plan/archiv" : "#/plan/versionen";
  const label = { draft: "Vorschlag", active: "aktiv", old: "frühere Version", archived: "archiviert" }[meta.status];
  let actions = "";
  if (meta.status === "draft" || meta.status === "archived") actions = `<div class="card"><b>${meta.status === "draft" ? "Diesen Plan anwenden" : "Wieder aktivieren"}</b>
    <p class="mute small" style="margin:4px 0 8px">Dein aktueller Plan „${esc(S.plan.name)}“ (Version ${S.plan.version}) wandert ins Archiv – mit allen Versionen und Einträgen.</p>
    <label class="f">Start (Montag der Woche 1)</label><input type="date" id="pstart" value="${nextMonday()}">
    <button class="btn full" id="papply" style="margin-top:12px">Anwenden</button>${meta.status === "draft" ? `<button class="btn ghost full" id="pdiscard" style="margin-top:6px">Vorschlag verwerfen</button>` : ""}</div>`;
  else if (meta.status === "old") actions = `<div class="card"><b>Diese Version wiederherstellen</b><p class="mute small" style="margin:4px 0 10px">Wird als neue Version gespeichert – nichts geht verloren.</p><button class="btn full" id="prestore">Wiederherstellen</button></div>`;
  $app.innerHTML = `<div class="top"><a class="back" href="${back}" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">${esc(label)} · Version ${p.version}</div><h1 style="font-size:24px">${esc(P.name)}</h1></div></div>
    ${p.note ? `<div class="card sug good"><b>${meta.status === "draft" ? "Warum dieser Vorschlag" : "Notiz"}</b><p style="color:inherit">${esc(p.note)}</p></div>` : ""}
    ${p.changes.length ? `<div class="card"><b>${meta.status === "draft" ? "Das ändert sich" : "Änderungen"}</b><ul class="cues small" style="margin-top:6px">${p.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
    ${planReadOnly(P)}${actions}`;
  const ap = $app.querySelector("#papply");
  if (ap) ap.addEventListener("click", async () => {
    const st = $app.querySelector("#pstart").value; if (!st) return toast("Bitte ein Startdatum wählen");
    try { await api("/api/plan/apply", { id, start: st }); ui.planCache = {}; ui.edit = null; await load(); toast("Neuer Plan aktiv"); location.hash = "#/plan"; } catch (e) { toast(e.message); }
  });
  const dc = $app.querySelector("#pdiscard");
  if (dc) dc.addEventListener("click", async () => { if (!window.confirm("Vorschlag verwerfen?")) return; await api("/api/plan/discard", { id }); await load(); location.hash = "#/plan"; });
  const rs = $app.querySelector("#prestore");
  if (rs) rs.addEventListener("click", async () => { try { const r = await api("/api/plan/restore", { id }); await load(); toast("Wiederhergestellt als Version " + r.plan.version); location.hash = "#/plan"; } catch (e) { toast(e.message); } });
}
// Plan lesbar darstellen (Vorschläge, alte Versionen, Archiv)
function planReadOnly(P) {
  const dayTxt = d => d.kind === "strength" ? P.workouts[d.workout].title : d.kind === "run" ? P.runs[d.run].title : d.kind === "rest" ? "Ruhetag" : "Aktive Erholung";
  const runKeys = Object.keys(P.runs);
  return `${P.goal ? `<p class="small">${esc(P.goal)}</p>` : ""}
    <div class="card"><b>Woche</b> <span class="mute small">${P.weeks} Wochen</span><div class="list">${P.days.map((d, i) => `<div class="it"><span class="dot ${d.kind === "rest" ? "recovery" : d.kind}"></span><div class="grow"><b>${DAY_NAMES[i]}</b><div class="small">${esc(dayTxt(d))}</div></div></div>`).join("")}</div></div>
    ${Object.values(P.workouts).map(w => `<div class="card"><b>${esc(w.title)}</b> <span class="mute small">${esc(w.sub)}${w.minutes ? " · " + esc(w.minutes) + " Min." : ""}</span><div class="list">${w.items.map(i => `<div class="it small"><span class="grow">${esc(EXERCISES[i.id].name)}</span><span class="mute">${i.sets} × ${i.reps.join("–")}${EXERCISES[i.id].type === "time" ? " s" : ""}</span></div>`).join("")}</div></div>`).join("")}
    ${runKeys.length ? `<div class="card"><b>Läufe je Woche</b><div class="list">${Array.from({ length: P.weeks }, (_, k) => k + 1).map(n => `<div class="it small"><b style="width:30px">W${n}</b><span class="grow">${runKeys.map(r => esc(runFor(P, r, n).short)).join(" · ")}</span></div>`).join("")}</div></div>` : ""}
    ${P.focus.length ? `<div class="card"><b>Steigerung</b><div class="list">${P.focus.map(f => `<div class="it small"><b style="width:56px">W${f.from}${f.to !== f.from ? "–" + f.to : ""}</b><span class="grow">${esc(f.text)}</span></div>`).join("")}</div></div>` : ""}
    ${P.mobility.length ? `<div class="card"><b>Mobility</b> <span class="mute small">${P.mobility.length} Übungen</span><p class="small mute" style="margin:6px 0 0">${P.mobility.map(m => esc(EXERCISES[m.id].name)).join(", ")}</p></div>` : ""}`;
}

// Planer: Fragebogen für einen neuen Plan – Claude macht daraus Vorschläge
const PLANNER = [
  { k: "change", q: "Was soll anders werden?", multi: true, o: ["Neues Ziel", "Mehr Kraft / Muskelaufbau", "Mehr Ausdauer / Laufen", "Weniger Laufen", "Andere Übungen", "Mehr Abwechslung", "Kürzere Einheiten", "Andere Trainingstage", "Einschränkung berücksichtigen", "Neue Ausrüstung"] },
  { k: "goals", q: "Ziele", multi: true, o: ["Muskelaufbau", "Maximalkraft", "Core & Rücken", "VO₂max / Ausdauer", "Wettkampf (z. B. 10 km)", "Körperfett reduzieren", "Beweglichkeit", "Fit und gesund bleiben"] },
  { k: "days", q: "An welchen Tagen kannst du trainieren?", multi: true, o: DAY_NAMES.map(d => d.slice(0, 2)) },
  { k: "minutes", q: "Zeit pro Einheit (Minuten)", o: ["30", "45", "60", "75", "90"] },
  { k: "gym", q: "Fitnessstudio pro Woche", o: ["0", "1", "2", "3"] },
  { k: "runs", q: "Läufe pro Woche", o: ["0", "1", "2", "3", "4"] },
  { k: "equip", q: "Ausrüstung zuhause", multi: true, o: ["Klimmzugstange", "Ringe", "Kurzhanteln", "Widerstandsbänder", "Parallettes", "Bank", "Kettlebell", "Langhantel", "Rad / Laufband"] },
  { k: "weeks", q: "Länge des neuen Plans (Wochen)", o: ["4", "6", "8", "10", "12"] },
  { k: "good", q: "Was hat am aktuellen Plan gut funktioniert?", text: true },
  { k: "bad", q: "Was soll weg oder anders sein?", text: true },
  { k: "other", q: "Sonstiges (Wettkampf mit Datum, Urlaub, Beschwerden …)", text: true }
];
function viewPlanner() {
  const A = JSON.parse(JSON.stringify((S.planner && S.planner.answers) || { days: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"], minutes: "60", gym: "1", runs: "3", weeks: "8", equip: ["Klimmzugstange", "Ringe", "Kurzhanteln", "Widerstandsbänder", "Parallettes", "Bank"] }));
  $app.innerHTML = `<div class="top"><a class="back" href="#/plan" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">Neuer Plan</div><h1 style="font-size:24px">Planer</h1></div></div>
    <p class="mute small" style="margin:-4px 0 12px">Beantworte, was dir wichtig ist. Claude liest deine Angaben und deine bisherigen Trainings und erstellt daraus Vorschläge. Die erscheinen dann im Plan-Tab zum Ansehen und Anwenden.</p>
    ${PLANNER.map(f => `<div class="card"><b>${esc(f.q)}</b>${f.text ? `<textarea data-t="${f.k}" maxlength="500" style="margin-top:8px">${esc(A[f.k] || "")}</textarea>`
      : `<div class="row wrap" style="margin-top:8px">${f.o.map(o => `<span class="chip ${(f.multi ? (A[f.k] || []).includes(o) : A[f.k] === o) ? "on" : ""}" data-k="${f.k}" data-o="${esc(o)}">${esc(o)}</span>`).join("")}</div>`}</div>`).join("")}
    <button class="btn full" id="send">Angaben speichern</button>`;
  $app.querySelectorAll("[data-o]").forEach(c => c.addEventListener("click", () => {
    const f = PLANNER.find(x => x.k === c.dataset.k), o = c.dataset.o;
    if (f.multi) { const s = new Set(A[f.k] || []); s.has(o) ? s.delete(o) : s.add(o); A[f.k] = f.o.filter(x => s.has(x)); c.classList.toggle("on"); }
    else { A[f.k] = o; $app.querySelectorAll(`[data-k="${f.k}"]`).forEach(x => x.classList.toggle("on", x === c)); }
  }));
  $app.querySelector("#send").addEventListener("click", async () => {
    $app.querySelectorAll("[data-t]").forEach(t => { A[t.dataset.t] = t.value.trim().slice(0, 500); });
    try { await api("/api/planner", { answers: A }); await load(); toast("Gespeichert – sag Claude Bescheid"); location.hash = "#/plan"; } catch (e) { toast(e.message); }
  });
}

/* ---------- Statistik ---------- */
function viewStats() {
  const tabSel = ui.statTab || "training";
  if (tabSel === "health") {
    $app.innerHTML = `<h1>Statistik</h1>${statSwitch(tabSel)}` + viewHealthStats();
    bindStatSwitch();
    $app.querySelectorAll("[data-metric]").forEach(b => b.addEventListener("click", () => healthDetail(b.dataset.metric)));
    return;
  }
  return viewTrainingStats();
}
function statSwitch(sel) { return `<div class="seg" role="tablist"><button data-st="training" class="${sel === "training" ? "on" : ""}">Training</button><button data-st="health" class="${sel === "health" ? "on" : ""}">Gesundheit</button></div>`; }
function bindStatSwitch() { $app.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => { ui.statTab = b.dataset.st; render(); })); }
function viewTrainingStats() {
  const today = todayIso(), ps = planState();
  const curW = weekOf(S.start, today) || 0, P = S.plan.data;
  const weeks = [];
  const nW = Math.max(1, Math.min(Math.max(curW, 1), 12));
  for (let w = Math.max(1, nW - 7); w <= nW; w++) {
    const row = { w, strength: 0, run: 0, recovery: 0, km: 0, planned: 0 };
    for (let i = 0; i < 7; i++) {
      const d = addDays(S.start, (w - 1) * 7 + i);
      if (d > today) continue;
      if (!["recovery", "rest"].includes(P.days[i].kind)) row.planned++;
      const l = mainLog(d);
      if (l && l.status === "done") { row[l.kind] = (row[l.kind] || 0) + 1; if (l.kind === "run") row.km += num(l.data.km); }
    }
    weeks.push(row);
  }
  const allDone = S.logs.filter(l => l.status === "done" && l.id.endsWith("-main"));
  const planned = weeks.reduce((a, r) => a + r.planned, 0), doneMain = weeks.reduce((a, r) => a + r.strength + r.run, 0);
  const thisW = weeks[weeks.length - 1] || { strength: 0, run: 0, km: 0 };
  const runs = S.logs.filter(l => l.kind === "run" && l.status === "done" && num(l.data.km) > 0 && num(l.data.min) > 0).sort((a, b) => a.date < b.date ? -1 : 1);
  const z2 = runs.filter(l => l.data.run === "z2");
  const totalKm = runs.reduce((a, l) => a + num(l.data.km), 0);
  const feelAvg = (() => { const f = allDone.filter(l => l.data.feel).map(l => l.data.feel); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; })();

  // Kraft-Fortschritt: bester Satz je Einheit (mit Gewicht: geschätztes Maximum, sonst Wiederholungen)
  const prog = [];
  const seenSlots = new Set();
  for (const wk of Object.values(P.workouts)) for (const item of wk.items) {
    const slot = slotOf(item); if (seenSlots.has(slot)) continue; seenSlots.add(slot);
    const pts = S.logs.filter(l => l.kind === "strength" && l.data && l.data.ex && l.data.ex[slot]).sort((a, b) => a.date < b.date ? -1 : 1).map(l => {
      const e = l.data.ex[slot], sets = (e.sets || []).filter(x => x.done);
      if (!sets.length) return null;
      const weighted = sets.some(x => num(x.w) > 0);
      const best = sets.reduce((b, x) => { const v = weighted ? num(x.w) * (1 + num(x.r) / 30) : num(x.r); return v > b.v ? { v, x } : b; }, { v: -1, x: null });
      return { date: l.date, id: e.id, v: best.v, x: best.x, weighted };
    }).filter(Boolean);
    if (pts.length) prog.push({ slot, pts });
  }

  $app.innerHTML = `<h1>Statistik</h1>${statSwitch("training")}<p class="mute small" style="margin:0 0 12px">${curW ? "Woche " + Math.min(curW, 99) + " seit Planstart" : "Plan hat noch nicht begonnen"}</p>
    <div class="kpis">
      <div class="kpi"><b>${thisW.strength + thisW.run}<span class="mute" style="font-size:15px">/${P.days.filter(d => d.kind === "strength" || d.kind === "run").length}</span></b><span>Einheiten diese Woche</span></div>
      <div class="kpi"><b>${thisW.km ? thisW.km.toFixed(1).replace(".", ",") : "0"}</b><span>km diese Woche</span></div>
      <div class="kpi"><b>${planned ? Math.round(doneMain / planned * 100) : 0} %</b><span>vom Plan geschafft</span></div>
      <div class="kpi"><b>${allDone.length}</b><span>Einheiten gesamt</span></div>
      <div class="kpi"><b>${totalKm.toFixed(0)}</b><span>km gesamt</span></div>
      <div class="kpi"><b>${feelAvg ? FEEL[Math.round(feelAvg)] : "–"}</b><span>Gefühl im Schnitt</span></div>
    </div>
    <div class="card"><b>Einheiten pro Woche</b>${stackChart(weeks)}<div class="legend"><span><i class="l1"></i>Kraft</span><span><i class="l2"></i>Laufen</span><span><i class="l3"></i>Erholung</span></div></div>
    <div class="card"><b>Laufkilometer pro Woche</b>${barChart(weeks.map(r => ({ label: "W" + r.w, v: r.km })), "s2", v => v ? v.toFixed(0) : "")}</div>
    <div class="card"><b>Zone-2-Läufe: Pace</b> <span class="mute small">(höher = schneller)</span>
      ${z2.length >= 2 ? lineChart(z2.map(l => ({ label: fmtDate(l.date), v: num(l.data.min) / num(l.data.km), sub: l.data.hr ? l.data.hr + "" : "" }))) : `<p class="mute small">Nach zwei Zone-2-Läufen mit Dauer und Distanz erscheint hier dein Verlauf. Ziel: gleiches Tempo bei niedrigerem Puls (Referenz 6:56 min/km bei 134 bpm).</p>`}
      ${z2.length ? `<div class="list">${z2.slice(-5).reverse().map(l => `<div class="it small"><span class="grow">${fmtDate(l.date)} · ${String(l.data.km).replace(".", ",")} km</span><span>${paceOf(num(l.data.min), num(l.data.km))} min/km</span><span class="mute">${l.data.hr ? l.data.hr + " bpm" : ""}</span></div>`).join("")}</div>` : ""}</div>
    <div class="card"><b>Kraft-Fortschritt</b><div class="list">${prog.length ? prog.map(p => {
      const a = p.pts[0], z = p.pts[p.pts.length - 1], ex = EXERCISES[z.id];
      const fmt = q => q.weighted ? (q.x.r + " × " + fmtKg(num(q.x.w))) : (q.x.r + (ex.type === "time" ? " s" : " Wdh."));
      return `<div class="prog"><div class="grow"><div class="small"><b>${esc(ex.name)}</b></div><div class="mute small">${p.pts.length > 1 ? esc(fmt(a)) + " → " + esc(fmt(z)) : "bester Satz: " + esc(fmt(z))}</div></div>${spark(p.pts.map(q => q.v))}</div>`;
    }).join("") : `<p class="mute small">Sobald du Sätze abhakst, siehst du hier je Übung deinen besten Satz und den Verlauf.</p>`}</div></div>`;
  bindStatSwitch();
}
function stackChart(rows) {
  const W = 320, H = 140, pad = 22, bw = Math.min(28, (W - 20) / rows.length - 8), max = Math.max(7, ...rows.map(r => r.strength + r.run + r.recovery));
  const y = v => H - pad - v / max * (H - pad - 8);
  let g = `<line class="grid" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/><line class="grid" x1="0" x2="${W}" y1="${y(6)}" y2="${y(6)}" stroke-dasharray="3 3"/><text x="${W - 2}" y="${y(6) - 3}" text-anchor="end">Ziel 6</text>`;
  rows.forEach((r, i) => {
    const x = 10 + i * ((W - 20) / rows.length) + ((W - 20) / rows.length - bw) / 2;
    let acc = 0;
    for (const [k, c] of [["strength", "s1"], ["run", "s2"], ["recovery", "s3"]]) { const v = r[k] || 0; if (!v) continue; g += `<rect class="${c}" x="${x}" y="${y(acc + v)}" width="${bw}" height="${y(acc) - y(acc + v) - 1}" rx="3"/>`; acc += v; }
    g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">W${r.w}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Einheiten pro Woche">${g}</svg>`;
}
function barChart(rows, cls, lab) {
  const W = 320, H = 130, pad = 22, bw = Math.min(28, (W - 20) / rows.length - 8), max = Math.max(1, ...rows.map(r => r.v));
  const y = v => H - pad - v / max * (H - pad - 16);
  let g = `<line class="grid" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>`;
  rows.forEach((r, i) => {
    const x = 10 + i * ((W - 20) / rows.length) + ((W - 20) / rows.length - bw) / 2;
    if (r.v) g += `<rect class="${cls}" x="${x}" y="${y(r.v)}" width="${bw}" height="${y(0) - y(r.v)}" rx="3"/><text x="${x + bw / 2}" y="${y(r.v) - 4}" text-anchor="middle">${lab(r.v)}</text>`;
    g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(r.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Laufkilometer pro Woche">${g}</svg>`;
}
function lineChart(pts) {
  const W = 320, H = 140, l = 36, r = 10, t = 14, b = 22;
  const vs = pts.map(p => p.v), lo = Math.min(...vs) - 0.15, hi = Math.max(...vs) + 0.15;
  const x = i => l + (pts.length === 1 ? 0 : i * (W - l - r) / (pts.length - 1)), y = v => t + (v - lo) / (hi - lo) * (H - t - b);
  const f = v => Math.floor(v) + ":" + String(Math.round((v % 1) * 60)).padStart(2, "0");
  let g = [lo + 0.15, (lo + hi) / 2, hi - 0.15].map(v => `<line class="grid" x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 4}" y="${y(v) + 4}" text-anchor="end">${f(v)}</text>`).join("");
  g += `<path class="ln" d="${pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join("")}"/>`;
  pts.forEach((p, i) => { g += `<circle class="dot" cx="${x(i)}" cy="${y(p.v)}" r="3.5"/>`; if (pts.length <= 8 || i === 0 || i === pts.length - 1) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pace der Zone-2-Läufe">${g}</svg>`;
}
function spark(vs) {
  if (vs.length < 2) return "";
  const lo = Math.min(...vs), hi = Math.max(...vs), d = hi - lo || 1;
  return `<svg viewBox="0 0 80 28" aria-hidden="true"><path d="${vs.map((v, i) => (i ? "L" : "M") + (i * 78 / (vs.length - 1) + 1).toFixed(1) + " " + (26 - (v - lo) / d * 24).toFixed(1)).join("")}"/></svg>`;
}

/* ---------- Ich (Status, Einstellungen, Sicherheit) ---------- */
function viewMore() {
  const st = S.status || {}, today = todayIso();
  const lim = new Set((st.limits || []).map(l => l.region));
  const sick = st.sick ? st.sick.level : "";
  $app.innerHTML = `<h1>Ich</h1><p class="mute small" style="margin:0 0 12px">${PROFILE.height} cm · ${PROFILE.weight} kg · ${PROFILE.age} Jahre · VO₂max ${String(PROFILE.vo2max).replace(".", ",")}</p>
    <div class="card"><b>Wie geht's dir?</b><p class="mute small" style="margin:4px 0 10px">Die App passt die Einheiten an und schlägt Ersatzübungen vor.</p>
      <div class="row wrap"><span class="chip ${!sick ? "on" : ""}" data-sick="">Gesund</span>${Object.entries(SICK).map(([k, v]) => `<span class="chip ${sick === k ? "on" : ""}" data-sick="${k}">${esc(v.label)}</span>`).join("")}</div>
      ${sick ? `<p class="mute small" style="margin:8px 0 0">${esc(SICK[sick].text)} · seit ${fmtDate(st.sick.since)}</p>` : ""}
      <label class="f" style="margin-top:14px">Einschränkungen (Schmerzen, Verletzung)</label>
      <div class="row wrap">${Object.entries(REGIONS).map(([k, v]) => `<span class="chip ${lim.has(k) ? "on" : ""}" data-lim="${k}">${esc(v)}</span>`).join("")}</div>
      <p class="mute tiny" style="margin:10px 0 0">Kein Ersatz für ärztlichen Rat. Bei starken oder anhaltenden Schmerzen, Brustschmerz oder Atemnot bitte abklären lassen.</p></div>
    <a class="card row" href="#/mehr/health" style="text-decoration:none;color:inherit"><div class="grow"><b>Apple Health</b>
      <div class="mute small">${S.health && S.health.last && S.health.last.at ? "Letzte Übertragung " + esc(fmtWhen(S.health.last.at)) : S.health && S.health.hasKey ? "Schlüssel erzeugt – Kurzbefehl einrichten" : "Noch nicht eingerichtet"}</div></div><span class="mute">›</span></a>
    <div class="card"><b>Planstart</b><p class="mute small" style="margin:4px 0 8px">Montag der Woche 1. Danach richtet sich, welche Woche gerade dran ist.</p>
      <div class="row"><input type="date" id="start" value="${esc(S.start)}"><button class="btn sm" id="saveStart">Speichern</button></div></div>
    <div class="card"><b>Sicherheit</b>
      <p class="mute small" style="margin:4px 0 10px">Anmeldung mit Passwort und Zwei-Faktor-Code. Angemeldet auf ${S.sessions} ${S.sessions === 1 ? "Gerät" : "Geräten"} (je 30 Tage).</p>
      <label class="f">Passwort ändern</label><input type="password" id="pwOld" placeholder="Aktuelles Passwort" autocomplete="current-password">
      <input type="password" id="pwNew" placeholder="Neues Passwort (mind. 12 Zeichen)" autocomplete="new-password" style="margin-top:8px">
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" id="pw">Passwort ändern</button><button class="btn sm alt" id="others">Andere Geräte abmelden</button></div></div>
    <div class="card"><b>Deine Daten</b><p class="mute small" style="margin:4px 0 10px">Alles liegt in deiner eigenen Cloudflare-Datenbank. Export als Datei (JSON):</p>
      <div class="row wrap"><a class="btn sm alt" href="/api/export" download>Daten exportieren</a>
      <form method="post" action="/logout"><button class="btn sm danger" type="submit">Abmelden</button></form></div></div>
    <p class="mute tiny" style="text-align:center">Fitness v0.5.0</p>`;
  const saveStatus = async (status) => { try { await saveSettings({ status }); toast("Gespeichert"); } catch (e) { toast(e.message); } render(); };
  $app.querySelectorAll("[data-sick]").forEach(c => c.addEventListener("click", () => {
    const n = JSON.parse(JSON.stringify(st)), k = c.dataset.sick;
    if (!k) { if (n.sick) n.back = today; delete n.sick; } else n.sick = { level: k, since: n.sick && n.sick.since || today };
    saveStatus(n);
  }));
  $app.querySelectorAll("[data-lim]").forEach(c => c.addEventListener("click", () => {
    const n = JSON.parse(JSON.stringify(st)), k = c.dataset.lim;
    n.limits = (n.limits || []).filter(l => l.region !== k);
    if (!lim.has(k)) n.limits.push({ region: k, since: today });
    saveStatus(n);
  }));
  $app.querySelector("#saveStart").addEventListener("click", async () => {
    const v = $app.querySelector("#start").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return toast("Bitte ein Datum wählen");
    const mon = addDays(v, -dayIndex(v));
    try { await saveSettings({ start: mon }); toast(mon !== v ? "Gespeichert (auf Montag, " + fmtDate(mon) + ", gesetzt)" : "Gespeichert"); } catch (e) { toast(e.message); }
    render();
  });
  $app.querySelector("#pw").addEventListener("click", async () => {
    try { await api("/api/password", { old: $app.querySelector("#pwOld").value, new: $app.querySelector("#pwNew").value }); toast("Passwort geändert, andere Geräte abgemeldet"); await load(); render(); } catch (e) { toast(e.message); }
  });
  $app.querySelector("#others").addEventListener("click", async () => { try { await api("/api/logout-all", {}); await load(); toast("Andere Geräte abgemeldet"); render(); } catch (e) { toast(e.message); } });
}

/* ---------- Apple Health ---------- */
const SHORTCUT_NAME = "Fitness Sync";
function healthDays(days) { return (S.health && S.health.daily || []).filter(r => r.date >= addDays(todayIso(), -days + 1)); }
function lastVal(metric) { const l = (S.health && S.health.daily || []).filter(r => r.metric === metric).sort((a, b) => a.date < b.date ? 1 : -1)[0]; return l || null; }
function fmtWhen(iso) { if (!iso) return "–"; const d = new Date(iso); return d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"; }

// Kurzzeile auf der Startseite: Schlaf, Ruhepuls, HRV
function healthLine() {
  const today = todayIso(), out = [];
  const sl = (S.health && S.health.daily || []).find(r => r.metric === "sleep_total" && r.date === today);
  if (sl) out.push("😴 " + fmtVal("sleep_total", sl.value));
  for (const m of ["rhr", "hrv"]) { const l = lastVal(m); if (l && l.date >= addDays(today, -1)) out.push((m === "rhr" ? "❤️ " : "〰️ HRV ") + fmtVal(m, l.value)); }
  return out.length ? `<p class="small" style="margin:-6px 0 12px">${out.map(esc).join(" · ")}</p>` : "";
}

// Lauf aus Apple Health für einen Tag
function workoutFor(date) {
  const w = (S.health && S.health.workouts || []).filter(x => x.date === date);
  return w.find(x => x.run) || (w.length === 1 ? w[0] : null);
}

// Einrichtung und Status (Ich → Apple Health)
function viewHealthSetup() {
  const H = S.health || {}, last = H.last || {};
  const typesText = SHORTCUT_TYPES.join("\n");
  const step = (n, t, body) => `<li><b>${t}</b><div class="small" style="margin-top:4px">${body}</div></li>`;
  $app.innerHTML = `<div class="top"><a class="back" href="#/mehr" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">Ich</div><h1 style="font-size:24px">Apple Health</h1></div></div>
    <div class="card"><b>Status</b>
      ${last.at ? `<p class="small" style="margin:6px 0 0">Letzte Übertragung: <b>${esc(fmtWhen(last.received || last.at))}</b>${last.ok ? ` · ${last.days} Tageswerte · ${last.workouts} Trainings` : ` · <span style="color:var(--stop)">${esc(last.error || "Fehler")}</span>`}</p>` : `<p class="mute small" style="margin:6px 0 0">Noch keine Übertragung.</p>`}
      ${last.unknown && last.unknown.length ? `<p class="small" style="color:var(--warn);margin:6px 0 0">Nicht erkannt: ${esc(last.unknown.join(", "))}</p>` : ""}
      ${last.empty && last.empty.length ? `<p class="mute small" style="margin:6px 0 0">Ohne Werte (in den letzten Tagen nichts gemessen oder kein Zugriff): ${esc(last.empty.join(", "))}</p>` : ""}
      ${last.items && last.items.length ? `<details style="margin-top:8px"><summary class="small">Details der letzten Übertragung</summary><div class="list">${last.items.map(i => `<div class="it small"><span class="grow">${esc(i.typ)}</span><span class="mute">${i.key ? i.count + " Werte" : "unbekannt"}</span></div>`).join("")}</div></details>` : ""}
      <div class="row wrap" style="margin-top:12px"><a class="btn sm" href="shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}">Jetzt übertragen</a></div></div>

    <div class="card"><b>1. Import-Schlüssel</b>
      <p class="mute small" style="margin:4px 0 10px">Damit darf der Kurzbefehl Daten in deine App <b>schreiben</b> – lesen kann er nichts. Der Schlüssel wird nur einmal angezeigt.</p>
      <div id="keybox">${H.hasKey ? `<p class="small" style="margin:0 0 8px">Schlüssel aktiv seit ${esc(fmtWhen(H.keyCreated))}.</p>` : ""}</div>
      <div class="row wrap"><button class="btn sm" id="newKey">${H.hasKey ? "Neuen Schlüssel erzeugen" : "Schlüssel erzeugen"}</button>${H.hasKey ? `<button class="btn sm danger" id="revoke">Schlüssel sperren</button>` : ""}</div></div>

    <div class="card"><b>2. Kurzbefehl „${SHORTCUT_NAME}“ bauen</b>
      <p class="mute small" style="margin:4px 0 6px">In der App <b>Kurzbefehle</b> auf <b>+</b> tippen, Namen „${SHORTCUT_NAME}“ geben und diese Aktionen der Reihe nach hinzufügen (Suchfeld unten). Wichtig: Typen immer <b>fest auswählen</b>, nicht als Variable – sonst fragt das iPhone nicht nach dem Zugriff.</p>
      <ol class="guide">
        ${step(1, "Health-Messungen suchen", "Typ: <b>Schritte</b> (aus der Liste wählen). Startdatum ist in den letzten <b>3 Tagen</b>.")}
        ${step(2, "Zu Variable hinzufügen", "<b>Health-Messungen</b> zur Variable <b>messungen</b> hinzufügen.")}
        ${step(3, "Für jeden weiteren Typ", `Aktion 1 und 2 zusammen duplizieren (lange drücken → Duplizieren) und nur den Typ ändern. Typen: <span class="small">${SHORTCUT_TYPES.map(esc).join(" · ")}</span>`)}
        ${step(4, "Details von Health-Messungen abrufen", "Fünfmal hinzufügen, Eingabe jeweils Variable <b>messungen</b>: <b>Typ</b>, <b>Wert</b>, <b>Startdatum</b>, <b>Enddatum</b>, <b>Quelle</b>.")}
        ${step(5, "Wörterbuch", "Einträge vom Typ Text, Werte als <b>blaue Variablen</b>: <b>typ</b> = Typ, <b>werte</b> = Wert, <b>start</b> = Startdatum, <b>ende</b> = Enddatum, <b>quelle</b> = Quelle.")}
        ${step(6, "Inhalte von URL abrufen", `URL: <code class="sel" id="impUrl">${esc(location.origin)}/api/import</code> <button class="btn sm alt" data-copy="impUrl">Kopieren</button><br>
          Methode: <b>POST</b> · Header: <b>Authorization</b> = <b>Bearer</b> + Leerzeichen + dein Schlüssel · Anfragetext: <b>Datei</b> = <b>Wörterbuch</b>.`)}
      </ol>
      <p class="mute small" style="margin:8px 0 0">Beim ersten Start fragt das iPhone nach dem Health-Zugriff: <b>alle Schalter einschalten</b>. Danach hier „Jetzt übertragen“ tippen und oben den Status prüfen.</p></div>

    <div class="card"><b>3. Automatisch jeden Tag</b>
      <p class="small" style="margin:4px 0 0">Kurzbefehle → <b>Automation</b> → <b>+</b> → <b>Tageszeit</b> (z. B. 21:30, täglich) → <b>Sofort ausführen</b> → Kurzbefehl <b>„${SHORTCUT_NAME}“</b>. Health-Daten sind nur lesbar, wenn das iPhone entsperrt war – eine Zeit wählen, zu der du es meist benutzt.</p>
      <p class="mute small" style="margin:8px 0 0">Ältere Daten einmalig holen: in Schritt 4 kurz „30 Tage“ einstellen, einmal ausführen, dann wieder auf 3 zurück.</p></div>

    <div class="card"><b>Deine Daten</b><p class="mute small" style="margin:4px 0 10px">Gespeichert werden nur Tageswerte und Trainings, keine Einzelmessungen. Alles liegt in deiner eigenen Datenbank.</p>
      <button class="btn sm danger" id="delHealth">Alle Health-Daten löschen</button></div>`;
  const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); toast(msg || "Kopiert"); } catch (e) { toast("Kopieren nicht möglich – bitte markieren und kopieren"); } };

  $app.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => copy($app.querySelector("#" + b.dataset.copy).textContent)));
  $app.querySelector("#newKey").addEventListener("click", async () => {
    if (S.health.hasKey && !window.confirm("Neuen Schlüssel erzeugen? Der alte funktioniert dann nicht mehr – im Kurzbefehl muss er ersetzt werden.")) return;
    try {
      const r = await api("/api/health/key", {});
      S.health.hasKey = true; S.health.keyCreated = new Date().toISOString();
      $app.querySelector("#keybox").innerHTML = `<p class="small" style="margin:0 0 6px">Dein Schlüssel (nur jetzt sichtbar):</p><code class="sel key" id="theKey">${esc(r.key)}</code>
        <div class="row wrap" style="margin:8px 0 10px"><button class="btn sm alt" id="copyKey">Schlüssel kopieren</button><button class="btn sm alt" id="copyHeader">„Bearer …“ kopieren</button></div>`;
      $app.querySelector("#copyKey").addEventListener("click", () => copy(r.key));
      $app.querySelector("#copyHeader").addEventListener("click", () => copy("Bearer " + r.key, "Header-Wert kopiert"));
    } catch (e) { toast(e.message); }
  });
  const rv = $app.querySelector("#revoke");
  if (rv) rv.addEventListener("click", async () => { if (!window.confirm("Schlüssel sperren? Der Kurzbefehl kann dann nichts mehr übertragen.")) return; await api("/api/health/revoke", {}); await load(); render(); toast("Schlüssel gesperrt"); });
  $app.querySelector("#delHealth").addEventListener("click", async () => { if (!window.confirm("Alle übertragenen Health-Daten löschen? Deine Trainingseinträge bleiben.")) return; await api("/api/health/delete", {}); await load(); render(); toast("Health-Daten gelöscht"); });
}

// Statistik → Gesundheit
let healthLong = null;
function viewHealthStats() {
  const today = todayIso(), D = S.health && S.health.daily || [];
  const has = m => D.some(r => r.metric === m);
  const tile = m => {
    const def = METRICS[m], now = avgRange(D, m, addDays(today, -6), today), before = avgRange(D, m, addDays(today, -27), addDays(today, -7)), last = lastVal(m);
    let arrow = "";
    if (now && before && def.better) {
      const diff = (now.v - before.v) / (Math.abs(before.v) || 1);
      if (Math.abs(diff) >= 0.03) { const up = diff > 0, good = (up && def.better === "high") || (!up && def.better === "low"); arrow = `<span class="${good ? "ok" : "warnTxt"}">${up ? "▲" : "▼"}</span>`; }
    }
    const series = D.filter(r => r.metric === m).slice(-30).map(r => r.value);
    return `<button class="htile" data-metric="${m}"><span class="mute tiny">${esc(def.label)}</span><b>${now ? esc(fmtVal(m, now.v)) : "–"} ${arrow}</b>
      <span class="mute tiny">${now ? "Ø 7 Tage" : last ? "zuletzt " + fmtDate(last.date) : ""}</span>${spark(series)}</button>`;
  };
  const groups = HGROUPS.map(g => { const ms = Object.keys(METRICS).filter(m => METRICS[m].group === g && has(m) && m !== "hr_min" && m !== "hr_max"); return ms.length ? `<h2>${esc(g)}</h2><div class="htiles">${ms.map(tile).join("")}</div>` : ""; }).join("");
  const W = (S.health && S.health.workouts || []).slice(0, 12);
  const rd = readiness(S.health, today);
  return `${rd.flags.length ? `<div class="note">Erholung: ${esc(rd.flags.join(", "))}</div>` : ""}
    ${groups || `<div class="card"><b>Noch keine Health-Daten</b><p class="mute small" style="margin:6px 0 10px">Richte einmal den Kurzbefehl ein – dann erscheinen hier Ruhepuls, HRV, Schlaf, VO₂max, Gewicht und mehr.</p><a class="btn sm" href="#/mehr/health">Zur Einrichtung</a></div>`}
    ${W.length ? `<h2>Trainings (Apple Health)</h2><div class="card list">${W.map(w => `<div class="it small"><div class="grow"><b>${esc(w.kind)}</b> <span class="mute">${fmtDate(w.date)}</span>
      <div class="mute">${[w.min ? Math.round(w.min) + " Min." : "", w.km ? String(w.km.toFixed(1)).replace(".", ",") + " km" : "", w.km && w.min ? paceOf(w.min, w.km) + " /km" : "", w.hr_avg ? "Ø " + Math.round(w.hr_avg) + " bpm" : "", w.kcal ? Math.round(w.kcal) + " kcal" : ""].filter(Boolean).join(" · ")}</div></div></div>`).join("")}</div>` : ""}`;
}
async function healthDetail(m) {
  const def = METRICS[m];
  const bg = sheet(`<h2 style="margin-top:0">${esc(def.label)}</h2><div id="hd"><p class="mute">Lädt …</p></div>`);
  try { if (!healthLong || Date.now() - healthLong.at > 60000) healthLong = { at: Date.now(), data: await api("/api/health?days=120") }; } catch (e) { bg.querySelector("#hd").textContent = e.message; return; }
  const rows = healthLong.data.daily.filter(r => r.metric === m);
  if (!rows.length) { bg.querySelector("#hd").innerHTML = `<p class="mute">Keine Werte.</p>`; return; }
  const v = rows.map(r => r.value), avg = v.reduce((a, b) => a + b, 0) / v.length;
  const pts = rows.slice(-60).map(r => ({ label: fmtDate(r.date), v: r.value }));
  bg.querySelector("#hd").innerHTML = `<div class="grid3" style="margin-bottom:10px"><div class="kpi"><b>${esc(fmtVal(m, rows[rows.length - 1].value))}</b><span>zuletzt (${fmtDate(rows[rows.length - 1].date)})</span></div>
    <div class="kpi"><b>${esc(fmtVal(m, avg))}</b><span>Ø ${rows.length} Tage</span></div><div class="kpi"><b>${esc(fmtVal(m, Math.min(...v)))} – ${esc(fmtVal(m, Math.max(...v)))}</b><span>Spanne</span></div></div>
    ${pts.length >= 2 ? valueChart(pts, m) : ""}`;
}
function valueChart(pts, m) {
  const W = 320, H = 150, l = 40, r = 10, t = 12, b = 22;
  const vs = pts.map(p => p.v), lo0 = Math.min(...vs), hi0 = Math.max(...vs), pad = (hi0 - lo0) * 0.1 || 1, lo = lo0 - pad, hi = hi0 + pad;
  const x = i => l + i * (W - l - r) / (pts.length - 1), y = v => t + (hi - v) / (hi - lo) * (H - t - b);
  let g = [lo0, (lo0 + hi0) / 2, hi0].map(v => `<line class="grid" x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 4}" y="${y(v) + 4}" text-anchor="end">${esc(fmtVal(m, v).replace(/ .*$/, ""))}</text>`).join("");
  g += `<path class="ln2" d="${pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join("")}"/>`;
  g += `<text x="${l}" y="${H - 6}">${esc(pts[0].label)}</text><text x="${W - r}" y="${H - 6}" text-anchor="end">${esc(pts[pts.length - 1].label)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf ${esc(METRICS[m].label)}">${g}</svg>`;
}

/* ---------- Start ---------- */
load().then(render).catch(e => { if (e.message !== "abgemeldet") $app.innerHTML = `<div class="card">Konnte nicht laden: ${esc(e.message)}</div>`; });
