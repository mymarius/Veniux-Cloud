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
        <div class="lg-stamp">Son güncelleme<b>13 Kasım 2026</b></div>
        <p class="lg-intro">Bu metin Veniux sitesi ve açıklanan hizmetler için hazırlanmıştır. İletişim: <a href="mailto:destek@veniux.com">destek@veniux.com</a> · <a href="<?=e(whatsappUrl())?>" target="_blank" rel="noopener noreferrer">WhatsApp destek hattı</a>.</p>
        <?php foreach($legalSections as $i=>[$heading,$text]):?>
        <section id="madde-<?=$i+1?>"><span class="lg-no"><?=$i+1?></span><div><h2><?=e($heading)?></h2><p><?=e($text)?></p></div></section>
        <?php endforeach;?>
        <p class="lg-end">Hizmet kapsamı veya kullanım koşullarında yapılacak güncellemeler bu sayfada yayınlandığı tarihte yürürlüğe girer.</p>
      </article>
    </div>
  </div>
</section>
