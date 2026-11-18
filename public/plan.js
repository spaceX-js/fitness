// Trainingsplan „8 Wochen – Phase 2“ und Übungsbibliothek.
// Wird von der Oberfläche (Browser) und von den Tests (Node) benutzt – keine Abhängigkeiten.

// Körperregionen für Einschränkungen (Verletzung, Schmerzen)
export const REGIONS = {
  schulter: "Schulter", ellbogen: "Ellbogen", handgelenk: "Handgelenk", nacken: "Nacken",
  ruecken: "Unterer Rücken", huefte: "Hüfte / Leiste", knie: "Knie", fuss: "Sprunggelenk / Fuß / Wade"
};

// Übungen. type: "reps" (Wiederholungen) oder "time" (Sekunden halten). side: pro Seite.
// load: Regionen, die belastet werden. alt: Ersatzübungen (Reihenfolge = Vorschlag).
// anim: Name der Animation in anim.js. rest: Pause zwischen Sätzen in Sekunden.
export const EXERCISES = {
  pullup:      { name: "Klimmzüge", hint: "weiter Griff oder neutral", anim: "pullup", rest: 120, load: ["schulter", "ellbogen"], alt: ["ringrow", "deadbug"],
    cues: ["Aus dem ruhigen Hang starten, Schultern nach unten ziehen", "Brust zur Stange, Kinn über die Stange", "Kontrolliert ganz ablassen – nicht schwingen"] },
  ringpushup:  { name: "Ring Push-ups", hint: "an Ringen", anim: "pushup", rest: 90, load: ["schulter", "handgelenk"], alt: ["inclinepushup", "deadbug"],
    cues: ["Körper wie ein Brett, Po nicht hängen lassen", "Ringe ruhig halten, Ellbogen ca. 45° am Körper", "Oben Ringe leicht nach außen drehen"] },
  ringrow:     { name: "Ring Rows", hint: "an Ringen", anim: "ringrow", rest: 90, load: ["schulter", "ellbogen"], alt: ["birddog"],
    cues: ["Körper gerade, Fersen am Boden", "Ringe zur unteren Brust ziehen, Schulterblätter zusammen", "Je flacher der Körper, desto schwerer"] },
  dbpress:     { name: "Kurzhantel-Schulterdrücken", hint: "sitzend oder stehend", anim: "dbpress", rest: 90, load: ["schulter", "ruecken"], alt: ["lateralraise", "deadbug"],
    cues: ["Bauch fest, kein Hohlkreuz", "Hanteln über den Kopf drücken, Arme fast gestreckt", "Langsam bis Schulterhöhe ablassen"] },
  lateralraise:{ name: "Seitheben", hint: "Kurzhanteln oder Band", anim: "lateralraise", rest: 60, load: ["schulter"], alt: ["birddog"],
    cues: ["Leicht gebeugte Arme, Schultern unten", "Bis Schulterhöhe heben, nicht höher", "Langsam ablassen, nicht mit Schwung"] },
  hangingraise:{ name: "Hanging Knee/Leg Raise", hint: "an der Klimmzugstange", anim: "hangingraise", rest: 75, load: ["schulter", "huefte"], alt: ["reversecrunch", "deadbug"],
    cues: ["Ruhig hängen, Schwung vermeiden", "Becken einrollen, Knie Richtung Brust", "Langsam absenken"] },
  ringfallout: { name: "Ring Fallout", hint: "an Ringen, kniend", anim: "fallout", rest: 75, load: ["schulter", "ruecken"], alt: ["deadbug", "plank"],
    cues: ["Aus dem Knien nach vorn ausrollen", "Bauch fest, Becken eingerollt – kein Hohlkreuz", "Nur so weit, wie du den Rücken halten kannst"] },
  sideplank:   { name: "Side Plank / Copenhagen Plank", hint: "je Seite", anim: "sideplank", type: "time", side: true, rest: 45, load: ["schulter", "huefte"], alt: ["deadbug"],
    cues: ["Ellbogen unter der Schulter", "Körper in einer Linie, Hüfte hoch", "Ruhig weiteratmen"] },
  legpress:    { name: "Beinpresse", hint: "oder Kniebeuge", anim: "legpress", rest: 150, load: ["knie", "huefte"], alt: ["legcurl", "glutebridge"],
    cues: ["Füße schulterbreit auf der Platte", "Knie zeigen in Richtung Zehen", "Unten kein runder Rücken, oben Knie nicht durchdrücken"] },
  legcurl:     { name: "Beinbeuger-Maschine", hint: "Leg Curl, sitzend oder liegend", anim: "legcurl", rest: 90, load: ["knie"], alt: ["glutebridge"],
    cues: ["Knie auf Höhe der Drehachse", "Fersen kraftvoll Richtung Po ziehen", "Langsam zurück"] },
  chestpress:  { name: "Brustpresse", hint: "oder KH-Bankdrücken", anim: "chestpress", rest: 120, load: ["schulter", "ellbogen"], alt: ["inclinepushup"],
    cues: ["Griffe auf Brusthöhe", "Schulterblätter zusammen und unten", "Drücken ohne die Arme ganz durchzudrücken"] },
  latpulldown: { name: "Latzug", hint: "weiter oder neutraler Griff", anim: "latpulldown", rest: 120, load: ["schulter", "ellbogen"], alt: ["cablerow"],
    cues: ["Aufrecht sitzen, Brust raus", "Stange zur oberen Brust ziehen", "Kontrolliert nach oben, Arme lang"] },
  cablerow:    { name: "Kabelrudern", hint: "sitzend", anim: "cablerow", rest: 90, load: ["ruecken", "ellbogen"], alt: ["ringrow", "birddog"],
    cues: ["Rücken gerade, nicht nach hinten schaukeln", "Griff zum Bauch ziehen, Schulterblätter zusammen", "Langsam nach vorn, Arme lang"] },
  machinepress:{ name: "Schulterdrücken", hint: "Maschine oder KH", anim: "dbpress", rest: 90, load: ["schulter"], alt: ["lateralraise"],
    cues: ["Rücken an der Lehne", "Nach oben drücken, ohne die Schultern hochzuziehen", "Bis Ohrhöhe ablassen"] },
  cablecrunch: { name: "Cable Crunch", hint: "am Kabelzug, kniend", anim: "cablecrunch", rest: 60, load: ["ruecken"], alt: ["deadbug", "reversecrunch"],
    cues: ["Seil neben dem Kopf halten", "Mit dem Bauch einrollen – Hüfte bleibt", "Langsam aufrollen"] },
  backext:     { name: "Back Extension", hint: "Rückenstrecker", anim: "backext", rest: 60, load: ["ruecken"], alt: ["birddog", "glutebridge"],
    cues: ["Polster auf Hüfthöhe", "Aus der Hüfte aufrichten bis Körper gerade", "Nicht ins Hohlkreuz überstrecken"] },
  ringdip:     { name: "Ring Dips / Parallettes Dips", hint: "", anim: "dip", rest: 120, load: ["schulter", "ellbogen", "handgelenk"], alt: ["inclinepushup", "deadbug"],
    cues: ["Oben stabil, Arme gestreckt", "Absenken, bis Oberarme etwa waagerecht", "Schultern weg von den Ohren"] },
  chinup:      { name: "Chin-ups", hint: "Untergriff", anim: "pullup", rest: 120, load: ["schulter", "ellbogen"], alt: ["ringrow", "birddog"],
    cues: ["Hände schulterbreit, Handflächen zu dir", "Brust zur Stange ziehen", "Ganz ablassen"] },
  splitsquat:  { name: "Bulgarian Split Squat", hint: "mit KH", anim: "splitsquat", side: true, rest: 90, load: ["knie", "huefte"], alt: ["glutebridge", "wallsit"],
    cues: ["Hinterer Fuß auf der Bank", "Gerade nach unten sinken, vorderes Knie über dem Fuß", "Über die vordere Ferse hochdrücken"] },
  singlerdl:   { name: "Einbeiniger RDL", hint: "mit KH", anim: "rdl", side: true, rest: 90, load: ["ruecken", "huefte"], alt: ["glutebridge"],
    cues: ["Standbein leicht gebeugt", "Hüfte nach hinten, Oberkörper und hinteres Bein eine Linie", "Rücken gerade, langsam aufrichten"] },
  lsit:        { name: "L-Sit Progression", hint: "auf Parallettes", anim: "lsit", type: "time", rest: 75, load: ["handgelenk", "schulter", "huefte"], alt: ["deadbug", "hollow"],
    cues: ["Schultern runterdrücken, Arme gestreckt", "Erst gehockt (Knie angezogen), später Beine gestreckt", "Lieber kurz und sauber"] },
  pallof:      { name: "Pallof Press", hint: "mit Band", anim: "pallof", side: true, rest: 45, load: [], alt: [],
    cues: ["Seitlich zum Band stehen", "Hände vor der Brust nach vorn drücken", "Nicht vom Band verdrehen lassen"] },
  reversecrunch:{ name: "Reverse Crunch", hint: "am Boden oder hängend", anim: "reversecrunch", rest: 60, load: ["ruecken"], alt: ["deadbug"],
    cues: ["Rücken am Boden", "Becken einrollen, Knie zur Brust", "Langsam zurück"] },
  copenhagen:  { name: "Copenhagen Plank", hint: "alternative seitliche Core-Übung", anim: "copenhagen", type: "time", side: true, rest: 45, load: ["huefte", "knie", "schulter"], alt: ["sideplank", "deadbug"],
    cues: ["Oberes Bein auf der Bank (Knie = leichter)", "Hüfte heben, Körper gerade", "Ruhig atmen"] },

  // Ersatzübungen (für Einschränkungen und Anpassungen)
  inclinepushup:{ name: "Liegestütz erhöht", hint: "Hände auf Bank oder Tisch", anim: "pushup", rest: 75, load: ["handgelenk"], alt: [],
    cues: ["Hände erhöht = leichter", "Körper gerade", "Brust zur Kante"] },
  deadbug:     { name: "Dead Bug", hint: "Rückenlage", anim: "deadbug", rest: 45, load: [], alt: [],
    cues: ["Unterer Rücken bleibt am Boden", "Gegenüberliegenden Arm und Bein langsam strecken", "Ausatmen beim Strecken"] },
  birddog:     { name: "Bird Dog", hint: "Vierfüßlerstand", anim: "birddog", side: true, rest: 45, load: [], alt: [],
    cues: ["Rücken flach wie ein Tisch", "Gegenüberliegenden Arm und Bein strecken", "Kurz halten, nicht kippen"] },
  glutebridge: { name: "Glute Bridge", hint: "Rückenlage", anim: "glutebridge", rest: 45, load: [], alt: [],
    cues: ["Füße hüftbreit, nah am Po", "Hüfte hoch, bis Körper gerade", "Po oben kurz anspannen"] },
  plank:       { name: "Unterarmstütz", hint: "Plank", anim: "plank", type: "time", rest: 45, load: ["schulter"], alt: ["deadbug"],
    cues: ["Ellbogen unter den Schultern", "Körper gerade, Bauch fest", "Ruhig atmen"] },
  hollow:      { name: "Hollow Hold", hint: "Rückenlage", anim: "hollow", type: "time", rest: 45, load: [], alt: ["deadbug"],
    cues: ["Unterer Rücken am Boden", "Schultern und Beine leicht anheben", "Mit gebeugten Knien leichter"] },
  wallsit:     { name: "Wandsitzen", hint: "", anim: "wallsit", type: "time", rest: 60, load: ["knie"], alt: ["glutebridge"],
    cues: ["Rücken an der Wand", "Knie über den Füßen", "So tief, wie es schmerzfrei geht"] },

  // Mobility (16 Übungen)
  catcow:      { name: "Cat / Cow", anim: "catcow", mob: true, cues: ["Vierfüßlerstand", "Rücken rund machen, dann ins Hohlkreuz", "Mit dem Atem bewegen"] },
  childpose:   { name: "Child's Pose", anim: "childpose", mob: true, type: "time", cues: ["Po zu den Fersen", "Arme lang nach vorn", "Tief in den Rücken atmen"] },
  cobra:       { name: "Cobra", anim: "cobra", mob: true, type: "time", cues: ["Bauchlage, Hände unter den Schultern", "Oberkörper sanft hochdrücken", "Becken bleibt am Boden"] },
  deeplunge:   { name: "Deep Lunge", anim: "deeplunge", mob: true, type: "time", side: true, cues: ["Großer Ausfallschritt", "Hüfte sinkt nach vorn-unten", "Hinteres Knie darf ablegen"] },
  quadstretch: { name: "Quad Stretch (kniend)", anim: "quadstretch", mob: true, type: "time", side: true, cues: ["Kniender Ausfallschritt", "Hinteren Fuß zum Po ziehen", "Po anspannen, kein Hohlkreuz"] },
  worldsgreatest:{ name: "World's Greatest Stretch", anim: "worldsgreatest", mob: true, side: true, cues: ["Tiefer Ausfallschritt", "Ellbogen zum vorderen Fuß", "Arm zur Decke aufdrehen"] },
  ninetyninety:{ name: "90/90 Stretch", anim: "ninetyninety", mob: true, side: true, cues: ["Beide Knie 90° gebeugt", "Aufrecht, dann über das vordere Bein lehnen", "Seite wechseln"] },
  pigeon:      { name: "Pigeon Pose", anim: "pigeon", mob: true, type: "time", side: true, cues: ["Vorderes Bein quer gebeugt", "Hinteres Bein lang", "Oberkörper nach vorn sinken lassen"] },
  deepsquat:   { name: "Deep Squat Hold", anim: "deepsquat", mob: true, type: "time", cues: ["Fersen am Boden", "Ellbogen drücken Knie nach außen", "Brust aufrecht"] },
  anklerocks:  { name: "Ankle Rocks", anim: "anklerocks", mob: true, side: true, cues: ["Halbkniend", "Knie über die Zehen nach vorn schieben", "Ferse bleibt unten"] },
  rollingback: { name: "Rolling Back", anim: "rollingback", mob: true, cues: ["Aus der Hocke auf den Rücken rollen", "Rund bleiben", "Zurück in die Hocke"] },
  hipcars:     { name: "Hip CARs", anim: "hipcars", mob: true, side: true, cues: ["Auf einem Bein stehen, festhalten erlaubt", "Knie hoch, nach außen, nach hinten kreisen", "Langsam, Rest des Körpers ruhig"] },
  scorpion:    { name: "Scorpion", anim: "scorpion", mob: true, side: true, cues: ["Bauchlage, Arme seitlich", "Ferse über den Körper zur anderen Hand", "Schultern bleiben am Boden"] },
  rockbacks:   { name: "Rock Backs", anim: "rockbacks", mob: true, type: "time", cues: ["Vierfüßlerstand", "Po zu den Fersen schieben", "Rücken bleibt gerade"] },
  scorpionreach:{ name: "Scorpion Reach", anim: "scorpion", mob: true, side: true, cues: ["Wie Scorpion", "Mit dem Fuß weit über den Körper greifen", "Kurz halten"] },
  downdog:     { name: "Downward Dog", anim: "downdog", mob: true, type: "time", cues: ["Hüfte hoch, Arme lang", "Fersen abwechselnd zum Boden", "Rücken lang, Knie dürfen beugen"] }
};

