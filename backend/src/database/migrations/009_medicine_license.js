// İlaç kataloğuna ruhsat tarihi ve numarası ("piyasaya yeni giren ilaçlar" için).
// Yalnızca sütun ekler; mevcut veriye dokunmaz. Değerler bir sonraki senkronizasyonda dolar.
const up = db => {
  const columns = new Set(db.prepare('PRAGMA table_info(medicines)').all().map(c => c.name));
  if (!columns.has('license_date')) db.exec('ALTER TABLE medicines ADD COLUMN license_date TEXT');
  if (!columns.has('license_number')) db.exec('ALTER TABLE medicines ADD COLUMN license_number TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_medicines_license_date ON medicines(license_date)');
};

// Geri alma: indeks kaldırılır; SQLite sütun silmeyi tablo yeniden yazımı gerektirdiğinden
// (veri kaybı riski) sütunlar bırakılır, uygulama onları kullanmadan da çalışır.
const down = db => { db.exec('DROP INDEX IF EXISTS idx_medicines_license_date'); };

module.exports = up;
module.exports.up = up;
module.exports.down = down;
