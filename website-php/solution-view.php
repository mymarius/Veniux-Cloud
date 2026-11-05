<?php declare(strict_types=1);
$faqs=(require __DIR__.'/product-faqs.php')[$path]??[];
$data=(require __DIR__.'/solution-data.php')[$path]??['object'=>'label','stops'=>[],'band'=>null,'shot'=>null];
$related=array_filter(['/stok-yonetimi'=>['Stok','Ürün kartı, hareket geçmişi'],'/depo-yonetimi'=>['Depo','Mal kabul, raf, sayım'],'/market-pos'=>['Kasa','Barkodlu satış, vardiya'],'/lot-miat-takibi'=>['Lot ve miat','Parti ve tarih takibi'],'/yapay-zeka'=>['Asistan','Kayıtlara soru sorun'],'/fiyatlandirma'=>['Fiyat','Paketler ve limitler']],static fn($p)=>$p!==$path,ARRAY_FILTER_USE_KEY);
?>
<section class="hx-hero"><div class="hx-wrap hx-hero-grid">
  <div><h1><?=strip_tags(str_replace('<br>',' ',$page['headline']))?></h1><p class="hx-lead"><?=e($page['intro'])?></p>
  <?php if($path!=='/demo'):?><p class="hx-cta"><a class="hx-btn" href="/?request_type=demo#iletisim">Demo isteyin</a><a class="hx-textlink" href="/fiyatlandirma">Fiyatlar</a></p><?php endif;?></div>
  <?=pageObject($data['object'])?>
</div></section>
<?php if($data['stops']):?>
<section class="hx-journey"><div class="hx-wrap"><h2><?=$path==='/demo'?'Nasıl ilerliyor?':'Adım adım.'?></h2><?=pageJourney($data['stops'])?></div></section>
<?php endif;?>
<?php if($data['band']):?>
<section class="hx-till hx-band"><div class="hx-wrap"><h2><?=e($data['band'][0])?></h2><p><?=e($data['band'][1])?></p></div></section>
<?php endif;?>
<?php if($data['shot'])echo pageFrame($data['shot'][0],$data['shot'][1],str_starts_with($data['shot'][0],'product-')?1914:1500,str_starts_with($data['shot'][0],'product-')?860:900);?>
<?php if($faqs):?>
<section class="hx-faq hx-faq-top"><div class="hx-wrap"><h2>Sık sorulanlar</h2><div class="hx-qa"><?php foreach($faqs as [$question,$answer]):?><div><h3><?=e($question)?></h3><p><?=e($answer)?></p></div><?php endforeach;?></div></div></section>
<?php endif;?>
<?php if($path!=='/demo'):?>
<nav class="hx-more" aria-label="İlgili sayfalar"><div class="hx-wrap"><h2>Rafta başka neler var?</h2><div class="hx-tags"><?php foreach($related as $url=>[$label,$text]):?><a href="<?=e($url)?>"><b><?=e($label)?></b><span><?=e($text)?></span></a><?php endforeach;?></div></div></nav>
<?php endif;?>
