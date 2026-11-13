# Kişiye özel demo hesabı (app.veniux.com)

Her ziyaretçi için ayrı, örnek veri yüklü ve süreli bir işletme açılır. Ortak hesap yoktur.

## Hesap açma
Plesk → app.veniux.com → Node.js → **Run Node.js commands** (komut kutusu `npm` seçili):

```
exec -- node --env-file=../cloud-private/install.env backend/scripts/create_demo_account.js --email kisi@ornek.com --company "Ornek Market" --days 14
```

- `--email` zorunlu. `--company` isteğe bağlı (işletme adı `Veniux Demo – …` olarak açılır). `--days` 1–60, varsayılan 14.
- Çıktıdaki **şifre yalnızca bir kez** gösterilir, hiçbir yere kaydedilmez. Güvenli bir kanaldan kişiye iletin (e-posta ile açık şifre yerine mümkünse mesajlaşma uygulaması).
- Giriş adresi: https://app.veniux.com/giris

## Hesapta olanlar
- İşletme: `Veniux Demo – <ad>`, yönetici kullanıcı (e-posta ile giriş).
- Lisans: İşletme paketi (`BUSINESS_ANNUAL`), seçilen gün sayısı kadar. Süre bitince giriş kapanır.
- Örnek veri: 2 depo (Ana Depo, Şube Mağaza), 12 ürün (geçerli EAN-13 barkod, minimum stok), her depoda stok kaydı ve açılış hareketi. Bazı ürünler minimum stoğun altındadır, böylece uyarılar ve sipariş önerisi görünür.

## Sınırlar
- Süresi biten demo işletmeleri bulut hizmetinde günde bir kez otomatik silinir: yalnız adı `Veniux Demo – ` ile başlayan ve tüm lisansları bitişten en az 30 gün önce dolmuş olanlar. Bekleme süresi `VENIUX_DEMO_PURGE_DAYS` ile değişir (`0` kapatır). Elle önizleme: `node backend/scripts/purge_expired_demos.js [--days 30]` (silmez); silmek için `--apply`. Silinen işletmenin merkezdeki `VNX-` anahtarı ayrıca api.veniux.com panelinden iptal edilmelidir.
- Aynı e-posta ikinci kez açılamaz. Platform sahibi e-postası için demo açılmaz.
- Şema değişikliği yoktur.

## Merkezi lisans gereği (canlıda zorunlu)
`app.veniux.com`'da her API isteği merkezi lisans kapısından geçer; cihazın `VNX-` anahtarıyla etkinleştirilmiş olması gerekir. Betikle açılan hesap tek başına giriş yapamaz (`423 LICENSE_REQUIRED`). Her demo için şu adımlar gerekir:

1. **Lisans oluşturun:** https://api.veniux.com/login yönetim paneline girin → lisans oluşturma formu: firma (`Veniux Demo – <ad>`), paket **İşletme (`BUSINESS_ANNUAL`)**, terminal sınırı (telefon + bilgisayar kullanacaksa 2), bitiş günü (örn. +14 gün). `VNX-…` anahtarı **yalnız bir kez** gösterilir.
2. **Hesabı açın:** yukarıdaki betik.
3. **Kişiye iletin:** e-posta, şifre ve `VNX-` anahtarı. Kişi `https://app.veniux.com/activate` ("Lisans Kontrolü") sayfasında anahtarı etkinleştirir, sonra giriş yapar.
4. İlk girişte anahtar o işletmeye **bağlanır** (bir anahtar bir işletme). Anahtarı başka kişiyle paylaşmayın.

Lisans bitiş günü, merkezde girişi kapatan tarihtir; uygulamadaki yerel lisans kaydı bu modda kullanılmaz (modül türü merkezi lisanstaki plandan gelir).
