# Veniux müşteri deneyimi ve ilk kurulum

18 Ekim 2026 · **Geliştirme kaynağında uygulandı; canlıya ve müşterideki EXE/APK paketlerine yayımlanmadı.** Mevcut PHP site, React, Node API, Electron/standart NSIS ve Java Android mimarisi korundu. Bu rapor tam otomatik cihaz kabulü veya bütün hedeflerde sıfır yapılandırma başarısı iddia etmez.

## 1. Mevcut müşteri deneyimi sorunları

İlgili kurulum, lisans, kayıt, ayar, rol/depo kapsamı, ürün aktarımı, POS, WMS, barkod, baskı, Android eşleştirme ve yedekleme kaynakları incelendi. Önceki `VENIUX_HARDWARE_TEST_REPORT.md`, eczane kaldırma kararı ve standart NSIS'e dönüş korundu. Bütün depo geçmişinin veya üretim veritabanının denetlendiği iddia edilmez.

| Aşama | Gerçek mevcut durum / teknik bilgi gerektiren nokta |
|---|---|
| Windows kurulum | Standart NSIS mevcut. Yerel sunucu otomasyonu veya HTTPS sunucu seçimi var. Özel görsel kurulum tekrar eklenmedi. Ayrı sunucu seçimi adres ve geçerli API hazırlığı gerektiriyor. |
| Hesap/lisans | Hesap açma, merkezi lisans ve kullanıcı/depo kotaları var; rehbere girilmesi lisans verilmesi değildir. Bulutta yönetici daveti gerekebilir. |
| İlk işletme | Şirket, kullanıcı, depo ve aktarım ayrı ekranlardaydı; nereden başlanacağını gösteren ortak, devam edilebilir rehber yoktu. |
| Kişiselleştirme | Menü lisans/role göre şekilleniyor; iş profiline göre öncelik ve görünürlük tercihi yoktu. |
| Şirket/hesap verisi | Eksik bazı alanlarda örnek şirket, telefon, vergi/adres ve varsayımsal son giriş kullanılabiliyordu. Bu, müşteriye gerçek kayıt gibi görünebilir. |
| Aktarım | Yedi katalog alanında worker ile Excel/CSV çözümleme, önizleme, commit onayı, idempotent batch ve mükerrer barkod koruması mevcut. Stok miktarı/lot/SKT'yi doğrudan yazan eski akış kapalı; mal kabul ayrı. |
| Donanım | HID, Web Serial/yerel köprü, kamera ve Windows yazıcı listesi/baskı var; marka/SDK algılama ve ESC/POS adaptörü varmış gibi gösterilmemeli. Seri ayarlar teknik uzmanlık gerektirebilir. |
| Android | Java Activity + paketli React/WebView, QR ile güvenli eşleştirme veya bulut hedefi var. Genel tarayıcıdaki mobil görünüm native köprü/sertifika testi değildir. |
| Yedek | Şifreli sistem yedeği ve doğrulamalı geri yükleme var. Ortak veri yedeği platform yöneticisine özel; firma adminine açılması veri izolasyonunu bozar. |
| Çevrimdışı | Yerel sunucu ve bekleyen satış durum doğrulaması var. Genel cihazlar arası offline outbox/senkronizasyon veya internet/lisans kesintisinde sınırsız satış yok. |

## 2. Yapılan geliştirmeler

### On adımlı `/setup` rehberi

Mevcut tasarım sınıfları, logo ve mavi/turuncu vurgu korunarak duyarlı kurulum sayfası eklendi. Adımlar serbestçe açılabilir; inceleme veya erteleme ayrı kaydedilir. Yeni lisanslı, ürünsüz işletmenin adminine dashboard'dan ilk kurulum önerilir. Ürünü olan eski işletme zorla sıfırlanmaz veya yeniden başlatılmaz. “Kaydet ve şimdilik kontrol paneline dön” ile ilk açılış döngüsüne girmeden çıkılabilir.

