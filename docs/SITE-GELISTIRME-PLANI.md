# Site geliştirme planı (13 Kasım 2026)

Kaynak: `veniux_gelistirme_ve_seo_promptlari.md` (5 istem). Her madde canlı site ve kodla karşılaştırıldı; belge eski bir tarihe aittir.

## Belgedeki iddia → bugünkü durum
| İddia | Durum | Karar |
|---|---|---|
| Ana sayfa ile /fiyatlandirma fiyatları çelişiyor (4.188 / 10.788 / 35.988 ↔ 3.588 / 7.188 / 14.388) | **Eski.** İkisi de aynı: 8.388 / 21.588 / 53.988 ₺. Belgenin "sabitle" dediği 3.588 / 7.188 / 14.388 fiyatları artık geçersiz. | Uygulanmaz (uygulansa fiyat düşerdi). |
| Güncelleme notlarında eski fiyat | **Doğru.** 18 Ekim kaydında 3.588 / 7.188 / 14.388 ₺ "yeni fiyatlar" olarak duruyordu. | Kayıt kaldırıldı. |
| Üst menü/alt bilgi farklı | Yanlış. Ana sayfa ve alt sayfalar aynı menüyü kullanıyor. | Gerek yok. |
| Yasal sayfalarda kişisel Gmail | **Doğru.** `legal.php` ve `legal-view.php`'de kişisel adres ve gerçek kişi adı veri sorumlusu olarak yazıyor. | Kurumsal e-posta ve şirket bilgisi gerekir (aşağıda). |
| Telefon / WhatsApp hattı yok | **Doğru** (sayfalarda bağlantı yok). | Numara gerekir. |
| Güncelleme notlarında iç test dili | **Doğru.** "Gerçek telefon kamera testi…", "geçici imzasız…", "HENÜZ YAYIMLANMADI", "147 uygulama testi". | Temizlendi. İmza uyarısı kurulum sayfasında zaten var. |
| Lisanssız program açılmıyor / deneme yok | Kısmen. Kişiye özel 14 günlük demo hesabı var; kendi kendine açılan deneme yok. | Ayrı iş (aşağıda). |
| Sektör sayfaları eksik | Kısmen. Market, kırtasiye, hırdavat, kafe, barkodlu stok, SKT ve el terminali sayfaları yayında. Züccaciye sayfası ve 3 rehber yok. | Sonraki iş. |
| GA4 / Clarity | Çerez onay paneli hazır, ölçüm kimlikleri yok. | Kimlik gerekir. |

## Bu turda yapılanlar (yerel, canlıda değil)
- `release-notes-20261018.php`: eski fiyat kaydı ve yayımlanmamış "hazırlık" kaydı çıkarıldı; iç ifadeler sadeleştirildi.
- `release-notes.php`: kamera testi, "kullanıcı tercihi/onayıyla geçici imzasız", fiziksel yazıcı testi gibi iç ifadeler sade bir imza uyarısı ve kurulum sayfasına yönlendirmeyle değiştirildi.

## Sizden gerekenler
1. Kurumsal e-posta adresi (örn. destek@veniux.com) çalışır durumda mı? Yasal metinlerdeki kişisel Gmail ancak o zaman değişir. Veri sorumlusu bilgisi (kişi adı mı şirket mi) hukuki karardır, ben değiştirmem.
2. Telefon veya WhatsApp numarası ve çalışma saatleri.
3. GA4 ölçüm kimliği ve Microsoft Clarity proje kimliği (onay panelinden sonra yüklenir).

## Sonraki işler (ayrı ayrı onay ve test ister)
1. Züccaciye sektör sayfası (gerçek arayüz görseli, 4 SSS, FAQPage JSON-LD). Kural: yalnız gerçek özellik, uydurma yorum yok.
2. Üç rehber: sayım farkı, telefonu barkod okuyucu yapma, barkodlu stoğa geçiş kontrol listesi.
3. Kendi kendine açılan 14 günlük deneme: e-posta doğrulaması + merkezi lisans üretimi + örnek veriyle başlama. Merkezi lisans (api.veniux.com) tarafı değişir; ayrı tasarım gerekir.
4. Tarayıcıda çalışan kasa simülatörü (/demo var mı, kapsamı ne? önce incelenecek).
5. Resimli "3 adımda kurulum" rehberi (SmartScreen adımı dahil).
6. Prompt 5 içerikleri: video senaryoları, satış mesajları, reklam anahtar kelimeleri. Metin işi, kod gerektirmez.
