// Kurze Bewegungs-Animationen als Strichfigur (SVG, ohne Bilder oder Fremddienste).
// Jede Animation: mehrere Haltungen (Gelenkpunkte), zwischen denen die Figur hin und her geht, und Geräte (props).
// Punkte: sh Schulter, el Ellbogen, ha Hand, hi Hüfte, kn Knie, ft Fuß; …2 = zweite Seite (heller gezeichnet);
// sp = Kontrollpunkt für einen runden Rücken, hd = Kopf (sonst automatisch in Verlängerung des Rumpfs).

const STAND = { sh: [100, 52], el: [100, 73], ha: [100, 94], hi: [100, 92], kn: [100, 121], ft: [100, 150] };
const QUAD = { ha: [70, 148], el: [70, 130], sh: [70, 112], hi: [120, 112], kn: [120, 148], ft: [150, 148] };
const s = (base, o) => Object.assign({}, base, o);

export const ANIMS = {
  pullup: { props: [{ t: "bar", y: 22 }], poses: [
    { sh: [100, 58], el: [100, 40], ha: [100, 22], hi: [100, 98], kn: [104, 124], ft: [96, 146] },
    { sh: [100, 34], el: [84, 38], ha: [100, 22], hi: [100, 74], kn: [104, 100], ft: [96, 122] }] },
  pushup: { props: [{ t: "floor" }, { t: "ringAtHand" }], poses: [
    { ft: [160, 147], kn: [138, 138], hi: [116, 129], sh: [72, 112], el: [72, 128], ha: [72, 144] },
    { ft: [160, 147], kn: [138, 141], hi: [116, 135], sh: [72, 128], el: [90, 131], ha: [72, 144] }] },
  ringrow: { props: [{ t: "floor" }, { t: "rings", ax: 76 }], poses: [
    { ha: [72, 62], el: [82, 80], sh: [92, 98], hi: [122, 124], kn: [138, 138], ft: [152, 150] },
    { ha: [80, 64], el: [102, 72], sh: [86, 78], hi: [119, 113], kn: [136, 132], ft: [152, 150] }] },
  dbpress: { props: [{ t: "floor" }, { t: "db" }], poses: [
    s(STAND, { el: [108, 66], ha: [104, 48] }), s(STAND, { el: [103, 32], ha: [101, 12] })] },
  lateralraise: { props: [{ t: "floor" }, { t: "db" }], front: true, poses: [
    { sh: [90, 52], sh2: [110, 52], hi: [94, 92], hi2: [106, 92], kn: [93, 121], ft: [92, 150], kn2: [107, 121], ft2: [108, 150], el: [86, 72], ha: [84, 92], el2: [114, 72], ha2: [116, 92] },
    { sh: [90, 52], sh2: [110, 52], hi: [94, 92], hi2: [106, 92], kn: [93, 121], ft: [92, 150], kn2: [107, 121], ft2: [108, 150], el: [71, 55], ha: [52, 58], el2: [129, 55], ha2: [148, 58] }] },
  hangingraise: { props: [{ t: "bar", y: 22 }], poses: [
    { ha: [100, 22], el: [100, 40], sh: [100, 58], hi: [100, 98], kn: [100, 124], ft: [100, 148] },
    { ha: [100, 22], el: [100, 40], sh: [100, 58], hi: [98, 96], kn: [126, 88], ft: [128, 116] }] },
  fallout: { props: [{ t: "floor" }, { t: "rings", ax: 70 }], poses: [
    { kn: [128, 147], ft: [158, 148], hi: [124, 118], sh: [100, 92], el: [96, 112], ha: [92, 132] },
    { kn: [128, 147], ft: [158, 148], hi: [112, 134], sh: [76, 118], el: [56, 114], ha: [36, 110] }] },
  sideplank: { props: [{ t: "floor" }], hold: true, poses: [
    { ft: [160, 148], kn: [136, 140], hi: [112, 132], sh: [70, 116], el: [66, 147], ha: [84, 147] },
    { ft: [160, 148], kn: [136, 137], hi: [112, 126], sh: [70, 114], el: [66, 147], ha: [84, 147] }] },
  copenhagen: { props: [{ t: "floor" }, { t: "bench", x: 150, w: 44, y: 124 }], hold: true, poses: [
    { sh: [70, 120], el: [66, 147], ha: [84, 147], hi: [118, 130], kn: [144, 127], ft: [170, 124], kn2: [138, 142], ft2: [158, 148] },
    { sh: [70, 117], el: [66, 147], ha: [84, 147], hi: [118, 124], kn: [144, 124], ft: [170, 124], kn2: [138, 138], ft2: [158, 146] }] },
  legpress: { props: [{ t: "floor" }, { t: "line", a: [132, 132], b: [164, 78] }, { t: "plate" }], poses: [
    { hi: [128, 125], sh: [150, 88], el: [140, 108], ha: [132, 124], kn: [103, 104], ft: [80, 82] },
    { hi: [128, 125], sh: [150, 88], el: [140, 108], ha: [132, 124], kn: [126, 94], ft: [96, 96] }] },
  legcurl: { props: [{ t: "floor" }, { t: "seat", x: 92, y: 116, w: 40 }, { t: "line", a: [130, 116], b: [134, 66] }, { t: "roller" }], poses: [
    { hi: [115, 112], sh: [118, 72], el: [116, 92], ha: [110, 110], kn: [85, 110], ft: [55, 112] },
    { hi: [115, 112], sh: [118, 72], el: [116, 92], ha: [110, 110], kn: [85, 110], ft: [92, 138] }] },
  chestpress: { props: [{ t: "floor" }, { t: "seat", x: 98, y: 116, w: 36 }, { t: "line", a: [130, 116], b: [130, 62] }, { t: "handle" }], poses: [
    { hi: [122, 112], sh: [122, 72], kn: [92, 112], ft: [90, 146], el: [138, 80], ha: [116, 74] },
    { hi: [122, 112], sh: [122, 72], kn: [92, 112], ft: [90, 146], el: [103, 74], ha: [83, 74] }] },
  latpulldown: { props: [{ t: "floor" }, { t: "seat", x: 92, y: 119, w: 36 }, { t: "cable", from: "top" }, { t: "lbar" }], poses: [
    { hi: [112, 115], sh: [112, 75], kn: [82, 112], ft: [82, 146], el: [110, 55], ha: [108, 35] },
    { hi: [112, 115], sh: [112, 75], kn: [82, 112], ft: [82, 146], el: [122, 92], ha: [110, 74] }] },
  cablerow: { props: [{ t: "floor" }, { t: "cable", from: [20, 118] }, { t: "line", a: [64, 150], b: [64, 116] }], poses: [
    { hi: [122, 140], kn: [96, 116], ft: [68, 126], sh: [104, 104], el: [88, 114], ha: [70, 118] },
    { hi: [122, 140], kn: [96, 116], ft: [68, 126], sh: [124, 100], el: [140, 112], ha: [118, 116] }] },
  cablecrunch: { props: [{ t: "floor" }, { t: "cable", from: [100, 0] }], poses: [
    { kn: [112, 147], ft: [142, 148], hi: [110, 116], sp: [108, 96], sh: [104, 78], el: [90, 90], ha: [96, 72] },
    { kn: [112, 147], ft: [142, 148], hi: [112, 118], sp: [102, 96], sh: [84, 108], el: [86, 128], ha: [76, 112] }] },
  backext: { props: [{ t: "floor" }, { t: "line", a: [152, 146], b: [118, 118], w: 8 }, { t: "line", a: [168, 150], b: [166, 132] }], poses: [
    { ft: [162, 136], kn: [140, 124], hi: [118, 110], sp: [110, 124], sh: [106, 146], el: [116, 134], ha: [108, 128] },
    { ft: [162, 136], kn: [140, 124], hi: [118, 110], sh: [85, 88], el: [96, 102], ha: [88, 96] }] },
  dip: { props: [{ t: "floor" }, { t: "pbars", y: 72 }], poses: [
    { ha: [100, 72], el: [100, 54], sh: [100, 36], hi: [100, 78], kn: [110, 102], ft: [98, 120] },
    { ha: [100, 72], el: [116, 64], sh: [100, 57], hi: [101, 98], kn: [111, 122], ft: [99, 140] }] },
  splitsquat: { props: [{ t: "floor" }, { t: "bench", x: 136, w: 46, y: 124 }, { t: "db" }], poses: [
    { ft: [78, 150], kn: [86, 120], hi: [100, 90], kn2: [118, 116], ft2: [146, 124], sh: [98, 50], el: [98, 71], ha: [98, 92] },
    { ft: [78, 150], kn: [78, 122], hi: [104, 114], kn2: [116, 144], ft2: [146, 124], sh: [102, 74], el: [102, 95], ha: [102, 116] }] },
  rdl: { props: [{ t: "floor" }, { t: "db" }], poses: [
    s(STAND, { kn2: [103, 121], ft2: [106, 149] }),
    { ft: [100, 150], kn: [97, 121], hi: [104, 92], sh: [65, 84], el: [65, 105], ha: [65, 126], kn2: [132, 88], ft2: [160, 84] }] },
  lsit: { props: [{ t: "floor" }, { t: "pbars", y: 128, low: true }], hold: true, poses: [
    { sh: [100, 90], el: [100, 109], ha: [100, 128], hi: [103, 128], kn: [80, 114], ft: [76, 136] },
    { sh: [100, 90], el: [100, 109], ha: [100, 128], hi: [103, 128], kn: [74, 126], ft: [46, 124] }] },
  pallof: { props: [{ t: "floor" }, { t: "cable", from: [20, 62] }], poses: [
    s(STAND, { el: [104, 72], ha: [112, 60] }), s(STAND, { el: [118, 60], ha: [140, 60] })] },
  reversecrunch: { props: [{ t: "floor" }], poses: [
    { sh: [60, 145], hi: [100, 146], el: [78, 148], ha: [96, 148], kn: [104, 118], ft: [130, 120] },
    { sh: [60, 145], hi: [96, 140], el: [78, 148], ha: [96, 148], kn: [82, 110], ft: [106, 104] }] },
  deadbug: { props: [{ t: "floor" }], poses: [
    { sh: [60, 145], hi: [100, 146], el: [62, 126], ha: [64, 106], el2: [62, 126], ha2: [64, 106], kn: [102, 118], ft: [126, 118], kn2: [102, 118], ft2: [126, 118] },
    { sh: [60, 145], hi: [100, 146], el: [42, 140], ha: [24, 142], el2: [62, 126], ha2: [64, 106], kn: [128, 140], ft: [156, 142], kn2: [102, 118], ft2: [126, 118] }] },
  birddog: { props: [{ t: "floor" }], poses: [
    s(QUAD, { el2: [70, 130], ha2: [70, 148], kn2: [120, 148], ft2: [150, 148] }),
    s(QUAD, { el: [52, 108], ha: [32, 104], kn: [150, 110], ft: [180, 108], el2: [70, 130], ha2: [70, 148], kn2: [120, 148], ft2: [150, 148] })] },
  glutebridge: { props: [{ t: "floor" }], poses: [
    { sh: [55, 145], el: [72, 148], ha: [92, 148], ft: [124, 148], hi: [92, 144], kn: [112, 118] },
    { sh: [55, 145], el: [72, 148], ha: [92, 148], ft: [124, 148], hi: [94, 122], kn: [124, 116] }] },
  plank: { props: [{ t: "floor" }], hold: true, poses: [
    { el: [70, 148], ha: [88, 148], sh: [70, 128], hi: [115, 134], kn: [138, 140], ft: [162, 146] },
    { el: [70, 148], ha: [88, 148], sh: [70, 127], hi: [115, 131], kn: [138, 139], ft: [162, 146] }] },
  hollow: { props: [{ t: "floor" }], hold: true, poses: [
    { sh: [62, 140], hi: [100, 146], el: [48, 130], ha: [34, 122], kn: [128, 138], ft: [156, 132] },
    { sh: [64, 138], hi: [100, 146], el: [48, 128], ha: [34, 118], kn: [128, 137], ft: [156, 128] }] },
  wallsit: { props: [{ t: "floor" }, { t: "line", a: [128, 20], b: [128, 150], w: 4 }], hold: true, poses: [
    { sh: [120, 74], hi: [120, 112], kn: [90, 112], ft: [90, 148], el: [112, 92], ha: [100, 106] },
    { sh: [120, 75], hi: [120, 113], kn: [90, 112], ft: [90, 148], el: [112, 93], ha: [100, 107] }] },

  // Mobility
  catcow: { props: [{ t: "floor" }], poses: [s(QUAD, { sp: [95, 92], hd: [58, 126] }), s(QUAD, { sp: [95, 126], hd: [56, 98] })] },
  childpose: { props: [{ t: "floor" }], poses: [
    s(QUAD, { hd: [58, 104] }),
    { kn: [120, 148], ft: [150, 148], hi: [140, 134], sh: [98, 140], el: [76, 146], ha: [56, 147], hd: [86, 145] }] },
  cobra: { props: [{ t: "floor" }], poses: [
    { ft: [160, 148], kn: [132, 148], hi: [104, 147], sh: [64, 146], el: [82, 140], ha: [66, 148], hd: [50, 144] },
    { ft: [160, 148], kn: [132, 148], hi: [104, 147], sp: [92, 142], sh: [70, 116], el: [76, 132], ha: [66, 148], hd: [62, 102] }] },
  deeplunge: { props: [{ t: "floor" }], hold: true, poses: [
    { ft: [70, 150], kn: [72, 122], hi: [102, 124], kn2: [130, 146], ft2: [158, 148], sh: [100, 84], el: [88, 104], ha: [78, 118] },
    { ft: [70, 150], kn: [66, 124], hi: [98, 130], kn2: [128, 148], ft2: [158, 148], sh: [96, 90], el: [84, 108], ha: [72, 120] }] },
  quadstretch: { props: [{ t: "floor" }], poses: [
    { ft: [76, 150], kn: [78, 122], hi: [108, 124], kn2: [132, 148], ft2: [152, 138], sh: [106, 84], el: [116, 104], ha: [126, 118] },
    { ft: [76, 150], kn: [78, 122], hi: [108, 124], kn2: [132, 148], ft2: [124, 114], sh: [106, 84], el: [118, 104], ha: [124, 114] }] },
  worldsgreatest: { props: [{ t: "floor" }], poses: [
    { ft: [76, 150], kn: [78, 122], hi: [108, 124], kn2: [136, 136], ft2: [164, 148], sh: [80, 100], el: [80, 120], ha: [80, 140], el2: [82, 120], ha2: [78, 140] },
    { ft: [76, 150], kn: [78, 122], hi: [108, 124], kn2: [136, 136], ft2: [164, 148], sh: [94, 92], el: [96, 70], ha: [98, 50], el2: [84, 114], ha2: [78, 140] }] },
  ninetyninety: { props: [{ t: "floor" }], poses: [
    { hi: [100, 144], kn: [72, 140], ft: [70, 148], kn2: [126, 140], ft2: [128, 148], sh: [102, 104], el: [106, 124], ha: [112, 144] },
    { hi: [100, 144], kn: [72, 140], ft: [70, 148], kn2: [126, 140], ft2: [128, 148], sh: [78, 114], el: [70, 128], ha: [64, 144] }] },
  pigeon: { props: [{ t: "floor" }], hold: true, poses: [
    { hi: [100, 138], kn: [78, 146], ft: [100, 148], kn2: [132, 148], ft2: [162, 148], sh: [92, 100], el: [84, 120], ha: [80, 140] },
    { hi: [100, 138], kn: [78, 146], ft: [100, 148], kn2: [132, 148], ft2: [162, 148], sp: [80, 128], sh: [64, 136], el: [46, 144], ha: [28, 146] }] },
  deepsquat: { props: [{ t: "floor" }], hold: true, poses: [
    { hi: [108, 136], kn: [80, 120], ft: [96, 150], sh: [92, 98], el: [80, 116], ha: [68, 106] },
    { hi: [108, 136], kn: [80, 120], ft: [96, 150], sh: [90, 99], el: [79, 117], ha: [67, 107] }] },
  anklerocks: { props: [{ t: "floor" }], poses: [
    { ft: [80, 150], kn: [84, 120], hi: [112, 122], kn2: [128, 148], ft2: [156, 148], sh: [112, 82], el: [100, 98], ha: [88, 114] },
    { ft: [80, 150], kn: [66, 124], hi: [100, 126], kn2: [124, 148], ft2: [156, 148], sh: [100, 86], el: [86, 102], ha: [72, 118] }] },
  rollingback: { props: [{ t: "floor" }], poses: [
    { hi: [108, 136], kn: [80, 120], ft: [96, 150], sh: [92, 98], el: [80, 116], ha: [76, 120] },
    { sh: [88, 145], hi: [122, 136], kn: [118, 106], ft: [98, 94], el: [104, 124], ha: [114, 108] }] },
  hipcars: { props: [{ t: "floor" }], poses: [
    { sh: [100, 52], el: [100, 73], ha: [100, 94], hi: [100, 92], kn2: [100, 121], ft2: [100, 150], kn: [128, 88], ft: [130, 118] },
    { sh: [100, 52], el: [100, 73], ha: [100, 94], hi: [100, 92], kn2: [100, 121], ft2: [100, 150], kn: [116, 102], ft: [124, 128] },
    { sh: [100, 52], el: [100, 73], ha: [100, 94], hi: [100, 92], kn2: [100, 121], ft2: [100, 150], kn: [108, 118], ft: [134, 132] }] },
  scorpion: { props: [{ t: "floor" }], poses: [
    { sh: [60, 146], hi: [104, 146], kn: [132, 147], ft: [160, 148], el: [44, 147], ha: [28, 147], hd: [48, 144] },
    { sh: [60, 146], hi: [104, 144], kn: [128, 138], ft: [112, 112], el: [44, 147], ha: [28, 147], hd: [48, 144], kn2: [132, 147], ft2: [160, 148] }] },
  rockbacks: { props: [{ t: "floor" }], poses: [
    s(QUAD, {}), { ha: [70, 148], el: [80, 136], sh: [92, 124], hi: [136, 128], kn: [120, 148], ft: [150, 148] }] },
  downdog: { props: [{ t: "floor" }], poses: [
    { ha: [56, 148], el: [66, 130], sh: [76, 112], hi: [104, 82], kn: [122, 114], ft: [140, 148], kn2: [122, 114], ft2: [140, 148] },
    { ha: [56, 148], el: [66, 130], sh: [76, 112], hi: [104, 82], kn: [114, 116], ft: [136, 142], kn2: [122, 114], ft2: [140, 148] }] }
};