İlerleme sunucuda mevcut `workspace_collections` içinde, tenant kapsamlı `settings/customer_setup` kaydıdır; yeni tablo/migration yok. Şema yalnız version/profile/modules/currentStep/steps/completed içerir. UI veya HTTP gövdesinden tenant/rol/lisans/SQL/şifre kabul edilmez. Revision kontrolü eşzamanlı iki ekranın birbirini ezmesini önler; MySQL yolunda tenant satır kilidi hazırlanmıştır, gerçek MySQL koşusu yapılmamıştır. İnceleme/erteleme bir fiziksel testin PASS olduğu anlamına gelmez.

### İşletme profilleri ve kontrol paneli

- Market, depo, eczane-genel stok, medikal-genel stok, genel perakende profilleri eklendi.
- Eczane/medikal seçimi kaldırılmış ilaç, hasta, reçete, MEDULA/İTS veya ÜTS işlemlerini açmaz; bunlar genel ürün/lot/depo görünüm tercihleridir.
- Ürün/stok, depo, kasa/etiket ve CRM menüleri seçilebilir. Gizlemek veri silmez, route veya yetki kontrolünü değiştirmez; açık sayfa ve Ayarlar/Kurulum erişilebilir kalır.
- Market profilinde kasa öne çıkar; depo profilinde kabul/sayım hızlı bağlantıları verilir. Dashboard'da kurulum durumu ve profil hızlı işlemleri, mobil ana ekranda modül tercihleri kullanılır.
- Mevcut günlük satış, kritik stok, uyarı ve hareket panelleri korundu; erişilemeyen veriden yeni sahte KPI üretilmedi. Cihaz bağlantı durumu doğrulanamadığında bağlı denmedi.

### Aktarım ve anlaşılır hatalar

Türkçe/İngilizce barkod/EAN/GTIN ve temel alan başlıkları için otomatik sütun eşleştirmesi geliştirildi. Birden fazla aday varsa rastgele sütun seçmek yerine kullanıcıya bırakılır. Baştaki sıfırlar metin olarak korunur; daha önce kaybolmuş sıfırlar uydurulmaz.

Dosyada stok, lot veya SKT sütunu görülürse bunların **ürün kataloğuna aktarılmayacağı açıkça gösterilir** ve onaylı mal kabul akışına bağlantı sunulur. Yedi katalog alanındaki mevcut önizleme/commit/idempotency korunmuştur. Stok-lot-SKT'nin aynı dosyadan toplu mal kabulü **bu çalışmada tamamlanmış değildir**; mevcut güvenli iş akışı bozulmadan ayrı geliştirme gerekir.

Yeni rehberde oturum/yetki/çakışma/büyük dosya/bakım durumları Türkçe eylem önerileriyle gösterilir. Desktop ayrı sunucu ilk açılış hatası artık ham IPC mesajı veya sistem yolu göstermek yerine adres/bağlantı kontrolü ve otomatik yerel kurulum seçeneğini açıklar. Eksik şirket/hesap verileri ve bilinmeyen son giriş uydurulmaz; eksik rol frontend fallback'inde admin varsayılmaz. Şirket okuma/güncellemede tenant kapsamı yoksa işletme 1'e düşmek yerine işlem reddedilir.

### Donanım rehberi

- Odaklı HID denemesi yalnız metin alır; satış, ürün veya stok hareketi oluşturmaz. Elle giriş ile fiziksel okuyucu ayırt edilemediği belirtilir.
- Web Serial desteği bulunmayan ortam açıkça belirtilir; mevcut seri/köprü ayarlarına yönlendirilir. Üretici SDK veya otomatik sürücü kurulumu vaat edilmez.
- Electron'da mevcut `listLabelPrinters` IPC'siyle Windows yazıcıları listelenebilir. Listeleme fiziksel bağlantı/başarılı baskı değildir. Web/Android'de doğrudan Windows algılama sunulmaz.
- 58/80 mm fiş ve etiket ekranlarına, mevcut Android QR eşleştirme ekranına bağlantı verilir. QR köprü/pin/oturum güvenliği korunur.
- Platform adminine mevcut yedek paneli gömülür; işletme adminine ortak DB yedeği yetkisi verilmez. Bu kullanıcıya yedek sorumlusuyla planı doğrulaması gerektiği açıkça anlatılır.

