<?php
declare(strict_types=1);
// Yönetim: bildirim kanalları (SMTP, WhatsApp), olay şablonları, önizleme ve gönderim kayıtları.

function vpa_notify_sample_vars(): array {
    return ['musteri'=>'Demo Market Ltd.','yetkili'=>'Deniz Yılmaz','fatura_no'=>'VNX-2026-0042','tutar'=>'14.990 ₺','son_odeme'=>vp_date(gmdate('Y-m-d H:i:s',time()+86400*3)),'gecikme'=>'3','kalan_gun'=>'3','lisans'=>'VNX-AB12-CD34-EF56','paket'=>'Veniux Pro','bitis'=>vp_date(gmdate('Y-m-d H:i:s',time()+86400*7)),'talep_no'=>'482913','konu'=>'Barkod okuyucu ürünü bulmuyor','gonderen'=>'TOP MARKET LTD. ŞTİ.','yontem'=>'Kredi kartı (iyzico)','firma'=>vp_setting('company_name','Veniux'),'link'=>vp_public_url().'/panel/faturalar/42'];
}

function vpa_notify(array $a,string $sub=''): void {
    vpa_need($a,'settings');
    $tab=vp_get('sekme',20)?:'kanallar';
    if($sub==='onizleme'){
        $ev=vp_get('olay',40);$def=vp_notify_events()[$ev]??null;
        if(!$def){http_response_code(404);echo 'Olay yok';return;}
        $vars=vpa_notify_sample_vars();
        header("Content-Security-Policy: default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; frame-ancestors 'self'",true);
        header('Content-Type: text/html; charset=utf-8');
        echo vp_mail_html(vp_fill(vp_notify_tpl($ev,'subject'),$vars),vp_fill(vp_notify_tpl($ev,'text'),$vars),['title'=>vp_fill(vp_notify_tpl($ev,'subject'),$vars),'cta'=>$def['cta'],'link'=>$vars['link'],'label'=>$def['label'],'rows'=>[['Fatura',$vars['fatura_no']],['Tutar',$vars['tutar']],['Son ödeme',$vars['son_odeme']]]]);
        return;
    }
    if(vp_is_post()){
        $op=vp_post('op',20);
        $secret=function(string $field,string $key){$v=(string)($_POST[$field]??'');if(trim($v)!=='')vp_set_secret_setting($key,mb_substr($v,0,300));};
        if($op==='smtp'||$op==='smtp_test'){
            vp_set_setting('mail_enabled',isset($_POST['mail_enabled'])?'1':'0');
            vp_set_setting('smtp_host',preg_replace('/[^A-Za-z0-9.\-]/','',vp_post('smtp_host',120)));
            vp_set_setting('smtp_port',(string)max(1,min(65535,(int)($_POST['smtp_port']??587))));
            vp_set_setting('smtp_secure',in_array($_POST['smtp_secure']??'',['tls','ssl','none'],true)?$_POST['smtp_secure']:'tls');
            vp_set_setting('smtp_user',vp_post('smtp_user',190));
            $secret('smtp_pass','smtp_pass');
            foreach(['mail_from','mail_reply_to'] as $k){$v=strtolower(vp_post($k,190));vp_set_setting($k,filter_var($v,FILTER_VALIDATE_EMAIL)?$v:'');}
            vp_set_setting('mail_from_name',vp_post('mail_from_name',80));
            vpa_log($a,'SMTP ayarlarını güncelledi');
            if($op==='smtp_test'){
                $to=strtolower(vp_post('test_to',190));
                if(!filter_var($to,FILTER_VALIDATE_EMAIL))vp_flash('Test için geçerli bir alıcı e-posta adresi girin.','err');
                else{try{$v=vpa_notify_sample_vars();vp_mail_send($to,'Veniux · SMTP test e-postası',"Merhaba,\n\nBu bir test e-postasıdır. SMTP ayarlarınız *çalışıyor*.\n\nMüşterilerinize gidecek fatura, ödeme ve hatırlatma e-postaları bu görünümde olacak.",['title'=>'SMTP bağlantısı çalışıyor','label'=>'Test','cta'=>'Yönetim paneline git','link'=>vp_public_url().'/yonetim','rows'=>[['Sunucu',vp_setting('smtp_host').':'.vp_setting('smtp_port')],['Gönderen',vp_setting('mail_from')],['Zaman',vp_date(vp_now(),true)]]]);vp_flash('Test e-postası gönderildi: '.$to.'. Gelen kutusunu (ve spam klasörünü) kontrol edin.');}
                    catch(Throwable $t){vp_flash('Gönderilemedi: '.$t->getMessage(),'err');}}
            }else vp_flash('SMTP ayarları kaydedildi.'.(vp_setting('mail_enabled')==='1'&&!vp_mail_ready()?' Sunucu ve gönderen adresi eksik olduğu için e-posta gönderimi henüz kapalı.':''),vp_setting('mail_enabled')==='1'&&!vp_mail_ready()?'info':'ok');
        }elseif($op==='wa'||$op==='wa_test'){
            vp_set_setting('wa_enabled',isset($_POST['wa_enabled'])?'1':'0');
            $url=rtrim(vp_post('wa_api_url',200),'/');
            if($url!==''&&!preg_match('#^https?://[A-Za-z0-9.\-]+(:\d+)?(/[A-Za-z0-9._/\-]*)?$#',$url)){vp_flash('Servis adresi http(s):// ile başlamalı (ör. https://wp.alanadiniz.com).','err');vp_redirect('/yonetim/bildirimler');}
            vp_set_setting('wa_api_url',$url);
            $secret('wa_api_key','wa_api_key');
            vpa_log($a,'WhatsApp ayarlarını güncelledi');
            if($op==='wa_test'){
                $ph=vp_post('test_phone',30);
                if(!vp_phone_ok($ph))vp_flash('Test için geçerli bir telefon girin (ör. 0532 000 00 00).','err');
                else{try{vp_wa_send($ph,"*Veniux* · WhatsApp test mesajı\n\nBildirim ayarlarınız çalışıyor. Müşterilerinize fatura, ödeme ve hatırlatma mesajları bu hattan gidecek.");vp_flash('Test mesajı gönderildi: '.$ph);}
                    catch(Throwable $t){vp_flash('Gönderilemedi: '.$t->getMessage(),'err');}}
            }else vp_flash('WhatsApp ayarları kaydedildi.'.(vp_setting('wa_enabled')==='1'&&!vp_wa_ready()?' Servis adresi veya API anahtarı eksik olduğu için gönderim henüz kapalı.':''),vp_setting('wa_enabled')==='1'&&!vp_wa_ready()?'info':'ok');
        }elseif($op==='genel'){
            vp_set_setting('admin_notify_email',implode(',',array_filter(array_map(fn($x)=>strtolower(trim($x)),explode(',',vp_post('admin_notify_email',400))),fn($x)=>filter_var($x,FILTER_VALIDATE_EMAIL))));
            vp_set_setting('admin_notify_phone',implode(',',array_filter(array_map('trim',explode(',',vp_post('admin_notify_phone',200))),'vp_phone_ok')));
            foreach(['reminder_days'=>'3,1','overdue_days'=>'1,3,7','license_notice_days'=>'30,7,1'] as $k=>$d){$v=implode(',',array_unique(array_filter(array_map('intval',explode(',',vp_post($k,60))),fn($n)=>$n>=0&&$n<=90)));vp_set_setting($k,$v);}
            vpa_log($a,'Bildirim zamanlamalarını güncelledi');vp_flash('Kaydedildi.');
        }elseif($op==='sablon'){
            $ev=vp_post('event',40);
            if(isset(vp_notify_events()[$ev])){
                foreach(['mail','wa'] as $ch)vp_set_setting('nevt_'.$ev.'_'.$ch,isset($_POST['on_'.$ch])?'1':'0');
                if(isset($_POST['reset'])){vp_set_setting('ntpl_'.$ev.'_subject','');vp_set_setting('ntpl_'.$ev.'_text','');vp_flash('Şablon varsayılana döndü.');}
                else{
                    $subj=vp_post('subject',200);$text=vp_post('text',4000);
                    vp_set_setting('ntpl_'.$ev.'_subject',$subj===vp_notify_events()[$ev]['subject']?'':$subj);
                    vp_set_setting('ntpl_'.$ev.'_text',str_replace("\r\n","\n",$text)===vp_notify_events()[$ev]['text']?'':str_replace("\r\n","\n",$text));
                    vp_flash('Şablon kaydedildi.');
                }
                vpa_log($a,'Bildirim şablonunu güncelledi',vp_notify_events()[$ev]['label']);
            }
            vp_redirect('/yonetim/bildirimler?sekme=sablonlar#'.$ev);
        }elseif($op==='tekrar'){
            $id=vp_int($_POST['id']??null);
            if($id)vp_q("UPDATE notifications SET status='bekliyor',attempts=0,next_try=?,last_error='' WHERE id=? AND status IN('hata','bekliyor')",[vp_now(),$id]);
            $GLOBALS['vp_notify_pending']=true;vp_flash('Yeniden kuyruğa alındı.');vp_redirect('/yonetim/bildirimler?sekme=kayitlar');
        }elseif($op==='isle'){
            $r=vp_notify_process(25);vp_flash('Kuyruk işlendi: '.$r['sent'].' gönderildi, '.$r['failed'].' başarısız.',$r['failed']?'info':'ok');vp_redirect('/yonetim/bildirimler?sekme=kayitlar');
        }
        vp_redirect('/yonetim/bildirimler'.($tab!=='kanallar'?'?sekme='.$tab:''));
    }
    $q=array_column(vp_all("SELECT status,COUNT(*) n FROM notifications GROUP BY status"),'n','status');
    vpa_start($a,'Bildirimler','/yonetim/bildirimler');
    vp_head('Sistem','Bildirimler','Müşterilere ve size giden e-posta ve WhatsApp mesajları: fatura, ödeme, hatırlatma, lisans ve destek.',
        '<span class="vp-badge vp-badge--'.(vp_mail_ready()?'ok':'off').'">E-posta '.(vp_mail_ready()?'açık':'kapalı').'</span> <span class="vp-badge vp-badge--'.(vp_wa_ready()?'ok':'off').'">WhatsApp '.(vp_wa_ready()?'açık':'kapalı').'</span>');
    echo '<nav class="vp-tabs">';foreach(['kanallar'=>['Kanallar',0],'sablonlar'=>['Olaylar ve şablonlar',0],'kayitlar'=>['Gönderim kayıtları',(int)($q['hata']??0)+(int)($q['bekliyor']??0)]] as $k=>[$l,$n])echo '<a href="?sekme='.$k.'"'.($tab===$k?' aria-current="page"':'').'>'.$l.($n?'<b>'.$n.'</b>':'').'</a>';echo '</nav>';
    if($tab==='sablonlar')vpa_notify_templates();
    elseif($tab==='kayitlar')vpa_notify_log($q);
    else vpa_notify_channels();
    vp_shell_end();
}