const NS = "http://www.w3.org/2000/svg";
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function mix(p, q, t) {
  const o = {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(q)])) o[k] = lerp(p[k] || q[k], q[k] || p[k], t);
  return o;
}
const mid = (a, b) => b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a;

// Zeichnet eine Haltung als SVG-Text
export function drawPose(P, props = []) {
  const neck = mid(P.sh, P.sh2), hip = mid(P.hi, P.hi2);
  let hd = P.hd;
  if (!hd) { const dx = neck[0] - hip[0], dy = neck[1] - hip[1], l = Math.hypot(dx, dy) || 1; hd = [neck[0] + dx / l * 13, neck[1] + dy / l * 13]; }
  const L = (a, b) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  const back = [], front = [], gear = [];
  const sh2 = P.sh2 || P.sh, hi2 = P.hi2 || P.hi;
  if (P.el2) back.push(L(sh2, P.el2) + L(P.el2, P.ha2));
  if (P.kn2) back.push(L(hi2, P.kn2) + L(P.kn2, P.ft2));
  if (P.sh2) front.push(L(P.sh, P.sh2));
  if (P.hi2) front.push(L(P.hi, P.hi2));
  front.push(P.sp ? `M${neck[0]} ${neck[1]}Q${P.sp[0]} ${P.sp[1]} ${hip[0]} ${hip[1]}` : L(neck, hip));
  front.push(L(P.hi, P.kn) + L(P.kn, P.ft));
  front.push(L(P.sh, P.el) + L(P.el, P.ha));
  for (const pr of props) {
    if (pr.t === "floor") gear.push(`<path d="M8 151H192" class="g"/>`);
    if (pr.t === "bar") gear.push(`<path d="M60 ${pr.y}H140" class="g"/>`);
    if (pr.t === "rings") { gear.push(`<path d="${L([pr.ax, 4], P.ha)}" class="g t"/><circle cx="${P.ha[0]}" cy="${P.ha[1]}" r="5" class="g r"/>`); }
    if (pr.t === "ringAtHand") gear.push(`<circle cx="${P.ha[0]}" cy="${P.ha[1] - 1}" r="5" class="g r"/>`);
    if (pr.t === "db") { for (const h of [P.ha, P.ha2].filter(Boolean)) gear.push(`<rect x="${h[0] - 8}" y="${h[1] - 3}" width="16" height="6" rx="3" class="d"/>`); }
    if (pr.t === "bench") gear.push(`<path d="M${pr.x} ${pr.y}h${pr.w}M${pr.x + 6} ${pr.y}V151M${pr.x + pr.w - 6} ${pr.y}V151" class="g"/>`);
    if (pr.t === "seat") gear.push(`<path d="M${pr.x} ${pr.y}h${pr.w}M${pr.x + pr.w / 2} ${pr.y}V151" class="g"/>`);
    if (pr.t === "line") gear.push(`<path d="${L(pr.a, pr.b)}" class="${pr.w ? "g w" + pr.w : "g"}"/>`);
    if (pr.t === "pbars") gear.push(pr.low ? `<path d="M84 ${pr.y}h32M88 ${pr.y}l-4 ${151 - pr.y}M112 ${pr.y}l4 ${151 - pr.y}" class="g"/>` : `<path d="M70 ${pr.y}h60M76 ${pr.y}V151M124 ${pr.y}V151" class="g"/>`);
    if (pr.t === "cable") { const f = pr.from === "top" ? [P.ha[0], 0] : pr.from; gear.push(`<path d="${L(f, P.ha)}" class="g t"/>`); }
    if (pr.t === "lbar") gear.push(`<path d="M${P.ha[0] - 18} ${P.ha[1]}h36" class="g"/>`);
    if (pr.t === "handle") gear.push(`<circle cx="${P.ha[0]}" cy="${P.ha[1]}" r="4" class="d"/>`);
    if (pr.t === "roller") gear.push(`<circle cx="${P.ft[0]}" cy="${P.ft[1] - 2}" r="5" class="d"/>`);
    if (pr.t === "plate") { const d = [0.7, -0.7]; gear.push(`<path d="${L([P.ft[0] - 4 - d[0] * 14, P.ft[1] - d[1] * 14 - 4], [P.ft[0] - 4 + d[0] * 14, P.ft[1] + d[1] * 14 - 4])}" class="g w5"/>`); }
  }
  return gear.join("") +
    `<path d="${back.join("")}" class="b"/>` +
    `<path d="${front.join("")}" class="f"/>` +
    `<circle cx="${hd[0].toFixed(1)}" cy="${hd[1].toFixed(1)}" r="9" class="h"/>`;
}

