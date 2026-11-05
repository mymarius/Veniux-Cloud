<?php
require_once __DIR__.'/release-archive.php';
$archive=releaseArchiveEntries();$downloads=(require __DIR__.'/release-catalog.php')['downloads'];
?>
<section class="rl-hero">
  <div class="hx-wrap rl-hero-grid">
    <div>
      <h1>Eski sürümler</h1>
      <p class="hx-lead">Yayımlanmış kurulum paketlerini sürüm numarası, dosya boyutu ve bütünlük özetiyle inceleyin. İndirmek için Veniux site hesabınıza giriş yapın.</p>
      <p class="rl-links"><a class="hx-btn" href="/indir">Güncel sürümleri indir</a><a class="hx-textlink" href="/guncelleme-notlari">Güncelleme notları</a></p>
    </div>
    <div class="rl-versions" aria-label="Önerilen güncel paketler">
      <div class="rl-version"><span>Windows</span><b><?=e($downloads['windows'])?></b></div>
      <div class="rl-version rl-version-orange"><span>Android</span><b><?=e($downloads['android'])?></b></div>
    </div>
  </div>
</section>
<section class="rl-log" aria-label="Sürüm arşivi">
  <div class="hx-wrap">
    <aside class="pg-notice rl-warn" aria-label="Eski sürüm uyarısı"><b>Kurmadan önce</b><p>Eski sürümler hata veya güvenlik düzeltmelerini içermeyebilir. Eski paket kurmak veri şemasını geri almaz; işletme verilerinizi yedekleyin. Windows paketlerinde doğrulanmış yayıncı imzası bulunmaz. Arşivlenmiş paketler mevcut cihazınızda yeniden test edilmiş olarak sunulmaz.</p></aside>
    <?php if(!$archive):?>
    <div class="rl-empty"><div class="rl-empty-rail" aria-hidden="true"></div><p class="rl-empty-big">Bu raf şimdilik boş.</p><p>Arşiv paketleri hazırlanıyor. Güncel sürümlere indirme sayfasından ulaşabilirsiniz.</p></div>
    <?php endif;?>
    <?php foreach(['windows'=>'Windows','android'=>'Android'] as $platform=>$label):$items=array_values(array_filter($archive,static fn($r)=>$r['platform']===$platform)); if(!$items)continue;?>
    <section class="rl-shelf" aria-labelledby="archive-<?=e($platform)?>">
      <h2 id="archive-<?=e($platform)?>"><?=e($label)?> <small><?=count($items)?> sürüm</small></h2>
      <div class="rl-list">
      <?php foreach($items as $item):?>
        <article class="rl-entry">
          <div class="rl-date"><time><?=e($item['version'])?></time><span><?=e(number_format($item['bytes']/1048576,1,',','.'))?> MB</span></div>
          <div class="rl-receipt">
            <div class="rl-tags"><span><?=!empty($item['historical'])?'Arşiv':'Güncel'?></span><?php if($platform==='windows'):?><span>İmzasız</span><?php endif;?></div>
            <h3><?=e($item['filename'])?></h3>
            <p><?=e($item['notice']??'Eski sürüm arşivi.')?></p>
            <p><a class="hx-btn" href="/dosya/<?=e($platform)?>?surum=<?=e(rawurlencode($item['version']))?>"><?=e($label)?> <?=e($item['version'])?> indir</a></p>
            <details><summary>SHA-256 dosya özeti</summary><code class="rl-sha"><?=e($item['sha256'])?></code></details>
          </div>
        </article>
      <?php endforeach;?>
      </div>
    </section>
    <?php endforeach;?>
  </div>
</section>
