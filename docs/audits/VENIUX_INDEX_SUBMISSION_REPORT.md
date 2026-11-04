# Veniux indeksleme gönderim raporu

## Güncel yayın durumu — 18 Ekim 2026 01:37 (Türkiye)

Kullanıcı SEO düzenlemelerini canlıya alma onayı verdi. Altı site dosyası yedekli/özet doğrulamalı olarak yayımlandı; canlı denetim **380 PASS, 0 FAIL**, mevcut SEO aracı **16 sayfa / 0 hata / 0 uyarı** verdi. İçerik ve HEAD yönlendirme düzeltmeleri artık canlı. Ayrıntılar: `SEO_CONTENT_FIXES_2026-10-18.md`. Aşağıdaki önceki “yayın yapılmadı” notları önceki aşamayı anlatır. Google OAuth, Sitemap API ve Inspection erişimi hâlâ sağlanmış değil; aşağıdaki UNKNOWN indeks durumları değişmedi. IndexNow kodu/anahtarı bu SEO yayınında etkinleştirilmedi.

## 18 Ekim — mevcut tarayıcı oturumundan GSC kontrolü

Kullanıcı GSC'nin zaten kurulu olduğunu bildirdi. Yeniden kurulum yapılmadı. Mevcut Chrome hesabından Veniux Domain mülküne gidildiğinde “Maalesef bu mülke erişiminiz yok” görüldü ve mülk seçicisinde Veniux “Doğrulanmadı” grubundaydı. Bu yalnız mevcut oturum için erişim bulgusudur; başka hesaptaki kurulum hakkında kesin hüküm değildir. GSC'deki gerçek indekslememe nedeni bu oturumdan okunamadı. Google hesabı bilgileri rapora kaydedilmedi.

Site tarafında altı H1, üç sayfaya özgü dokuz SSS ve üç ana metin rehber bağlantısı yerelde iyileştirildi; 377 HTTP/SEO kontrolü geçti. Yayın yapılmadı. Dosyalar, sınırlar ve sonuçlar: `SEO_CONTENT_FIXES_2026-10-18.md`.

18 Ekim 2026, Europe/Istanbul. Bu çalışma önceki teknik SEO denetimini tekrarlamak yerine resmî gönderim/okuma altyapısını hazırlar. Proje Laravel değil PHP web sitesi olduğu için mevcut mimari korundu.

## Gerçek sonuç ve yetki sınırı

### 18 Ekim 2026 — OAuth başlatma talebi sonrası kontrol

Kullanıcı daha sonra OAuth istemcisini **henüz oluşturmadığını** doğruladı. Giriş akışı istemci oluşturulana kadar başlatılamaz. Beklenen işlem: yetkili kişinin Google Cloud'da Search Console API'yi etkinleştirmesi, OAuth izin ekranını ve Desktop app istemcisini oluşturması; indirilen JSON'un yalnız dosya yolunun yerel araca verilmesi. Kullanıcı/şifre/token istenmedi. Son güncel paket: **17 PASS, 0 FAIL**; gerçek Google OAuth/Sitemap/Inspection işlemleri hâlâ yapılmadı.

Kullanıcı bu turda interaktif Google OAuth ve yetkilendirme sonrası API işlemlerine izin verdi. Ancak `VENIUX_GOOGLE_OAUTH_FILE` tanımlı değil; yerel hazırlık klasörü ve Downloads'taki olağan OAuth istemci JSON adları kontrol edildiğinde dosya bulunamadı. Kimlik bilgisi içeriği okunmadı/yazdırılmadı. Google'ın gerçek Desktop OAuth istemcisi olmadan geçerli giriş URL'si üretilemez; uydurma istemciyle giriş ekranı açılmadı. Kullanıcıdan yalnız mevcut dosyanın tam yolu istendi. Bu, Google'ın yetki reddi değil, **OAuth istemci yapılandırması eksik** durumudur. Google hesabına erişilmedi; 16 URL yeniden sorgulanmış gibi gösterilmedi.

Sitemap akışı bu talebe göre güncellendi: önce Google'daki kaydı GET ile kontrol eder, mevcut kaydı tekrar göndermez; yalnız doğrulanmış 404 yokluğunda ve backoff uygunsa PUT yapar. Kaydın son gönderim/indirilme tarihi, bekleme, hata ve uyarı alanları rapora aktarılır. [Resmî Sitemaps GET](https://developers.google.com/webmaster-tools/v1/sitemaps/get). Mülk kontrolü mevcut Domain veya URL-prefix property erişimini doğrular; yeni DNS doğrulaması yapmaz.

Manuel indeksleme önceliği yalnız gerçek NOT_INDEXED/UNKNOWN_TO_GOOGLE sonuçları geldikten sonra hesaplanır. Önce ana sayfa ve ana ürün sayfaları, sonra rehberler; canonical farkı veya robots/noindex/fetch hatası varsa önce bunların çözümü önerilir. UNKNOWN satırları manuel indeksleme adayı diye sunulmaz. Bu ekler de yalnız yereldir; canlıya kod yayımlanmadı, üretim verisine dokunulmadı.

