<?php
declare(strict_types=1);
$screens=[
 '/depo-yonetimi'=>['product-warehouse-v2.jpg','Veniux mal kabul listesinde tamamlanmış örnek depo girişleri','Mal kabul arayüzünün gerçek ekran görüntüsü. İşletme ve ürün kayıtları sentetik örnektir.'],
 '/lot-miat-takibi'=>['product-lot-v2.jpg','Veniux ürün ekranında örnek lotun depo, miktar ve tarih ayrıntısı','Lot ayrıntısının gerçek yazılım ekranı; müşteri verisi içermez.'],
];
if(isset($screens[$path])):[$file,$alt,$caption]=$screens[$path];?>
<figure class="product-screen wrap"><a href="/assets/<?=e($file)?>" target="_blank" rel="noopener" aria-label="Ürün ekranını tam boy aç"><img src="/assets/<?=e($file)?>" width="<?=e((string)$page['image_width'])?>" height="<?=e((string)$page['image_height'])?>" alt="<?=e($alt)?>" loading="lazy" decoding="async"></a><figcaption><?=e($caption)?> <span aria-hidden="true">·</span> Tam boy görüntü için görsele dokunun.</figcaption></figure>
<?php endif;?>

