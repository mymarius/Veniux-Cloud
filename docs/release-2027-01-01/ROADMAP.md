# Yol haritası — 25 Kasım → 31 Aralık 2026

Kurallar: çalışan sistemi yeniden yazma, production verisine dokunma, gerçek ödeme/e-belge/pazaryeri/ÖKC işlemi yapma. Sıra, `AUDIT.md` risklerine göre ayarlandı (çevrimdışı kasa tarayıcı katmanı ve CI açığı önce).

| Sprint | Odak | Yapılacak (kodlanabilir) | Dışa bağlı (BLOCKERS) |
|---|---|---|---|
| 1 — Denetim + kritik | CI, lint, bağımlılık, kritik regresyon | `ci.yml` (eklendi), tam backend/frontend test çalıştırma, SKU kiracı benzersizliği için taşıma planı, ölü kod temizliği planı | — |
| 2 — Çevrimdışı + eşitleme | Tarayıcı çevrimdışı kasa E2E, kuyruk kalıcılığı, yük | Playwright ile service worker/IndexedDB testi; 1.000 ve 10.000 satırlık eşitleme yük testi ve ölçüm raporu; çevrimdışı indirim/iade/veresiye/sadakat güvenlik analizi | Gerçek mağazada uzun süre |
| 3 — Donanım | Barkod sağlayıcı sözleşme testleri, terazi, DataWedge | Open Food Facts sözleşme testi (resmî şema), Barcode Lookup sözleşmesi, emülatörde sahte intent, Teşhis ekranı | Gerçek terazi, Zebra, anahtar |
| 4 — Pazaryerleri | Trendyol belge uyumu, Hepsiburada ve N11 belge okuma | Resmî belgeden okunan sözleşme testleri; ortak adapter arayüzünün denetimi; stok politikası belgesi | Satıcı hesapları, stage erişimi |
| 5 — Muhasebe + e-belge | Gerçek şablonla test, UBL doğrulama, sağlayıcı soyutlaması | Paraşüt API belgesi okuma; UBL-TR şema doğrulaması (resmî XSD); gönderim kodu **kapalı bayrakla** | Şablonlar, entegratör sözleşmesi, mali mühür |
| 6 — ÖKC + online mağaza + CRM | Simülatör sözleşmesi, iyzico sandbox hazırlığı, CRM regresyon | iyzico belge okuma ve sandbox istemcisi; CRM CRUD/yetki testleri | iyzico hesabı (şirket), ÖKC SDK |
| 7 — Son QA | Tam regresyon, güvenlik, performans, yayın listesi | Tüm testler, `npm audit`, performans ölçümü, bilinen sorunlar listesi, kullanıcı rehberi | Gerçek cihaz sonuçları |

**Dondurma:** yeni büyük özellik 20 Aralık'ta durur (`docs/PLAN-1-OCAK-2027.md` ile aynı).

## Bu turda yapılan (Sprint 1 başlangıcı)
- `docs/release-2027-01-01/` altında 8 belge.
- `.github/workflows/ci.yml`: backend lint, backend jest, frontend/shared testleri, frontend build, `npm audit` (yüksek ve kritik).

## Bayi Portalı ve çok şubeli kasa (26 Kasım 2026'da plana eklendi)
Temel: mevcut "Saha ve bayi" bölümü (davetle bayi, sipariş, yönetici onayı, saha ziyareti; yalnız koddan görüldü, ekranda denenmedi). Başka firmaların adı veya tasarımı kullanılmaz.

| Sıra | İş | Büyüklük | Hedef | Durum |
|---|---|---|---|---|
| 1 | Mevcut "Saha ve bayi" ekranını çalıştırıp denemek, hataları düzeltmek; onaylanan siparişin nerede bittiğini saptamak | Küçük | 27 Kas | Bitti: bölümü açacak yol yoktu, eklendi; yerel Chrome'da aç → müşteri → sipariş → onay geçti. Onay yalnız durumu değiştirir (stok, cari, fatura yok). Davetli bayi/saha ekranı yalnız API testleriyle |
| 2 | Duyuru ve haber ekranı (yönetici yazar, bayi okur) | Küçük | 27 Kas | Bekliyor |
| 3 | Bayinin kendi başvurusu ve yönetici onayı (istek sınırı, kötüye kullanım koruması) | Küçük–orta | 27 Kas | Bekliyor |
| 4 | Onaylanan siparişi stok, sevkiyat ve cari hesaba bağlamak | 1. maddeden sonra belli olur | Pazar sonrası (Aralık) | Bekliyor |
| 5 | Başvuru evrakı yükleme (şifreli/yetkili saklama, silme süresi, KVKK metni) | Orta | Pazar sonrası (Aralık); metin avukat incelemesi ister | Bekliyor |
| 6 | Çok şubeli kullanım denemesi: çok mağazalı eşitleme yükü, MySQL ile | Orta | Pazar sonrası (Aralık) | Bekliyor |

