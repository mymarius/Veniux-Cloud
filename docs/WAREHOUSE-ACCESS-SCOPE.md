# Firma ve depo erişim kapsamı — 7 Ekim 2026

## Kullanım

Ayarlar → Kullanıcı Yönetimi → kullanıcı satırındaki kalkan simgesi **Depo erişim kapsamı** penceresini açar. Firma genelinde erişimi olan bir admin, kendi firmasındaki başka bir kullanıcıya seçili depoları veya açıkça **Firma genelinde erişim** atar. Rol işlem yetkisini, atama fiziksel kayıtlara erişimi belirler; ikisi de sunucuda kontrol edilir. Kendi kapsamını değiştirme ve başka firmaya atama reddedilir. Erişim değişikliği açık oturumun bir sonraki isteğinde etkilidir.

Seçili depo listesinin boş olması operasyon erişiminin kapalı olması demektir. Firma genelinde erişim mevcut ve ileride açılacak firma depolarını kapsar. Kasa `retail_registers.warehouse_id` ve vardiya üzerinden mevcut depo/mağaza lokasyonuna bağlıdır. Ayrı bir şube varlığı yoktur; firma iletişim alanındaki serbest `branch` metni erişim birimi olarak kullanılmadı. Depo, firma ve kasa tabloları yeniden oluşturulmadı.

## Açık geçiş politikası

Migration **027_user_warehouse_scope.sql** bir kez uygulanır:

- Önceden var olan `admin` kullanıcılarına açıkça `company` ataması verilir.
- Önceden var olan manager/cashier/operator/pharmacist/viewer kullanıcıları **restricted + boş depo listesi** ile başlar. Yönetici onları atamadan operasyonlara devam edemezler.
- Her eski kullanıcının önceki/yeni kapsamı `access.scope_migrated` kaydına yazılır; aktör `system:migration:027` olarak bellidir.
- Bundan sonra doğrudan oluşturulan kullanıcıların rolü admin olsa bile varsayılan kapsam boş restricted'dır. Yeni firma kayıt akışındaki kurucuya açıkça firma-geneli erişim verilir ve ayrıca kaydedilir.
- Bir kullanıcıya depo atamak o kullanıcının rolünü değiştirmez. Şifre/JWT içine depo izinleri konmaz.

Yerel API başlatıldığında migration otomatik uygulanır. Geçişten sonra personel atamalarını bu ekrandan tamamlayın. Migration öncesinde oluşturulmuş yedekler yeni şema ile otomatik uyumlu sayılmaz; mevcut geri yükleme doğrulaması bunları reddeder.

## Sunucu kapsamı

Firma sahipliği, depo/raf/lot/belge kimliği ve kasa/vardiya bağlantısı denetlenir. Liste, arama, stok toplamları, detay, rapor ve dışa aktarma fiziksel kayıtları aynı kapsamdan alır; sadece dönen satırları sonradan gizlemekle yetinilmez. SQLite sorgu katmanında istek bazlı AsyncLocalStorage ve kapsamlı CTE okumaları kullanılır. UPDATE/DELETE aynı kayıt koşulunu taşır; kapsam kontrolü desteklenmeyen fiziksel erişim/yazma sözdizimi kapalıdır. Transaction sorguları aynı istek kapsamını korur. Böylece LIMIT/GROUP BY/COUNT/SUM ve Excel/CSV üretimi kapsam dışı miktarları içermez.

Transferin hem kaynağı hem hedefi; mal kabul/sipariş/sayım kalemlerinin bağlı belgeleri; POS satışı ve iadelerinin bağlı kasa kayıtları; tedarikçiye iadenin kabul satırları kontrol edilir. Lot başlığı ürünün ortak parti tanımıdır; izinli raf, stok hareketi veya mal kabul ilişkisi üzerinden görünür. Farklı depoların miktarları birleştirilerek gösterilmez.

Ürün kataloğu ve tedarikçi iletişimi firmanın ortak ana verisidir. Atanmış kullanıcı bunları mevcut rolünün izin verdiği ölçüde okuyabilir; stok ve ticari belge sonuçları yine atanmış depolara sınırlıdır. Seçili-depo kullanıcısı firma ortak ürün/tedarikçi/depo kartlarını veya scanner yapılandırmasını değiştiremez; kendi deposundan tedarikçiye iade bunun bir istisnası değil, kabul kaydı üzerinden denetlenen stok işlemidir.