## 3. Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
| `backend/src/services/customerSetupService.js` | Yeni tenant kapsamlı, doğrulamalı, optimistic revision kontrollü rehber metadata servisi |
| `backend/src/routes/settingsRoutes.js` | JWT'li GET ve admin-only PUT `/onboarding`; mevcut lisans/rol middleware zinciri korundu |
| `backend/src/controllers/settingsController.js` | Uydurma şirket/telefon/giriş zamanı yerine gerçek/boş veri; eksik tenant için güvenli ret |
| `backend/tests/customerSetup.test.js` | Dokuz entegrasyon testi; resume, erteleme, eşzamanlılık, izolasyon, yetki, tamamlanma ve gerçek sentetik satış verisinin korunması |
| `frontend/src/pages/CustomerSetup.jsx`, `CustomerSetup.css` | Rehber, donanım incelemesi, mevcut ekranların gömülmesi, duyarlı ve markayla uyumlu görünüm |
| `frontend/src/lib/customerExperience.mjs`, `customerExperience.test.mjs` | Profil, menü/hızlı işlem, güvenli hata ve otomatik sütun eşleştirme kuralları/testleri |
| `frontend/src/hooks/useCustomerSetup.js` | Sunucu kaydı, değişiklik yenilemesi, geç kalan/başka tenant'a ait yanıtı uygulamama |
| `frontend/src/App.jsx` | Lisans ve JWT korumalı `/setup` route |
| `frontend/src/components/Layout.jsx` | Kurulum bağlantısı, ürünsüz ilk işletme yönlendirmesi, tercihli menü ve dashboard durum/hızlı işlemleri |
| `frontend/src/components/ProductBulkImport.jsx` | Belirsiz başlıkları elle eşleştirme, mal kabul sütunu uyarısı, güvenli yükleme hata metni |
| `frontend/src/components/DesktopSetup.jsx` | Teknik olmayan ayrı sunucu açıklaması ve güvenli hata/yeniden deneme |
| `frontend/src/pages/settings/CompanyTab.jsx`, `UsersTab.jsx` | Rehber içinde tek H1 ve teknik işletme kodu göstermeyen gömülü görünüm; bağımsız ekranlar korundu |
| `frontend/src/pages/settings/AccountTab.jsx` | Fallback telefonda/tarihte uydurma veri ve admin rolü varsayımı kaldırıldı |
| `frontend/src/pages/mobile/MobileHome.jsx` | İşlem kutularında modül görünüm tercihi |
| `tools/customer-experience/run.cjs` | İzole DB/anahtar, dış ağ koruması, mevcut testleri tekrar kullanma ve ayrı üretim kipinde frontend çıktısı |
| `tools/customer-experience/preview.cjs` | Yalnız localhost/sentetik işletmeyle tarayıcı kabul önizlemesi |
| `docs/audits/VENIUX_CUSTOMER_EXPERIENCE.md` | Bu rapor |

PHP pazarlama sitesi, üretim DB, installer motoru, Android Java kaynakları, lisans doğrulama ve mevcut satış/stok servisleri değiştirilmedi. Kaynak sürüm numarası artırılıp müşteri paketi yayımlanmadı.

## 4. Yeni kurulum akışları

1. **İşletme bilgileri:** mevcut şirket formu kendi Kaydet düğmesiyle çalışır. Adım incelemek şirket verisini sessizce kaydetmez.
2. **İşletme türü:** beş profil; yalnız sunum/menü önceliği.
3. **Çalışma alanları:** en az bir alan; lisans ve rol sınırları devam eder.
4. **Satış/vergi:** TL kasa, ürün bazlı KDV, fiyatın KDV dahil temeli, kasa/depo/vardiya ve kasiyer yetkileri anlatılır. Global fiyat/KDV yeniden yazımı yapılmaz. Şirket profilindeki para birimi tercihi bütün POS'un çok para birimli olduğu anlamına gelmez.
5. **Kullanıcı:** mevcut kullanıcı/rol/depo kapsamı ekranı; ilk giriş admini tekrardan oluşturulmaz.
6. **Ürün aktarımı:** mevcut Excel/CSV parse → sütun eşleştir → önizle → kullanıcı onayı → commit. Depo/raf/mal kabul ayrıca açılır; otomatik varsayılan depo veya stok yaratılmaz.
7. **Cihaz:** veri giriş denemesi, mevcut scanner ayarı, Windows yazıcı listesi, fiş/etiket/QR bağlantıları. Test sonucunun kapsamı açık.
8. **Yedek/güvenlik:** platform yetkisine göre mevcut yedek paneli veya yedek sorumlusu bilgisi/güvenlik bağlantısı. Otomatik geri yükleme veya sessiz yedekleme açılmaz.
9. **Özet:** profil ve her adımın henüz incelenmedi/incelendi/sonraya bırakıldı durumu.
10. **Panel:** önceki bütün adımlar incelenmiş veya açıkça atlanmışsa rehber tamamlanabilir. Tamamlandı, donanım/işletme pilotu onaylandı demek değildir. Menüden tekrar açılabilir.

