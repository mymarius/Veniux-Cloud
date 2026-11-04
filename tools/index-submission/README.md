# Veniux resmî indeksleme gönderim aracı

Mevcut PHP siteyi değiştirmeden çalışan Node 24 CLI; Laravel gerektirmez. Node yerleşik modülleri ve mevcut PHP/DOM kullanılır. Kaynakta Google kimlik bilgisi yoktur. Public web endpointinden OAuth/gönderim çalıştırılmaz; CLI dosyaları web document root dışındadır.

## Bugünkü durum ve sahip yetkisi

18 Ekim 2026: Kullanıcı alan adının arkadaşına ait olduğunu, Domain/Search Console erişimi olmadığını belirtti. Yetki varsayılmadı. Google OAuth başlatılmadı; sitemap API ve URL Inspection API çalıştırılmadı. IndexNow doğrulaması yayımlanmadı ve bildirim gönderilmedi. Teknik hazırlığın başarılı olması dış entegrasyonun aktif olduğu anlamına gelmez.

Alan adı sahibi şu yollardan birini seçebilir:

1. En kısa yol: kendi doğrulanmış Search Console mülkünde sitemap'i manuel gönderir; URL Denetimi sonuçlarını paylaşır.
2. API yolu: mevcut doğrulanmış mülkte kullanılacak Google hesabına **Tam kullanıcı** veya sahip yetkisi verir; hesabın sahibi aşağıdaki OAuth akışını onaylar. Arkadaşın DNS şifresini paylaşması gerekmez.
3. Mülk henüz doğrulanmamışsa sahibi önce Google'ın verdiği gerçek TXT kaydıyla doğrular. Bu araç mülk sahipliği oluşturmaz veya doğrulamayı atlamaz.

## Komutlar

Proje kökünden:

```powershell
# İsteğe bağlı: farklı mevcut PHP yolu
$env:VENIUX_PHP='C:/xampp/php/php.exe'
node tools/index-submission/run.cjs prepare

# İlk dağıtım öncesi mevcut canlı içerik referansı, yalnız bir kez:
node tools/index-submission/run.cjs baseline

# Public proof dosyasını yerelde hazırlar; yüklemez:
node tools/index-submission/run.cjs init-indexnow

# Ağ yerine sentetik API yanıtlarıyla testler (gerçek Google isteği yok):
node --test --test-isolation=none tools/index-submission/submission.test.cjs
```

`prepare` mevcut PHP sitemap kodunu CLI ile çalıştırır, DOMDocument ile XML'i ayrıştırır ve canlı sitemap ile karşılaştırır. Public canonical HTML gövdelerinden içerik özetleri çıkarır. Form içindeki CSRF değerleri ve nonce değişimleri bildirim nedeni sayılmaz. İş veritabanına bağlanmaz; mail kapalıdır. Her hazırlık 1 sitemap ve 16 gerçek sayfa isteği yapar; sahte Googlebot/analitik/ziyaretçi döngüsü yoktur. Bu komutu günlük gereksiz tarama işi olarak zamanlamayın; içerik yayını sonrasında veya açık kontrol ihtiyacında çalıştırın.

`.local/index-submission/` içindeki state, snapshot ve XML'ler kaynak deposundan dışlanır, webroot altında değildir. Yeni başlangıç kaydı mevcutsa sessizce sıfırlanmaz. Böylece önceki değişiklikler kaybolmaz. İlk başlangıç kaydı bildirim üretmez.

## Google OAuth — ancak hesap sahibi izin verdiğinde

Google Cloud'da Search Console API'yi etkinleştirin. OAuth izin ekranını yapılandırın; test modundaysa kullanılacak hesabı test kullanıcısı olarak ekleyin. **Masaüstü uygulaması** OAuth istemcisi oluşturun. Ücretli servis/billing açmayın. JSON dosyasını webroot/kaynak dışına veya gitignore kapsamındaki `.local` altına kaydedin; sohbete yapıştırmayın.

```powershell
$env:VENIUX_GOOGLE_OAUTH_FILE='C:/secure-location/google-desktop-client.json'
$env:VENIUX_GSC_PROPERTY='sc-domain:veniux.com'
# Mevcut doğrulanmış URL-prefix mülküyse alternatif: https://veniux.com/
node tools/index-submission/run.cjs google --authorize
```

Komut sahibin onaylayacağı Google URL'sini verir; sistem tarayıcısında açın. Dönen callback yalnız rastgele portta `127.0.0.1` üzerinde dinlenir; state, doğru Host/path, PKCE S256 ve 10 dakika zaman aşımı uygulanır. OAuth client dosyasındaki endpoint değerleri çalıştırılmaz; Google endpointleri sabittir. Access token yalnız bu işlemin belleğinde tutulur; refresh token alınmaz/saklanmaz, raporlara token/kod/secret yazılmaz. Katılımsız OAuth yenilemesi bu sürümün kapsamı değildir; günlük cron kurulmaz.

