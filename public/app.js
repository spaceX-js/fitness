// Fitness – Oberfläche. Läuft nur nach Anmeldung; Daten kommen von /api (Cloudflare Worker + D1).
import { EXERCISES, WORKOUTS, WEEK, DAY_NAMES, REGIONS, ZONES, MOBILITY, PROFILE, weekOf, dayIndex } from "./plan.js";
import { plannedSession, suggestions, applyOp, addDays, daysBetween, fmtKg, fmtDate, FEEL, SICK } from "./coach.js";
import { mount, still } from "./anim.js";

const $app = document.getElementById("app"), $rest = document.getElementById("rest");
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const KIND_LABEL = { strength: "Kraft", run: "Laufen", recovery: "Erholung" };
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
async function load() { S = await api("/api/state"); loadedAt = Date.now(); }
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
  if (Date.now() - loadedAt > 60000 && !pending && !document.querySelector(".sheet-bg")) load().then(render).catch(() => {});
});

/* ---------- Hilfen ---------- */
function todayIso() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function longDate(iso) { const [y, m, d] = iso.split("-").map(Number); return DAY_NAMES[dayIndex(iso)] + ", " + d + ". " + MONTHS[m - 1]; }
function planState() { return { start: S.start, overrides: S.overrides, status: S.status, logs: S.logs }; }
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function stopAnims() { stops.forEach(f => f()); stops = []; }
const num = v => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const icon = k => k === "strength" ? "🏋️" : k === "run" ? "🏃" : "🧘";
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
  if (r[0] === "plan") return viewPlan();
  if (r[0] === "statistik") return viewStats();
  if (r[0] === "mehr") return viewMore();
  return viewToday();
}
window.scrollToTop = () => window.scrollTo(0, 0);

/* ---------- Heute ---------- */
function viewToday() {
  const today = todayIso(), ps = planState();
  const week = weekOf(S.start, today);
  const s = plannedSession(today, ps);
  const log = mainLog(today);
  const sugs = suggestions(ps, today);
  const st = S.status || {};
  const chips = [];
  if (st.sick) chips.push(`<span class="badge warn">${esc(SICK[st.sick.level].label)} seit ${fmtDate(st.sick.since)}</span>`);
  for (const l of st.limits || []) chips.push(`<span class="badge warn">Einschränkung: ${esc(REGIONS[l.region])}</span>`);
  const heroKind = s.blocked ? "blocked" : s.kind;
  const doneTxt = log ? (log.status === "done" ? "✓ Erledigt" : log.status === "skipped" ? "Ausgelassen" : "Angefangen") : "";
  const sub = s.kind === "strength" ? s.sub + " · " + s.minutes + " Min." : s.kind === "run" ? s.short : s.sub;
  const mob = logById(today + "-mob");
  let weekHtml = "";
  const mon = addDays(today, -dayIndex(today));
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), l = mainLog(d), k = WEEK[i].kind;
    const cls = l && l.status === "done" ? "done" : l && l.status === "skipped" ? "skip" : "";
    weekHtml += `<a href="#/tag/${d}" class="${d === today ? "today" : ""}"><span class="mute">${DAY_NAMES[i].slice(0, 2)}</span><span class="ic ${cls}">${cls === "done" ? "✓" : cls === "skip" ? "–" : icon(k)}</span></a>`;
  }
  $app.innerHTML = `
    <p class="mute small" style="margin:0">${esc(longDate(today))}</p>
    <h1>${week == null ? "Plan startet am " + fmtDate(S.start) : week > 8 ? "Plan geschafft 🎉" : "Woche " + week + " von 8"}</h1>
    <p class="mute small" style="margin:0 0 14px">${week && week <= 8 && s.kind === "strength" ? esc(s.focus.text) : week === 5 ? "Deload-Woche – etwas weniger Umfang" : "Phase 2 · Muskelaufbau, Core, VO₂max"}</p>
    ${chips.length ? `<div class="row wrap" style="margin-bottom:12px">${chips.join("")}</div>` : ""}
    <div class="hero ${heroKind}">
      <div class="k">Heute · ${esc(KIND_LABEL[s.kind])}</div>
      <h2>${esc(s.title)}</h2>
      <p>${esc(sub)}</p>
      ${doneTxt ? `<span class="done">${doneTxt}</span> ` : ""}<a class="btn" href="#/tag/${today}">${log ? "Öffnen" : s.blocked ? "Ansehen" : "Starten"}</a>
    </div>
    ${s.notes.map(n => `<div class="note">${esc(n)}</div>`).join("")}
    ${sugs.length ? `<h2>Vorschläge für dich</h2>` + sugs.map(sugCard).join("") : ""}
    <a class="card row" href="#/tag/${today}/mob" style="text-decoration:none;color:inherit">
      <span class="dot recovery"></span><div class="grow"><b>Morgenroutine Mobility</b><div class="mute small">optional · 10–15 Min.</div></div>
      ${mob && mob.status === "done" ? `<span class="ok">✓</span>` : `<span class="mute">›</span>`}</a>
    <h2>Diese Woche</h2>
    <div class="weekstrip">${weekHtml}</div>`;
  bindSuggestions(sugs);
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
  const s = plannedSession(date, planState());
  if (s.kind === "strength") return viewStrength(date, s);
  if (s.kind === "run") return viewRun(date, s);
  return viewMobility(date, false, s);
}
function header(date, s, extra = "") {
  return `<div class="top"><a class="back" href="#/heute" aria-label="Zurück">‹</a><div class="grow"><div class="mute small">${esc(longDate(date))} · Woche ${s.week}</div><h1 style="font-size:24px">${esc(s.title)}</h1></div>${extra}</div>
  ${s.notes && s.notes.length ? s.notes.map(n => `<div class="note">${esc(n)}</div>`).join("") : ""}`;
}

