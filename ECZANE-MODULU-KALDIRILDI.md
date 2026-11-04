# Veniux 2.4.14 — Ürün kapsamı değişikliği

13 Ekim 2026 tarihinde Windows ve Android arayüzünden eczane modülü çıkarıldı.

Kaldırılanlar: eczane sayfaları ve yönlendirmeleri, ilaç kataloğu/yönetimi, eczane veri aktarımı, Windows yazılım algılama IPC'si, menüler, arama sonuçları, F4 eczane kısayolu, eczane lisans seçeneği, MEDULA/İTS işlem araçları, hasta hatırlatmaları, ilaç iade önerileri ve asistanın eczane işlemleri. F4 artık genel mağaza kasasını açar.

Backend'de eski /api/pharmacy, /api/eczane-depo, /api/pharmacy-migration, /api/medicines ve /api/admin/medicines yolları 410 MODULE_REMOVED döndürür. Bu modüllerin yönlendiricileri ve denetleyicileri yüklenmez; asistan da bu işlemleri sunmaz. Eczaneye özel backend dosyaları yeni Windows paketine dahil edilmez.

Genel stok, depo, kasa, CRM, barkod ve mevcut genel lot/son kullanma tarihi özellikleri korunur. Önceden BOTH yetkisine sahip geçerli lisanslar NORMAL kapsamıyla çalışır. Eczane-only lisanslar kendiliğinden genel stok lisansına dönüştürülmez. Son kullanma tarihi, iptal, kullanıcı yetkisi ve cihaz kotası denetimleri korunur.

Mevcut işletme kayıtları ve veritabanı şemaları silinmedi. Tarihsel tablolar geri dönüş/uyumluluk için tutulur; eczane işlemleri yeni sürümde erişilebilir değildir. Arayüz kaynaklarının geri alınabilir kopyası .local/pharmacy-removal-backup altında tutulur ve paketlere dahil edilmez.

Sitede yeni eczane hizmeti sunan tanıtımlar kaldırıldı. Eski /eczane-stok-takibi bağlantısı genel stok sayfasına 301 ile yönlenir. Tarihsel sürüm notları önceki sürümlerin kaydıdır.

Doğrulama: 9 regresyon test grubunda 55 test başarılı; derlenmiş arayüzde eczane/MEDULA/Farmakom metni bulunmuyor. Paketlenmiş backend izole üretim ayarlarıyla başlatıldı, health ve eski uç noktaların kapalı olduğu doğrulandı, yetkili kapatma başarılı. Android mevcut imza kimliğiyle üretildi. Gerçek telefonda veya kullanıcı bilgisayarında fiziksel güncelleme bu kontrollerin kapsamında değildir.
