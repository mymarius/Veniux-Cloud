# Yayın notu kontrolü

16 Ekim 2026 düzeltmesi: site geçmişi 2.4.23'te kalmıştı. Android 2.4.24–2.4.32 kayıtları ve 16 Ekim site yayını eklendi. İndirme kanalı gerçek sürümleri Windows 2.4.21 / Android 2.4.32 olarak doğrulandı. Kaynak sürümü yayınlanmış EXE sürümü gibi gösterilmez.

Her yayında:

1. Değişiklikleri gerçek dosya ve test sonuçlarıyla karşılaştırın; yeni notu ekleyin. Web yayınına uygulama sürüm numarası vermeyin.
2. `node website-php/bin/sync-release-notes.cjs` çalıştırın. Bu işlem gerçek indirme manifestlerini doğrular ve programdaki mevcut notları site kataloğuna taşır. Hesap/anahtar gerektirmez; manifest okunamazsa yayın durmalı.
3. Android/Windows etiketlerini ve gerçek cihaz sınırlarını ayrı yazın. Kaynakta olup indirilen pakette olmayan özelliği yayımlandı diye anlatmayın.
4. PHP sözdizimi, sürüm sırası ve platform filtrelerini doğrulayın; site dosyalarıyla `release-catalog.php`yi birlikte yayınlayın.
5. Canlı güncelleme notlarını ve iki indirme manifestini karşılaştırın; yayın raporunu kaydedin.

Mevcut yerel site yayın aracı `.local/publish-growth-site.py`, senkronizasyon adımını artık başta zorunlu çalıştırır. Bu işlem zamanlanmış görev veya kendi kendine yayın değildir; içerik doğruluğu yine yayın kontrolü gerektirir.

Hostimux: Android 2.4.32 APK içinde res/drawable/hostimux.png, paketlenmiş sponsor görseli ve hostimux.com bağlantısı doğrulandı. Yerel Java bağlantı ekranı, React giriş/kurulum/sistem ayarlarında sponsor bileşeni var. Windows indirme kanalı eski 2.4.21 olduğundan bu pakette yeni sponsor alanı bulunduğu iddia edilmedi.
