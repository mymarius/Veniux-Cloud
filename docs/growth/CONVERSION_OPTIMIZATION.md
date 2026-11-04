# Dönüşüm incelemesi

Kanıt: website-php/index.php, contact.php, accounts.php. Ürün sayfaları kayıt olmadan incelenebiliyor. Görüşme formu CSRF, honeypot, alan doğrulaması, izin ve kalıcı özel kayıt içeriyor. E-posta gönderilemediğinde talep korunuyor; teslim edildi denmiyor. Bu davranış korunmalı.

Eksikler: demo/teklif ayrı açık amaç alanı yok; ortaklık başvurusu yok; GA4 başarının tek sayımı yok; istek paneli ve takip SLA’sı doğrulanmadı. Mevcut formu dört yeni forma kopyalamak yerine form_type allowlist ile ayrıştırma planı hazırlayın.

İlk ekran hedefi: mağaza ve KOBİ depo için stok/depo kayıtları, Windows/Android, somut kullanım; birincil CTA görüşme, ikincil ürün akışı. Mavi/turuncu logo ve mevcut tipografi korunacak. Donanım ve düzenlenmiş entegrasyon garantisi eklenmeyecek.

Mobil kabul:360/390/768 genişlik, klavye açılınca gönder düğmesi erişimi, label/input eşleşmesi, hata odağı, kontrast, reduced-motion ve zoom200%. Başarılı formun kayıt makbuzu, hata mesajının alan ilişkisi ve tekrar deneme kontrolü gerçek HTTP ile izole storage’da test edilmeli. Form başarısı ile satış dönüşümü ayrı ölçülür.