Dış engelli, söz verilmeyecek: yeni nesil ÖKC (üretici SDK ve onayı), belirli bir ERP ile canlı entegrasyon (ERP adı ve teknik belgesi gerekir). Mali fişin ayrı yazarkasadan kesildiği kullanım biçimi satıştan önce mali müşavire sorulacak.

## Ek hizmet: küçük işletme web sitesi (26 Kasım 2026; web ve mobil uygulama işi kapsamdan çıkarıldı)
Veniux ürününden ayrı, insan emeğiyle verilen hizmettir. Yalnız iki paket: tanıtım sitesi (tek sayfa) ve işletme sitesi (en fazla 5 sayfa). E-ticaret, üyelik ve uygulama işi alınmaz.

| Sıra | İş | Hedef | Durum |
|---|---|---|---|
| 1 | Paket kapsamı | 26 Kas | Sayfada yazılı |
| 2 | Teklif şablonu: kapsam, teslim tarihi, ödeme aşamaları, değişiklik talebi, bakım, dosya ve alan adı sahipliği, kişisel veri sorumluluğu | Aralık | Bekliyor |
| 3 | veniux.com/web-sitesi sayfası | 26 Kas | Yazıldı; Azerbaycanca metni yok |
| 4 | İlk 2–3 işte harcanan saati not edip "şu fiyattan başlar" eklemek; müşteri izniyle örnek çalışma | İlk işlerden sonra | Bekliyor |

Ücretli iş ve fatura için şirket kuruluşu (1 Ocak 2027) beklenir ya da mali müşavire sorulur; sözleşme metni avukata gösterilir.

## Market (bakkal / süpermarket) hazırlık görevleri (27 Kasım 2026'da plana eklendi)
Kaynak: kullanıcının verdiği kapsamlı denetim metni, dört küçük göreve bölündü. Metin tek seferde çalıştırılmaz. Çalıştırılmayan test "geçti" yazılmaz; sahte sunucu ve simülatör sonucu gerçek test sayılmaz (n11 ve Hepsiburada gerçek hesapla denenmedi).

| Sıra | Görev | Kapsam | Durum |
|---|---|---|---|
| 1 | Market testi (limit yenilenince ilk iş) | Sonuç tablosu "geçti / kaldı / özellik yok": (a) ürün aç, mal kabul, barkod okut, sat, stok düşsün; (b) farklı son kullanma tarihli lotlar, ilk dolacak ilk satılsın, miadı geçmiş ürün kasada engellensin; (c) iade: stok, ödeme ve mali kayıt; (d) vardiya aç-kapat, ödeme mutabakatı; (e) Excel'den ürün aktarımı, barkod tutarlılığı. Ayrıca çoklu barkod, tartı barkodu, iki kasanın aynı ürünü aynı anda satması | Bekliyor |
| 2 | Güvenlik ve yedek | İşletmeler arası veri ayrımı (veritabanı ve API), yetkiler, yedekten gerçek geri yükleme ve veri bütünlüğü | Bekliyor |
| 3 | Pilot market paketi | Kurulum, Excel veri aktarımı, kısa eğitim, destek adımları; ilk hedef 3-5 pilot market | Bekliyor |
| 4 | Şirket kuruluşu kontrol listesi | Mali müşavire ve avukata sorulacaklar: şirket türü, yazılım ve marka sahipliği, sözleşmeler, KVKK, fatura, banka, ödeme sağlayıcı. Hukuk/vergi sonucu yazılmaz | Bekliyor |

Ertelenen (pilot marketlerden gerçek geri bildirim gelene kadar): yatırımcı belgeleri, müşteri kazanma ve fiyat büyütme çalışması, Azerbaycan açılımı. Senaryo 3 (çevrimdışı) 26 Kas'ta yerel Chrome'da, senaryo 8 (pazaryeri siparişi) yalnız sahte sunucuyla denendi; senaryo 6 (şubeler arası transfer) çok şube işine bağlı.

Sanal market laboratuvarı (`qa-lab/README.md`): 27 Kas'ta 1. Aşama ve hafif modda 2. Aşama yapıldı. Sıradaki 3. Aşama (sentetik veri), ardından yukarıdaki 1. görev (market testi) bu laboratuvarda yürütülür.

## 1 Ocak 2027'ye kadar haftalık takvim (27 Kasım 2026'da eklendi)
Hedef takvimdir, garanti değildir. Haftalık kullanım limiti biterse alttaki "isteğe bağlı" işler kayar; "zorunlu" işler öne alınır. Her haftanın sonunda gerçek durum yazılır; çalıştırılmayan test "geçti" sayılmaz.

