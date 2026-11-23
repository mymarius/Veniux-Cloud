// Satış ve fatura belgelerine para birimi: her kayıt kendi para biriminde saklanır, işletme sonradan para birimini değiştirse bile
// geçmiş tutarların anlamı bozulmaz. Mevcut kayıtlar bugüne kadar hep TRY temelindeydi, bu yüzden 'TRY' olarak işaretlenir.
// Yalnız sütun eklenir (idempotent): veri silinmez, tablo yeniden oluşturulmaz.
module.exports = db => {
  const extend = (table, name, type) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  };
  extend('pos_sales', 'currency', "TEXT NOT NULL DEFAULT 'TRY'");
  extend('edocuments', 'currency', "TEXT NOT NULL DEFAULT 'TRY'");
};
