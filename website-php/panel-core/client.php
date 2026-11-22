<?php
declare(strict_types=1);
// Veniux müşteri paneli (/panel). Kimlik: sitedeki hesap oturumu ($_SESSION['download_account']).

function vpc_client(array $acc): array {
    $c=null;
    if(!empty($acc['id']))$c=vp_row('SELECT * FROM clients WHERE account_id=?',[(string)$acc['id']]);
    if(!$c&&str_starts_with((string)($acc['id']??''),'panel-'))$c=vp_row('SELECT * FROM clients WHERE id=?',[(int)substr((string)$acc['id'],6)]);
    if(!$c&&!empty($acc['email'])){
        $c=vp_row('SELECT * FROM clients WHERE email=?',[strtolower((string)$acc['email'])]);
        if($c&&!$c['account_id']&&!str_starts_with((string)$acc['id'],'panel-')){vp_update('clients',(int)$c['id'],['account_id'=>(string)$acc['id']]);$c['account_id']=(string)$acc['id'];}
    }
    if(!$c){
        $id=vp_insert('clients',['account_id'=>(string)$acc['id'],'email'=>strtolower((string)$acc['email']),'company'=>(string)($acc['company']??'İşletme'),'status'=>'aktif','created_at'=>vp_now()]);
        vp_log('musteri',$id,(string)($acc['company']??''),'Müşteri kaydı oluştu','Site hesabından',$id);
        $c=vp_row('SELECT * FROM clients WHERE id=?',[$id]);
    }
    if(empty($_SESSION['vp_client_seen'])&&empty($_SESSION['vp_impersonator'])){vp_update('clients',(int)$c['id'],['last_login'=>vp_now()]);$_SESSION['vp_client_seen']=1;}
    return $c;
}

function vpc_log(array $c,string $action,string $detail=''): void {
    if(!empty($_SESSION['vp_impersonator']))vp_log('yonetici',null,(string)$_SESSION['vp_impersonator']['name'].' (müşteri görünümü)',$action,$detail,(int)$c['id']);
    else vp_log('musteri',(int)$c['id'],$c['company'],$action,$detail,(int)$c['id']);
}

function vpc_start(array $c,string $title,string $current): void {
    $open=(int)vp_val("SELECT COUNT(*) FROM tickets WHERE client_id=? AND status='yanitlandi'",[$c['id']]);
    $unpaid=(int)vp_val("SELECT COUNT(*) FROM invoices WHERE client_id=? AND status='odenmedi'",[$c['id']]);
    $nav=[
        ['/panel','Genel bakış','home'],
        ['group'=>'Hizmetlerim'],['/panel/lisanslar','Lisanslarım','key'],['/panel/siparis','Paket satın al','cart'],['/panel/indirmeler','İndirmeler','download'],
        ['group'=>'Hesap ve ödeme'],['/panel/faturalar','Faturalarım','file',$unpaid],['/panel/siparisler','Siparişlerim','list'],['/panel/bakiye','Bakiye','wallet'],
        ['group'=>'Yardım'],['/panel/destek','Destek talepleri','chat',$open],['/panel/bilgi-bankasi','Bilgi bankası','book'],
        ['group'=>'Ayarlar'],['/panel/profil','Profil ve güvenlik','user'],
    ];
    $banner='';
    if(!empty($_SESSION['vp_impersonator']))$banner='<div class="vp-impersonate">Yönetici olarak '.e($c['company']).' hesabını görüntülüyorsunuz.<form method="post" action="/panel/yonetici-donus">'.vp_csrf_field().'<button type="submit">Yönetim paneline dön</button></form></div>';
    vp_shell_start('client',$title,$nav,$current,['name'=>$c['company'],'sub'=>$c['email'],'photo'=>vp_avatar_url('client','c',(string)$c['id'])],'/panel/bilgi-bankasi',$banner);
}

function vpClientRoute(string $path,array $config): bool {
    if($path!=='/panel'&&!str_starts_with($path,'/panel/'))return false;
    $acc=$_SESSION['download_account']??null;
    if(isset($acc)&&time()-(int)($_SESSION['account_activity']??0)>7200&&empty($_SESSION['vp_impersonator'])){unset($_SESSION['download_account']);$acc=null;}
    if(!is_array($acc)){if(vp_is_post()){http_response_code(403);echo 'Oturum süresi doldu.';return true;}vp_redirect('/giris');}
    $_SESSION['account_activity']=time();
    $sub=substr($path,strlen('/panel'))?:'/';
    if(vp_is_post()&&!vp_check_csrf()){vp_flash('Güvenlik anahtarı geçersiz. Sayfayı yenileyip tekrar deneyin.','err');vp_redirect('/panel');}
    if($sub==='/yonetici-donus'&&vp_is_post()){
        $imp=$_SESSION['vp_impersonator']??null;unset($_SESSION['vp_impersonator'],$_SESSION['download_account']);
        if(is_array($imp)){if($imp['admin'])$_SESSION['vp_admin']=$imp['admin'];if($imp['owner'])$_SESSION['download_account']=$imp['owner'];$_SESSION['vp_admin_seen']=time();}
        vp_redirect('/yonetim/musteriler');
    }
    $c=vpc_client($acc);
    if($sub==='/foto'&&!vp_is_post()){vp_avatar_serve('c',(string)$c['id']);return true;}
    vp_automation();
    $routes=[
        '#^/$#'=>'vpc_dashboard',
        '#^/lisanslar$#'=>'vpc_licenses','#^/lisanslar/(\d+)$#'=>'vpc_license_view',
        '#^/siparis$#'=>'vpc_order_plans','#^/siparis/([a-z0-9_]+)$#'=>'vpc_order_configure','#^/yukselt/(\d+)$#'=>'vpc_upgrade',
        '#^/siparisler$#'=>'vpc_orders','#^/odeme/([A-Za-z0-9]{6,64})$#'=>'vpc_paytr_page',
        '#^/faturalar$#'=>'vpc_invoices','#^/faturalar/(\d+)$#'=>'vpc_invoice_view',
        '#^/bakiye$#'=>'vpc_balance',
        '#^/destek$#'=>'vpc_tickets','#^/destek/yeni$#'=>'vpc_ticket_new','#^/destek/(\d+)$#'=>'vpc_ticket_view',
        '#^/indirmeler$#'=>'vpc_downloads',
        '#^/bilgi-bankasi$#'=>'vpc_kb','#^/bilgi-bankasi/(\d+)$#'=>'vpc_kb_article',
        '#^/profil$#'=>'vpc_profile',
    ];
    foreach($routes as $re=>$fn)if(preg_match($re,$sub,$m)){array_shift($m);$fn($c,...$m);return true;}
    http_response_code(404);vpc_start($c,'Bulunamadı','');echo vp_empty('Sayfa bulunamadı.','','<a class="vp-btn" href="/panel">Genel bakışa dön</a>');vp_shell_end();
    return true;
}

function vpc_blocked(array $c): bool { return $c['status']==='kara_liste'; }