Kullanıcı alan adının arkadaşına ait olduğunu ve erişimi bulunmadığını belirtti. Bu nedenle Google OAuth başlatılmadı; Search Console mülk yetkisi veya DNS doğrulaması atlanmadı. Sitemap API gönderimi ve URL Inspection sorguları **BLOCKED — hesap sahibinin yetkisi bekleniyor**. Aşağıdaki 16 URL için Google tarafından bilinme/indekslenme/bekleme durumu şu anda belirlenemez. Kamuya açık 200 yanıtı Google indeks verisi değildir.

Yerel XML mevcut `siteSitemap` kodundan yeniden üretildi ve canlı XML ile **hem URL kümesi hem SHA-256 özeti birebir eşleşti**. Mevcut 16 public canonical URL korundu; hesap/giriş/kayıt/özel indirme eklenmedi. Yasal dört URL mevcut public politika gereği listede kalır; trafik odaklı hedeflerin yerine geçmez. Sitemap/robots veya tasarım gereksiz yere yeniden oluşturulmadı.

IndexNow başlangıç içerik özetleri ve public proof dosyası yalnız yerelde hazırlandı. Anahtar/route canlıya yayımlanmadı; IndexNow'a gönderim yapılmadı. İlk mevcut sayfalar değişmiş sayılmadığından başlangıçta bildirim listesi boştur. Anahtarın public erişimi ve sahibin yayın onayı olmadan etkinleşmez. IndexNow Google indekslemesini doğrudan tetiklemez. [IndexNow protokolü](https://www.indexnow.org/documentation).

## Uygulanan sistem

