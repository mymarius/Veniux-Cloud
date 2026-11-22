<?php
declare(strict_types=1);
// Veniux yönetim paneli. Bölüm 2: paketler, faturalar, havale, finans, kuponlar, destek, içerik, sistem.

// ---------------------------------------------------------------- paketler
function vpa_products(array $a): void {
    vpa_need($a,'products');
    $rows=vp_all("SELECT p.*,(SELECT COUNT(*) FROM licenses WHERE product_id=p.id AND status='aktif') lic FROM products p ORDER BY p.sort,p.id");
    vpa_start($a,'Paketler','/yonetim/paketler');
    vp_head('Müşteri ve satış','Paketler ve eklentiler','Müşteri panelinde satılan paketler. Fiyatlar '.(vp_setting('prices_include_tax','1')==='1'?'KDV dahil':'KDV hariç').' girilir.',($a['role']==='yonetici'?'<a class="vp-btn vp-btn--ghost" href="/yonetim/paketler/eklentiler">Eklentiler</a><a class="vp-btn" href="/yonetim/paketler/yeni">'.vp_icon('plus').'Paket ekle</a>':''));
    echo '<div class="vp-plans">';
    foreach($rows as $p){
        $feat=array_slice(array_filter(preg_split('/\R/',$p['features'])?:[]),0,5);
        echo '<article class="vp-plan'.($p['featured']?' vp-plan--featured':'').'">'.($p['active']?'':'<span class="vp-plan-ribbon">Satışta değil</span>').'<span class="vp-label">'.e($p['code']).' · '.e(vp_period_label($p['period'])).'</span><h3>'.e($p['name']).'</h3><p class="vp-plan-tag">'.e($p['tagline']).'</p>';
        echo '<div class="vp-plan-price">'.e(vp_money((int)$p['price'])).'<small>'.e(vp_period_suffix($p['period'])).'</small></div><small>'.(int)$p['lic'].' aktif lisans · cihaz '.($p['device_limit']===null?'∞':(int)$p['device_limit']).' · depo '.($p['warehouse_limit']===null?'∞':(int)$p['warehouse_limit']).'</small>';
        echo '<ul>'.implode('',array_map(fn($f)=>'<li>'.e($f).'</li>',$feat)).'</ul>';
        echo ($a['role']==='yonetici'?'<a class="vp-btn '.($p['featured']?'':'vp-btn--ghost').' vp-btn--block" href="/yonetim/paketler/'.$p['id'].'">Düzenle</a>':'').'</article>';
    }
    echo '</div>';
    if(!$rows)echo vp_empty('Paket yok.');
    vp_shell_end();
}