| Hafta | Zorunlu | İsteğe bağlı (limit kalırsa) |
|---|---|---|
| 30 Kas - 6 Ara | Lab 3. Aşama: sabit tohumlu sahte market (1.000+ ürün, 3 kasa, 10 tedarikçi, 5 çalışan, lot/SKT). Market testi başlar | "Saha ve bayi" kapalıyken görünen düğme ve sekmeler |
| 7 - 13 Ara | Lab 4. Aşama: kasa, iade, vardiya, stok, depo, SKT, tedarikçi, Excel testleri; iki/üç kasa eşzamanlılığı; bulunan kritik hataları düzeltme. Çoklu barkod: eksikliği doğrula, gerekiyorsa ekle (veritabanı değişikliği) | Bayi: duyuru ekranı ve bayi başvurusu (aynı veritabanı yükseltmesiyle) |
| 14 - 20 Ara | Güvenlik ve yedek: işletme ayrımı, yetkiler, yedekten gerçek geri yükleme. Lab 5. Aşama: çevrimdışı senaryolar ve pazaryeri sahte sunucusu | Hepsiburada webhook/test süreci, barkod sağlayıcı testleri; MySQL test ortamı (indirme onayı gerekir) |
| 21 - 27 Ara | Pilot market paketi (kurulum, veri aktarımı, kısa eğitim, destek). Şirket kuruluşu kontrol listesi. Lab 8. Aşama: HTML/JUnit raporu ve kullanım belgesi | Lab 6. Aşama: yazıcı, çekmece, ödeme terminali, ÖKC benzetimleri (gerçek cihaz kanıtı değildir) |
| 28 - 31 Ara | Son tam test turu, yayın (program, bulut, site), dürüst durum raporu | Lab 7. Aşama: ZAP ve k6 taraması (indirme onayı gerekir) |

Ocak sonrasına bırakılanlar: bayi siparişini stok/sevkiyat/cari hesaba bağlama, bayi evrak yükleme (KVKK metni ve avukat), çok şube yük denemesi, kalan Azerbaycanca ekranlar, Docker ortamı, yatırımcı belgeleri. Web sitesi hizmeti teklif şablonu: Aralık içinde limit kalırsa.
Gerçek hesap, cihaz ya da şirket isteyenler (iyzico, pazaryerleri, ÖKC, e-belge, terazi, kod imzalama) takvimle bitirilemez; erişim geldikçe sınanır.

## Randevu paketi: berber ve güzellik salonu (27 Kasım 2026'da plana eklendi, karar 13 Aralık)
Veniux'un içinde sektör paketi olarak (ayrı program ve ayrı teknoloji yığını yok). Paket açık olan işletmede alana özel ana panel ve menü görünür: bugünkü ve yaklaşan randevular, personel takvimi ve doluluk, tamamlanan/iptal/gelmeyen, yeni müşteri, günlük-aylık gelir (yalnız yetkili rol), en çok istenen hizmetler. Rakamlar gerçek kayıtlardan gelir; depo/market ekranları bu işletmede gereksizse gizlenir. Giriş, işletme ayrımı, roller ve rapor altyapısının ne kadarının kullanılabileceği kod incelemesiyle doğrulanacak.

Karar koşulu (13 Aralık): en az 5 salon fiyatı kabul eder ve 2-3'ü pilot olmaya söz verir (kullanıcı 10 ilgili salon bulduğunu bildirdi; fiyat ve pilot sözü henüz doğrulanmadı).

| Dönem | İş |
|---|---|
| Aralık | Kullanıcı: salon görüşmeleri (fiyat, pilot, olmazsa olmazlar), Meta WhatsApp şart ve ücretleri. Karar sonrası ekran taslağı |
| Ocak | 1. sürüm: alana özel panel, hizmet, personel ve çalışma saatleri, takvim, elle randevu, veritabanında çakışma engeli |
| Şubat | Müşterinin bağlantıdan online randevu alması; 2-3 salonla pilot |
| Pilot sonrası | WhatsApp onay ve hatırlatma; talebe göre bot, bekleme listesi, kapora, kampanya |

Salonlara kesin tarih ve "hazır" sözü verilmez; şirket kurulmadan ücret alınmaz (mali müşavire sorulur).

Fiyat (27 Kas, ön fiyat, kesinleşmedi): berber ve güzellik salonu için TEK paket "Randevu", 9.990 ₺/yıl KDV dahil, tek şube, 10 personele kadar. Rakip fiyatı araştırılmadı; salon görüşmeleriyle doğrulanacak. Site sayfası `veniux.com/randevu` "hazırlanıyor" etiketiyle.
