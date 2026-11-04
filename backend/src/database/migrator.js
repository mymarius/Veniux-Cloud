const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Migrator {
  constructor(db, options = {}) {
    this.db = db;
    this.migrationsPath = options.migrationsPath || path.join(__dirname, 'migrations');
  }

  catalog() {
    if(!fs.existsSync(this.migrationsPath))throw Error('Migration dosyaları bulunamadı. Kurulum paketi eksik.');
    return fs.readdirSync(this.migrationsPath).filter(f=>/\.(sql|js)$/.test(f)).sort().map(version=>({version,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(this.migrationsPath,version))).digest('hex')}));
  }

  status() {
    const catalog=this.catalog(),has=this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
    const applied=has?this.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(r=>r.version):[];
    const known=new Set(catalog.map(r=>r.version));
    const unknown=applied.filter(v=>!known.has(v));
    if(unknown.length)throw Object.assign(Error('Veritabanı bu kod sürümünden daha yeni veya tanınmayan migration içeriyor. Uyumlu sürümü veya güncelleme öncesi yedeği kullanın.'),{code:'SCHEMA_NEWER_THAN_CODE'});
    const checksumTable=this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='migration_checksums'").get();
    const saved=checksumTable?this.db.prepare('SELECT version,sha256 FROM migration_checksums').all():[];
    for(const row of saved){const file=catalog.find(f=>f.version===row.version);if(!file||file.sha256!==row.sha256)throw Object.assign(Error('Uygulanmış migration dosyası değişmiş: '+row.version),{code:'MIGRATION_CHECKSUM_MISMATCH'});}
    const pending=catalog.filter(r=>!applied.includes(r.version)),unbaselined=applied.filter(v=>!saved.some(r=>r.version===v));
    return {status:pending.length||unbaselined.length?'pending':'current',version:applied.at(-1)||null,applied:applied.length,expected:catalog.length,pending:pending.map(r=>r.version),unbaselined,catalog_sha256:crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex')};
  }

  async migrate() {
    const before=this.status();
    // All pending migrations form one transaction. A later failure cannot leave
    // earlier files from the same upgrade committed and usable.
    this.db.transaction(()=>{
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec('CREATE TABLE IF NOT EXISTS migration_checksums(version TEXT PRIMARY KEY REFERENCES schema_migrations(version),sha256 TEXT NOT NULL,legacy_baseline INTEGER NOT NULL DEFAULT 0)');
    const appliedRows = this.db.prepare('SELECT version FROM schema_migrations').all();
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    const catalog=this.catalog();
    for(const version of before.unbaselined){const file=catalog.find(r=>r.version===version);this.db.prepare('INSERT INTO migration_checksums(version,sha256,legacy_baseline) VALUES(?,?,1)').run(version,file.sha256);}
    const files = catalog.map(r=>r.version);

    for (const file of files) {
      if (!appliedVersions.has(file)) {
        console.log('Applying ' + file);
        const applyTx = this.db.transaction(() => {
          if (file.endsWith('.js')) require(path.join(this.migrationsPath, file))(this.db);
          else this.db.exec(fs.readFileSync(path.join(this.migrationsPath, file), 'utf8'));
          this.db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
          this.db.prepare('INSERT INTO migration_checksums(version,sha256) VALUES(?,?)').run(file,catalog.find(r=>r.version===file).sha256);
        });
        applyTx();
      }
    }
    })();
    return this.status();
  }
}
module.exports = Migrator;
