// Older settings pages added these columns on demand. Upgrade either schema safely.
module.exports = db => {
  const extend = (table, definitions) => {
    const names = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const [name, type] of Object.entries(definitions)) {
      if (!names.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  };
  extend('users', { full_name: 'TEXT', phone: 'TEXT', status: "TEXT DEFAULT 'active'", last_login: 'DATETIME', session_version: 'INTEGER NOT NULL DEFAULT 0' });
  extend('tenants', { settings_json: 'TEXT', currency: "TEXT DEFAULT 'TRY'", timezone: "TEXT DEFAULT 'Europe/Istanbul'", industry: "TEXT DEFAULT 'Depolama ve Lojistik'" });
};
