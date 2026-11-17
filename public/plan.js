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

// Mobility-Block (Donnerstag und optional jeden Morgen)
export const MOBILITY = [
  ["catcow", 15], ["childpose", 30, "s"], ["cobra", 30, "s"], ["deeplunge", 30, "s"], ["quadstretch", 30, "s"], ["worldsgreatest", 15],
  ["ninetyninety", 15], ["pigeon", 30, "s"], ["deepsquat", 30, "s"], ["anklerocks", 15], ["rollingback", 15], ["hipcars", 15],
  ["scorpion", 15], ["rockbacks", 15, "s"], ["scorpionreach", 15], ["downdog", 30, "s"]
];

// Krafteinheiten. sets/reps wie im Plan; reps [min, max]; bei type "time" sind es Sekunden.
export const WORKOUTS = {
  homeA: { title: "Home Workout A", sub: "Oberkörper + Core", minutes: "50–60", items: [
    ["pullup", 4, [5, 10]], ["ringpushup", 4, [8, 15]], ["ringrow", 3, [8, 15]], ["dbpress", 3, [8, 12]],
    ["lateralraise", 3, [12, 20]], ["hangingraise", 3, [6, 12]], ["ringfallout", 3, [6, 12]], ["sideplank", 2, [30, 45]]
  ]},
  gym: { title: "Fitnessstudio", sub: "Ganzkörper (schwer)", minutes: "60–75", items: [
    ["legpress", 3, [6, 10]], ["legcurl", 3, [8, 12]], ["chestpress", 3, [6, 10]], ["latpulldown", 3, [6, 10]],
    ["cablerow", 3, [8, 12]], ["machinepress", 2, [8, 12]], ["cablecrunch", 3, [8, 15]], ["backext", 3, [10, 15]]
  ]},
  homeB: { title: "Home Workout B", sub: "Calisthenics + Core / Hüfte", minutes: "50–60", items: [
    ["ringdip", 3, [5, 10]], ["chinup", 3, [6, 10]], ["splitsquat", 2, [8, 12]], ["singlerdl", 3, [8, 12]],
    ["lsit", 4, [10, 30]], ["pallof", 3, [10, 15]], ["reversecrunch", 3, [10, 15]], ["copenhagen", 2, [20, 45]]
  ]}
};

// Wochentage: 0 = Montag … 6 = Sonntag
export const WEEK = [
  { kind: "strength", workout: "homeA" },
  { kind: "run", run: "z2" },
  { kind: "strength", workout: "gym" },
  { kind: "recovery" },
  { kind: "run", run: "interval" },
  { kind: "strength", workout: "homeB" },
  { kind: "run", run: "long" }
];
export const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export const PROFILE = { height: 171, weight: 73, age: 43, restHr: 60, maxHr: 178, vo2max: 48.4, z2pace: "6:56", z2hr: 134 };
export const ZONES = [
  { z: 1, from: 0, to: 129, color: "#4c8dff" }, { z: 2, from: 130, to: 140, color: "#2fb36d" },
  { z: 3, from: 141, to: 153, color: "#f2c230" }, { z: 4, from: 154, to: 165, color: "#f28a30" }, { z: 5, from: 166, to: 999, color: "#e5484d" }
];

// Kraft-Steigerung (RIR = Wiederholungen „im Tank“)
export function strengthFocus(week) {
  if (week <= 2) return { rir: "2–3", text: "Gewichte finden – 2–3 Wiederholungen im Tank lassen" };
  if (week <= 4) return { rir: "1–2", text: "Steigern – 1–2 Wiederholungen im Tank" };
  if (week === 5) return { rir: "3", text: "Deload-Woche – ein Satz weniger, leichter (−25–30 % Volumen)", deload: true };
  if (week <= 7) return { rir: "1–2", text: "Wieder steigern – 1–2 Wiederholungen im Tank" };
  return { rir: "~1", text: "Letzte Woche – die letzten Sätze dürfen fordernd sein" };
}

