# Barkod sağlayıcı katmanı — 23 Kasım 2026

Yerel çalışma; canlıya alınmadı. Şema değişikliği YOK.

## Yapı
`backend/src/services/barcodeProviders/`: `index.js` (kayıt defteri ve çalıştırıcı), `openFoodFacts.js`, `barcodeLookup.js`, `common.js` (ortak doğrulama).
`barcodeLookupService.suggest` akışı: işletmenin kendi kataloğu → etkin sağlayıcılar sırayla → elle giriş. Yanıt biçimi geriye uyumlu (`source` artık sağlayıcı kimliği: `off`, `barcodelookup`; ek alan `provider`, öneride `category`).

## Yapılandırma (ortam değişkenleri, yalnız sunucuda)
| Değişken | Anlam |
|---|---|
| `VENIUX_BARCODE_PROVIDERS` | Sıra ve etkin liste, virgülle. Varsayılan `off`. Bilinmeyen ad yok sayılır. |
| `VENIUX_BARCODELOOKUP_KEY` | Barcode Lookup anahtarı. Yoksa o sağlayıcı etkin sayılmaz. İstemciye/yanıta/hataya hiç girmez. |
| `VENIUX_BARCODELOOKUP_IMAGES=1` | Barcode Lookup görsellerini öner (varsayılan kapalı: görsel hakları sözleşmeye bağlı). |
| `VENIUX_OFF_DISABLED=1` | Open Food Facts'i kapatır. |
| `VENIUX_OFF_URL` | Open Food Facts adresini değiştirir. |

## Davranış
- Her sağlayıcının kendi önbelleği (bulunan/bulunamayan süreleri ayrı), sunucu ve işletme başına dakikalık sınırı, zaman aşımı ve sayaçları var.
- Hata (ağ/5xx): bir kez yeniden denenir. 429: yeniden denenmez, sıradaki sağlayıcıya geçilir. 401/403: yeniden denenmez, "yetki/anahtar reddedildi" olarak sayılır.
- Hepsi bulamazsa en önemli neden döner (sınır > hata > bulunamadı > atlandı) ve kullanıcı elle girişe düşer; ürün oluşturma hiçbir koşulda engellenmez.
- Dış veri temizlenir (kontrol karakterleri, uzunluk), görsel yalnız izinli https alan adından, ad yoksa öneri yoktur. Yinelenen ürün: kendi katalogda barkod ve GTIN eşdeğerleri (baştaki sıfır) aranır; birden fazla eşleşme 409.
- Hiçbir kayıt yazılmaz; öneri, kullanıcı onayıyla mevcut `/retail/receive` akışına girer.

## Yönetim
`GET /api/retail/lookup/providers` (yalnız platform yöneticisi): sıra, etkin/yapılandırılmış, sınırlar, sayaçlar (istek, bulunan, bulunamayan, hata, sınır, önbellek, yeniden deneme, son hata). Anahtar değeri dönmez.

## Sınırlar (dürüst durum)
- **Barcode Lookup gerçek anahtar ve gerçek yanıtla DENENMEDİ.** Yanıt biçimi yayımlanmış belgeye göre yazıldı, yalnız sahte yanıtla test edildi. Anahtar alındığında bilinen barkodlarla elle doğrulayın; ticari kullanım ve görsel koşullarını sözleşmede kontrol edin. Türk ürünü kapsamı bilinmiyor.
- **Sayaçlar ve önbellek bellektedir**; sunucu yeniden başlarsa sıfırlanır. Kalıcı kullanım kaydı ve işletme başına kota için yeni tablo (şema) gerekir; yapılmadı.
- Sağlayıcı sırası ortam değişkeniyle yönetilir; arayüzden açıp kapatma yok (kalıcı ayar için şema gerekir).
- GS1 Türkiye ve yerel Türk veri tabanları eklenmedi (erişim ve fiyat doğrulanmadı). Yeni sağlayıcı = `barcodeProviders/` altına bir dosya + `REGISTRY`'ye ekleme.
- Ortak ("onaylı kayıtlardan") katalog bu işin kapsamında değil.
