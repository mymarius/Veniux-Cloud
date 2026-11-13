<?php
declare(strict_types=1);
require_once __DIR__.'/../whatsapp.php';
?>
<footer class="vs-footer">
  <div class="vs-wrap vf-call">
    <p class="vf-big">Raf boşalmadan haberin olsun.</p>
    <a class="vf-btn" href="/?request_type=demo#iletisim">Demo isteyin</a>
  </div>
  <div class="vs-wrap vf-grid">
    <nav aria-label="Çözümler"><h2>Çözümler</h2><a href="/stok-yonetimi">Stok yönetimi</a><a href="/depo-yonetimi">Depo yönetimi</a><a href="/market-pos">Market ve POS</a><a href="/lot-miat-takibi">Lot ve miat takibi</a><a href="/barkodlu-stok-takibi">Barkodlu stok takibi</a><a href="/son-kullanma-tarihi-takibi">Son kullanma tarihi</a><a href="/el-terminali-depo-yonetimi">El terminali</a><a href="/yapay-zeka">Operasyon asistanı</a></nav>
    <nav aria-label="Program"><h2>Program</h2><a href="/program-indir">İndir</a><a href="/fiyatlandirma">Fiyatlar</a><a href="/guncelleme-notlari">Güncelleme notları</a><a href="/surum-arsivi">Sürüm arşivi</a><a href="/sunucu-kurulumu">Kurulum seçenekleri</a></nav>
    <nav aria-label="Hesap"><h2>Hesap</h2><a href="/giris">Giriş yap</a><a href="/kayit">Kayıt ol</a><a href="/#iletisim">Bize yazın</a><a href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer">WhatsApp <?=e(VENIUX_WHATSAPP_DISPLAY)?></a><a href="https://discord.gg/WQyxdp7MKW" target="_blank" rel="noopener noreferrer">Discord topluluğu</a></nav>
    <nav aria-label="Hukuk"><h2>Hukuk</h2><a href="/kullanim-kosullari">Kullanım koşulları</a><a href="/gizlilik-politikasi">Gizlilik politikası</a><a href="/kvkk-aydinlatma">KVKK aydınlatma</a><a href="/cerez-politikasi">Çerez politikası</a><button type="button" data-cookie-open>Çerez tercihleri</button></nav>
  </div>
  <aside class="vs-wrap vf-sponsor" aria-label="Altyapı sponsoru Hostimux"><div class="vf-sp-text"><small>ALTYAPI SPONSORU</small><span>Altyapı sponsorumuz</span><em>Veniux, Hostimux altyapısında çalışır.</em></div><a href="https://hostimux.com/" target="_blank" rel="sponsored noopener noreferrer" aria-label="Hostimux’u incele, yeni sekmede açılır"><img src="/assets/hostimux-sponsor-v1.png" width="1780" height="447" alt="Hostimux Bilişim Hizmetleri" loading="lazy"></a></aside>
  <div class="vf-word" aria-hidden="true">VENIUX</div>
  <div class="vs-wrap vf-end"><span class="vs-brand"><img src="/assets/logo-40-v1.webp" alt="" width="24" height="24" loading="lazy">Veniux</span><span>Stok, depo ve kasa programı. Türkiye'de geliştirilmiştir.</span><span class="vf-copy">© <?=date('Y')?></span><a class="vf-top" href="#main" data-top>Yukarı çık <span aria-hidden="true">↑</span></a></div>
</footer>
<a class="wa-float" href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp'tan yazın: <?=e(VENIUX_WHATSAPP_DISPLAY)?>, yeni sekmede açılır"><?=whatsappIcon(22)?><span>WhatsApp</span></a>
<?php require __DIR__.'/../cookie-consent.php'; ?>
