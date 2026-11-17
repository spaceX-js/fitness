-- Fitness – Datenbank-Schema (Cloudflare D1)
-- Einmalig ausführen: npx wrangler d1 execute fitness-db --remote --file=d1-schema.sql

-- Einstellungen und Zugangsdaten (nur Hashes): pw_salt, pw_hash, totp_secret, totp_last, recovery (Hashes der Notfall-Codes),
-- setup_hash (Einrichtungscode, wird nach der Einrichtung gelöscht), plan_start (Montag der Woche 1),
-- overrides (Anpassungen am Plan, JSON), status (krank / Einschränkungen, JSON), decisions (Entscheidungen zu Empfehlungen, JSON)
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- Angemeldete Geräte. id = SHA-256 des Cookie-Werts (der Wert selbst liegt nur im Browser)
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  agent      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, ts TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts(ip, ts);

-- Trainingsprotokoll: ein Eintrag pro Einheit und Tag (id = Datum + Art, z. B. 2026-11-17-run)
CREATE TABLE IF NOT EXISTS logs (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  kind       TEXT NOT NULL,              -- strength | run | recovery | mobility | other
  status     TEXT NOT NULL,              -- done | partial | skipped
  data       TEXT NOT NULL DEFAULT '{}', -- Sätze, Lauf-Werte, Gefühl, Beschwerden (JSON)
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_date ON logs(date);
