# VENIUX CLOUD — Release Candidate 2.0

19 Ekim 2026. Yerel kaynak ve sentetik veri kabulü. Canlı yayın, gerçek müşteri DB değişikliği, banka/ÖKC işlemi, anahtar yenileme ve lisans iptali yapılmadı.

RC1, Production Readiness3 ve altındaki işlem bütünlüğü, güvenlik/lisans, donanım matrisi, Türkiye mali boşlukları, Windows/Android ve Terminal UX3 raporları incelendi. Tarihsel donanım/Windows/PHP sonuçları bu turun yeni başarısı olarak sayılmadı. Mimari korunuyor: PHP site/lisans merkezi, Node API, React, Electron/NSIS ve Java Android. Laravel dönüşümü veya yeni ürün modülü yok.

## Kararlar

| Kullanım | Karar | Gerekçe |
|---|---|---|
| İzole, sentetik verili yerel web demosu | **PASS** | Yeni SQLite/API ve gerçek MySQL yazılım testleri; mali/cihaz/offline satış iddiası olmadan. Temiz Windows EXE demosu için aynı kabul verilmez. |
| Gerçek işletmede kontrollü pilot | **BLOCKED** | Temiz Windows, imza, anahtar geçiş kararı, şifreli deployment snapshot geçişi, pending satış/update ve hedef cihaz/topoloji kabulü tamamlanmadı. |
| Genel ticari satış | **FAIL** | Açık güvenlik/yaşam döngüsü engelleri ve gerçek banka/ÖKC/mali entegrasyon eksikleri var. |

Fiziksel ve harici entegrasyon gerektirmeyen bütün engellerin kapandığı iddia edilmez. Plan hazırlanması, hassas dosyaların fiilen şifrelenmesi veya lisans rotasyonunun tamamlanması değildir.

## Kanıtlar ve yeni testler

Kanıt kökü `.local/release-candidate-2/`. Test kümeleri kesişir; sayılar toplanarak benzersiz test veya ticari hazırlık yüzdesi üretilmedi.

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Tam kök API/SQLite regresyonu | **749 PASS /0 FAIL**,94 test grubu | `.local/customer-experience/run-c0eee051f3151d66/jest.json` |
| Ortak sunum/guard |51 PASS,0 FAIL/skip; React production build başarılı | final presentation.log / commands.json |
| Gerçek MySQL8.4.6 | **18 PASS /0 FAIL**,4 test grubu; migration/parity/business/payment/recovery | mysql-results.json / mysql-jest.json; kapanış özeti aşağıda |
| Aynı ödeme testlerinin SQLite/MySQL karşılaştırması |7 ortak senaryo; iki motorun assertion sonuçları karşılaştırılır | engine-comparison.json |
| Temiz Windows10/11 | **BLOCKED**, hiçbir kurulum çalıştırılmadı | windows-environment.json |
| RC1 EXE yayıncı imzası | **BLOCKED / NotSigned** | aynı environment kaydı; SmartScreen davranışı gerçek VM'de görülmedi |
| Anahtar/yedek metadata envanteri | Tamamlandı, belirtilen kapsamda | security-inventory.json;4 anahtar yolu,29 kaynak referansı,2 .vnxsecure;1 UTF-8 okuma sınırı |

Çalıştırma: `NODE_ENV=test node tools/customer-experience/run.cjs --all-api`; `node tools/release-candidate/rc2-mysql.cjs`. İkinci araç yalnız resmî ZIP'ten çıkarılan MySQL8.4.6 binary'sini, yeni test datadir'ini, rastgele127.0.0.1 portunu ve boş veniux_test_rc2* şemalarını kullanır. Üretim/env bağlantı bilgileri kullanılmaz. Windows servisi, firewall/port açılımı ve hosting değişikliği yapılmaz. Eski `.local/mysql-test` veya XAMPP verileri kullanılmadı.

## Engellerin kabul matrisi