export const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const PROFILE = { height: 171, weight: 73, age: 43, restHr: 60, maxHr: 178, vo2max: 48.4, z2pace: "6:56", z2hr: 134 };
export const ZONES = [
  { z: 1, from: 0, to: 129, color: "#4c8dff" }, { z: 2, from: 130, to: 140, color: "#2fb36d" },
  { z: 3, from: 141, to: 153, color: "#f2c230" }, { z: 4, from: 154, to: 165, color: "#f28a30" }, { z: 5, from: 166, to: 999, color: "#e5484d" }
];


/* ---------- Standardplan „Phase 2“ (aus dem Trainingsplan-Bild) ---------- */
// Ein Plan ist reine Daten (wird in der Datenbank versioniert). Aufbau:
// { name, goal, weeks, days[7]: {kind: strength|run|recovery|rest, workout|run},
//   workouts: {key: {title, sub, minutes, items: [{id, sets, reps:[von,bis], slot?}]}},
//   runs: {key: {title, zone, rpe, tips[], weeks: {"1": {short, km?, steps:[{label, detail, min?, km?, hard?}]}}}},
//   focus: [{from, to, rir, text, deload?}], mobility: [{id, amount, unit: "s"|"Wdh"}] }
function legacyRun(type, week) {
  if (type === "z2") {
    const min = week === 5 ? "35–40" : "35–45";
    return { short: min + " Min. locker", steps: [{ label: "Locker laufen", detail: min + " Minuten, Puls 130–140 (Zone 2). Pace ca. 6:30–7:10 min/km – der Puls ist wichtiger als das Tempo.", min: week === 5 ? 37 : 40 }] };
  }
  if (type === "interval") {
    const t = { 1: [4, 3], 2: [4, 3], 3: [5, 3], 4: [5, 3], 5: [4, 3], 6: [4, 4], 7: [4, 4], 8: [5, 3] }[week];
    const steps = [{ label: "Einlaufen", detail: "10 Minuten locker", min: 10 }];
    for (let i = 1; i <= t[0]; i++) {
      steps.push({ label: "Intervall " + i + " von " + t[0], detail: t[1] + " Minuten schnell (RPE 8–9)", min: t[1], hard: true });
      if (i < t[0]) steps.push({ label: "Trabpause", detail: "2 Minuten locker traben", min: 2 });
    }
    steps.push({ label: "Auslaufen", detail: "10 Minuten locker", min: 10 });
    return { short: t[0] + " × " + t[1] + " Min. schnell" + (week === 5 ? " (Deload)" : ""), steps };
  }
  const l = { 1: ["8 km locker", "8 km locker in Zone 2", 8], 2: ["9 km locker", "9 km locker in Zone 2", 9],
    3: ["9 km + 10 Min. moderat", "9 km locker, die letzten 10 Minuten moderat (Zone 3, 141–153)", 9],
    4: ["10 km locker", "10 km locker in Zone 2", 10], 5: ["8 km locker", "8 km locker in Zone 2 (Deload)", 8],
    6: ["10 km mit 2 × 8 Min. Zone 3", "10 km, darin 2 × 8 Minuten in Zone 3 (141–153), sonst locker", 10],
    7: ["10 km locker", "10 km locker in Zone 2", 10], 8: ["10 km progressiv", "10 km progressiv: locker → moderat → letzte 2 km zügig", 10] }[week];
  return { short: l[0], km: l[2], steps: [{ label: "Langer Lauf", detail: l[1], km: l[2] }] };
}
const wk = type => Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(w => [String(w), legacyRun(type, w)]));
const it = (id, sets, reps) => ({ id, sets, reps });

