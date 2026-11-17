<?php
declare(strict_types=1);
// Üst menü: yapışkan çubuk, "Çözümler" açılır menüsü, tam ekran mobil menü. JS yokken de çalışır (hover/odak + <details>).
$navLinks=['/fiyatlandirma'=>'Fiyatlar','/program-indir'=>'İndir','/bilgilendirme'=>'Bilgilendirme'];
$navProduct=[
    ['/stok-yonetimi','Stok yönetimi','Barkod, giriş-çıkış, kritik seviye uyarısı'],
    ['/depo-yonetimi','Depo','Mal kabul, raf, transfer, sayım'],
    ['/market-pos','Kasa','Barkodlu satış, gün sonu, iade'],
    ['/lot-miat-takibi','Lot ve miat','Parti ve son kullanma tarihi'],
    ['/yapay-zeka','Yapay zekâ asistanı','Sorun, onaylayarak uygulayın'],
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
          <div class="vs-mega-grid">
            <div>
              <p class="vs-mega-title">Program</p>
              <?php foreach($navProduct as [$url,$label,$text]):?><a class="vs-mega-item" href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><b><?=e($label)?></b><span><?=e($text)?></span></a><?php endforeach;?>
            </div>
            <div>
              <p class="vs-mega-title">Sektörünüz</p>
              <div class="vs-mega-chips"><?php foreach($navSectors as $url=>$label):?><a href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?></div>
              <p class="vs-mega-note">Sektörünüz listede yok mu? Stok ve kasa ekranları her perakende işletmeye uyar; <a href="/#iletisim">bize yazın</a>.</p>
            </div>
            <div>
              <p class="vs-mega-title">Bilgi</p>
              <?php foreach($navInfo as [$url,$label]):?><a class="vs-mega-link" href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?>
            </div>
          </div>
          <div class="vs-mega-foot"><span>Hangisi size uygun? Birlikte bakalım.</span><a href="/?request_type=demo#iletisim">Demo isteyin →</a></div>
        </div>
      </div>
      <?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?>
    </nav>
    <div class="vs-nav-cta"><a class="vs-nav-login" href="/giris">Giriş yap</a><a class="vs-btn vs-btn-sm vs-nav-demo" href="/?request_type=demo#iletisim">Demo isteyin</a></div>
    <details class="vs-mobile" data-mobile>
      <summary aria-label="Menüyü aç veya kapat"><span class="vs-burger" aria-hidden="true"><i></i><i></i><i></i></span><span class="vs-mobile-label">Menü</span></summary>
      <nav aria-label="Mobil menü">
        <p class="vs-mobile-title">Program</p>
        <?php foreach($navProduct as [$url,$label,$text]):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?>
        <?php if($navSectors):?><p class="vs-mobile-title">Sektörünüz</p><div class="vs-mobile-chips"><?php foreach($navSectors as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?></div><?php endif;?>
        <p class="vs-mobile-title">Daha fazlası</p>
        <?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?>
        <div class="vs-mobile-cta"><a class="vs-btn" href="/?request_type=demo#iletisim">Demo isteyin</a><a class="vs-mobile-login" href="/giris">Giriş yap</a></div>
      </nav>
    </details>
  </div>
  <span class="vs-progress" aria-hidden="true"></span>
</header>
