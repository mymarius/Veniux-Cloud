<?php
declare(strict_types=1);
// Veniux yönetim paneli (/yonetim). Bölüm 1: yönlendirme, oturum, gösterge, arama, müşteriler, siparişler, lisanslar.
require_once __DIR__.'/admin-more.php';
require_once __DIR__.'/admin-payments.php';
require_once __DIR__.'/admin-notify.php';

const VP_ROLES=['yonetici'=>'Yönetici','muhasebe'=>'Muhasebe','destek'=>'Destek'];
const VP_ROLE_SECTIONS=[
    'yonetici'=>['*'],
    'muhasebe'=>['clients','orders','licenses','products','invoices','coupons','finance','tools'],
    'destek'=>['clients','licenses','tickets','kb','announcements','contact','tools'],
];

function vpa_can(array $a,string $section): bool { $s=VP_ROLE_SECTIONS[$a['role']]??[];return in_array('*',$s,true)||in_array($section,$s,true); }
function vpa_need(array $a,string $section): void {
    if(vpa_can($a,$section))return;
    http_response_code(403);vpa_start($a,'Yetki yok','');
    echo vp_empty('Bu bölüme erişim yetkiniz yok.','Rolünüz: '.(VP_ROLES[$a['role']]??$a['role']).'. Gerekirse bir yöneticiden yetki isteyin.','<a class="vp-btn" href="/yonetim">Gösterge paneline dön</a>');
    vp_shell_end();exit;
}

function vpa_current(): ?array {
    if(isset($_SESSION['vp_admin'])){
        if(time()-(int)($_SESSION['vp_admin_seen']??0)>14400){unset($_SESSION['vp_admin']);return null;}
        $a=vp_row('SELECT id,name,email,role FROM admins WHERE id=? AND active=1',[(int)$_SESSION['vp_admin']]);
        if($a){$_SESSION['vp_admin_seen']=time();$a['id']=(int)$a['id'];$a['owner']=false;return $a;}
        unset($_SESSION['vp_admin']);
    }
    $acc=$_SESSION['download_account']??null;
    if(is_array($acc)&&($acc['is_owner']??false)===true&&empty($_SESSION['vp_impersonator']))return ['id'=>0,'name'=>'Veniux Sahibi','email'=>(string)$acc['email'],'role'=>'yonetici','owner'=>true];
    return null;
}

function vpa_log(array $a,string $action,string $detail='',?int $clientId=null): void { vp_log('yonetici',$a['id']?:null,$a['name'],$action,$detail,$clientId); }

function vpa_counts(): array {
    static $c=null;
    return $c??=[
        'tickets'=>(int)vp_val("SELECT COUNT(*) FROM tickets WHERE status IN('acik','musteri_yaniti')"),
        'orders'=>(int)vp_val("SELECT COUNT(*) FROM orders WHERE status='bekliyor'"),
        'transfers'=>(int)vp_val("SELECT COUNT(*) FROM transfer_notices WHERE status='bekliyor'"),
        'contact'=>vpa_contact_pending(),
    ];
}

function vpa_start(array $a,string $title,string $current): void {
    $c=vpa_counts();
    $nav=[['/yonetim','Gösterge paneli','home']];
    $groups=[
        'Müşteri ve satış'=>[['clients','/yonetim/musteriler','Müşteriler','users'],['orders','/yonetim/siparisler','Siparişler','cart',$c['orders']],['licenses','/yonetim/lisanslar','Lisanslar','key'],['products','/yonetim/paketler','Paketler ve eklentiler','box']],
        'Finans'=>[['invoices','/yonetim/faturalar','Faturalar','file'],['invoices','/yonetim/havale','Havale bildirimleri','bank',$c['transfers']],['finance','/yonetim/finans','Gelir ve tahsilat','pulse'],['settings','/yonetim/odeme-yontemleri','Ödeme yöntemleri','wallet'],['coupons','/yonetim/kuponlar','Kuponlar','tag']],
        'Destek'=>[['tickets','/yonetim/talepler','Destek talepleri','chat',$c['tickets']],['tickets','/yonetim/hazir-yanitlar','Hazır yanıtlar','list'],['kb','/yonetim/bilgi-bankasi','Bilgi bankası','book'],['announcements','/yonetim/duyurular','Duyurular','megaphone'],['contact','/yonetim/iletisim','Site talepleri','mail',$c['contact']]],
        'Sistem'=>[['admins','/yonetim/yoneticiler','Yöneticiler ve roller','shield'],['logs','/yonetim/kayitlar','Sistem kayıtları','list'],['settings','/yonetim/bildirimler','Bildirimler','mail'],['settings','/yonetim/ayarlar','Ayarlar','gear'],['tools','/yonetim/araclar','Araçlar','calc']],
    ];
    foreach($groups as $g=>$items){
        $vis=array_values(array_filter($items,fn($i)=>vpa_can($a,$i[0])));
        if(!$vis)continue;
        $nav[]=['group'=>$g];
        foreach($vis as $i)$nav[]=[$i[1],$i[2],$i[3],$i[4]??0];
    }
    $nav[]=['group'=>'Hesabım'];$nav[]=['/yonetim/profil','Profil ve şifre','user'];
    vp_shell_start('admin',$title,$nav,$current,['name'=>$a['name'],'sub'=>($a['owner']?'Sahip · ':'').(VP_ROLES[$a['role']]??$a['role'])],'/yonetim/ara');
}

function vpa_client_link(?int $id,?string $company): string { return $id?'<a class="vp-strong" href="/yonetim/musteriler/'.$id.'">'.e((string)$company).'</a>':'—'; }

// ---------------------------------------------------------------- yönlendirme
function vpAdminRoute(string $path,array $config): bool {
    if($path!=='/yonetim'&&!str_starts_with($path,'/yonetim/'))return false;
    $sub=substr($path,strlen('/yonetim'))?:'/';
    if($sub==='/giris')return vpa_login();
    $a=vpa_current();
    if(!$a){if(vp_is_post()){http_response_code(403);echo 'Oturum süresi doldu.';return true;}vp_redirect('/yonetim/giris?d='.rawurlencode($path));}
    if(vp_is_post()&&!vp_check_csrf()){vp_flash('Güvenlik anahtarı geçersiz. Sayfayı yenileyip tekrar deneyin.','err');vp_redirect($_SERVER['HTTP_REFERER']??'/yonetim');}
    if($sub==='/cikis'&&vp_is_post()){unset($_SESSION['vp_admin'],$_SESSION['vp_admin_seen']);if($a['owner'])unset($_SESSION['download_account']);session_regenerate_id(true);vp_redirect('/yonetim/giris');}
    vp_automation();
    $routes=[
        '#^/$#'=>'vpa_dashboard',
        '#^/ara$#'=>'vpa_search',
        '#^/musteriler$#'=>'vpa_clients','#^/musteriler/yeni$#'=>'vpa_client_new','#^/musteriler/(\d+)$#'=>'vpa_client_view','#^/musteriler/(\d+)/(kaydet|bakiye|not|olarak-gir|sil|sifre)$#'=>'vpa_client_action',
        '#^/siparisler$#'=>'vpa_orders','#^/siparisler/yeni$#'=>'vpa_order_new','#^/siparisler/(\d+)$#'=>'vpa_order_view','#^/siparisler/(\d+)/(onayla|iptal)$#'=>'vpa_order_action',
        '#^/lisanslar$#'=>'vpa_licenses','#^/lisanslar/(\d+)$#'=>'vpa_license_view','#^/lisanslar/(\d+)/islem$#'=>'vpa_license_action',
        '#^/paketler$#'=>'vpa_products','#^/paketler/yeni$#'=>'vpa_product_form','#^/paketler/(\d+)$#'=>'vpa_product_form','#^/paketler/eklentiler$#'=>'vpa_addons',
        '#^/faturalar$#'=>'vpa_invoices','#^/faturalar/yeni$#'=>'vpa_invoice_new','#^/faturalar/(\d+)$#'=>'vpa_invoice_view','#^/faturalar/(\d+)/islem$#'=>'vpa_invoice_action',
        '#^/havale$#'=>'vpa_transfers','#^/havale/(\d+)/(onayla|reddet)$#'=>'vpa_transfer_action',
        '#^/finans$#'=>'vpa_finance','#^/odeme-yontemleri$#'=>'vpa_gateways',
        '#^/kuponlar$#'=>'vpa_coupons','#^/kuponlar/yeni$#'=>'vpa_coupon_form','#^/kuponlar/(\d+)$#'=>'vpa_coupon_form',
        '#^/talepler$#'=>'vpa_tickets','#^/talepler/yeni$#'=>'vpa_ticket_new','#^/talepler/(\d+)$#'=>'vpa_ticket_view',
        '#^/hazir-yanitlar$#'=>'vpa_canned',
        '#^/bilgi-bankasi$#'=>'vpa_kb','#^/bilgi-bankasi/yeni$#'=>'vpa_kb_form','#^/bilgi-bankasi/(\d+)$#'=>'vpa_kb_form',
        '#^/duyurular$#'=>'vpa_announcements','#^/duyurular/yeni$#'=>'vpa_announcement_form','#^/duyurular/(\d+)$#'=>'vpa_announcement_form',
        '#^/iletisim$#'=>'vpa_contact',
        '#^/yoneticiler$#'=>'vpa_admins','#^/yoneticiler/yeni$#'=>'vpa_admin_form','#^/yoneticiler/(\d+)$#'=>'vpa_admin_form',
        '#^/kayitlar$#'=>'vpa_logs',
        '#^/ayarlar$#'=>'vpa_settings','#^/bildirimler$#'=>'vpa_notify','#^/bildirimler/(onizleme)$#'=>'vpa_notify',
        '#^/araclar$#'=>'vpa_tools',
        '#^/profil$#'=>'vpa_profile',
    ];
    foreach($routes as $re=>$fn){
        if(preg_match($re,$sub,$m)){array_shift($m);$fn($a,...$m);return true;}
    }
    http_response_code(404);vpa_start($a,'Bulunamadı','');echo vp_empty('Sayfa bulunamadı.','Adres değişmiş veya kayıt silinmiş olabilir.','<a class="vp-btn" href="/yonetim">Gösterge paneline dön</a>');vp_shell_end();
    return true;
}

