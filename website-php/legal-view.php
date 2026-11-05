<?php $legalSections=$legalPages[$path]['sections']; ?>
<section class="lg-page">
  <div class="hx-wrap">
    <h1><?=e($page['label'])?></h1>
    <div class="lg-grid">
      <nav class="lg-index" aria-label="Bu metindeki başlıklar">
        <b>İçindekiler</b>
        <?php foreach($legalSections as $i=>[$heading]):?><a href="#madde-<?=$i+1?>"><span><?=$i+1?></span><?=e($heading)?></a><?php endforeach;?>
      </nav>
      <article class="lg-sheet">
        <div class="lg-stamp">Son güncelleme<b>13 Ekim 2026</b></div>
        <p class="lg-intro">Bu metin Veniux sitesi ve açıklanan hizmetler için hazırlanmıştır. İletişim: <a href="mailto:jackiekubi135@gmail.com">jackiekubi135@gmail.com</a>.</p>
        <?php foreach($legalSections as $i=>[$heading,$text]):?>
        <section id="madde-<?=$i+1?>"><span class="lg-no"><?=$i+1?></span><div><h2><?=e($heading)?></h2><p><?=e($text)?></p></div></section>
        <?php endforeach;?>
        <p class="lg-end">Şirketleşme, satış modeli veya veri işleme faaliyetleri değiştiğinde ilgili metinler güncellenir.</p>
      </article>
    </div>
  </div>
</section>