export const DEFAULT_PLAN = {
  name: "Phase 2",
  goal: "Muskelaufbau, starker Core, Hüfte & unterer Rücken, VO₂max steigern, Körperfett reduzieren",
  weeks: 8,
  days: [{ kind: "strength", workout: "homeA" }, { kind: "run", run: "z2" }, { kind: "strength", workout: "gym" }, { kind: "recovery" },
    { kind: "run", run: "interval" }, { kind: "strength", workout: "homeB" }, { kind: "run", run: "long" }],
  workouts: {
    homeA: { title: "Home Workout A", sub: "Oberkörper + Core", minutes: "50–60", items: [
      it("pullup", 4, [5, 10]), it("ringpushup", 4, [8, 15]), it("ringrow", 3, [8, 15]), it("dbpress", 3, [8, 12]),
      it("lateralraise", 3, [12, 20]), it("hangingraise", 3, [6, 12]), it("ringfallout", 3, [6, 12]), it("sideplank", 2, [30, 45])] },
    gym: { title: "Fitnessstudio", sub: "Ganzkörper (schwer)", minutes: "60–75", items: [
      it("legpress", 3, [6, 10]), it("legcurl", 3, [8, 12]), it("chestpress", 3, [6, 10]), it("latpulldown", 3, [6, 10]),
      it("cablerow", 3, [8, 12]), it("machinepress", 2, [8, 12]), it("cablecrunch", 3, [8, 15]), it("backext", 3, [10, 15])] },
    homeB: { title: "Home Workout B", sub: "Calisthenics + Core / Hüfte", minutes: "50–60", items: [
      it("ringdip", 3, [5, 10]), it("chinup", 3, [6, 10]), it("splitsquat", 2, [8, 12]), it("singlerdl", 3, [8, 12]),
      it("lsit", 4, [10, 30]), it("pallof", 3, [10, 15]), it("reversecrunch", 3, [10, 15]), it("copenhagen", 2, [20, 45])] }
  },
  runs: {
    z2: { title: "Lauf – Zone 2", zone: 2, rpe: "3–4/10", tips: ["Du kannst dich dabei noch unterhalten", "Ziel: gleiches Tempo mit niedrigerem Puls oder schneller bei gleichem Puls", "Referenz: 6:56 min/km bei 134 bpm"], weeks: wk("z2") },
    interval: { title: "Intervalllauf (VO₂max)", zone: 4, rpe: "8–9/10", tips: ["Gleichmäßig – das erste Intervall nicht zu schnell", "Letztes Drittel jedes Intervalls darf hart sein", "Ziel: VO₂max Richtung 50"], weeks: wk("interval") },
    long: { title: "Ausdauer + Tempo", zone: 2, rpe: "3–6/10", tips: ["Puls überwiegend 130–141 (Zone 2)", "Tempoanteile kontrolliert, nicht jedes Mal", "Ziel: Ausdauer, Tempohärte, Laufökonomie"], weeks: wk("long") }
  },
  focus: [
    { from: 1, to: 2, rir: "2–3", text: "Gewichte finden – 2–3 Wiederholungen im Tank lassen" },
    { from: 3, to: 4, rir: "1–2", text: "Steigern – 1–2 Wiederholungen im Tank" },
    { from: 5, to: 5, rir: "3", text: "Deload-Woche – ein Satz weniger, leichter (−25–30 % Volumen)", deload: true },
    { from: 6, to: 7, rir: "1–2", text: "Wieder steigern – 1–2 Wiederholungen im Tank" },
    { from: 8, to: 8, rir: "~1", text: "Letzte Woche – die letzten Sätze dürfen fordernd sein" }],
  mobility: [["catcow", 15], ["childpose", 30, "s"], ["cobra", 30, "s"], ["deeplunge", 30, "s"], ["quadstretch", 30, "s"], ["worldsgreatest", 15],
    ["ninetyninety", 15], ["pigeon", 30, "s"], ["deepsquat", 30, "s"], ["anklerocks", 15], ["rollingback", 15], ["hipcars", 15],
    ["scorpion", 15], ["rockbacks", 15, "s"], ["scorpionreach", 15], ["downdog", 30, "s"]].map(([id, amount, u]) => ({ id, amount, unit: u === "s" ? "s" : "Wdh" }))
};

