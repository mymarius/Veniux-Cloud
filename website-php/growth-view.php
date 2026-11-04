<?php declare(strict_types=1); $guide=$growthPages[$path]; ?>
<article class="growth-article wrap">
 <header class="growth-hero"><p class="eyebrow"><?=e($guide['label'])?></p><h1><?=e($guide['headline'])?></h1><p class="hero-intro"><?=e($guide['intro'])?></p><div class="hero-actions"><a class="button primary" href="/?request_type=demo&amp;solution=<?=e($guide['solution'])?>#iletisim">Demo görüşmesi isteyin</a><a class="text-link" href="/?request_type=quote&amp;solution=<?=e($guide['solution'])?>#iletisim">Teklif talep edin →</a></div></header>
 <figure class="product-screen"><a href="/assets/<?=e($guide['image'])?>" target="_blank" rel="noopener" aria-label="Ürün ekranını tam boy aç"><img src="/assets/<?=e($guide['image'])?>" width="<?=e((string)$page['image_width'])?>" height="<?=e((string)$page['image_height'])?>" alt="<?=e($guide['alt'])?>" loading="lazy" decoding="async"></a><figcaption><?=e($guide['caption'])?> <span aria-hidden="true">·</span> Tam boy görüntü için görsele dokunun.</figcaption></figure>
 <div class="growth-body"><?php foreach($guide['sections'] as [$heading,$body]):?><section><h2><?=e($heading)?></h2><p><?=e($body)?></p></section><?php endforeach;?></div>
 <aside class="growth-related" aria-label="İlgili çözümler"><h2>Bir sonraki adımı inceleyin.</h2><ul><?php foreach($guide['related'] as $url=>$label):?><li><a href="<?=e($url)?>"><?=e($label)?> →</a></li><?php endforeach;?></ul></aside>
</article>