// ---------------------------------------------------------------- giriş
function vpa_login(): bool {
    if(vpa_current())vp_redirect('/yonetim');
    $error='';
    if(vp_is_post()){
        if(!vp_check_csrf())$error='Sayfayı yenileyip tekrar deneyin.';
        elseif(!vp_rate_ok('admin-login',8)){http_response_code(429);$error='Çok fazla deneme. 15 dakika sonra tekrar deneyin.';}
        else{
            $email=strtolower(vp_post('email',190));$pass=is_string($_POST['password']??null)?$_POST['password']:'';
            $a=vp_row('SELECT * FROM admins WHERE email=? AND active=1',[$email]);
            if($a&&password_verify($pass,$a['password_hash'])){
                session_regenerate_id(true);$_SESSION['vp_admin']=(int)$a['id'];$_SESSION['vp_admin_seen']=time();$_SESSION['vp_csrf']=bin2hex(random_bytes(32));
                vp_update('admins',(int)$a['id'],['last_login'=>vp_now()]);
                vp_log('yonetici',(int)$a['id'],$a['name'],'Yönetim paneline giriş yaptı');
                $dest=vp_get('d',300);
                vp_redirect(preg_match('#^/yonetim(/[a-z0-9/-]*)?$#',$dest)?$dest:'/yonetim');
            }
            password_verify($pass,'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi');
            http_response_code(401);$error='E-posta veya şifre doğrulanamadı.';
        }
    }
    $noAdmins=(int)vp_val('SELECT COUNT(*) FROM admins')===0;
    vp_doc_start('Yönetim girişi');
    ?>
<main class="vp-auth" id="vp-content">
  <section class="vp-auth-side" aria-hidden="true">
    <a class="vp-brandline" href="/"><img src="/assets/logo-40-v1.webp" alt="" width="32" height="32">VENIUX</a>
    <h1>Bütün raflar <em>tek panelde.</em></h1>
    <div class="vp-auth-label"><span>Raf Y-01 · Yönetim</span><b>Müşteri, lisans, fatura</b><?=vp_barcode('yonetim-giris',30)?></div>
  </section>
  <section class="vp-auth-form">
    <div class="vp-eyebrow">Veniux yönetim</div>
    <h2>Yönetici girişi</h2>
    <p>Müşterileri, lisansları, faturaları ve destek taleplerini yönetin.</p>
    <?php if($error):?><div class="vp-flash vp-flash--err" role="alert"><?=e($error)?></div><?php endif;?>
    <?php if($noAdmins):?><div class="vp-note"><b>Henüz yönetici hesabı yok.</b> İlk hesabı sunucuda şu komutla oluşturun: <span class="vp-mono">php bin/panel-admin.php e-posta "Ad Soyad"</span>. Veniux sahip hesabıyla sitede giriş yaptıysanız panele doğrudan erişebilirsiniz.</div><br><?php endif;?>
    <form class="vp-form" method="post" action="/yonetim/giris<?=vp_get('d')?'?d='.e(rawurlencode(vp_get('d',300))):''?>">
      <?=vp_csrf_field()?>
      <label class="vp-field"><span>E-posta</span><input type="email" name="email" required autocomplete="username" maxlength="190"></label>
      <label class="vp-field"><span>Şifre</span><input type="password" name="password" required autocomplete="current-password" maxlength="200"></label>
      <button class="vp-btn vp-btn--block" type="submit">Giriş yap</button>
    </form>
    <p class="vp-muted"><br><a href="/">← veniux.com</a></p>
  </section>
</main></body></html>
<?php
    return true;
}

// ---------------------------------------------------------------- gösterge paneli
function vpa_monthly_revenue(int $months=12): array {
    $rows=vp_all("SELECT DATE_FORMAT(DATE_ADD(created_at,INTERVAL 3 HOUR),'%Y-%m') ym,SUM(amount) s FROM payments WHERE created_at>=? GROUP BY ym",[gmdate('Y-m-01 00:00:00',strtotime('-'.($months-1).' months'))]);
    $by=array_column($rows,'s','ym');$out=[];
    for($i=$months-1;$i>=0;$i--){$t=strtotime(date('Y-m-01').' -'.$i.' months');$ym=date('Y-m',$t);$out[]=[VP_MONTHS[(int)date('n',$t)-1],(int)($by[$ym]??0)];}
    return $out;
}

