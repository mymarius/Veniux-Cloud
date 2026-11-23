# Satış ve faturalara para birimi (şema 034) — 23 Kasım 2026

Yerel commit yok / canlıya alınmadı. Şema adımı: SQLite `065_money_currency.js`, MySQL manifesti `034-money-currency`.

## Ne eklendi
- `pos_sales.currency` ve `edocuments.currency` (`TEXT NOT NULL DEFAULT 'TRY'`). Mevcut satırlar bugüne kadar TRY temelinde olduğu için `TRY` olur; veri çevrilmez.
- `invoices.currency` zaten vardı (Veniux'un müşteriye kestiği abonelik faturaları, varsayılan USD); değişmedi.
- Satış: kasa satışı (`retailDailyService`) işletmenin güncel ana para birimini kayda yazar. Geçersiz/boş değer `TRY` sayılır.
- e-Belge taslağı: satışın para birimini taşır (satış bulunamazsa işletmenin ana para birimi). API `currency` alanı döner.
- İşletme ayarı: satış kaydı olan işletmenin para birimi değiştirilemez (409). İlk satıştan önce değiştirilebilir. Desteklenen: TRY, AZN, USD, EUR, GBP.

## MySQL yükseltmesi
`MySQLMigrator.upgradeAdditive` artık mevcut tabloya **güvenli sütun** ekleyebilir: hesaplanan olmayan, `NOT NULL` ise varsayılanı olan, anahtar/indeks/yabancı anahtarda yer almayan sütun. Başka her tablo değişikliği hâlâ `SCHEMA_UPGRADE_UNSUPPORTED` ile durur. Sütun yoksa `ALTER TABLE … ADD COLUMN` yapılır; yarıda kalırsa yeniden çalıştırılabilir.

## Doğrulama (bu makinede)
- SQLite: tüm backend testleri 189 dosya / 1386 test geçti (yeni `saleCurrency.test.js` dahil).
- MySQL 8.4 (yerel test örneği, 33316): `schemaUpgrade` (3 test, yeni 034 testi dahil), cutover ve gerçek uygulama akışı testleri geçti. Tam MySQL paketini çalıştırmadım.
- **MariaDB / Plesk MySQL'de denenmedi.** Canlı bulutta kullanılan sunucu sürümüyle `ADD COLUMN … DEFAULT ('TRY')` (LONGTEXT + ifade varsayılanı) ayrıca doğrulanmalı. Mevcut `tenants.currency` aynı biçimi kullandığı için sorun beklenmiyor, ama kanıtlanmadı.

## Canlıya alma
Önceki şema adımlarıyla aynı yol: bulut kaynağı yüklenir, `mysql_migrate.js --record-deployment --confirm-target` çalıştırılır. Bu adımdan önce Plesk'te veritabanı yedeği alınmalı (sütun ekleme geri alma gerektirirse yedekten dönülür).

## Bilerek yapılmayanlar
- Raporlar para birimi bazında ayrılmıyor; satış kaydı olan işletmede para birimi sabit olduğu için bugün karışık toplam oluşmaz.
- `purchase_orders`, `retail_sales`, `pos_sale_items` ve diğer tutar tablolarına sütun eklenmedi (satış başlığı `pos_sales` para birimini taşır).
- Yabancı para ile ödeme (`RetailPos` döviz) hâlâ TL'ye çeviriyor; AZN ana para birimli işletmede bu özellik doğru çalışmaz.
