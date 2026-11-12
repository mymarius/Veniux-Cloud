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
- Bu betik yalnız ekler; süresi biten demo işletmeleri silmez.
- Aynı e-posta ikinci kez açılamaz. Platform sahibi e-postası için demo açılmaz.
- Şema değişikliği yoktur.
