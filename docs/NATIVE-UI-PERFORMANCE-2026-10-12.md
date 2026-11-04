# 12 Ekim 2026 — Yerel arayüz ve performans düzenlemesi

- Kurulu eski ApiManagement dosyasında yeni panel metni bulunmadı. Kaynakta mevcut olan yeni panel yeniden derlendi ve kurulu resources/frontend alanına uygulandı; neden eski derlemenin yeniden yer aldığı bu turda belirlenmedi.
- API Yönetim Merkezi güncelleme bölümü üst alana taşındı. Kaynak ve kurulu arayüzün 104 dosyası eşleşti; kurulu panelde yeni sürükle/bırak metni ayrıca doğrulandı. Önceki arayüz .local/native-ui-backup-* dizininde saklandı.
- native-refinement.css ortak açık/koyu yüzeyler, sistem yazı tipi, sade mavi seçili menü, yuvarlatılmış tutarlı kontroller ve bulanıklık kullanılmayan başlık/modal arka planlarını tanımlar. Apple marka varlığı veya SF fontu eklenmedi.
- Layout bütün içerik transformunu kaldırır; yalnız 140 ms opacity geçişi kullanır. Reduced-motion tercihi korunur.
- InteractionMotion boş ripple listesinde kaydırma olaylarının yeni boş state oluşturmasını önler.
- PlatformDiagnostics 15 saniye yerine 30 saniye sorgular; gizli pencerede sorgulamaz, eşzamanlı sorguyu engeller ve görünürlüğe dönünce yeniler. Merkezi lisans sorguları ve sunucu erişim denetimleri değiştirilmedi.

Doğrulanan: frontend üretim derlemesi (configLoader runner), derlemede yeni panel, kurulu dosyalarla birebir eşleşme.
Bekleyen: kullanıcı programı tamamen kapatıp yeniden açmalı; gerçek masaüstü/küçük ekran görsel kabulü ve CPU/FPS karşılaştırması yapılmadı. Tarayıcı yerel önizleme erişimi önceki turda güvenlik politikasıyla reddedildi; bu koruma aşılmadı. Kasma tamamen giderildi veya tüm sayfalar görsel olarak kabul edildi iddiası yoktur. Yeni installer üretilmedi. İş verileri ve lisans değiştirilmedi.
