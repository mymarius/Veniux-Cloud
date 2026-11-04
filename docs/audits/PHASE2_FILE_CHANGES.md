# Phase2 dosya bazında değişiklikler

Git deposu bulunmadığından commit diff yok. Kaynak ve çıktı listesi:

| Dosya | Değişiklik / etki |
|---|---|
| backend/tests/helpers/assertRetired.js | Yeni yardımcı: beşHTTP yöntemi, kesin410/gövde, veri değişmezliği. |
| backend/tests/pentestRegression.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/medicines.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/stockHealth.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/audit_access.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/completion.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/pharmacy_mega_suite.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/pharmacy_suite.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| backend/tests/pharmacy_and_medula.test.js | Yalnız doğrulanmış emekli beklentileri güncellendi; aktif/pure testler korundu. |
| website-php/contact.php | Talep türü/ortaklık alanı doğrulama ve kalıcı yazım sonrası tek kullanımlık başarı makbuzu. |
| website-php/conversion.php | Sunucu oturumunda bağımsız makbuz üretme/tüketme; kişisel bilgi taşımaz. |
| website-php/index.php | POST/303/GET, tek kullanımlık başarı alanı, dört talep amacı ve kontrollü demo ön seçimi. |
| website-php/config.php | Bildirim kapatma seçeneği; izole kabul testleri gerçek SMTP ayarını yüklemez. |
| website-php/assets/conversion.mjs | Rıza ve mevcut adaptör birlikte olmadan gönderim yok; allowlist, dedup, sabit URL/boş referrer. |
| website-php/assets/site.js | Dönüşüm/tercih/ortaklık alanı istemci bağlama. |
| website-php/footer.php | Erişilebilir, eşit kabul/red seçenekli yerel istatistik tercih penceresi. |
| website-php/legal.php | Etkin olmayan GA4 ve yerel tercih/makbuz açıklaması; hukuk onayı iddiası yok. |
| website-php/product-proof.php | Mevcut stok/depo/lot URL’lerinde üç ayrı değerlendirme ve demo alanı. |
| website-php/organic-guides.php | Lot/SKT rehberi ve mevcut ürün sayfası iyileştirmelerinin bağlanması. |
| website-php/assets/brand-design.css | Yeni alanların mevcut mavi/turuncu dilde mobil stilleri. |
| website-php/.htaccess | Yeni PHP include dosyalarının doğrudan erişimine engel. |
| website-php/bin/seo-audit.cjs | Önbellekli HTML ile iç bağlantı fragment kontrolü; gereksiz ikinciGET turu kaldırıldı. |
| website-php/bin/conversion.test.mjs | 4 istemci testi: PII allowlist, rıza, tekrar, belirsiz taşıma, adaptör yokluğu. |
| website-php/bin/conversion-acceptance.cjs | Dört amaç için gerçek izole HTTP: hata, başarı, tek olay, refresh/replay ve kalıcı kayıt. |
| website-php/bin/conversion-guards.php | 12 PHP kontrolü: tek kullanımlı flash, bozuk tür, yazım engelinde olay yok. |
| website-php/asset-manifest.php | Güncel parmak izli CSS/JS dosyalarına referans. |
| website-php/assets/main.0e1e74c7f4a6.css | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |
| website-php/assets/program.666234b03ce9.css | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |
| website-php/assets/pricing.a0c2900c6cf2.css | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |
| website-php/assets/notes.ee636c4a0b2e.css | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |
| website-php/assets/accounts.1bb83dcb09d7.css | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |
| website-php/assets/site.b54dcc0a4a36.js | Kaynaklardan yeniden derlenen parmak izli dağıtım dosyası; canlıya yüklenmedi. |

Yeni/güncellenen raporlar: PHASE2_SUMMARY, PHASE2_TEST_CLASSIFICATION, PHASE2_FILE_CHANGES, TEST_RESULTS, FULL_PROJECT_AUDIT, SECURITY_AUDIT, PRODUCTION_READINESS, SEO_AUDIT, GA4_SETUP, SEARCH_CONSOLE_28_DAY_TEMPLATE +CSV, PHASE2_LINKEDIN_8, PHASE2_YOUTUBE_4, PHASE2_SEO_GUIDES_3, PHASE2_OUTREACH_5, REMAINING_BLOCKERS, LAUNCH_CHECKLIST. Yardımcı script ve izole kanıtlar .local/phase2-* altında; uygulamaya dağıtılmadı.
