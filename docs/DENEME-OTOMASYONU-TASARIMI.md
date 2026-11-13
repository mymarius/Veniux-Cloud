# Kendi kendine açılan 14 günlük deneme: tasarım

Bugün: ziyaretçi demo ister, siz elle üç iş yaparsınız: (1) api.veniux.com panelinde `VNX-` lisansı üretmek, (2) Plesk'te demo hesap betiğini çalıştırmak, (3) e-posta, şifre ve anahtarı güvenli kanaldan iletmek. Demo hesap ve örnek veri hazırdır (`backend/src/services/demoAccount.js`); eksik olan elle işler.

## Hedef akış
1. Ziyaretçi sitede e-posta ve işletme adı girer ("Ücretsiz deneyin").
2. Sunucu doğrulama bağlantısı gönderir (kayıt oluşmaz, yalnız bekleyen istek).
3. Bağlantıya tıklayınca: demo hesap açılır, merkezi lisans üretilir, ziyaretçi bir sayfada şifresini **yalnız bir kez** görür (e-postayla düz şifre gönderilmez).
4. Ziyaretçi `/activate` ve girişe yönlendirilir; 14 gün sonra giriş kapanır, 30 gün sonra işletme otomatik silinir (temizlik işi hazır).

## Güvenlik gereksinimleri (zorunlu)
- **Kötüye kullanım:** IP başına ve e-posta alanı başına günlük sınır; tek kullanımlık, süreli doğrulama bağlantısı; tek e-posta bir kez; tek kullanımlık e-posta alan adı listesi engeli; CAPTCHA kararı sizin (gizlilik ve erişilebilirlik etkisi var).
- **Merkezi lisans:** Anahtarı üretmek için app sunucusunun api.veniux.com'a hizmet kimlik bilgisiyle bağlanması gerekir. Bu, yönetici panel girişiyle aynı yetkidir; ayrı, yalnız "deneme lisansı üret" yetkili ve günlük kotalı bir kimlik tanımlanmalı. Hizmet anahtarı sunucuda `cloud-private/` altında tutulur, depoya girmez.
- **Kota:** Günlük en fazla N deneme (örn. 20) ve toplam açık deneme üst sınırı; aşılınca "bekleme listesi" mesajı.
- **KVKK:** Form metni ve aydınlatma bağlantısı; e-posta yalnız deneme için kullanılır, pazarlama onayı ayrı kutu.
- **E-posta gönderimi:** app.veniux.com'da Gmail üzerinden SMTP tanımlı. Kurumsal adresle (destek@veniux.com, Plesk'te hazır) göndermek için Cloudflare'de MX/SPF/DMARC kayıtları ve sunucu ayarının değiştirilmesi gerekir.

## Yapılacaklar (sırayla)
1. Kurumsal e-posta (Cloudflare DNS kayıtları) ve SMTP'nin destek@veniux.com'a taşınması.
2. api.veniux.com'da kotalı "deneme lisansı" hizmet kimliği ve uç noktası (merkezi lisans kodu; ayrı sürüm).
3. App tarafında `/api/trial/request` ve `/api/trial/confirm` + bekleyen istek tablosu (şema 020).
4. Site formu, onay sayfası ve metinler.
5. Hız sınırı, kötüye kullanım testleri, uçtan uca deneme (gerçek e-posta ile).

## Karar sorularınız
- CAPTCHA kullanılsın mı (hangi sağlayıcı)?
- Deneme paketi İşletme mi (bugünkü demo) yoksa daha kısıtlı mı?
- Günlük kota kaç olsun?

Bu iş, kurumsal e-posta ve SMTP hazır olmadan başlatılmamalıdır; hazır olunca yaklaşık iki ayrı yayın (merkezi lisans ve app) gerekir.

## Uygulama (13 Kasım 2026)
Kararlar: CAPTCHA yok (yerine e-posta doğrulaması, görünmez tuzak alan, IP başına saatte 5 istek, e-posta başına 10 dakikada 1 gönderim, tek kullanımlık alan adı engeli). Paket İşletme (`BUSINESS_ANNUAL`), 14 gün, 2 cihaz. Günde en fazla 20 deneme, aynı anda en fazla 100 açık deneme.

- Lisans merkezi: `POST /v1/trial` (`api.veniux.com/src/trial.php`). Veri klasöründe `trial-service.sha256` dosyası yoksa uç kapalıdır (404). Kabul testi: `node api.veniux.com/bin/trial-acceptance.cjs`.
- Bulut uygulaması: `/api/trial/status|request|confirm` (`backend/src/services/trialSignup.js`). Bekleyen istek tablosu yok: doğrulama bağlantısı 24 saat geçerli, imzalı bir belirteçtir; aynı e-postayla ikinci hesap açılamadığı için tek kullanımlıktır. `VENIUX_TRIAL_SERVICE_KEY` tanımlı değilse kapalıdır.
- Sayfalar: `app.veniux.com/deneme` ve `/deneme/onay#t=…`. Şifre ve `VNX-` anahtarı yalnız onay sayfasında bir kez gösterilir.

Canlıya alma: (1) `api.veniux.com` dosyalarını yükle ve veri klasörüne servis anahtarının SHA-256 özetini `trial-service.sha256` olarak yaz; (2) aynı anahtarı `cloud-private/install.env` içine `VENIUX_TRIAL_SERVICE_KEY=` olarak ekle ve bulut uygulamasını güncelle; (3) siteyi yayınla. Onay e-postası şimdilik app'teki Gmail SMTP ile gider.
