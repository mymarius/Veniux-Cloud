<?php declare(strict_types=1);
$guide=$growthPages[$path];
$data=(require __DIR__.'/solution-data.php')[$path]??['object'=>'label','cards'=>[]];
$stops=[];
foreach($guide['sections'] as $i=>[$heading,$body]){
    $card=$data['cards'][$i%max(1,count($data['cards']))]??['Örnek',[],'Kayıtlı','good'];
    $stops[]=[$card[0],$heading,$body,$card[0],$card[1],$card[2],$card[3]];
}
?>
<article>
<section class="hx-hero"><div class="hx-wrap hx-hero-grid">
  <div><h1><?=e($guide['headline'])?></h1><p class="hx-lead"><?=e($guide['intro'])?></p><p class="hx-cta"><a class="hx-btn" href="/?request_type=demo&amp;solution=<?=e($guide['solution'])?>#iletisim">Demo isteyin</a><a class="hx-textlink" href="/?request_type=quote&amp;solution=<?=e($guide['solution'])?>#iletisim">Teklif alın</a></p></div>
  <?=pageObject($data['object'])?>
</div></section>
<section class="hx-journey"><div class="hx-wrap"><h2>Adım adım.</h2><?=pageJourney($stops)?></div></section>
<?=pageFrame($guide['image'],$guide['alt'],(int)$page['image_width'],(int)$page['image_height'])?>
<nav class="hx-more" aria-label="İlgili çözümler"><div class="hx-wrap"><h2>Sonraki adım</h2><div class="hx-tags"><?php foreach($guide['related'] as $url=>$label):?><a href="<?=e($url)?>"><b><?=e($label)?></b></a><?php endforeach;?></div></div></nav>
</article>