function vpa_notify_channels(): void {
    $pass=vp_secret_setting('smtp_pass');$key=vp_secret_setting('wa_api_key');$sec=vp_setting('smtp_secure','tls');
    ?>
<div class="vp-grid vp-grid-2">
  <form class="vp-card vp-form vp-gw" method="post" autocomplete="off"><?=vp_csrf_field()?>
    <div class="vp-card-head"><div class="vp-gw-logo vp-gw-logo--mail">SMTP</div><div><span class="vp-label">E-posta</span><h2>SMTP ayarları</h2></div><span class="vp-badge vp-badge--<?=vp_mail_ready()?'ok':'off'?>"><?=vp_mail_ready()?'Aktif':'Kapalı'?></span></div>
    <label class="vp-check"><input type="checkbox" name="mail_enabled" value="1"<?=vp_setting('mail_enabled')==='1'?' checked':''?>> <b>E-posta bildirimlerini gönder</b></label>
    <div class="vp-row-3 vp-row"><label class="vp-field"><span>SMTP sunucusu</span><input type="text" name="smtp_host" maxlength="120" value="<?=e(vp_setting('smtp_host'))?>" placeholder="smtp.yandex.com" autocomplete="off" data-1p-ignore></label>
    <label class="vp-field"><span>Port</span><input type="number" name="smtp_port" min="1" max="65535" value="<?=e(vp_setting('smtp_port','587'))?>"></label>
    <label class="vp-field"><span>Şifreleme</span><?=vp_select('smtp_secure',['tls'=>'STARTTLS (587)','ssl'=>'SSL/TLS (465)','none'=>'Yok (25)'],$sec)?></label></div>
    <div class="vp-row"><label class="vp-field"><span>Kullanıcı adı</span><input type="text" name="smtp_user" maxlength="190" value="<?=e(vp_setting('smtp_user'))?>" autocomplete="off" data-1p-ignore data-lpignore="true" placeholder="no-reply@veniux.com"></label>
    <label class="vp-field"><span>Şifre</span><input type="password" name="smtp_pass" maxlength="300" autocomplete="new-password" data-1p-ignore data-lpignore="true" placeholder="<?=e($pass!==''?'Kayıtlı: '.vp_mask($pass).' · değiştirmek için yazın':'SMTP / uygulama şifresi')?>"></label></div>
    <div class="vp-row"><label class="vp-field"><span>Gönderen adresi</span><input type="email" name="mail_from" maxlength="190" value="<?=e(vp_setting('mail_from'))?>" placeholder="no-reply@veniux.com"></label>
    <label class="vp-field"><span>Gönderen adı</span><input type="text" name="mail_from_name" maxlength="80" value="<?=e(vp_setting('mail_from_name'))?>" placeholder="Veniux"></label></div>
    <label class="vp-field"><span>Yanıt adresi (isteğe bağlı)</span><input type="email" name="mail_reply_to" maxlength="190" value="<?=e(vp_setting('mail_reply_to'))?>" placeholder="destek@veniux.com"></label>
    <small class="vp-muted">Gmail için: smtp.gmail.com · 587 · STARTTLS, şifre olarak Google uygulama şifresi. Gönderen adresi, SMTP hesabıyla aynı alan adında olmalı (SPF/DKIM).</small>
    <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="smtp">Kaydet</button></div>
    <div class="vp-note"><div class="vp-test-row"><label class="vp-field"><span>Test alıcısı</span><input type="email" name="test_to" maxlength="190" placeholder="siz@ornek.com"></label><button class="vp-btn vp-btn--ghost" type="submit" name="op" value="smtp_test">Kaydet ve test e-postası gönder</button></div></div>
  </form>

  <form class="vp-card vp-form vp-gw" method="post" autocomplete="off"><?=vp_csrf_field()?>
    <div class="vp-card-head"><div class="vp-gw-logo vp-gw-logo--wa">WA</div><div><span class="vp-label">whatsapp-mail-service</span><h2>WhatsApp</h2></div><span class="vp-badge vp-badge--<?=vp_wa_ready()?'ok':'off'?>"><?=vp_wa_ready()?'Aktif':'Kapalı'?></span></div>
    <p class="vp-muted">Mesajlar WhatsApp servisinizdeki bağlı hat üzerinden gönderilir. Servis panelinde QR kodun okutulmuş ve hattın bağlı olması gerekir.</p>
    <label class="vp-check"><input type="checkbox" name="wa_enabled" value="1"<?=vp_setting('wa_enabled')==='1'?' checked':''?>> <b>WhatsApp bildirimlerini gönder</b></label>
    <label class="vp-field"><span>Servis adresi</span><input type="text" name="wa_api_url" maxlength="200" value="<?=e(vp_setting('wa_api_url'))?>" placeholder="https://wp.alanadiniz.com" autocomplete="off" data-1p-ignore><small>Servisin kök adresi. Mesajlar <span class="vp-mono">/api/send</span> ucuna gönderilir.</small></label>
    <label class="vp-field"><span>API anahtarı</span><input type="password" name="wa_api_key" maxlength="300" autocomplete="new-password" data-1p-ignore data-lpignore="true" placeholder="<?=e($key!==''?'Kayıtlı: '.vp_mask($key).' · değiştirmek için yazın':'key_… (servis panelindeki kullanıcı API anahtarı)')?>"></label>
    <small class="vp-muted">Müşteriye mesaj, müşteri profilindeki telefon numarasına gider (0532…, 532… veya 90532… biçimleri kabul edilir). Müşteri WhatsApp bildirimini profilinden kapatabilir.</small>
    <div class="vp-form-foot"><button class="vp-btn" type="submit" name="op" value="wa">Kaydet</button></div>
    <div class="vp-note"><div class="vp-test-row"><label class="vp-field"><span>Test telefonu</span><input type="tel" name="test_phone" maxlength="30" placeholder="0532 000 00 00"></label><button class="vp-btn vp-btn--ghost" type="submit" name="op" value="wa_test">Kaydet ve test mesajı gönder</button></div></div>
  </form>
</div><br>
<form class="vp-card vp-card--kraft vp-tape vp-form" method="post"><?=vp_csrf_field()?><input type="hidden" name="op" value="genel">
  <div class="vp-card-head"><h2>Yönetici bildirimleri ve zamanlama</h2></div>
  <div class="vp-row"><label class="vp-field"><span>Yönetici e-postaları</span><input type="text" name="admin_notify_email" maxlength="400" value="<?=e(vp_setting('admin_notify_email'))?>" placeholder="siz@veniux.com, muhasebe@veniux.com"><small>Yeni sipariş, ödeme, havale ve talep bildirimleri. Virgülle ayırın.</small></label>
  <label class="vp-field"><span>Yönetici WhatsApp numaraları</span><input type="text" name="admin_notify_phone" maxlength="200" value="<?=e(vp_setting('admin_notify_phone'))?>" placeholder="0532 000 00 00"></label></div>
  <div class="vp-row-3 vp-row"><label class="vp-field"><span>Vade hatırlatması (kaç gün önce)</span><input type="text" name="reminder_days" maxlength="60" value="<?=e(vp_setting('reminder_days','3,1'))?>"><small>Örn. 3,1 → 3 gün ve 1 gün kala</small></label>
  <label class="vp-field"><span>Gecikme uyarısı (kaç gün sonra)</span><input type="text" name="overdue_days" maxlength="60" value="<?=e(vp_setting('overdue_days','1,3,7'))?>"></label>
  <label class="vp-field"><span>Lisans bitiş uyarısı (kaç gün önce)</span><input type="text" name="license_notice_days" maxlength="60" value="<?=e(vp_setting('license_notice_days','30,7,1'))?>"></label></div>
  <small class="vp-muted">Hatırlatmalar otomasyonla saatte bir kontrol edilir ve her aşama için bir kez gönderilir. Zamanında gitmesi için sunucuda <span class="vp-mono">php bin/panel-cron.php</span> görevini saatlik çalıştırın.</small>
  <button class="vp-btn vp-btn--ink vp-btn--sm" type="submit">Kaydet</button>
</form>
<?php
}

