/** SQLite şemasını uygular (yeni CRM/İK tabloları dahil) ve çıkar. */
require("../src/config/database");
setTimeout(() => { console.log("SQLite şeması uygulandı."); process.exit(0); }, 2500);
