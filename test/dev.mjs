// Lokaler Testserver ohne Cloudflare-Konto: node --experimental-sqlite test/dev.mjs [port] [db-datei]
// Führt den Worker mit einer SQLite-Datei statt D1 aus. Einrichtungscode für eine neue Datenbank: TEST-CODE-1234
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import worker from "../src/index.js";
import { sha256 } from "../src/auth.js";

const port = Number(process.argv[2] || 8788), file = process.argv[3] || ":memory:";
const fresh = file === ":memory:" || !existsSync(file);
const db = new DatabaseSync(file);
db.exec(readFileSync(new URL("../d1-schema.sql", import.meta.url), "utf8"));
if (fresh) db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('setup_hash', ?)").run(await sha256("TEST-CODE-1234"));

const stmt = (sql, args = []) => ({ sql, args, bind: (...a) => stmt(sql, a),
  async all() { return { results: db.prepare(sql).all(...args) }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async run() { db.prepare(sql).run(...args); return { results: [] }; } });
const DB = { prepare: sql => stmt(sql), async batch(list) { db.exec("BEGIN"); try { list.forEach(s => db.prepare(s.sql).run(...s.args)); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } return list.map(() => ({ results: [] })); } };
const root = new URL("../public/", import.meta.url).pathname;
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const ASSETS = { async fetch(req) {
  let p = new URL(req.url).pathname; if (p === "/") p = "/index.html";
  try { const b = await readFile(path.join(root, path.normalize(p))); return new Response(b, { headers: { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" } }); }
  catch (e) { return new Response("Nicht gefunden", { status: 404 }); }
} };

http.createServer(async (q, s) => {
  const chunks = []; for await (const c of q) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers(); for (const [k, v] of Object.entries(q.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  headers.set("CF-Connecting-IP", "127.0.0.1");
  const res = await worker.fetch(new Request("http://localhost:" + port + q.url, { method: q.method, headers, body: q.method === "GET" || q.method === "HEAD" ? undefined : body }), { DB, ASSETS });
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; });
  s.writeHead(res.status, h); s.end(Buffer.from(await res.arrayBuffer()));
}).listen(port, () => console.log("Fitness lokal: http://localhost:" + port));
