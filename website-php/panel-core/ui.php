<?php
declare(strict_types=1);
// Panel arayüz parçaları: iskelet, simgeler, grafik, sayfalama.

function vp_icon(string $name): string {
    $p=[
        'home'=>'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
        'users'=>'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/>',
        'key'=>'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
        'cart'=>'<path d="M3 4h2l2.4 11h11l2-8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
        'box'=>'<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
        'file'=>'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
        'bank'=>'<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
        'tag'=>'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
        'chat'=>'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
        'book'=>'<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>',
        'megaphone'=>'<path d="M3 10v4h4l7 4V6L7 10z"/><path d="M17.5 9a4 4 0 010 6"/>',
        'mail'=>'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3.5 6l8.5 7 8.5-7"/>',
        'shield'=>'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
        'list'=>'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
        'gear'=>'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
        'calc'=>'<rect x="5" y="2.5" width="14" height="19" rx="1.5"/><path d="M8 6.5h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5"/>',
        'download'=>'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
        'wallet'=>'<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H3z"/><path d="M3 7l12-3v3M16.5 13.5h.01"/>',
        'user'=>'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
        'plus'=>'<path d="M12 5v14M5 12h14"/>',
        'search'=>'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        'menu'=>'<path d="M4 7h16M4 12h16M4 17h16"/>',
        'out'=>'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
        'print'=>'<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
        'pulse'=>'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    ][$name]??'';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'.$p.'</svg>';
}

function vp_initials(string $name): string {
    $parts=preg_split('/\s+/u',trim($name))?:[];$s='';
    foreach(array_slice($parts,0,2) as $p)$s.=mb_strtoupper(mb_substr($p,0,1,'UTF-8'),'UTF-8');
    return $s?:'V';
}

function vp_security_headers(): void {
    $nonce=$GLOBALS['nonce']??base64_encode(random_bytes(18));$GLOBALS['nonce']=$nonce;
    $frame=isset($GLOBALS['vp_frame_src'])?" frame-src ".$GLOBALS['vp_frame_src'].";":'';
    // Kart ödemesi başlatan formlar sağlayıcının sayfasına yönlenir (303); form-action bunlara izin verir.
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{$nonce}'; style-src 'self'; img-src 'self' data:;{$frame} object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://www.paytr.com https://*.iyzipay.com https://*.iyzico.com",true);
    header('X-Frame-Options: DENY');header('X-Robots-Tag: noindex, nofollow');header('Cache-Control: no-store');header('Referrer-Policy: same-origin');
}

function vp_doc_start(string $title,string $bodyClass='vp'): void {
    vp_security_headers();
    $v=@filemtime(VP_SITE_ROOT.'/assets/panel.css')?:1;$j=@filemtime(VP_SITE_ROOT.'/assets/panel.js')?:1;
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">';
    echo '<title>'.e($title).' · Veniux</title><link rel="icon" type="image/webp" href="/assets/logo-40-v1.webp"><link rel="stylesheet" href="/assets/panel.css?v='.$v.'"><script src="/assets/panel.js?v='.$j.'" defer></script></head><body class="'.e($bodyClass).'"><a class="vp-skip" href="#vp-content">İçeriğe geç</a>';
}

/**
 * $nav: [ ['group'=>'Başlık'] | ['href','label','icon','count'?] ]
 * $user: ['name','sub']
 */
function vp_shell_start(string $area,string $title,array $nav,string $current,array $user,string $searchAction='',string $banner=''): void {
    vp_doc_start($title);
    echo '<input type="checkbox" id="vp-nav-toggle" class="vp-sr" aria-hidden="true" tabindex="-1">';
    if($banner)echo $banner;
    echo '<div class="vp-app"><aside class="vp-side" aria-label="Panel menüsü">';
    echo '<a class="vp-side-brand" href="'.($area==='admin'?'/yonetim':'/panel').'"><img src="/assets/logo-40-v1.webp" alt="" width="30" height="30"><b>VENIUX</b><span>'.($area==='admin'?'Yönetim':'Müşteri').'</span></a><nav>';
    foreach($nav as $item){
        if(isset($item['group'])){echo '<div class="vp-side-group">'.e($item['group']).'</div>';continue;}
        [$href,$label,$icon]=$item;$count=(int)($item[3]??0);
        $active=$href===$current;
        echo '<a class="vp-nav" href="'.e($href).'"'.($active?' aria-current="page"':'').'>'.vp_icon($icon).'<span>'.e($label).'</span>'.($count>0?'<span class="vp-nav-count">'.$count.'</span>':'').'</a>';
    }
    echo '</nav><div class="vp-side-foot">'.($area==='admin'?'Veniux yönetim paneli':'Veniux müşteri paneli').'<br>'.vp_barcode($area.'-panel',26).'</div></aside><label class="vp-scrim" for="vp-nav-toggle" aria-hidden="true"></label>';
    echo '<div class="vp-main"><header class="vp-top"><label class="vp-burger" for="vp-nav-toggle" aria-label="Menüyü aç">'.vp_icon('menu').'</label>';
    if($searchAction)echo '<form class="vp-search" action="'.e($searchAction).'" method="get" role="search">'.vp_icon('search').'<input type="search" name="q" placeholder="'.($area==='admin'?'Müşteri, lisans, fatura, talep ara…':'Bilgi bankasında ara…').'" value="'.e(vp_get('q')).'" aria-label="Ara"></form>';
    echo '<div class="vp-top-right">';
    if($area==='client')echo '<a class="vp-btn vp-btn--sm vp-btn--ghost vp-no-print" href="/">Siteye dön</a>';
    echo '<a class="vp-who" href="'.($area==='admin'?'/yonetim/profil':'/panel/profil').'" title="Profil ve güvenlik"><span class="vp-who-text"><b>'.e($user['name']).'</b><small>'.e($user['sub']).'</small></span><span class="vp-avatar" aria-hidden="true">'.(!empty($user['photo'])?'<img src="'.e($user['photo']).'" alt="" width="36" height="36">':e(vp_initials($user['name']))).'</span></a>';
    echo '<form method="post" action="'.($area==='admin'?'/yonetim/cikis':'/cikis').'" class="vp-inline">'.($area==='admin'?vp_csrf_field():'<input type="hidden" name="csrf" value="'.e($_SESSION['account_csrf']??'').'">').'<button class="vp-btn vp-btn--sm vp-btn--ghost" type="submit" title="Çıkış yap">'.vp_icon('out').'<span class="vp-sr">Çıkış</span></button></form>';
    echo '</div></header><main class="vp-content" id="vp-content">';
    foreach(vp_flashes() as [$type,$msg])echo '<div class="vp-flash vp-flash--'.e($type).'" role="status">'.e($msg).'</div>';
}

function vp_shell_end(): void { echo '</main></div></div></body></html>'; }

function vp_head(string $eyebrow,string $title,string $lead='',string $actions='',array $crumbs=[]): void {
    echo '<div class="vp-head"><div>';
    if($crumbs){echo '<div class="vp-crumbs">';foreach($crumbs as $i=>[$href,$label])echo $i?'<span><a href="'.e($href).'">'.e($label).'</a></span>':'<a href="'.e($href).'">'.e($label).'</a>';echo '</div>';}
    echo '<div class="vp-eyebrow">'.e($eyebrow).'</div><h1>'.e($title).'</h1>'.($lead?'<p>'.e($lead).'</p>':'').'</div>';
    if($actions)echo '<div class="vp-actions">'.$actions.'</div>';
    echo '</div>';
}

function vp_empty(string $title,string $text='',string $action=''): string {
    return '<div class="vp-empty">'.vp_barcode($title,30).'<b>'.e($title).'</b>'.($text?'<p>'.e($text).'</p>':'').$action.'</div>';
}

function vp_pager(int $total,int $page,int $pages): string {
    if($pages<=1)return $total?'<div class="vp-pager"><span>'.$total.' kayıt</span></div>':'';
    $q=$_GET;$out='<div class="vp-pager"><span>'.$total.' kayıt · sayfa '.$page.'/'.$pages.'</span><nav aria-label="Sayfalar">';
    $from=max(1,$page-2);$to=min($pages,$page+2);
    if($page>1){$q['s']=$page-1;$out.='<a href="?'.e(http_build_query($q)).'" aria-label="Önceki">‹</a>';}
    for($i=$from;$i<=$to;$i++){$q['s']=$i;$out.=$i===$page?'<span class="cur" aria-current="page">'.$i.'</span>':'<a href="?'.e(http_build_query($q)).'">'.$i.'</a>';}
    if($page<$pages){$q['s']=$page+1;$out.='<a href="?'.e(http_build_query($q)).'" aria-label="Sonraki">›</a>';}
    return $out.'</nav></div>';
}

/** Aylık sütun grafiği (SVG, satır içi stil kullanmaz). $data: [[etiket, kuruş], ...] son eleman "bu ay". */
function vp_bar_chart(array $data,string $title): string {
    $w=720;$h=230;$pad=[18,10,30,10];$n=max(1,count($data));
    $max=max(1,...array_map(fn($d)=>(int)$d[1],$data));
    $step=($w-$pad[1]-$pad[3])/$n;$bw=min(38,$step*.62);$ch=$h-$pad[0]-$pad[2];
    $s='<svg class="vp-chart" viewBox="0 0 '.$w.' '.$h.'" role="img" aria-label="'.e($title).'">';
    for($g=0;$g<=3;$g++){$y=$pad[0]+$ch*$g/3;$s.='<line class="grid" x1="0" x2="'.$w.'" y1="'.round($y,1).'" y2="'.round($y,1).'"/>';}
    foreach($data as $i=>[$label,$val]){
        $bh=$val>0?max(3,$ch*$val/$max):0;$x=$pad[3]+$step*$i+($step-$bw)/2;$y=$pad[0]+$ch-$bh;
        $last=$i===$n-1;
        $s.='<rect class="'.($last?'bar-now':'bar').'" x="'.round($x,1).'" y="'.round($y,1).'" width="'.round($bw,1).'" height="'.round($bh,1).'" rx="2"><title>'.e($label.': '.vp_money((int)$val)).'</title></rect>';
        $s.='<text x="'.round($x+$bw/2,1).'" y="'.($h-10).'" text-anchor="middle">'.e($label).'</text>';
        if($last&&$val>0)$s.='<text class="val" x="'.round($x+$bw/2,1).'" y="'.round(max(12,$y-6),1).'" text-anchor="middle">'.e(vp_money((int)$val)).'</text>';
    }
    return $s.'</svg>';
}

function vp_select(string $name,array $options,?string $selected,string $attrs=''): string {
    $s='<select name="'.e($name).'" '.$attrs.'>';
    foreach($options as $v=>$l)$s.='<option value="'.e((string)$v).'"'.((string)$v===(string)$selected?' selected':'').'>'.e((string)$l).'</option>';
    return $s.'</select>';
}

function vp_confirm_form(string $action,string $label,string $confirm,string $class='vp-btn vp-btn--sm vp-btn--ghost',array $hidden=[]): string {
    $h='';foreach($hidden as $k=>$v)$h.='<input type="hidden" name="'.e($k).'" value="'.e((string)$v).'">';
    return '<form method="post" action="'.e($action).'" class="vp-inline" data-confirm="'.e($confirm).'">'.vp_csrf_field().$h.'<button class="'.e($class).'" type="submit">'.e($label).'</button></form>';
}

function vp_license_ticket(array $l,string $href,bool $admin=false): string {
    [$st]=vp_status('license',$l['status']);$off=!in_array($l['status'],['aktif'],true);
    $days=vp_days_left($l['expires_at']);
    $exp=$l['expires_at']?vp_date($l['expires_at']):($l['period']==='forever'?'Süresiz':'Ömür boyu');
    $devices=$l['device_limit']!==null?((int)$l['devices_used']).'/'.(int)$l['device_limit']:((int)$l['devices_used']).'/∞';
    return '<article class="vp-ticket'.($off?' vp-ticket--off':'').'"><div class="vp-ticket-main"><span class="vp-ticket-tag">'.e($st).' · '.e(vp_period_label($l['period'])).'</span><h3>'.e($l['pname']??'Lisans').'</h3>'
        .'<div class="vp-ticket-key"><span>'.e($l['license_key']).'</span><button type="button" data-copy="'.e($l['license_key']).'">Kopyala</button></div>'
        .'<div class="vp-ticket-meta"><span>Bitiş <b>'.e($exp).'</b></span>'.($days!==null&&$days>=0&&$days<=30?'<span><b>'.$days.' gün</b> kaldı</span>':'').'<span>Cihaz <b>'.e($devices).'</b></span>'.($admin&&isset($l['company'])?'<span><b>'.e($l['company']).'</b></span>':'').'</div></div>'
        .'<a class="vp-ticket-stub" href="'.e($href).'">'.vp_barcode($l['license_key'],34).'<b>Yönet</b><span>Lisans ayrıntısı</span></a></article>';
}
