<?php
// Randevu paketi (berber ve güzellik salonu). Ürün HENÜZ YOK: her yerde "hazırlanıyor" ve "planlanan" yazılır;
// satın alma, deneme ya da kesin tarih sunulmaz. Fiyat ön fiyattır.
require_once __DIR__.'/whatsapp.php';
$bkAsk = static fn(string $plan) => whatsappUrl('Merhaba, randevu paketi için ön kayıt istiyorum ('.$plan.'). Personel sayımız: ');
?>
<div class="pr-page">
<section class="ho-hero">
  <div class="hx-wrap">
    <h1 data-pr>Berber ve güzellik salonları için randevu paketi</h1>
    <p class="hx-lead" data-pr><b>Hazırlanıyor.</b> Bu paket henüz kullanıma açık değil. 2027’de birkaç salonla pilot yapmayı hedefliyoruz. İhtiyacınızı şimdiden yazın, paketi ona göre şekillendirelim.</p>
    <p class="ho-cta" data-pr><a class="hx-btn" href="<?=e($bkAsk('henüz seçmedim'))?>" target="_blank" rel="noopener noreferrer">WhatsApp’tan ön kayıt</a></p>
  </div>
</section>

<section class="pr-rack" id="paketler" aria-label="Planlanan paket">
  <div class="hx-wrap pr-tags pr-one">
    <article class="pr-tag" data-pr data-i="1" data-featured>
      <div class="pr-tag-top"><span>VENİUX · RANDEVU PAKETİ</span><span>HAZIRLANIYOR</span></div>
      <h2>Randevu</h2>
      <p class="pr-for">Berber ve güzellik salonları için tek paket. Tek şube, 10 personele kadar.</p>
      <div class="pr-price"><span>9.990</span><small> ₺</small></div>
      <p class="pr-period">/ yıl · KDV dahil · planlanan ön fiyat</p>
      <ul>
        <li><b>Online randevu bağlantısı; WhatsApp karşılama mesajınıza ekleyin</b></li>
        <li><b>WhatsApp randevu asistanı (resmî onay sonrası)</b></li>
        <li>Günlük, haftalık ve aylık randevu takvimi</li>
        <li>Çakışan saate randevu verilmesini engelleme</li>
        <li>10 personele kadar; her personelin kendi saatleri ve izinleri</li>
        <li>Hizmet, süre ve fiyat listesi</li>
        <li>Müşteri kartı ve ziyaret geçmişi</li>
        <li>Salona özel ana panel ve raporlar</li>
        <li>Rol bazlı yetki: gelir bilgisini yalnız yetkili görür</li>
        <li><a href="#ozellikler">Tüm planlanan özellikler</a></li>
      </ul>
      <div><a class="hx-btn" href="<?=e($bkAsk('Randevu'))?>" target="_blank" rel="noopener noreferrer">Ücretsiz ön kayıt</a></div>
    </article>
  </div>
  <p class="hx-wrap pr-terms" data-pr>Listelenen özelliklerin tamamı planlanmıştır ve değişebilir. Fiyat, paket kullanıma açılırken kesinleşir. WhatsApp asistanı resmî onaylara bağlıdır: bağlantının onaylanacağı ya da ne zaman açılacağı garanti edilemez. WhatsApp ve aracı hizmet ücretleri fiyata dahil değildir.</p>
</section>