export const slotOf = item => item.slot || item.id;
export const planOf = state => (state && state.plan) || DEFAULT_PLAN;
export const planItems = plan => Object.values(plan.workouts).flatMap(w => w.items);

// Standardwerte, wenn eine Übung neu hinzukommt
export function defaultsFor(id, plan) {
  const found = plan && planItems(plan).find(i => i.id === id);
  if (found) return { sets: found.sets, reps: found.reps.slice() };
  const ex = EXERCISES[id];
  if (ex.mob) return ex.type === "time" ? { sets: 1, reps: [30, 30] } : { sets: 1, reps: [10, 15] };
  return ex.type === "time" ? { sets: 3, reps: [20, 40] } : { sets: 3, reps: [8, 12] };
}

// Prüft einen Plan (aus dem Planer, von Claude oder der Bearbeitung). Gibt { plan } oder { error } zurück.
export function validatePlan(p) {
  const err = m => ({ error: m });
  const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!p || typeof p !== "object") return err("Kein Plan.");
  if (!str(p.name, 60)) return err("Name fehlt oder ist zu lang.");
  if (!int(p.weeks, 1, 16)) return err("Wochen: 1 bis 16.");
  const out = { name: p.name.trim(), goal: typeof p.goal === "string" ? p.goal.slice(0, 300) : "", weeks: p.weeks, days: [], workouts: {}, runs: {}, focus: [], mobility: [] };
  if (!p.workouts || typeof p.workouts !== "object" || Object.keys(p.workouts).length > 10) return err("Krafteinheiten fehlen oder zu viele.");
  for (const [k, w] of Object.entries(p.workouts)) {
    if (!/^[a-zA-Z0-9]{1,20}$/.test(k) || !w || !str(w.title, 60) || !Array.isArray(w.items) || w.items.length > 20) return err("Einheit „" + k + "“ ist ungültig.");
    const slots = new Set(), items = [];
    for (const i of w.items) {
      if (!i || !EXERCISES[i.id] || !int(i.sets, 0, 10) || !Array.isArray(i.reps) || !int(i.reps[0], 1, 900) || !int(i.reps[1], i.reps[0], 900)) return err("Übung in „" + w.title + "“ ist ungültig: " + (i && i.id));
      const slot = i.slot && /^[a-zA-Z0-9]{1,24}$/.test(i.slot) ? i.slot : i.id;
      if (slots.has(slot)) return err("Übung doppelt in „" + w.title + "“: " + EXERCISES[i.id].name);
      slots.add(slot);
      items.push(slot === i.id ? { id: i.id, sets: i.sets, reps: [i.reps[0], i.reps[1]] } : { id: i.id, slot, sets: i.sets, reps: [i.reps[0], i.reps[1]] });
    }
    out.workouts[k] = { title: w.title.trim(), sub: typeof w.sub === "string" ? w.sub.slice(0, 80) : "", minutes: typeof w.minutes === "string" ? w.minutes.slice(0, 20) : "", items };
  }
  for (const [k, r] of Object.entries(p.runs || {})) {
    if (!/^[a-zA-Z0-9]{1,20}$/.test(k) || !r || !str(r.title, 60) || !r.weeks || typeof r.weeks !== "object") return err("Lauf „" + k + "“ ist ungültig.");
    const weeks = {};
    for (const [n, v] of Object.entries(r.weeks)) {
      if (!int(Number(n), 1, 16) || !v || !str(v.short, 80) || !Array.isArray(v.steps) || !v.steps.length || v.steps.length > 30) return err("Lauf „" + r.title + "“, Woche " + n + " ist ungültig.");
      const steps = v.steps.map(s => ({ label: String(s.label || "").slice(0, 60), detail: String(s.detail || "").slice(0, 240), ...(s.min > 0 ? { min: Number(s.min) } : {}), ...(s.km > 0 ? { km: Number(s.km) } : {}), ...(s.hard ? { hard: true } : {}) }));
      if (steps.some(s => !s.label)) return err("Lauf „" + r.title + "“: Schritt ohne Namen.");
      weeks[String(Number(n))] = { short: v.short.trim(), ...(v.km > 0 ? { km: Number(v.km) } : {}), steps };
    }
    if (!Object.keys(weeks).length) return err("Lauf „" + r.title + "“ hat keine Wochen.");
    out.runs[k] = { title: r.title.trim(), zone: int(r.zone, 1, 5) ? r.zone : 2, rpe: typeof r.rpe === "string" ? r.rpe.slice(0, 20) : "", tips: (Array.isArray(r.tips) ? r.tips : []).slice(0, 6).map(t => String(t).slice(0, 160)), weeks };
  }
  if (!Array.isArray(p.days) || p.days.length !== 7) return err("Es braucht genau 7 Wochentage.");
  for (const d of p.days) {
    if (!d || !["strength", "run", "recovery", "rest"].includes(d.kind)) return err("Ungültiger Wochentag.");
    if (d.kind === "strength" && !out.workouts[d.workout]) return err("Wochentag verweist auf unbekannte Krafteinheit.");
    if (d.kind === "run" && !out.runs[d.run]) return err("Wochentag verweist auf unbekannten Lauf.");
    out.days.push(d.kind === "strength" ? { kind: d.kind, workout: d.workout } : d.kind === "run" ? { kind: d.kind, run: d.run } : { kind: d.kind });
  }
  for (const f of Array.isArray(p.focus) ? p.focus.slice(0, 16) : []) {
    if (!f || !int(f.from, 1, 16) || !int(f.to, f.from, 16)) return err("Steigerung (focus) ist ungültig.");
    out.focus.push({ from: f.from, to: f.to, rir: String(f.rir || "").slice(0, 10), text: String(f.text || "").slice(0, 140), ...(f.deload ? { deload: true } : {}) });
  }
  for (const m of Array.isArray(p.mobility) ? p.mobility.slice(0, 30) : []) {
    if (!m || !EXERCISES[m.id] || !int(m.amount, 1, 600)) return err("Mobility-Übung ist ungültig.");
    out.mobility.push({ id: m.id, amount: m.amount, unit: m.unit === "s" ? "s" : "Wdh" });
  }
  return { plan: out };
}

