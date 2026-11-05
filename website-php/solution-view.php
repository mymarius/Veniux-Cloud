<?php declare(strict_types=1);
$faqs=(require __DIR__.'/product-faqs.php')[$path]??[];
$related=array_filter(['/stok-yonetimi'=>'Stok yönetimi','/depo-yonetimi'=>'Depo yönetimi','/market-pos'=>'Market ve POS','/lot-miat-takibi'=>'Lot ve miat takibi','/fiyatlandirma'=>'Fiyatlandırma'],static fn($p)=>$p!==$path,ARRAY_FILTER_USE_KEY);
?>
<section class="vs-hero vs-hero-page">
  <div class="vs-wrap vs-narrow">
    <p class="vs-kicker"><?=e($page['label'])?></p>
    <h1><?=$page['headline']?></h1>
    <p class="vs-lead"><?=e($page['intro'])?></p>
    <?php if($path!=='/demo'):?><div class="vs-actions"><a class="vs-btn vs-btn-primary" href="/?request_type=demo#iletisim">Demo isteyin</a><a class="vs-btn" href="/fiyatlandirma">Fiyatları görün</a></div><?php endif;?>
  </div>
</section>
<?php if(isset($topics[$path])): $topic=$topics[$path]; ?>
<section class="vs-section">
  <div class="vs-wrap vs-grid-2">
    <article class="vs-card"><h2><?=e($topic[0])?></h2><p><?=e($topic[1])?></p></article>
    <article class="vs-card"><h2><?=e($topic[2])?></h2><p><?=e($topic[3])?></p></article>
  </div>
</section>
<?php endif;?>
<?php if($faqs):?>
<section class="vs-section vs-section-alt">
  <div class="vs-wrap vs-narrow">
    <h2>Sık sorulan sorular</h2>
    <?php foreach($faqs as [$question,$answer]):?><details class="vs-faq"><summary><?=e($question)?></summary><p><?=e($answer)?></p></details><?php endforeach;?>
  </div>
</section>
<?php endif;?>
<?php if($path!=='/demo'):?>
<nav class="vs-section" aria-label="İlgili sayfalar">
  <div class="vs-wrap"><h2>İlgili sayfalar</h2><div class="vs-pills"><?php foreach($related as $url=>$label):?><a href="<?=e($url)?>"><?=e($label)?></a><?php endforeach;?></div></div>
</nav>
<?php endif;?>
