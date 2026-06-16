const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function createDatabase(dbPath) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ipos (
      security_code TEXT PRIMARY KEY,
      security_name TEXT NOT NULL,
      security_name_en TEXT,
      status TEXT NOT NULL,
      apply_start_at TEXT,
      apply_end_at TEXT,
      result_date TEXT,
      grey_market_at TEXT,
      listed_date TEXT,
      issue_low_price REAL,
      issue_high_price REAL,
      lot_size REAL,
      lowest_fee REAL,
      leverage REAL,
      enable_finance INTEGER,
      prospectus_url TEXT,
      sponsors_json TEXT,
      source TEXT,
      source_ipo_id TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_snapshot_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rate_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      security_code TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      hours_to_cutoff REAL,
      estimated_margin_multiple REAL,
      source TEXT NOT NULL,
      raw_source_payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS official_results (
      security_code TEXT PRIMARY KEY,
      result_announced_at TEXT,
      official_public_subscription_multiple REAL,
      one_lot_success_rate REAL,
      final_offer_price REAL,
      clawback_or_reallocation_note TEXT,
      grey_market_change_pct REAL,
      first_day_open_change_pct REAL,
      first_day_close_change_pct REAL,
      announcement_url TEXT,
      source TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      security_code TEXT,
      alert_type TEXT NOT NULL,
      alert_key TEXT NOT NULL UNIQUE,
      triggered_at TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_channel TEXT NOT NULL,
      sent_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS source_status (
      source TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      message TEXT
    );
  `);
  return db;
}

module.exports = {
  createDatabase
};
