# Üretime hazırlık

15 Ekim 2026. Karar: tam ticari lansman için henüz onay verilmez.

Geçiş kapıları: (1) aktif operasyon testleri geçmeli, eski testlerin410 sözleşmesi ayrı kaydedilmeli; (2) tenant/rol/lisans testlerinde açıklanamayan hata kalmamalı; (3) aynı gün alınan yedekten ayrı ortama geri dönüş; (4) Windows imzalı dağıtım ve temiz VM kurulum/kaldırma; (5) gerçek okuyucu/yazıcı/Android cihaz kabulü; (6) sorumlu veri/çerez metinleri ve ölçüm hesabı; (7) yayın öncesi açık kullanıcı onayı.

SQLite varsayılan ve MySQL seçilebilir adaptör birbirinin canlı kullanımı gibi raporlanamaz. Üretim DB motoru/kapasitesi ayrı onaylı tanılama gerektirir. Merkezi lisans modunda otomatik cron/backup davranışı api.veniux.com/README.md sınırlarıyla birlikte değerlendirilmeli; her saat otomatik yedek var diye satış yapılmamalı.

Yayın planı: mevcut paket/veri/ayarın şifreli yedeği → staging testleri → sürüm dosyaları ve SHA kaydı → imza doğrulaması → kısa bakım duyurusu → açık onaylı atomik yayın → sağlık/oturum/lisans/sentetik okuma kontrolü. Şema değişirse eski kodu çalıştırmak tek başına geri dönüş değildir; veriyle uyumlu snapshot/restore gerekir. Çökme/yük testi üretimde yapılmayacak.

Windows maliyet kararı: Store MSIX sertifikasyonu veya dış dağıtım için doğrulanmış yayıncı kod imzası araştırılmalı. Mevcut Electron NSIS paketi MSIX değildir; Store geçişi ayrıca paket çalışmasıdır. Satın alınmış sertifika ve Store hesabı yok. Güncel bölge/kimlik/ücret doğrulaması olmadan fiyat veya SmartScreen garantisi verilmez. Kaynak: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options

## Phase2 — 15 Ekim 2026

Phase2: yazılım regresyon kapısı680/680 ile geçti; eski test engeli kapandı. Windows imzası/temizVM/bağımsız kurtarma/gerçek cihaz ve yayın onayı kapıları hâlâ açık; REMAINING_BLOCKERS.md günceldir.