## 5. Çalıştırılan testler

**Sonuç:** mevcut seçili 15 sunucu paketinde **147 PASS / 0 FAIL**; frontend yardımcıları + Windows runtime/baskı + barkod/pending-sale grubunda **28 PASS / 0 FAIL**. Toplam **175 başarılı otomatik test**. Aşağıdaki odak tekrarları bu toplama tekrar eklenmedi.

| Paket | Gerçek sonuç |
|---|---|
| Yeni müşteri kurulum servisi | 9 PASS; yetkisiz 401, viewer/manager PUT 403, bozuk/ek tenant/secret gövdesi 400, revision çakışması 409 |
| İlk açılış/resume | Ürünsüz yeni işletmede öneri; ertelemeden sonra döngü yok; mevcut ürünlü işletmede zorlama yok; adım ve skip durumu DB'den korunur |
| Veri koruma odak tekrarı | Sentetik gerçek kasa satışı tamamlandı; ardından dört profil değiştirildi. Ürün, stok, kullanıcı, lisans, satış ve KDV/fiş snapshot'ı aynı kaldı. Yeni dokuz test ayrıca 9/9 yeniden geçti |
| Ürün aktarımı | 13 PASS; önizleme/onay, barkod sıfırları, yinelenen batch, çakışan ürün/alternatif kod ve bozuk dosya dahil |
| POS/KDV/iade/günlük/vardiya/recovery | Mevcut retail, critical, VAT, daily, shift, recovery paketleri geçti |
| WMS/stok/terminal | Lot/SKT/transfer, stok sağlığı ve virtual terminal paketleri geçti |
| Yetki/işletme izolasyonu | authorizationOperations ve multi_tenant_isolation geçti |
| Yedek/geri yükleme | 19 PASS, sentetik ve izole; üretim kurtarma tatbikatı değil |
| Android eşleştirme API | 4 PASS, yazılımsal sözleşme; fiziksel QR/telefon testi değil |
| Frontend/Windows/barkod | 28 PASS; menü tanımı değişmiyor, açık sayfa/ayarlar korunuyor, belirsiz sütun seçilmiyor, hassas hata bilgisi gösterilmiyor; mevcut runtime/print/scanner kontrolleri |
| Frontend production build | Başarılı; çıktı normal `frontend/dist` veya kurulu paketi ezmeden ayrı test klasöründe |
| Statik kontrol | Yeni rehber/hook/yardımcı/import/DesktopSetup için oxlint: 0 hata/uyarı. Mevcut Company/Users/Layout/MobileHome'da eski unused-import/hook uyarıları sürüyor; lint hatası yok |

Kanıtlar:

- Tam sunucu koşusu: `.local/customer-experience/run-2f50fd0303cf6557/jest.json`, `backend.log`, `presentation.log`, `commands.json`.
- Satış sonrası koruma güçlendirilmiş son odak koşusu ve son build: `.local/customer-experience/run-b4b5a68d60ed21f4/`; backend 9/9, presentation 28/28, build exit 0. Tam koşudaki kalan 138 test değiştirilmedi ve gereksiz yere yeniden sayılmadı.
- Son arayüz tarayıcı kabul build'i: `.local/customer-experience/run-10a7a78031ca5126/frontend/`.
- Görseller: `.local/customer-experience/setup-desktop.jpg`, `setup-mobile.jpg`. İzole sentetik işletme; canlı müşteri ekranı değil.