function vpa_product_form(array $a,string $id=''): void {
    vpa_need($a,'admins');
    $p=$id!==''?vp_row('SELECT * FROM products WHERE id=?',[(int)$id]):null;
    if($id!==''&&!$p){vp_flash('Paket bulunamadı.','err');vp_redirect('/yonetim/paketler');}
    $err='';
    if(vp_is_post()){
        $lim=fn($k)=>trim((string)($_POST[$k]??''))===''?null:max(0,(int)$_POST[$k]);
        $d=['code'=>preg_replace('/[^a-z0-9_]/','',strtolower(vp_post('code',60))),'name'=>vp_post('name',120),'tagline'=>vp_post('tagline',300),'period'=>in_array($_POST['period']??'',['year','quarter','month','once','forever'],true)?$_POST['period']:'year',
            'price'=>vp_parse_money($_POST['price']??'')??0,'renew_price'=>trim((string)($_POST['renew_price']??''))===''?null:vp_parse_money($_POST['renew_price']),
            'device_limit'=>$lim('device_limit'),'warehouse_limit'=>$lim('warehouse_limit'),'user_limit'=>$lim('user_limit'),'ai_limit'=>$lim('ai_limit'),
            'features'=>vp_post('features',6000),'active'=>isset($_POST['active'])?1:0,'featured'=>isset($_POST['featured'])?1:0,'sort'=>(int)($_POST['sort']??0)];
        if($d['code']===''||$d['name']==='')$err='Kod ve paket adı zorunlu.';
        elseif(vp_val('SELECT 1 FROM products WHERE code=? AND id<>?',[$d['code'],$p['id']??0]))$err='Bu kod başka bir pakette kullanılıyor.';
        elseif($d['price']<0)$err='Fiyat geçersiz.';
        else{
            if($p){vp_update('products',(int)$p['id'],$d);$pid=(int)$p['id'];}else{$pid=vp_insert('products',$d+['created_at'=>vp_now()]);}
            vpa_log($a,$p?'Paketi güncelledi':'Paket ekledi',$d['name']);vp_flash('Paket kaydedildi.');vp_redirect('/yonetim/paketler/'.$pid);
        }
        $p=array_merge($p??[],$d);
    }
    $p??=['code'=>'','name'=>'','tagline'=>'','period'=>'year','price'=>0,'renew_price'=>null,'device_limit'=>null,'warehouse_limit'=>null,'user_limit'=>null,'ai_limit'=>null,'features'=>'','active'=>1,'featured'=>0,'sort'=>0];
    vpa_start($a,$id?'Paket düzenle':'Yeni paket','/yonetim/paketler');
    vp_head('Müşteri ve satış',$id?$p['name']:'Yeni paket','','',[['/yonetim/paketler','Paketler'],['#',$id?'Düzenle':'Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    $n=fn($v)=>$v===null?'':(string)$v;
    ?>
<form class="vp-grid vp-grid-main" method="post"><?=vp_csrf_field()?>
  <div class="vp-card vp-form">
    <div class="vp-row"><label class="vp-field"><span>Paket adı *</span><input type="text" name="name" required maxlength="120" value="<?=e($p['name'])?>"></label>
    <label class="vp-field"><span>Kod *</span><input type="text" name="code" required maxlength="60" pattern="[a-z0-9_]+" value="<?=e($p['code'])?>"><small>Küçük harf, rakam, alt çizgi. Kuponlarda kullanılır.</small></label></div>
    <label class="vp-field"><span>Kısa açıklama</span><input type="text" name="tagline" maxlength="300" value="<?=e($p['tagline'])?>"></label>
    <div class="vp-row-3 vp-row"><label class="vp-field"><span>Dönem</span><?=vp_select('period',['year'=>'Yıllık','quarter'=>'3 aylık','month'=>'Aylık','once'=>'Tek ödeme (ömür boyu)','forever'=>'Ücretsiz / süresiz'],$p['period'])?></label>
    <label class="vp-field"><span>Fiyat (₺)</span><input type="text" name="price" inputmode="decimal" value="<?=e(vp_input_money((int)$p['price']))?>"></label>
    <label class="vp-field"><span>Yenileme fiyatı (₺)</span><input type="text" name="renew_price" inputmode="decimal" value="<?=e($p['renew_price']===null?'':vp_input_money((int)$p['renew_price']))?>" placeholder="Boş: aynı fiyat"></label></div>
    <label class="vp-field"><span>Özellikler</span><textarea name="features" rows="10" maxlength="6000"><?=e($p['features'])?></textarea><small>Her satıra bir özellik. Müşteri sipariş ekranında görünür.</small></label>
  </div>
  <div class="vp-stack">
    <div class="vp-card vp-card--kraft vp-form"><div class="vp-card-head"><h2>Sınırlar</h2></div><p class="vp-muted">Boş bırakılan sınır “sınırsız” sayılır.</p>
      <div class="vp-row"><label class="vp-field"><span>Cihaz</span><input type="number" min="0" name="device_limit" value="<?=e($n($p['device_limit']))?>"></label><label class="vp-field"><span>Depo</span><input type="number" min="0" name="warehouse_limit" value="<?=e($n($p['warehouse_limit']))?>"></label></div>
      <div class="vp-row"><label class="vp-field"><span>Kullanıcı</span><input type="number" min="0" name="user_limit" value="<?=e($n($p['user_limit']))?>"></label><label class="vp-field"><span>Asistan / ay</span><input type="number" min="0" name="ai_limit" value="<?=e($n($p['ai_limit']))?>"></label></div>
    </div>
    <div class="vp-card vp-form"><div class="vp-card-head"><h2>Yayın</h2></div>
      <label class="vp-check"><input type="checkbox" name="active" value="1"<?=$p['active']?' checked':''?>> Müşteri panelinde satışta</label>
      <label class="vp-check"><input type="checkbox" name="featured" value="1"<?=$p['featured']?' checked':''?>> Öne çıkan paket</label>
      <label class="vp-field"><span>Sıra</span><input type="number" name="sort" value="<?=(int)$p['sort']?>"></label>
      <button class="vp-btn" type="submit">Paketi kaydet</button>
    </div>
  </div>
</form>
<?php
    vp_shell_end();
}

function vpa_addons(array $a): void {
    vpa_need($a,'admins');
    if(vp_is_post()){
        $op=vp_post('op',10);$aid=vp_int($_POST['id']??null);
        if($op==='sil'&&$aid){vp_q('DELETE FROM addons WHERE id=?',[$aid]);vp_flash('Eklenti silindi.');}
        else{
            $d=['name'=>vp_post('name',120),'description'=>vp_post('description',1000),'price'=>vp_parse_money($_POST['price']??'')??0,'period'=>in_array($_POST['period']??'',['year','once','month'],true)?$_POST['period']:'year','requires'=>vp_post('requires',300),'active'=>isset($_POST['active'])?1:0];
            if($d['name']==='')vp_flash('Eklenti adı zorunlu.','err');
            elseif($aid){vp_update('addons',$aid,$d);vp_flash('Eklenti güncellendi.');}
            else{vp_insert('addons',$d+['created_at'=>vp_now()]);vp_flash('Eklenti eklendi.');}
        }
        vp_redirect('/yonetim/paketler/eklentiler');
    }
    $rows=vp_all('SELECT * FROM addons ORDER BY id');
    vpa_start($a,'Eklentiler','/yonetim/paketler');
    vp_head('Müşteri ve satış','Eklentiler','Paketlere ek satılan modüller. Müşteri talep oluşturarak ekleme ister.','',[['/yonetim/paketler','Paketler'],['/yonetim/paketler/eklentiler','Eklentiler']]);
    $form=function(array $x=[]){
        $new=!$x;
        echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field().($new?'':'<input type="hidden" name="id" value="'.(int)$x['id'].'">').'<div class="vp-card-head"><h2>'.($new?'Yeni eklenti':e($x['name'])).'</h2>'.($new?'':'<span class="vp-label">'.($x['active']?'Satışta':'Kapalı').'</span>').'</div>';
        echo '<div class="vp-row"><label class="vp-field"><span>Ad</span><input type="text" name="name" required maxlength="120" value="'.e($x['name']??'').'"></label><label class="vp-field"><span>Fiyat (₺)</span><input type="text" name="price" inputmode="decimal" value="'.e(vp_input_money((int)($x['price']??0))).'"></label></div>';
        echo '<label class="vp-field"><span>Açıklama</span><input type="text" name="description" maxlength="1000" value="'.e($x['description']??'').'"></label>';
        echo '<div class="vp-row"><label class="vp-field"><span>Dönem</span>'.vp_select('period',['year'=>'Yıllık','month'=>'Aylık','once'=>'Tek ödeme'],$x['period']??'year').'</label><label class="vp-field"><span>Gerekli paket kodları</span><input type="text" name="requires" maxlength="300" value="'.e($x['requires']??'').'" placeholder="pro,business_wms"></label></div>';
        echo '<label class="vp-check"><input type="checkbox" name="active" value="1"'.(($x['active']??1)?' checked':'').'> Satışta</label><div class="vp-form-foot"><button class="vp-btn vp-btn--sm" type="submit" name="op" value="kaydet">Kaydet</button>'.($new?'':'<button class="vp-btn vp-btn--danger vp-btn--sm" type="submit" name="op" value="sil">Sil</button>').'</div></form>';
    };
    echo '<div class="vp-grid vp-grid-2">';foreach($rows as $r)$form($r);$form();echo '</div>';
    vp_shell_end();
}

// ---------------------------------------------------------------- faturalar
function vpa_invoice_table(array $rows,bool $withClient=true,string $base='/yonetim/faturalar/'): void {
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows){echo vp_empty('Fatura yok.').'</section>';return;}
    echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th>'.($withClient?'<th>Müşteri</th>':'').'<th>Tür</th><th>Durum</th><th class="num">Toplam</th><th>Son ödeme</th><th>Tarih</th></tr></thead><tbody>';
    foreach($rows as $i){
        $late=$i['status']==='odenmedi'&&strtotime($i['due_at'].' UTC')<time();
        echo '<tr><td data-l="No"><a class="vp-strong" href="'.$base.$i['id'].'">'.e($i['number']).'</a></td>'.($withClient?'<td data-l="Müşteri">'.vpa_client_link((int)$i['client_id'],$i['company']??'').'</td>':'').'<td data-l="Tür">'.e(vpa_kind($i['kind'])).'</td><td data-l="Durum">'.vp_badge('invoice',$i['status']).($late?' <span class="vp-badge vp-badge--bad">Gecikti</span>':'').'</td><td data-l="Toplam" class="num"><b>'.e(vp_money((int)$i['total'])).'</b></td><td data-l="Son ödeme" class="nowrap">'.e(vp_date($i['due_at'])).'</td><td data-l="Tarih" class="nowrap vp-muted">'.e(vp_date($i['created_at'])).'</td></tr>';
    }
    echo '</tbody></table></div>';
}

function vpa_invoices(array $a): void {
    vpa_need($a,'invoices');
    $st=vp_get('durum',20);$q=vp_get('q',60);$where=['1=1'];$args=[];
    if(in_array($st,['odenmedi','odendi','iptal','iade'],true)){$where[]='i.status=?';$args[]=$st;}
    if($st==='geciken'){$where[]="i.status='odenmedi' AND i.due_at<?";$args[]=vp_now();}
    if($q!==''){$where[]='(i.number LIKE ? OR c.company LIKE ?)';array_push($args,"%$q%","%$q%");}
    $w=implode(' AND ',$where);
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM invoices i JOIN clients c ON c.id=i.client_id WHERE $w",$args);
    $rows=vp_all("SELECT i.*,c.company FROM invoices i JOIN clients c ON c.id=i.client_id WHERE $w ORDER BY i.id DESC LIMIT $per OFFSET $off",$args);
    $sum=vp_row("SELECT COALESCE(SUM(CASE WHEN status='odenmedi' THEN total END),0) due,COALESCE(SUM(CASE WHEN status='odenmedi' AND due_at<? THEN total END),0) late,COALESCE(SUM(CASE WHEN status='odendi' THEN total END),0) paid FROM invoices",[vp_now()]);
    vpa_start($a,'Faturalar','/yonetim/faturalar');
    vp_head('Finans','Faturalar','Sipariş, yenileme ve elle kesilen faturalar.','<a class="vp-btn" href="/yonetim/faturalar/yeni">'.vp_icon('plus').'Fatura kes</a>');
    ?>
<div class="vp-kpis">
  <div class="vp-kpi"><div class="vp-kpi-top">Bekleyen</div><strong><?=e(vp_money((int)$sum['due']))?></strong><small>ödenmemiş toplam</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Geciken</div><strong><?=e(vp_money((int)$sum['late']))?></strong><small>son ödeme tarihi geçmiş</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Tahsil edilen</div><strong><?=e(vp_money((int)$sum['paid']))?></strong><small>tüm zamanlar</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Fatura</div><strong><?=$total?></strong><small>bu filtrede</small></div>
</div>
<div class="vp-chips"><?php foreach([''=>'Tümü','odenmedi'=>'Ödenmedi','geciken'=>'Geciken','odendi'=>'Ödendi','iptal'=>'İptal','iade'=>'İade'] as $k=>$l):?><a class="vp-chip" href="?durum=<?=$k?>"<?=$st===$k?' aria-current="page"':''?>><?=$l?></a><?php endforeach;?></div>
<form class="vp-filters" method="get"><input type="search" name="q" value="<?=e($q)?>" placeholder="Fatura no veya müşteri" aria-label="Fatura ara"><?php if($st):?><input type="hidden" name="durum" value="<?=e($st)?>"><?php endif;?><button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Ara</button></form>
<?php vpa_invoice_table($rows);echo vp_pager($total,$page,$pages).'</section>';
    vp_shell_end();
}

function vpa_invoice_new(array $a): void {
    vpa_need($a,'invoices');
    $clients=vp_all('SELECT id,company,email FROM clients ORDER BY company');$err='';
    if(vp_is_post()){
        $cid=vp_int($_POST['client_id']??null);$items=[];
        foreach((array)($_POST['desc']??[]) as $i=>$desc){$desc=vp_str($desc,300);$amt=vp_parse_money($_POST['amt'][$i]??'');if($desc!==''&&$amt!==null)$items[]=[$desc,$amt];}
        if(!$cid||!vp_val('SELECT 1 FROM clients WHERE id=?',[$cid]))$err='Müşteri seçin.';
        elseif(!$items)$err='En az bir kalem girin.';
        else{$iid=vp_create_invoice($cid,$items,['kind'=>'yeni','note'=>vp_post('note',1000)]);vpa_log($a,'Elle fatura kesti','',$cid);vp_flash('Fatura oluşturuldu.');vp_redirect('/yonetim/faturalar/'.$iid);}
    }
    vpa_start($a,'Fatura kes','/yonetim/faturalar');
    vp_head('Finans','Fatura kes','Kurulum, eğitim veya özel hizmet için kalemli fatura.','',[['/yonetim/faturalar','Faturalar'],['#','Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field();
    echo '<label class="vp-field"><span>Müşteri</span>'.vp_select('client_id',[''=>'Seçin…']+array_column(array_map(fn($c)=>['id'=>$c['id'],'l'=>$c['company'].' · '.$c['email']],$clients),'l','id'),(string)vp_int($_GET['musteri']??$_POST['client_id']??null),'required').'</label>';
    for($i=0;$i<4;$i++)echo '<div class="vp-row"><label class="vp-field"><span>Kalem '.($i+1).'</span><input type="text" name="desc[]" maxlength="300"'.($i===0?' required':'').'></label><label class="vp-field"><span>Tutar (₺, '.(vp_setting('prices_include_tax','1')==='1'?'KDV dahil':'KDV hariç').')</span><input type="text" name="amt[]" inputmode="decimal"></label></div>';
    echo '<label class="vp-field"><span>Not</span><input type="text" name="note" maxlength="1000"></label><div class="vp-form-foot"><button class="vp-btn" type="submit">Faturayı oluştur</button></div></form>';
    vp_shell_end();
}

/** Fatura belgesi: yönetim ve müşteri paneli ortak görünümü. */
function vp_invoice_document(array $inv,array $client,array $items): string {
    $stamp=['odendi'=>['Ödendi','ok'],'odenmedi'=>['Ödenmedi','warn'],'iptal'=>['İptal','off'],'iade'=>['İade','off']][$inv['status']]??['','off'];
    ob_start();?>
<article class="vp-invoice">
  <div class="vp-invoice-top">
    <div><div class="vp-invoice-brand"><img src="/assets/logo-40-v1.webp" alt="" width="38" height="38"><?=e(vp_setting('company_name','Veniux'))?></div>
      <p class="vp-muted"><?=nl2br(e(vp_setting('company_address')))?><?=vp_setting('company_tax_no')?'<br>VD: '.e(vp_setting('company_tax_office')).' · VKN: '.e(vp_setting('company_tax_no')):''?><?=vp_setting('company_email')?'<br>'.e(vp_setting('company_email')):''?></p></div>
    <div><span class="vp-label">Proforma fatura</span><h2><?=e($inv['number'])?></h2><p class="vp-right vp-muted">Düzenleme: <?=e(vp_date($inv['created_at']))?><br>Son ödeme: <?=e(vp_date($inv['due_at']))?><?=$inv['paid_at']?'<br>Ödeme: '.e(vp_date($inv['paid_at'])):''?></p></div>
  </div>
  <div class="vp-invoice-stamp"><span class="vp-stamp vp-stamp--<?=$stamp[1]?>"><?=e($stamp[0])?></span></div>
  <div class="vp-invoice-parties">
    <div><span class="vp-label">Fatura edilen</span><p><b><?=e($client['company'])?></b><br><?=e($client['contact_name'])?><?=$client['address']?'<br>'.e($client['address']).' '.e($client['city']):''?><?=$client['tax_no']?'<br>VD: '.e($client['tax_office']).' · '.e($client['tax_no']):''?><br><?=e($client['email'])?></p></div>
    <div><span class="vp-label">Ödeme</span><p><?=$inv['payment_method']?e(vp_method_label($inv['payment_method'])):'Kredi kartı, havale / EFT veya bakiye'?></p></div>
  </div>
  <table class="vp-table"><thead><tr><th>Açıklama</th><th class="num">Tutar</th></tr></thead><tbody><?php foreach($items as $it):?><tr><td><?=e($it['description'])?></td><td class="num"><?=e(vp_money((int)$it['amount']))?></td></tr><?php endforeach;?></tbody></table>
  <div class="vp-invoice-total"><br>
    <div class="vp-summary-row"><span>Ara toplam</span><span><?=e(vp_money((int)$inv['subtotal']))?></span></div>
    <div class="vp-summary-row"><span>KDV (%<?=(int)$inv['tax_rate']?>)</span><span><?=e(vp_money((int)$inv['tax']))?></span></div>
    <div class="vp-summary-total"><span>Toplam</span><strong><?=e(vp_money((int)$inv['total']))?></strong></div>
  </div>
  <?php if($inv['note']):?><p class="vp-muted"><br><?=e($inv['note'])?></p><?php endif;?>
  <div class="vp-invoice-foot"><span>Bu belge resmî e-fatura yerine geçmez. Resmî faturanız ayrıca düzenlenir.</span><?=vp_barcode($inv['number'],36)?></div>
</article>
<?php return (string)ob_get_clean();
}
function vp_method_label(string $m): string { return ['havale'=>'Havale / EFT','nakit'=>'Nakit','kredi_karti'=>'Kredi kartı','bakiye'=>'Hesap bakiyesi','ücretsiz'=>'Ücretsiz','paytr'=>'Kredi kartı · PayTR','iyzico'=>'Kredi kartı · iyzico'][$m]??$m; }

function vpa_invoice_view(array $a,string $id): void {
    vpa_need($a,'invoices');
    $inv=vp_row('SELECT * FROM invoices WHERE id=?',[(int)$id]);
    if(!$inv){vp_flash('Fatura bulunamadı.','err');vp_redirect('/yonetim/faturalar');}
    $c=vp_row('SELECT * FROM clients WHERE id=?',[$inv['client_id']]);$items=vp_all('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id',[$inv['id']]);
    $pays=vp_all('SELECT * FROM payments WHERE invoice_id=? ORDER BY id',[$inv['id']]);
    $notices=vp_all('SELECT * FROM transfer_notices WHERE invoice_id=? ORDER BY id DESC',[$inv['id']]);
    $cards=vp_all('SELECT * FROM payment_attempts WHERE invoice_id=? ORDER BY id DESC LIMIT 10',[$inv['id']]);
    vpa_start($a,$inv['number'],'/yonetim/faturalar');
    vp_head('Fatura · '.vpa_kind($inv['kind']),$inv['number'],$c['company'],'<button class="vp-btn vp-btn--ghost" type="button" data-print>'.vp_icon('print').'Yazdır</button><a class="vp-btn vp-btn--ghost" href="/yonetim/musteriler/'.$c['id'].'">Müşteri</a>',[['/yonetim/faturalar','Faturalar'],['#',$inv['number']]]);
    $op=fn(string $o,string $l,string $cf,string $cls='vp-btn vp-btn--ghost vp-btn--sm')=>vp_confirm_form('/yonetim/faturalar/'.$inv['id'].'/islem',$l,$cf,$cls,['op'=>$o]);
    ?>
<div class="vp-grid vp-grid-main">
  <?=vp_invoice_document($inv,$c,$items)?>
  <div class="vp-stack vp-no-print">
    <?php if($inv['status']==='odenmedi'):?>
    <form class="vp-card vp-card--kraft vp-tape vp-form" method="post" action="/yonetim/faturalar/<?=$inv['id']?>/islem"><?=vp_csrf_field()?><input type="hidden" name="op" value="odendi">
      <div class="vp-card-head"><h2>Ödeme ekle</h2></div>
      <label class="vp-field"><span>Yöntem</span><?=vp_select('method',['havale'=>'Havale / EFT','nakit'=>'Nakit','kredi_karti'=>'Kredi kartı (POS)']+((int)$c['balance']>=(int)$inv['total']?['bakiye'=>'Müşteri bakiyesi ('.vp_money((int)$c['balance']).')']:[]),'havale')?></label>
      <label class="vp-field"><span>Referans / dekont no</span><input type="text" name="reference" maxlength="160"></label>
      <button class="vp-btn" type="submit">Ödendi olarak işaretle</button>
      <small class="vp-muted">Bağlı sipariş varsa onaylanır ve lisans açılır; yenileme faturasında süre uzar.</small>
    </form>
    <?php endif;?>
    <section class="vp-card"><div class="vp-card-head"><h2>İşlemler</h2><?=vp_badge('invoice',$inv['status'])?></div><div class="vp-actions">
      <?=$inv['status']==='odenmedi'?$op('iptal','İptal et','Fatura iptal edilecek. Emin misiniz?','vp-btn vp-btn--danger vp-btn--sm'):''?>
      <?=$inv['status']==='odendi'?$op('iade','İade et (bakiyeye)','Fatura tutarı müşterinin bakiyesine iade edilecek. Devam edilsin mi?'):''?>
      <?=$inv['status']==='iptal'?$op('ac','Yeniden aç','Fatura ödenmedi durumuna alınacak. Devam edilsin mi?'):''?>
    </div>
    <?php if($pays):?><br><span class="vp-label">Ödemeler</span><ul class="vp-list"><?php foreach($pays as $p):?><li><div><b><?=e(vp_money((int)$p['amount']))?></b> · <?=e(vp_method_label($p['method']))?><span class="vp-sub"><?=e(vp_date($p['created_at'],true))?> <?=e($p['reference'])?></span></div></li><?php endforeach;?></ul><?php endif;?>
    <?php if($notices):?><br><span class="vp-label">Havale bildirimleri</span><ul class="vp-list"><?php foreach($notices as $n):?><li><div><?=e($n['sender'])?> · <?=e(vp_money((int)$n['amount']))?><span class="vp-sub"><?=e($n['bank'])?> · <?=e(vp_date($n['created_at'],true))?></span></div><?=vp_badge('transfer',$n['status'])?></li><?php endforeach;?></ul><a href="/yonetim/havale">Bildirimleri yönet →</a><?php endif;?>
    <?php if($cards):?><br><span class="vp-label">Kart ödeme denemeleri</span><ul class="vp-list"><?php foreach($cards as $p):?><li><div><?=$p['gateway']==='paytr'?'PayTR':'iyzico'?> · <?=e(vp_money((int)$p['amount']))?><?=$p['test_mode']?' · test':''?><span class="vp-sub"><?=e(vp_date($p['created_at'],true))?> <?=e($p['reference']?:$p['message'])?></span></div><?=vp_badge('attempt',$p['status'])?></li><?php endforeach;?></ul><?php endif;?>
    </section>
  </div>
</div>
<?php
    vp_shell_end();
}

function vpa_invoice_action(array $a,string $id): void {
    vpa_need($a,'invoices');
    $inv=vp_row('SELECT * FROM invoices WHERE id=?',[(int)$id]);
    if(!$inv||!vp_is_post())vp_redirect('/yonetim/faturalar');
    $iid=(int)$inv['id'];$cid=(int)$inv['client_id'];
    switch(vp_post('op',10)){
        case 'odendi':
            $m=in_array($_POST['method']??'',['havale','nakit','kredi_karti','bakiye'],true)?$_POST['method']:'havale';
            if($m==='bakiye'){$bal=(int)vp_val('SELECT balance FROM clients WHERE id=?',[$cid]);if($bal<(int)$inv['total']){vp_flash('Bakiye yetersiz.','err');break;}vp_add_balance($cid,-(int)$inv['total'],'Fatura ödemesi · '.$inv['number']);}
            if(vp_mark_paid($iid,$m,vp_post('reference',160),$a['id']?:null)){vpa_log($a,'Faturayı ödendi işaretledi',$inv['number'].' · '.vp_money((int)$inv['total']),$cid);vp_flash('Ödeme kaydedildi.');}
            break;
        case 'iptal': if($inv['status']==='odenmedi'){vp_update('invoices',$iid,['status'=>'iptal']);vpa_log($a,'Faturayı iptal etti',$inv['number'],$cid);vp_flash('Fatura iptal edildi.');}break;
        case 'ac': if($inv['status']==='iptal'){vp_update('invoices',$iid,['status'=>'odenmedi']);vp_flash('Fatura yeniden açıldı.');}break;
        case 'iade': if($inv['status']==='odendi'){vp_update('invoices',$iid,['status'=>'iade']);vp_add_balance($cid,(int)$inv['total'],'İade · '.$inv['number']);vpa_log($a,'Faturayı bakiyeye iade etti',$inv['number'],$cid);vp_flash('Tutar müşteri bakiyesine iade edildi.');}break;
    }
    vp_redirect('/yonetim/faturalar/'.$iid);
}

// ---------------------------------------------------------------- havale bildirimleri
function vpa_transfers(array $a): void {
    vpa_need($a,'invoices');
    $st=vp_get('durum',20)?:'bekliyor';
    $rows=vp_all("SELECT n.*,i.number inumber,i.total itotal,i.status istatus,c.company FROM transfer_notices n JOIN invoices i ON i.id=n.invoice_id JOIN clients c ON c.id=n.client_id WHERE n.status=? ORDER BY n.id DESC LIMIT 200",[in_array($st,['bekliyor','onaylandi','reddedildi'],true)?$st:'bekliyor']);
    vpa_start($a,'Havale bildirimleri','/yonetim/havale');
    vp_head('Finans','Havale bildirimleri','Müşterilerin “ödemeyi yaptım” bildirimleri. Onayladığınızda fatura ödenir ve lisans açılır.');
    echo '<div class="vp-chips">';foreach(['bekliyor'=>'İncelemede','onaylandi'=>'Onaylanan','reddedildi'=>'Reddedilen'] as $k=>$l)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'</a>';echo '</div>';
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Bildirim yok.','Müşteri fatura sayfasından havale bildirimi gönderdiğinde burada görünür.');
    else{
        echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Gönderen ad / unvan</th><th>Müşteri hesabı</th><th>Fatura</th><th class="num">Bildirilen</th><th>Tarih</th><th></th></tr></thead><tbody>';
        foreach($rows as $n){
            $mismatch=(int)$n['amount']!==(int)$n['itotal'];
            $diff=mb_strtolower(trim($n['sender']),'UTF-8')!==mb_strtolower(trim($n['company']),'UTF-8');
            echo '<tr><td data-l="Gönderen ad / unvan"><b>'.e($n['sender']).'</b>'.($diff?' <span class="vp-badge vp-badge--wait">Hesap adından farklı</span>':'').'<span class="vp-sub">'.e(trim($n['bank'].' '.$n['reference'])?:'Banka / referans girilmedi').'</span></td><td data-l="Müşteri hesabı">'.vpa_client_link((int)$n['client_id'],$n['company']).'</td><td data-l="Fatura"><a class="vp-strong" href="/yonetim/faturalar/'.$n['invoice_id'].'">'.e($n['inumber']).'</a><span class="vp-sub">'.e(vp_money((int)$n['itotal'])).'</span></td><td data-l="Bildirilen" class="num"><b>'.e(vp_money((int)$n['amount'])).'</b>'.($mismatch?'<span class="vp-sub">Tutar farklı</span>':'').'</td><td data-l="Tarih" class="nowrap vp-muted">'.e(vp_date($n['created_at'],true)).'</td><td>';
            if($n['status']==='bekliyor')echo '<div class="vp-actions">'.vp_confirm_form('/yonetim/havale/'.$n['id'].'/onayla','Onayla','Ödeme hesaba geçtiyse onaylayın. Fatura ödenecek ve lisans açılacak.','vp-btn vp-btn--sm').vp_confirm_form('/yonetim/havale/'.$n['id'].'/reddet','Reddet','Bildirim reddedilecek. Emin misiniz?','vp-btn vp-btn--danger vp-btn--sm').'</div>';
            else echo vp_badge('transfer',$n['status']);
            echo '</td></tr>';
        }
        echo '</tbody></table></div>';
    }
    echo '</section>';vp_shell_end();
}

function vpa_transfer_action(array $a,string $id,string $action): void {
    vpa_need($a,'invoices');
    $n=vp_row("SELECT * FROM transfer_notices WHERE id=? AND status='bekliyor'",[(int)$id]);
    if(!$n||!vp_is_post())vp_redirect('/yonetim/havale');
    if($action==='onayla'){
        vp_update('transfer_notices',(int)$n['id'],['status'=>'onaylandi','handled_at'=>vp_now()]);
        vp_mark_paid((int)$n['invoice_id'],'havale',$n['sender'].' '.$n['reference'],$a['id']?:null);
        vpa_log($a,'Havale bildirimini onayladı',$n['sender'].' · '.vp_money((int)$n['amount']),(int)$n['client_id']);vp_flash('Havale onaylandı, fatura ödendi.');
    }else{vp_update('transfer_notices',(int)$n['id'],['status'=>'reddedildi','handled_at'=>vp_now()]);vpa_log($a,'Havale bildirimini reddetti',$n['sender'].' · '.vp_money((int)$n['amount']),(int)$n['client_id']);if(function_exists('vp_notify_invoice'))vp_notify_invoice('transfer_rejected',(int)$n['invoice_id']);vp_flash('Bildirim reddedildi.');}
    vp_redirect('/yonetim/havale');
}

// ---------------------------------------------------------------- finans
function vpa_finance(array $a): void {
    vpa_need($a,'finance');
    $year=(int)(vp_get('yil',4)?:date('Y'));
    $from=$year.'-01-01 00:00:00';$to=($year+1).'-01-01 00:00:00';
    $byMonth=array_column(vp_all("SELECT MONTH(DATE_ADD(created_at,INTERVAL 3 HOUR)) m,SUM(amount) s FROM payments WHERE created_at>=? AND created_at<? GROUP BY m",[$from,$to]),'s','m');
    $data=[];for($m=1;$m<=12;$m++)$data[]=[VP_MONTHS[$m-1],(int)($byMonth[$m]??0)];
    $total=array_sum(array_column($data,1));
    $byMethod=vp_all('SELECT method,SUM(amount) s,COUNT(*) n FROM payments WHERE created_at>=? AND created_at<? GROUP BY method ORDER BY s DESC',[$from,$to]);
    $byProduct=vp_all("SELECT p.name,SUM(i.total) s FROM invoices i JOIN licenses l ON l.id=i.license_id JOIN products p ON p.id=l.product_id WHERE i.status='odendi' AND i.paid_at>=? AND i.paid_at<? GROUP BY p.id ORDER BY s DESC",[$from,$to]);
    $pays=vp_all('SELECT p.*,c.company,i.number FROM payments p JOIN clients c ON c.id=p.client_id LEFT JOIN invoices i ON i.id=p.invoice_id ORDER BY p.id DESC LIMIT 25');
    $years=array_map('intval',array_column(vp_all('SELECT DISTINCT YEAR(created_at) y FROM payments ORDER BY y DESC'),'y'))?:[(int)date('Y')];
    if(!in_array((int)date('Y'),$years,true))array_unshift($years,(int)date('Y'));
    vpa_start($a,'Gelir ve tahsilat','/yonetim/finans');
    vp_head('Finans','Gelir ve tahsilat',$year.' yılı tahsilat özeti.','<form method="get" class="vp-inline">'.vp_select('yil',array_combine($years,$years),(string)$year,'aria-label="Yıl" data-autosubmit').'</form>');
    $mrr=(int)vp_val("SELECT COALESCE(SUM(CASE period WHEN 'year' THEN price/12 WHEN 'quarter' THEN price/3 WHEN 'month' THEN price ELSE 0 END),0) FROM licenses WHERE status='aktif'");
    ?>
<div class="vp-kpis">
  <div class="vp-kpi"><div class="vp-kpi-top"><?=$year?> tahsilat</div><strong><?=e(vp_money($total))?></strong><small><?=array_sum(array_column($byMethod,'n'))?> ödeme</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Aylık tekrar eden</div><strong><?=e(vp_money($mrr))?></strong><small>aktif abonelikler (MRR)</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Aylık ortalama</div><strong><?=e(vp_money(intdiv($total,max(1,$year===(int)date('Y')?(int)date('n'):12))))?></strong><small>tahsilat</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Bekleyen</div><strong><?=e(vp_money((int)vp_val("SELECT COALESCE(SUM(total),0) FROM invoices WHERE status='odenmedi'")))?></strong><small>ödenmemiş faturalar</small></div>
</div>
<div class="vp-grid vp-grid-main">
  <section class="vp-card"><div class="vp-card-head"><h2>Aylık tahsilat</h2></div><?=vp_bar_chart($data,$year.' aylık tahsilat')?></section>
  <div class="vp-stack">
    <section class="vp-card"><div class="vp-card-head"><h2>Ödeme yöntemi</h2></div><?php if(!$byMethod): echo '<p class="vp-muted">Kayıt yok.</p>'; else:?><div class="vp-split"><?php foreach($byMethod as $m):?><div class="vp-split-row"><span><?=e(vp_method_label($m['method']))?></span><b><?=e(vp_money((int)$m['s']))?></b><progress class="vp-meter" max="<?=max(1,$total)?>" value="<?=(int)$m['s']?>"></progress></div><?php endforeach;?></div><?php endif;?></section>
    <section class="vp-card"><div class="vp-card-head"><h2>Pakete göre</h2></div><?php if(!$byProduct): echo '<p class="vp-muted">Kayıt yok.</p>'; else:?><div class="vp-split"><?php foreach($byProduct as $m):?><div class="vp-split-row"><span><?=e($m['name'])?></span><b><?=e(vp_money((int)$m['s']))?></b><progress class="vp-meter" max="<?=max(1,$total)?>" value="<?=(int)$m['s']?>"></progress></div><?php endforeach;?></div><?php endif;?></section>
  </div>
</div><br>
<section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Son ödemeler</h2></div>
<?php if(!$pays): echo vp_empty('Ödeme kaydı yok.'); else:?><div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Müşteri</th><th>Fatura</th><th>Yöntem</th><th>Referans</th><th class="num">Tutar</th><th>Tarih</th></tr></thead><tbody>
<?php foreach($pays as $p):?><tr><td data-l="Müşteri"><?=vpa_client_link((int)$p['client_id'],$p['company'])?></td><td data-l="Fatura"><?=$p['invoice_id']?'<a href="/yonetim/faturalar/'.$p['invoice_id'].'">'.e((string)$p['number']).'</a>':'—'?></td><td data-l="Yöntem"><?=e(vp_method_label($p['method']))?></td><td data-l="Referans" class="vp-muted"><?=e($p['reference']?:'—')?></td><td data-l="Tutar" class="num"><b><?=e(vp_money((int)$p['amount']))?></b></td><td data-l="Tarih" class="nowrap vp-muted"><?=e(vp_date($p['created_at'],true))?></td></tr><?php endforeach;?>
</tbody></table></div><?php endif;?></section>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- kuponlar
function vpa_coupons(array $a): void {
    vpa_need($a,'coupons');
    $rows=vp_all('SELECT * FROM coupons ORDER BY id DESC');
    vpa_start($a,'Kuponlar','/yonetim/kuponlar');
    vp_head('Finans','Kuponlar','Müşteri sipariş ekranında kullanılan indirim kodları.','<a class="vp-btn" href="/yonetim/kuponlar/yeni">'.vp_icon('plus').'Kupon oluştur</a>');
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Kupon yok.','Kampanya veya bayi indirimi için kupon oluşturun.','<a class="vp-btn" href="/yonetim/kuponlar/yeni">Kupon oluştur</a>');
    else{
        echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Kod</th><th>İndirim</th><th>Paketler</th><th>Kullanım</th><th>Bitiş</th><th>Durum</th></tr></thead><tbody>';
        foreach($rows as $c){
            $expired=$c['expires_at']&&strtotime($c['expires_at'].' UTC')<time();
            echo '<tr><td data-l="Kod"><a class="vp-strong vp-mono" href="/yonetim/kuponlar/'.$c['id'].'">'.e($c['code']).'</a>'.($c['note']?'<span class="vp-sub">'.e($c['note']).'</span>':'').'</td><td data-l="İndirim"><b>'.($c['type']==='yuzde'?'%'.(int)$c['value']:e(vp_money((int)$c['value']))).'</b></td><td data-l="Paketler">'.e($c['product_codes']?:'Tümü').'</td><td data-l="Kullanım">'.(int)$c['used'].' / '.($c['max_uses']===null?'∞':(int)$c['max_uses']).'</td><td data-l="Bitiş" class="nowrap">'.e($c['expires_at']?vp_date($c['expires_at']):'Süresiz').'</td><td data-l="Durum">'.(!$c['active']?'<span class="vp-badge vp-badge--off">Kapalı</span>':($expired?'<span class="vp-badge vp-badge--warn">Süresi doldu</span>':'<span class="vp-badge vp-badge--ok">Aktif</span>')).'</td></tr>';
        }
        echo '</tbody></table></div>';
    }
    echo '</section>';vp_shell_end();
}

function vpa_coupon_form(array $a,string $id=''): void {
    vpa_need($a,'coupons');
    $c=$id!==''?vp_row('SELECT * FROM coupons WHERE id=?',[(int)$id]):null;$err='';
    if($id!==''&&!$c)vp_redirect('/yonetim/kuponlar');
    if(vp_is_post()){
        if(($_POST['op']??'')==='sil'&&$c){vp_q('DELETE FROM coupons WHERE id=?',[$c['id']]);vpa_log($a,'Kuponu sildi',$c['code']);vp_flash('Kupon silindi.');vp_redirect('/yonetim/kuponlar');}
        $type=($_POST['type']??'')==='sabit'?'sabit':'yuzde';
        $exp=vp_str($_POST['expires_at']??'',10);
        $d=['code'=>strtoupper(preg_replace('/[^A-Za-z0-9_-]/','',vp_post('code',40))),'type'=>$type,'value'=>$type==='yuzde'?max(0,min(100,(int)($_POST['value']??0))):(vp_parse_money($_POST['value']??'')??0),
            'max_uses'=>trim((string)($_POST['max_uses']??''))===''?null:max(0,(int)$_POST['max_uses']),'expires_at'=>preg_match('/^\d{4}-\d{2}-\d{2}$/',$exp)?(new DateTimeImmutable($exp.' 23:59:59',new DateTimeZone('Europe/Istanbul')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'):null,
            'product_codes'=>implode(',',array_filter(array_map(fn($s)=>preg_replace('/[^a-z0-9_]/','',strtolower(trim($s))),explode(',',vp_post('product_codes',300))))),'active'=>isset($_POST['active'])?1:0,'note'=>vp_post('note',300)];
        if(strlen($d['code'])<3)$err='Kod en az 3 karakter olmalı.';
        elseif($d['value']<=0)$err='İndirim değeri girin.';
        elseif(vp_val('SELECT 1 FROM coupons WHERE code=? AND id<>?',[$d['code'],$c['id']??0]))$err='Bu kod zaten var.';
        else{if($c)vp_update('coupons',(int)$c['id'],$d);else vp_insert('coupons',$d+['created_at'=>vp_now()]);vpa_log($a,$c?'Kuponu güncelledi':'Kupon oluşturdu',$d['code']);vp_flash('Kupon kaydedildi.');vp_redirect('/yonetim/kuponlar');}
        $c=array_merge($c??[],$d);
    }
    $c??=['code'=>strtoupper(bin2hex(random_bytes(3))),'type'=>'yuzde','value'=>10,'max_uses'=>null,'expires_at'=>null,'product_codes'=>'','active'=>1,'note'=>'','used'=>0];
    vpa_start($a,'Kupon','/yonetim/kuponlar');
    vp_head('Finans',$id?$c['code']:'Yeni kupon','','',[['/yonetim/kuponlar','Kuponlar'],['#',$id?'Düzenle':'Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    $codes=implode(', ',array_column(vp_all('SELECT code FROM products ORDER BY sort'),'code'));
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row-3 vp-row"><label class="vp-field"><span>Kod</span><input type="text" name="code" required maxlength="40" class="vp-mono" value="<?=e($c['code'])?>"></label>
  <label class="vp-field"><span>Tür</span><?=vp_select('type',['yuzde'=>'Yüzde (%)','sabit'=>'Sabit tutar (₺)'],$c['type'])?></label>
  <label class="vp-field"><span>Değer</span><input type="text" name="value" required inputmode="decimal" value="<?=e($c['type']==='yuzde'?(string)$c['value']:vp_input_money((int)$c['value']))?>"></label></div>
  <div class="vp-row-3 vp-row"><label class="vp-field"><span>Kullanım sınırı</span><input type="number" name="max_uses" min="0" value="<?=e((string)($c['max_uses']??''))?>" placeholder="Sınırsız"></label>
  <label class="vp-field"><span>Bitiş tarihi</span><input type="date" name="expires_at" value="<?=e($c['expires_at']?vp_local($c['expires_at'])->format('Y-m-d'):'')?>"></label>
  <label class="vp-field"><span>Paket kodları</span><input type="text" name="product_codes" maxlength="300" value="<?=e($c['product_codes'])?>" placeholder="Boş: tüm paketler"><small><?=e($codes)?></small></label></div>
  <label class="vp-field"><span>İç not</span><input type="text" name="note" maxlength="300" value="<?=e($c['note'])?>"></label>
  <label class="vp-check"><input type="checkbox" name="active" value="1"<?=$c['active']?' checked':''?>> Aktif</label>
  <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="kaydet">Kuponu kaydet</button><?php if($id):?><button class="vp-btn vp-btn--danger" type="submit" name="op" value="sil" formnovalidate>Sil</button><span class="vp-muted"><?=(int)$c['used']?> kez kullanıldı</span><?php endif;?></div>
</form>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- destek talepleri
function vpa_ticket_table(array $rows,bool $withClient=true): void {
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows){echo vp_empty('Talep yok.').'</section>';return;}
    $deps=vp_departments();
    echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Konu</th>'.($withClient?'<th>Müşteri</th>':'').'<th>Departman</th><th>Öncelik</th><th>Durum</th><th>Son hareket</th></tr></thead><tbody>';
    foreach($rows as $t)echo '<tr><td data-l="Konu"><a class="vp-strong" href="/yonetim/talepler/'.$t['id'].'">'.e($t['subject']).'</a><span class="vp-sub vp-mono">#'.e($t['number']).'</span></td>'.($withClient?'<td data-l="Müşteri">'.vpa_client_link((int)$t['client_id'],$t['company']??'').'</td>':'').'<td data-l="Departman">'.e($deps[$t['department']]??$t['department']).'</td><td data-l="Öncelik">'.vp_badge('priority',$t['priority']).'</td><td data-l="Durum">'.vp_badge('ticket',$t['status']).'</td><td data-l="Son hareket" class="nowrap vp-muted">'.e(vp_ago($t['updated_at'])).'</td></tr>';
    echo '</tbody></table></div>';
}

function vpa_tickets(array $a): void {
    vpa_need($a,'tickets');
    $st=vp_get('durum',20)?:'bekleyen';$dep=vp_get('departman',40);
    $where=[];$args=[];
    if($st==='bekleyen')$where[]="t.status IN('acik','musteri_yaniti')";
    elseif(in_array($st,['acik','yanitlandi','musteri_yaniti','beklemede','kapali'],true)){$where[]='t.status=?';$args[]=$st;}
    else $where[]='1=1';
    if($dep!==''){$where[]='t.department=?';$args[]=$dep;}
    $w=implode(' AND ',$where);
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM tickets t WHERE $w",$args);
    $rows=vp_all("SELECT t.*,c.company FROM tickets t JOIN clients c ON c.id=t.client_id WHERE $w ORDER BY FIELD(t.priority,'acil','yuksek','normal','dusuk'),t.updated_at DESC LIMIT $per OFFSET $off",$args);
    $counts=array_column(vp_all('SELECT status,COUNT(*) n FROM tickets GROUP BY status'),'n','status');
    vpa_start($a,'Destek talepleri','/yonetim/talepler');
    vp_head('Destek','Destek talepleri','Önce acil ve yüksek öncelikli talepler gösterilir.','<a class="vp-btn" href="/yonetim/talepler/yeni">'.vp_icon('plus').'Talep aç</a>');
    echo '<div class="vp-chips"><a class="vp-chip" href="?durum=bekleyen"'.($st==='bekleyen'?' aria-current="page"':'').'>Yanıt bekleyen<b>'.((int)($counts['acik']??0)+(int)($counts['musteri_yaniti']??0)).'</b></a>';
    foreach(['acik','musteri_yaniti','yanitlandi','beklemede','kapali'] as $k)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.e(vp_status('ticket',$k)[0]).'<b>'.(int)($counts[$k]??0).'</b></a>';
    echo '<a class="vp-chip" href="?durum=tumu"'.($st==='tumu'?' aria-current="page"':'').'>Tümü</a></div>';
    echo '<form class="vp-filters" method="get"><input type="hidden" name="durum" value="'.e($st).'">'.vp_select('departman',[''=>'Tüm departmanlar']+vp_departments(),$dep,'aria-label="Departman" data-autosubmit').'</form>';
    vpa_ticket_table($rows);echo vp_pager($total,$page,$pages).'</section>';
    vp_shell_end();
}

function vpa_ticket_new(array $a): void {
    vpa_need($a,'tickets');
    $clients=vp_all('SELECT id,company,email FROM clients ORDER BY company');$err='';
    if(vp_is_post()){
        $cid=vp_int($_POST['client_id']??null);$subject=vp_post('subject',200);$body=vp_post('body',20000);
        $dep=array_key_exists($_POST['department']??'',vp_departments())?$_POST['department']:array_key_first(vp_departments());
        $pri=in_array($_POST['priority']??'',['dusuk','normal','yuksek','acil'],true)?$_POST['priority']:'normal';
        if(!$cid||!vp_val('SELECT 1 FROM clients WHERE id=?',[$cid])||$subject===''||$body==='')$err='Müşteri, konu ve mesaj zorunlu.';
        else{
            $now=vp_now();$tid=vp_insert('tickets',['number'=>vp_ticket_number(),'client_id'=>$cid,'subject'=>$subject,'department'=>$dep,'priority'=>$pri,'status'=>'yanitlandi','assigned_admin'=>$a['id']?:null,'created_at'=>$now,'updated_at'=>$now]);
            vp_insert('ticket_messages',['ticket_id'=>$tid,'author_type'=>'admin','author_id'=>$a['id']?:null,'author_name'=>$a['name'],'body'=>$body,'internal'=>0,'created_at'=>$now]);
            vpa_log($a,'Müşteri adına talep açtı',$subject,$cid);if(function_exists('vp_notify_ticket'))vp_notify_ticket('ticket_reply',$tid);vp_flash('Talep açıldı.');vp_redirect('/yonetim/talepler/'.$tid);
        }
    }
    vpa_start($a,'Talep aç','/yonetim/talepler');
    vp_head('Destek','Müşteriye talep aç','Müşteriyi bilgilendirmek veya bir konuyu takip etmek için.','',[['/yonetim/talepler','Talepler'],['#','Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field();
    echo '<label class="vp-field"><span>Müşteri</span>'.vp_select('client_id',[''=>'Seçin…']+array_column(array_map(fn($c)=>['id'=>$c['id'],'l'=>$c['company'].' · '.$c['email']],$clients),'l','id'),(string)vp_int($_GET['musteri']??$_POST['client_id']??null),'required').'</label>';
    echo '<div class="vp-row-3 vp-row"><label class="vp-field"><span>Konu</span><input type="text" name="subject" required maxlength="200"></label><label class="vp-field"><span>Departman</span>'.vp_select('department',vp_departments(),null).'</label><label class="vp-field"><span>Öncelik</span>'.vp_select('priority',['dusuk'=>'Düşük','normal'=>'Normal','yuksek'=>'Yüksek','acil'=>'Acil'],'normal').'</label></div>';
    echo '<label class="vp-field"><span>Mesaj</span><textarea name="body" required rows="8" maxlength="20000"></textarea></label><div class="vp-form-foot"><button class="vp-btn" type="submit">Talebi aç</button></div></form>';
    vp_shell_end();
}

function vpa_ticket_view(array $a,string $id): void {
    vpa_need($a,'tickets');
    $t=vp_row('SELECT t.*,c.company,c.email,c.phone FROM tickets t JOIN clients c ON c.id=t.client_id WHERE t.id=?',[(int)$id]);
    if(!$t){vp_flash('Talep bulunamadı.','err');vp_redirect('/yonetim/talepler');}
    $tid=(int)$t['id'];
    if(vp_is_post()){
        $op=vp_post('op',10);
        if($op==='yanit'){
            $body=vp_post('body',20000);$internal=isset($_POST['internal'])?1:0;
            if($body!==''){
                vp_insert('ticket_messages',['ticket_id'=>$tid,'author_type'=>'admin','author_id'=>$a['id']?:null,'author_name'=>$a['name'],'body'=>$body,'internal'=>$internal,'created_at'=>vp_now()]);
                $new=$internal?$t['status']:(in_array($_POST['after']??'',['yanitlandi','beklemede','kapali'],true)?$_POST['after']:'yanitlandi');
                vp_update('tickets',$tid,['status'=>$new,'updated_at'=>vp_now(),'assigned_admin'=>$t['assigned_admin']??($a['id']?:null)]);
                vpa_log($a,$internal?'Talebe iç not ekledi':'Talebi yanıtladı','#'.$t['number'],(int)$t['client_id']);
                if(!$internal&&function_exists('vp_notify_ticket'))vp_notify_ticket('ticket_reply',$tid);vp_flash($internal?'İç not eklendi.':'Yanıt gönderildi.');
            }
        }elseif($op==='ayar'){
            $d=[];
            if(in_array($_POST['status']??'',['acik','yanitlandi','musteri_yaniti','beklemede','kapali'],true))$d['status']=$_POST['status'];
            if(in_array($_POST['priority']??'',['dusuk','normal','yuksek','acil'],true))$d['priority']=$_POST['priority'];
            if(array_key_exists($_POST['department']??'',vp_departments()))$d['department']=$_POST['department'];
            $as=vp_int($_POST['assigned_admin']??null);$d['assigned_admin']=$as&&vp_val('SELECT 1 FROM admins WHERE id=?',[$as])?$as:null;
            vp_update('tickets',$tid,$d);vp_flash('Talep güncellendi.');
        }
        vp_redirect('/yonetim/talepler/'.$tid);
    }
    $msgs=vp_all('SELECT * FROM ticket_messages WHERE ticket_id=? ORDER BY id',[$tid]);
    $canned=vp_all('SELECT * FROM canned_replies ORDER BY title');
    $admins=array_column(vp_all('SELECT id,name FROM admins WHERE active=1 ORDER BY name'),'name','id');
    $lic=$t['license_id']?vp_row('SELECT l.license_key,l.status,p.name FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.id=?',[$t['license_id']]):null;
    $other=vp_all('SELECT id,number,subject,status FROM tickets WHERE client_id=? AND id<>? ORDER BY id DESC LIMIT 5',[$t['client_id'],$tid]);
    vpa_start($a,$t['subject'],'/yonetim/talepler');
    vp_head('Talep #'.$t['number'].' · '.(vp_departments()[$t['department']]??$t['department']),$t['subject'],'',vp_badge('ticket',$t['status']).' '.vp_badge('priority',$t['priority']),[['/yonetim/talepler','Talepler'],['#','#'.$t['number']]]);
    ?>
<div class="vp-grid vp-grid-main">
  <div class="vp-stack">
    <div class="vp-thread">
    <?php foreach($msgs as $m): $staff=$m['author_type']==='admin';?>
      <article class="vp-msg<?=$m['internal']?' vp-msg--internal':($staff?' vp-msg--staff':'')?>"><header><b><?=e($m['author_name'])?></b><?=$staff?'<span class="vp-role">'.($m['internal']?'İç not':'Veniux').'</span>':''?><span><?=e(vp_date($m['created_at'],true))?></span></header><?=vp_text($m['body'])?></article>
    <?php endforeach;?>
    </div>
    <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="yanit">
      <div class="vp-card-head"><h2>Yanıt yaz</h2><?php if($canned):?><select data-canned="reply-body" aria-label="Hazır yanıt ekle"><option value="">Hazır yanıt ekle…</option><?php foreach($canned as $c):?><option data-body="<?=e($c['body'])?>"><?=e($c['title'])?></option><?php endforeach;?></select><?php endif;?></div>
      <textarea name="body" id="reply-body" rows="7" required maxlength="20000" placeholder="Merhaba <?=e($t['company'])?>,"></textarea>
      <div class="vp-form-foot"><label class="vp-check"><input type="checkbox" name="internal" value="1"> İç not (müşteri görmez)</label><span class="vp-muted">Sonra:</span><?=vp_select('after',['yanitlandi'=>'Yanıtlandı','beklemede'=>'Beklemede','kapali'=>'Kapat'],'yanitlandi','aria-label="Yanıttan sonraki durum"')?><button class="vp-btn" type="submit">Gönder</button></div>
    </form>
  </div>
  <div class="vp-stack">
    <section class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>Müşteri</h2></div>
      <dl class="vp-dl"><dt>İşletme</dt><dd><?=vpa_client_link((int)$t['client_id'],$t['company'])?></dd><dt>E-posta</dt><dd><?=e($t['email'])?></dd><dt>Telefon</dt><dd><?=e($t['phone']?:'—')?></dd><?php if($lic):?><dt>Lisans</dt><dd><a href="/yonetim/lisanslar/<?=$t['license_id']?>" class="vp-mono"><?=e($lic['license_key'])?></a><span class="vp-sub"><?=e($lic['name'])?> · <?=e(vp_status('license',$lic['status'])[0])?></span></dd><?php endif;?><dt>Açılış</dt><dd><?=e(vp_date($t['created_at'],true))?></dd></dl>
    </section>
    <form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="ayar"><div class="vp-card-head"><h2>Talep ayarları</h2></div>
      <label class="vp-field"><span>Durum</span><?=vp_select('status',['acik'=>'Açık','yanitlandi'=>'Yanıtlandı','musteri_yaniti'=>'Müşteri yanıtı','beklemede'=>'Beklemede','kapali'=>'Kapalı'],$t['status'])?></label>
      <div class="vp-row"><label class="vp-field"><span>Öncelik</span><?=vp_select('priority',['dusuk'=>'Düşük','normal'=>'Normal','yuksek'=>'Yüksek','acil'=>'Acil'],$t['priority'])?></label><label class="vp-field"><span>Departman</span><?=vp_select('department',vp_departments(),$t['department'])?></label></div>
      <label class="vp-field"><span>Atanan</span><?=vp_select('assigned_admin',[''=>'Atanmadı']+$admins,(string)($t['assigned_admin']??''))?></label>
      <button class="vp-btn vp-btn--ink vp-btn--sm" type="submit">Kaydet</button>
    </form>
    <?php if($other):?><section class="vp-card"><div class="vp-card-head"><h2>Diğer talepleri</h2></div><ul class="vp-list"><?php foreach($other as $o):?><li><div><a href="/yonetim/talepler/<?=$o['id']?>"><?=e($o['subject'])?></a><span class="vp-sub">#<?=e($o['number'])?></span></div><?=vp_badge('ticket',$o['status'])?></li><?php endforeach;?></ul></section><?php endif;?>
  </div>
</div>
<?php
    vp_shell_end();
}

function vpa_canned(array $a): void {
    vpa_need($a,'tickets');
    if(vp_is_post()){
        $cid=vp_int($_POST['id']??null);
        if(($_POST['op']??'')==='sil'&&$cid){vp_q('DELETE FROM canned_replies WHERE id=?',[$cid]);vp_flash('Hazır yanıt silindi.');}
        else{$d=['title'=>vp_post('title',120),'body'=>vp_post('body',8000)];if($d['title']===''||$d['body']==='')vp_flash('Başlık ve metin zorunlu.','err');elseif($cid){vp_update('canned_replies',$cid,$d);vp_flash('Kaydedildi.');}else{vp_insert('canned_replies',$d+['created_at'=>vp_now()]);vp_flash('Hazır yanıt eklendi.');}}
        vp_redirect('/yonetim/hazir-yanitlar');
    }
    $rows=vp_all('SELECT * FROM canned_replies ORDER BY title');
    vpa_start($a,'Hazır yanıtlar','/yonetim/hazir-yanitlar');
    vp_head('Destek','Hazır yanıtlar','Talep yanıtlarında tek tıkla eklenen metinler.');
    echo '<div class="vp-grid vp-grid-2">';
    foreach([...$rows,[]] as $r){$new=!$r;echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field().($new?'':'<input type="hidden" name="id" value="'.(int)$r['id'].'">').'<div class="vp-card-head"><h2>'.($new?'Yeni hazır yanıt':e($r['title'])).'</h2></div><label class="vp-field"><span>Başlık</span><input type="text" name="title" required maxlength="120" value="'.e($r['title']??'').'"></label><label class="vp-field"><span>Metin</span><textarea name="body" required rows="6" maxlength="8000">'.e($r['body']??'').'</textarea></label><div class="vp-form-foot"><button class="vp-btn vp-btn--sm" type="submit" name="op" value="kaydet">Kaydet</button>'.($new?'':'<button class="vp-btn vp-btn--danger vp-btn--sm" type="submit" name="op" value="sil" formnovalidate>Sil</button>').'</div></form>';}
    echo '</div>';vp_shell_end();
}

// ---------------------------------------------------------------- bilgi bankası
function vpa_kb(array $a): void {
    vpa_need($a,'kb');
    $rows=vp_all('SELECT * FROM kb_articles ORDER BY category,title');
    vpa_start($a,'Bilgi bankası','/yonetim/bilgi-bankasi');
    vp_head('Destek','Bilgi bankası','Müşteri panelinde yayınlanan yardım makaleleri.','<a class="vp-btn" href="/yonetim/bilgi-bankasi/yeni">'.vp_icon('plus').'Makale yaz</a>');
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Makale yok.');
    else{echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Başlık</th><th>Kategori</th><th>Durum</th><th class="num">Görüntülenme</th><th>Güncelleme</th></tr></thead><tbody>';
        foreach($rows as $r)echo '<tr><td data-l="Başlık"><a class="vp-strong" href="/yonetim/bilgi-bankasi/'.$r['id'].'">'.e($r['title']).'</a></td><td data-l="Kategori">'.e($r['category']).'</td><td data-l="Durum">'.($r['published']?'<span class="vp-badge vp-badge--ok">Yayında</span>':'<span class="vp-badge vp-badge--off">Taslak</span>').'</td><td data-l="Görüntülenme" class="num">'.(int)$r['views'].'</td><td data-l="Güncelleme" class="nowrap vp-muted">'.e(vp_date($r['updated_at'])).'</td></tr>';
        echo '</tbody></table></div>';}
    echo '</section>';vp_shell_end();
}

function vpa_kb_form(array $a,string $id=''): void {
    vpa_need($a,'kb');
    $r=$id!==''?vp_row('SELECT * FROM kb_articles WHERE id=?',[(int)$id]):null;
    if($id!==''&&!$r)vp_redirect('/yonetim/bilgi-bankasi');
    if(vp_is_post()){
        if(($_POST['op']??'')==='sil'&&$r){vp_q('DELETE FROM kb_articles WHERE id=?',[$r['id']]);vp_flash('Makale silindi.');vp_redirect('/yonetim/bilgi-bankasi');}
        $d=['category'=>vp_post('category',80)?:'Genel','title'=>vp_post('title',200),'body'=>vp_post('body',40000),'published'=>isset($_POST['published'])?1:0,'updated_at'=>vp_now()];
        if($d['title']===''||$d['body']==='')vp_flash('Başlık ve metin zorunlu.','err');
        else{if($r)vp_update('kb_articles',(int)$r['id'],$d);else $id=(string)vp_insert('kb_articles',$d+['created_at'=>vp_now()]);vpa_log($a,'Bilgi bankası makalesini kaydetti',$d['title']);vp_flash('Makale kaydedildi.');vp_redirect('/yonetim/bilgi-bankasi/'.($r['id']??$id));}
        $r=array_merge($r??[],$d);
    }
    $r??=['category'=>'','title'=>'','body'=>'','published'=>1];
    $cats=array_column(vp_all('SELECT DISTINCT category FROM kb_articles ORDER BY category'),'category');
    vpa_start($a,'Makale','/yonetim/bilgi-bankasi');
    vp_head('Destek',$id?$r['title']:'Yeni makale','','',[['/yonetim/bilgi-bankasi','Bilgi bankası'],['#',$id?'Düzenle':'Yeni']]);
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row"><label class="vp-field"><span>Başlık</span><input type="text" name="title" required maxlength="200" value="<?=e($r['title'])?>"></label>
  <label class="vp-field"><span>Kategori</span><input type="text" name="category" maxlength="80" list="kb-cats" value="<?=e($r['category'])?>"><datalist id="kb-cats"><?php foreach($cats as $c):?><option value="<?=e($c)?>"><?php endforeach;?></datalist></label></div>
  <label class="vp-field"><span>Metin</span><textarea name="body" required rows="14" maxlength="40000"><?=e($r['body'])?></textarea><small>Boş satırla paragraf ayırın. Bağlantılar otomatik tıklanabilir olur.</small></label>
  <label class="vp-check"><input type="checkbox" name="published" value="1"<?=$r['published']?' checked':''?>> Müşteri panelinde yayınla</label>
  <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="kaydet">Kaydet</button><?php if($id):?><button class="vp-btn vp-btn--danger" type="submit" name="op" value="sil" formnovalidate data-confirm="Makale silinsin mi?">Sil</button><?php endif;?></div>
</form>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- duyurular
function vpa_announcements(array $a): void {
    vpa_need($a,'announcements');
    $rows=vp_all('SELECT * FROM announcements ORDER BY pinned DESC,id DESC');
    vpa_start($a,'Duyurular','/yonetim/duyurular');
    vp_head('Destek','Duyurular','Müşteri panelinin ana sayfasında görünür: sürüm, bakım ve kampanya duyuruları.','<a class="vp-btn" href="/yonetim/duyurular/yeni">'.vp_icon('plus').'Duyuru yaz</a>');
    if(!$rows)echo '<section class="vp-card">'.vp_empty('Duyuru yok.').'</section>';
    foreach($rows as $r)echo '<article class="vp-announce vp-announce--'.e($r['tone']).'"><h3><a href="/yonetim/duyurular/'.$r['id'].'">'.e($r['title']).'</a></h3><time>'.e(vp_date($r['created_at'])).($r['pinned']?' · Sabitlendi':'').($r['published']?'':' · Taslak').'</time>'.vp_text(mb_strimwidth($r['body'],0,280,'…','UTF-8')).'</article>';
    vp_shell_end();
}

function vpa_announcement_form(array $a,string $id=''): void {
    vpa_need($a,'announcements');
    $r=$id!==''?vp_row('SELECT * FROM announcements WHERE id=?',[(int)$id]):null;
    if($id!==''&&!$r)vp_redirect('/yonetim/duyurular');
    if(vp_is_post()){
        if(($_POST['op']??'')==='sil'&&$r){vp_q('DELETE FROM announcements WHERE id=?',[$r['id']]);vp_flash('Duyuru silindi.');vp_redirect('/yonetim/duyurular');}
        $d=['title'=>vp_post('title',200),'body'=>vp_post('body',10000),'tone'=>in_array($_POST['tone']??'',['bilgi','uyari','bakim'],true)?$_POST['tone']:'bilgi','published'=>isset($_POST['published'])?1:0,'pinned'=>isset($_POST['pinned'])?1:0];
        if($d['title']===''||$d['body']==='')vp_flash('Başlık ve metin zorunlu.','err');
        else{if($r)vp_update('announcements',(int)$r['id'],$d);else vp_insert('announcements',$d+['created_at'=>vp_now()]);vpa_log($a,'Duyuru kaydetti',$d['title']);vp_flash('Duyuru kaydedildi.');vp_redirect('/yonetim/duyurular');}
        $r=array_merge($r??[],$d);
    }
    $r??=['title'=>'','body'=>'','tone'=>'bilgi','published'=>1,'pinned'=>0];
    vpa_start($a,'Duyuru','/yonetim/duyurular');
    vp_head('Destek',$id?'Duyuruyu düzenle':'Yeni duyuru','','',[['/yonetim/duyurular','Duyurular'],['#',$id?'Düzenle':'Yeni']]);
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row"><label class="vp-field"><span>Başlık</span><input type="text" name="title" required maxlength="200" value="<?=e($r['title'])?>"></label><label class="vp-field"><span>Tür</span><?=vp_select('tone',['bilgi'=>'Bilgi','uyari'=>'Önemli','bakim'=>'Bakım / kesinti'],$r['tone'])?></label></div>
  <label class="vp-field"><span>Metin</span><textarea name="body" required rows="8" maxlength="10000"><?=e($r['body'])?></textarea></label>
  <label class="vp-check"><input type="checkbox" name="published" value="1"<?=$r['published']?' checked':''?>> Yayınla</label>
  <label class="vp-check"><input type="checkbox" name="pinned" value="1"<?=$r['pinned']?' checked':''?>> En üste sabitle</label>
  <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="kaydet">Kaydet</button><?php if($id):?><button class="vp-btn vp-btn--danger" type="submit" name="op" value="sil" formnovalidate>Sil</button><?php endif;?></div>
</form>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- site iletişim talepleri (.local/website-contact-requests)
function vpa_contact_dir(): ?string { $cfg=$GLOBALS['config']??null;$d=is_array($cfg)?(string)($cfg['request_dir']??''):'';return $d!==''&&is_dir($d)?realpath($d)?:null:null; }
function vpa_contact_pending(): int {
    $d=vpa_contact_dir();if(!$d)return 0;$n=0;
    foreach(glob($d.'/*.json')?:[] as $f){$r=json_decode((string)@file_get_contents($f),true);if(is_array($r)&&($r['status']??'pending')==='pending')$n++;}
    return $n;
}
function vpa_contact(array $a): void {
    vpa_need($a,'contact');
    $d=vpa_contact_dir();
    if(vp_is_post()&&$d){
        $fid=preg_replace('/[^a-f0-9]/','',vp_post('id',64));$f=$d.'/'.$fid.'.json';
        if($fid!==''&&is_file($f)){$r=json_decode((string)file_get_contents($f),true);if(is_array($r)){$r['status']=in_array($_POST['status']??'',['pending','done','spam'],true)?$_POST['status']:'done';file_put_contents($f,json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX);vp_flash('Talep güncellendi.');}}
        vp_redirect('/yonetim/iletisim?durum='.rawurlencode(vp_get('durum',10)));
    }
    $st=vp_get('durum',10)?:'pending';$rows=[];
    foreach($d?glob($d.'/*.json')?:[]:[] as $f){$r=json_decode((string)@file_get_contents($f),true);if(is_array($r)&&($r['status']??'pending')===$st)$rows[]=$r;}
    usort($rows,fn($x,$y)=>strcmp((string)($y['created_at']??''),(string)($x['created_at']??'')));
    vpa_start($a,'Site talepleri','/yonetim/iletisim');
    vp_head('Destek','Site talepleri','veniux.com iletişim, demo ve teklif formundan gelen kayıtlar.');
    echo '<div class="vp-chips">';foreach(['pending'=>'Yeni','done'=>'İşlendi','spam'=>'Spam'] as $k=>$l)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'</a>';echo '</div>';
    if(!$d){echo '<section class="vp-card">'.vp_empty('Talep klasörü bulunamadı.','Henüz form gönderilmemiş olabilir.').'</section>';vp_shell_end();return;}
    if(!$rows){echo '<section class="vp-card">'.vp_empty('Bu durumda talep yok.').'</section>';vp_shell_end();return;}
    echo '<div class="vp-grid vp-grid-2">';
    foreach(array_slice($rows,0,100) as $r){
        $created=isset($r['created_at'])?gmdate('Y-m-d H:i:s',strtotime((string)$r['created_at'])):null;
        echo '<article class="vp-card"><div class="vp-card-head"><div><span class="vp-label">'.e((string)($r['form_type']??'iletişim')).($created?' · '.e(vp_date($created,true)):'').'</span><h2>'.e((string)($r['company']??'')?:(string)($r['name']??'')).'</h2></div></div>';
        echo '<dl class="vp-dl"><dt>Ad</dt><dd>'.e((string)($r['name']??'')).'</dd><dt>E-posta</dt><dd><a href="mailto:'.e((string)($r['email']??'')).'">'.e((string)($r['email']??'')).'</a></dd>';
        foreach(['plan'=>'Paket','sector'=>'Sektör','warehouses'=>'Depo','registers'=>'Kasa','users'=>'Kullanıcı'] as $k=>$l)if(isset($r[$k])&&is_scalar($r[$k]))echo '<dt>'.$l.'</dt><dd>'.e((string)$r[$k]).'</dd>';
        echo '</dl>'.(!empty($r['interest'])&&is_string($r['interest'])?'<div class="vp-note">'.vp_text($r['interest']).'</div><br>':'');
        echo '<form method="post" class="vp-actions">'.vp_csrf_field().'<input type="hidden" name="id" value="'.e((string)($r['id']??'')).'">'.($st!=='done'?'<button class="vp-btn vp-btn--sm" name="status" value="done">İşlendi</button>':'').($st!=='pending'?'<button class="vp-btn vp-btn--ghost vp-btn--sm" name="status" value="pending">Yeniye al</button>':'').($st!=='spam'?'<button class="vp-btn vp-btn--danger vp-btn--sm" name="status" value="spam">Spam</button>':'').'</form></article>';
    }
    echo '</div>';vp_shell_end();
}

// ---------------------------------------------------------------- yöneticiler
function vpa_admins(array $a): void {
    vpa_need($a,'admins');
    $rows=vp_all('SELECT * FROM admins ORDER BY active DESC,name');
    vpa_start($a,'Yöneticiler','/yonetim/yoneticiler');
    vp_head('Sistem','Yöneticiler ve roller','Panel hesapları. Rol, hangi bölümlerin görüneceğini belirler.','<a class="vp-btn" href="/yonetim/yoneticiler/yeni">'.vp_icon('plus').'Yönetici ekle</a>');
    ?>
<div class="vp-grid vp-grid-main">
  <section class="vp-card vp-card--flush"><div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Ad</th><th>Rol</th><th>Durum</th><th>Son giriş</th></tr></thead><tbody>
  <?php foreach($rows as $r):?><tr><td data-l="Ad"><a class="vp-strong" href="/yonetim/yoneticiler/<?=$r['id']?>"><?=e($r['name'])?></a><span class="vp-sub"><?=e($r['email'])?></span></td><td data-l="Rol"><?=e(VP_ROLES[$r['role']]??$r['role'])?></td><td data-l="Durum"><?=$r['active']?'<span class="vp-badge vp-badge--ok">Aktif</span>':'<span class="vp-badge vp-badge--off">Kapalı</span>'?></td><td data-l="Son giriş" class="nowrap vp-muted"><?=e(vp_ago($r['last_login']))?></td></tr><?php endforeach;?>
  </tbody></table></div><?=$rows?'':vp_empty('Yönetici yok.')?></section>
  <section class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>Roller</h2></div>
    <dl class="vp-dl"><dt>Yönetici</dt><dd>Tüm bölümler, ayarlar, paketler ve silme işlemleri.</dd><dt>Muhasebe</dt><dd>Müşteri, sipariş, lisans, fatura, havale, kupon ve finans.</dd><dt>Destek</dt><dd>Talepler, bilgi bankası, duyurular, site talepleri; müşteri ve lisans görüntüleme, cihaz sıfırlama.</dd></dl>
  </section>
</div>
<?php
    vp_shell_end();
}

function vpa_admin_form(array $a,string $id=''): void {
    vpa_need($a,'admins');
    $r=$id!==''?vp_row('SELECT * FROM admins WHERE id=?',[(int)$id]):null;$err='';
    if($id!==''&&!$r)vp_redirect('/yonetim/yoneticiler');
    if(vp_is_post()){
        $d=['name'=>vp_post('name',120),'email'=>strtolower(vp_post('email',190)),'role'=>array_key_exists($_POST['role']??'',VP_ROLES)?$_POST['role']:'destek','active'=>isset($_POST['active'])?1:0];
        $pass=is_string($_POST['password']??null)?$_POST['password']:'';
        if($r&&(int)$r['id']===$a['id']){$d['active']=1;$d['role']=$r['role'];}
        if($d['name']===''||!filter_var($d['email'],FILTER_VALIDATE_EMAIL))$err='Ad ve geçerli e-posta girin.';
        elseif(vp_val('SELECT 1 FROM admins WHERE email=? AND id<>?',[$d['email'],$r['id']??0]))$err='Bu e-posta başka bir yöneticide.';
        elseif((!$r||$pass!=='')&&(strlen($pass)<12||strlen($pass)>200))$err='Şifre en az 12 karakter olmalı.';
        else{
            if($pass!=='')$d['password_hash']=password_hash($pass,PASSWORD_DEFAULT);
            if($r)vp_update('admins',(int)$r['id'],$d);else vp_insert('admins',$d+['created_at'=>vp_now()]);
            vpa_log($a,$r?'Yöneticiyi güncelledi':'Yönetici ekledi',$d['email']);vp_flash('Yönetici kaydedildi.');vp_redirect('/yonetim/yoneticiler');
        }
        $r=array_merge($r??[],$d);
    }
    $r??=['name'=>'','email'=>'','role'=>'destek','active'=>1];
    vpa_start($a,'Yönetici','/yonetim/yoneticiler');
    vp_head('Sistem',$id?$r['name']:'Yeni yönetici','','',[['/yonetim/yoneticiler','Yöneticiler'],['#',$id?'Düzenle':'Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row"><label class="vp-field"><span>Ad soyad</span><input type="text" name="name" required maxlength="120" value="<?=e($r['name'])?>"></label><label class="vp-field"><span>E-posta</span><input type="email" name="email" required maxlength="190" value="<?=e($r['email'])?>" autocomplete="off"></label></div>
  <div class="vp-row"><label class="vp-field"><span>Rol</span><?=vp_select('role',VP_ROLES,$r['role'])?></label><label class="vp-field"><span><?=$id?'Yeni şifre (boş: değişmez)':'Şifre'?></span><input type="password" name="password" minlength="12" maxlength="200" autocomplete="new-password"<?=$id?'':' required'?>></label></div>
  <label class="vp-check"><input type="checkbox" name="active" value="1"<?=$r['active']?' checked':''?>> Hesap aktif</label>
  <div class="vp-form-foot"><button class="vp-btn" type="submit">Kaydet</button></div>
</form>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- sistem kayıtları
function vpa_logs(array $a): void {
    vpa_need($a,'logs');
    $q=vp_get('q',100);$type=vp_get('tur',12);$where=['1=1'];$args=[];
    if($q!==''){$where[]='(action LIKE ? OR detail LIKE ? OR actor_name LIKE ? OR ip LIKE ?)';array_push($args,"%$q%","%$q%","%$q%","%$q%");}
    if(in_array($type,['yonetici','musteri','sistem'],true)){$where[]='actor_type=?';$args[]=$type;}
    $w=implode(' AND ',$where);
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM activity WHERE $w",$args,40);
    $rows=vp_all("SELECT * FROM activity WHERE $w ORDER BY id DESC LIMIT $per OFFSET $off",$args);
    vpa_start($a,'Sistem kayıtları','/yonetim/kayitlar');
    vp_head('Sistem','Sistem kayıtları','Yönetici, müşteri ve otomasyon işlemlerinin izi.');
    ?>
<section class="vp-card vp-card--flush">
  <form class="vp-filters vp-card-head" method="get"><input type="search" name="q" value="<?=e($q)?>" placeholder="İşlem, kişi, IP…" aria-label="Kayıt ara"><?=vp_select('tur',[''=>'Tüm kaynaklar','yonetici'=>'Yönetici','musteri'=>'Müşteri','sistem'=>'Sistem'],$type,'aria-label="Kaynak"')?><button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Filtrele</button></form>
  <?php if(!$rows): echo vp_empty('Kayıt yok.'); else:?>
  <div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Zaman</th><th>Kim</th><th>İşlem</th><th>Ayrıntı</th><th>IP</th></tr></thead><tbody>
  <?php foreach($rows as $r):?><tr><td data-l="Zaman" class="nowrap vp-muted"><?=e(vp_date($r['created_at'],true))?></td><td data-l="Kim"><b><?=e($r['actor_name'])?></b><span class="vp-sub"><?=e(['yonetici'=>'Yönetici','musteri'=>'Müşteri','sistem'=>'Sistem'][$r['actor_type']]??$r['actor_type'])?></span></td><td data-l="İşlem"><?=e($r['action'])?><?=$r['client_id']?' <a href="/yonetim/musteriler/'.(int)$r['client_id'].'">→</a>':''?></td><td data-l="Ayrıntı" class="vp-muted"><?=e($r['detail'])?></td><td data-l="IP" class="vp-mono vp-muted"><?=e($r['ip'])?></td></tr><?php endforeach;?>
  </tbody></table></div><?=vp_pager($total,$page,$pages)?>
  <?php endif;?>
</section>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- ayarlar
function vpa_settings(array $a): void {
    vpa_need($a,'settings');
    $sec=vp_get('bolum',20)?:'genel';
    $fields=[
        'genel'=>[['company_name','Firma adı','text'],['company_email','Firma e-postası','email'],['company_address','Adres','textarea'],['company_tax_office','Vergi dairesi','text'],['company_tax_no','Vergi no','text']],
        'fatura'=>[['tax_rate','KDV oranı (%)','number'],['prices_include_tax','Fiyatlar KDV dahil','check'],['invoice_prefix','Fatura öneki','text'],['invoice_due_days','Son ödeme süresi (gün)','number'],['bank_accounts','Banka hesapları (her satır bir bilgi)','textarea'],['transfer_note','Havale açıklaması','textarea'],['allow_balance_pay','Bakiye ile ödemeye izin ver','check'],['orders_open','Müşteri panelinden sipariş alınsın','check']],
        'otomasyon'=>[['renewal_notice_days','Yenileme faturası kaç gün önce kesilsin','number'],['suspend_after_days','Süresi dolan lisans kaç gün sonra askıya alınsın','number'],['device_reset_hours','Müşteri cihaz sıfırlama aralığı (saat)','number']],
        'destek'=>[['ticket_departments','Departmanlar (anahtar|Ad, her satıra bir)','textarea']],
    ];
    if(!isset($fields[$sec]))$sec='genel';
    if(vp_is_post()){
        if(($_POST['op']??'')==='otomasyon'){$r=vp_automation(true);vpa_log($a,'Otomasyonu elle çalıştırdı');vp_flash('Otomasyon çalıştı: '.$r['renewals'].' yenileme faturası, '.$r['expired'].' süresi dolan, '.$r['suspended'].' askıya alınan.');vp_redirect('/yonetim/ayarlar?bolum=otomasyon');}
        foreach($fields[$sec] as [$k,,$t]){
            $v=$t==='check'?(isset($_POST[$k])?'1':'0'):vp_post($k,4000);
            if($t==='number')$v=(string)max(0,min(3650,(int)$v));
            vp_set_setting($k,$v);
        }
        vpa_log($a,'Ayarları güncelledi',$sec);vp_flash('Ayarlar kaydedildi.');vp_redirect('/yonetim/ayarlar?bolum='.$sec);
    }
    vpa_start($a,'Ayarlar','/yonetim/ayarlar');
    vp_head('Sistem','Ayarlar');
    echo '<nav class="vp-tabs">';foreach(['genel'=>'Firma','fatura'=>'Fatura ve ödeme','otomasyon'=>'Otomasyon','destek'=>'Destek'] as $k=>$l)echo '<a href="?bolum='.$k.'"'.($sec===$k?' aria-current="page"':'').'>'.$l.'</a>';echo '</nav>';
    echo '<div class="vp-grid vp-grid-main"><form class="vp-card vp-form" method="post">'.vp_csrf_field();
    foreach($fields[$sec] as [$k,$l,$t]){
        $v=vp_setting($k);
        if($t==='check')echo '<label class="vp-check"><input type="checkbox" name="'.$k.'" value="1"'.($v==='1'?' checked':'').'> '.e($l).'</label>';
        elseif($t==='textarea')echo '<label class="vp-field"><span>'.e($l).'</span><textarea name="'.$k.'" rows="4" maxlength="4000">'.e($v).'</textarea></label>';
        else echo '<label class="vp-field"><span>'.e($l).'</span><input type="'.$t.'" name="'.$k.'" value="'.e($v).'"'.($t==='number'?' min="0" max="3650"':' maxlength="200"').'></label>';
    }
    echo '<div class="vp-form-foot"><button class="vp-btn" type="submit">Kaydet</button></div></form><div class="vp-stack">';
    if($sec==='otomasyon'){
        $last=(int)vp_setting('automation_last_run','0');
        echo '<section class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>Otomasyon</h2></div><p>Panel açıldıkça saatte bir kendiliğinden çalışır. Sunucuda zamanlanmış görev olarak da çalıştırabilirsiniz:</p><p class="vp-mono">php bin/panel-cron.php</p><p class="vp-muted">Son çalışma: '.($last?e(vp_date(gmdate('Y-m-d H:i:s',$last),true)):'—').'</p><form method="post">'.vp_csrf_field().'<button class="vp-btn vp-btn--ink vp-btn--sm" name="op" value="otomasyon">Şimdi çalıştır</button></form></section>';
    }
    $db=vp_db_config();
    echo '<section class="vp-card"><div class="vp-card-head"><h2>Sistem</h2></div><dl class="vp-dl"><dt>Veritabanı</dt><dd>MySQL · '.e($db['name']).' @ '.e($db['host']).'</dd><dt>Sunucu</dt><dd>'.e((string)vp_db()->getAttribute(PDO::ATTR_SERVER_VERSION)).'</dd><dt>PHP</dt><dd>'.e(PHP_VERSION).'</dd></dl></section></div></div>';
    vp_shell_end();
}

// ---------------------------------------------------------------- araçlar
function vpa_tools(array $a): void {
    vpa_need($a,'tools');
    vpa_start($a,'Araçlar','/yonetim/araclar');
    vp_head('Sistem','Araçlar','Teklif ve fatura hazırlarken hızlı hesaplar.');
    $rate=(int)vp_setting('tax_rate','20');
    ?>
<div class="vp-grid vp-grid-2">
  <form class="vp-card vp-form" data-calc="kdv"><div class="vp-card-head"><h2>KDV hesaplayıcı</h2></div>
    <div class="vp-row-3 vp-row"><label class="vp-field"><span>Tutar (₺)</span><input type="text" name="amount" inputmode="decimal" value="6490"></label><label class="vp-field"><span>KDV %</span><input type="text" name="rate" inputmode="decimal" value="<?=$rate?>"></label><label class="vp-field"><span>Tutar</span><select name="mode"><option value="dahil">KDV dahil</option><option value="haric">KDV hariç</option></select></label></div>
    <div class="vp-calc-out" data-out aria-live="polite"></div></form>
  <form class="vp-card vp-form" data-calc="indirim"><div class="vp-card-head"><h2>İndirim hesaplayıcı</h2></div>
    <div class="vp-row"><label class="vp-field"><span>Liste fiyatı (₺)</span><input type="text" name="amount" inputmode="decimal" value="16900"></label><label class="vp-field"><span>İndirim %</span><input type="text" name="rate" inputmode="decimal" value="15"></label></div>
    <div class="vp-calc-out" data-out aria-live="polite"></div></form>
</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- profil
function vpa_profile(array $a): void {
    if(vp_is_post()&&str_starts_with(vp_post('op',10),'foto')){if(!empty($_SESSION['vp_impersonator']))vp_flash('Müşteri görünümünde fotoğraf değiştirilemez.','err');else vp_avatar_post(...vpa_avatar_id($a));vp_redirect('/yonetim/profil');}
    if(vp_is_post()&&$a['owner']&&vp_post('op',10)==='sifre'){
        $cur=is_string($_POST['current']??null)?$_POST['current']:'';$new=is_string($_POST['password']??null)?$_POST['password']:'';$new2=is_string($_POST['password2']??null)?$_POST['password2']:'';
        if(mb_strlen($new)<14||strlen($new)>72)vp_flash('Yeni şifre 14–72 karakter olmalı.','err');
        elseif($new!==$new2)vp_flash('Yeni şifreler eşleşmiyor.','err');
        elseif(!vp_rate_ok('pw-owner',5))vp_flash('Çok fazla deneme. 15 dakika sonra tekrar deneyin.','err');
        else{try{$ok=vp_site_account_password($a['email'],$new,$cur);}catch(Throwable){$ok=false;}
            if($ok){session_regenerate_id(true);vpa_log($a,'Sahip şifresini değiştirdi');vp_flash('Şifreniz değiştirildi.');}else vp_flash('Mevcut şifre doğrulanamadı.','err');}
        vp_redirect('/yonetim/profil');
    }
    if(vp_is_post()&&!$a['owner']){
        $r=vp_row('SELECT * FROM admins WHERE id=?',[$a['id']]);
        $cur=is_string($_POST['current']??null)?$_POST['current']:'';$new=is_string($_POST['password']??null)?$_POST['password']:'';
        $name=vp_post('name',120);
        if(!$r||!password_verify($cur,$r['password_hash']))vp_flash('Mevcut şifre doğrulanamadı.','err');
        elseif($new!==''&&(strlen($new)<12||strlen($new)>200))vp_flash('Yeni şifre en az 12 karakter olmalı.','err');
        else{$d=['name'=>$name?:$r['name']];if($new!=='')$d['password_hash']=password_hash($new,PASSWORD_DEFAULT);vp_update('admins',$a['id'],$d);vpa_log($a,'Profilini güncelledi');vp_flash('Profil kaydedildi.');}
        vp_redirect('/yonetim/profil');
    }
    vpa_start($a,'Profil','/yonetim/profil');
    vp_head('Hesabım','Profil ve şifre',$a['email']);
    vp_avatar_card('admin',...vpa_avatar_id($a),...[$a['name']]);
    echo '<div class="vp-gap"></div>';
    if($a['owner']){?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="sifre"><div class="vp-card-head"><h2>Şifre değiştir</h2></div>
  <p class="vp-muted">Sahip hesabıyla giriş yaptınız; bu şifre veniux.com hesabınızın şifresidir.</p>
  <label class="vp-field"><span>Mevcut şifre</span><input type="password" name="current" required autocomplete="current-password"></label>
  <div class="vp-row"><label class="vp-field"><span>Yeni şifre</span><input type="password" name="password" required minlength="14" maxlength="72" autocomplete="new-password"><small>En az 14 karakter.</small></label><label class="vp-field"><span>Yeni şifre (tekrar)</span><input type="password" name="password2" required minlength="14" maxlength="72" autocomplete="new-password"></label></div>
  <div class="vp-form-foot"><button class="vp-btn" type="submit">Şifreyi değiştir</button></div>
</form>
<?php vp_shell_end();return;}
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row"><label class="vp-field"><span>Ad soyad</span><input type="text" name="name" maxlength="120" value="<?=e($a['name'])?>"></label><label class="vp-field"><span>Rol</span><input type="text" value="<?=e(VP_ROLES[$a['role']]??$a['role'])?>" readonly></label></div>
  <div class="vp-row"><label class="vp-field"><span>Mevcut şifre *</span><input type="password" name="current" required autocomplete="current-password"></label><label class="vp-field"><span>Yeni şifre</span><input type="password" name="password" minlength="12" maxlength="200" autocomplete="new-password"><small>Boş: değişmez.</small></label></div>
  <div class="vp-form-foot"><button class="vp-btn" type="submit">Kaydet</button></div>
</form>
<?php
    vp_shell_end();
}
