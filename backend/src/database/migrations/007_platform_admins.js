module.exports = db => { db.exec(`CREATE TABLE IF NOT EXISTS platform_admins (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`); };