### Tarayıcıda gerçekten yapılan kontroller

- Sentetik hesaba gerçek giriş formuyla girildi; `/setup` korumalı route açıldı.
- Adım 2'de Market seçilip ilerlenince CRM menü tercihi değişti; kayıt sunucuya gitti.
- Adım 6'ya geçilip sayfa yenilendi; aynı adım geri geldi.
- HID alanına `0001234567890` girilip Enter gönderildi; sıfırlar korundu, fiziksel doğrulama gerekli mesajı görüldü. Satış endpointi çağrılmadı.
- Son gömülü şirket görünümünde H1 sayısı 1; teknik TENANT etiketi yok.
- 1360×980 test viewport'unda document genişliği/scrollWidth 1354/1354; 390×844'te 384/384: yatay taşma yok. Adım çubuğunun kendi yatay kaydırması küçük ekranda amaçlıdır.
- Güvenlik korunarak yalnız responsive görüntü test edildi. Native mobil flag'iyle köprüsüz tarayıcı açıldığında güvenli mobil giriş reddedildi; bu engel aşılmadı ve Android başarısı sayılmadı.

Tekrar çalıştırma: `NODE_ENV=test` ortamıyla `node tools/customer-experience/run.cjs`; yalnız son arayüz için `--ui-only`, satış sonrası kurulum koruması için `--setup-only`. Testler kendi DB/anahtarını oluşturur; dış servis değişkenlerini temizler ve loopback dışı Node HTTP/HTTPS/fetch erişimini engeller. Koşu sonunda kendine ait data klasörü silinir; JSON/log/build kanıtları korunur.

## 6. Başarısız veya engelli kontroller

| Durum | Kontrol / gerçek sınırlama |
|---|---|
| ÇÖZÜLDÜ | İlk koşuda yeniden kullanılan ağ korumasının lab bayrağı eksikti; testler başlamadan engellendi. Doğru test bayrağıyla koruma açık tutulup tekrar koşuldu; başarısız ilk komut kayıtları silinmedi. |
| ÇÖZÜLDÜ | NODE_ENV=test ile Vite build, önizlemede geliştirme API adresini seçti. Backend testleri test modunda, frontend build production modunda ayrıldı; gerçek form girişi ve `/setup` sonra çalıştı. |
| BLOCKED | Android Emulator ve WindowsSandbox.exe bu ortamda bulunmadı; adb/emulator/VM araçları PATH'te yoktu. Yeni emülatör/VM kurulmadı. Native ilk açılış/gerçek APK testi yapılmadı. |
| NOT TESTED | Yeni Windows EXE'nin temiz kurulum/güncelleme/kaldırma testi ve SmartScreen davranışı; yeni EXE üretilmedi. |
| NOT TESTED | Gerçek MySQL/bulut dağıtımı. Test API'si izole SQLite kullandı; SQL'de MySQL kilidi bulunması MySQL kabul testi değildir. |
| BLOCKED | Donanım yok: yazıcıdan fiziksel 58/80 mm çıktı, USB/Bluetooth tarama, seri COM ve üretici SDK'sı. Mevcut yazılım testleri bunların yerine sayılmadı. |
| KAPSAM DIŞI / EKSİK | Yerleşik doğrudan ESC/POS sürücüsü, otomatik sürücü kurulumu, tam çevrimdışı cihaz senkronizasyonu ve stok/lot/SKT'nin tek dosyadan atomik toplu mal kabulü bu çalışmada tamamlanmadı. |

BLOCKED/NOT TESTED sonuçlar başarı oranının paydasına veya 175 PASS sayısına eklenmedi. Üretimde gerçek ilk kurulum, QR kabulü, yedekten kurtarma veya fiziksel donanım uyumu iddia edilmedi.

## 7. Fiziksel cihazla doğrulanması gerekenler

