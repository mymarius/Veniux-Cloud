# Açık güvenlik riskleri: karar ve durum (9 Kasım 2026)

Kasım başındaki denetimden kalan 6 risk ve bu turda bulunan 1 yeni risk.

| # | Risk | Durum | Ne yapıldı / neden |
|---|---|---|---|
| 1 | İmzasız Windows güncellemesi | **Açık, sizde** | Kod imzalama sertifikası gerekiyor. Sertifika gelince derleme imzalı yapılır. En büyük kalan risk bu. |
| 2 | Tarayıcıdan yerel sunucuya `null` kaynağı | **Bilinçli kabul** | Masaüstünün başlattığı yerel sunucu `null` kaynağını zaten yalnız masaüstünün gizli başlığıyla kabul ediyor. Oturum çerezle değil istek başlığındaki anahtarla taşınıyor; başka bir sayfa `null` kaynağından istek atsa da kullanıcının oturumunu kullanamaz. Kuralı tamamen kaldırmak, masaüstünün dış sunucuya bağlanma modunu bozar. |
| 3 | Plan limitleri (davetli kullanıcılar, el terminalleri) | **Kapatıldı** | Davetler kullanıcı limitine zaten sayılıyor. Pasif kullanıcıyı yeniden açma limiti `fa62911` ile kapatıldı. Yeni el terminali artık lisanstaki cihaz (PDA) sınırını aşamıyor; mevcut cihaz yeniden bağlanabiliyor. |
| 4 | Harf farkıyla çift e-posta (`Ali@` / `ali@`) | **Kapatıldı (giriş)** | Yeni kayıtlar zaten harfe duyarsız tekil. Eski çift kayıtlarda artık parolası tutan hesap giriş yapıyor; biri diğerini kilitleyemiyor. Sunucu günlüğüne uyarı düşüyor. Veritabanına benzersizlik kuralı eklenmedi, çünkü kurulu masaüstlerinde mevcut tablolar değiştirilmiyor. |
| 5 | `create_admin.js`, `create_superadmin.js` sabit şifreler | **Kapatıldı** | Dosyalar depoda artık yok. **Sizden:** bu betikler canlı sunucuda hiç çalıştırıldıysa o hesapların şifrelerini değiştirin. |
| 6 | Eski kopya `GENEL/veniux/veniux.zip` | **Kontrol edildi, sizden işlem gerekiyor** | Zip içinde `backend/.env`, eski lisans özel anahtarı ve veritabanı dosyaları var. Yalnız özetler karşılaştırıldı: zip'teki lisans anahtarı bugünküyle aynı değil, `.env` içindeki gizli değerler de bu depodaki dosyalarla aynı değil. Ama Gemini ve NVIDIA API anahtarları, JWT ve SMTP şifresi o tarihte kullanılmış olabilir. **Sizden:** zip'i silin ya da paylaşmayın. Zip bir yere yüklendiyse o eski anahtarları sağlayıcı panellerinden iptal edin. |
| 7 (yeni) | `backend/recovery/` klasöründe **bugünkü** lisans özel anahtarı, `.env` ve veritabanı kopyası | **Git'ten korundu** | Kaynak koddan çalışırken alınan bir güvenlik kopyası. Git bu klasörü dışarıda tutmuyordu; yanlışlıkla commit edilebilirdi. `.gitignore`'a eklendi. Klasörü silmek size kalmış: içinde yalnız geliştirme verisi var, ama özel anahtar da var. |

## Doğrulama
- Yeni testler: `backend/tests/securityOpenRisks.test.js` (el terminali sınırı, çift e-posta girişi).
- Canlı sunucuda deneme yapılmadı; testler yerel test veritabanında çalıştı.
