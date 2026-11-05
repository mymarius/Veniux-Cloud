<?php
declare(strict_types=1);
?>
<footer class="vs-footer">
  <div class="vs-wrap vs-footer-grid">
    <div><a class="vs-brand" href="/"><img src="/assets/logo-40-v1.webp" alt="" width="28" height="28" loading="lazy"><span>Veniux</span></a><p>Stok, depo ve kasa işlerinizi tek yerde yöneten iş yazılımı. Türkiye'de geliştirilmiştir.</p></div>
    <nav aria-label="Çözümler"><h2>Çözümler</h2><a href="/stok-yonetimi">Stok yönetimi</a><a href="/depo-yonetimi">Depo yönetimi</a><a href="/market-pos">Market ve POS</a><a href="/lot-miat-takibi">Lot ve miat takibi</a><a href="/barkodlu-stok-takibi">Barkodlu stok takibi</a><a href="/yapay-zeka">Operasyon asistanı</a></nav>
    <nav aria-label="Kaynaklar"><h2>Kaynaklar</h2><a href="/program-indir">Program indir</a><a href="/fiyatlandirma">Fiyatlandırma</a><a href="/guncelleme-notlari">Güncelleme notları</a><a href="/surum-arsivi">Sürüm arşivi</a><a href="/sunucu-kurulumu">Kurulum seçenekleri</a></nav>
    <nav aria-label="Hesap ve hukuk"><h2>Hesap ve hukuk</h2><a href="/giris">Giriş yap</a><a href="/kayit">Kayıt ol</a><a href="/kullanim-kosullari">Kullanım koşulları</a><a href="/gizlilik-politikasi">Gizlilik politikası</a><a href="/kvkk-aydinlatma">KVKK aydınlatma</a><a href="/cerez-politikasi">Çerez politikası</a></nav>
  </div>
  <div class="vs-wrap vs-footer-end"><span>© <?=date('Y')?> Veniux</span><span><a href="https://discord.gg/WQyxdp7MKW" target="_blank" rel="noopener noreferrer">Discord topluluğu</a><a href="/#iletisim">İletişim</a><button type="button" data-cookie-open>Çerez tercihleri</button></span></div>
</footer>
<?php require __DIR__.'/../cookie-consent.php'; ?>