function vpa_notify_templates(): void {
    echo '<div class="vp-note">Değişkenler: <span class="vp-mono">{yetkili} {musteri} {fatura_no} {tutar} {son_odeme} {kalan_gun} {gecikme} {yontem} {paket} {lisans} {bitis} {talep_no} {konu} {gonderen} {link} {firma}</span> · <b>*kalın*</b> WhatsApp’ta kalın, e-postada vurgulu görünür. Aynı metin iki kanalda kullanılır; e-postada bağlantı düğmeye dönüşür.</div><br>';
    $groups=['Müşteri bildirimleri'=>'client','Yönetici bildirimleri'=>'admin'];
    foreach($groups as $title=>$who){
        echo '<h2 class="vp-section-title">'.e($title).'</h2><div class="vp-grid vp-grid-2">';
        foreach(vp_notify_events() as $ev=>$def){
            if($def['who']!==$who)continue;
            $custom=vp_setting('ntpl_'.$ev.'_subject')!==''||vp_setting('ntpl_'.$ev.'_text')!=='';
            echo '<form class="vp-card vp-form" method="post" id="'.e($ev).'">'.vp_csrf_field().'<input type="hidden" name="op" value="sablon"><input type="hidden" name="event" value="'.e($ev).'">';
            echo '<div class="vp-card-head"><div><span class="vp-label">'.e($ev).($custom?' · düzenlendi':'').'</span><h2>'.e($def['label']).'</h2></div><a href="/yonetim/bildirimler/onizleme?olay='.e($ev).'" target="_blank" rel="noopener">E-posta önizleme ↗</a></div>';
            echo '<div class="vp-inline-checks"><label class="vp-check"><input type="checkbox" name="on_mail" value="1"'.(vp_notify_on($ev,'mail')?' checked':'').'> E-posta</label><label class="vp-check"><input type="checkbox" name="on_wa" value="1"'.(vp_notify_on($ev,'wa')?' checked':'').'> WhatsApp</label></div>';
            echo '<label class="vp-field"><span>E-posta konusu</span><input type="text" name="subject" maxlength="200" value="'.e(vp_notify_tpl($ev,'subject')).'"></label>';
            echo '<label class="vp-field"><span>Mesaj</span><textarea name="text" rows="7" maxlength="4000">'.e(vp_notify_tpl($ev,'text')).'</textarea></label>';
            echo '<div class="vp-form-foot"><button class="vp-btn vp-btn--sm" type="submit">Kaydet</button>'.($custom?'<button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit" name="reset" value="1">Varsayılana dön</button>':'').'</div></form>';
        }
        echo '</div><br>';
    }
}