// Letzte Werte einer Übung (für Vorschläge beim Eintragen)
function lastSets(slot, id, before) {
  const l = S.logs.filter(l => l.kind === "strength" && l.date < before && l.data && l.data.ex && l.data.ex[slot] && l.data.ex[slot].id === id && (l.data.ex[slot].sets || []).some(x => x.done))
    .sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return l ? { date: l.date, sets: l.data.ex[slot].sets.filter(x => x.done) } : null;
}

function viewStrength(date, s) {
  const id = date + "-main";
  const log = logById(id);
  const data = log ? JSON.parse(JSON.stringify(log.data)) : { workout: s.workout, ex: {} };
  data.ex = data.ex || {};
  for (const it of s.items) {
    const e = data.ex[it.slot];
    if (!e || e.id !== it.id) data.ex[it.slot] = { id: it.id, sets: Array.from({ length: it.sets }, () => ({ r: "", w: "", done: false })) };
    const sets = data.ex[it.slot].sets;
    while (sets.length < it.sets) sets.push({ r: "", w: "", done: false });
    while (sets.length > it.sets && !sets[sets.length - 1].done) sets.pop();
  }
  const complete = it => data.ex[it.slot].sets.every(x => x.done);
  if (!ui.open || ui.openDate !== date || !s.items.some(i => i.slot === ui.open)) { const f = s.items.find(i => !complete(i)); ui.open = f ? f.slot : null; ui.openDate = date; }
  const persist = (status) => { const l = { id, date, kind: "strength", status: status || (log && log.status === "done" ? "done" : "partial"), data }; saveLater(l); return l; };

  const exHtml = s.items.map((it, n) => {
    const ex = EXERCISES[it.id], open = ui.open === it.slot, e = data.ex[it.slot];
    const last = lastSets(it.slot, it.id, date);
    const target = it.sets + " × " + it.reps[0] + "–" + it.reps[1] + (it.type === "time" ? " s" : "") + (it.side ? " je Seite" : "");
    const lastTxt = last ? "Letztes Mal (" + fmtDate(last.date) + "): " + last.sets.map(x => (x.r || "–") + (it.type === "time" ? " s" : "") + (num(x.w) ? " @ " + fmtKg(num(x.w)) : "")).join(" · ") : "";
    const wDefault = it.weight || (last ? Math.max(0, ...last.sets.map(x => num(x.w))) : 0);
    const rows = e.sets.map((x, k) => `
      <span class="lab">${k + 1}</span>
      <input type="text" inputmode="numeric" data-f="r" data-s="${it.slot}" data-k="${k}" value="${esc(x.r)}" placeholder="${it.type === "time" ? it.reps[1] + " s" : it.reps[0] + "–" + it.reps[1]}" aria-label="${it.type === "time" ? "Sekunden" : "Wiederholungen"} Satz ${k + 1}">
      <input type="text" inputmode="decimal" data-f="w" data-s="${it.slot}" data-k="${k}" value="${esc(x.w)}" placeholder="${wDefault ? String(wDefault).replace(".", ",") + " kg" : "kg"}" aria-label="Gewicht Satz ${k + 1}">
      ${it.type === "time" && !x.done ? `<button class="timerbtn" data-hold="${it.slot}" data-k="${k}" aria-label="Timer starten">▶</button>` : `<button class="check ${x.done ? "on" : ""}" data-check="${it.slot}" data-k="${k}" aria-label="Satz ${k + 1} erledigt">✓</button>`}`).join("");
    return `<div class="card ex ${complete(it) ? "complete" : ""}" id="ex-${it.slot}">
      <div class="head" data-open="${it.slot}"><span class="num">${complete(it) ? "✓" : n + 1}</span>
        <div class="grow"><b>${esc(it.name)}</b> ${it.swapped ? `<span class="badge">ersetzt</span>` : ""} ${it.caution ? `<span class="badge warn">Vorsicht: ${esc(it.caution)}</span>` : ""}
        <div class="mute small">${esc(target)}${it.note ? " · " + esc(it.note) : ""}</div></div>
        ${open ? "" : `<span class="thumb">${still(ex.anim)}</span>`}</div>
      ${open ? `<div class="body"><div class="figwrap" data-anim="${esc(ex.anim)}"></div>
        <ul class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
        ${lastTxt ? `<p class="mute small" style="margin:0 0 10px">${esc(lastTxt)}</p>` : ""}
        <div class="sets"><span></span><span class="lab">${it.type === "time" ? "Sekunden" : "Wdh."}</span><span class="lab">Gewicht</span><span></span>${rows}</div>
        <p class="mute tiny" style="margin:10px 0 0">Pause nach jedem Satz: ${it.rest} s · Ziel: ${esc(s.focus.rir)} Wdh. im Tank</p></div>` : ""}
    </div>`;
  }).join("");
  const doneCount = s.items.filter(complete).length;
  $app.innerHTML = header(date, s, `<span class="badge">${doneCount}/${s.items.length}</span>`) + `
    <p class="mute small" style="margin:-4px 0 12px">${esc(s.sub)} · ${esc(s.minutes)} Min. · ${esc(s.focus.text)}</p>
    <p class="mute tiny" style="margin:-6px 0 12px">Aufwärmen: 5–10 Minuten locker bewegen, danach dehnen.</p>
    ${exHtml}
    <button class="btn full" id="finish" style="margin-top:6px">${log && log.status === "done" ? "Abschluss ändern" : "Training abschließen"}</button>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" id="skip">Heute auslassen</button>${log ? `<button class="btn ghost sm" id="reset">Zurücksetzen</button>` : ""}</div>`;

  $app.querySelectorAll("[data-anim]").forEach(el => stops.push(mount(el, el.dataset.anim)));
  $app.querySelectorAll("[data-open]").forEach(h => h.addEventListener("click", () => { ui.open = ui.open === h.dataset.open ? null : h.dataset.open; render(); setTimeout(() => { const el = document.getElementById("ex-" + h.dataset.open); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30); }));
  $app.querySelectorAll("input[data-f]").forEach(inp => inp.addEventListener("input", () => {
    data.ex[inp.dataset.s].sets[Number(inp.dataset.k)][inp.dataset.f] = inp.value.trim().slice(0, 8); persist();
  }));
  const markDone = (slot, k) => {
    const it = s.items.find(i => i.slot === slot), x = data.ex[slot].sets[k];
    const inpR = $app.querySelector(`input[data-f="r"][data-s="${slot}"][data-k="${k}"]`), inpW = $app.querySelector(`input[data-f="w"][data-s="${slot}"][data-k="${k}"]`);
    if (inpR) x.r = inpR.value.trim() || x.r; if (inpW) x.w = inpW.value.trim() || x.w;
    if (!x.r) x.r = String(it.type === "time" ? it.reps[1] : (lastSets(slot, it.id, date) || { sets: [] }).sets[k]?.r || it.reps[1]);
    if (!x.w && inpW && inpW.placeholder !== "kg") x.w = inpW.placeholder.replace(" kg", "");
    x.done = true;
    const allDone = data.ex[slot].sets.every(y => y.done);
    const lastOfAll = allDone && s.items.every(i => data.ex[i.slot].sets.every(y => y.done));
    if (allDone) { const nx = s.items.find(i => !data.ex[i.slot].sets.every(y => y.done)); ui.open = nx ? nx.slot : null; }
    persist();
    if (!lastOfAll) startRest(it.rest, allDone ? "Nächste Übung" : "Satz " + (k + 2));
    render();
    if (allDone && ui.open) setTimeout(() => { const el = document.getElementById("ex-" + ui.open); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
    if (lastOfAll) { toast("Alle Übungen geschafft 💪"); }
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
  $app.querySelector("#finish").addEventListener("click", () => finishSheet(date, data.feel, data.pain, data.note, async (feel, pain, note) => {
    Object.assign(data, { feel, pain, note });
    clearTimeout(saveTimer); pending = null;
    await saveLog({ id, date, kind: "strength", status: "done", data });
    stopRest(); toast("Gespeichert"); location.hash = "#/heute";
  }));
  $app.querySelector("#skip").addEventListener("click", () => skipDay(date, "strength", data));
  const rb = $app.querySelector("#reset"); if (rb) rb.addEventListener("click", () => resetDay(id));
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
  $app.querySelector("#finish").addEventListener("click", () => { readVals(); finishSheet(date, data.feel, data.pain, data.note, async (feel, pain, note) => {
    Object.assign(data, { feel, pain, note, run: s.run, steps: s.steps.map((_, i) => true) });
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
  const items = MOBILITY.map(([eid, n, u]) => ({ id: eid, ex: EXERCISES[eid], amount: n, unit: u === "s" ? "s" : "Wdh." }));
  const doneN = items.filter(i => data.items[i.id]).length;
  $app.innerHTML = header(date, s, `<span class="badge rec">${doneN}/16</span>`) + `
    <p class="mute small" style="margin:-4px 0 12px">${morning ? "Optional, ca. 10–15 Minuten. Nimm dir, was dir heute guttut." : "16 Übungen, 15–20 Minuten – dazu ein Spaziergang."}</p>
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
function viewPlan() {
  const today = todayIso(), cur = Math.max(1, Math.min(8, weekOf(S.start, today) || 1));
  const w = ui.planWeek || cur;
  const ps = planState();
  let days = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(S.start, (w - 1) * 7 + i), s = plannedSession(d, ps), l = mainLog(d);
    const sub = s.kind === "strength" ? s.sub : s.kind === "run" ? s.short : "Mobility + Spaziergang";
    days += `<a href="#/tag/${d}"><span class="dot ${s.kind}"></span><div class="grow"><b>${DAY_NAMES[dayIndex(d)]}</b> <span class="mute small">${fmtDate(d)}</span><div class="small">${esc(s.title)} · <span class="mute">${esc(sub)}</span></div></div>
      ${l ? (l.status === "done" ? `<span class="ok">✓</span>` : l.status === "skipped" ? `<span class="mute">–</span>` : `<span class="badge">läuft</span>`) : d === today ? `<span class="badge">heute</span>` : ""}</a>`;
  }
  const ov = (S.overrides && S.overrides.ex) || {};
  const edit = Object.entries(WORKOUTS).map(([key, wk]) => `<div class="card"><b>${esc(wk.title)}</b> <span class="mute small">${esc(wk.sub)}</span><div class="list">${wk.items.map(([slot, sets, reps]) => {
    const o = ov[slot] || {}, ex = EXERCISES[o.swap || slot];
    const chg = [o.swap ? "ersetzt" : "", Number.isInteger(o.sets) ? (o.sets === 0 ? "weggelassen" : o.sets + " Sätze") : "", Array.isArray(o.reps) ? o.reps.join("–") + " Wdh." : "", o.weight ? fmtKg(o.weight) : "", o.note || ""].filter(Boolean).join(" · ");
    return `<div class="it" data-edit="${slot}" role="button" tabindex="0"><div class="grow"><div>${esc(ex.name)}</div><div class="mute small">${(Number.isInteger(o.sets) ? o.sets : sets)} × ${(o.reps || reps).join("–")}${ex.type === "time" ? " s" : ""}${chg ? ` · <span style="color:var(--acc)">${esc(chg)}</span>` : ""}</div></div><span class="mute">›</span></div>`;
  }).join("")}</div></div>`).join("");
  $app.innerHTML = `<h1>Plan</h1><p class="mute small" style="margin:0 0 12px">8 Wochen · Phase 2 · Start ${fmtDate(S.start)} (änderbar unter „Ich“)</p>
    <div class="weeks">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button data-w="${n}" class="${n === w ? "on" : ""} ${n === cur ? "now" : ""}">W${n}</button>`).join("")}</div>
    <div class="card list">${days}</div>
    <h2>Übungen anpassen</h2><p class="mute small" style="margin-top:-4px">Übung tauschen, Sätze, Wiederholungen oder Gewicht ändern. Gilt ab sofort für alle Wochen.</p>${edit}`;
  $app.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { ui.planWeek = Number(b.dataset.w); render(); }));
  $app.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => editExercise(b.dataset.edit)));
}
function editExercise(slot) {
  const base = Object.values(WORKOUTS).flatMap(w => w.items).find(i => i[0] === slot);
  const o = { ...(((S.overrides || {}).ex || {})[slot] || {}) };
  const orig = EXERCISES[slot];
  const choices = [slot, ...orig.alt, ...Object.keys(EXERCISES).filter(k => !EXERCISES[k].mob && k !== slot && !orig.alt.includes(k))];
  const bg = sheet(`<h2 style="margin-top:0">${esc(orig.name)}</h2>
    <label class="f">Übung</label><select id="swap">${choices.map((k, i) => `<option value="${k}" ${(o.swap || slot) === k ? "selected" : ""}>${esc(EXERCISES[k].name)}${i === 0 ? " (Plan)" : orig.alt.includes(k) ? " – Ersatz" : ""}</option>`).join("")}</select>
    <div class="grid3"><div><label class="f">Sätze</label><input id="sets" type="text" inputmode="numeric" value="${Number.isInteger(o.sets) ? o.sets : base[1]}"></div>
    <div><label class="f">von</label><input id="r0" type="text" inputmode="numeric" value="${(o.reps || base[2])[0]}"></div><div><label class="f">bis</label><input id="r1" type="text" inputmode="numeric" value="${(o.reps || base[2])[1]}"></div></div>
    <label class="f">Gewicht (kg, optional)</label><input id="w" type="text" inputmode="decimal" value="${o.weight ? String(o.weight).replace(".", ",") : ""}">
    <label class="f">Notiz (optional)</label><input id="n" type="text" maxlength="80" value="${esc(o.note || "")}">
    <button class="btn full" id="ok" style="margin-top:14px">Speichern</button><button class="btn ghost full" id="rs" style="margin-top:6px">Wie im Plan</button>`);
  const save = async (val) => {
    const ov = JSON.parse(JSON.stringify(S.overrides || {})); ov.ex = ov.ex || {};
    if (val) ov.ex[slot] = val; else delete ov.ex[slot];
    try { await saveSettings({ overrides: ov }); bg.remove(); toast("Gespeichert"); render(); } catch (e) { toast(e.message); }
  };
  bg.querySelector("#ok").addEventListener("click", () => {
    const v = {}, sw = bg.querySelector("#swap").value;
    if (sw !== slot) v.swap = sw;
    const sets = Math.round(num(bg.querySelector("#sets").value)); if (sets !== base[1] && sets >= 0 && sets <= 8) v.sets = sets;
    const r0 = Math.round(num(bg.querySelector("#r0").value)), r1 = Math.round(num(bg.querySelector("#r1").value));
    if (r0 > 0 && r1 >= r0 && r1 <= 300 && (r0 !== base[2][0] || r1 !== base[2][1])) v.reps = [r0, r1];
    const w = num(bg.querySelector("#w").value); if (w > 0 && w < 500) v.weight = w;
    const n = bg.querySelector("#n").value.trim(); if (n) v.note = n.slice(0, 80);
    if (Object.keys(v).length) v.reason = "manual";
    save(Object.keys(v).length ? v : null);
  });
  bg.querySelector("#rs").addEventListener("click", () => save(null));
}

/* ---------- Statistik ---------- */
function viewStats() {
  const today = todayIso(), ps = planState();
  const curW = weekOf(S.start, today) || 0;
  const weeks = [];
  const nW = Math.max(1, Math.min(Math.max(curW, 1), 12));
  for (let w = Math.max(1, nW - 7); w <= nW; w++) {
    const row = { w, strength: 0, run: 0, recovery: 0, km: 0, planned: 0 };
    for (let i = 0; i < 7; i++) {
      const d = addDays(S.start, (w - 1) * 7 + i);
      if (d > today) continue;
      if (WEEK[i].kind !== "recovery") row.planned++;
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
  for (const [key, wk] of Object.entries(WORKOUTS)) for (const [slot] of wk.items) {
    const pts = S.logs.filter(l => l.kind === "strength" && l.data && l.data.ex && l.data.ex[slot]).sort((a, b) => a.date < b.date ? -1 : 1).map(l => {
      const e = l.data.ex[slot], sets = (e.sets || []).filter(x => x.done);
      if (!sets.length) return null;
      const weighted = sets.some(x => num(x.w) > 0);
      const best = sets.reduce((b, x) => { const v = weighted ? num(x.w) * (1 + num(x.r) / 30) : num(x.r); return v > b.v ? { v, x } : b; }, { v: -1, x: null });
      return { date: l.date, id: e.id, v: best.v, x: best.x, weighted };
    }).filter(Boolean);
    if (pts.length) prog.push({ slot, pts });
  }

  $app.innerHTML = `<h1>Statistik</h1><p class="mute small" style="margin:0 0 12px">${curW ? "Woche " + Math.min(curW, 99) + " seit Planstart" : "Plan hat noch nicht begonnen"}</p>
    <div class="kpis">
      <div class="kpi"><b>${thisW.strength + thisW.run}<span class="mute" style="font-size:15px">/6</span></b><span>Einheiten diese Woche</span></div>
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
    <p class="mute tiny" style="text-align:center">Fitness v0.1.0</p>`;
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

/* ---------- Start ---------- */
load().then(render).catch(e => { if (e.message !== "abgemeldet") $app.innerHTML = `<div class="card">Konnte nicht laden: ${esc(e.message)}</div>`; });
