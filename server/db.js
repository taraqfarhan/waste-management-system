/**
 * db.js — SQLite via sql.js (pure JS, no native build needed)
 * Persists to ./data/rcc.db as a Buffer file.
 */

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "../data/rcc.db");
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  setupSchema();
  return db;
}

function save() {
  if (!db) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function setupSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'citizen',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id   TEXT NOT NULL,
      station_name TEXT NOT NULL,
      user_id      INTEGER,
      user_name    TEXT NOT NULL,
      user_phone   TEXT,
      type         TEXT NOT NULL,
      description  TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TEXT DEFAULT (datetime('now')),
      resolved_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS fill_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id  TEXT NOT NULL,
      fill_pct    INTEGER NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed admin user (password: admin123)
  const bcrypt = require("bcryptjs");
  const adminExists = db.exec(
    "SELECT id FROM users WHERE email='admin@rcc.gov.bd'",
  );
  if (!adminExists[0] || adminExists[0].values.length === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ["RCC Admin", "admin@rcc.gov.bd", hash, "admin"],
    );
    save();
  }

  // Seed some fill history for charts (last 30 days)
  const histExists = db.exec("SELECT COUNT(*) as c FROM fill_history");
  if (histExists[0].values[0][0] === 0) {
    seedHistory();
  }
}

function seedHistory() {
  const stations = ["bulonpur", "railway", "northern"];
  const now = Date.now();
  const DAY = 86400000;
  const stmt = db.prepare(
    "INSERT INTO fill_history (station_id, fill_pct, recorded_at) VALUES (?, ?, ?)",
  );
  for (let d = 29; d >= 0; d--) {
    stations.forEach((sid) => {
      // Record 4 readings per day
      for (let h = 0; h < 4; h++) {
        const ts = new Date(now - d * DAY + h * 6 * 3600000);
        const pct = Math.floor(20 + Math.random() * 70 + (h / 4) * 20) % 101;
        stmt.run([sid, pct, ts.toISOString()]);
      }
    });
  }
  stmt.free();
  save();
}

// Helper to run a SELECT and return plain JS objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper for INSERT/UPDATE/DELETE
function run(sql, params = []) {
  db.run(sql, params);
  save();
  // Return last insert id
  const res = db.exec("SELECT last_insert_rowid() as id");
  return res[0] ? res[0].values[0][0] : null;
}

module.exports = { getDb, query, run, save };
