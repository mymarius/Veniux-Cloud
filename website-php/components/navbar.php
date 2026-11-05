<?php
declare(strict_types=1);
$navLinks=['/stok-yonetimi'=>'Stok','/depo-yonetimi'=>'Depo','/market-pos'=>'Kasa','/lot-miat-takibi'=>'Lot ve miat','/fiyatlandirma'=>'Fiyatlar','/program-indir'=>'İndir'];
?>
<header class="vs-header">
  <div class="vs-wrap vs-nav">
    <a class="vs-brand" href="/" aria-label="Veniux ana sayfa"><img src="/assets/logo-40-v1.webp" srcset="/assets/logo-40-v1.webp 1x, /assets/logo-80-v1.webp 2x" alt="" width="28" height="28"><span>Veniux</span></a>
    <nav class="vs-nav-links" aria-label="Ana menü">
      <?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>" <?=$path===$url?'aria-current="page"':''?>><?=e($label)?></a><?php endforeach;?>
    </nav>
    <div class="vs-nav-cta"><a class="vs-nav-login" href="/giris">Giriş yap</a><a class="vs-btn vs-btn-primary vs-btn-sm" href="/?request_type=demo#iletisim">Demo isteyin</a></div>
    <details class="vs-mobile">
      <summary aria-label="Menüyü aç">Menü</summary>
      <nav aria-label="Mobil menü"><?php foreach($navLinks as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?><a href="/giris">Giriş yap</a><a href="/?request_type=demo#iletisim">Demo isteyin</a></nav>
    </details>
  </div>
</header>