Sitemap PUT işlemi `webmasters` yetkisini gerektirir. Bu scope geniştir; araç yalnız izin verilen iki Veniux property değerinde site izin kontrolü, sitemap PUT ve URL Inspection yapar. Yetki eksik/403 ise korumaları aşmaya çalışmaz. Hesap sahibinin consent ekranındaki yetkiyi kabul etmesi gerekir.

- Google komutu her yetkili çalıştırmada önce resmî Sitemaps GET ile kaydı okur. Zaten kayıtlıysa yerel geçmiş olmasa bile yeniden göndermez; lastSubmitted/lastDownloaded/isPending/errors/warnings alanlarını kaydeder. Yalnız 404 ile yokluğu doğrulanırsa PUT değerlendirir; 401/403/429/5xx veya bozuk kayıt asla yok sayılmaz. Son aynı gönderim denemesinden 24 saat geçmeden yeniden PUT yapılmaz. Bu akış Google'dan mevcut sitemap'i tekrar göndermesini istemek için değil, eksik kaydı tamamlamak içindir.
- Başarısız veya yarım kalan aynı gönderimde 24 saat tekrar deneme engeli vardır. Sürekli ağ yeniden denemesi yoktur.
- URL Inspection kayıtlı Google indeks bilgisini okur; canlı tarama veya indeksleme isteği yapmaz. URL bazında 24 saatlik önbellek kullanılır. Hata/eksik yanıt UNKNOWN kalır; ham coverage/verdict/canonical/son tarama alanları korunur. Google'ın verdiği tarih güncel bir canlı tarama olarak sunulmaz.
- PASS verdict INDEXED olarak raporlanır. NEUTRAL ve Google coverage açıklaması ayrı saklanır; diğer belirsiz durumlar UNRESOLVED/UNKNOWN olur. UNKNOWN, “beklemede” veya “indekslenmedi” sayılmaz.
- Kilit, paralel çift gönderimi engeller; durum her önemli adımda atomik yazılır. İşlem zorla kesilmişse `run.lock` silmeden önce içindeki PID'nin artık çalışmadığını doğrulayın. Ağ kabulünden hemen sonra işlem çökerse kesin bir “exactly once” garantisi yoktur; günlük backoff aynı anda tekrarı sınırlar.

## IndexNow — yalnız sahip onaylı yayın sonrasında

Başlangıç kaydı ve anahtar üretimi yerelde tamamlanmıştır. `.local/index-submission/indexnow-key.json` public sahiplik anahtarını, `indexnow-public/<key>.txt` ise yayımlanacak kanıtı içerir. Bu anahtar OAuth secret değildir; protokol gereği public olacaktır.

Mevcut `.htaccess` bütün root yollarını PHP'ye yönlendirdiği için dosyayı yüklemek tek başına yeterli olmayabilir. Hazırlanan `website-php/index.php` rotasını **önce yayın onayı alarak** dağıtın ve hosting ortamına `VENIUX_INDEXNOW_KEY` değerini aynı 64 haneli anahtar olarak ekleyin. Exact `/<key>.txt` GET/HEAD yolu etkinleşir; env yokken kapalıdır, sitemap'e girmez ve diğer dosyaları açmaz. PHP route yönteminde fiziksel `.txt` yüklemek gerekmez. Sadece bu dar değişikliği yayınlayın; önceki başka görevlerin yerel değişikliklerini otomatik paketlemeyin.

Sahip onaylı ürün içeriği yayını sonrasında:

```powershell
node tools/index-submission/run.cjs indexnow
```

Araç güncel canonical sayfaları kontrol eder, yalnız başlangıç/son kabul kaydından farklı içerik özetlerini seçer. Değişiklik yoksa bildirim yoktur. Önce public anahtar içeriğinin eşleşmesini doğrular; sonra sabit `https://api.indexnow.org/indexnow` endpointine gönderir. 200 bildirim kabulüdür; 202 anahtar doğrulaması bekliyor demektir, indeksleme değildir. 202'de URL özetleri kabul edilmiş sayılmaz; 24 saat sonra açık komutla tekrar denenebilir. Silinen/redirect edilen URL bildirimleri bu aracın kapsamı dışındadır; yalnız sitemap'teki geçerli canonical değişiklikleri gönderilir.

IndexNow destekleyen motorlara bildirim içindir; **Google indekslemesini doğrudan tetiklemez**. Bu araç Google Indexing API, sitemap ping, üçüncü taraf indeksleme servisi veya otomatik Google “request indexing” yöntemi kullanmaz.

## Çıktılar ve kaynaklar

`docs/audits/VENIUX_INDEX_SUBMISSION_REPORT.md` içindeki işaretli sonuç bölümü `prepare`/gönderim sonrasında gerçek mevcut state ile güncellenir. Google rapor satırları hesap erişimi olmadan doldurulmaz. Ayrıntılı URL sonuçları `.local/index-submission/state.json` altında korunur; Google verilerinin güncelliği satırdaki sorgu zamanıdır.

- [Google sitemap submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)
- [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- [Google Desktop OAuth/PKCE](https://developers.google.com/identity/protocols/oauth2/native-app)
- [IndexNow protokolü](https://www.indexnow.org/documentation)
