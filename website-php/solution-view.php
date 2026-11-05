<?php declare(strict_types=1);
$faqs=(require __DIR__.'/product-faqs.php')[$path]??[];
$shot=['/stok-yonetimi'=>['shot-products.jpg','Ürün listesi: stok miktarı, barkod ve fiyat'],'/depo-yonetimi'=>['product-warehouse-v4.jpg','Depo ve tesis ekranı'],'/market-pos'=>['shot-pos.jpg','Kasa ekranı: sepet ve ödenecek toplam'],'/lot-miat-takibi'=>['product-lot-v4.jpg','Stok ve lot takibi paneli'],'/yapay-zeka'=>['shot-overview.jpg','Genel bakış ekranı']][$path]??null;
?>
<section class="vs-intro vs-wrap">
  <h1><?=strip_tags(str_replace('<br>',' ',$page['headline']))?></h1>
  <p class="vs-lead"><?=e($page['intro'])?></p>
  <?php if($path!=='/demo'):?><p class="vs-cta"><a class="vs-btn" href="/?request_type=demo#iletisim">Demo isteyin</a> <a href="/fiyatlandirma">Fiyatlar</a></p><?php endif;?>
</section>
<?php if($shot):?><figure class="vs-shot vs-shot-wide vs-wrap"><img src="/assets/<?=e($shot[0])?>" alt="<?=e($shot[1])?>" width="1500" height="900" fetchpriority="high"><figcaption>Programın kendi ekranı, örnek veriyle.</figcaption></figure><?php endif;?>
<?php if(isset($topics[$path])): $topic=$topics[$path]; ?>
<section class="vs-wrap vs-block vs-columns">
  <div><h2><?=e($topic[0])?></h2><p><?=e($topic[1])?></p></div>
  <div><h2><?=e($topic[2])?></h2><p><?=e($topic[3])?></p></div>
</section>
<?php endif;?>
<?php if($faqs):?>
<section class="vs-wrap vs-block"><h2>Sık sorulanlar</h2><div class="vs-qa"><?php foreach($faqs as [$question,$answer]):?><h3><?=e($question)?></h3><p><?=e($answer)?></p><?php endforeach;?></div></section>
<?php endif;?>
