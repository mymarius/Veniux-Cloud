<?php
require_once __DIR__.'/release-archive.php';
$archive=releaseArchiveEntries();$downloads=(require __DIR__.'/release-catalog.php')['downloads'];
?>
<link rel="stylesheet" href="/assets/release-archive-v1.css">
<section class="wrap changelog" aria-labelledby="archive-title">
 <div class="changelog-heading"><div><p class="eyebrow">VENIUX / SÜRÜM ARŞİVİ</p><h1 id="archive-title">Windows ve Android<br><em>sürüm arşivi.</em></h1><p>Yayımlanmış kurulum paketlerini sürüm numarası, dosya boyutu ve bütünlük özetiyle inceleyin. İndirmek için Veniux site hesabınıza giriş yapın.</p><p><a class="text-link" href="/guncelleme-notlari">Güncelleme notları →</a></p></div><aside class="release-current"><p class="eyebrow">ÖNERİLEN GÜNCEL PAKETLER</p><strong>Windows <?=e($downloads['windows'])?></strong><p>Android <?=e($downloads['android'])?></p><a class="button primary" href="/indir">Güncel sürümleri indir ↓</a></aside></div>
 <p class="release-notice">Eski sürümler hata veya güvenlik düzeltmelerini içermeyebilir. Eski paket kurmak veri şemasını geri almaz; işletme verilerinizi yedekleyin. Windows paketlerinde doğrulanmış yayıncı imzası bulunmaz. Arşivlenmiş paketler mevcut cihazınızda yeniden test edilmiş olarak sunulmaz.</p>
 <?php if(!$archive):?><p>Arşiv paketleri hazırlanıyor. Güncel sürümlere indirme sayfasından ulaşabilirsiniz.</p><?php endif;?>
 <?php foreach(['windows'=>'Windows','android'=>'Android'] as $platform=>$label):$items=array_values(array_filter($archive,static fn($r)=>$r['platform']===$platform));?>
 <section aria-labelledby="archive-<?=e($platform)?>"><h2 id="archive-<?=e($platform)?>"><?=e($label)?> <small><?=count($items)?> sürüm</small></h2><div class="release-history">
 <?php foreach($items as $item):?><article class="release-entry"><div class="release-date"><span><?=e($label)?></span><strong><?=e($item['version'])?></strong></div><div class="release-card"><div class="release-card-top"><div class="release-tags"><span><?=!empty($item['historical'])?'Arşiv':'Güncel'?></span><?php if($platform==='windows'):?><span>İmzasız</span><?php endif;?></div><span><?=e(number_format($item['bytes']/1048576,1,',','.'))?> MB</span></div><h3><?=e($item['filename'])?></h3><p class="release-summary"><?=e($item['notice']??'Eski sürüm arşivi.')?></p><p><a class="button primary" href="/dosya/<?=e($platform)?>?surum=<?=e(rawurlencode($item['version']))?>"><?=e($label)?> <?=e($item['version'])?> indir ↓</a></p><details><summary>SHA-256 dosya özeti</summary><code class="release-sha"><?=e($item['sha256'])?></code></details></div></article><?php endforeach;?>
 </div></section><?php endforeach;?>
</section>
