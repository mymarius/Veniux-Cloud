<?php
declare(strict_types=1);
// Yönetim: ödeme yöntemleri (PayTR, iyzico, havale) ve kart ödeme denemeleri.

function vpa_gateways(array $a): void {
    vpa_need($a,'settings');
    if(vp_is_post()){
        $op=vp_post('op',20);
        $secret=function(string $field,string $key){$v=trim((string)($_POST[$field]??''));if($v!=='')vp_set_secret_setting($key,mb_substr($v,0,200));};
        if($op==='paytr'||$op==='paytr_test'){
            vp_set_setting('paytr_enabled',isset($_POST['enabled'])?'1':'0');
            $mid=vp_post('merchant_id',40);
            if($mid!==''&&!ctype_digit($mid)){vp_flash('Mağaza no yalnız rakamlardan oluşmalı. Tarayıcı bu alanı otomatik doldurduysa temizleyip PayTR mağaza numaranızı girin.','err');vp_redirect('/yonetim/odeme-yontemleri');}
            vp_set_setting('paytr_merchant_id',$mid);
            $secret('merchant_key','paytr_merchant_key');$secret('merchant_salt','paytr_merchant_salt');
            vp_set_setting('paytr_test_mode',isset($_POST['test_mode'])?'1':'0');
            vp_set_setting('paytr_max_installment',(string)max(0,min(12,(int)($_POST['max_installment']??0))));
            vp_set_setting('paytr_label',vp_post('label',80));
            vpa_log($a,'PayTR ayarlarını güncelledi',vp_setting('paytr_enabled')==='1'?'aktif':'kapalı');
            if($op==='paytr_test'){[$ok,$msg]=vp_paytr_test();vp_flash($msg,$ok?'ok':'err');}
            else vp_flash('PayTR ayarları kaydedildi.'.(vp_setting('paytr_enabled')==='1'&&!vp_gateway_ready('paytr')?' Eksik bilgi olduğu için müşterilere henüz gösterilmiyor.':''),vp_setting('paytr_enabled')==='1'&&!vp_gateway_ready('paytr')?'info':'ok');
        }elseif($op==='iyzico'||$op==='iyzico_test'){
            vp_set_setting('iyzico_enabled',isset($_POST['enabled'])?'1':'0');
            $secret('api_key','iyzico_api_key');$secret('secret_key','iyzico_secret_key');
            vp_set_setting('iyzico_sandbox',isset($_POST['sandbox'])?'1':'0');
            $inst=array_intersect(array_map('intval',(array)($_POST['installments']??[])),[1,2,3,6,9,12]);
            vp_set_setting('iyzico_installments',implode(',',$inst?:[1]));
            vp_set_setting('iyzico_label',vp_post('label',80));
            vpa_log($a,'iyzico ayarlarını güncelledi',vp_setting('iyzico_enabled')==='1'?'aktif':'kapalı');
            if($op==='iyzico_test'){[$ok,$msg]=vp_iyzico_test();vp_flash($msg,$ok?'ok':'err');}
            else vp_flash('iyzico ayarları kaydedildi.'.(vp_setting('iyzico_enabled')==='1'&&!vp_gateway_ready('iyzico')?' Eksik bilgi olduğu için müşterilere henüz gösterilmiyor.':''),vp_setting('iyzico_enabled')==='1'&&!vp_gateway_ready('iyzico')?'info':'ok');
        }elseif($op==='genel'){
            $url=rtrim(vp_post('public_url',200),'/');
            if($url!==''&&!preg_match('#^https://[a-z0-9.-]+(:\d+)?$#i',$url)){vp_flash('Site adresi https:// ile başlamalı ve yol içermemeli (ör. https://veniux.com).','err');vp_redirect('/yonetim/odeme-yontemleri');}
            vp_set_setting('public_url',$url);
            vp_set_setting('transfer_enabled',isset($_POST['transfer_enabled'])?'1':'0');
            vp_set_setting('default_gateway',in_array($_POST['default_gateway']??'',['iyzico','paytr'],true)?$_POST['default_gateway']:'iyzico');
            vpa_log($a,'Genel ödeme ayarlarını güncelledi');vp_flash('Genel ödeme ayarları kaydedildi.');
        }elseif(in_array($op,['paytr_sil','iyzico_sil'],true)){
            $g=substr($op,0,-4);
            foreach($g==='paytr'?['paytr_merchant_key','paytr_merchant_salt']:['iyzico_api_key','iyzico_secret_key'] as $k)vp_set_setting($k,'');
            vp_set_setting($g.'_enabled','0');vpa_log($a,($g==='paytr'?'PayTR':'iyzico').' anahtarlarını sildi');vp_flash('Anahtarlar silindi ve yöntem kapatıldı.');
        }
        vp_redirect('/yonetim/odeme-yontemleri');
    }
    $base=vp_public_url();
    $attempts=vp_all('SELECT p.*,i.number,c.company FROM payment_attempts p JOIN invoices i ON i.id=p.invoice_id JOIN clients c ON c.id=p.client_id ORDER BY p.id DESC LIMIT 20');
    $stats=vp_all("SELECT gateway,SUM(status='basarili') ok,COUNT(*) n,COALESCE(SUM(CASE WHEN status='basarili' THEN amount END),0) s FROM payment_attempts GROUP BY gateway");
    $st=array_column($stats,null,'gateway');
    vpa_start($a,'Ödeme yöntemleri','/yonetim/odeme-yontemleri');
    vp_head('Finans','Ödeme yöntemleri','Müşteriler faturalarını buradan açtığınız yöntemlerle öder. Kartla ödeme onaylanınca fatura kendiliğinden ödenir ve lisans açılır.');
    $pk=vp_secret_setting('paytr_merchant_key');$ps=vp_secret_setting('paytr_merchant_salt');$ik=vp_secret_setting('iyzico_api_key');$is=vp_secret_setting('iyzico_secret_key');
    $state=function(string $g):string{
        if(vp_gateway_ready($g))return vp_gateway_test_mode($g)?'<span class="vp-badge vp-badge--wait">Aktif · test</span>':'<span class="vp-badge vp-badge--ok">Aktif · canlı</span>';
        return vp_setting($g.'_enabled')==='1'?'<span class="vp-badge vp-badge--warn">Eksik bilgi</span>':'<span class="vp-badge vp-badge--off">Kapalı</span>';
    };
    $sum=fn(string $g)=>isset($st[$g])?(int)$st[$g]['ok'].' başarılı / '.(int)$st[$g]['n'].' deneme · '.vp_money((int)$st[$g]['s']):'Henüz deneme yok';
    $inst=array_map('intval',explode(',',vp_setting('iyzico_installments','1,2,3,6,9')));
    ?>
<div class="vp-grid vp-grid-2">
  <form class="vp-card vp-form vp-gw" method="post"><?=vp_csrf_field()?>
    <div class="vp-card-head"><div class="vp-gw-logo vp-gw-logo--iyzico">iyzico</div><div><span class="vp-label">Checkout Form</span><h2>iyzico</h2></div><?=$state('iyzico')?></div>
    <p class="vp-muted">Müşteri iyzico’nun güvenli ödeme sayfasına yönlenir; kart bilgisi Veniux sunucusuna hiç gelmez. 3D Secure ve taksit iyzico tarafından yönetilir.</p>
    <label class="vp-check"><input type="checkbox" name="enabled" value="1"<?=vp_setting('iyzico_enabled')==='1'?' checked':''?>> <b>Müşterilere iyzico ile ödeme seçeneğini göster</b></label>
    <label class="vp-field"><span>API Key</span><input type="password" name="api_key" autocomplete="new-password" data-lpignore="true" data-1p-ignore maxlength="200" placeholder="<?=e($ik!==''?'Kayıtlı: '.vp_mask($ik).' · değiştirmek için yazın':'sandbox-… veya canlı API anahtarı')?>"></label>
    <label class="vp-field"><span>Secret Key</span><input type="password" name="secret_key" autocomplete="new-password" data-lpignore="true" data-1p-ignore maxlength="200" placeholder="<?=e($is!==''?'Kayıtlı: '.vp_mask($is).' · değiştirmek için yazın':'Gizli anahtar')?>"><small>iyzico Merchant Panel → Ayarlar → Firma Ayarları. Anahtarlar şifreli saklanır, ekranda gösterilmez.</small></label>
    <label class="vp-check"><input type="checkbox" name="sandbox" value="1"<?=vp_setting('iyzico_sandbox','1')==='1'?' checked':''?>> Sandbox (test ortamı: sandbox-api.iyzipay.com)</label>
    <fieldset class="vp-field vp-fieldset"><legend>İzin verilen taksitler</legend><div class="vp-inline-checks"><?php foreach([1,2,3,6,9,12] as $n):?><label class="vp-check"><input type="checkbox" name="installments[]" value="<?=$n?>"<?=in_array($n,$inst,true)?' checked':''?>> <?=$n===1?'Tek çekim':$n.' taksit'?></label><?php endforeach;?></div></fieldset>
    <label class="vp-field"><span>Müşteriye görünen ad</span><input type="text" name="label" maxlength="80" value="<?=e(vp_setting('iyzico_label'))?>" placeholder="Kredi / banka kartı (iyzico)"></label>
    <div class="vp-note"><b>Dönüş adresi:</b> <span class="vp-mono"><?=e($base)?>/odeme/iyzico/donus</span><br>Her ödemede otomatik gönderilir; iyzico panelinde ayar gerekmez.</div>
    <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="iyzico">Kaydet</button><button class="vp-btn vp-btn--ghost" type="submit" name="op" value="iyzico_test">Kaydet ve bağlantıyı test et</button><?php if($ik!==''||$is!==''):?><button class="vp-btn vp-btn--danger vp-btn--sm" type="submit" name="op" value="iyzico_sil" formnovalidate>Anahtarları sil</button><?php endif;?></div>
    <small class="vp-muted"><?=e($sum('iyzico'))?></small>
  </form>

  <form class="vp-card vp-form vp-gw" method="post"><?=vp_csrf_field()?>
    <div class="vp-card-head"><div class="vp-gw-logo vp-gw-logo--paytr">PayTR</div><div><span class="vp-label">iFrame API</span><h2>PayTR</h2></div><?=$state('paytr')?></div>
    <p class="vp-muted">Ödeme formu PayTR’ın güvenli çerçevesinde, panelin içinde açılır. Sonuç PayTR’ın imzalı bildirimiyle doğrulanır.</p>
    <label class="vp-check"><input type="checkbox" name="enabled" value="1"<?=vp_setting('paytr_enabled')==='1'?' checked':''?>> <b>Müşterilere PayTR ile ödeme seçeneğini göster</b></label>
    <label class="vp-field"><span>Mağaza no (Merchant ID)</span><input type="text" name="merchant_id" inputmode="numeric" maxlength="20" autocomplete="off" data-lpignore="true" data-1p-ignore value="<?=e(vp_setting('paytr_merchant_id'))?>"></label>
    <div class="vp-row"><label class="vp-field"><span>Merchant Key</span><input type="password" name="merchant_key" autocomplete="new-password" data-lpignore="true" data-1p-ignore maxlength="200" placeholder="<?=e($pk!==''?'Kayıtlı: '.vp_mask($pk):'Mağaza anahtarı')?>"></label>
    <label class="vp-field"><span>Merchant Salt</span><input type="password" name="merchant_salt" autocomplete="new-password" data-lpignore="true" data-1p-ignore maxlength="200" placeholder="<?=e($ps!==''?'Kayıtlı: '.vp_mask($ps):'Mağaza gizli anahtarı')?>"></label></div>
    <small class="vp-muted">PayTR Mağaza Paneli → Destek &amp; Kurulum → Entegrasyon Bilgileri. Boş bırakılan anahtar değişmez.</small>
    <div class="vp-row"><label class="vp-check"><input type="checkbox" name="test_mode" value="1"<?=vp_setting('paytr_test_mode','1')==='1'?' checked':''?>> Test modu (tahsilat yapılmaz)</label>
    <label class="vp-field"><span>En fazla taksit</span><?=vp_select('max_installment',['0'=>'Kart limitine göre (sınırsız)','1'=>'Taksit yok (tek çekim)','2'=>'2','3'=>'3','6'=>'6','9'=>'9','12'=>'12'],vp_setting('paytr_max_installment','0'))?></label></div>
    <label class="vp-field"><span>Müşteriye görünen ad</span><input type="text" name="label" maxlength="80" value="<?=e(vp_setting('paytr_label'))?>" placeholder="Kredi / banka kartı (PayTR)"></label>
    <div class="vp-note vp-note--warn"><b>PayTR panelinde bir kez ayarlayın — Bildirim URL:</b><br><span class="vp-mono"><?=e($base)?>/odeme/paytr/bildirim</span> <button type="button" class="vp-link" data-copy="<?=e($base)?>/odeme/paytr/bildirim">Kopyala</button><br>Mağaza Paneli → Destek &amp; Kurulum → Ayarlar → Bildirim URL. Bu adres girilmezse ödemeler onaylanmaz.</div>
    <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="paytr">Kaydet</button><button class="vp-btn vp-btn--ghost" type="submit" name="op" value="paytr_test">Kaydet ve bağlantıyı test et</button><?php if($pk!==''||$ps!==''):?><button class="vp-btn vp-btn--danger vp-btn--sm" type="submit" name="op" value="paytr_sil" formnovalidate>Anahtarları sil</button><?php endif;?></div>
    <small class="vp-muted"><?=e($sum('paytr'))?></small>
  </form>
</div><br>

<div class="vp-grid vp-grid-main">
  <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Son kart ödeme denemeleri</h2></div>
  <?php if(!$attempts): echo vp_empty('Henüz kartla ödeme denemesi yok.'); else:?>
  <div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Zaman</th><th>Müşteri</th><th>Fatura</th><th>Yöntem</th><th>Durum</th><th class="num">Tutar</th></tr></thead><tbody>
  <?php foreach($attempts as $p):?><tr><td data-l="Zaman" class="nowrap vp-muted"><?=e(vp_date($p['created_at'],true))?></td><td data-l="Müşteri"><?=vpa_client_link((int)$p['client_id'],$p['company'])?></td><td data-l="Fatura"><a href="/yonetim/faturalar/<?=$p['invoice_id']?>"><?=e($p['number'])?></a></td><td data-l="Yöntem"><?=$p['gateway']==='paytr'?'PayTR':'iyzico'?><?=$p['test_mode']?' <span class="vp-sub">test</span>':''?></td><td data-l="Durum"><?=vp_badge('attempt',$p['status'])?><?=$p['message']?'<span class="vp-sub">'.e(mb_strimwidth($p['message'],0,70,'…','UTF-8')).'</span>':''?></td><td data-l="Tutar" class="num"><?=e(vp_money((int)$p['amount']))?></td></tr><?php endforeach;?>
  </tbody></table></div><?php endif;?>
  </section>
  <form class="vp-card vp-card--kraft vp-tape vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="genel">
    <div class="vp-card-head"><h2>Genel</h2></div>
    <label class="vp-field"><span>Sitenin herkese açık adresi</span><input type="text" name="public_url" maxlength="200" value="<?=e(vp_setting('public_url'))?>" placeholder="<?=e(rtrim((string)(($GLOBALS['config']['url'])??'https://veniux.com'),'/'))?>"><small>Ödeme sağlayıcılarının döneceği adres. Boş: site ayarındaki adres kullanılır.</small></label>
    <label class="vp-field"><span>Önce gösterilecek kart yöntemi</span><?=vp_select('default_gateway',['iyzico'=>'iyzico','paytr'=>'PayTR'],vp_setting('default_gateway','iyzico'))?></label>
    <label class="vp-check"><input type="checkbox" name="transfer_enabled" value="1"<?=vp_setting('transfer_enabled','1')==='1'?' checked':''?>> Havale / EFT ile ödeme açık</label>
    <small class="vp-muted">Banka hesapları: <a href="/yonetim/ayarlar?bolum=fatura">Ayarlar → Fatura ve ödeme</a></small>
    <button class="vp-btn vp-btn--ink vp-btn--sm" type="submit">Kaydet</button>
  </form>
</div>
<?php
    vp_shell_end();
}
