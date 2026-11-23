# Site dil sistemi (PHP) — 24 Kasım 2026

Yerelde yazıldı ve PHP 8.2 ile denendi; **sitede yayımlanmadı** (`publish-site.py` çalıştırılmadı).

## Yapı
- `website-php/lib/i18n.php`: `vxT('Türkçe metin')` (kaynak Türkçe metin anahtardır, çeviri yoksa Türkçe döner), `vxLink()`, `vxAlternates()`, `vxHreflang()`, `vxCur()`.
- `website-php/lib/i18n/az.php`: Azerbaycanca sözlük (~250 metin).
- Dil adres önekiyle seçilir: `/az/...` Azerbaycanca, öneksiz adresler Türkçe (mevcut adreslerde hiçbir değişiklik yok).
- **Yalnız çevrilmiş sayfalar `/az/` altında yayımlanır:** `/az/` (ana sayfa) ve `/az/fiyatlandirma`. Diğer `/az/...` adresleri aynı sayfanın Türkçe sürümüne 302 ile yönlenir (çevrilmemiş içerik Azerbaycanca adreste yayımlanmaz). Yeni sayfa eklemek için `VX_AZ_PAGES` listesine yazmak ve sayfayı `vxT()` ile çevirmek yeterlidir.
- SEO: `<html lang>`, `Content-Language`, `/az/` kanonik adresi, `og:locale=az_AZ`, `hreflang` (tr, az, x-default), site haritasında Azerbaycanca adresler ve `xhtml:link` karşılıkları, Azerbaycanca başlık ve açıklama.
- Üst menüde TR/AZ dil seçici (her sayfada). Çerez onay paneli ve alt bilgi Azerbaycanca.

## Azerbaycanca sayfalarda bilerek farklı olanlar
Türkiye'ye özgü içerik Azerbaycan sayfalarında **gösterilmez**: TL fiyat tablosu ve KDV, pazaryeri/ÖKC/e-fatura yol haritası, KVKK bağlantısı ve metni, Türkçe arayüz ekran görüntülerinin olduğu tanıtım filmi bölümü, Türkiye'ye özgü SSS parçaları. İletişim formu (rıza metni hukuki) Azerbaycanca sayfada yok; yerine WhatsApp düğmesi ve "yazışma şu an Türkçe yürür" notu var. `/az/fiyatlandirma` sayfası Azerbaycan fiyatı **vermez** ("müraciət əsasında"): Azerbaycan fiyatı henüz belirlenmedi, TL'den hesaplanıp yanlış gösterilmedi. Sayfa ayrıca kasa için yasal nəzarət-kassa aparatı gereksinimlerinin ayrıca araştırıldığını ve programın bugün yasal kasa fişinin yerine geçmediğini açıkça yazar.

## Doğrulama
`php -l` tüm değiştirilen dosyalarda temiz; yerel PHP sunucusunda: `/az/` ve `/az/fiyatlandirma` 200, Türkiye'ye özgü ifade sayısı 0, `/az/market-pos` → 302 `/market-pos`; Türkçe ana sayfa ve 8 örnek Türkçe sayfa 200 ve PHP hatası yok, Türkçe ana sayfa içeriği değişmedi (₺ sayısı aynı); site haritasında 6 `/az/` adresi. Tarayıcıda Azerbaycanca ana sayfa gözle kontrol edildi.

## Sınırlar
- **Çeviri kalitesi:** Azerbaycan dilini ana dil kimi bilen biri tarafından mutlaka gözden geçirilmeli; çerez onayı ve gizlilik metinleri hukuki olduğundan Azerbaycan mevzuatı açısından ayrıca doğrulanmalı.
- Hesap, giriş, panel ve diğer tüm sayfalar (çözüm/sektör sayfaları, rehberler, yasal metinler, indirme) Türkçe kalır; Azerbaycanca bir sayfadan bunlara giden bağlantılar Türkçe sayfaya gider.
- Ekran görüntüleri ve filmdeki arayüz Türkçedir; örnek veriler Azerbaycan'a uyarlanmadı.
- Gerçek yayında denenmedi (yerel PHP yerleşik sunucusu; üretimde `.htaccess`/Plesk yönlendirmesinin `/az/` yolunu `index.php`'ye yönlendirdiği doğrulanmalı).
- Azerbaycan için destek, fiyat, e-kassa ve yerel ortak kararları ayrı (bkz. `ULUSLARARASI-DENETIM-2026-11-23.md`).