function vpa_notify_log(array $q): void {
    $st=vp_get('durum',12);$where='1=1';$args=[];
    if(in_array($st,['bekliyor','gonderildi','hata'],true)){$where='n.status=?';$args[]=$st;}
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM notifications n WHERE $where",$args,30);
    $rows=vp_all("SELECT n.*,c.company FROM notifications n LEFT JOIN clients c ON c.id=n.client_id WHERE $where ORDER BY n.id DESC LIMIT $per OFFSET $off",$args);
    $ev=vp_notify_events();
    echo '<div class="vp-chips"><a class="vp-chip" href="?sekme=kayitlar"'.($st===''?' aria-current="page"':'').'>Tümü<b>'.array_sum($q).'</b></a>';
    foreach(['bekliyor'=>'Kuyrukta','gonderildi'=>'Gönderildi','hata'=>'Başarısız'] as $k=>$l)echo '<a class="vp-chip" href="?sekme=kayitlar&durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'<b>'.(int)($q[$k]??0).'</b></a>';
    echo '<form method="post" class="vp-inline">'.vp_csrf_field().'<input type="hidden" name="op" value="isle"><button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Kuyruğu şimdi işle</button></form></div>';
    echo '<section class="vp-card vp-card--flush">';
    if(!$rows){echo vp_empty('Kayıt yok.','Bildirim kanalı açıldığında gönderimler burada listelenir.').'</section>';return;}
    echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Zaman</th><th>Kanal</th><th>Olay</th><th>Alıcı</th><th>Durum</th><th></th></tr></thead><tbody>';
    foreach($rows as $n){
        $badge=['bekliyor'=>['Kuyrukta','wait'],'gonderiliyor'=>['Gönderiliyor','wait'],'gonderildi'=>['Gönderildi','ok'],'hata'=>['Başarısız','bad']][$n['status']]??[$n['status'],'off'];
        echo '<tr><td data-l="Zaman" class="nowrap vp-muted">'.e(vp_date($n['created_at'],true)).'</td><td data-l="Kanal">'.($n['channel']==='mail'?'E-posta':'WhatsApp').'</td><td data-l="Olay">'.e($ev[$n['event']]['label']??$n['event']).'<span class="vp-sub">'.e(mb_strimwidth($n['subject'],0,70,'…','UTF-8')).'</span></td><td data-l="Alıcı">'.e($n['recipient']).($n['company']?'<span class="vp-sub">'.e($n['company']).'</span>':'').'</td><td data-l="Durum"><span class="vp-badge vp-badge--'.$badge[1].'">'.e($badge[0]).'</span>'.($n['last_error']?'<span class="vp-sub">'.e(mb_strimwidth($n['last_error'],0,90,'…','UTF-8')).'</span>':'').((int)$n['attempts']>1?'<span class="vp-sub">'.(int)$n['attempts'].' deneme</span>':'').'</td><td>'.($n['status']==='hata'?'<form method="post">'.vp_csrf_field().'<input type="hidden" name="op" value="tekrar"><input type="hidden" name="id" value="'.(int)$n['id'].'"><button class="vp-btn vp-btn--ghost vp-btn--sm">Tekrar dene</button></form>':'').'</td></tr>';
    }
    echo '</tbody></table></div>'.vp_pager($total,$page,$pages).'</section>';
}
