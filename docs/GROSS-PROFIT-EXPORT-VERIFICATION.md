# Brüt kâr Excel/CSV indirme doğrulaması

6 Ekim 2026. Mevcut rapor ve tasarım korundu; ayrı bir rapor veya modül eklenmedi.

## Düzeltilen noktalar

- Dosya adı artık tarih aralığını içerir: `brut-kar_2026-10-05_2026-10-06.csv` / `.xlsx`. Sunucunun Content-Disposition değeri ve uzantı kontrol edilir.
- CSV MIME türü `text/csv; charset=utf-8`; XLSX MIME türü `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Satış anındaki barkod ayrı metin sütunu olarak aktarılır. XLSX'te barkod ve ISO tarih hücreleri metin, para hücreleri sayı ve iki ondalıklı TL biçimidir. Barkodların sıfırları tahmin edilmez veya kaldırılmaz.
- CSV UTF-8 BOM, noktalı virgül ayırıcı ve Türkçe ondalık virgülle hazırlanır. Satır sonu/tırnak/ayırıcı içeren metinler doğru kaçırılır. Kullanıcı metnindeki formül başlangıcı boşluk arkasında olsa da apostrofla metinleştirilir. XLSX metin hücreleri formül olarak yazılmaz.
- Dosyada başlangıç/bitiş, dönem, depo, ürün, kategori, kasiyer filtreleri ve para birimi bulunur. Filtreler veri isteğiyle aynıdır.
- Ekran ile çıktı sunucudaki rapor özeti üzerinden parmak iziyle karşılaştırılır. Arada satış/iade/filtre sonucu değişirse eski ekrana farklı toplamlı dosya sunulmaz; 409 ile yenileme istenir. İstek sırasında ekranın rapor sürümü değişirse istemci indirmeyi de durdurur.
- İndirme kilidi çift isteği önler. Boş dosya, yanlış tür, HTML/JSON hata sayfası, yanlış dosya adı, bozuk UTF-8 ve geçersiz Excel reddedilir. XLSX ZIP yerel/merkez dizini, CRC değerleri, gerekli çalışma kitabı kayıtları ve tarayıcıda XML bütünlüğü denetlenir. Sunucu bu XLSX dosyalarını sıkıştırmasız yazar; doğrulayıcı mevcut sunucunun çıktısına uygundur.
- Hata halinde anlaşılır mesaj gösterilir, yeniden deneme açılır; başarılı dosya kaydı iddia eden bir mesaj gösterilmez. Blob adresi dosya tesliminin hemen arkasından iptal edilmez; 60 saniye sonra bırakılır.
- JSON ve iki çıktı türü sunucuda aynı firma/depo ve yönetici yetkisi kontrolünden geçer. Oturumsuz doğrudan çıktı 401; kasiyer çıktı isteği 403 verir. Kimlik doğrulama anahtarı dosya URL'sine konmaz.

## Test sonuçları ve kapsam ayrımı

Son kodla SQLite/API testleri: üç grup **36/36 geçti**; bunun içinde 21 brüt kâr/çıktı senaryosu var. Çıktı doğrulayıcı testleri **4/4 geçti**. Frontend üretim derlemesi başarılı; mevcut büyük paket uyarısı sürüyor. Sonuç dosyası `audit/gross-profit-export-tests.json`.

API testlerinde tamamen sayısal `0012345678905` barkodu, Türkçe karakterler, tırnak/satır sonları, tarih ve para toplamları doğrulandı. Excel üretilen dosya tekrar okunarak açılabilirliği ve hücre türleri kontrol edildi. **Microsoft Excel masaüstü uygulamasında açma testi yapılmadı.** Excel okuyucusuyla okunabilmesi bu uygulamada açma testiyle eş tutulmaz.

Ayrı SQLite test ortamında gerçek tarayıcı düğmeleriyle 05–06 Ekim aralığı; ürün `Lot maliyetli deneme ürünü`, kategori `Gıda`, ilgili kasiyer seçildi. CSV isteği 200 / 2145 bayt; XLSX isteği 200 / 21721 bayt. Her iki yanıtta tarihli doğru dosya adı ve doğru içerik türü görüldü. API'nin tarayıcı isteğine gönderdiği yanıtlar yeniden okunup ekrandaki KDV hariç **90 TL net satış, 40 TL maliyet, 50 TL brüt kâr** ile karşılaştırıldı: eşleşti. Filtre metaverileri ve barkodun `000` başlangıcı korundu.

Tarayıcıda ayrı test hata enjeksiyonları yapıldı: 503 sunucu hatası, 200 boş dosya, HTML yanıtı, bozuk Excel. Her durumda hata mesajı göründü ve tekrar deneme açık kaldı. Normal yanıtla tekrar denendiğinde hata temizlendi. Üretim verilerine satış/stok işlemi eklenmedi; test sunucusu ve geçici sekmeler kapatıldı.

### Tarayıcıdan diske kayıt — doğrulanamayan bölüm

Uygulama içi test tarayıcısında raporun Blob indirmeleri için indirme olayı/dosya yolu elde edilemedi. Aynı tarayıcıda basit doğrudan HTTP kontrol dosyası **gerçekten** `C:/Users/mymarius/Downloads/download-probe.csv` yoluna kaydedildi ve dosya bulundu. Veri adresi (`data:`) kontrolü de indirme olayı vermedi. Bu karşılaştırma hesaplama/API hatası yerine test tarayıcısının Blob/veri adresi teslimini gözlemleme veya gerçekleştirme sınırlamasına işaret eder; yalnızca gözlem kaybı mı yoksa teslim engeli mi olduğu kesinleştirilmedi.

**Rapor CSV/XLSX dosyalarının bu tarayıcıdan diske kaydedildiği doğrulanmadı.** Basit kontrol dosyasının kaydı rapor dosyalarının kaydı değildir. Sunucu yanıtını diske kopyalama da tarayıcı indirmesi sayılmaz. Chrome/Edge'de gerçek kullanıcı indirmesi bu çalışmada denenmedi; koşulsuz çalışıyor iddiası yoktur.

Kanıtlar `audit/gross-profit-browser-export/requests.jsonl`, `content-verification.json`, `server-error.jpg`, `corrupt-rejected.jpg`, `report-after-retry.jpg`. `api-response.csv` / `.xlsx` dosyaları tarayıcı isteğine gönderilen API yanıtlarının kopyalarıdır; tarayıcıdan indirilen dosyalar olarak etiketlenmemiştir.

## Kısa manuel son kontrol

1. Chrome veya Edge'de mevcut siteyi açın; **Market Kasası → Gün sonu → Brüt kâr** bölümünde tarih ve filtreleri seçin. Ekrandaki net satış, maliyet ve kâr toplamlarını not edin.
2. **Excel indir** ve **CSV indir** düğmelerine basın. Tarayıcı indirmelerinde iki dosyanın tamamlandığını; tarihli adlarını, `.xlsx` / `.csv` uzantılarını ve sıfırdan büyük boyutlarını kontrol edin.
3. XLSX'i Excel'de açın: Türkçe metin, sıfırla başlayan barkod, tarihler, filtre özeti ve `TOPLAM` satırını ekranla karşılaştırın. Onarım uyarısı olmamalı.
4. CSV'yi Excel'de **Veri → Metin/CSV'den** içe aktarın: UTF-8, `;` ayırıcı; **Barkod ve Tarih sütunlarını Metin** seçin, para sütunları için Türkçe yerel ayarı kullanın. Toplamları tekrar karşılaştırın.

CSV hücre türü taşımaz. CSV'ye çift tıklayarak açmak Excel'in barkod sıfırlarını otomatik kaldırmasına yol açabilir; dosyanın ham metninde sıfırlar korunur. Otomatik tür tahmini olmadan açmak için XLSX kullanın veya yukarıdaki metin içe aktarma adımlarını izleyin. Kullanıcı formülü başlangıçları CSV'de güvenlik amacıyla apostrofla korunur.

## Değişen kaynaklar

- `backend/src/services/retailProfitService.js`: barkod, filtre metaverileri, rapor parmak izi, çıktı satırları.
- `backend/src/routes/scannerRoutes.js`: dosya adı/türü, CSV kaçırma ve para biçimi, XLSX hücre biçimleri, eski rapor reddi.
- `backend/src/index.js`: mevcut CORS bağlantılarında dosya adı ve rapor parmak izi yanıt başlıklarını okunabilir yapar.
- `frontend/src/components/RetailGrossProfitReport.jsx`: mevcut düğmelerin indirme doğrulaması, kilit, hata ve tekrar deneme akışı.
- `frontend/src/utils/grossProfitDownload.js`: mevcut çıktının içerik/bütünlük doğrulayıcısı.
- `backend/tests/retailProfit.test.js`, `frontend/tests/grossProfitDownload.test.js`: anlamlı çıktı ve hata senaryoları.

Yerel API yeniden başlatıldı; yeni veritabanı migration'ı veya yeni modül eklenmedi.