Depoya bağlanmamış firma-geneli AI, eczane idari işlemleri, otomasyon, genel denetim/bildirim geçmişi seçili-depo hesabına açılmaz; **firma genelinde erişim** gerekir. Böylece eşleştirilmemiş kayıtlar bütün depolara erişim sağlamaz. Ortak SQLite yedekleme yetkisi mevcut platform-yöneticisi kuralını korur. Platform yöneticisinin mevcut ayrı firma inceleme yetkisi korunur; firma değiştirerek kullanıcı erişim ataması yapması kapalıdır.

## Kayıt ve bakım

Atamalarda aktör kimliği/e-postası, hedef kullanıcı, zaman, önceki/yeni mod ve depo listeleri `audit_logs` içinde tutulur. Firma dışı depo ataması ayrıca SQLite ilişki trigger'ıyla reddedilir. Depo silme akışının eski foreign-key kapatma yöntemi nedeniyle atamalar açıkça temizlenir ve aynı kullanıcı bilgisiyle kaydedilir; sahipsiz depo izinleri bırakılmaz.

Görünür satır sayısı artık firma/depo kapsamına göre değiştiğinden WMS kabul, toplama ve taşıma birimi kodları kapsamlı COUNT sonucundan üretilmez. Var olan kodlar korunur; yeni kodlar mevcut öneki ve yılı koruyan UUID ile oluşturulur.

## Doğrulama

Ayrı `backend/stok_takip_test.db` SQLite ortamında iki firma, aynı firmada iki depo, bir başka firma deposu, admin/manager/cashier/operator ve farklı/boş atamalar kullanıldı. Üretim verisine test satışı, stok hareketi veya erişim denemesi gönderilmedi.

Yeni testler:

- Kurucunun açık firma kapsamı, yeni çalışanın boş erişimi, migration'ın legacy admin/personel ayrımı ve geçiş denetim kayıtları.
- Liste/detay, barkod araması, izinli stok toplamı ve lot listesi; yabancı firma/depo kimliğinin reddi.
- Kasiyerin izinli kasada satışı; başka deponun kasası, yanlış kasa/depo eşleşmesi ve operatör satışının reddi.
- Tek depolu kullanıcının transferi reddedilir; iki depo atandığında aynı akış çalışır.
- Kapsam dışı sipariş iptali, iade, fiş ve lot/sayım başlangıcının reddi; izinli sipariş oluşturma.
- İzinli yeni lotlu mal kabul/putaway ve tedarikçiye iade; başka deponun kabul kalemini kullanmanın reddi.
- Brüt kârın bağımsız beklenen 24,00 TL net satışı; CSV ve açılıp okunan XLSX toplamı 24,00 TL, başında sıfır olan barkod korunur. Dışa aktarma erişim kapsamını da belirtir.
- Kendi kendine, başka firmaya veya yetkisiz rolle erişim atamanın reddi; aktör/tarih/önceki/yeni kayıtlar.
- Atama kaldırıldıktan sonra aynı tokenın sonraki satışının reddi; açık company ataması sonrası firma depolarının görünmesi.
- Depo silinirken atamaların temizlenmesi ve kullanıcı erişiminin kapanması.
- SQL alias/CTE/alt sorgu ve OR/RETURNING davranışı; kapsam dışı UPDATE/DELETE değişiklik yapmaz. Eşzamanlı istekler birbirinin deposunu göremez.

Reddedilen stok/satış işlemlerinin öncesi ve sonrasında stok bakiyeleri, hareketler, satışlar, iadeler, nakit hareketleri, lot/raf kayıtları ve satın alma kayıtları karşılaştırıldı.

**Geçti:** 60 test dosyası, **477 kontrol**; frontend üretim derlemesi. Yeni kapsam/migration testleri `warehouseAccessScope.test.js` (10) ve `scopeQueryContext.test.js` (5) içindedir. Eski rol testlerinin test kullanıcıları açıkça company kapsamıyla hazırlanır; uygulamanın yeni kullanıcı varsayılanı genişletilmedi.

**Doğrulanamadı / bekleyen:** MySQL ve fiziksel cihazlar. Bu kapsam uygulaması SQLite içindir; MySQL için kapsamlı operasyonlar doğrulanana kadar açık bırakılmaz. Yeni ekranın üretim derlemesi doğrulandı; bu görevde tarayıcı tıklama testi yapılmış sayılmadı.

## Değişen alanlar

Migration 027; accessScopeService, accessScope middleware, scopeQueryContext ve database/auth bağlantısı; kurucu kayıt ve ayarlar erişim uçları; depo silme; WMS belge numaraları; brüt kâr çıktı kapsamı; maliyet alanı gizliliği; UsersTab ve AccessScopeEditor; test factory'si ve ilgili testler.