| Engel | Mevcut durum ve düzeltme | Kanıt | Kalan risk / sonraki adım | Sonuç |
|---|---|---|---|---|
| Süresiz adapter.status beklemesi (TX-02/P1) |5sn timeout ve finally timer temizliği eklendi. Yanıt gelmezse unknown korunur; execute tekrar çağrılmaz. | rc2Payments: bitmeyen Promise düzeltme öncesi6,5sn test sınırını aştı; düzeltme sonrası unknown döner, execute sayısı1. | Timeout alttaki üretici transport'unu fiziksel olarak durdurmaz. Geç sonuç otomatik success yazılmaz; gerçek adapter iptal/transport sözleşmesi ayrıca gerekir. | **PASS**, sınırlı yazılım hatası kapatıldı |
| Gerçek MySQL kabul ortamı yok (TX-03) | MySQL Community8.4.6 ayrı loopback laboratuvarında kuruldu ve kapatıldı. | mysql-results.json version/comment/port, migration current; parity/business testleri | Hedef müşteri MySQL sürümü/çok süreç/OS/yük/replica/PITR kabulü yok; hedefli testler tüm MySQL test dizini değildir. | **PASS**, yerel hedefli kapsam |
| Boş MySQL hedefe yedek yükleme hatası (yeni P1) | Önceki katalog tetikleyicileri veri yüklemesinde Access scope tenant mismatch üretiyordu. Yalnız explicit restore load aşamasında katalog trigger'ları düşürülür; ilişkiler doğrulanır, trigger'lar yeniden kurulur, migration latch korunur. | mysql-attempt-4'te16 PASS/1 FAIL; son recovery testi ve MySQL structure kontrolü | Canlı şemada DDL uygulanmadı. Geçersiz hedef/yarım migration otomatik aktive edilmez. | **PASS**, son recovery kabulü geçti |
| Anahtar kullanımı/rotasyon | Kaynak referansları ve issuer sınırları belgelendi; kesintisiz geçiş planı hazır. Anahtar değiştirilmedi. | [Geçiş planı](RC2_SECURITY_TRANSITION_PLAN.md), security-inventory.json | Eski dağıtım/alıcı envanteri ve sahip onayı yok. Yeni keyring/uyumluluk sürümü uygulanmış değil. | Plan **PASS**; olay/rotasyon **BLOCKED** |
| Şifresiz deployment recovery (SEC-03) | Üreticiler ve eski format/restore-before riskleri tespit edildi; veri kaybetmeden format1→2 geçiş/escrow/rollback planlandı. | deploymentSnapshot.js:18–19; deploymentService.js restore; geçiş planı | Mevcut writer hâlâ düz snapshot üretir. ACL/KEK/DPAPI/escrow, yeni reader/writer ve farklı makine kurtarma kabulü olmadan kapatılamaz. | **BLOCKED** |
| Yeni sırların Git'e yanlışlıkla eklenmesi | Özel anahtar, backend DB/env ignore kuralları eklendi. | .gitignore; mevcut paket guard'ı korunur | Git deposu yok; geçmiş temizliği/izlenmiş dosya garantisi değildir. Merkezi/uzak repo geçmişi incelenmedi. | Önlem **PASS**, geçmiş **BLOCKED** |
| Temiz Win10/11 kurulum | Sandbox=false; VBox/vmrun/Get-VM/qemu komutu yok. Mevcut geliştirici OS'si temiz VM sayılmadı. | windows-environment.json | VM/izinli Windows imajı ve staging lisans otoritesi sağlanmalı. İlk açılış/aktivasyon/SQLite/API/POS/update/uninstall/reinstall çalıştırılmadı. | **BLOCKED** |
| İmza/SmartScreen | Mevcut RC1 EXE NotSigned. | environment/signature | Beklenen dağıtım engeli; SmartScreen'in çıkacağı/çıkmayacağı gerçek VM kanıtı yok. Sertifika/Store ve imzalı kabul gerekir. | **BLOCKED** |
| Kart/bölünmüş ödeme/iade | Yerel beyanın para/stok/iade/idempotency kayıtları test edildi. Banka tahsilatı olarak kabul edilmedi. | rc2Payments, retailCritical/Pro/Vat/Shift | completed yerel satış durumudur; banka provizyonu değildir. Gerçek adapter/banka onayı olmadan bankadan tahsil edildi denemez. | Yerel kayıt **PASS**; banka **BLOCKED** |
| Pending satışta uygulama/update kapanışı | RC1 sessionStorage ve paketli kabul riski devam eder; yeni outbox yapılmadı. | RetailPos.jsx pending; desktop/updater.js | Kalıcı kurtarma sözleşmesi ve kurulu Electron güncelleme/kapanış testi gerekli. | **BLOCKED** |
| PHP lisans yönetimi erişimi (SEC-05) | Üretim MFA/VPN/IP topolojisi doğrulanmadı. | önceki güvenlik denetimi | Hosting sahibiyle erişim sınırı kabulü; genel kullanıcı MFA'sı merkezi PHP yönetimini kanıtlamaz. | **BLOCKED** |
| Fiziksel kasa ve mali entegrasyon | Bu tur çalıştırılmadı. | RC1 donanım/mali matrisi tarihsel referans | Gerçek cihaz/üretici/banka/entegratör kabulü gerekli. | **BLOCKED** |