// ---------------------------------------------------------------- genel bakış
function vpc_dashboard(array $c): void {
    $cid=(int)$c['id'];
    $lic=vp_all("SELECT l.*,p.name pname FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.client_id=? AND l.status<>'iptal' ORDER BY FIELD(l.status,'aktif','suresi_doldu','askida','bekliyor'),l.id DESC",[$cid]);
    $unpaid=vp_row("SELECT COUNT(*) n,COALESCE(SUM(total),0) s FROM invoices WHERE client_id=? AND status='odenmedi'",[$cid]);
    $tickets=vp_all("SELECT * FROM tickets WHERE client_id=? ORDER BY updated_at DESC LIMIT 4",[$cid]);
    $openT=(int)vp_val("SELECT COUNT(*) FROM tickets WHERE client_id=? AND status<>'kapali'",[$cid]);
    $ann=vp_all('SELECT * FROM announcements WHERE published=1 ORDER BY pinned DESC,id DESC LIMIT 3');
    $nextExp=vp_row("SELECT l.expires_at,p.name FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.client_id=? AND l.status='aktif' AND l.expires_at IS NOT NULL ORDER BY l.expires_at LIMIT 1",[$cid]);
    $downloads=@(require VP_SITE_ROOT.'/release-catalog.php')['downloads']??['windows'=>'—','android'=>'—'];
    vpc_start($c,'Genel bakış','/panel');
    vp_head('Müşteri paneli','Hoş geldiniz, '.rtrim($c['company'],'.').'.','Lisanslarınız, faturalarınız ve destek talepleriniz tek yerde.','<a class="vp-btn vp-btn--ghost" href="/panel/destek/yeni">'.vp_icon('chat').'Destek iste</a><a class="vp-btn" href="/panel/siparis">'.vp_icon('cart').'Paket satın al</a>');
    if((int)$unpaid['n']>0)echo '<div class="vp-flash vp-flash--info" role="status">'.(int)$unpaid['n'].' ödenmemiş faturanız var: '.e(vp_money((int)$unpaid['s'])).'. <a href="/panel/faturalar?durum=odenmedi">Faturaları görün</a></div>';
    ?>
<div class="vp-kpis">
  <a class="vp-kpi" href="/panel/lisanslar"><div class="vp-kpi-top">Aktif lisans<em>R-01</em></div><strong><?=count(array_filter($lic,fn($l)=>$l['status']==='aktif'))?></strong><small><?=count($lic)?> lisans kaydı</small><?=vp_barcode('c1'.$cid,18)?></a>
  <a class="vp-kpi" href="/panel/faturalar?durum=odenmedi"><div class="vp-kpi-top">Ödenecek<em>R-02</em></div><strong><?=e(vp_money((int)$unpaid['s']))?></strong><small><?=(int)$unpaid['n']?> fatura</small><?=vp_barcode('c2'.$cid,18)?></a>
  <a class="vp-kpi" href="/panel/destek"><div class="vp-kpi-top">Açık talep<em>R-03</em></div><strong><?=$openT?></strong><small>destek ekibiyle</small><?=vp_barcode('c3'.$cid,18)?></a>
  <a class="vp-kpi" href="/panel/bakiye"><div class="vp-kpi-top">Bakiye<em>R-04</em></div><strong><?=e(vp_money((int)$c['balance']))?></strong><small><?=$nextExp?'Sonraki yenileme '.e(vp_date($nextExp['expires_at'])):'faturalarda kullanılabilir'?></small><?=vp_barcode('c4'.$cid,18)?></a>
</div>
<div class="vp-grid vp-grid-main">
  <div class="vp-stack">
    <section>
      <div class="vp-card-head"><h2>Lisanslarım</h2><a href="/panel/lisanslar">Tümü →</a></div>
      <?=$lic?'<div class="vp-tickets">'.implode('',array_map(fn($l)=>vp_license_ticket($l,'/panel/lisanslar/'.$l['id']),array_slice($lic,0,4))).'</div>':'<div class="vp-card">'.vp_empty('Henüz lisansınız yok.','Ücretsiz Lite ile başlayabilir veya işinize uygun paketi seçebilirsiniz.','<a class="vp-btn" href="/panel/siparis">Paketleri incele</a>').'</div>'?>
    </section>
    <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Son talepler</h2><a href="/panel/destek">Tümü →</a></div>
      <?php if(!$tickets): echo vp_empty('Talep yok.','Kurulum, cihaz veya lisans sorunuz için talep açın.'); else:?><ul class="vp-list vp-card-pad"><?php foreach($tickets as $t):?><li><span class="vp-dot vp-dot--<?=vp_status('ticket',$t['status'])[1]?>"></span><div><a href="/panel/destek/<?=$t['id']?>"><?=e($t['subject'])?></a><span class="vp-sub">#<?=e($t['number'])?> · <?=e(vp_ago($t['updated_at']))?></span></div><?=vp_badge('ticket',$t['status'])?></li><?php endforeach;?></ul><?php endif;?>
    </section>
  </div>
  <div class="vp-stack">
    <section class="vp-card vp-card--ink">
      <span class="vp-label vp-label--light">İndirme merkezi</span>
      <h2>Programı indirin</h2><p>Windows programı ve Android uygulaması aynı kayıtlarla çalışır.</p>
      <div class="vp-actions"><a class="vp-btn" href="/dosya/windows"><?=vp_icon('download')?>Windows <?=e((string)$downloads['windows'])?></a><a class="vp-btn vp-btn--ghost" href="/dosya/android">Android <?=e((string)$downloads['android'])?></a></div>
    </section>
    <section class="vp-card"><div class="vp-card-head"><h2>Duyurular</h2></div>
      <?php if(!$ann) echo '<p class="vp-muted">Şu an duyuru yok.</p>'; foreach($ann as $an):?><article class="vp-announce vp-announce--<?=e($an['tone'])?>"><h3><?=e($an['title'])?></h3><time><?=e(vp_date($an['created_at']))?></time><?=vp_text($an['body'])?></article><?php endforeach;?>
    </section>
  </div>
</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- lisanslar
function vpc_licenses(array $c): void {
    $rows=vp_all('SELECT l.*,p.name pname FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.client_id=? ORDER BY FIELD(l.status,\'aktif\',\'suresi_doldu\',\'askida\',\'bekliyor\',\'iptal\'),l.id DESC',[$c['id']]);
    vpc_start($c,'Lisanslarım','/panel/lisanslar');
    vp_head('Hizmetlerim','Lisanslarım','Anahtarı kopyalayıp programın lisans ekranına yapıştırın.','<a class="vp-btn" href="/panel/siparis">'.vp_icon('plus').'Yeni lisans</a>');
    echo $rows?'<div class="vp-tickets">'.implode('',array_map(fn($l)=>vp_license_ticket($l,'/panel/lisanslar/'.$l['id']),$rows)).'</div>':'<section class="vp-card">'.vp_empty('Henüz lisansınız yok.','Paket satın aldığınızda ve ödeme onaylandığında lisansınız burada görünür.','<a class="vp-btn" href="/panel/siparis">Paketleri incele</a>').'</section>';
    vp_shell_end();
}

function vpc_license_view(array $c,string $id): void {
    $l=vp_row('SELECT l.*,p.name pname,p.code pcode,p.features,p.warehouse_limit,p.user_limit,p.ai_limit,p.price pprice FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.id=? AND l.client_id=?',[(int)$id,$c['id']]);
    if(!$l){vp_flash('Lisans bulunamadı.','err');vp_redirect('/panel/lisanslar');}
    $lid=(int)$l['id'];
    if(vp_is_post()){
        $op=vp_post('op',10);
        if($op==='cihaz'){
            $hours=max(0,(int)vp_setting('device_reset_hours','24'));
            if($l['last_reset']&&time()-strtotime($l['last_reset'].' UTC')<$hours*3600)vp_flash('Cihaz kayıtlarını '.$hours.' saatte bir sıfırlayabilirsiniz.','err');
            elseif($l['status']!=='aktif')vp_flash('Yalnız aktif lisansta cihaz sıfırlanabilir.','err');
            else{vp_update('licenses',$lid,['devices_used'=>0,'last_reset'=>vp_now()]);vpc_log($c,'Lisans cihazlarını sıfırladı',$l['license_key']);vp_flash('Cihaz kayıtları sıfırlandı. Programı yeni cihazda etkinleştirebilirsiniz.');}
        }elseif($op==='etiket'){vp_update('licenses',$lid,['label'=>vp_post('label',80)]);vp_flash('Etiket kaydedildi.');}
        elseif($op==='yenile'){
            if(!in_array($l['period'],['year','quarter','month'],true)){vp_flash('Bu lisans yenileme gerektirmez.','info');}
            elseif($iid=vp_val("SELECT id FROM invoices WHERE license_id=? AND kind='yenileme' AND status='odenmedi'",[$lid])){vp_redirect('/panel/faturalar/'.$iid);}
            else{$iid=vp_create_invoice((int)$c['id'],[[$l['pname'].' ('.vp_period_label($l['period']).') · yenileme · '.$l['license_key'],(int)$l['price']]],['license_id'=>$lid,'kind'=>'yenileme']);vpc_log($c,'Yenileme faturası oluşturdu',$l['license_key']);vp_flash('Yenileme faturanız hazır. Ödeme onaylandığında süre uzar.');vp_redirect('/panel/faturalar/'.$iid);}
        }
        vp_redirect('/panel/lisanslar/'.$lid);
    }
    $inv=vp_all('SELECT * FROM invoices WHERE license_id=? ORDER BY id DESC LIMIT 10',[$lid]);
    $upgrades=vp_all('SELECT id FROM products WHERE active=1 AND price>? AND id<>?',[(int)$l['pprice'],$l['product_id']]);
    vpc_start($c,$l['pname'],'/panel/lisanslar');
    vp_head('Lisans · '.vp_status('license',$l['status'])[0],$l['label']?:$l['pname'],$l['label']?$l['pname']:'','',[['/panel/lisanslar','Lisanslarım'],['#',$l['license_key']]]);
    $dl=$l['device_limit']===null?null:(int)$l['device_limit'];
    ?>
<div class="vp-grid vp-grid-main">
  <div class="vp-stack">
    <div class="vp-tickets"><?=vp_license_ticket($l,'#islemler')?></div>
    <section class="vp-card"><div class="vp-card-head"><h2>Kullanım ve sınırlar</h2></div>
      <div class="vp-split">
        <div class="vp-split-row"><span>Cihaz</span><b><?=(int)$l['devices_used']?> / <?=$dl===null?'Sınırsız':$dl?></b><?php if($dl):?><progress class="vp-meter" max="<?=$dl?>" value="<?=min($dl,(int)$l['devices_used'])?>"></progress><?php endif;?></div>
      </div>
      <dl class="vp-dl"><br><dt>Depo</dt><dd><?=$l['warehouse_limit']===null?'Sınırsız':(int)$l['warehouse_limit']?></dd><dt>Kullanıcı</dt><dd><?=$l['user_limit']===null?'Sınırsız':(int)$l['user_limit']?></dd><dt>Asistan</dt><dd><?=$l['ai_limit']===null?'Sınırsız':((int)$l['ai_limit']?(int)$l['ai_limit'].' sorgu / ay':'Yok')?></dd><dt>Başlangıç</dt><dd><?=e(vp_date($l['starts_at']))?></dd><dt>Bitiş</dt><dd><?=$l['expires_at']?e(vp_date($l['expires_at'])):'Süresiz'?></dd><?php if(in_array($l['period'],['year','quarter','month'],true)):?><dt>Yenileme</dt><dd><?=e(vp_money((int)$l['price']))?> <?=e(vp_period_suffix($l['period']))?></dd><?php endif;?></dl>
    </section>
    <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Faturalar</h2></div>
      <?php if(!$inv): echo vp_empty('Fatura yok.'); else:?><div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th><th>Durum</th><th class="num">Toplam</th><th>Tarih</th></tr></thead><tbody><?php foreach($inv as $i):?><tr><td data-l="No"><a class="vp-strong" href="/panel/faturalar/<?=$i['id']?>"><?=e($i['number'])?></a></td><td data-l="Durum"><?=vp_badge('invoice',$i['status'])?></td><td data-l="Toplam" class="num"><?=e(vp_money((int)$i['total']))?></td><td data-l="Tarih" class="nowrap vp-muted"><?=e(vp_date($i['created_at']))?></td></tr><?php endforeach;?></tbody></table></div><?php endif;?>
    </section>
  </div>
  <div class="vp-stack" id="islemler">
    <section class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>İşlemler</h2></div>
      <div class="vp-stack">
        <?php if(in_array($l['period'],['year','quarter','month'],true)&&$l['status']!=='iptal'):?>
        <form method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="yenile"><button class="vp-btn vp-btn--block" type="submit">Şimdi yenile</button><small class="vp-muted">Kalan süre korunur, bir dönem eklenir.</small></form>
        <?php endif;?>
        <?php if($upgrades&&$l['status']==='aktif'):?><a class="vp-btn vp-btn--ink vp-btn--block" href="/panel/yukselt/<?=$lid?>">Paketi yükselt</a><?php endif;?>
        <form method="post" data-confirm="Kayıtlı cihazlar sıfırlanacak. Programı kullanan cihazlar yeniden etkinleştirme isteyebilir. Devam edilsin mi?"><?=vp_csrf_field()?><input type="hidden" name="op" value="cihaz"><button class="vp-btn vp-btn--ghost vp-btn--block" type="submit">Cihazları sıfırla</button><small class="vp-muted">Bilgisayar değiştirdiyseniz kullanın. <?=(int)vp_setting('device_reset_hours','24')?> saatte bir.</small></form>
      </div>
    </section>
    <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="etiket"><div class="vp-card-head"><h2>Etiket</h2></div>
      <label class="vp-field"><span>Bu lisansı nerede kullanıyorsunuz?</span><input type="text" name="label" maxlength="80" value="<?=e($l['label'])?>" placeholder="Örn. Merkez mağaza kasası"></label>
      <button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Kaydet</button></form>
    <section class="vp-card"><div class="vp-card-head"><h2>Pakette neler var</h2></div><ul class="vp-features"><?php foreach(array_filter(preg_split('/\R/',$l['features'])?:[]) as $f):?><li><?=e($f)?></li><?php endforeach;?></ul></section>
  </div>
</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- sipariş
function vpc_plan_card(array $p,string $href,string $button): string {
    $feat=array_slice(array_filter(preg_split('/\R/',$p['features'])?:[]),0,7);
    return '<article class="vp-plan'.($p['featured']?' vp-plan--featured':'').'">'.($p['featured']?'<span class="vp-plan-ribbon">En çok tercih edilen</span>':'').'<span class="vp-label">Veniux · '.e(vp_period_label($p['period'])).'</span><h3>'.e($p['name']).'</h3><p class="vp-plan-tag">'.e($p['tagline']).'</p>'
        .'<div class="vp-plan-price">'.((int)$p['price']===0?'0 ₺':e(vp_money((int)$p['price']))).'<small>'.e(vp_period_suffix($p['period'])).'</small></div><small>'.(vp_setting('prices_include_tax','1')==='1'?'KDV dahil':'+ KDV').'</small>'
        .'<ul>'.implode('',array_map(fn($f)=>'<li>'.e($f).'</li>',$feat)).'</ul><a class="vp-btn '.($p['featured']?'':'vp-btn--ink').' vp-btn--block" href="'.e($href).'">'.e($button).'</a></article>';
}

function vpc_order_plans(array $c): void {
    $plans=vp_all('SELECT * FROM products WHERE active=1 ORDER BY sort,id');
    vpc_start($c,'Paket satın al','/panel/siparis');
    vp_head('Hizmetlerim','İşinize uygun paketi seçin.','Ödeme havale/EFT ile alınır; onaylandığında lisansınız bu panelde açılır.');
    if(vp_setting('orders_open','1')!=='1'||vpc_blocked($c))echo '<div class="vp-flash vp-flash--info">Şu an panelden sipariş alınmıyor. Teklif için <a href="/panel/destek/yeni">destek talebi</a> açabilirsiniz.</div>';
    echo $plans?'<div class="vp-plans">'.implode('',array_map(fn($p)=>vpc_plan_card($p,'/panel/siparis/'.$p['code'],(int)$p['price']===0?'Ücretsiz başla':'Seç ve devam et'),$plans)).'</div>':vp_empty('Satışta paket yok.');
    $addons=vp_all('SELECT * FROM addons WHERE active=1');
    if($addons){echo '<br><section class="vp-card vp-card--kraft"><div class="vp-card-head"><h2>Eklentiler</h2></div><ul class="vp-list">';foreach($addons as $ad)echo '<li><div><b>'.e($ad['name']).'</b><span class="vp-sub">'.e($ad['description']).'</span></div><a class="vp-btn vp-btn--ghost vp-btn--sm" href="/panel/destek/yeni?konu='.rawurlencode($ad['name'].' eklentisi').'">Teklif iste</a></li>';echo '</ul></section>';}
    vp_shell_end();
}

function vpc_order_form(array $c,array $p,string $kind,?array $license,string $action): void {
    $err='';$couponCode=vp_post('coupon',40);
    $amount=$kind==='yukseltme'?max(0,(int)$p['price']-(int)($license['price']??0)):(int)$p['price'];
    [$coupon,$cerr]=$couponCode!==''?vp_coupon_check($couponCode,$p):[null,''];
    $discount=vp_coupon_discount($coupon,$amount);
    if(vp_is_post()&&($_POST['op']??'')==='onay'){
        if(vp_setting('orders_open','1')!=='1'||vpc_blocked($c)||$c['status']!=='aktif')$err='Hesabınızdan şu an sipariş verilemiyor. Destek ekibiyle iletişime geçin.';
        elseif($cerr)$err=$cerr;
        elseif(!isset($_POST['terms']))$err='Devam etmek için hizmet koşullarını onaylayın.';
        elseif($kind==='yeni'&&(int)$p['price']===0&&vp_val("SELECT 1 FROM licenses WHERE client_id=? AND product_id=? AND status<>'iptal'",[$c['id'],$p['id']]))$err='Bu ücretsiz paket hesabınızda zaten var.';
        elseif(vp_val("SELECT COUNT(*) FROM orders WHERE client_id=? AND status='bekliyor'",[$c['id']])>=5)$err='Bekleyen çok sayıda siparişiniz var. Önce mevcut faturaları ödeyin veya iptal için bize yazın.';
        else{
            [$oid,$iid]=vp_place_order((int)$c['id'],$p,$kind,$license?(int)$license['id']:null,$coupon,vp_post('note',500),$kind==='yukseltme'?$amount:null);
            vpc_log($c,'Sipariş verdi',$p['name'].' · '.vpa_kind_label($kind));
            $paid=vp_val('SELECT status FROM invoices WHERE id=?',[$iid])==='odendi';
            vp_flash($paid?'Lisansınız açıldı. Anahtarınızı Lisanslarım sayfasında bulabilirsiniz.':'Siparişiniz alındı. Faturanızı ödediğinizde lisansınız açılır.');
            vp_redirect($paid?'/panel/lisanslar':'/panel/faturalar/'.$iid);
        }
    }
    [$sub,$tax,$total,$rate]=vp_tax_split($amount-$discount);
    vpc_start($c,'Sipariş','/panel/siparis');
    vp_head($kind==='yukseltme'?'Paket yükseltme':'Sipariş',$p['name'],$p['tagline'],'',[['/panel/siparis','Paketler'],['#',$p['name']]]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    ?>
<form class="vp-grid vp-grid-main" method="post" action="<?=e($action)?>"><?=vp_csrf_field()?>
  <div class="vp-stack">
    <section class="vp-card"><div class="vp-card-head"><h2>Paket</h2><span class="vp-label"><?=e(vp_period_label($p['period']))?></span></div>
      <?php if($license):?><div class="vp-note">Yükseltilen lisans: <b class="vp-mono"><?=e($license['license_key'])?></b> (<?=e($license['pname'])?>). Fark tutarı ödenir; bitiş tarihi korunur.</div><br><?php endif;?>
      <ul class="vp-features"><?php foreach(array_filter(preg_split('/\R/',$p['features'])?:[]) as $f):?><li><?=e($f)?></li><?php endforeach;?></ul>
    </section>
    <section class="vp-card vp-form"><div class="vp-card-head"><h2>Kupon ve not</h2></div>
      <div class="vp-row"><label class="vp-field"><span>Kupon kodu</span><input type="text" name="coupon" maxlength="40" value="<?=e($couponCode)?>" class="vp-mono"><?php if($couponCode!==''):?><small class="<?=$cerr?'':'vp-copy-ok'?>"><?=$cerr?e($cerr):'Kupon uygulandı: −'.e(vp_money($discount))?></small><?php endif;?></label>
      <div class="vp-field"><span>&nbsp;</span><button class="vp-btn vp-btn--ghost" type="submit" name="op" value="kupon" formnovalidate>Kuponu uygula</button></div></div>
      <label class="vp-field"><span>Sipariş notu</span><input type="text" name="note" maxlength="500" value="<?=e(vp_post('note',500))?>" placeholder="Fatura veya kurulumla ilgili notunuz"></label>
    </section>
  </div>
  <aside class="vp-card vp-card--kraft vp-tape vp-summary"><div class="vp-card-head"><h2>Özet</h2></div>
    <div class="vp-summary-row"><span><?=e($p['name'])?></span><span><?=e(vp_money($amount))?></span></div>
    <?php if($discount):?><div class="vp-summary-row"><span>İndirim · <?=e($coupon['code'])?></span><span>−<?=e(vp_money($discount))?></span></div><?php endif;?>
    <div class="vp-summary-row"><span>Ara toplam</span><span><?=e(vp_money($sub))?></span></div>
    <div class="vp-summary-row"><span>KDV %<?=$rate?></span><span><?=e(vp_money($tax))?></span></div>
    <div class="vp-summary-total"><span>Ödenecek</span><strong><?=e(vp_money($total))?></strong></div><br>
    <label class="vp-check"><input type="checkbox" name="terms" value="1" required> <span><a href="/kullanim-kosullari" target="_blank" rel="noopener">Hizmet koşullarını</a> okudum, onaylıyorum.</span></label><br>
    <button class="vp-btn vp-btn--block" type="submit" name="op" value="onay"><?=$total>0?'Siparişi onayla':'Ücretsiz lisansı aç'?></button>
    <?php if($total>0):?><p class="vp-muted"><br><small>Sipariş sonrası fatura oluşur. Havale/EFT ile ödeyip bildirim gönderin<?=vp_setting('allow_balance_pay','1')==='1'?' veya bakiyenizle ödeyin':''?>.</small></p><?php endif;?>
  </aside>
</form>
<?php
    vp_shell_end();
}
function vpa_kind_label(string $k): string { return ['yeni'=>'Yeni lisans','yenileme'=>'Yenileme','yukseltme'=>'Yükseltme'][$k]??$k; }

function vpc_order_configure(array $c,string $code): void {
    $p=vp_row('SELECT * FROM products WHERE code=? AND active=1',[$code]);
    if(!$p){vp_flash('Paket bulunamadı.','err');vp_redirect('/panel/siparis');}
    vpc_order_form($c,$p,'yeni',null,'/panel/siparis/'.$p['code']);
}

function vpc_upgrade(array $c,string $id): void {
    $l=vp_row("SELECT l.*,p.name pname,p.price pprice FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.id=? AND l.client_id=? AND l.status='aktif'",[(int)$id,$c['id']]);
    if(!$l){vp_flash('Lisans yükseltilemez.','err');vp_redirect('/panel/lisanslar');}
    $to=vp_int($_GET['paket']??$_POST['paket']??null);
    if($to){$p=vp_row('SELECT * FROM products WHERE id=? AND active=1 AND price>?',[$to,(int)$l['pprice']]);if($p){vpc_order_form($c,$p,'yukseltme',$l,'/panel/yukselt/'.$l['id'].'?paket='.$p['id']);return;}}
    $plans=vp_all('SELECT * FROM products WHERE active=1 AND price>? AND id<>? ORDER BY sort',[(int)$l['pprice'],$l['product_id']]);
    vpc_start($c,'Paketi yükselt','/panel/lisanslar');
    vp_head('Paket yükseltme','Daha fazlası için yükseltin.','Mevcut lisans: '.$l['pname'].' · '.$l['license_key'].'. Yalnız fark tutarını ödersiniz.','',[['/panel/lisanslar','Lisanslarım'],['/panel/lisanslar/'.$l['id'],$l['license_key']],['#','Yükselt']]);
    echo $plans?'<div class="vp-plans">'.implode('',array_map(fn($p)=>vpc_plan_card($p,'/panel/yukselt/'.$l['id'].'?paket='.$p['id'],'Bu pakete yükselt'),$plans)).'</div>':vp_empty('Daha üst paket yok.');
    vp_shell_end();
}

function vpc_orders(array $c): void {
    $rows=vp_all('SELECT o.*,p.name pname FROM orders o JOIN products p ON p.id=o.product_id WHERE o.client_id=? ORDER BY o.id DESC',[$c['id']]);
    vpc_start($c,'Siparişlerim','/panel/siparisler');
    vp_head('Hesap ve ödeme','Siparişlerim');
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Sipariş yok.','','<a class="vp-btn" href="/panel/siparis">Paketleri incele</a>');
    else{echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th><th>Paket</th><th>Tür</th><th>Durum</th><th class="num">Tutar</th><th>Tarih</th><th></th></tr></thead><tbody>';
        foreach($rows as $o)echo '<tr><td data-l="No" class="vp-mono">'.e($o['number']).'</td><td data-l="Paket">'.e($o['pname']).'</td><td data-l="Tür">'.e(vpa_kind_label($o['kind'])).'</td><td data-l="Durum">'.vp_badge('order',$o['status']).'</td><td data-l="Tutar" class="num">'.e(vp_money((int)$o['total'])).'</td><td data-l="Tarih" class="nowrap vp-muted">'.e(vp_date($o['created_at'])).'</td><td>'.($o['invoice_id']?'<a href="/panel/faturalar/'.$o['invoice_id'].'">Fatura →</a>':'').'</td></tr>';
        echo '</tbody></table></div>';}
    echo '</section>';vp_shell_end();
}

/** PayTR güvenli ödeme çerçevesi. */
function vpc_paytr_page(array $c,string $oid): void {
    $a=vp_row("SELECT p.*,i.number,i.total,i.status istatus FROM payment_attempts p JOIN invoices i ON i.id=p.invoice_id WHERE p.oid=? AND p.client_id=? AND p.gateway='paytr'",[$oid,$c['id']]);
    if(!$a){vp_flash('Ödeme oturumu bulunamadı.','err');vp_redirect('/panel/faturalar');}
    if($a['istatus']!=='odenmedi'||$a['status']!=='bekliyor'||$a['token']===''||strtotime($a['created_at'].' UTC')<time()-1800)vp_redirect('/panel/faturalar/'.$a['invoice_id'].'?odeme=1');
    $GLOBALS['vp_frame_src']='https://www.paytr.com';
    vpc_start($c,'Kartla ödeme','/panel/faturalar');
    vp_head('Güvenli ödeme · PayTR',$a['number'].' · '.vp_money((int)$a['amount']),'Kart bilgilerinizi aşağıdaki PayTR formuna girin. Ödeme tamamlanınca faturanıza dönersiniz.','<a class="vp-btn vp-btn--ghost" href="/panel/faturalar/'.$a['invoice_id'].'">Vazgeç</a>',[['/panel/faturalar','Faturalarım'],['/panel/faturalar/'.$a['invoice_id'],$a['number']],['#','Ödeme']]);
    if($a['test_mode'])echo '<div class="vp-flash vp-flash--info">Test modu açık: gerçek tahsilat yapılmaz. PayTR test kartlarını kullanın.</div>';
    echo '<section class="vp-card vp-card--flush"><iframe class="vp-pay-iframe" src="'.e(VP_PAYTR_IFRAME_URL.rawurlencode($a['token'])).'" title="PayTR güvenli ödeme formu" allow="payment" referrerpolicy="origin"></iframe></section>';
    echo '<p class="vp-secure"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7.5a4 4 0 018 0V11"/></svg>Form PayTR tarafından sunulur; kart bilgileriniz Veniux’a iletilmez.</p>';
    vp_shell_end();
}

// ---------------------------------------------------------------- faturalar
function vpc_invoices(array $c): void {
    $st=vp_get('durum',20);$args=[$c['id']];$w='client_id=?';
    if(in_array($st,['odenmedi','odendi','iptal','iade'],true)){$w.=' AND status=?';$args[]=$st;}
    $rows=vp_all("SELECT * FROM invoices WHERE $w ORDER BY id DESC",$args);
    vpc_start($c,'Faturalarım','/panel/faturalar');
    vp_head('Hesap ve ödeme','Faturalarım','Proforma faturalarınız. Resmî e-fatura/e-arşiv ayrıca iletilir.');
    echo '<div class="vp-chips">';foreach([''=>'Tümü','odenmedi'=>'Ödenmedi','odendi'=>'Ödendi','iptal'=>'İptal'] as $k=>$l)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'</a>';echo '</div>';
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Fatura yok.');
    else{echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th><th>Açıklama</th><th>Durum</th><th class="num">Toplam</th><th>Son ödeme</th><th></th></tr></thead><tbody>';
        foreach($rows as $i){$desc=(string)vp_val('SELECT description FROM invoice_items WHERE invoice_id=? ORDER BY id LIMIT 1',[$i['id']]);
            echo '<tr><td data-l="No"><a class="vp-strong" href="/panel/faturalar/'.$i['id'].'">'.e($i['number']).'</a></td><td data-l="Açıklama">'.e(mb_strimwidth($desc,0,60,'…','UTF-8')).'</td><td data-l="Durum">'.vp_badge('invoice',$i['status']).'</td><td data-l="Toplam" class="num"><b>'.e(vp_money((int)$i['total'])).'</b></td><td data-l="Son ödeme" class="nowrap">'.e(vp_date($i['due_at'])).'</td><td>'.($i['status']==='odenmedi'?'<a class="vp-btn vp-btn--sm" href="/panel/faturalar/'.$i['id'].'">Öde</a>':'<a href="/panel/faturalar/'.$i['id'].'">Görüntüle</a>').'</td></tr>';}
        echo '</tbody></table></div>';}
    echo '</section>';vp_shell_end();
}

function vpc_invoice_view(array $c,string $id): void {
    $inv=vp_row('SELECT * FROM invoices WHERE id=? AND client_id=?',[(int)$id,$c['id']]);
    if(!$inv){vp_flash('Fatura bulunamadı.','err');vp_redirect('/panel/faturalar');}
    $iid=(int)$inv['id'];
    if(vp_is_post()&&$inv['status']==='odenmedi'){
        $op=vp_post('op',10);
        if($op==='bakiye'&&vp_setting('allow_balance_pay','1')==='1'){
            $pdo=vp_db();$pdo->beginTransaction();
            $bal=(int)vp_val('SELECT balance FROM clients WHERE id=? FOR UPDATE',[$c['id']]);
            if($bal<(int)$inv['total']){$pdo->rollBack();vp_flash('Bakiyeniz bu faturayı ödemeye yetmiyor.','err');}
            else{vp_add_balance((int)$c['id'],-(int)$inv['total'],'Fatura ödemesi · '.$inv['number']);$pdo->commit();vp_mark_paid($iid,'bakiye');vpc_log($c,'Faturayı bakiyeyle ödedi',$inv['number']);vp_flash('Fatura bakiyenizden ödendi.');}
        }elseif(($op==='paytr'||$op==='iyzico')&&isset(vp_card_gateways()[$op])){
            if((int)$inv['total']<=0){vp_flash('Bu faturada ödenecek tutar yok.','info');vp_redirect('/panel/faturalar/'.$iid);}
            if(!vp_rate_ok('card-'.$c['id'],12,900)){vp_flash('Kısa sürede çok fazla ödeme denemesi yaptınız. 15 dakika sonra tekrar deneyin.','err');vp_redirect('/panel/faturalar/'.$iid);}
            $attempt=vp_attempt_create($op,$inv);$ip=vp_ip();
            if($op==='iyzico'){
                [$ok,$res]=vp_iyzico_init($attempt,$inv,$c,$ip);
                if($ok){vpc_log($c,'iyzico ile ödemeye geçti',$inv['number']);header('Location: '.$res,true,303);exit;}
            }else{
                [$ok,$res]=vp_paytr_token($attempt,$inv,$c,$ip);
                if($ok){vp_update('payment_attempts',(int)$attempt['id'],['token'=>$res,'updated_at'=>vp_now()]);vpc_log($c,'PayTR ile ödemeye geçti',$inv['number']);vp_redirect('/panel/odeme/'.$attempt['oid']);}
            }
            vp_attempt_fail($attempt['oid'],'Başlatılamadı: '.$res);
            error_log('[veniux-panel] '.$op.' init failed: '.$res);
            vp_flash('Ödeme sayfası şu anda açılamadı. Lütfen biraz sonra tekrar deneyin veya başka bir yöntem seçin.'.(vp_gateway_test_mode($op)?' (Test modu: '.$res.')':''),'err');
        }elseif($op==='havale'){
            $amount=vp_parse_money($_POST['amount']??'');$sender=vp_post('sender',120);
            $pending=vp_row("SELECT * FROM transfer_notices WHERE invoice_id=? AND status='bekliyor' ORDER BY id DESC LIMIT 1",[$iid]);
            $data=['amount'=>$amount,'sender'=>$sender,'bank'=>vp_post('bank',80),'reference'=>vp_post('reference',120)];
            if(!$amount||$amount<=0||$sender==='')vp_flash('Gönderen ad / unvan ve tutar girin.','err');
            elseif($pending){
                // İncelemedeki bildirim güncellenir (unvan, tutar, banka düzeltmeleri yöneticiye aynen yansır).
                vp_update('transfer_notices',(int)$pending['id'],$data+['created_at'=>vp_now()]);
                vpc_log($c,'Havale bildirimini güncelledi',$inv['number'].' · gönderen: '.$sender.' · '.vp_money($amount));
                if(function_exists('vp_notify_invoice'))vp_notify_invoice('admin_transfer',$iid,['vars'=>['gonderen'=>$sender,'tutar'=>vp_money($amount)]]);
                vp_flash('Bildiriminiz güncellendi.');
            }else{
                vp_insert('transfer_notices',$data+['invoice_id'=>$iid,'client_id'=>$c['id'],'status'=>'bekliyor','created_at'=>vp_now()]);
                vpc_log($c,'Havale bildirimi gönderdi',$inv['number'].' · gönderen: '.$sender.' · '.vp_money($amount));
                if(function_exists('vp_notify_invoice')){vp_notify_invoice('transfer_received',$iid,['vars'=>['tutar'=>vp_money($amount)]]);vp_notify_invoice('admin_transfer',$iid,['vars'=>['gonderen'=>$sender,'tutar'=>vp_money($amount)]]);}
                vp_flash('Bildiriminiz alındı. Ödeme hesaba geçtiğinde faturanız onaylanır.');
            }
        }
        vp_redirect('/panel/faturalar/'.$iid);
    }
    $items=vp_all('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id',[$iid]);
    $notice=vp_row('SELECT * FROM transfer_notices WHERE invoice_id=? ORDER BY id DESC LIMIT 1',[$iid]);
    $gateways=$inv['status']==='odenmedi'?vp_card_gateways():[];
    $last=isset($_GET['odeme'])?vp_row('SELECT * FROM payment_attempts WHERE invoice_id=? ORDER BY id DESC LIMIT 1',[$iid]):null;
    vpc_start($c,$inv['number'],'/panel/faturalar');
    if($last){
        if($last['status']==='basarili'||$inv['status']==='odendi')echo '<div class="vp-flash vp-flash--ok" role="status">Ödemeniz alındı, teşekkürler. Faturanız ödendi'.($inv['order_id']||$inv['kind']==='yenileme'?' ve lisansınız güncellendi':'').'.</div>';
        elseif($last['status']==='bekliyor')echo '<div class="vp-flash vp-flash--info" role="status">Ödemeniz işleniyor; sağlayıcıdan onay bekleniyor. <a href="/panel/faturalar/'.$iid.'?odeme=1">Durumu yenile</a></div>';
        elseif($last['status']==='inceleme')echo '<div class="vp-flash vp-flash--info" role="status">Ödemeniz güvenlik incelemesinde. Onaylandığında faturanız kendiliğinden ödenecek.</div>';
        else echo '<div class="vp-flash vp-flash--err" role="alert">Ödeme tamamlanamadı'.($last['message']?': '.e(mb_strimwidth($last['message'],0,140,'…','UTF-8')):'').'. Kartınızdan çekim yapılmadı; tekrar deneyebilir veya başka bir yöntem seçebilirsiniz.</div>';
    }
    vp_head('Fatura',$inv['number'],'','<button class="vp-btn vp-btn--ghost" type="button" data-print>'.vp_icon('print').'Yazdır / PDF</button>',[['/panel/faturalar','Faturalarım'],['#',$inv['number']]]);
    ?>
<div class="vp-grid vp-grid-main">
  <?=vp_invoice_document($inv,$c,$items)?>
  <div class="vp-stack vp-no-print">
  <?php if($inv['status']==='odenmedi'&&$gateways):?>
    <section class="vp-card vp-tape"><div class="vp-card-head"><div><span class="vp-label">Hemen öde</span><h2>Kartla öde · <?=e(vp_money((int)$inv['total']))?></h2></div></div>
      <form method="post" class="vp-pay"><?=vp_csrf_field()?>
        <?php foreach($gateways as $g=>$gw):?><button class="vp-pay-option vp-pay-option--card" type="submit" name="op" value="<?=e($g)?>"><span class="vp-gw-logo vp-gw-logo--<?=e($g)?>"><?=$g==='paytr'?'PayTR':'iyzico'?></span><span><b><?=e($gw['label'])?></b><small><?=$g==='paytr'?'Ödeme formu bu sayfada açılır':'iyzico güvenli ödeme sayfasına geçersiniz'?> · 3D Secure<?=$gw['test']?' · TEST MODU':''?></small></span><span class="vp-pay-arrow" aria-hidden="true">→</span></button><?php endforeach;?>
      </form>
      <p class="vp-secure"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7.5a4 4 0 018 0V11"/></svg>Kart bilgileriniz Veniux’a iletilmez; ödeme sağlayıcısının güvenli sayfasında girilir.</p>
    </section>
  <?php endif;?>
  <?php if($inv['status']==='odenmedi'&&vp_setting('transfer_enabled','1')==='1'):?>
    <section class="vp-card vp-card--ink"><span class="vp-label vp-label--light">Havale / EFT bilgileri</span><h2><?=e(vp_money((int)$inv['total']))?></h2><br>
      <?php foreach(array_filter(preg_split('/\R/',vp_setting('bank_accounts'))?:[]) as $line):?><p class="vp-mono"><?=e($line)?></p><?php endforeach;?>
      <p><small><?=e(vp_setting('transfer_note'))?></small></p>
      <div class="vp-ticket-key"><span>Açıklama: <?=e($inv['number'])?></span><button type="button" data-copy="<?=e($inv['number'])?>">Kopyala</button></div>
    </section>
    <?php $pend=$notice&&$notice['status']==='bekliyor';?>
      <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="havale">
        <div class="vp-card-head"><h2><?=$pend?'Bildiriminiz incelemede':'Ödemeyi bildirin'?></h2><?=$pend?vp_badge('transfer','bekliyor'):''?></div>
        <?php if($pend):?><p class="vp-muted">Gönderildi: <?=e(vp_date($notice['created_at'],true))?>. Bilgilerde hata varsa düzeltip güncelleyebilirsiniz.</p><?php endif;?>
        <?php if($notice&&$notice['status']==='reddedildi'):?><div class="vp-flash vp-flash--err">Önceki bildiriminiz doğrulanamadı. Bilgileri kontrol edip tekrar gönderin.</div><?php endif;?>
        <label class="vp-field"><span>Gönderen ad / unvan</span><input type="text" name="sender" required maxlength="120" value="<?=e($pend?$notice['sender']:$c['company'])?>"><small>Havaleyi gönderen hesap sahibinin adı veya şirket unvanı.</small></label>
        <div class="vp-row"><label class="vp-field"><span>Tutar (₺)</span><input type="text" name="amount" required inputmode="decimal" value="<?=e(vp_input_money($pend?(int)$notice['amount']:(int)$inv['total']))?>"></label><label class="vp-field"><span>Banka</span><input type="text" name="bank" maxlength="80" value="<?=e($pend?$notice['bank']:'')?>"></label></div>
        <label class="vp-field"><span>Dekont / referans no</span><input type="text" name="reference" maxlength="120" value="<?=e($pend?$notice['reference']:'')?>"></label>
        <button class="vp-btn<?=$pend?' vp-btn--ink':''?>" type="submit"><?=$pend?'Bildirimi güncelle':'Bildirimi gönder'?></button></form>
    <?php endif;?>
    <?php if($inv['status']==='odenmedi'&&vp_setting('allow_balance_pay','1')==='1'&&(int)$c['balance']>0):?>
      <form class="vp-card" method="post" data-confirm="<?=e(vp_money((int)$inv['total']))?> bakiyenizden düşülecek. Onaylıyor musunuz?"><?=vp_csrf_field()?><input type="hidden" name="op" value="bakiye"><div class="vp-card-head"><h2>Bakiyeyle öde</h2></div><p>Bakiyeniz: <b><?=e(vp_money((int)$c['balance']))?></b></p><button class="vp-btn vp-btn--ink" type="submit"<?=(int)$c['balance']<(int)$inv['total']?' disabled':''?>>Bakiyeden öde</button></form>
    <?php endif;?>
  <?php if($inv['status']!=='odenmedi'):?>
    <section class="vp-card vp-card--kraft"><div class="vp-card-head"><h2>Durum</h2><?=vp_badge('invoice',$inv['status'])?></div><dl class="vp-dl"><dt>Ödeme</dt><dd><?=e(vp_date($inv['paid_at'],true))?></dd><dt>Yöntem</dt><dd><?=e($inv['payment_method']?vp_method_label($inv['payment_method']):'—')?></dd></dl></section>
  <?php endif;?>
  </div>
</div>
<?php
    vp_shell_end();
}

function vpc_balance(array $c): void {
    $tx=vp_all('SELECT * FROM balance_tx WHERE client_id=? ORDER BY id DESC LIMIT 100',[$c['id']]);
    vpc_start($c,'Bakiye','/panel/bakiye');
    vp_head('Hesap ve ödeme','Bakiye','İade ve ön ödemeler bakiyenizde birikir; faturalarınızı bakiyeyle ödeyebilirsiniz.');
    ?>
<div class="vp-grid vp-grid-main">
  <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Hareketler</h2></div>
  <?php if(!$tx): echo vp_empty('Bakiye hareketi yok.'); else:?><div class="vp-table-wrap"><table class="vp-table"><thead><tr><th>Açıklama</th><th class="num">Tutar</th><th>Tarih</th></tr></thead><tbody><?php foreach($tx as $t):?><tr><td><?=e($t['description'])?></td><td class="num"><b><?=$t['amount']>0?'+':''?><?=e(vp_money((int)$t['amount']))?></b></td><td class="nowrap vp-muted"><?=e(vp_date($t['created_at'],true))?></td></tr><?php endforeach;?></tbody></table></div><?php endif;?></section>
  <section class="vp-card vp-card--ink vp-tape"><span class="vp-label vp-label--light">Kullanılabilir bakiye</span><div class="vp-plan-price vp-plan-price--light"><?=e(vp_money((int)$c['balance']))?></div><p><br>Ön ödeme yapmak için havale yapıp destek talebiyle bize bildirin; tutar bakiyenize eklenir.</p><a class="vp-btn" href="/panel/destek/yeni?konu=<?=rawurlencode('Bakiye yükleme')?>&departman=lisans">Bakiye yükleme talebi</a></section>
</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- destek
function vpc_tickets(array $c): void {
    $rows=vp_all('SELECT * FROM tickets WHERE client_id=? ORDER BY status=\'kapali\',updated_at DESC',[$c['id']]);
    $deps=vp_departments();
    vpc_start($c,'Destek talepleri','/panel/destek');
    vp_head('Yardım','Destek talepleri','Kurulum, cihaz, lisans veya ödeme konusunda bize yazın.','<a class="vp-btn" href="/panel/destek/yeni">'.vp_icon('plus').'Yeni talep</a>');
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Henüz talebiniz yok.','Sorunuz mu var? Önce bilgi bankasına göz atın, bulamazsanız talep açın.','<a class="vp-btn" href="/panel/destek/yeni">Talep aç</a>');
    else{echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Konu</th><th>Departman</th><th>Durum</th><th>Son hareket</th></tr></thead><tbody>';
        foreach($rows as $t)echo '<tr><td data-l="Konu"><a class="vp-strong" href="/panel/destek/'.$t['id'].'">'.e($t['subject']).'</a><span class="vp-sub vp-mono">#'.e($t['number']).'</span></td><td data-l="Departman">'.e($deps[$t['department']]??$t['department']).'</td><td data-l="Durum">'.vp_badge('ticket',$t['status']==='yanitlandi'?'yanitlandi':$t['status']).'</td><td data-l="Son hareket" class="nowrap vp-muted">'.e(vp_ago($t['updated_at'])).'</td></tr>';
        echo '</tbody></table></div>';}
    echo '</section>';vp_shell_end();
}

function vpc_ticket_new(array $c): void {
    $err='';$lic=vp_all("SELECT l.id,l.license_key,p.name FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.client_id=? AND l.status<>'iptal'",[$c['id']]);
    if(vp_is_post()){
        $subject=vp_post('subject',200);$body=vp_post('body',20000);
        $dep=array_key_exists($_POST['department']??'',vp_departments())?$_POST['department']:array_key_first(vp_departments());
        $pri=in_array($_POST['priority']??'',['dusuk','normal','yuksek','acil'],true)?$_POST['priority']:'normal';
        $lid=vp_int($_POST['license_id']??null);if($lid&&!in_array($lid,array_map('intval',array_column($lic,'id')),true))$lid=null;
        if(vpc_blocked($c))$err='Hesabınızdan talep açılamıyor.';
        elseif($subject===''||mb_strlen($body)<10)$err='Konu ve en az 10 karakterlik açıklama yazın.';
        elseif(!vp_rate_ok('ticket-'.$c['id'],6,3600))$err='Kısa sürede çok fazla talep açtınız. Lütfen biraz sonra tekrar deneyin.';
        else{
            $now=vp_now();$tid=vp_insert('tickets',['number'=>vp_ticket_number(),'client_id'=>$c['id'],'license_id'=>$lid,'subject'=>$subject,'department'=>$dep,'priority'=>$pri,'status'=>'acik','created_at'=>$now,'updated_at'=>$now]);
            vp_insert('ticket_messages',['ticket_id'=>$tid,'author_type'=>'client','author_id'=>$c['id'],'author_name'=>$c['contact_name']?:$c['company'],'body'=>$body,'internal'=>0,'created_at'=>$now]);
            vpc_log($c,'Destek talebi açtı',$subject);
            if(function_exists('vp_notify_ticket')){vp_notify_ticket('ticket_opened',$tid);vp_notify_ticket('admin_ticket',$tid);}
            vp_flash('Talebiniz alındı. Yanıtımızı bu ekranda göreceksiniz.');vp_redirect('/panel/destek/'.$tid);
        }
    }
    $kb=vp_all('SELECT id,title FROM kb_articles WHERE published=1 ORDER BY views DESC LIMIT 4');
    vpc_start($c,'Yeni talep','/panel/destek');
    vp_head('Yardım','Yeni destek talebi','Sorunu ve ne zaman başladığını kısaca anlatın; ekran mesajını aynen yazarsanız daha hızlı çözeriz.','',[['/panel/destek','Destek'],['#','Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    ?>
<div class="vp-grid vp-grid-main">
  <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
    <label class="vp-field"><span>Konu</span><input type="text" name="subject" required maxlength="200" value="<?=e(vp_post('subject',200)?:vp_get('konu',200))?>"></label>
    <div class="vp-row-3 vp-row"><label class="vp-field"><span>Departman</span><?=vp_select('department',vp_departments(),vp_post('department',40)?:vp_get('departman',40))?></label>
    <label class="vp-field"><span>Öncelik</span><?=vp_select('priority',['dusuk'=>'Düşük','normal'=>'Normal','yuksek'=>'Yüksek','acil'=>'Acil: satış duruyor'],vp_post('priority',10)?:'normal')?></label>
    <label class="vp-field"><span>İlgili lisans</span><?=vp_select('license_id',[''=>'Seçilmedi']+array_column(array_map(fn($l)=>['id'=>$l['id'],'l'=>$l['name'].' · '.$l['license_key']],$lic),'l','id'),vp_post('license_id',10))?></label></div>
    <label class="vp-field"><span>Açıklama</span><textarea name="body" required rows="9" maxlength="20000"><?=e(vp_post('body',20000))?></textarea></label>
    <div class="vp-form-foot"><button class="vp-btn" type="submit">Talebi gönder</button></div>
  </form>
  <aside class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>Belki burada yazıyor</h2></div>
    <?php if(!$kb): echo '<p class="vp-muted">Bilgi bankası henüz boş.</p>'; else:?><ul class="vp-list"><?php foreach($kb as $k):?><li><div><a href="/panel/bilgi-bankasi/<?=$k['id']?>"><?=e($k['title'])?></a></div></li><?php endforeach;?></ul><?php endif;?>
  </aside>
</div>
<?php
    vp_shell_end();
}

function vpc_ticket_view(array $c,string $id): void {
    $t=vp_row('SELECT * FROM tickets WHERE id=? AND client_id=?',[(int)$id,$c['id']]);
    if(!$t){vp_flash('Talep bulunamadı.','err');vp_redirect('/panel/destek');}
    $tid=(int)$t['id'];
    if(vp_is_post()){
        $op=vp_post('op',10);
        if($op==='kapat'){vp_update('tickets',$tid,['status'=>'kapali','updated_at'=>vp_now()]);vpc_log($c,'Talebi kapattı','#'.$t['number']);vp_flash('Talep kapatıldı.');}
        else{$body=vp_post('body',20000);
            if($body!==''){vp_insert('ticket_messages',['ticket_id'=>$tid,'author_type'=>'client','author_id'=>$c['id'],'author_name'=>$c['contact_name']?:$c['company'],'body'=>$body,'internal'=>0,'created_at'=>vp_now()]);vp_update('tickets',$tid,['status'=>'musteri_yaniti','updated_at'=>vp_now()]);vpc_log($c,'Talebe yanıt yazdı','#'.$t['number']);if(function_exists('vp_notify_ticket'))vp_notify_ticket('admin_ticket',$tid);vp_flash('Yanıtınız gönderildi.');}}
        vp_redirect('/panel/destek/'.$tid);
    }
    $msgs=vp_all('SELECT * FROM ticket_messages WHERE ticket_id=? AND internal=0 ORDER BY id',[$tid]);
    vpc_start($c,$t['subject'],'/panel/destek');
    vp_head('Talep #'.$t['number'].' · '.(vp_departments()[$t['department']]??$t['department']),$t['subject'],'',vp_badge('ticket',$t['status']).($t['status']!=='kapali'?' '.vp_confirm_form('/panel/destek/'.$tid,'Talebi kapat','Sorununuz çözüldüyse talep kapatılacak. Devam edilsin mi?','vp-btn vp-btn--ghost vp-btn--sm',['op'=>'kapat']):''),[['/panel/destek','Destek'],['#','#'.$t['number']]]);
    echo '<div class="vp-thread">';
    foreach($msgs as $m){$staff=$m['author_type']==='admin';echo '<article class="vp-msg'.($staff?' vp-msg--staff':'').'"><header><b>'.e($m['author_name']).'</b>'.($staff?'<span class="vp-role">Veniux destek</span>':'').'<span>'.e(vp_date($m['created_at'],true)).'</span></header>'.vp_text($m['body']).'</article>';}
    echo '</div><br>';
    echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field().'<input type="hidden" name="op" value="yanit"><div class="vp-card-head"><h2>'.($t['status']==='kapali'?'Talebi yeniden açmak için yazın':'Yanıt yazın').'</h2></div><textarea name="body" required rows="6" maxlength="20000"></textarea><div class="vp-form-foot"><button class="vp-btn" type="submit">Gönder</button></div></form>';
    vp_shell_end();
}

// ---------------------------------------------------------------- indirmeler
function vpc_downloads(array $c): void {
    $downloads=@(require VP_SITE_ROOT.'/release-catalog.php')['downloads']??['windows'=>'—','android'=>'—'];
    vpc_start($c,'İndirmeler','/panel/indirmeler');
    vp_head('Hizmetlerim','İndirmeler','Windows programı ve Android uygulaması aynı kayıtlarla çalışır.','<a class="vp-btn vp-btn--ghost" href="/guncelleme-notlari">Güncelleme notları</a><a class="vp-btn vp-btn--ghost" href="/surum-arsivi">Tüm sürümler</a>');
    ?>
<div class="vp-tickets">
  <article class="vp-ticket"><div class="vp-ticket-main"><span class="vp-ticket-tag">Sürüm <?=e((string)$downloads['windows'])?></span><h3>Windows</h3><p>Windows 10/11, 64 bit. Kasa ve ofis için.</p></div><a class="vp-ticket-stub" href="/dosya/windows"><?=vp_barcode('win'.$downloads['windows'],34)?><b>İndir</b><span>Kurulum dosyası</span></a></article>
  <article class="vp-ticket"><div class="vp-ticket-main"><span class="vp-ticket-tag">Sürüm <?=e((string)$downloads['android'])?></span><h3>Android</h3><p>Android 8 ve üzeri. Depo ve raf arası için.</p></div><a class="vp-ticket-stub" href="/dosya/android"><?=vp_barcode('and'.$downloads['android'],34)?><b>İndir</b><span>Uygulama dosyası</span></a></article>
</div><br>
<div class="vp-note"><b>Önceden söyleyelim:</b> Windows kurulum dosyasında henüz doğrulanmış yayıncı imzası yok; SmartScreen uyarısı çıkabilir. “Ek bilgi” → “Yine de çalıştır” ile devam edin.</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- bilgi bankası
function vpc_kb(array $c): void {
    $q=vp_get('q',100);
    $rows=$q!==''?vp_all('SELECT * FROM kb_articles WHERE published=1 AND (title LIKE ? OR body LIKE ?) ORDER BY views DESC',["%$q%","%$q%"]):vp_all('SELECT * FROM kb_articles WHERE published=1 ORDER BY category,title');
    vpc_start($c,'Bilgi bankası','/panel/bilgi-bankasi');
    vp_head('Yardım',$q!==''?'“'.$q.'” için sonuçlar':'Bilgi bankası','Kurulum, lisans ve kullanım hakkında kısa rehberler.');
    if(!$rows){echo '<section class="vp-card">'.vp_empty('Sonuç bulunamadı.','Aradığınızı bulamadıysanız bize yazın.','<a class="vp-btn" href="/panel/destek/yeni">Talep aç</a>').'</section>';vp_shell_end();return;}
    $by=[];foreach($rows as $r)$by[$r['category']][]=$r;
    echo '<div class="vp-kb-cats">';
    foreach($by as $cat=>$items){echo '<section class="vp-card vp-kb-cat"><span class="vp-label">'.count($items).' makale</span><h3>'.e($cat).'</h3><ul class="vp-list">';foreach($items as $i)echo '<li><div><a href="/panel/bilgi-bankasi/'.$i['id'].'">'.e($i['title']).'</a></div></li>';echo '</ul></section>';}
    echo '</div>';vp_shell_end();
}

function vpc_kb_article(array $c,string $id): void {
    $r=vp_row('SELECT * FROM kb_articles WHERE id=? AND published=1',[(int)$id]);
    if(!$r){vp_flash('Makale bulunamadı.','err');vp_redirect('/panel/bilgi-bankasi');}
    vp_q('UPDATE kb_articles SET views=views+1 WHERE id=?',[$r['id']]);
    vpc_start($c,$r['title'],'/panel/bilgi-bankasi');
    vp_head($r['category'],$r['title'],'Güncelleme: '.vp_date($r['updated_at']),'',[['/panel/bilgi-bankasi','Bilgi bankası'],['#',$r['category']]]);
    echo '<article class="vp-card vp-article">'.vp_text($r['body']).'</article><br><div class="vp-note">Sorununuz çözülmedi mi? <a href="/panel/destek/yeni?konu='.rawurlencode($r['title']).'">Destek talebi açın</a>.</div>';
    vp_shell_end();
}

// ---------------------------------------------------------------- profil
function vpc_profile(array $c): void {
    if(vp_is_post()){
        $op=vp_post('op',10);
        if(str_starts_with($op,'foto')){if(!empty($_SESSION['vp_impersonator']))vp_flash('Yönetici görünümünde fotoğraf değiştirilemez.','err');else vp_avatar_post('c',(string)$c['id']);vp_redirect('/panel/profil');}
        if($op==='bilgi'){
            $d=['company'=>vp_post('company',160),'contact_name'=>vp_post('contact_name',120),'phone'=>vp_post('phone',40),'tax_office'=>vp_post('tax_office',80),'tax_no'=>preg_replace('/\D/','',vp_post('tax_no',20)),'address'=>vp_post('address',300),'city'=>vp_post('city',60),'notify_email'=>isset($_POST['notify_email'])?1:0,'notify_whatsapp'=>isset($_POST['notify_whatsapp'])?1:0];
            if($d['company']===''){vp_flash('İşletme adı boş olamaz.','err');}
            elseif($d['tax_no']!==''&&!in_array(strlen($d['tax_no']),[10,11],true)){vp_flash('VKN 10, TCKN 11 haneli olmalı.','err');}
            else{vp_update('clients',(int)$c['id'],$d);if($d['company']!==$c['company']&&$c['account_id']){try{vp_site_account_company($c['email'],$d['company']);}catch(Throwable){}if(isset($_SESSION['download_account']))$_SESSION['download_account']['company']=$d['company'];}vpc_log($c,'Profil bilgilerini güncelledi');vp_flash('Bilgileriniz kaydedildi.');}
        }elseif($op==='sifre'){
            $cur=is_string($_POST['current']??null)?$_POST['current']:'';$new=is_string($_POST['password']??null)?$_POST['password']:'';$new2=is_string($_POST['password2']??null)?$_POST['password2']:'';
            if(!empty($_SESSION['vp_impersonator']))vp_flash('Yönetici görünümünde şifre değiştirilemez.','err');
            elseif(mb_strlen($new)<14||strlen($new)>72)vp_flash('Yeni şifre 14–72 karakter olmalı.','err');
            elseif($new!==$new2)vp_flash('Yeni şifreler eşleşmiyor.','err');
            elseif(!vp_rate_ok('pw-'.$c['id'],5))vp_flash('Çok fazla deneme. 15 dakika sonra tekrar deneyin.','err');
            else{try{$ok=vp_site_account_password($c['email'],$new,$cur);}catch(Throwable){$ok=false;}
                if($ok){session_regenerate_id(true);vpc_log($c,'Şifresini değiştirdi');vp_flash('Şifreniz değiştirildi.');}else vp_flash('Mevcut şifre doğrulanamadı.','err');}
        }
        vp_redirect('/panel/profil');
    }
    $logs=vp_all('SELECT * FROM activity WHERE client_id=? ORDER BY id DESC LIMIT 8',[$c['id']]);
    vpc_start($c,'Profil ve güvenlik','/panel/profil');
    vp_head('Ayarlar','Profil ve güvenlik','Fatura bilgileriniz proforma faturalarda kullanılır.');
    ?>
<div class="vp-grid vp-grid-main">
  <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="bilgi"><div class="vp-card-head"><h2>İşletme ve fatura bilgileri</h2></div>
    <div class="vp-row"><label class="vp-field"><span>İşletme adı</span><input type="text" name="company" required maxlength="160" value="<?=e($c['company'])?>"></label><label class="vp-field"><span>E-posta</span><input type="email" value="<?=e($c['email'])?>" readonly><small>Değiştirmek için destek talebi açın.</small></label></div>
    <div class="vp-row"><label class="vp-field"><span>Yetkili kişi</span><input type="text" name="contact_name" maxlength="120" value="<?=e($c['contact_name'])?>"></label><label class="vp-field"><span>Telefon</span><input type="tel" name="phone" maxlength="40" value="<?=e($c['phone'])?>"></label></div>
    <div class="vp-row"><label class="vp-field"><span>Vergi dairesi</span><input type="text" name="tax_office" maxlength="80" value="<?=e($c['tax_office'])?>"></label><label class="vp-field"><span>VKN / TCKN</span><input type="text" name="tax_no" maxlength="11" inputmode="numeric" value="<?=e($c['tax_no'])?>"></label></div>
    <div class="vp-row"><label class="vp-field"><span>Adres</span><input type="text" name="address" maxlength="300" value="<?=e($c['address'])?>"></label><label class="vp-field"><span>İl</span><input type="text" name="city" maxlength="60" value="<?=e($c['city'])?>"></label></div>
    <label class="vp-check"><input type="checkbox" name="notify_email" value="1"<?=$c['notify_email']?' checked':''?>> Fatura, ödeme ve lisans bildirimlerini e-postayla almak istiyorum</label>
    <label class="vp-check"><input type="checkbox" name="notify_whatsapp" value="1"<?=(int)($c['notify_whatsapp']??1)?' checked':''?>> Hatırlatma ve bildirimleri WhatsApp ile almak istiyorum (telefon numaranıza)</label>
    <div class="vp-form-foot"><button class="vp-btn" type="submit">Kaydet</button></div>
  </form>
  <div class="vp-stack">
    <?php vp_avatar_card('client','c',(string)$c['id'],$c['company']);?>
    <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="sifre"><div class="vp-card-head"><h2>Şifre değiştir</h2></div>
      <label class="vp-field"><span>Mevcut şifre</span><input type="password" name="current" required autocomplete="current-password"></label>
      <label class="vp-field"><span>Yeni şifre</span><input type="password" name="password" required minlength="14" maxlength="72" autocomplete="new-password"><small>En az 14 karakter.</small></label>
      <label class="vp-field"><span>Yeni şifre (tekrar)</span><input type="password" name="password2" required minlength="14" maxlength="72" autocomplete="new-password"></label>
      <button class="vp-btn vp-btn--ink" type="submit">Şifreyi değiştir</button></form>
    <section class="vp-card vp-card--kraft"><div class="vp-card-head"><h2>Son hesap hareketleri</h2></div><?php if(!$logs): echo '<p class="vp-muted">Kayıt yok.</p>'; else:?><ul class="vp-feed"><?php foreach($logs as $x):?><li><?=e($x['action'])?><time><?=e(vp_date($x['created_at'],true))?> · <?=e($x['ip'])?></time></li><?php endforeach;?></ul><?php endif;?></section>
  </div>
</div>
<?php
    vp_shell_end();
}
