<?php
declare(strict_types=1);
// Üst menü, sitenin kendi dilinde: kâğıt zemin, raf etiketi/fiş önizlemeleri, barkod lazeri, damga, bant, turuncu kesikli şerit.
// JS yokken de çalışır (hover/odak + <details>).
$navLinks=['/fiyatlandirma'=>'Fiyatlar','/program-indir'=>'İndir','/bilgilendirme'=>'Bilgilendirme'];
$navProduct=[
    ['/stok-yonetimi','stok','Stok yönetimi','Barkod, giriş-çıkış, kritik seviye uyarısı'],
    ['/depo-yonetimi','depo','Depo','Mal kabul, raf, transfer, sayım'],
    ['/market-pos','kasa','Kasa','Barkodlu satış, gün sonu, iade'],
    ['/lot-miat-takibi','lot','Lot ve miat','Parti ve son kullanma tarihi'],
    ['/yapay-zeka','ai','Yapay zekâ asistanı','Sorun, onaylayarak uygulayın'],
];
$navSectorNames=['/market-stok-ve-kasa-programi'=>'Market','/kirtasiye-stok-programi'=>'Kırtasiye','/hirdavat-stok-programi'=>'Hırdavat','/kafe-hizli-satis-programi'=>'Kafe','/zuccaciye-barkod-programi'=>'Züccaciye','/pide-restoran-programi'=>'Pide ve restoran'];
$navSectors=array_filter($navSectorNames,fn($route)=>isset($sectorPages[$route]),ARRAY_FILTER_USE_KEY);
$navInfo=[['/bilgilendirme','Her şeyin durumu'],['/sunucu-kurulumu','Kurulum seçenekleri'],['/guncelleme-notlari','Güncelleme notları'],['/surum-arsivi','Sürüm arşivi'],['/stok-programlari-karsilastirma','Program seçerken']];
$navSolutionActive=in_array($path,array_merge(array_column($navProduct,0),array_keys($navSectors)),true);
?>
<header class="vs-header" data-nav>
  <div class="vs-wrap vs-nav">
    <a class="vs-brand" href="/" aria-label="Veniux ana sayfa"><img src="/assets/logo-40-v1.webp" srcset="/assets/logo-40-v1.webp 1x, /assets/logo-80-v1.webp 2x" alt="" width="30" height="30"><span>Veniux</span></a>
    <nav class="vs-nav-links" aria-label="Ana menü">
      <div class="vs-menu" data-menu>
        <button type="button" class="vs-nav-trigger" aria-expanded="false" aria-controls="vs-mega" <?=$navSolutionActive?'data-current="true"':''?>>Çözümler<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
        <div class="vs-mega" id="vs-mega">
          <div class="vs-mega-box">
            <span class="vs-mega-tape" aria-hidden="true"></span>
            <div class="vs-mega-grid">
              <div class="vs-mega-col vs-mega-main">
                <p class="vs-mega-title">Program</p>
                <?php foreach($navProduct as $i=>[$url,$key,$label,$text]):?><a class="vs-mega-item" style="--i:<?=$i?>" href="<?=e($url)?>" data-pv="<?=e($key)?>" <?=$path===$url?'aria-current="page"':''?>><em>0<?=$i+1?></em><span><b><?=e($label)?></b><small><?=e($text)?></small></span></a><?php endforeach;?>
              </div>
              <div class="vs-mega-col vs-mega-side">
                <p class="vs-mega-title">Sektörünüz</p>
                <div class="vs-mega-chips"><?php foreach($navSectors as $url=>$label):?><a href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?></div>
                <p class="vs-mega-title vs-mega-title-2">Bilgi</p>
                <?php foreach($navInfo as [$url,$label]):?><a class="vs-mega-link" href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?>
              </div>
              <aside class="vs-prev" aria-hidden="true" data-prev="stok">
                <div class="vs-tag" data-pv="stok">
                  <i class="vs-hole"></i>
                  <p class="tg-k">VENİUX · RAF A-02</p>
                  <p class="tg-name">Filtre kahve 250 g</p>
                  <div class="tg-code"><i class="tg-laser"></i></div>
                  <div class="tg-num"><b>118</b><span>adet</span></div>
                  <div class="tg-low"><span>Zeytinyağı 1 L · 4 adet</span><u class="tg-stamp">KRİTİK</u></div>
                </div>
                <div class="vs-tag" data-pv="depo">
                  <i class="vs-hole"></i>
                  <p class="tg-k">MAL KABUL · HEDEF RAF</p>
                  <div class="tg-shelf"><i></i><i></i><i></i><i></i><i></i><i class="tg-hit"></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                  <div class="tg-num"><b>A-02</b><span>+120 adet</span></div>
                  <div class="tg-low"><span>Kim, nereye, ne zaman: kayıtta.</span></div>
                </div>
                <div class="vs-tag vs-fis" data-pv="kasa">
                  <p class="tg-k">VENİUX · FİŞ 20261117-00001</p>
                  <div class="tg-row"><span>Süt 1 L</span><b>38,00</b></div>
                  <div class="tg-row"><span>Ekmek</span><b>12,00</b></div>
                  <div class="tg-row"><span>Peynir 200 g</span><b>94,00</b></div>
                  <div class="tg-row"><span>Domates 1 kg</span><b>36,00</b></div>
                  <div class="tg-total"><span>TOPLAM</span><b>180,00 ₺</b></div>
                  <u class="tg-stamp tg-ok">ÖDENDİ</u>
                </div>
                <div class="vs-tag" data-pv="lot">
                  <i class="vs-hole"></i>
                  <p class="tg-k">LOT 18 · SON KULLANMA</p>
                  <p class="tg-name">Yoğurt 500 g</p>
                  <div class="tg-num"><b>3</b><span>gün kaldı</span></div>
                  <div class="tg-row"><span>Süt · Lot 22</span><b>12 gün</b></div>
                  <div class="tg-row"><span>Peynir · Lot 03</span><b>21 gün</b></div>
                  <u class="tg-stamp">20.11.2026</u>
                </div>
                <div class="vs-tag vs-note" data-pv="ai">
                  <i class="vs-hole"></i>
                  <p class="tg-k">ASİSTAN</p>
                  <p class="tg-q">Bu hafta hangi ürünler bitiyor?</p>
                  <p class="tg-a">Zeytinyağı 1 L ve Un 1 kg kritik seviyede. Sipariş taslağı hazırlayayım mı?</p>
                  <span class="tg-btn">Onayla ve uygula</span>
                  <div class="tg-low"><span>Siz onaylamadan işlem yapmaz.</span></div>
                </div>
                <p class="pv-note">Örnek veriler.</p>
              </aside>
            </div>
            <div class="vs-mega-foot"><span>Hangisi size uygun? Birlikte bakalım.</span><a href="/?request_type=demo#iletisim">Demo isteyin <i aria-hidden="true">→</i></a></div>
          </div>
        </div>
      </div>
      <?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?>
    </nav>
    <div class="vs-nav-cta"><a class="vs-nav-login" href="/giris">Giriş yap</a><a class="vs-btn vs-btn-sm vs-nav-demo" href="/?request_type=demo#iletisim">Demo isteyin</a></div>
    <details class="vs-mobile" data-mobile>
      <summary aria-label="Menüyü aç veya kapat"><span class="vs-burger" aria-hidden="true"><i></i><i></i><i></i></span><span class="vs-mobile-label">Menü</span></summary>
      <nav aria-label="Mobil menü">
        <p class="vs-mobile-title">Program</p>
        <?php foreach($navProduct as [$url,$key,$label,$text]):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?>
        <?php if($navSectors):?><p class="vs-mobile-title">Sektörünüz</p><div class="vs-mobile-chips"><?php foreach($navSectors as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?></div><?php endif;?>
        <p class="vs-mobile-title">Daha fazlası</p>
        <?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?>
        <div class="vs-mobile-cta"><a class="vs-btn" href="/?request_type=demo#iletisim">Demo isteyin</a><a class="vs-mobile-login" href="/giris">Giriş yap</a></div>
      </nav>
    </details>
  </div>
  <span class="vs-progress" aria-hidden="true"></span>
</header>