## Ödeme güvenliği ayrıntısı

- 1.200,00 TL nakit satış +1.500,50 TL alınan nakit = **300,50 TL** para üstü. Aynı işlem anahtarıyla eşzamanlı iki API isteği aynı sale_id'yi döndürür; tek satış ve tek stok düşümü assertion'ı var.
- Kart1.200 ve bölünmüş400 nakit+800 kartın tam iadesinde özgün ödeme dağılımı ve stok geri dönüşü doğrulanır. Bunlar cihaz tahsilatı değil yerel ödeme beyanlarıdır.
- Yetersiz nakit satış kaydı/stok yazmadan reddedilir; aynı anahtarla geçerli yeniden deneme tek satış üretir.
- Yapılandırılmamış cihaz503 verir; failed/unknown/success test adapter journal kayıtları ayrı kalır. unknown yeniden execute edilmez; bank_reconciled=false doğrulanır. Test adapter success gerçek banka onayı değildir.
- Aynı fiziksel satışa farklı idempotency anahtarları verilmesi otomatik olarak aynı işlem sayılmaz. API replay testi gerçek dokunmatik çift tıklama testi değildir; mevcut istemci kilidi ve anahtar korunması gerekir.
- Yazılım bilgi fişi mali fiş değildir; bu tur GİB/ÖKC/banka çağrısı yapılmadı.

## MySQL geri yükleme düzeltmesi ve test sınırı

`backend/src/database/mysqlMigrator.js` load callback'i son katalogda çalışıyor; ilk katalogdan kalmış erişim trigger'ları ebeveyn tablolar henüz yüklenmeden doğrulama/sentetik kayıt oluşturabiliyordu. Bu durum sentetik gerçek MySQL8.4.6 yedeğinde üretildi. Düzeltme şema manifestini/iş kurallarını değiştirmez. Veri yüklemesinden sonra verifyRelations ve trigger yeniden oluşturma, structure kontrolü devam eder. Hata halinde migration state failed kalır; çalışan DB veya config yeni hedefe çevrilmez.

Recovery testleri şifreli private backup'tan portable export üretir, ayrı boş şemaya restore eder, kaynak satış sayısı ve stok defterini karşılaştırır; GCM dosya bozulmasını reddeder. Commit öncesi enjekte edilen hata ayrıca aktif kaynağı, sağlam pre-restore yedeğini ve failed candidate latch'ini kontrol eder. Kaynak müşteri DB değil, bu koşunun sentetik verisidir. Genel MySQL fiziksel dump/binlog/PITR veya gerçek disk kaybı başarısı iddia edilmez.

