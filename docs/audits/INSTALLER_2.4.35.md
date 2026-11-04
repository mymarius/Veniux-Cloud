# Windows kurulum düzeni 2.4.35 — 16 Ekim 2026

Kullanıcı Lunar Client'ın gerçek karşılama ekranını paylaştı. İstenen düzen iki sütunlu işletme formu değil; tek koyu yüzey, ortalanmış marka, alt ayırıcı ve sağda İleri düğmesidir. Önceki yorum bu görselle düzeltildi.

## Dosya değişiklikleri

- `desktop/installer/build_artwork.py`: iki sütunlu pencere kaynakları yerine 552 DLU genişliğinde tek içerik alanı; alt çizgi; solda pasif Türkçe etiketi; sağda düğmeler. Marka yan paneli kaldırıldı. Veniux'un mevcut logosu düz grafit zeminde yüksek çözünürlükte hazırlanır. Lunar Client logosu, adı veya varlıkları kullanılmaz. İlk sayfada dil seçimi varmış gibi sahte İngilizce seçeneği sunulmaz.
- `desktop/installer/veniux-ui.exe`, `welcome-logo.bmp`, `button-next.bmp`, `button-back.bmp`, diğer `button-*.bmp`: güncel NSIS derleme varlıkları.
- `desktop/installer.nsh`: ilk ekran yalnız karşılama, ortalanmış logo/marka ve İleri içerir. Bağlantı ve klasör ikinci sayfaya taşındı. Geri dönüş, kayıtlı seçim, sessiz güncelleme ve gerçek NSIS ilerlemesi korunur. Radyo düğmeleri gerçek klavye/erişilebilirlik kontrolleridir; başlıkları koyu Windows temasından etkilenmeyen ayrı, tıklanabilir açık renkli metinlerdir. Checkbox metni de aynı şekilde okunabilir tutulur.
- `desktop/package.json`, `desktop/package-lock.json`, `frontend/src/data/programRelease.json`: 2.4.35 ve kurulum değişiklik notları.
- `frontend/dist`: program içi notlar dahil yeniden derlendi.

## Doğrulama ve sınırlar

Önizleme NSIS derlemesi başarılı; dört sayfa (karşılama, tercihler, kurulum, tamamlanma). Gerçek Windows erişilebilirlik ağacı ilk sayfada İleri, Türkçe, Veniux’a hoş geldiniz, marka resmi, VENIUX CLOUD ve İşletmeniz aynı ritimde metinlerini doğruladı. İlk sayfada sunucu/klasör formu yoktur.

Masaüstü regresyon testleri 15/15 geçti. Önceki sürümdeki doğrulanmış klasör normalizasyonu bu değişiklikte değiştirilmedi. Windows ekran yakalama aracı yine `FrameArrived timed out` verdi; ekran görüntüsüyle görsel kabul iddia edilmez. Gerçek farklı DPI, kurulum/güncelleme/kaldırma kabulü ayrıca gereklidir.

Üretim veritabanına dokunulmadı. Canlı indirme/güncelleme kanalı değiştirilmedi. Windows sertifikası hâlâ yok; paket imzasızdır.

## Sonuç

Tam Windows paketi başarıyla derlendi (çıkış 0). `.local/desktop-installer-2.4.35/Veniux-Setup-2.4.35.exe` oluşturuldu. EXE SHA-512 değeri `latest.yml` ile, paket içi uygulama sürümü 2.4.35 ile, beş UI giriş varlığı güncel kaynak derlemesiyle doğrulandı. Kanıt: `.local/installer-2.4.35-verification.json`.

Klasör normalizasyonunun sekiz sessiz NSIS testi tekrar çalıştırıldı: 8/8 başarılı. Native kaynak geometrisi: içerik ve logo pencerenin merkezinde; yan panel 2200 ve varsayılan ikon 1039 kaynakta yok; içerik alt çizginin üstünde ve düğmeler alt çizginin altında. İkinci sayfanın Windows erişilebilirlik ağacında ayrı sunucu/yerel kurulum seçenekleri, klasör alanı ve sponsor bağlantısı ayrıca görüldü.
