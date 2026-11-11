<?php declare(strict_types=1);
// Sektör sayfası: başlık, alt başlık, 5 fayda, gerçek arayüz görseli, sınırlar, kısa SSS ve ilgili sayfalar.
$sector=$sectorPages[$path];
?>
<article>
<section class="hx-hero"><div class="hx-wrap">
  <h1><?=e($sector['headline'])?></h1>
  <p class="hx-lead"><?=e($sector['subtitle'])?></p>
  <p class="hx-cta"><a class="hx-btn" href="/?request_type=demo&amp;solution=<?=e($sector['solution']??'stok')?>#iletisim">Demo isteyin</a><a class="hx-textlink" href="/fiyatlandirma">Fiyatlar</a></p>
</div></section>
<section class="hx-plain hx-sector-benefits"><div class="hx-wrap">
  <h2>Ne kazandırır?</h2>
  <div class="hx-qa hx-qacards"><?php foreach($sector['benefits'] as $benefit):?><div><p><?=e($benefit)?></p></div><?php endforeach;?></div>
  <?php if(!empty($sector['limits'])):?><p class="hx-sector-limit"><b>Sınır:</b> <?=e($sector['limits'])?></p><?php endif;?>
</div></section>
<?=pageFrame($sector['image'],$sector['alt'],1366,800)?>
<p class="hx-wrap hx-caption"><?=e($sector['caption'])?></p>
<?php if(!empty($sector['faq'])):?>
<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa"><?php foreach($sector['faq'] as [$question,$answer]):?><div><h3><?=e($question)?></h3><p><?=e($answer)?></p></div><?php endforeach;?></div></div></section>
<?php endif;?>
<nav class="hx-more" aria-label="İlgili sayfalar"><div class="hx-wrap"><h2>İlgili sayfalar</h2><div class="hx-tags"><?php foreach($sector['related'] as $url=>$label):?><a href="<?=e($url)?>"><b><?=e($label)?></b></a><?php endforeach;?></div></div></nav>
</article>
