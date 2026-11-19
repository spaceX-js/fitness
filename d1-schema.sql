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

-- Trainingspläne mit Versionen. family = ein Plan über alle Versionen; status: active (aktuelle Version),
-- old (frühere Version), archived (abgelöster Plan), draft (Vorschlag, noch nicht angewendet), discarded
CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family      TEXT NOT NULL,
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL,
  status      TEXT NOT NULL,
  data        TEXT NOT NULL,
  changes     TEXT NOT NULL DEFAULT '[]',
  note        TEXT NOT NULL DEFAULT '',
  start       TEXT,
  created_at  TEXT NOT NULL,
  applied_at  TEXT,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS plans_status ON plans(status);

-- Apple Health: Tageswerte (aus dem Kurzbefehl, schon zusammengefasst – keine Einzelmessungen)
CREATE TABLE IF NOT EXISTS health_daily (
  date       TEXT NOT NULL,
  metric     TEXT NOT NULL,
  value      REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (date, metric)
);
-- Apple Health: Trainings mit Werten aus dem Trainingszeitraum
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '', run INTEGER NOT NULL DEFAULT 0,
  min REAL, km REAL, kcal REAL, hr_avg REAL, hr_max REAL, speed REAL, power REAL, stride REAL, gct REAL, source TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workouts_date ON workouts(date);

-- Apple Health: rohe Übertragungen vom Kurzbefehl, bis die App sie im Browser ausgewertet hat (danach gelöscht)
CREATE TABLE IF NOT EXISTS health_raw (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch       TEXT NOT NULL,
  part        INTEGER NOT NULL,
  parts       INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  data        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS health_raw_batch ON health_raw(batch, part);