// Läufe je Woche
export function runFor(type, week) {
  if (type === "z2") {
    const min = week === 5 ? "35–40" : "35–45";
    return { title: "Lauf – Zone 2", short: min + " Min. locker", zone: 2, rpe: "3–4/10",
      steps: [
        { label: "Locker laufen", detail: min + " Minuten, Puls 130–140 (Zone 2). Pace ca. 6:30–7:10 min/km – der Puls ist wichtiger als das Tempo.", min: week === 5 ? 37 : 40 }
      ],
      tips: ["Du kannst dich dabei noch unterhalten", "Ziel: gleiches Tempo mit niedrigerem Puls oder schneller bei gleichem Puls", "Referenz: 6:56 min/km bei 134 bpm"] };
  }
  if (type === "interval") {
    const t = { 1: [4, 3], 2: [4, 3], 3: [5, 3], 4: [5, 3], 5: [4, 3], 6: [4, 4], 7: [4, 4], 8: [5, 3] }[week] || [4, 3];
    const steps = [{ label: "Einlaufen", detail: "10 Minuten locker", min: 10 }];
    for (let i = 1; i <= t[0]; i++) {
      steps.push({ label: "Intervall " + i + " von " + t[0], detail: t[1] + " Minuten schnell (RPE 8–9)", min: t[1], hard: true });
      if (i < t[0]) steps.push({ label: "Trabpause", detail: "2 Minuten locker traben", min: 2 });
    }
    steps.push({ label: "Auslaufen", detail: "10 Minuten locker", min: 10 });
    return { title: "Intervalllauf (VO₂max)", short: t[0] + " × " + t[1] + " Min. schnell" + (week === 5 ? " (Deload)" : ""), zone: 4, rpe: "8–9/10",
      steps, tips: ["Gleichmäßig – das erste Intervall nicht zu schnell", "Letztes Drittel jedes Intervalls darf hart sein", "Ziel: VO₂max Richtung 50"] };
  }
  const long = {
    1: ["8 km locker", "8 km locker in Zone 2", 8], 2: ["9 km locker", "9 km locker in Zone 2", 9],
    3: ["9 km + 10 Min. moderat", "9 km locker, die letzten 10 Minuten moderat (Zone 3, 141–153)", 9],
    4: ["10 km locker", "10 km locker in Zone 2", 10], 5: ["8 km locker", "8 km locker in Zone 2 (Deload)", 8],
    6: ["10 km mit 2 × 8 Min. Zone 3", "10 km, darin 2 × 8 Minuten in Zone 3 (141–153), sonst locker", 10],
    7: ["10 km locker", "10 km locker in Zone 2", 10],
    8: ["10 km progressiv", "10 km progressiv: locker → moderat → letzte 2 km zügig", 10]
  }[week] || ["8 km locker", "8 km locker in Zone 2", 8];
  return { title: "Ausdauer + Tempo", short: long[0], zone: 2, rpe: "3–6/10", km: long[2],
    steps: [{ label: "Langer Lauf", detail: long[1], km: long[2] }],
    tips: ["Puls überwiegend 130–141 (Zone 2)", "Tempoanteile kontrolliert, nicht jedes Mal", "Ziel: Ausdauer, Tempohärte, Laufökonomie"] };
}

// Woche im Plan (1–8) aus Startdatum (Montag) und Datum; null = vor Start; >8 = Plan vorbei
export function weekOf(startIso, dateIso) {
  const d = (Date.parse(dateIso + "T12:00:00Z") - Date.parse(startIso + "T12:00:00Z")) / 86400000;
  if (isNaN(d) || d < 0) return null;
  return Math.floor(d / 7) + 1;
}
export function dayIndex(dateIso) { return (new Date(dateIso + "T12:00:00Z").getUTCDay() + 6) % 7; }

// Was steht an diesem Tag an – mit Anpassungen (overrides) und Status (krank, Einschränkungen)
export function sessionFor(dateIso, state) {
  const week = Math.min(8, weekOf(state.start, dateIso) || 1);
  const di = dayIndex(dateIso);
  const day = WEEK[di];
  const ov = state.overrides || {};
  const base = { date: dateIso, week, day: di, dayName: DAY_NAMES[di], kind: day.kind };
  if (day.kind === "strength") {
    const w = WORKOUTS[day.workout];
    const focus = strengthFocus(week);
    if (!focus.deload && (ov.deload || []).includes(week)) Object.assign(focus, { deload: true, rir: "3", text: "Leichtere Woche (Deload) – ein Satz weniger, leichter" });
    const items = w.items.filter(([id]) => !(ov.ex && ov.ex[id] && ov.ex[id].sets === 0)).map(([id, sets, reps]) => {
      const o = (ov.ex && ov.ex[id]) || {};
      const useId = o.swap && EXERCISES[o.swap] ? o.swap : id;
      const ex = EXERCISES[useId];
      let s = Number.isInteger(o.sets) ? o.sets : sets;
      if (focus.deload) s = Math.max(1, s - 1);
      return { slot: id, id: useId, name: ex.name, hint: ex.hint || "", type: ex.type || "reps", side: !!ex.side, sets: s,
        reps: Array.isArray(o.reps) ? o.reps : reps, rest: ex.rest || 60, weight: Number(o.weight) || 0, note: o.note || "", swapped: useId !== id };
    });
    return { ...base, workout: day.workout, title: w.title, sub: w.sub, minutes: w.minutes, focus, items };
  }
  if (day.kind === "run") {
    const r = runFor(day.run, week);
    const o = (ov.run && ov.run[day.run]) || {};
    return { ...base, run: day.run, ...r, note: o.note || "" };
  }
  return { ...base, title: "Aktive Erholung", sub: "Mobility + Spaziergang", items: MOBILITY.map(([id, n, u]) => ({ id, name: EXERCISES[id].name, amount: n, unit: u === "s" ? "s" : "Wdh", side: !!EXERCISES[id].side })) };
}