// Unterschiede zweier Planversionen in Worten (für den Versionsverlauf)
export function diffPlans(a, b) {
  const out = [];
  if (a.name !== b.name) out.push("Name: " + a.name + " → " + b.name);
  if (a.weeks !== b.weeks) out.push("Dauer: " + a.weeks + " → " + b.weeks + " Wochen");
  for (const [k, w] of Object.entries(b.workouts)) {
    const old = a.workouts[k];
    if (!old) { out.push("Neue Einheit: " + w.title); continue; }
    const om = new Map(old.items.map(i => [slotOf(i), i])), nm = new Map(w.items.map(i => [slotOf(i), i]));
    for (const [s, i] of nm) {
      const o = om.get(s);
      if (!o) out.push(w.title + ": + " + EXERCISES[i.id].name);
      else {
        if (o.id !== i.id) out.push(w.title + ": " + EXERCISES[o.id].name + " → " + EXERCISES[i.id].name);
        if (o.sets !== i.sets) out.push(EXERCISES[i.id].name + ": " + o.sets + " → " + i.sets + " Sätze");
        if (o.reps[0] !== i.reps[0] || o.reps[1] !== i.reps[1]) out.push(EXERCISES[i.id].name + ": " + o.reps.join("–") + " → " + i.reps.join("–") + (EXERCISES[i.id].type === "time" ? " s" : " Wdh."));
      }
    }
    for (const [s, o] of om) if (!nm.has(s)) out.push(w.title + ": − " + EXERCISES[o.id].name);
    const oo = old.items.map(slotOf).filter(s => nm.has(s)).join(), no = w.items.map(slotOf).filter(s => om.has(s)).join();
    if (oo !== no) out.push(w.title + ": Reihenfolge geändert");
  }
  for (const k of Object.keys(a.workouts)) if (!b.workouts[k]) out.push("Einheit entfernt: " + a.workouts[k].title);
  if (JSON.stringify(a.days) !== JSON.stringify(b.days)) out.push("Wochenablauf geändert");
  if (JSON.stringify(a.runs) !== JSON.stringify(b.runs)) out.push("Läufe geändert");
  if (JSON.stringify(a.mobility) !== JSON.stringify(b.mobility)) out.push("Mobility geändert");
  if (JSON.stringify(a.focus) !== JSON.stringify(b.focus)) out.push("Steigerung geändert");
  return out;
}

