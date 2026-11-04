# GA4 ölçüm sözleşmesi

15 Ekim 2026. Kaynakta etkin gtag/dataLayer entegrasyonu saptanmadı. Hesap/ölçüm ID’si ve rıza uygulaması olmadan takip kodu eklenmedi.

| Olay | Yalnız tetiklenecek koşul | Parametre allowlist |
|---|---|---|
| generate_lead | contactSubmit başarıyla özel diske yazdı | form_type: demo/quote/contact, page_path |
| partnership_submit | Gelecekte başvuru sunucuda kalıcı kaydedildi | partner_type |
| download_request | Hesap/izin kontrolünden sonra dosya yanıtı başarıyla başladı | platform, app_version |
| cta_click | Gerçek kullanıcı CTA tıkladı | cta_id, page_path |

Form buton tıklamasını başarılı form gibi saymayın. POST/refresh çift sayımı için sunucuda tek kullanımlı başarı makbuzu + istemcide tüketilen olay kullanın; kişisel talep ID’sini analitiğe göndermeyin. E-posta, ad, telefon, şirket adı, lisans anahtarı, ürün/müşteri verisi, tam sorgu dizesi ve kullanıcı metni yasak. E-posta doğrulama ve indirme yetkileri korunmalı.

Rıza tasarımı: analitik başlangıçta kapalı; eşit erişilebilir Kabul/Reddet ve sonradan tercih değiştirme. Reddetmede Google isteği/analitik çerezi oluşmamalı. Consent Mode hukuki dayanak yerine geçmez. Yurt dışı aktarım, saklama süresi ve aydınlatma değerlendirmesi veri sorumlusu tarafından güncel mevzuata göre yapılmalı; kurulum hukuki uygunluk sertifikası değildir.

Test matrisi: başarılı kayıt1 olay;422/403/429/500 sıfır olay; refresh/back sıfır tekrar; redde tüm analitik ağ istekleri0; onay sonrası izin verilen olay; kişisel alan enjeksiyonunda payload temiz; rıza geri alınca yeni olay0. GA4 DebugView ardından gerçek raporla karşılaştırın.

Kaynaklar: https://developers.google.com/analytics/devguides/collection/ga4/events ve https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber

## Phase2 — 15 Ekim 2026

Phase2 uygulaması: conversion.php + conversion.mjs + POST303GET eklendi. Dört form amacı gerçek özel kayıtta ayrılır. generate_lead ve partnership_submit yalnız başarılı yazım makbuzundan; tek kullanımlık flash/dedup, rıza/adaptör şartı ve kişisel alan allowlist’i test edildi. page_location sabit https://veniux.com/, page_referrer boş. Google etiketi/mülkü yok; aktif ölçüm değildir. Entegrasyon öncesi Enhanced Measurement otomatik form/pageview çift sayımı kapatılmalı, rıza olayı sağlayıcıya bağlanmalı, CSP ve aktarım değerlendirmesi yapılıp DebugView doğrulanmalıdır. Ortaklık başvurusu mevcut özel talep kuyruğuna girer, ayrı panel yok.

## 16 Ekim 2026 kontrolü

Dört formun kalıcı başarı/yenileme/yeniden POST testleri izole ortamda geçti. partnership_submit artık mevcut gerçek özel talep kaydından üretilir; tabloda geçen gelecekte ifadesi eski tasarımdır. download_request ve cta_click yalnız öneridir, etkin uygulanmış olay değildir. Google yükleyicisi ve ölçüm ID’si eklenmedi. Kampanya atfı aktif değildir; temiz sabit page_location kullanımı nedeniyle UTM dönüşüm ilişkilendirmesi ayrıca tasarlanıp DebugView ile doğrulanmalıdır.