- Google Desktop OAuth: loopback callback, state/Host/path kontrolü, PKCE S256, zaman aşımı; tokenlar yalnız bellekte. Kimlik bilgileri kaynakta/raporda değil, yetkili kişinin belirteceği dosyadan okunur.
- İzinli Veniux property üzerinde sitemap PUT; önce hesap erişim seviyesi kontrolü. API kabulü yalnız gönderim kabulüdür. [Resmî sitemap metodu](https://developers.google.com/webmaster-tools/v1/sitemaps/submit).
- URL Inspection ile kayıtlı verdict, coverage nedeni, son tarama, robots/fetch/indexing durumları ve Google/user canonical okunur. İndeksleme isteği değildir. Veri yoksa UNKNOWN. [Resmî URL Inspection](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect).
- Aynı sitemap kabul edildikten sonra değişmedikçe tekrar gönderilmez; hatalı/yarım gönderimde 24 saat backoff; URL Inspection için 24 saat önbellek. Paralel çalışma kilidi ve atomik durum yazımı vardır.
- IndexNow yalnız değişen ve hâlâ canonical olan public URL'leri seçer. CSRF/nonce değişimi tetiklemez, aynı kabul edilen içerik yeniden gönderilmez; içerik geri alındığında da değişiklik tanınır. 202 sahiplik kontrolü bekliyor olarak tutulur.
- Günlük cron/otomasyon kurulmadı. Gerçek kullanıcı/Googlebot taklidi, ücretli servis veya Google Indexing API kullanılmadı. Üretim veritabanı, hesaplar, tasarım ve indirme izinleri değiştirilmedi.

## Dosya bazında değişiklikler

| Dosya | İşlem |
|---|---|
| `tools/index-submission/core.cjs` | Canonical allowlist, değişiklik/hash seçimi, backoff, resmî API istekleri ve gerçek yanıt sınıflandırması |
| `tools/index-submission/oauth.cjs` | Güvenli interaktif Desktop OAuth; kalıcı token yok |
| `tools/index-submission/run.cjs` | Yerel sitemap üretimi/live karşılaştırma, hazırlık, tek sefer baseline, sahiplik anahtarı, kontrollü gönderim ve rapor |
| `tools/index-submission/submission.test.cjs` | Sentetik API ve yerel PHP testleri |
| `tools/index-submission/README.md` | Alan adı sahibi için kurulum/yetki/yayın ve kullanım rehberi |
| `website-php/index.php` | Varsayılan kapalı, env anahtarıyla açılan exact IndexNow proof GET/HEAD rotası; henüz canlı değil |
| `docs/audits/VENIUX_INDEX_SUBMISSION_REPORT.md` | Bu rapor ve gerçek durum tablosu |

`.local/index-submission/` altında XML'ler, içerik snapshot'ı, gönderim state'i ve yayımlanmayan proof dosyası bulunur; `.gitignore` kapsamındadır, web document root dışındadır. İş verisi değildir. Önceki görevlerin yerel değişiklikleri yayımlanmadı.

## Çalıştırılan testler

| Kontrol | Sonuç | Sınır |
|---|---|---|
| Yeni gönderim paketinin 12 testi | **12 PASS, 0 FAIL** | Google/IndexNow yanıtları mock; gerçek dış gönderim değil |
| OAuth loopback tam akışı | PASS | Sentetik istemci/code/token; PKCE doğrulandı, gerçek Google hesabı yok |
| PHP IndexNow exact proof rotası | PASS | GET/HEAD, POST 405, env kapalıyken/yanlış yolda 404; sitemap'e girmez |
| İndeksleme politikası + iki XML DOM ayrıştırması | **18 PASS** | Mevcut test yeniden kullanıldı |
| Mevcut SEO/form koruma testi | **13 PASS** | Geçersiz girdiler/CSRF reddi; mail/kayıt gönderilmedi |
| CLI `prepare`, `baseline`, `init-indexnow` | PASS | 16 canlı canonical; XML özetleri aynı; Google NOT_AUTHORIZED, IndexNow NOT_SENT |
| PHP ve CLI sözdizimi | PASS | Mevcut PHP 8.0 ve Node 24 |

İlk Node test koşusu alt süreç izni nedeniyle EPERM verdi; test izolasyonu kapatılarak gerçek testler çalıştırıldı. Yerel PHP alt süreçlerini gerektiren testler uygun çalıştırma izniyle yeniden 12/12 geçti. Bu ortam hatası ürün test başarısı olarak sayılmadı.

## Kalan işler — alan adı sahibiyle

1. Arkadaşın mevcut doğrulanmış Search Console mülkünden sitemap'i manuel gönderebilir veya API'yi çalıştıracak Google hesabına Tam kullanıcı yetkisi verebilir. Domain'in sana devredilmesi gerekmez; sahibi onay vermelidir.
2. API kullanılacaksa sahibi Google Cloud'da Search Console API ve Desktop OAuth istemcisi hazırlamalı; JSON dosya yoluyla yerel araca verilmeli. Şifre/anahtar sohbete yazılmamalı. Hesap sahibi OAuth consent ekranını onaylamalı.
3. Yetki geldikten sonra README'deki `google --authorize` çalıştırılır; gerçek sitemap kabulü ve 16 Inspection yanıtı bu tablodaki UNKNOWN satırlarının yerini alır. Yetki verilmeden nedenler uydurulamaz.
4. IndexNow rotası/hosting env anahtarı ancak **ayrı yayın onayıyla** dağıtılır; public proof GET 200/eşleşen içerik doğrulanır. Sonraki gerçek içerik değişikliklerinde açık komutla bildirim yapılır. Bugün yayın yapılmadı.
5. Yerel state kaybolursa önceki bildirimlerin deduplikasyon geçmişi de kaybolur; bu küçük dosyaları koruyun. Kilit dosyasını ancak kayıtlı işlemin durduğu doğrulanınca kaldırın.

Google entegrasyonunda dışa gönderim ve gerçek hesap testi **BLOCKED**, IndexNow public sahiplik ve gerçek bildirim testi **BLOCKED**. Bunlar yerel testlerin başarı sayısına dahil edilmedi. Ayrıntılı komutlar: `tools/index-submission/README.md`.


<!-- submission-results:start -->
Son hazırlık: 2026-10-17T21:33:19.095Z. Kaynak: canlı sitemap ve canonical HTML; Google indeks verisi yalnız API yanıtı varsa gösterilir.

Yerel/canlı URL kümesi: AYNI. Yerel XML/live XML SHA-256: `0bc59ba35730576c1645c0e3556eeb3487837ce0a276fcc83177dd5036fbd010` / `0bc59ba35730576c1645c0e3556eeb3487837ce0a276fcc83177dd5036fbd010`.

Google sitemap son denemesi: BLOCKED: yetki yok, gönderilmedi. HTTP kabulü indeks başarısı değildir.

IndexNow: NOT SENT: sahiplik dosyası yayımlanmadı. Baseline: mevcut. Bildirilmeyi bekleyen değişen canonical URL: 0. Google indekslemesini doğrudan tetiklemez.

| URL | Google indeks durumu | Neden / API kapsam durumu | Sorgu zamanı (UTC) |
|---|---|---|---|
| https://veniux.com/ | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/barkodlu-stok-takibi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/cerez-politikasi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/depo-yonetimi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/el-terminali-depo-yonetimi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/fiyatlandirma | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/gizlilik-politikasi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/guncelleme-notlari | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/kullanim-kosullari | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/kvkk-aydinlatma | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/lot-miat-takibi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/program-indir | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/son-kullanma-tarihi-takibi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/stok-yonetimi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/sunucu-kurulumu | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |
| https://veniux.com/surum-arsivi | UNKNOWN | Search Console hesabı/yetkisi yok; sorgulanmadı | — |

UNKNOWN sonuçları indekslenmedi veya beklemede olarak sayılmadı. Google'ın bilip bilmediği de erişim olmadan belirlenemez.


Mülk erişim kontrolü: YAPILMADI — OAuth istemcisi/yetkisi bekleniyor. Bu kontrol yeni DNS sahipliği doğrulaması oluşturmaz.

Google sitemap kaydı: SORGULANMADI veya kayıt alınamadı; yokluğu varsayılmaz.

Manuel indeksleme adayları (yalnız gerçek API sonuçlarına göre):
Gerçek indeks verisi olmadan aday listesi çıkarılmadı; bilinmeyen URL’ler indekslenmedi sayılmadı.
<!-- submission-results:end -->