export function focusFor(plan, week) {
  return (plan.focus || []).find(f => week >= f.from && week <= f.to) || { rir: "1–3", text: "Sauber trainieren, 1–3 Wiederholungen im Tank" };
}
export function runFor(plan, key, week) {
  const r = plan.runs[key];
  const n = Object.keys(r.weeks).map(Number).filter(x => x <= week).sort((a, b) => b - a)[0] || Math.min(...Object.keys(r.weeks).map(Number));
  return { title: r.title, zone: r.zone, rpe: r.rpe, tips: r.tips, ...r.weeks[String(n)] };
}

// Woche im Plan (1–n) aus Startdatum (Montag) und Datum; null = vor Start
export function weekOf(startIso, dateIso) {
  const d = (Date.parse(dateIso + "T12:00:00Z") - Date.parse(startIso + "T12:00:00Z")) / 86400000;
  if (isNaN(d) || d < 0) return null;
  return Math.floor(d / 7) + 1;
}
export function dayIndex(dateIso) { return (new Date(dateIso + "T12:00:00Z").getUTCDay() + 6) % 7; }
export function mondayIso(dateIso) { const d = new Date(dateIso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - dayIndex(dateIso)); return d.toISOString().slice(0, 10); }

// Tage in einer Woche tauschen (ohne neue Planversion): overrides.moves["Montag der Woche"] = [Quelltag je Wochentag]
export function sourceDay(state, dateIso) {
  const di = dayIndex(dateIso), m = state && state.overrides && state.overrides.moves && state.overrides.moves[mondayIso(dateIso)];
  return Array.isArray(m) && m.length === 7 && Number.isInteger(m[di]) && m[di] >= 0 && m[di] <= 6 ? m[di] : di;
}
export function swapDays(overrides, dateA, dateB) {
  const ov = JSON.parse(JSON.stringify(overrides || {})), mon = mondayIso(dateA);
  ov.moves = ov.moves || {};
  const m = Array.isArray(ov.moves[mon]) && ov.moves[mon].length === 7 ? ov.moves[mon] : [0, 1, 2, 3, 4, 5, 6];
  const a = dayIndex(dateA), b = dayIndex(dateB);
  [m[a], m[b]] = [m[b], m[a]];
  if (m.every((v, i) => v === i)) delete ov.moves[mon]; else ov.moves[mon] = m;
  // alte Wochen aufräumen (älter als 5 Wochen)
  const cut = new Date(Date.parse(mon + "T12:00:00Z") - 35 * 86400000).toISOString().slice(0, 10);
  for (const k of Object.keys(ov.moves)) if (k < cut) delete ov.moves[k];
  return ov;
}

