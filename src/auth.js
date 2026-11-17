// Sicherheits-Bausteine: Passwort-Hash (PBKDF2), Zwei-Faktor-Codes (TOTP, RFC 6238), Zufallswerte.
// Alles mit der eingebauten Web-Crypto-Schnittstelle, ohne Fremdbibliotheken.

export const ITER = 100000;   // höchster Wert, den Cloudflare Workers für PBKDF2 erlaubt

export async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: ITER }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
export async function sha256(text) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

/* ---------- TOTP (Codes aus der Authenticator-App bzw. iPhone „Passwörter“) ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes) {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out = []; let bits = 0, val = 0;
  for (const c of clean) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export function newTotpSecret() { const b = new Uint8Array(20); crypto.getRandomValues(b); return base32(b); }

export async function totpAt(secretB32, step) {
  const key = await crypto.subtle.importKey("raw", unbase32(secretB32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let x = step; for (let i = 7; i >= 0; i--) { msg[i] = x & 255; x = Math.floor(x / 256); }
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}
// Prüft einen Code (±30 Sekunden Toleranz). Gibt den Zeitschritt zurück (gegen Wiederverwendung) oder -1.
export async function checkTotp(secretB32, code, lastStep = -1, nowMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ""))) return -1;
  const now = Math.floor(nowMs / 30000);
  for (const st of [now, now - 1, now + 1]) {
    if (st <= lastStep) continue;
    if (safeEqual(await totpAt(secretB32, st), String(code))) return st;
  }
  return -1;
}
export function otpauthUrl(secret, label = "Fitness") {
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(label)}&algorithm=SHA1&digits=6&period=30`;
}

/* ---------- Hilfen ---------- */
export function randomHex(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return bytesToHex(b); }
export function randomCode() {   // Wiederherstellungs-Code wie „K7QF-2M9X-PL4D“
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = new Uint8Array(12); crypto.getRandomValues(b);
  const c = Array.from(b, x => a[x % a.length]).join("");
  return c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8);
}
export function bytesToHex(b) { return Array.from(b, x => x.toString(16).padStart(2, "0")).join(""); }
export function hexToBytes(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}
