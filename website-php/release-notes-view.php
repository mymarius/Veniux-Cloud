<?php $catalog=require __DIR__.'/release-catalog.php';$releases=require __DIR__.'/release-notes.php';$platformLabels=['windows'=>'Windows','android'=>'Android','site'=>'Site','api'=>'API']; ?>
<section class="rl-hero">
  <div class="hx-wrap rl-hero-grid">
    <div>
      <h1>Neler değişti?</h1>
      <p class="hx-lead">Eklenen özellikler, güncellenen deneyimler ve giderilen sorunlar. Windows, Android, site ve API için güncelleme geçmişi burada.</p>
      <p class="rl-links"><a class="hx-btn" href="/indir">Güncel sürümü indir</a><a class="hx-textlink" href="/surum-arsivi">Sürüm arşivi</a></p>
    </div>
    <div class="rl-versions" aria-label="Güncel sürümler">
      <div class="rl-version"><span>Windows</span><b><?=e($catalog['downloads']['windows'])?></b></div>
      <div class="rl-version rl-version-orange"><span>Android</span><b><?=e($catalog['downloads']['android'])?></b></div>
    </div>
  </div>
</section>
<section class="rl-log" aria-label="Güncelleme geçmişi">
  <div class="hx-wrap">
    <div class="rl-toolbar">
      <div class="rl-filters" role="group" aria-label="Güncellemeleri platforma göre göster"><button type="button" data-release-filter="all" aria-pressed="true">Tümü</button><?php foreach($platformLabels as $key=>$label):?><button type="button" data-release-filter="<?=e($key)?>" aria-pressed="false"><?=e($label)?></button><?php endforeach;?></div>
      <p id="release-count" aria-live="polite"><?=count($releases)?> yayın kaydı</p>
    </div>
    <div class="rl-list">
    <?php foreach($releases as $index=>$release):?>
      <article class="rl-entry"<?=$index===0?' data-latest':''?> data-release-platforms="<?=e(implode(' ',$release['platforms']))?>" aria-labelledby="release-heading-<?=$index?>">
        <div class="rl-date"><time datetime="<?=e($release['date'])?>"><?=e($release['date_label'])?></time><span><?=!empty($release['pending'])?'Yayın hazırlığı':($release['version']?'Sürüm '.e($release['version']):'Site yayını')?></span></div>
        <div class="rl-receipt">
          <div class="rl-tags"><?php foreach($release['platforms'] as $platform):?><span class="rl-p-<?=e($platform)?>"><?=e($platformLabels[$platform])?></span><?php endforeach;?><?php if($index===0):?><span class="rl-latest">Son yayın</span><?php endif;?></div>
          <h2 id="release-heading-<?=$index?>"><?=e($release['title'])?></h2>
          <p><?=e($release['summary'])?></p>
          <?php foreach($release['groups'] as $label=>$items):?><section><h3><?=e($label)?></h3><ul><?php foreach($items as $item):?><li><?=e($item)?></li><?php endforeach;?></ul></section><?php endforeach;?>
          <?php if(isset($release['notice'])):?><p class="rl-notice"><?=e($release['notice'])?></p><?php endif;?>
        </div>
      </article>
    <?php endforeach;?>
    </div>
    <p class="rl-bottom">Kurulum ve mobil bağlantı adımları için <a href="/program-indir">program sayfasına</a> bakın.</p>
  </div>
</section>
<script src="/assets/release-notes.js?v=20261013" defer></script>