Resmî kaynak: [MySQL Windows ZIP kurulumu](https://dev.mysql.com/doc/refman/8.4/en/windows-installation.html). Kullanılan ZIP resmî CDN `mysql-8.4.6-winx64.zip`, SHA256 `B6C152F9F3AAA7294EB47DB698E47974D37B261BF3CAB4F90DC1243BB5ECD204`; son sürüm/güvenlik güncelliği veya ticari hedef önerisi iddia edilmez. Paket indirme sayfası erişim hatası verdi; resmî arşiv/CDN indirmesi başarılı oldu.

## Hata geçmişi ve sürüm ayrımı

İlk SQLite koşusu `run-ab99d479a81e95b3`:747 PASS/1 FAIL; yeni test yanlış pro rapor yolunu kullanıyordu. Sonraki `run-d6928f822ec316d7`:748 PASS/1 FAIL; gerçek süresiz status regresyonu. Düzeltme sonrası `run-ea3b2a2fc85811cc`:749 PASS/0 FAIL. Son migration değişikliği sonrası ek tam koşu kapanış kanıtında yer alır.

MySQL attempt1:14 PASS/1 FAIL yanlış test URL'si. Attempt2–4:16 PASS/1 FAIL; sabit test yöneticisi/sıralama hatası ayrıştırıldı, gerçek Access scope tenant mismatch kanıtı attempt4'te korundu. Attempt5:17 PASS/0 FAIL (başarılı restore+bozulma); sonraki koşu ayrı commit-fault regresyonunu da içerir. Hiçbir başarısız test atlanmadı/assertion silinmedi.

Bu tur **yeni RC2 EXE üretilmedi**. Temiz Windows adayı RC1 `2.4.39-rc.1` olarak kaldı ve bu iki backend düzeltmesini içermez. Eski EXE için yeni kaynak testlerinin geçtiği iddia edilmez. Kaynak RC2 kabulü, dağıtılmış/kurulu RC2 kabulü değildir. İmzalı paket+VM kapısı açılmadan canlıya çıkılmadı.

## Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
| backend/src/services/retailExternalService.js | Durum sorgusunda5sn sınır/temizlenen timer; unknown korunur |
| backend/src/database/mysqlMigrator.js | Boş hedef restore load sırasında eski katalog trigger etkisini önleme; son doğrulamaları koruma |
| backend/tests/rc2Payments.test.js |7 ödeme/para üstü/replay/failure/durum timeout regresyonu, iki DB'de aynı kaynak |
| backend/tests/mysql/rc2Recovery.test.js | Şifreli backup/restore, stok karşılaştırması, GCM bozulması ve commit-fault kabulü |
| tools/release-candidate/rc2-mysql.cjs | Resmî portable MySQL, tekil datadir/port/schema, migration/Jest, shutdown/sır temizliği |
| tools/release-candidate/rc2-mysql-environment.cjs | Kesin yerel config yolu, loopback/test schema/account guard |
| tools/release-candidate/rc2-security-inventory.py | Kaynak referansları ve metadata; DB/PEM/env gövdesi okumaz |
| .gitignore | Issuer private key, DB ve ortam dosyalarının yanlışlıkla eklenmesini önleme |
| docs/audits/RC2_SECURITY_TRANSITION_PLAN.md | Kesintisiz lisans ve veri kaybetmeden şifreli snapshot geçiş planı |
| docs/audits/VENIUX_RELEASE_CANDIDATE_2.md | Bu kabul/engel raporu |
| docs/audits/VENIUX_RELEASE_CANDIDATE_1.md | Tarihsel rapordan RC2 takip bağlantısı |

## Kapanış kanıt özeti

Son test sayıları ve SQLite/MySQL ortak senaryo karşılaştırması `engine-comparison.json` dosyasından doğrulanmalıdır. Test edilmeyen Windows, cihaz, merkezi lisans, mali servis, anahtar rotasyonu ve snapshot format geçişi başarı sayılmaz.

Test sonunda yalnız bu tur oluşturulan MySQL datadir kopyaları ve indirilen ZIP tekrarları kaldırıldı (`cleanup.json`); müşteri verilerine ve eski `.local/mysql-test` dizinine dokunulmadı. Tekrar kullanılabilen portable MySQL binary önbelleği yaklaşık1GB olarak laboratuvarda kaldı; servis çalışmıyor. Ara başarısız koşuların JSON/log kanıtları korundu.

Son kapanış: SQLite/API **749 PASS /0 FAIL /0 SKIP,94 grup**; ortak **51 PASS /0 FAIL**, build exit0. MySQL8.4.6 **18 PASS /0 FAIL,4 grup** (7 ortak ödeme +9 parity/business +2 recovery). Aynı7 ödeme assertion’ı iki motorda geçti. `engine-comparison.json` gerçek Jest çıktılarını karşılaştırır. MySQL sunucusu normal SHUTDOWN ile kapatıldı; geçici kimlik dosyası ve test PEM’leri silindi. Yeni RC2 EXE/VM veya gerçek banka kabulü yapılmadı.