<section class="ho-steps-sec" id="ozellikler">
  <div class="hx-wrap">
    <h2 data-pr>Planlanan özellikler</h2>
    <p data-pr>Hiçbiri henüz kullanıma açık değil. Her grubun üstünde hangi aşamada geleceği yazar.</p>
    <ol class="ho-steps bk-groups">
      <li data-pr data-i="2"><small>İlk aşama · pilot</small><h3>Online randevu bağlantısı</h3><ul><li>Salonunuza özel randevu sayfası</li><li>Bağlantıyı WhatsApp Business karşılama mesajınıza koyarsınız; yazan müşteri buradan randevu alır</li><li>Bu aşamada numaranıza program bağlanmaz</li><li>Müşteri hizmet, personel, gün ve saat seçer</li><li>Yalnız gerçekten boş saatler gösterilir</li><li>Otomatik ya da onaylı randevu</li><li>En erken ve en geç randevu sınırı</li><li>Müşterinin iptal ve değiştirme isteği</li></ul></li>
      <li data-pr data-i="1"><small>İkinci aşama · resmî onaya bağlı</small><h3>WhatsApp randevu asistanı</h3><ul><li>WhatsApp’ın resmî işletme altyapısıyla çalışır; QR ile taklit bağlantı kullanılmaz</li><li>Salon sahibi bağlantı adımını kendisi yapar ve numarasını kodla doğrular; şifresini bizimle paylaşmaz</li><li>Yazan müşteriye otomatik cevap ve menü</li><li>Hizmet, personel, gün ve boş saat seçtirme</li><li>Müşteri özeti onaylayınca randevu oluşturma</li><li>Randevu görüntüleme, değiştirme, iptal</li><li>İstenince konuşmayı salondaki kişiye devretme</li><li>Onay, hatırlatma ve değişiklik mesajları</li></ul></li>
      <li data-pr data-i="0"><small>İlk sürüm</small><h3>Takvim ve randevu</h3><ul><li>Günlük, haftalık ve aylık görünüm</li><li>Personele ve hizmete göre süzme</li><li>Randevu oluşturma, değiştirme, taşıma, iptal</li><li>Durumlar: bekliyor, onaylandı, tamamlandı, iptal, gelmedi</li><li>Aynı saate ikinci randevuyu engelleme</li><li>Randevu notu ve değişiklik geçmişi</li></ul></li>
      <li data-pr data-i="1"><small>İlk sürüm</small><h3>Personel ve çalışma düzeni</h3><ul><li>Kişiye özel çalışma saatleri</li><li>Mola ve izin günleri</li><li>Salonun kapalı günleri</li><li>İşlem arasında hazırlık süresi</li><li>Hangi personelin hangi hizmeti verdiği</li><li>Rol ve ekran yetkileri</li></ul></li>
      <li data-pr data-i="2"><small>İlk sürüm</small><h3>Hizmet ve fiyat</h3><ul><li>Hizmet kategorileri</li><li>Her hizmete süre ve fiyat</li><li>Hizmeti açma ve kapatma</li><li>Eski randevuda o günkü fiyat ve süre korunur</li></ul></li>
      <li data-pr data-i="0"><small>İlk sürüm</small><h3>Müşteri kayıtları</h3><ul><li>Telefon numarasıyla eşleştirme, tekrar kayıt açmama</li><li>Geçmiş ve gelecek randevular</li><li>Toplam harcama, tercih edilen hizmet ve personel</li><li>Not ve etiket (yeni, düzenli, VIP, gelmeyen)</li><li>Pazarlama izni ayrı tutulur</li></ul></li>
      <li data-pr data-i="1"><small>İlk sürüm</small><h3>Ana panel ve raporlar</h3><ul><li>Bugünkü ve yaklaşan randevular</li><li>Günlük ve aylık gelir (yetkili kullanıcı)</li><li>İptal ve gelmeme sayısı</li><li>Yeni ve tekrar gelen müşteri</li><li>En çok istenen hizmetler</li><li>Personel doluluk oranı</li></ul></li>
      <li data-pr data-i="1"><small>Talebe göre</small><h3>Sonra değerlendirilecekler</h3><ul><li>WhatsApp sohbet botu</li><li>Bekleme listesi</li><li>Kapora ve online ödeme</li><li>Paket hizmet ve kampanya</li><li>Memnuniyet anketi</li><li>Birden fazla şube</li></ul></li>
    </ol>
  </div>
</section>
</div>
