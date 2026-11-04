# Güvenlik düzeltmeleri — 12 Ekim 2026

Canlı kontrol: 12 Ekim 2026, 23:59 (Europe/Istanbul). Değişiklikler Plesk abonelik hesabıyla uygulandı; DNS ve sunucu geneli yetkileri bu hesaba ait değil.

| Bulgu | Son durum |
|---|---|
| B002 HSTS | Canlı 200 ve 404 yanıtlarda `max-age=31536000; includeSubDomains` doğrulandı. API altındaki tüm alt alan adları HTTPS kullanmalıdır. |
| B007 Permissions-Policy | Canlı 200 ve 404 yanıtlarda kamera, mikrofon, konum, ödeme ve USB kapalı. |
| B008 PHP sürümü | Apache katmanında kaldırıldı. `PHP/8.4.26` artık dönmüyor. Nginx tarafından eklenen `X-Powered-By: PleskLin` hâlâ mevcut; sunucu yöneticisi müdahalesi gerekiyor. |
| B017 security.txt | `https://api.veniux.com/.well-known/security.txt` HTTP 200, UTF-8 text/plain. Contact mevcut `https://veniux.com/#iletisim` formu; Expires 11 Ekim 2027. Bu tarihten önce yenilenmeli. Formdaki bildirimlerin takibi işletmeci sorumluluğunda. |
| B016 giriş sınırı | Canlı MySQL ortamında yeni oturumlarla altı yanlış POST: 401, 401, 401, 401, 401, 429; Retry-After: 60. Dakika bazlı IP sayacı; dağıtık saldırı veya tüm kimlik doğrulama senaryoları için tam güvence değildir. Sayaç ekleme/artırma tek upsert işlemine dönüştürüldü. |
| API keşfi yanlış pozitifleri | Bilinmeyen yollar giriş sayfası/200 yerine JSON/404 dönüyor. |
| B021/B022/B023 DNS | Uygulanmadı. Yetkili NS: alaric.ns.cloudflare.com, zainab.ns.cloudflare.com. Plesk DNS düzenlemek bu kayıtları yayımlamaz. Kullanıcı Cloudflare oturumu açamayacağını bildirdi. |
| B001 WAF | Abonelik ekranında ImunifyAV zararlı yazılım tarayıcısı görüldü; WAF etkinliği doğrulanamadı. WAF/ModSecurity etkinleştirme denetimi sunucu yöneticisinden istenmeli. |
| B013 HTTP/2 | Bu hesapta sunucu geneli HTTP/2 ayarı yok. Hosting yöneticisi ALPN/HTTP2 desteğini doğrulamalı ve gerekiyorsa etkinleştirmeli. HTTP/1.1 yanıtı tek başına tüm protokol desteğini kanıtlamaz. |
| B029–B034 portlar | Uygulanmadı. Ortak IP üzerindeki servislerin tümünü kapatmak diğer abonelikleri etkileyebilir. Yönetim portları VPN/IP izin listesiyle; gereksiz FTP ve posta servisleri servis sahibiyle değerlendirilerek sınırlandırılmalı. 8443 mevcut Plesk erişimidir. |

## Cloudflare erişimi sağlandığında

- SPF: gerçek gönderim sağlayıcılarının IP/include değerleri belirlenmeden kayıt yayımlanmasın. Alan adı hiçbir şekilde e-posta göndermiyorsa `v=spf1 -all`; bu koşul henüz doğrulanmadı. Mevcut tek SPF kaydı güncellenmeli, ikinci SPF kaydı eklenmemeli.
- DMARC: `_dmarc` TXT için ilk aşamada `v=DMARC1; p=none` ile izleme; rapor adresi doğrulandıktan sonra `rua` eklenmesi, tüm meşru gönderenlerin SPF/DKIM hizalaması doğrulandıktan sonra quarantine/reject. `p=none` sahte gönderimleri engellemez.
- DKIM: posta sağlayıcısının verdiği selector ve public key kaydı eklenmeli. SPF/DMARC ile birlikte gerçek posta gönderiminde doğrulanmalı.
- CAA: kullanılan ve yenilemede kullanılacak sertifika otoriteleri belirlendikten sonra issue/issuewild kayıtları eklenmeli. Eksik otorite izni sertifika yenilemeyi kesebilir.
- WAF için Cloudflare proxy kullanılacaksa lisans API'sine tarayıcı challenge uygulanmamalı; masaüstü istemcileri bunu çözemez. Kaynak sunucuya doğrudan erişim ayrıca kısıtlanmalı. REMOTE_ADDR sayacı proxy arkasında tek IP'yi sayabilir; yalnız güvenilir proxy zinciri üzerinden gerçek IP sunucu katmanında doğru iletilmeli.

## Hosting yöneticisine uygulanacak işler

1. Nginx'in eklediği PleskLin başlığı için Plesk panel.ini `[webserver] xPoweredByHeader = off` ayarını uygulayıp web yapılandırmasını yeniden üretin. Bu sunucu geneli işlemi abonelik hesabından yapılamadı.
2. Güncel sunucu yazılımları üzerinde HTTP/2 ve ALPN desteğini kontrol edin; Plesk'in sunucu geneli HTTP/2 yapılandırmasını kullanın.
3. api.veniux.com için ModSecurity/WAF durumunu doğrulayın. Lisans aktivasyonu/doğrulaması ve yönetici girişi üzerinden işlev kabulü yapın.
4. 21, 22, 25, 110, 143, 8443 portlarının servis sahiplerini belirleyin. Yönetim erişimini izinli IP/VPN ile sınırlandırın; kullanılan posta servislerini kesmeyin. Sonrasında dışarıdan port doğrulaması yapın.

Referanslar: [Plesk başlık kaldırma](https://support.plesk.com/hc/en-us/articles/12377509506583-How-to-remove-the-header-X-Powered-By-for-all-websites-hosted-in-Plesk), [Plesk HTTP/2](https://doc.plesk.com/en-US/onyx/administrator-guide/web-servers/apache-and-nginx-web-servers-linux/http2-support-in-plesk.76461/).

## Yerel doğrulama ve dağıtım farkları

PHP sözdizimi; izole SQLite güvenlik, lisans yaşam döngüsü ve web kurulum kabul testleri geçti. MySQL upsert canlı giriş testinde çalıştı; yüksek eşzamanlı MySQL yük testi yapılmadı. Canlı kontrol komutu `node api.veniux.com/bin/security-live-check.cjs` tam altı hatalı giriş dener; aynı IP'nin dakikalık giriş kotasını tüketir, rutin izleme için çalıştırılmamalı.

Canlıda yalnız mevcut public/.htaccess, public/index.php ve src/core.php içeriklerine hedefli değişiklikler yapıldı. Yerelde PHP başlık yardımcı dosyası ve `.user.ini` de eklendi; bu iki ek dosya canlıya yüklenmedi. Canlı başlıklar .htaccess üzerinden sağlanıyor. Tüm bulguların kapandığı veya önceki F notunun değiştiği iddia edilmez; tam tarama yeniden çalıştırılmadı.
