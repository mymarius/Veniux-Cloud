// Şifre sıfırlama jetonları yalnızca özet olarak saklanır; kullanıcı başına tek geçerli jeton vardır.
// token_hash tekil değildir: taşınabilir yedek bu sütunu maskelediğinde birden çok satır aynı değeri alır.
module.exports = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
  `);
};
