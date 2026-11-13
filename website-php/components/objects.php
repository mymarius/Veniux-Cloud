<?php
declare(strict_types=1);
// Barkod çizgileri süs amaçlıdır; sabit desenden üretilir.
function homeBarcode(string $seed, int $height=44): string {
    $x=0;$bars='';$hash=hash('crc32b',$seed).hash('md5',$seed);
    foreach(str_split($hash) as $i=>$c){$v=hexdec($c);$w=1+$v%3;if($i%2===0)$bars.='<rect x="'.$x.'" y="0" width="'.$w.'" height="'.$height.'"/>';$x+=$w+($v%2);}
    return '<svg class="hx-barcode" viewBox="0 0 '.$x.' '.$height.'" preserveAspectRatio="none" aria-hidden="true">'.$bars.'</svg>';
}
// Sayfanın ana nesnesi: raf etiketi, koli etiketi, fiş, tarih damgası, not, randevu fişi.
function pageObject(string $type): string {
    switch($type){
     case 'box': return '<div class="hx-obj hx-box" role="img" aria-label="Koli çizimi: üzerinde sevk etiketi"><div class="hx-box-tape"></div><div class="hx-box-label"><span>SEVK ETİKETİ · A-02</span><strong>120 adet</strong><span>Filtre kahve 250 g</span>'.homeBarcode('koli',40).'<span>Teslim alan: Depo sorumlusu</span></div><div class="hx-stamp hx-stamp-g"><b>Kabul edildi</b><span>Örnek veri</span></div></div>';
     case 'receipt': return '<div class="hx-obj hx-receipt hx-receipt-big" role="img" aria-label="Fiş çizimi: iki ürün, toplam 114 lira"><b>VENIUX MARKET</b><span>Kasa 01 · Örnek fiş</span><hr><div><span>Filtre kahve</span><span>46,00</span></div><div><span>Tuzlu kraker</span><span>68,00</span></div><hr><div class="hx-receipt-diff hx-receipt-total"><span>TOPLAM</span><span>114,00 ₺</span></div><div><span>Stok düştü</span><span>2 ürün</span></div>'.homeBarcode('fis',28).'</div>';
     case 'date': return '<div class="hx-obj hx-date" role="img" aria-label="Son kullanma tarihi etiketi çizimi, üzerinde 3 gün kaldı damgası"><span>SON KULLANMA TARİHİ</span><strong>12.01</strong><em>2027</em><div class="hx-date-row"><span>Lot L-1950</span><span>48 adet</span></div><div class="hx-stamp"><b>3 gün kaldı</b><span>Örnek veri</span></div></div>';
     case 'note': return '<div class="hx-obj hx-note" role="img" aria-label="Not kâğıdı çizimi: soru ve onay bekleyen öneri"><p class="hx-note-q">Bu hafta neyi sipariş etmeliyim?</p><p>4 ürün kritik. Filtre kahve 3 günde bitiyor. Taslak hazırlayayım mı?</p><div class="hx-stamp"><b>Onayınızı bekliyor</b><span>Örnek veri</span></div></div>';
     case 'ticket': return '<div class="hx-obj hx-ticket" role="img" aria-label="Randevu fişi çizimi"><span>DEMO FİŞİ</span><strong>Sıra sizde</strong><div class="hx-date-row"><span>Süre</span><span>Birlikte belirlenir</span></div>'.homeBarcode('demo',32).'</div>';
     default: return '<div class="hx-obj hx-shelf" role="img" aria-label="Raf etiketi çizimi: filtre kahve, 46 lira, 3 günde bitiyor uyarısı"><div class="hx-label"><div class="hx-label-top"><span>VENİUX · RAF A-02</span><span>GÖZ 14</span></div><strong class="hx-label-name">Filtre kahve 250 g</strong><div class="hx-label-mid">'.homeBarcode('filtre-kahve',52).'<div class="hx-price">46<small>,00 ₺</small></div></div><div class="hx-label-bot"><span>8690000010004</span><span>Stok: 18 adet</span></div></div><div class="hx-stamp"><b>3 günde bitiyor</b><span>Örnek veri</span></div><div class="hx-rail" aria-hidden="true"></div></div>';
    }
}
function pageJourney(array $stops): string {
    $list='';$cards='';
    foreach($stops as $i=>[$tag,$title,$text,$head,$rows,$state,$tone]){
        $rowHtml='';foreach($rows as [$a,$b])$rowHtml.='<div class="hx-card-row"><span>'.e($a).'</span><b>'.e($b).'</b></div>';
        $card='<div class="hx-card-head">'.e($head).'</div>'.$rowHtml.'<div class="hx-card-state" data-tone="'.e($tone).'">'.e($state).'</div>';
        $list.='<li class="hx-step" data-step="'.$i.'"><span class="hx-step-tag">'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT).' · '.e($tag).'</span><h3>'.e($title).'</h3><p>'.e($text).'</p><div class="hx-card hx-card-inline" aria-hidden="true">'.$card.'</div></li>';
        $cards.='<div class="hx-card" data-card="'.$i.'"'.($i===0?' data-on':'').'>'.$card.'</div>';
    }
    return '<div class="hx-journey-grid"><ol class="hx-steps">'.$list.'</ol><div class="hx-stage" aria-hidden="true"><div class="hx-stage-sticky">'.$cards.'<p class="hx-stage-note">Örnek veriler.</p></div></div></div>';
}
function pageFrame(string $image,string $alt,int $w=1500,int $h=900): string {
    return '<section class="hx-frame-sec"><div class="hx-wrap"><h2>Programın kendi ekranı.</h2><figure class="hx-frame"><div class="hx-frame-bar" aria-hidden="true"><i></i><i></i><i></i></div><img src="/assets/'.e($image).'?v=5" width="'.$w.'" height="'.$h.'" loading="lazy" decoding="async" alt="'.e($alt).'"><figcaption>İşletme ve ürünler örnek veridir.</figcaption></figure></div></section>';
}