// Was steht an diesem Tag an – mit Anpassungen (overrides). Änderungen nur für diesen Tag (today) kommen aus dem Protokoll.
export function sessionFor(dateIso, state, today) {
  const plan = planOf(state);
  const week = Math.min(plan.weeks, weekOf(state.start, dateIso) || 1);
  const di = dayIndex(dateIso), src = sourceDay(state, dateIso);
  const day = plan.days[src];
  const ov = state.overrides || {};
  const base = { date: dateIso, week, weeks: plan.weeks, day: di, dayName: DAY_NAMES[di], kind: day.kind, movedFrom: src !== di ? src : null };
  if (day.kind === "strength") {
    const w = plan.workouts[day.workout];
    const focus = { ...focusFor(plan, week) };
    if (!focus.deload && (ov.deload || []).includes(week)) Object.assign(focus, { deload: true, rir: "3", text: "Leichtere Woche (Deload) – ein Satz weniger, leichter" });
    const t = today || {};
    const mk = (slot, planId, sets, reps, extra) => {
      const o = (!extra && ov.ex && ov.ex[slot]) || {};
      let useId = o.swap && EXERCISES[o.swap] ? o.swap : planId;
      const todaySwap = t.swap && t.swap[slot] && EXERCISES[t.swap[slot]] ? t.swap[slot] : null;
      if (todaySwap) useId = todaySwap;
      const ex = EXERCISES[useId];
      let s = Number.isInteger(o.sets) ? o.sets : sets;
      if (focus.deload && !extra) s = Math.max(1, s - 1);
      let r = Array.isArray(o.reps) ? o.reps : reps;
      if (todaySwap || o.swap) { const d = defaultsFor(useId, plan); if (EXERCISES[planId].type !== ex.type) r = d.reps; }
      return { slot, id: useId, planId, name: ex.name, hint: ex.hint || "", type: ex.type || "reps", side: !!ex.side, sets: s,
        reps: r, rest: ex.rest || 45, weight: o.weight || 0, note: o.note || "", swapped: useId !== planId, swappedToday: !!todaySwap, extra: !!extra,
        skipped: !!(t.skip && t.skip[slot]) };
    };
    const items = w.items.filter(i => !(ov.ex && ov.ex[slotOf(i)] && ov.ex[slotOf(i)].sets === 0)).map(i => mk(slotOf(i), i.id, i.sets, i.reps, false));
    for (const x of (t.extra || [])) if (EXERCISES[x.id]) items.push(mk(x.slot, x.id, x.sets, x.reps, true));
    return { ...base, workout: day.workout, title: w.title, sub: w.sub, minutes: w.minutes, focus, items };
  }
  if (day.kind === "run") {
    const r = runFor(plan, day.run, week);
    return { ...base, run: day.run, ...r };
  }
  if (day.kind === "rest") return { ...base, title: "Ruhetag", sub: "Erholung – Spaziergang oder Mobility, wenn du magst", items: [] };
  return { ...base, title: "Aktive Erholung", sub: "Mobility + Spaziergang", items: plan.mobility.map(m => ({ id: m.id, name: EXERCISES[m.id].name, amount: m.amount, unit: m.unit, side: !!EXERCISES[m.id].side })) };
}