1. HID cihazında Enter/Tab sonlandırıcı, tekrar okuma, baştaki sıfırlar ve odak kaybı.
2. Bluetooth kopma/yeniden bağlanma ve klavye düzeni.
3. Serial/COM izin, baud/parite ve yerel köprü anahtarının gerçek işletmede güvenli kurulması.
4. Yazıcı modelinde sürücü, 58/80 mm kağıt, Türkçe karakter, uzun ad, KDV, kesme ve tekrar baskı riski.
5. Android gerçek QR/pin doğrulaması, lisans/terminal kotası, ekran, kamera ve fiziksel tarama tuşu. Üretici SDK gereken kısım ayrı kabul edilmeli.
6. Yerel bilgisayar/sunucu kapanması ve ağ kesilmesi sırasında bekleyen satışın doğru durum sorgusuyla kurtarılması; bunun tam offline çalışma olmadığının anlaşılması.

## 8. Müşteriye sunum öncesi kalan eksikler

**Lansman öncesi zorunlu:**

- Ayrı test MySQL hedefinde aynı senaryolar, gerçek bulut/HTTPS ve reverse-proxy erişim kabulü.
- Yeni EXE/APK sürümü oluşturma, yeni kaynakların paketlere alındığının doğrulanması ve temiz Windows/gerçek Android testi. Sürüm notu, imza ve dağıtım ayrı yayın sürecidir; otomatik yayın yapılmadı.
- En az bir gerçek işletmede kurulum → dosya önizleme → depo/raf/kabul → kasa/vardiya → satış/iade → fiş → yedek/geri yükleme pilotu.
- Yedek planının sorumlu platform yöneticisiyle gerçekten etkinleştirilmesi ve kurtarma tatbikatı. Rehberde adımı incelemek yedek yaratmaz.
- Müşteriye “stok/lot/SKT tek dosyada otomatik aktarılır” denilecekse önce ayrı atomik, idempotent mal kabul geliştirmesi yapılmalı; bugün yalnız katalog aktarımı + ayrı mal kabul sunulabilir.

**Fiziksel cihaz bekleyen:** okuyucu, termal yazıcı, Android/el terminali ve seri SDK kabulü.

**Lansman sonrası iyileştirme:** mevcut ayar ekranlarındaki eski lint uyarıları, daha ayrıntılı cihaz model rehberi ve kurulum adımlarının belirli kaynaklardan otomatik kanıt toplaması. Otomatik kanıt olmadan kullanıcı incelemesi PASS'a çevrilmemeli.

**Güvenlik açısından korunan kararlar:** ortak DB yedeği firma kullanıcısına açılmadı; görünür modül seçimi yetki sayılmadı; lisans, central auth ve QR köprüsü atlanmadı; üretim verisi/kurulu paket/canlı site değiştirilmedi.

## 18 Ekim 2026 — Satın alınan paketin kurulumda gösterilmesi

- `backend/src/services/customerSetupService.js`: paket adı, atanmış kullanıcı/depo/cihaz sınırları ve tanımlı ek özellikler sunucudan okunur. Lisans anahtarı veya token arayüze eklenmez. Kaydetme yanıtında da paket özeti korunur.
- `frontend/src/pages/CustomerSetup.jsx`: kurulum başında paket özeti ve sınırları gösterilir. Profil ve çalışma alanı seçimleri mevcut lisans yetkilerini genişletmez. Mevcut planlarda POS/CRM için ayrı özellik bayrağı olmadığından yeni yapay kısıt eklenmedi.
- `backend/tests/customerSetup.test.js`: Starter paketine atanan özel sınırlar, firma izolasyonu, gizli lisans bilgilerinin dışarı verilmemesi ve kaydetme yanıtı doğrulandı.
- Çalıştırılan doğrulama: 10 kurulum API testi, 28 sunum/masaüstü/ortak bileşen testi başarılı; üretim arayüz derlemesi başarılı. Kanıt: `.local/customer-experience/run-b48ea3a83b945303/`.
- Canlıya yayın yapılmadı. Merkezi lisans servisiyle gerçek hesap testi bu çalışmada yapılmadı. Paket özeti mevcut yetki kontrollerinin yerine geçmez; ödeme veya paket yükseltme işlemi oluşturulmadı.
