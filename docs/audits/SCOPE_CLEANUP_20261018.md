# Kapsam temizliği — 18 Ekim 2026

Site: fiyatlandırma, genel ürün rehberleri, kullanım koşulları ve geçmiş/yeni sürüm notlarındaki eczane, ilaç ve kurum entegrasyonu ifadeleri kaldırıldı. Beş PHP dosyası yedeklenip yayımlandı. 16 kanonik canlı sayfanın tamamı bu ifadeler açısından tarandı; eşleşme bulunmadı. 16 sayfanın SEO kontrolleri geçti. Yedek/SHA-256: `.local/scope-cleanup-publish-20261018T001113Z/`.

Uygulama kaynakları: `frontend/src/lib/customerExperience.mjs` profil listesinden eski seçenek kaldırıldı; backend `customerSetupService.js` yeni seçimleri reddeder ve eski saklı tercihi okurken genel depo profiline eşler. İlerleme ve modül tercihleri korunur, veritabanındaki eski kayıt GET sırasında değiştirilmez. `BackupPanel.jsx` ve `DatabaseMigrationModal.jsx` üzerindeki eski dosya türü açıklamaları genelleştirildi.

İzole doğrulama: 11 kurulum API testi, 28 sunum/ortak bileşen testi ve arayüz üretim derlemesi başarılı. Kanıt: `.local/customer-experience/run-ca6e66022e11f9a9/`. Testler: `backend/tests/customerSetup.test.js`, `frontend/src/lib/customerExperience.test.mjs`.

Sınır: yeni EXE/APK veya canlı API dağıtımı yapılmadı; uygulama kaynak değişiklikleri paket yayını bekliyor. Eski API uçlarının 410 güvenlik yanıtları ve eski web adresinin yönlendirmesi korunur. Tarihsel veritabanı tabloları, müşteri kayıtları, geçmiş test kanıtları ve iç arşiv belgeleri silinmedi. Genel lot/SKT stok işlevlerinin kullandığı tarihsel tablo isimleri de korunur; isimlerin silinmesi ürün verisini/çalışan işlevleri bozabilir. Önceden dağıtılmış kurulum dosyaları değiştirilmedi. Kullanıcıya sunulan modül kaldırılmıştır; bütün tarihsel kaynak izlerinin fiziksel olarak yok edildiği iddia edilmez.
