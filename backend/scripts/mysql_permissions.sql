-- DBA önceden boş hedef veritabanını ve hesapları oluşturur.
-- Hesap parolalarını bu dosyaya yazmayın; güvenli yönetim kanalında belirleyin.
-- Aşağıdaki veritabanı/hesap/host adlarını gerçek hedefle değiştirin.
-- Günlük uygulama hesabı: DDL, CREATE USER veya global izin içermez.
GRANT SELECT, INSERT, UPDATE, DELETE ON veniux_stock.*
  TO 'veniux_app'@'localhost';
-- Yalnız durdurulmuş uygulamanın ayrı migration/kopya işlemi için:
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP, TRIGGER
  ON veniux_stock.* TO 'veniux_migrator'@'localhost';
-- Önceden oluşturulmuş ayrı, boş kurtarma hedefi için:
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP, TRIGGER
  ON veniux_recovery_candidate.* TO 'veniux_recovery'@'localhost';
-- Hiçbir hesap GRANT OPTION, SUPER veya *.* izni gerektirmez.
-- Binary log açık hedefte CREATE TRIGGER sunucu politikası DBA tarafından
-- hazırlanır; uygulamaya SUPER verilmez, uygulama global ayarı değiştirmez.