const STYLE = "";  // Aussehen steht in style.css (svg.fig …), wegen der strengen Content-Security-Policy

// Startet eine Animation im Element el; gibt eine Stopp-Funktion zurück.
export function mount(el, name, opts = {}) {
  const a = ANIMS[name];
  if (!a) { el.innerHTML = ""; return () => {}; }
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 160");
  svg.setAttribute("class", "fig");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Bewegungsablauf");
  el.innerHTML = ""; el.appendChild(svg);
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const n = a.poses.length, per = a.hold ? 3200 : opts.period || 2600;
  let raf = 0, alive = true;
  const frame = now => {
    if (!alive) return;
    let P;
    if (n === 2) { const t = (1 - Math.cos((now % per) / per * 2 * Math.PI)) / 2; P = mix(a.poses[0], a.poses[1], t); }
    else { const x = (now % (per * n)) / per, i = Math.floor(x), f = x - i, t = (1 - Math.cos(f * Math.PI)) / 2; P = mix(a.poses[i], a.poses[(i + 1) % n], t); }
    svg.innerHTML = STYLE + drawPose(P, a.props);
    if (!reduce) raf = requestAnimationFrame(frame);
  };
  if (reduce) { svg.innerHTML = STYLE + drawPose(a.poses[n - 1], a.props); }
  else raf = requestAnimationFrame(frame);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

// Standbild (für Listen)
export function still(name, i = 1) {
  const a = ANIMS[name]; if (!a) return "";
  return `<svg class="fig" viewBox="0 0 200 160" aria-hidden="true">${STYLE}${drawPose(a.poses[Math.min(i, a.poses.length - 1)], a.props)}</svg>`;
}