function vpa_dashboard(array $a): void {
    $monthStart=(new DateTimeImmutable('first day of this month 00:00',new DateTimeZone('Europe/Istanbul')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $prevStart=(new DateTimeImmutable('first day of last month 00:00',new DateTimeZone('Europe/Istanbul')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $rev=(int)vp_val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE created_at>=?',[$monthStart]);
    $prev=(int)vp_val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE created_at>=? AND created_at<?',[$prevStart,$monthStart]);
    $active=(int)vp_val("SELECT COUNT(*) FROM licenses WHERE status='aktif'");
    $unpaid=vp_row("SELECT COUNT(*) n,COALESCE(SUM(total),0) s FROM invoices WHERE status='odenmedi'");
    $clients=(int)vp_val('SELECT COUNT(*) FROM clients');$newClients=(int)vp_val('SELECT COUNT(*) FROM clients WHERE created_at>=?',[$monthStart]);
    $c=vpa_counts();
    $delta=$prev>0?(int)round(($rev-$prev)*100/$prev):null;
    vpa_start($a,'Gösterge paneli','/yonetim');
    $hour=(int)(new DateTimeImmutable('now',new DateTimeZone('Europe/Istanbul')))->format('G');
    vp_head(vp_date(vp_now()),($hour<12?'Günaydın':($hour<18?'İyi günler':'İyi akşamlar')).', '.explode(' ',$a['name'])[0].'.','Bugün rafta neler var: bekleyen işler, gelir ve yaklaşan yenilemeler.',
        (vpa_can($a,'orders')?'<a class="vp-btn vp-btn--ghost" href="/yonetim/siparisler/yeni">'.vp_icon('plus').'Sipariş</a>':'').(vpa_can($a,'clients')?'<a class="vp-btn" href="/yonetim/musteriler/yeni">'.vp_icon('plus').'Müşteri ekle</a>':''));
    ?>
<div class="vp-kpis">
  <a class="vp-kpi" href="/yonetim/finans"><div class="vp-kpi-top">Bu ay tahsilat<em>A-01</em></div><strong><?=e(vp_money($rev))?></strong><small><?=$delta===null?'Geçen ay '.e(vp_money($prev)):($delta>=0?'▲ %'.$delta:'▼ %'.abs($delta)).' geçen aya göre'?></small><?=vp_barcode('k1',18)?></a>
  <a class="vp-kpi" href="/yonetim/faturalar?durum=odenmedi"><div class="vp-kpi-top">Ödenmemiş<em>A-02</em></div><strong><?=e(vp_money((int)$unpaid['s']))?></strong><small><?=(int)$unpaid['n']?> fatura bekliyor</small><?=vp_barcode('k2',18)?></a>
  <a class="vp-kpi" href="/yonetim/lisanslar?durum=aktif"><div class="vp-kpi-top">Aktif lisans<em>A-03</em></div><strong><?=$active?></strong><small><?=$clients?> müşteri · bu ay +<?=$newClients?></small><?=vp_barcode('k3',18)?></a>
  <a class="vp-kpi" href="/yonetim/talepler"><div class="vp-kpi-top">Açık talep<em>A-04</em></div><strong><?=$c['tickets']?></strong><small><?=$c['orders']?> sipariş · <?=$c['transfers']?> havale bekliyor</small><?=vp_barcode('k4',18)?></a>
</div>
<div class="vp-grid vp-grid-main">
  <div class="vp-stack">
    <section class="vp-card">
      <div class="vp-card-head"><div><span class="vp-label">Son 12 ay</span><h2>Tahsilat</h2></div><a href="/yonetim/finans">Ayrıntı →</a></div>
      <?=vp_bar_chart(vpa_monthly_revenue(),'Son 12 ayın aylık tahsilatı')?>
    </section>
    <section class="vp-card vp-card--flush">
      <div class="vp-card-head"><h2>Bekleyen işler</h2></div>
      <?php
      $todo=vp_all("SELECT 'siparis' t,o.id,o.number ref,c.company,o.total amount,o.created_at FROM orders o JOIN clients c ON c.id=o.client_id WHERE o.status='bekliyor'
                    UNION ALL SELECT 'havale',n.id,CONCAT(i.number,' · ',n.sender),c.company,n.amount,n.created_at FROM transfer_notices n JOIN invoices i ON i.id=n.invoice_id JOIN clients c ON c.id=n.client_id WHERE n.status='bekliyor'
                    UNION ALL SELECT 'talep',t.id,t.subject,c.company,NULL,t.updated_at FROM tickets t JOIN clients c ON c.id=t.client_id WHERE t.status IN('acik','musteri_yaniti')
                    ORDER BY created_at DESC LIMIT 8");
      if(!$todo): echo vp_empty('Bekleyen iş yok.','Yeni sipariş, havale bildirimi veya talep geldiğinde burada görünür.');
      else:?>
      <div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Tür</th><th>Kayıt</th><th>Müşteri</th><th class="num">Tutar</th><th>Zaman</th></tr></thead><tbody>
      <?php foreach($todo as $t): $href=['siparis'=>'/yonetim/siparisler/','havale'=>'/yonetim/havale?id=','talep'=>'/yonetim/talepler/'][$t['t']].$t['id'];?>
        <tr><td data-l="Tür"><span class="vp-badge vp-badge--<?=['siparis'=>'wait','havale'=>'ok','talep'=>'warn'][$t['t']]?>"><?=['siparis'=>'Sipariş','havale'=>'Havale','talep'=>'Talep'][$t['t']]?></span></td><td data-l="Kayıt"><a class="vp-strong" href="<?=e($href)?>"><?=e(mb_strimwidth($t['ref'],0,48,'…','UTF-8'))?></a></td><td data-l="Müşteri"><?=e($t['company'])?></td><td data-l="Tutar" class="num"><?=$t['amount']===null?'—':e(vp_money((int)$t['amount']))?></td><td data-l="Zaman" class="nowrap vp-muted"><?=e(vp_ago($t['created_at']))?></td></tr>
      <?php endforeach;?></tbody></table></div>
      <?php endif;?>
    </section>
  </div>
  <div class="vp-stack">
    <section class="vp-card vp-card--kraft vp-tape">
      <div class="vp-card-head"><div><span class="vp-label">30 gün içinde</span><h2>Yaklaşan bitişler</h2></div></div>
      <?php $soon=vp_all("SELECT l.id,l.license_key,l.expires_at,p.name pname,c.company FROM licenses l JOIN products p ON p.id=l.product_id JOIN clients c ON c.id=l.client_id WHERE l.status='aktif' AND l.expires_at IS NOT NULL AND l.expires_at<=? ORDER BY l.expires_at LIMIT 6",[gmdate('Y-m-d H:i:s',time()+86400*30)]);
      if(!$soon): echo '<p class="vp-muted">Önümüzdeki 30 günde süresi dolan lisans yok.</p>'; else:?>
      <ul class="vp-list"><?php foreach($soon as $l): $d=vp_days_left($l['expires_at']);?><li><span class="vp-dot vp-dot--<?=$d<=7?'bad':'warn'?>"></span><div><a href="/yonetim/lisanslar/<?=$l['id']?>"><?=e($l['company'])?></a><span class="vp-sub"><?=e($l['pname'])?> · <?=e(vp_date($l['expires_at']))?></span></div><b><?=max(0,$d)?> g</b></li><?php endforeach;?></ul>
      <?php endif;?>
    </section>
    <section class="vp-card">
      <div class="vp-card-head"><h2>Paket dağılımı</h2></div>
      <?php $dist=vp_all("SELECT p.name,COUNT(l.id) n FROM products p LEFT JOIN licenses l ON l.product_id=p.id AND l.status='aktif' GROUP BY p.id ORDER BY n DESC,p.sort");$tot=max(1,array_sum(array_column($dist,'n')));?>
      <div class="vp-split"><?php foreach($dist as $d):?><div class="vp-split-row"><span><?=e($d['name'])?></span><b><?=(int)$d['n']?></b><progress class="vp-meter" max="<?=$tot?>" value="<?=(int)$d['n']?>"></progress></div><?php endforeach;?></div>
    </section>
    <section class="vp-card">
      <div class="vp-card-head"><h2>Son hareketler</h2><?php if(vpa_can($a,'logs')):?><a href="/yonetim/kayitlar">Tümü →</a><?php endif;?></div>
      <?php $acts=vp_all('SELECT * FROM activity ORDER BY id DESC LIMIT 7'); if(!$acts): echo '<p class="vp-muted">Henüz kayıt yok.</p>'; else:?>
      <ul class="vp-feed"><?php foreach($acts as $x):?><li><b><?=e($x['actor_name'])?></b> · <?=e($x['action'])?><time><?=e(vp_ago($x['created_at']))?></time></li><?php endforeach;?></ul>
      <?php endif;?>
    </section>
  </div>
</div>
<?php
    vp_shell_end();
}

// ---------------------------------------------------------------- arama
function vpa_search(array $a): void {
    $q=vp_get('q',100);$like='%'.str_replace(['%','_'],['\%','\_'],$q).'%';
    vpa_start($a,'Arama','');
    vp_head('Arama','“'.$q.'” için sonuçlar');
    if(mb_strlen($q)<2){echo vp_empty('En az 2 karakter yazın.');vp_shell_end();return;}
    $sets=[
        ['Müşteriler','clients',vp_all("SELECT id,company t,email s FROM clients WHERE company LIKE ? OR email LIKE ? OR contact_name LIKE ? OR phone LIKE ? OR tax_no LIKE ? LIMIT 10",[$like,$like,$like,$like,$like]),'/yonetim/musteriler/'],
        ['Lisanslar','licenses',vp_all("SELECT l.id,l.license_key t,c.company s FROM licenses l JOIN clients c ON c.id=l.client_id WHERE l.license_key LIKE ? OR l.label LIKE ? LIMIT 10",[$like,$like]),'/yonetim/lisanslar/'],
        ['Faturalar','invoices',vp_all("SELECT i.id,i.number t,c.company s FROM invoices i JOIN clients c ON c.id=i.client_id WHERE i.number LIKE ? LIMIT 10",[$like]),'/yonetim/faturalar/'],
        ['Siparişler','orders',vp_all("SELECT o.id,o.number t,c.company s FROM orders o JOIN clients c ON c.id=o.client_id WHERE o.number LIKE ? LIMIT 10",[$like]),'/yonetim/siparisler/'],
        ['Destek talepleri','tickets',vp_all("SELECT t.id,CONCAT('#',t.number,' · ',t.subject) t,c.company s FROM tickets t JOIN clients c ON c.id=t.client_id WHERE t.subject LIKE ? OR t.number LIKE ? LIMIT 10",[$like,$like]),'/yonetim/talepler/'],
    ];
    $any=false;echo '<div class="vp-grid vp-grid-2">';
    foreach($sets as [$title,$sec,$rows,$base]){
        if(!$rows||!vpa_can($a,$sec))continue;$any=true;
        echo '<section class="vp-card"><div class="vp-card-head"><h2>'.e($title).'</h2><span class="vp-muted">'.count($rows).'</span></div><ul class="vp-list">';
        foreach($rows as $r)echo '<li><div><a href="'.$base.$r['id'].'">'.e($r['t']).'</a><span class="vp-sub">'.e($r['s']).'</span></div></li>';
        echo '</ul></section>';
    }
    echo '</div>';
    if(!$any)echo vp_empty('Sonuç bulunamadı.','Müşteri adı, e-posta, lisans anahtarı, fatura veya sipariş numarasıyla arayın.');
    vp_shell_end();
}

// ---------------------------------------------------------------- müşteriler
function vpa_clients(array $a): void {
    vpa_need($a,'clients');
    $q=vp_get('q',100);$st=vp_get('durum',20);
    $where=['1=1'];$args=[];
    if($q!==''){$where[]="(c.company LIKE ? OR c.email LIKE ? OR c.contact_name LIKE ? OR c.phone LIKE ?)";array_push($args,"%$q%","%$q%","%$q%","%$q%");}
    if(isset(vp_status('client','x')[0])&&in_array($st,['aktif','pasif','kara_liste'],true)){$where[]='c.status=?';$args[]=$st;}
    $w=implode(' AND ',$where);
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM clients c WHERE $w",$args);
    $rows=vp_all("SELECT c.*,(SELECT COUNT(*) FROM licenses WHERE client_id=c.id AND status='aktif') lic,(SELECT COALESCE(SUM(total),0) FROM invoices WHERE client_id=c.id AND status='odenmedi') due FROM clients c WHERE $w ORDER BY c.id DESC LIMIT $per OFFSET $off",$args);
    $counts=array_column(vp_all('SELECT status,COUNT(*) n FROM clients GROUP BY status'),'n','status');
    vpa_start($a,'Müşteriler','/yonetim/musteriler');
    vp_head('Müşteri ve satış','Müşteriler','Site hesabı açan veya sizin eklediğiniz işletmeler.','<a class="vp-btn" href="/yonetim/musteriler/yeni">'.vp_icon('plus').'Müşteri ekle</a>');
    echo '<div class="vp-chips"><a class="vp-chip" href="/yonetim/musteriler"'.($st===''?' aria-current="page"':'').'>Tümü<b>'.array_sum($counts).'</b></a>';
    foreach(['aktif'=>'Aktif','pasif'=>'Pasif','kara_liste'=>'Kara liste'] as $k=>$l)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'<b>'.(int)($counts[$k]??0).'</b></a>';
    echo '</div>';
    ?>
<section class="vp-card vp-card--flush">
  <form class="vp-filters vp-card-head" method="get"><input type="search" name="q" value="<?=e($q)?>" placeholder="Ad, e-posta, telefon…" aria-label="Müşteri ara"><?php if($st):?><input type="hidden" name="durum" value="<?=e($st)?>"><?php endif;?><button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Filtrele</button></form>
  <?php if(!$rows): echo vp_empty('Müşteri bulunamadı.','Filtreyi temizleyin veya yeni müşteri ekleyin.'); else:?>
  <div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>İşletme</th><th>İletişim</th><th>Durum</th><th class="num">Aktif lisans</th><th class="num">Borç</th><th class="num">Bakiye</th><th>Kayıt</th></tr></thead><tbody>
  <?php foreach($rows as $c):?><tr>
    <td data-l="İşletme"><?=vpa_client_link((int)$c['id'],$c['company'])?><span class="vp-sub"><?=e($c['email'])?></span></td>
    <td data-l="İletişim"><?=e($c['contact_name']?:'—')?><span class="vp-sub"><?=e($c['phone'])?></span></td>
    <td data-l="Durum"><?=vp_badge('client',$c['status'])?></td>
    <td data-l="Aktif lisans" class="num"><?=(int)$c['lic']?></td>
    <td data-l="Borç" class="num"><?=$c['due']>0?'<b>'.e(vp_money((int)$c['due'])).'</b>':'—'?></td>
    <td data-l="Bakiye" class="num"><?=$c['balance']?e(vp_money((int)$c['balance'])):'—'?></td>
    <td data-l="Kayıt" class="nowrap vp-muted"><?=e(vp_date($c['created_at']))?></td>
  </tr><?php endforeach;?></tbody></table></div>
  <?=vp_pager($total,$page,$pages)?>
  <?php endif;?>
</section>
<?php
    vp_shell_end();
}

function vpa_client_fields(array $c,bool $new=false): void {
    ?>
  <div class="vp-row"><label class="vp-field"><span>İşletme adı *</span><input type="text" name="company" required maxlength="160" value="<?=e($c['company']??'')?>"></label>
  <label class="vp-field"><span>E-posta *</span><input type="email" name="email" required maxlength="190" value="<?=e($c['email']??'')?>"<?=!$new&&!empty($c['account_id'])?' readonly':''?>><?php if(!$new&&!empty($c['account_id'])):?><small>Site hesabına bağlı; e-posta müşteri tarafından değiştirilir.</small><?php endif;?></label></div>
  <div class="vp-row"><label class="vp-field"><span>Yetkili kişi</span><input type="text" name="contact_name" maxlength="120" value="<?=e($c['contact_name']??'')?>"></label>
  <label class="vp-field"><span>Telefon</span><input type="tel" name="phone" maxlength="40" value="<?=e($c['phone']??'')?>"></label></div>
  <div class="vp-row"><label class="vp-field"><span>Vergi dairesi</span><input type="text" name="tax_office" maxlength="80" value="<?=e($c['tax_office']??'')?>"></label>
  <label class="vp-field"><span>VKN / TCKN</span><input type="text" name="tax_no" maxlength="20" inputmode="numeric" value="<?=e($c['tax_no']??'')?>"></label></div>
  <div class="vp-row"><label class="vp-field"><span>Adres</span><input type="text" name="address" maxlength="300" value="<?=e($c['address']??'')?>"></label>
  <label class="vp-field"><span>İl</span><input type="text" name="city" maxlength="60" value="<?=e($c['city']??'')?>"></label></div>
<?php
}
function vpa_client_input(): array {
    return ['company'=>vp_post('company',160),'contact_name'=>vp_post('contact_name',120),'phone'=>vp_post('phone',40),'tax_office'=>vp_post('tax_office',80),'tax_no'=>preg_replace('/\D/','',vp_post('tax_no',20)),'address'=>vp_post('address',300),'city'=>vp_post('city',60)];
}

function vpa_client_new(array $a): void {
    vpa_need($a,'clients');
    $data=['company'=>'','email'=>''];$err='';
    if(vp_is_post()){
        $data=vpa_client_input();$data['email']=strtolower(vp_post('email',190));$pass=is_string($_POST['password']??null)?$_POST['password']:'';
        if($data['company']===''||!filter_var($data['email'],FILTER_VALIDATE_EMAIL))$err='İşletme adı ve geçerli bir e-posta girin.';
        elseif(vp_val('SELECT 1 FROM clients WHERE email=?',[$data['email']]))$err='Bu e-posta ile kayıtlı bir müşteri var.';
        elseif($pass!==''&&(mb_strlen($pass)<14||strlen($pass)>72))$err='Şifre 14–72 karakter olmalı.';
        else{
            $accountId=null;
            if($pass!==''){
                try{$accountId=vp_site_account_create($data['email'],$data['company'],$pass);}catch(Throwable){$err='Site hesabı oluşturulamadı.';}
                if($accountId===false){$err='Bu e-posta ile bir site hesabı zaten var. Şifreyi boş bırakın; müşteri ilk girişinde otomatik eşleşir.';}
            }
            if(!$err){
                $id=vp_insert('clients',$data+['account_id'=>$accountId?:null,'status'=>'aktif','created_at'=>vp_now()]);
                vpa_log($a,'Müşteri ekledi',$data['company'],$id);vp_flash('Müşteri eklendi.'.($accountId?' Site hesabı da açıldı; müşteri /giris adresinden girebilir.':''));vp_redirect('/yonetim/musteriler/'.$id);
            }
        }
    }
    vpa_start($a,'Yeni müşteri','/yonetim/musteriler');
    vp_head('Müşteri ve satış','Yeni müşteri','',' ',[['/yonetim/musteriler','Müşteriler'],['/yonetim/musteriler/yeni','Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    echo '<form class="vp-card vp-form" method="post">'.vp_csrf_field();
    vpa_client_fields($data,true);
    echo '<label class="vp-field"><span>Site hesabı şifresi</span><input type="password" name="password" minlength="14" maxlength="72" autocomplete="new-password"><small>İsteğe bağlı. Doldurursanız müşteri bu e-posta ve şifreyle müşteri paneline girebilir (en az 14 karakter).</small></label>';
    echo '<div class="vp-form-foot"><button class="vp-btn" type="submit">Müşteriyi kaydet</button><a class="vp-btn vp-btn--ghost" href="/yonetim/musteriler">Vazgeç</a></div></form>';
    vp_shell_end();
}

function vpa_client_view(array $a,string $id): void {
    vpa_need($a,'clients');
    $c=vp_row('SELECT * FROM clients WHERE id=?',[(int)$id]);
    if(!$c){vp_flash('Müşteri bulunamadı.','err');vp_redirect('/yonetim/musteriler');}
    $tab=vp_get('sekme',20)?:'ozet';$cid=(int)$c['id'];
    $licenses=vp_all('SELECT l.*,p.name pname FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.client_id=? ORDER BY l.id DESC',[$cid]);
    $invoices=vp_all('SELECT * FROM invoices WHERE client_id=? ORDER BY id DESC',[$cid]);
    $tickets=vp_all('SELECT * FROM tickets WHERE client_id=? ORDER BY updated_at DESC',[$cid]);
    $orders=vp_all('SELECT o.*,p.name pname FROM orders o JOIN products p ON p.id=o.product_id WHERE o.client_id=? ORDER BY o.id DESC',[$cid]);
    $paid=(int)vp_val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_id=?",[$cid]);
    $due=(int)vp_val("SELECT COALESCE(SUM(total),0) FROM invoices WHERE client_id=? AND status='odenmedi'",[$cid]);
    vpa_start($a,$c['company'],'/yonetim/musteriler');
    $actions='<a class="vp-btn vp-btn--ghost" href="/yonetim/siparisler/yeni?musteri='.$cid.'">'.vp_icon('cart').'Sipariş</a><a class="vp-btn vp-btn--ghost" href="/yonetim/talepler/yeni?musteri='.$cid.'">'.vp_icon('chat').'Talep aç</a>'
        .vp_confirm_form('/yonetim/musteriler/'.$cid.'/olarak-gir','Müşteri olarak gir','Müşteri panelini bu müşterinin gözünden açacaksınız. Devam edilsin mi?','vp-btn');
    vp_head('Müşteri #'.$cid.' · '.vp_status('client',$c['status'])[0],$c['company'],$c['email'].($c['phone']?' · '.$c['phone']:''),$actions,[['/yonetim/musteriler','Müşteriler'],['/yonetim/musteriler/'.$cid,$c['company']]]);
    ?>
<div class="vp-kpis">
  <div class="vp-kpi"><div class="vp-kpi-top">Toplam ödeme</div><strong><?=e(vp_money($paid))?></strong><small><?=count($invoices)?> fatura</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Ödenmemiş</div><strong><?=e(vp_money($due))?></strong><small>vadesi gelen dahil</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Lisans</div><strong><?=count(array_filter($licenses,fn($l)=>$l['status']==='aktif'))?>/<?=count($licenses)?></strong><small>aktif / toplam</small></div>
  <div class="vp-kpi"><div class="vp-kpi-top">Bakiye</div><strong><?=e(vp_money((int)$c['balance']))?></strong><small>fatura ödemesinde kullanılır</small></div>
</div>
<nav class="vp-tabs" aria-label="Müşteri bölümleri">
<?php foreach(['ozet'=>['Özet',0],'lisanslar'=>['Lisanslar',count($licenses)],'faturalar'=>['Faturalar',count($invoices)],'siparisler'=>['Siparişler',count($orders)],'talepler'=>['Talepler',count($tickets)],'bakiye'=>['Bakiye',0],'kayitlar'=>['Kayıtlar',0]] as $k=>[$l,$n]):?>
  <a href="?sekme=<?=$k?>"<?=$tab===$k?' aria-current="page"':''?>><?=$l?><?=$n?'<b>'.$n.'</b>':''?></a>
<?php endforeach;?>
</nav>
<?php if($tab==='lisanslar'):?>
  <?=$licenses?'<div class="vp-tickets">'.implode('',array_map(fn($l)=>vp_license_ticket($l,'/yonetim/lisanslar/'.$l['id']),$licenses)).'</div>':vp_empty('Lisans yok.','Sipariş oluşturup ödendiğinde lisans otomatik açılır.','<a class="vp-btn" href="/yonetim/siparisler/yeni?musteri='.$cid.'">Sipariş oluştur</a>')?>
<?php elseif($tab==='faturalar'): vpa_invoice_table($invoices,false);?>
<?php elseif($tab==='siparisler'):?>
  <section class="vp-card vp-card--flush"><?php if(!$orders): echo vp_empty('Sipariş yok.'); else:?><div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th><th>Paket</th><th>Tür</th><th>Durum</th><th class="num">Tutar</th><th>Tarih</th></tr></thead><tbody>
  <?php foreach($orders as $o):?><tr><td data-l="No"><a class="vp-strong" href="/yonetim/siparisler/<?=$o['id']?>"><?=e($o['number'])?></a></td><td data-l="Paket"><?=e($o['pname'])?></td><td data-l="Tür"><?=e(vpa_kind($o['kind']))?></td><td data-l="Durum"><?=vp_badge('order',$o['status'])?></td><td data-l="Tutar" class="num"><?=e(vp_money((int)$o['total']))?></td><td data-l="Tarih" class="vp-muted nowrap"><?=e(vp_date($o['created_at']))?></td></tr><?php endforeach;?>
  </tbody></table></div><?php endif;?></section>
<?php elseif($tab==='talepler'): vpa_ticket_table($tickets,false);?>
<?php elseif($tab==='bakiye'):?>
  <div class="vp-grid vp-grid-main">
    <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Bakiye hareketleri</h2></div>
    <?php $tx=vp_all('SELECT * FROM balance_tx WHERE client_id=? ORDER BY id DESC LIMIT 100',[$cid]); if(!$tx): echo vp_empty('Hareket yok.'); else:?>
    <div class="vp-table-wrap"><table class="vp-table"><thead><tr><th>Açıklama</th><th class="num">Tutar</th><th>Tarih</th></tr></thead><tbody><?php foreach($tx as $t):?><tr><td><?=e($t['description'])?></td><td class="num"><b><?=$t['amount']>0?'+':''?><?=e(vp_money((int)$t['amount']))?></b></td><td class="vp-muted nowrap"><?=e(vp_date($t['created_at'],true))?></td></tr><?php endforeach;?></tbody></table></div><?php endif;?></section>
    <form class="vp-card vp-form" method="post" action="/yonetim/musteriler/<?=$cid?>/bakiye"><?=vp_csrf_field()?><div class="vp-card-head"><h2>Bakiye düzelt</h2></div>
      <label class="vp-field"><span>Tutar (₺)</span><input type="text" name="amount" required inputmode="decimal" placeholder="500 veya -250"><small>Eksi değer bakiyeden düşer.</small></label>
      <label class="vp-field"><span>Açıklama</span><input type="text" name="description" required maxlength="160" placeholder="Örn. iade, kampanya hediyesi"></label>
      <button class="vp-btn" type="submit">Kaydet</button></form>
  </div>
<?php elseif($tab==='kayitlar'): $logs=vp_all('SELECT * FROM activity WHERE client_id=? ORDER BY id DESC LIMIT 100',[$cid]);?>
  <section class="vp-card"><?php if(!$logs): echo vp_empty('Kayıt yok.'); else:?><ul class="vp-feed"><?php foreach($logs as $x):?><li><b><?=e($x['actor_name'])?></b> · <?=e($x['action'])?><?=$x['detail']?' · <span class="vp-muted">'.e($x['detail']).'</span>':''?><time><?=e(vp_date($x['created_at'],true))?> · <?=e($x['ip'])?></time></li><?php endforeach;?></ul><?php endif;?></section>
<?php else:?>
  <div class="vp-grid vp-grid-main">
    <form class="vp-card vp-form" method="post" action="/yonetim/musteriler/<?=$cid?>/kaydet"><?=vp_csrf_field()?>
      <div class="vp-card-head"><h2>Müşteri bilgileri</h2></div>
      <?php vpa_client_fields($c);?>
      <div class="vp-row"><label class="vp-field"><span>Durum</span><?=vp_select('status',['aktif'=>'Aktif','pasif'=>'Pasif','kara_liste'=>'Kara liste'],$c['status'])?></label>
      <label class="vp-check vp-field"><input type="checkbox" name="notify_email" value="1"<?=$c['notify_email']?' checked':''?>> E-posta bildirimleri açık</label></div>
      <div class="vp-form-foot"><button class="vp-btn" type="submit">Değişiklikleri kaydet</button></div>
    </form>
    <div class="vp-stack">
      <form class="vp-card vp-card--kraft vp-tape vp-form" method="post" action="/yonetim/musteriler/<?=$cid?>/not"><?=vp_csrf_field()?>
        <div class="vp-card-head"><div><span class="vp-label">Yalnız yöneticiler görür</span><h2>Notlar</h2></div></div>
        <textarea name="notes" maxlength="5000" aria-label="Müşteri notları" placeholder="Görüşme notları, özel fiyat anlaşması…"><?=e($c['notes'])?></textarea>
        <button class="vp-btn vp-btn--ink vp-btn--sm" type="submit">Notu kaydet</button>
      </form>
      <section class="vp-card"><div class="vp-card-head"><h2>Hesap</h2></div>
        <dl class="vp-dl"><dt>Site hesabı</dt><dd><?=$c['account_id']?'Bağlı':'Yok'?></dd><dt>Kayıt</dt><dd><?=e(vp_date($c['created_at'],true))?></dd><dt>Son giriş</dt><dd><?=e(vp_date($c['last_login'],true))?></dd></dl>
        <?php if($c['account_id']):?>
        <form class="vp-form" method="post" action="/yonetim/musteriler/<?=$cid?>/sifre" data-confirm="Müşterinin site şifresi değiştirilecek. Devam edilsin mi?"><?=vp_csrf_field()?><br>
          <label class="vp-field"><span>Yeni site şifresi</span><input type="password" name="password" minlength="14" maxlength="72" required autocomplete="new-password"><small>En az 14 karakter. Müşteriye güvenli bir kanaldan iletin.</small></label>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Şifreyi değiştir</button></form>
        <?php endif;?>
      </section>
      <?php if($a['role']==='yonetici'):?><section class="vp-card"><div class="vp-card-head"><h2>Tehlikeli bölge</h2></div><p class="vp-muted">Müşteri silinirse lisans, fatura ve talepleri de silinir. Bunun yerine durumu “Pasif” yapabilirsiniz.</p><?=vp_confirm_form('/yonetim/musteriler/'.$cid.'/sil','Müşteriyi sil','Bu müşteri ve tüm lisans, fatura, talep kayıtları kalıcı olarak silinecek. Geri alınamaz. Emin misiniz?','vp-btn vp-btn--danger vp-btn--sm')?></section><?php endif;?>
    </div>
  </div>
<?php endif;
    vp_shell_end();
}

function vpa_client_action(array $a,string $id,string $action): void {
    vpa_need($a,'clients');
    $c=vp_row('SELECT * FROM clients WHERE id=?',[(int)$id]);$cid=(int)$id;
    if(!$c||!vp_is_post())vp_redirect('/yonetim/musteriler');
    $back='/yonetim/musteriler/'.$cid;
    switch($action){
        case 'kaydet':
            $d=vpa_client_input();$d['status']=in_array($_POST['status']??'',['aktif','pasif','kara_liste'],true)?$_POST['status']:'aktif';$d['notify_email']=isset($_POST['notify_email'])?1:0;
            if(!$c['account_id']){$email=strtolower(vp_post('email',190));if(filter_var($email,FILTER_VALIDATE_EMAIL)&&!vp_val('SELECT 1 FROM clients WHERE email=? AND id<>?',[$email,$cid]))$d['email']=$email;}
            if($d['company']===''){vp_flash('İşletme adı boş olamaz.','err');break;}
            vp_update('clients',$cid,$d);vpa_log($a,'Müşteri bilgilerini güncelledi',$d['company'],$cid);vp_flash('Müşteri bilgileri kaydedildi.');break;
        case 'not': vp_update('clients',$cid,['notes'=>vp_post('notes',5000)]);vp_flash('Not kaydedildi.');break;
        case 'bakiye':
            $amt=vp_parse_money($_POST['amount']??null);$desc=vp_post('description',160);
            if(!$amt||$desc===''){vp_flash('Tutar ve açıklama girin.','err');vp_redirect($back.'?sekme=bakiye');}
            vp_add_balance($cid,$amt,$desc);vpa_log($a,'Bakiye düzeltti',vp_money($amt).' · '.$desc,$cid);vp_flash('Bakiye güncellendi.');vp_redirect($back.'?sekme=bakiye');
        case 'sifre':
            $pass=is_string($_POST['password']??null)?$_POST['password']:'';
            if(mb_strlen($pass)<14||strlen($pass)>72){vp_flash('Şifre 14–72 karakter olmalı.','err');break;}
            try{$ok=vp_site_account_password($c['email'],$pass);}catch(Throwable){$ok=false;}
            if($ok){vpa_log($a,'Müşterinin site şifresini değiştirdi','',$cid);vp_flash('Şifre değiştirildi.');}else vp_flash('Site hesabı bulunamadı veya kaydedilemedi.','err');
            break;
        case 'olarak-gir':
            $acc=['id'=>$c['account_id']?:'panel-'.$cid,'company'=>$c['company'],'email'=>$c['email'],'plan'=>'isletme','license_key'=>'','is_owner'=>false];
            $_SESSION['vp_impersonator']=['admin'=>$_SESSION['vp_admin']??null,'owner'=>$a['owner']?($_SESSION['download_account']??null):null,'name'=>$a['name']];
            $_SESSION['download_account']=$acc;$_SESSION['account_activity']=time();$_SESSION['account_csrf']??=bin2hex(random_bytes(32));
            vpa_log($a,'Müşteri olarak giriş yaptı',$c['company'],$cid);
            vp_redirect('/panel');
        case 'sil':
            if($a['role']!=='yonetici'){vp_flash('Silme yetkiniz yok.','err');break;}
            vp_q('DELETE FROM clients WHERE id=?',[$cid]);vpa_log($a,'Müşteriyi sildi',$c['company'].' · '.$c['email']);vp_flash('Müşteri silindi.');vp_redirect('/yonetim/musteriler');
    }
    vp_redirect($back);
}

// ---------------------------------------------------------------- siparişler
function vpa_kind(string $k): string { return ['yeni'=>'Yeni lisans','yenileme'=>'Yenileme','yukseltme'=>'Yükseltme'][$k]??$k; }

function vpa_orders(array $a): void {
    vpa_need($a,'orders');
    $st=vp_get('durum',20);$where='1=1';$args=[];
    if(in_array($st,['bekliyor','onaylandi','iptal'],true)){$where='o.status=?';$args[]=$st;}
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM orders o WHERE $where",$args);
    $rows=vp_all("SELECT o.*,p.name pname,c.company,i.status istatus FROM orders o JOIN products p ON p.id=o.product_id JOIN clients c ON c.id=o.client_id LEFT JOIN invoices i ON i.id=o.invoice_id WHERE $where ORDER BY o.id DESC LIMIT $per OFFSET $off",$args);
    $counts=array_column(vp_all('SELECT status,COUNT(*) n FROM orders GROUP BY status'),'n','status');
    vpa_start($a,'Siparişler','/yonetim/siparisler');
    vp_head('Müşteri ve satış','Siparişler','Fatura ödendiğinde sipariş kendiliğinden onaylanır ve lisans açılır.','<a class="vp-btn" href="/yonetim/siparisler/yeni">'.vp_icon('plus').'Sipariş oluştur</a>');
    echo '<div class="vp-chips"><a class="vp-chip" href="/yonetim/siparisler"'.($st===''?' aria-current="page"':'').'>Tümü<b>'.array_sum($counts).'</b></a>';
    foreach(['bekliyor'=>'Bekliyor','onaylandi'=>'Onaylandı','iptal'=>'İptal'] as $k=>$l)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.$l.'<b>'.(int)($counts[$k]??0).'</b></a>';
    echo '</div><section class="vp-card vp-card--flush">';
    if(!$rows)echo vp_empty('Sipariş yok.');
    else{
        echo '<div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>No</th><th>Müşteri</th><th>Paket</th><th>Tür</th><th>Fatura</th><th>Durum</th><th class="num">Tutar</th><th>Tarih</th></tr></thead><tbody>';
        foreach($rows as $o)echo '<tr><td data-l="No"><a class="vp-strong" href="/yonetim/siparisler/'.$o['id'].'">'.e($o['number']).'</a></td><td data-l="Müşteri">'.vpa_client_link((int)$o['client_id'],$o['company']).'</td><td data-l="Paket">'.e($o['pname']).'</td><td data-l="Tür">'.e(vpa_kind($o['kind'])).'</td><td data-l="Fatura">'.($o['istatus']?vp_badge('invoice',$o['istatus']):'—').'</td><td data-l="Durum">'.vp_badge('order',$o['status']).'</td><td data-l="Tutar" class="num">'.e(vp_money((int)$o['total'])).($o['discount']?'<span class="vp-sub">−'.e(vp_money((int)$o['discount'])).' '.e($o['coupon_code']).'</span>':'').'</td><td data-l="Tarih" class="nowrap vp-muted">'.e(vp_date($o['created_at'])).'</td></tr>';
        echo '</tbody></table></div>'.vp_pager($total,$page,$pages);
    }
    echo '</section>';vp_shell_end();
}

function vpa_order_new(array $a): void {
    vpa_need($a,'orders');
    $products=vp_all('SELECT * FROM products ORDER BY active DESC,sort,id');
    $clients=vp_all('SELECT id,company,email FROM clients ORDER BY company');
    $err='';
    if(vp_is_post()){
        $cid=vp_int($_POST['client_id']??null);$pid=vp_int($_POST['product_id']??null);
        $c=$cid?vp_row('SELECT * FROM clients WHERE id=?',[$cid]):null;$p=$pid?vp_row('SELECT * FROM products WHERE id=?',[$pid]):null;
        $custom=trim((string)($_POST['amount']??''))!==''?vp_parse_money($_POST['amount']):null;
        [$coupon,$cerr]=$p?vp_coupon_check(vp_post('coupon',40),$p):[null,''];
        if(!$c||!$p)$err='Müşteri ve paket seçin.';
        elseif($cerr)$err=$cerr;
        elseif($custom!==null&&$custom<0)$err='Tutar geçersiz.';
        else{
            [$oid,$iid]=vp_place_order((int)$c['id'],$p,'yeni',null,$coupon,vp_post('note',500),$custom);
            if(isset($_POST['mark_paid'])&&(int)vp_val('SELECT total FROM invoices WHERE id=?',[$iid])>0)vp_mark_paid($iid,vp_post('method',40)?:'havale','Yönetici siparişi',$a['id']?:null);
            vpa_log($a,'Sipariş oluşturdu',$p['name'],(int)$c['id']);vp_flash('Sipariş ve fatura oluşturuldu.');vp_redirect('/yonetim/siparisler/'.$oid);
        }
    }
    vpa_start($a,'Sipariş oluştur','/yonetim/siparisler');
    vp_head('Müşteri ve satış','Sipariş oluştur','Müşteri adına paket siparişi açın; fatura birlikte oluşur.','',[['/yonetim/siparisler','Siparişler'],['/yonetim/siparisler/yeni','Yeni']]);
    if($err)echo '<div class="vp-flash vp-flash--err" role="alert">'.e($err).'</div>';
    if(!$clients){echo vp_empty('Önce bir müşteri ekleyin.','','<a class="vp-btn" href="/yonetim/musteriler/yeni">Müşteri ekle</a>');vp_shell_end();return;}
    $sel=(string)(vp_int($_POST['client_id']??$_GET['musteri']??null)??'');
    ?>
<form class="vp-card vp-form" method="post"><?=vp_csrf_field()?>
  <div class="vp-row"><label class="vp-field"><span>Müşteri *</span><?=vp_select('client_id',[''=>'Seçin…']+array_column(array_map(fn($c)=>['id'=>$c['id'],'l'=>$c['company'].' · '.$c['email']],$clients),'l','id'),$sel,'required')?></label>
  <label class="vp-field"><span>Paket *</span><?=vp_select('product_id',[''=>'Seçin…']+array_column(array_map(fn($p)=>['id'=>$p['id'],'l'=>$p['name'].' · '.vp_money((int)$p['price']).' '.vp_period_suffix($p['period']).($p['active']?'':' (satışta değil)')],$products),'l','id'),(string)($_POST['product_id']??''),'required')?></label></div>
  <div class="vp-row-3 vp-row"><label class="vp-field"><span>Özel tutar (₺)</span><input type="text" name="amount" inputmode="decimal" placeholder="Boş: paket fiyatı" value="<?=e(vp_str($_POST['amount']??'',20))?>"></label>
  <label class="vp-field"><span>Kupon kodu</span><input type="text" name="coupon" maxlength="40" value="<?=e(vp_post('coupon',40))?>"></label>
  <label class="vp-field"><span>Ödeme yöntemi</span><?=vp_select('method',['havale'=>'Havale / EFT','nakit'=>'Nakit','kredi_karti'=>'Kredi kartı (POS)','bakiye'=>'Bakiye'],'havale')?></label></div>
  <label class="vp-field"><span>Not</span><input type="text" name="note" maxlength="500"></label>
  <label class="vp-check"><input type="checkbox" name="mark_paid" value="1"> Ödeme alındı: faturayı ödenmiş işaretle ve lisansı hemen aç</label>
  <div class="vp-form-foot"><button class="vp-btn" type="submit">Siparişi oluştur</button><a class="vp-btn vp-btn--ghost" href="/yonetim/siparisler">Vazgeç</a></div>
</form>
<?php
    vp_shell_end();
}

function vpa_order_view(array $a,string $id): void {
    vpa_need($a,'orders');
    $o=vp_row('SELECT o.*,p.name pname,p.period,c.company,c.email FROM orders o JOIN products p ON p.id=o.product_id JOIN clients c ON c.id=o.client_id WHERE o.id=?',[(int)$id]);
    if(!$o){vp_flash('Sipariş bulunamadı.','err');vp_redirect('/yonetim/siparisler');}
    $inv=$o['invoice_id']?vp_row('SELECT * FROM invoices WHERE id=?',[$o['invoice_id']]):null;
    vpa_start($a,'Sipariş '.$o['number'],'/yonetim/siparisler');
    $act='';
    if($o['status']==='bekliyor'){
        $act.=vp_confirm_form('/yonetim/siparisler/'.$o['id'].'/onayla','Onayla ve lisansı aç','Fatura ödenmemiş olsa da sipariş onaylanıp lisans açılacak. Devam edilsin mi?','vp-btn');
        $act.=vp_confirm_form('/yonetim/siparisler/'.$o['id'].'/iptal','İptal et','Sipariş ve ödenmemiş faturası iptal edilecek. Emin misiniz?','vp-btn vp-btn--danger');
    }
    vp_head('Sipariş · '.vpa_kind($o['kind']),$o['number'],'',$act,[['/yonetim/siparisler','Siparişler'],['/yonetim/siparisler/'.$o['id'],$o['number']]]);
    ?>
<div class="vp-grid vp-grid-main">
  <section class="vp-card"><div class="vp-card-head"><h2>Sipariş ayrıntısı</h2><?=vp_badge('order',$o['status'])?></div>
    <dl class="vp-dl"><dt>Müşteri</dt><dd><?=vpa_client_link((int)$o['client_id'],$o['company'])?> <span class="vp-muted"><?=e($o['email'])?></span></dd><dt>Paket</dt><dd><?=e($o['pname'])?> · <?=e(vp_period_label($o['period']))?></dd><dt>Tür</dt><dd><?=e(vpa_kind($o['kind']))?></dd>
    <dt>Tutar</dt><dd><?=e(vp_money((int)$o['amount']))?></dd><?php if($o['discount']):?><dt>İndirim</dt><dd>−<?=e(vp_money((int)$o['discount']))?> · <span class="vp-mono"><?=e($o['coupon_code'])?></span></dd><?php endif;?><dt>Toplam</dt><dd><b><?=e(vp_money((int)$o['total']))?></b></dd>
    <dt>Lisans</dt><dd><?=$o['license_id']?'<a href="/yonetim/lisanslar/'.$o['license_id'].'">#'.$o['license_id'].' görüntüle</a>':'Ödeme sonrası açılır'?></dd><dt>Not</dt><dd><?=e($o['note']?:'—')?></dd><dt>Tarih</dt><dd><?=e(vp_date($o['created_at'],true))?></dd></dl>
  </section>
  <section class="vp-card vp-card--kraft vp-tape"><div class="vp-card-head"><h2>Fatura</h2></div>
    <?php if($inv):?><p><a class="vp-strong" href="/yonetim/faturalar/<?=$inv['id']?>"><?=e($inv['number'])?></a></p><p><?=vp_badge('invoice',$inv['status'])?></p><dl class="vp-dl"><dt>Toplam</dt><dd><?=e(vp_money((int)$inv['total']))?></dd><dt>Son ödeme</dt><dd><?=e(vp_date($inv['due_at']))?></dd></dl><?php else:?><p class="vp-muted">Fatura yok.</p><?php endif;?>
  </section>
</div>
<?php
    vp_shell_end();
}

function vpa_order_action(array $a,string $id,string $action): void {
    vpa_need($a,'orders');
    $o=vp_row('SELECT * FROM orders WHERE id=?',[(int)$id]);
    if(!$o||!vp_is_post()||$o['status']!=='bekliyor')vp_redirect('/yonetim/siparisler');
    if($action==='onayla'){vp_fulfil_order((int)$o['id']);vpa_log($a,'Siparişi onayladı',$o['number'],(int)$o['client_id']);vp_flash('Sipariş onaylandı.');}
    else{vp_update('orders',(int)$o['id'],['status'=>'iptal']);if($o['invoice_id'])vp_q("UPDATE invoices SET status='iptal' WHERE id=? AND status='odenmedi'",[$o['invoice_id']]);if($o['coupon_code'])vp_q('UPDATE coupons SET used=GREATEST(0,used-1) WHERE code=?',[$o['coupon_code']]);vpa_log($a,'Siparişi iptal etti',$o['number'],(int)$o['client_id']);vp_flash('Sipariş iptal edildi.');}
    vp_redirect('/yonetim/siparisler/'.$o['id']);
}

// ---------------------------------------------------------------- lisanslar
function vpa_licenses(array $a): void {
    vpa_need($a,'licenses');
    $st=vp_get('durum',20);$q=vp_get('q',100);$pid=vp_int($_GET['paket']??null);
    $where=['1=1'];$args=[];
    if(in_array($st,['aktif','bekliyor','askida','suresi_doldu','iptal'],true)){$where[]='l.status=?';$args[]=$st;}
    if($q!==''){$where[]='(l.license_key LIKE ? OR c.company LIKE ? OR l.label LIKE ?)';array_push($args,"%$q%","%$q%","%$q%");}
    if($pid){$where[]='l.product_id=?';$args[]=$pid;}
    $w=implode(' AND ',$where);
    [$total,$page,$pages,$off,$per]=vp_paginate("SELECT COUNT(*) FROM licenses l JOIN clients c ON c.id=l.client_id WHERE $w",$args);
    $rows=vp_all("SELECT l.*,p.name pname,c.company FROM licenses l JOIN products p ON p.id=l.product_id JOIN clients c ON c.id=l.client_id WHERE $w ORDER BY l.id DESC LIMIT $per OFFSET $off",$args);
    $counts=array_column(vp_all('SELECT status,COUNT(*) n FROM licenses GROUP BY status'),'n','status');
    vpa_start($a,'Lisanslar','/yonetim/lisanslar');
    vp_head('Müşteri ve satış','Lisanslar','Programda etkinleştirilen anahtarlar, süreleri ve cihaz kullanımı.');
    echo '<div class="vp-chips"><a class="vp-chip" href="/yonetim/lisanslar"'.($st===''?' aria-current="page"':'').'>Tümü<b>'.array_sum($counts).'</b></a>';
    foreach(['aktif','bekliyor','suresi_doldu','askida','iptal'] as $k)echo '<a class="vp-chip" href="?durum='.$k.'"'.($st===$k?' aria-current="page"':'').'>'.e(vp_status('license',$k)[0]).'<b>'.(int)($counts[$k]??0).'</b></a>';
    echo '</div>';
    $products=array_column(vp_all('SELECT id,name FROM products ORDER BY sort'),'name','id');
    ?>
<section class="vp-card vp-card--flush">
  <form class="vp-filters vp-card-head" method="get"><input type="search" name="q" value="<?=e($q)?>" placeholder="Anahtar, müşteri…" aria-label="Lisans ara"><?=vp_select('paket',[''=>'Tüm paketler']+$products,(string)($pid??''),'aria-label="Paket"')?><?php if($st):?><input type="hidden" name="durum" value="<?=e($st)?>"><?php endif;?><button class="vp-btn vp-btn--ghost vp-btn--sm" type="submit">Filtrele</button></form>
  <?php if(!$rows): echo vp_empty('Lisans bulunamadı.'); else:?>
  <div class="vp-table-wrap"><table class="vp-table vp-table-stack"><thead><tr><th>Anahtar</th><th>Müşteri</th><th>Paket</th><th>Durum</th><th>Cihaz</th><th>Bitiş</th></tr></thead><tbody>
  <?php foreach($rows as $l): $d=vp_days_left($l['expires_at']);?><tr>
    <td data-l="Anahtar"><a class="vp-strong vp-mono" href="/yonetim/lisanslar/<?=$l['id']?>"><?=e($l['license_key'])?></a><?=$l['label']?'<span class="vp-sub">'.e($l['label']).'</span>':''?></td>
    <td data-l="Müşteri"><?=vpa_client_link((int)$l['client_id'],$l['company'])?></td><td data-l="Paket"><?=e($l['pname'])?><span class="vp-sub"><?=e(vp_period_label($l['period']))?></span></td>
    <td data-l="Durum"><?=vp_badge('license',$l['status'])?></td><td data-l="Cihaz"><?=(int)$l['devices_used']?>/<?=$l['device_limit']===null?'∞':(int)$l['device_limit']?></td>
    <td data-l="Bitiş" class="nowrap"><?=$l['expires_at']?e(vp_date($l['expires_at'])).($d!==null&&$d>=0&&$d<=30?'<span class="vp-sub">'.$d.' gün kaldı</span>':''):'<span class="vp-muted">Süresiz</span>'?></td>
  </tr><?php endforeach;?></tbody></table></div>
  <?=vp_pager($total,$page,$pages)?>
  <?php endif;?>
</section>
<?php
    vp_shell_end();
}

function vpa_license_view(array $a,string $id): void {
    vpa_need($a,'licenses');
    $l=vp_row('SELECT l.*,p.name pname,p.code pcode,c.company,c.email FROM licenses l JOIN products p ON p.id=l.product_id JOIN clients c ON c.id=l.client_id WHERE l.id=?',[(int)$id]);
    if(!$l){vp_flash('Lisans bulunamadı.','err');vp_redirect('/yonetim/lisanslar');}
    $inv=vp_all('SELECT * FROM invoices WHERE license_id=? ORDER BY id DESC',[$l['id']]);
    $products=array_column(vp_all('SELECT id,name FROM products ORDER BY sort'),'name','id');
    $full=vpa_can($a,'orders');
    vpa_start($a,$l['license_key'],'/yonetim/lisanslar');
    vp_head('Lisans #'.$l['id'],$l['pname'],$l['company'].' · '.$l['email'],'<a class="vp-btn vp-btn--ghost" href="/yonetim/musteriler/'.$l['client_id'].'">Müşteriye git</a>',[['/yonetim/lisanslar','Lisanslar'],['/yonetim/lisanslar/'.$l['id'],$l['license_key']]]);
    $f=fn(string $op,string $label,string $confirm,string $cls='vp-btn vp-btn--ghost vp-btn--sm')=>vp_confirm_form('/yonetim/lisanslar/'.$l['id'].'/islem',$label,$confirm,$cls,['op'=>$op]);
    ?>
<div class="vp-grid vp-grid-main">
  <div class="vp-stack">
    <div class="vp-tickets"><?=vp_license_ticket($l,'#ayar')?></div>
    <section class="vp-card"><div class="vp-card-head"><h2>Hızlı işlemler</h2></div>
      <div class="vp-actions">
        <?=$f('cihaz','Cihazları sıfırla','Kayıtlı cihaz sayısı sıfırlanacak. Programlar yeniden etkinleştirme isteyebilir. Devam edilsin mi?')?>
        <?php if($full):?>
        <?=$l['status']!=='aktif'?$f('aktif','Etkinleştir','Lisans aktif duruma alınacak. Devam edilsin mi?','vp-btn vp-btn--sm'):''?>
        <?=$l['status']==='aktif'?$f('askiya','Askıya al','Lisans askıya alınacak; program premium özellikleri kilitler. Devam edilsin mi?'):''?>
        <?=in_array($l['period'],['year','quarter','month'],true)?$f('yenileme','Yenileme faturası kes','Bu lisans için yenileme faturası oluşturulacak. Devam edilsin mi?'):''?>
        <?=$l['status']!=='iptal'?$f('iptal','İptal et','Lisans kalıcı olarak iptal edilecek. Emin misiniz?','vp-btn vp-btn--danger vp-btn--sm'):''?>
        <?php endif;?>
      </div>
    </section>
    <section class="vp-card vp-card--flush"><div class="vp-card-head"><h2>Faturalar</h2></div>
      <?php if(!$inv): echo vp_empty('Bu lisansa bağlı fatura yok.'); else:?><div class="vp-table-wrap"><table class="vp-table"><thead><tr><th>No</th><th>Tür</th><th>Durum</th><th class="num">Toplam</th><th>Tarih</th></tr></thead><tbody><?php foreach($inv as $i):?><tr><td><a class="vp-strong" href="/yonetim/faturalar/<?=$i['id']?>"><?=e($i['number'])?></a></td><td><?=e(vpa_kind($i['kind']))?></td><td><?=vp_badge('invoice',$i['status'])?></td><td class="num"><?=e(vp_money((int)$i['total']))?></td><td class="vp-muted nowrap"><?=e(vp_date($i['created_at']))?></td></tr><?php endforeach;?></tbody></table></div><?php endif;?>
    </section>
  </div>
  <?php if($full):?>
  <form class="vp-card vp-form" id="ayar" method="post" action="/yonetim/lisanslar/<?=$l['id']?>/islem"><?=vp_csrf_field()?><input type="hidden" name="op" value="kaydet">
    <div class="vp-card-head"><h2>Lisans ayarları</h2><?=vp_badge('license',$l['status'])?></div>
    <label class="vp-field"><span>Paket</span><?=vp_select('product_id',$products,(string)$l['product_id'])?></label>
    <div class="vp-row"><label class="vp-field"><span>Dönem</span><?=vp_select('period',['year'=>'Yıllık','quarter'=>'3 aylık','month'=>'Aylık','once'=>'Tek ödeme','forever'=>'Ücretsiz'],$l['period'])?></label>
    <label class="vp-field"><span>Yenileme tutarı (₺)</span><input type="text" name="price" inputmode="decimal" value="<?=e(vp_input_money((int)$l['price']))?>"></label></div>
    <div class="vp-row"><label class="vp-field"><span>Bitiş tarihi</span><input type="date" name="expires_at" value="<?=e($l['expires_at']?vp_local($l['expires_at'])->format('Y-m-d'):'')?>"><small>Boş: süresiz.</small></label>
    <label class="vp-field"><span>Cihaz sınırı</span><input type="number" name="device_limit" min="0" max="100000" value="<?=e((string)($l['device_limit']??''))?>"><small>Boş: sınırsız.</small></label></div>
    <label class="vp-field"><span>Etiket</span><input type="text" name="label" maxlength="80" value="<?=e($l['label'])?>" placeholder="Örn. Merkez şube kasası"></label>
    <label class="vp-field"><span>Yönetici notu</span><textarea name="admin_note" maxlength="2000"><?=e($l['admin_note'])?></textarea></label>
    <dl class="vp-dl"><dt>Başlangıç</dt><dd><?=e(vp_date($l['starts_at']))?></dd><dt>Son sıfırlama</dt><dd><?=e(vp_date($l['last_reset'],true))?></dd></dl>
    <button class="vp-btn" type="submit">Kaydet</button>
  </form>
  <?php endif;?>
</div>
<?php
    vp_shell_end();
}

function vpa_license_action(array $a,string $id): void {
    vpa_need($a,'licenses');
    $l=vp_row('SELECT l.*,p.name pname FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.id=?',[(int)$id]);
    if(!$l||!vp_is_post())vp_redirect('/yonetim/lisanslar');
    $lid=(int)$l['id'];$cid=(int)$l['client_id'];$op=vp_post('op',20);
    if($op!=='cihaz'&&!vpa_can($a,'orders')){vp_flash('Bu işlem için yetkiniz yok.','err');vp_redirect('/yonetim/lisanslar/'.$lid);}
    switch($op){
        case 'cihaz': vp_update('licenses',$lid,['devices_used'=>0,'last_reset'=>vp_now()]);vpa_log($a,'Lisans cihazlarını sıfırladı',$l['license_key'],$cid);vp_flash('Cihaz kayıtları sıfırlandı.');break;
        case 'aktif': vp_update('licenses',$lid,['status'=>'aktif']);vpa_log($a,'Lisansı etkinleştirdi',$l['license_key'],$cid);vp_flash('Lisans etkinleştirildi.');break;
        case 'askiya': vp_update('licenses',$lid,['status'=>'askida']);vpa_log($a,'Lisansı askıya aldı',$l['license_key'],$cid);if(function_exists('vp_notify_license'))vp_notify_license('license_suspended',$lid);vp_flash('Lisans askıya alındı.');break;
        case 'iptal': vp_update('licenses',$lid,['status'=>'iptal']);vpa_log($a,'Lisansı iptal etti',$l['license_key'],$cid);vp_flash('Lisans iptal edildi.');break;
        case 'yenileme':
            if(vp_val("SELECT 1 FROM invoices WHERE license_id=? AND kind='yenileme' AND status='odenmedi'",[$lid])){vp_flash('Bu lisansın ödenmemiş bir yenileme faturası zaten var.','info');break;}
            $iid=vp_create_invoice($cid,[[$l['pname'].' ('.vp_period_label($l['period']).') · yenileme · '.$l['license_key'],(int)$l['price']]],['license_id'=>$lid,'kind'=>'yenileme']);
            vpa_log($a,'Yenileme faturası kesti',$l['license_key'],$cid);vp_flash('Yenileme faturası oluşturuldu.');vp_redirect('/yonetim/faturalar/'.$iid);
        case 'kaydet':
            $pid=vp_int($_POST['product_id']??null);$period=in_array($_POST['period']??'',['year','quarter','month','once','forever'],true)?$_POST['period']:$l['period'];
            $exp=vp_str($_POST['expires_at']??'',10);$expUtc=null;
            if($exp!==''&&preg_match('/^\d{4}-\d{2}-\d{2}$/',$exp))$expUtc=(new DateTimeImmutable($exp.' 23:59:59',new DateTimeZone('Europe/Istanbul')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
            $dl=trim((string)($_POST['device_limit']??''));
            $data=['period'=>$period,'price'=>vp_parse_money($_POST['price']??'')??(int)$l['price'],'expires_at'=>$expUtc,'device_limit'=>$dl===''?null:max(0,(int)$dl),'label'=>vp_post('label',80),'admin_note'=>vp_post('admin_note',2000)];
            if($pid&&vp_val('SELECT 1 FROM products WHERE id=?',[$pid]))$data['product_id']=$pid;
            if($expUtc&&strtotime($expUtc.' UTC')>time()&&in_array($l['status'],['suresi_doldu'],true))$data['status']='aktif';
            vp_update('licenses',$lid,$data);vpa_log($a,'Lisans ayarlarını güncelledi',$l['license_key'],$cid);vp_flash('Lisans güncellendi.');break;
    }
    vp_redirect('/yonetim/lisanslar/'.$lid);
}
