<?php
declare(strict_types=1);
// Veniux yönetim ve müşteri paneli çekirdeği: SQLite deposu, yardımcılar, otomasyon.
// Veri dizini web kökünün dışındadır (accounts.php ile aynı kural).

if(!function_exists('e')){function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }}

const VP_SITE_ROOT = __DIR__.'/..';

function vp_data_dir(): string {
    $dir=(getenv('VENIUX_SITE_DATA_DIR')?:dirname(__DIR__,2).'/.local').'/veniux-panel';
    if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Panel storage unavailable');
    $resolved=realpath($dir);$root=realpath(VP_SITE_ROOT);
    if(!$resolved||($root&&($resolved===$root||str_starts_with($resolved,$root.DIRECTORY_SEPARATOR))))throw new RuntimeException('Private panel storage required');
    return $resolved;
}

/**
 * MySQL / MariaDB bağlantı ayarları. Öncelik: ortam değişkenleri (VENIUX_DB_HOST, VENIUX_DB_PORT, VENIUX_DB_NAME, VENIUX_DB_USER, VENIUX_DB_PASS),
 * sonra web kökü dışındaki .local/veniux-panel/database.php (dizi döndürür). İkisi de yoksa yerel XAMPP varsayılanı.
 */
function vp_db_config(): array {
    $file=vp_data_dir().'/database.php';
    $cfg=is_file($file)?require $file:[];
    $cfg=is_array($cfg)?$cfg:[];
    return [
        'host'=>getenv('VENIUX_DB_HOST')?:($cfg['host']??'127.0.0.1'),
        'port'=>(int)(getenv('VENIUX_DB_PORT')?:($cfg['port']??3306)),
        'name'=>getenv('VENIUX_DB_NAME')?:($cfg['name']??'veniux_panel'),
        'user'=>getenv('VENIUX_DB_USER')?:($cfg['user']??'root'),
        'pass'=>getenv('VENIUX_DB_PASS')!==false?(string)getenv('VENIUX_DB_PASS'):(string)($cfg['pass']??''),
    ];
}

function vp_db(): PDO {
    static $pdo=null;
    if($pdo)return $pdo;
    $c=vp_db_config();
    if(!preg_match('/^[A-Za-z0-9_]{1,64}$/',$c['name']))throw new RuntimeException('Invalid database name');
    $opts=[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false,PDO::ATTR_STRINGIFY_FETCHES=>true];
    try{
        $pdo=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname='.$c['name'].';charset=utf8mb4',$c['user'],$c['pass'],$opts);
    }catch(PDOException $e){
        if((int)($e->errorInfo[1]??0)!==1049)throw $e; // 1049: veritabanı yok → oluştur
        $boot=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';charset=utf8mb4',$c['user'],$c['pass'],$opts);
        $boot->exec('CREATE DATABASE IF NOT EXISTS `'.$c['name'].'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname='.$c['name'].';charset=utf8mb4',$c['user'],$c['pass'],$opts);
    }
    $pdo->exec("SET time_zone='+00:00', sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
    vp_migrate($pdo);
    return $pdo;
}

function vp_migrate(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings(skey VARCHAR(64) NOT NULL PRIMARY KEY, svalue TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $version=(int)($pdo->query("SELECT svalue FROM settings WHERE skey='schema_version'")->fetchColumn()?:0);
    if($version<1)vp_migrate_v1($pdo);
    if($version<2){
        // v2: kartla ödeme denemeleri (PayTR, iyzico)
        $pdo->exec("CREATE TABLE IF NOT EXISTS payment_attempts(id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, gateway VARCHAR(12) NOT NULL, invoice_id INT UNSIGNED NOT NULL, client_id INT UNSIGNED NOT NULL, oid VARCHAR(64) NOT NULL UNIQUE, token VARCHAR(255) NOT NULL DEFAULT '', amount BIGINT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'bekliyor', reference VARCHAR(120) NOT NULL DEFAULT '', message VARCHAR(500) NOT NULL DEFAULT '', test_mode TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, KEY idx_invoice(invoice_id), KEY idx_token(token(64)), CONSTRAINT fk_pa_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, CONSTRAINT fk_pa_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("INSERT INTO settings(skey,svalue) VALUES('schema_version','2') ON DUPLICATE KEY UPDATE svalue='2'");
    }
    if($version<3){
        // v3: bildirim kuyruğu (e-posta + WhatsApp) ve müşteri WhatsApp tercihi
        $pdo->exec("CREATE TABLE IF NOT EXISTS notifications(id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, channel VARCHAR(10) NOT NULL, event VARCHAR(40) NOT NULL, client_id INT UNSIGNED NULL, recipient VARCHAR(190) NOT NULL, subject VARCHAR(200) NOT NULL DEFAULT '', body TEXT NOT NULL, payload TEXT NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'bekliyor', attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(500) NOT NULL DEFAULT '', dedupe_key VARCHAR(120) NULL UNIQUE, next_try DATETIME NOT NULL, created_at DATETIME NOT NULL, sent_at DATETIME NULL, KEY idx_queue(status,next_try), KEY idx_client(client_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $cols=array_column($pdo->query('SHOW COLUMNS FROM clients')->fetchAll(PDO::FETCH_ASSOC),'Field');
        if(!in_array('notify_whatsapp',$cols,true))$pdo->exec('ALTER TABLE clients ADD notify_whatsapp TINYINT(1) NOT NULL DEFAULT 1 AFTER notify_email');
        $pdo->exec("INSERT INTO settings(skey,svalue) VALUES('schema_version','3') ON DUPLICATE KEY UPDATE svalue='3'");
    }
    if($version<4){
        // v4: lisans merkezi köprüsü. Merkezin anahtarı VNX- + 48 onaltılık (52 karakter); merkezdeki kayıt numarası ve son eşitlenen durum özeti.
        $cols=array_column($pdo->query('SHOW COLUMNS FROM licenses')->fetchAll(PDO::FETCH_ASSOC),'Field');
        $pdo->exec('ALTER TABLE licenses MODIFY license_key VARCHAR(64) NOT NULL');
        if(!in_array('authority_id',$cols,true))$pdo->exec("ALTER TABLE licenses ADD authority_id INT UNSIGNED NULL, ADD authority_hash VARCHAR(40) NOT NULL DEFAULT ''");
        $pdo->exec("INSERT INTO settings(skey,svalue) VALUES('schema_version','4') ON DUPLICATE KEY UPDATE svalue='4'");
    }
}

function vp_migrate_v1(PDO $pdo): void {
    $T=' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $E="TEXT NOT NULL DEFAULT ('')"; // MySQL 8.0.13+ ve MariaDB 10.2+
    $id='id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY';
    $ref='INT UNSIGNED';
    $tables=[
        "CREATE TABLE IF NOT EXISTS admins($id, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'yonetici', active TINYINT(1) NOT NULL DEFAULT 1, last_login DATETIME NULL, created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS clients($id, account_id VARCHAR(64) NULL UNIQUE, email VARCHAR(190) NOT NULL UNIQUE, company VARCHAR(160) NOT NULL, contact_name VARCHAR(120) NOT NULL DEFAULT '', phone VARCHAR(40) NOT NULL DEFAULT '', tax_office VARCHAR(80) NOT NULL DEFAULT '', tax_no VARCHAR(20) NOT NULL DEFAULT '', address VARCHAR(300) NOT NULL DEFAULT '', city VARCHAR(60) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'aktif', balance BIGINT NOT NULL DEFAULT 0, notes $E, notify_email TINYINT(1) NOT NULL DEFAULT 1, last_login DATETIME NULL, created_at DATETIME NOT NULL, KEY idx_status(status))",
        "CREATE TABLE IF NOT EXISTS products($id, code VARCHAR(60) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, tagline VARCHAR(300) NOT NULL DEFAULT '', period VARCHAR(12) NOT NULL DEFAULT 'year', price BIGINT NOT NULL DEFAULT 0, renew_price BIGINT NULL, device_limit INT NULL, warehouse_limit INT NULL, user_limit INT NULL, ai_limit INT NULL, features $E, active TINYINT(1) NOT NULL DEFAULT 1, featured TINYINT(1) NOT NULL DEFAULT 0, sort INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS addons($id, name VARCHAR(120) NOT NULL, description VARCHAR(1000) NOT NULL DEFAULT '', price BIGINT NOT NULL DEFAULT 0, period VARCHAR(12) NOT NULL DEFAULT 'year', requires VARCHAR(300) NOT NULL DEFAULT '', active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS licenses($id, client_id $ref NOT NULL, product_id $ref NOT NULL, license_key VARCHAR(40) NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'bekliyor', period VARCHAR(12) NOT NULL, price BIGINT NOT NULL DEFAULT 0, starts_at DATETIME NULL, expires_at DATETIME NULL, device_limit INT NULL, devices_used INT NOT NULL DEFAULT 0, last_reset DATETIME NULL, label VARCHAR(80) NOT NULL DEFAULT '', admin_note $E, created_at DATETIME NOT NULL, KEY idx_client(client_id), KEY idx_status(status), CONSTRAINT fk_lic_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE, CONSTRAINT fk_lic_product FOREIGN KEY(product_id) REFERENCES products(id))",
        "CREATE TABLE IF NOT EXISTS orders($id, number VARCHAR(20) NOT NULL UNIQUE, client_id $ref NOT NULL, product_id $ref NOT NULL, license_id $ref NULL, invoice_id $ref NULL, kind VARCHAR(12) NOT NULL DEFAULT 'yeni', amount BIGINT NOT NULL DEFAULT 0, discount BIGINT NOT NULL DEFAULT 0, coupon_code VARCHAR(40) NOT NULL DEFAULT '', total BIGINT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'bekliyor', note VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, KEY idx_client(client_id), CONSTRAINT fk_ord_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE, CONSTRAINT fk_ord_product FOREIGN KEY(product_id) REFERENCES products(id), CONSTRAINT fk_ord_license FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE SET NULL)",
        "CREATE TABLE IF NOT EXISTS invoices($id, number VARCHAR(30) NOT NULL UNIQUE, client_id $ref NOT NULL, license_id $ref NULL, order_id $ref NULL, kind VARCHAR(12) NOT NULL DEFAULT 'yeni', status VARCHAR(20) NOT NULL DEFAULT 'odenmedi', subtotal BIGINT NOT NULL DEFAULT 0, tax_rate INT NOT NULL DEFAULT 20, tax BIGINT NOT NULL DEFAULT 0, total BIGINT NOT NULL DEFAULT 0, due_at DATETIME NOT NULL, paid_at DATETIME NULL, payment_method VARCHAR(40) NOT NULL DEFAULT '', note VARCHAR(1000) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, KEY idx_client(client_id), KEY idx_status(status), CONSTRAINT fk_inv_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE, CONSTRAINT fk_inv_license FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE SET NULL, CONSTRAINT fk_inv_order FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL)",
        "CREATE TABLE IF NOT EXISTS invoice_items($id, invoice_id $ref NOT NULL, description VARCHAR(300) NOT NULL, amount BIGINT NOT NULL, CONSTRAINT fk_item_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS payments($id, invoice_id $ref NULL, client_id $ref NOT NULL, amount BIGINT NOT NULL, method VARCHAR(40) NOT NULL, reference VARCHAR(160) NOT NULL DEFAULT '', admin_id INT NULL, created_at DATETIME NOT NULL, KEY idx_time(created_at), CONSTRAINT fk_pay_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL, CONSTRAINT fk_pay_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS transfer_notices($id, invoice_id $ref NOT NULL, client_id $ref NOT NULL, amount BIGINT NOT NULL, sender VARCHAR(120) NOT NULL, bank VARCHAR(80) NOT NULL DEFAULT '', reference VARCHAR(120) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'bekliyor', admin_note VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, handled_at DATETIME NULL, CONSTRAINT fk_tr_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, CONSTRAINT fk_tr_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS balance_tx($id, client_id $ref NOT NULL, amount BIGINT NOT NULL, description VARCHAR(200) NOT NULL, created_at DATETIME NOT NULL, CONSTRAINT fk_bal_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS coupons($id, code VARCHAR(40) NOT NULL UNIQUE, type VARCHAR(10) NOT NULL DEFAULT 'yuzde', value BIGINT NOT NULL, max_uses INT NULL, used INT NOT NULL DEFAULT 0, expires_at DATETIME NULL, product_codes VARCHAR(300) NOT NULL DEFAULT '', active TINYINT(1) NOT NULL DEFAULT 1, note VARCHAR(300) NOT NULL DEFAULT '', created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS tickets($id, number VARCHAR(12) NOT NULL UNIQUE, client_id $ref NOT NULL, license_id $ref NULL, subject VARCHAR(200) NOT NULL, department VARCHAR(40) NOT NULL DEFAULT 'teknik', priority VARCHAR(12) NOT NULL DEFAULT 'normal', status VARCHAR(20) NOT NULL DEFAULT 'acik', assigned_admin INT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, KEY idx_client(client_id), KEY idx_status(status), CONSTRAINT fk_tic_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE, CONSTRAINT fk_tic_license FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE SET NULL)",
        "CREATE TABLE IF NOT EXISTS ticket_messages($id, ticket_id $ref NOT NULL, author_type VARCHAR(12) NOT NULL, author_id INT NULL, author_name VARCHAR(160) NOT NULL, body TEXT NOT NULL, internal TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, CONSTRAINT fk_msg_ticket FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS canned_replies($id, title VARCHAR(120) NOT NULL, body TEXT NOT NULL, created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS announcements($id, title VARCHAR(200) NOT NULL, body TEXT NOT NULL, tone VARCHAR(12) NOT NULL DEFAULT 'bilgi', published TINYINT(1) NOT NULL DEFAULT 1, pinned TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS kb_articles($id, category VARCHAR(80) NOT NULL, title VARCHAR(200) NOT NULL, body TEXT NOT NULL, published TINYINT(1) NOT NULL DEFAULT 1, views INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)",
        "CREATE TABLE IF NOT EXISTS activity($id, actor_type VARCHAR(12) NOT NULL, actor_id INT NULL, actor_name VARCHAR(160) NOT NULL, client_id INT NULL, action VARCHAR(160) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '', ip VARCHAR(45) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, KEY idx_time(created_at), KEY idx_client(client_id))",
        "CREATE TABLE IF NOT EXISTS login_attempts(akey CHAR(64) NOT NULL PRIMARY KEY, attempts INT NOT NULL, window_start INT NOT NULL)",
    ];
    foreach($tables as $sql)$pdo->exec($sql.$T);
    vp_seed($pdo);
    $pdo->exec("INSERT INTO settings(skey,svalue) VALUES('schema_version','1') ON DUPLICATE KEY UPDATE svalue='1'");
}

function vp_seed(PDO $pdo): void {
    if((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn()>0)return;
    $now=vp_now();
    $defaults=[
        'company_name'=>'Veniux','company_address'=>'','company_tax_office'=>'','company_tax_no'=>'','company_email'=>'',
        'tax_rate'=>'20','prices_include_tax'=>'1','invoice_prefix'=>'VNX','invoice_due_days'=>'7',
        'renewal_notice_days'=>'14','suspend_after_days'=>'10','device_reset_hours'=>'24',
        'bank_accounts'=>"Banka adı · Hesap sahibi\nTR00 0000 0000 0000 0000 0000 00",
        'transfer_note'=>'Açıklama alanına fatura numarasını yazın. Havale bildirimi onaylandığında lisansınız etkinleşir.',
        'orders_open'=>'1','allow_balance_pay'=>'1','ticket_departments'=>"teknik|Teknik destek\nlisans|Lisans ve ödeme\nkurulum|Kurulum ve veri aktarımı\noneri|Öneri ve geri bildirim",
        'automation_last_run'=>'0',
    ];
    $set=$pdo->prepare('INSERT IGNORE INTO settings(skey,svalue) VALUES(?,?)');
    foreach($defaults as $k=>$v)$set->execute([$k,$v]);
    $plans=json_decode((string)@file_get_contents(VP_SITE_ROOT.'/plans.json'),true);
    $labels=is_array($plans['labels']??null)?$plans['labels']:[];
    $periods=['forever'=>'forever','year'=>'year','once'=>'once'];
    $ins=$pdo->prepare('INSERT IGNORE INTO products(code,name,tagline,period,price,renew_price,device_limit,warehouse_limit,user_limit,ai_limit,features,active,featured,sort,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach(($plans['plans']??[]) as $i=>$p){
        if(!is_array($p)||!is_string($p['id']??null))continue;
        $features=array_map(fn($f)=>$labels[$f]??$f,is_array($p['features']??null)?$p['features']:[]);
        $l=$p['limits']??[];
        $ins->execute([$p['id'],$p['name']??$p['id'],$p['tagline']??'',$periods[$p['period']??'year']??'year',(int)round(((float)($p['price_try']??0))*100),null,$l['desktop']??null,$l['warehouses']??null,isset($l['staff'])&&$l['staff']!==null?(int)$l['staff']+(int)($l['admins']??0):null,$l['ai_monthly']??null,implode("\n",$features),1,$p['id']==='pro'?1:0,$i,$now]);
    }
    if(is_array($plans['addon']??null)){
        $a=$plans['addon'];
        $pdo->prepare('INSERT INTO addons(name,description,price,period,requires,active,created_at) VALUES(?,?,?,?,?,1,?)')->execute([$a['name']??'Eklenti',implode(', ',array_map(fn($f)=>$labels[$f]??$f,$plans['addon_features']??[])),0,'year',implode(',',$a['requires']??[]),$now]);
    }
    $kb=$pdo->prepare('INSERT INTO kb_articles(category,title,body,published,created_at,updated_at) VALUES(?,?,?,1,?,?)');
    $kb->execute(['Kurulum','Windows kurulumunda SmartScreen uyarısı',"Windows kurulum dosyasında henüz doğrulanmış yayıncı imzası yok. Bu yüzden ilk açılışta SmartScreen uyarısı çıkabilir.\n\nDosyayı yalnız Veniux müşteri panelinden indirin. Uyarıda \"Ek bilgi\" bağlantısına, ardından \"Yine de çalıştır\" düğmesine basın.",$now,$now]);
    $kb->execute(['Kurulum','Sistem gereksinimleri',"Windows programı: Windows 10 veya 11, 64 bit.\nAndroid uygulaması: Android 8 ve üzeri.\n\nAndroid uygulaması bilgisayardaki aynı kayıtlara yerel ağ üzerinden bağlanır.",$now,$now]);
    $kb->execute(['Lisans','Lisans anahtarı programda nasıl etkinleştirilir?',"Müşteri panelinde Lisanslarım sayfasından anahtarınızı kopyalayın.\n\nProgramda lisans ekranını açın, anahtarı yapıştırın ve etkinleştirin. Cihaz sınırına ulaştıysanız panelden cihaz kayıtlarını sıfırlayabilirsiniz.",$now,$now]);
    $pdo->prepare('INSERT INTO canned_replies(title,body,created_at) VALUES(?,?,?)')->execute(['Teşekkür ve kapanış',"Merhaba,\n\nSorununuzun çözüldüğünü görmek güzel. Başka bir konuda yardıma ihtiyacınız olursa yeni bir talep açabilirsiniz.\n\nİyi çalışmalar,\nVeniux Destek",$now]);
}

// ---------- genel yardımcılar ----------
function vp_now(): string { return gmdate('Y-m-d H:i:s'); }
function vp_q(string $sql,array $args=[]): PDOStatement { $st=vp_db()->prepare($sql);$st->execute($args);return $st; }
function vp_row(string $sql,array $args=[]): ?array { $r=vp_q($sql,$args)->fetch();return $r?:null; }
function vp_all(string $sql,array $args=[]): array { return vp_q($sql,$args)->fetchAll(); }
function vp_val(string $sql,array $args=[]) { return vp_q($sql,$args)->fetchColumn(); }
function vp_insert(string $table,array $data): int {
    $cols=array_keys($data);
    vp_q('INSERT INTO '.$table.'('.implode(',',$cols).') VALUES('.implode(',',array_fill(0,count($cols),'?')).')',array_values($data));
    return (int)vp_db()->lastInsertId();
}
function vp_update(string $table,int $id,array $data): void {
    if(!$data)return;
    vp_q('UPDATE '.$table.' SET '.implode(',',array_map(fn($c)=>$c.'=?',array_keys($data))).' WHERE id=?',[...array_values($data),$id]);
    // Lisans değişince lisans merkezine yansıt (merkez ayarlı değilse hiçbir şey yapmaz).
    if($table==='licenses'&&function_exists('vp_authority_sync')&&!array_key_exists('authority_hash',$data)){
        if(array_key_exists('devices_used',$data)&&(int)$data['devices_used']===0)vp_authority_reset_devices($id);
        if(array_intersect(array_keys($data),['status','expires_at','device_limit','product_id','period']))vp_authority_sync($id);
    }
}
function vp_setting(string $key,string $default=''): string {
    if(!isset($GLOBALS['vp_settings']))$GLOBALS['vp_settings']=array_column(vp_all('SELECT skey,svalue FROM settings'),'svalue','skey');
    return $GLOBALS['vp_settings'][$key]??$default;
}
function vp_set_setting(string $key,string $value): void { vp_q('INSERT INTO settings(skey,svalue) VALUES(?,?) ON DUPLICATE KEY UPDATE svalue=VALUES(svalue)',[$key,$value]);unset($GLOBALS['vp_settings']); }

function vp_money(?int $kurus): string {
    $kurus=(int)$kurus;$neg=$kurus<0;$kurus=abs($kurus);
    $s=number_format(intdiv($kurus,100),0,',','.');
    $frac=$kurus%100;
    return ($neg?'−':'').$s.($frac?','.str_pad((string)$frac,2,'0',STR_PAD_LEFT):'').' ₺';
}
function vp_parse_money($value): ?int {
    if(!is_string($value))return null;
    $v=trim(str_replace(['₺','TL',' '],'',$value));
    if($v==='')return null;
    if(preg_match('/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/',$v))$v=str_replace(['.',','],['','.'],$v);
    elseif(str_contains($v,','))$v=str_replace(',','.',$v);
    if(!preg_match('/^-?\d+(\.\d{1,2})?$/',$v))return null;
    return (int)round(((float)$v)*100);
}
function vp_input_money(?int $kurus): string { return $kurus===null?'':number_format($kurus/100,2,',',''); }

const VP_MONTHS=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const VP_MONTHS_LONG=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
function vp_local(?string $utc): ?DateTimeImmutable {
    if(!$utc)return null;
    try{return (new DateTimeImmutable($utc,new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Europe/Istanbul'));}catch(Throwable){return null;}
}
function vp_date(?string $utc,bool $time=false): string {
    $d=vp_local($utc);if(!$d)return '—';
    return $d->format('j').' '.VP_MONTHS_LONG[(int)$d->format('n')-1].' '.$d->format('Y').($time?' · '.$d->format('H:i'):'');
}
function vp_ago(?string $utc): string {
    if(!$utc)return '—';
    $diff=time()-strtotime($utc.' UTC');
    if($diff<60)return 'az önce';
    if($diff<3600)return intdiv($diff,60).' dk önce';
    if($diff<86400)return intdiv($diff,3600).' sa önce';
    if($diff<86400*30)return intdiv($diff,86400).' gün önce';
    return vp_date($utc);
}
function vp_days_left(?string $utc): ?int { if(!$utc)return null; return (int)floor((strtotime($utc.' UTC')-time())/86400); }
function vp_add_period(string $fromUtc,string $period): ?string {
    $d=new DateTimeImmutable($fromUtc,new DateTimeZone('UTC'));
    return match($period){'year'=>$d->modify('+1 year')->format('Y-m-d H:i:s'),'quarter'=>$d->modify('+3 months')->format('Y-m-d H:i:s'),'month'=>$d->modify('+1 month')->format('Y-m-d H:i:s'),default=>null};
}
function vp_period_label(string $p): string { return ['year'=>'Yıllık','quarter'=>'3 aylık','month'=>'Aylık','once'=>'Tek ödeme','forever'=>'Ücretsiz'][$p]??$p; }
function vp_period_suffix(string $p): string { return ['year'=>'/ yıl','quarter'=>'/ 3 ay','month'=>'/ ay','once'=>'tek ödeme','forever'=>'süresiz'][$p]??''; }
function vp_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR']??''),0,45); }
function vp_str($v,int $max=500): string { return is_string($v)?mb_substr(trim($v),0,$max,'UTF-8'):''; }
function vp_int($v): ?int { $r=filter_var($v,FILTER_VALIDATE_INT);return $r===false?null:$r; }
function vp_post(string $k,int $max=500): string { return vp_str($_POST[$k]??'',$max); }
function vp_get(string $k,int $max=200): string { return vp_str($_GET[$k]??'',$max); }
function vp_is_post(): bool { return ($_SERVER['REQUEST_METHOD']??'GET')==='POST'; }
function vp_redirect(string $to): never { header('Location: '.$to,true,303);exit; }
function vp_flash(string $msg,string $type='ok'): void { $_SESSION['vp_flash'][]=[$type,$msg]; }
function vp_flashes(): array { $f=$_SESSION['vp_flash']??[];unset($_SESSION['vp_flash']);return $f; }
function vp_csrf(): string { return $_SESSION['vp_csrf']??=bin2hex(random_bytes(32)); }
function vp_csrf_field(): string { return '<input type="hidden" name="csrf" value="'.e(vp_csrf()).'">'; }
function vp_check_csrf(): bool { return is_string($_POST['csrf']??null)&&hash_equals(vp_csrf(),$_POST['csrf']); }

function vp_log(string $actorType,?int $actorId,string $actorName,string $action,string $detail='',?int $clientId=null): void {
    vp_insert('activity',['actor_type'=>$actorType,'actor_id'=>$actorId,'actor_name'=>$actorName,'client_id'=>$clientId,'action'=>$action,'detail'=>mb_substr($detail,0,500,'UTF-8'),'ip'=>vp_ip(),'created_at'=>vp_now()]);
}

function vp_rate_ok(string $scope,int $limit=10,int $window=900): bool {
    $key=hash('sha256',$scope.'|'.vp_ip());$now=time();
    $row=vp_row('SELECT attempts,window_start FROM login_attempts WHERE akey=?',[$key]);
    if(!$row||$now-(int)$row['window_start']>$window){vp_q('REPLACE INTO login_attempts(akey,attempts,window_start) VALUES(?,1,?)',[$key,$now]);return true;}
    vp_q('UPDATE login_attempts SET attempts=attempts+1 WHERE akey=?',[$key]);
    return (int)$row['attempts']<$limit;
}

// ---------- numaralar ----------
function vp_license_key(): string {
    $alpha='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do{$parts=[];for($i=0;$i<3;$i++){$s='';for($j=0;$j<4;$j++)$s.=$alpha[random_int(0,strlen($alpha)-1)];$parts[]=$s;}$key='VNX-'.implode('-',$parts);}
    while(vp_val('SELECT 1 FROM licenses WHERE license_key=?',[$key]));
    return $key;
}
function vp_invoice_number(): string {
    $prefix=preg_replace('/[^A-Z0-9]/','',strtoupper(vp_setting('invoice_prefix','VNX')))?:'VNX';$year=gmdate('Y');
    $n=(int)vp_val("SELECT COUNT(*) FROM invoices WHERE number LIKE ?",[$prefix.'-'.$year.'-%'])+1;
    do{$num=$prefix.'-'.$year.'-'.str_pad((string)$n,4,'0',STR_PAD_LEFT);$n++;}while(vp_val('SELECT 1 FROM invoices WHERE number=?',[$num]));
    return $num;
}
function vp_order_number(): string { do{$n='SP-'.random_int(100000,999999);}while(vp_val('SELECT 1 FROM orders WHERE number=?',[$n]));return $n; }
function vp_ticket_number(): string { do{$n=(string)random_int(100000,999999);}while(vp_val('SELECT 1 FROM tickets WHERE number=?',[$n]));return $n; }

// ---------- fatura / sipariş / lisans iş kuralları ----------
function vp_tax_split(int $total): array {
    $rate=max(0,min(100,(int)vp_setting('tax_rate','20')));
    if(vp_setting('prices_include_tax','1')==='1'){$sub=(int)round($total*100/(100+$rate));return [$sub,$total-$sub,$total,$rate];}
    $tax=(int)round($total*$rate/100);return [$total,$tax,$total+$tax,$rate];
}

function vp_create_invoice(int $clientId,array $items,array $extra=[]): int {
    $sum=array_sum(array_map(fn($i)=>(int)$i[1],$items));
    [$sub,$tax,$total,$rate]=vp_tax_split($sum);
    $id=vp_insert('invoices',array_merge(['number'=>vp_invoice_number(),'client_id'=>$clientId,'status'=>$total>0?'odenmedi':'odendi','subtotal'=>$sub,'tax_rate'=>$rate,'tax'=>$tax,'total'=>$total,'due_at'=>gmdate('Y-m-d H:i:s',time()+86400*max(1,(int)vp_setting('invoice_due_days','7'))),'paid_at'=>$total>0?null:vp_now(),'payment_method'=>$total>0?'':'ücretsiz','created_at'=>vp_now()],$extra));
    foreach($items as [$desc,$amount])vp_insert('invoice_items',['invoice_id'=>$id,'description'=>$desc,'amount'=>(int)$amount]);
    if($total>0&&function_exists('vp_notify_invoice'))vp_notify_invoice('invoice_created',$id,['dedupe'=>'inv:'.$id]);
    return $id;
}

function vp_coupon_check(string $code,array $product): array {
    $code=strtoupper(trim($code));
    if($code==='')return [null,''];
    $c=vp_row('SELECT * FROM coupons WHERE code=? AND active=1',[$code]);
    if(!$c)return [null,'Kupon kodu geçerli değil.'];
    if($c['expires_at']&&strtotime($c['expires_at'].' UTC')<time())return [null,'Kuponun süresi dolmuş.'];
    if($c['max_uses']!==null&&(int)$c['used']>=(int)$c['max_uses'])return [null,'Kupon kullanım sınırına ulaşmış.'];
    if($c['product_codes']!==''&&!in_array($product['code'],array_map('trim',explode(',',$c['product_codes'])),true))return [null,'Kupon bu pakette geçerli değil.'];
    return [$c,''];
}
function vp_coupon_discount(?array $coupon,int $amount): int {
    if(!$coupon)return 0;
    $d=$coupon['type']==='yuzde'?(int)round($amount*min(100,(int)$coupon['value'])/100):(int)$coupon['value'];
    return max(0,min($amount,$d));
}

/** Sipariş + fatura oluşturur. $kind: yeni | yenileme | yukseltme */
function vp_place_order(int $clientId,array $product,string $kind='yeni',?int $licenseId=null,?array $coupon=null,string $note='',?int $customAmount=null): array {
    $pdo=vp_db();$pdo->beginTransaction();
    try{
        $amount=$customAmount??($kind==='yenileme'&&$product['renew_price']!==null?(int)$product['renew_price']:(int)$product['price']);
        $discount=vp_coupon_discount($coupon,$amount);$total=$amount-$discount;
        $orderId=vp_insert('orders',['number'=>vp_order_number(),'client_id'=>$clientId,'product_id'=>$product['id'],'license_id'=>$licenseId,'kind'=>$kind,'amount'=>$amount,'discount'=>$discount,'coupon_code'=>$coupon['code']??'','total'=>$total,'status'=>'bekliyor','note'=>$note,'created_at'=>vp_now()]);
        $label=['yeni'=>'','yenileme'=>' · yenileme','yukseltme'=>' · paket yükseltme'][$kind]??'';
        $items=[[$product['name'].' ('.vp_period_label($product['period']).')'.$label,$amount]];
        if($discount>0)$items[]=['İndirim · '.$coupon['code'],-$discount];
        $invoiceId=vp_create_invoice($clientId,$items,['order_id'=>$orderId,'license_id'=>$licenseId,'kind'=>$kind]);
        vp_update('orders',$orderId,['invoice_id'=>$invoiceId]);
        if($coupon)vp_q('UPDATE coupons SET used=used+1 WHERE id=?',[$coupon['id']]);
        $pdo->commit();
    }catch(Throwable $t){$pdo->rollBack();throw $t;}
    if(function_exists('vp_notify')){$cl=vp_row('SELECT * FROM clients WHERE id=?',[$clientId]);vp_notify('admin_order',['client'=>$cl,'vars'=>['paket'=>$product['name'].' · '.(['yeni'=>'yeni lisans','yenileme'=>'yenileme','yukseltme'=>'yükseltme'][$kind]??$kind),'tutar'=>vp_money($total)],'rows'=>[['Müşteri',$cl['company']??''],['Paket',$product['name']],['Tutar',vp_money($total)]],'link'=>vp_public_url().'/yonetim/siparisler/'.$orderId]);}
    if((int)vp_val('SELECT total FROM invoices WHERE id=?',[$invoiceId])===0)vp_fulfil_order($orderId);
    return [$orderId,$invoiceId];
}

/** Ödenen siparişi uygular: yeni lisans, yenileme veya yükseltme. */
function vp_fulfil_order(int $orderId): void {
    $o=vp_row('SELECT * FROM orders WHERE id=?',[$orderId]);
    if(!$o||$o['status']!=='bekliyor')return;
    $p=vp_row('SELECT * FROM products WHERE id=?',[$o['product_id']]);
    if(!$p)return;
    $now=vp_now();
    if($o['kind']==='yeni'){
        $lid=vp_insert('licenses',['client_id'=>$o['client_id'],'product_id'=>$p['id'],'license_key'=>vp_license_key(),'status'=>'aktif','period'=>$p['period'],'price'=>$p['renew_price']??$p['price'],'starts_at'=>$now,'expires_at'=>vp_add_period($now,$p['period']),'device_limit'=>$p['device_limit'],'created_at'=>$now]);
        if(function_exists('vp_authority_issue'))vp_authority_issue($lid); // merkezde gerçek anahtar üretir; başarısızsa cron yeniden dener
        vp_update('orders',$orderId,['license_id'=>$lid,'status'=>'onaylandi']);
        vp_q('UPDATE invoices SET license_id=? WHERE id=?',[$lid,$o['invoice_id']]);
        if(function_exists('vp_notify_license'))vp_notify_license('license_activated',$lid,['dedupe'=>'lic:'.$lid]);
    }elseif($o['license_id']){
        $l=vp_row('SELECT * FROM licenses WHERE id=?',[$o['license_id']]);
        if($l){
            if($o['kind']==='yenileme'){
                $base=$l['expires_at']&&strtotime($l['expires_at'].' UTC')>time()?$l['expires_at']:$now;
                vp_update('licenses',(int)$l['id'],['expires_at'=>vp_add_period($base,$l['period'])??$l['expires_at'],'status'=>'aktif']);
            }else{
                vp_update('licenses',(int)$l['id'],['product_id'=>$p['id'],'period'=>$p['period'],'price'=>$p['renew_price']??$p['price'],'device_limit'=>$p['device_limit'],'status'=>'aktif','expires_at'=>$p['period']==='once'||$p['period']==='forever'?null:($l['expires_at']??vp_add_period($now,$p['period']))]);
            }
        }
        vp_update('orders',$orderId,['status'=>'onaylandi']);
    }
}

/** Faturayı ödenmiş say, ödeme kaydı aç, bağlı siparişi uygula. */
function vp_mark_paid(int $invoiceId,string $method,string $reference='',?int $adminId=null): bool {
    $inv=vp_row('SELECT * FROM invoices WHERE id=?',[$invoiceId]);
    if(!$inv||$inv['status']!=='odenmedi')return false;
    vp_update('invoices',$invoiceId,['status'=>'odendi','paid_at'=>vp_now(),'payment_method'=>$method]);
    vp_insert('payments',['invoice_id'=>$invoiceId,'client_id'=>$inv['client_id'],'amount'=>$inv['total'],'method'=>$method,'reference'=>$reference,'admin_id'=>$adminId,'created_at'=>vp_now()]);
    if(function_exists('vp_notify_invoice')){vp_notify_invoice('invoice_paid',$invoiceId,['dedupe'=>'paid:'.$invoiceId]);if($method!=='ücretsiz')vp_notify_invoice('admin_payment',$invoiceId,['dedupe'=>'apaid:'.$invoiceId]);}
    if($inv['order_id'])vp_fulfil_order((int)$inv['order_id']);
    elseif($inv['license_id']&&$inv['kind']==='yenileme'){
        $l=vp_row('SELECT * FROM licenses WHERE id=?',[$inv['license_id']]);
        if($l){$base=$l['expires_at']&&strtotime($l['expires_at'].' UTC')>time()?$l['expires_at']:vp_now();vp_update('licenses',(int)$l['id'],['expires_at'=>vp_add_period($base,$l['period'])??$l['expires_at'],'status'=>'aktif']);}
    }
    return true;
}

function vp_add_balance(int $clientId,int $amount,string $description): void {
    vp_q('UPDATE clients SET balance=balance+? WHERE id=?',[$amount,$clientId]);
    vp_insert('balance_tx',['client_id'=>$clientId,'amount'=>$amount,'description'=>$description,'created_at'=>vp_now()]);
}

/** Otomasyon: yaklaşan yenileme faturaları, süresi dolan ve askıya alınacak lisanslar. Saatte en fazla bir kez. */
function vp_automation(bool $force=false): array {
    $last=(int)vp_setting('automation_last_run','0');
    if(!$force&&time()-$last<3600)return [];
    vp_set_setting('automation_last_run',(string)time());
    $done=['renewals'=>0,'expired'=>0,'suspended'=>0];
    $notice=max(1,(int)vp_setting('renewal_notice_days','14'));
    $soon=gmdate('Y-m-d H:i:s',time()+86400*$notice);
    foreach(vp_all("SELECT l.*,p.name pname,p.renew_price,p.price pprice FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.status='aktif' AND l.expires_at IS NOT NULL AND l.expires_at<=? AND l.period IN('year','quarter','month')",[$soon]) as $l){
        if(vp_val("SELECT 1 FROM invoices WHERE license_id=? AND kind='yenileme' AND status='odenmedi'",[$l['id']]))continue;
        $amount=(int)$l['price'];
        if($amount<=0)continue;
        vp_create_invoice((int)$l['client_id'],[[$l['pname'].' ('.vp_period_label($l['period']).') · yenileme · '.$l['license_key'],$amount]],['license_id'=>$l['id'],'kind'=>'yenileme','due_at'=>$l['expires_at']]);
        $done['renewals']++;
    }
    $now=vp_now();
    $expIds=array_column(vp_all("SELECT id FROM licenses WHERE status='aktif' AND expires_at IS NOT NULL AND expires_at<?",[$now]),'id');
    $done['expired']=$expIds?vp_q("UPDATE licenses SET status='suresi_doldu' WHERE status='aktif' AND expires_at IS NOT NULL AND expires_at<?",[$now])->rowCount():0;
    if(function_exists('vp_notify_license'))foreach($expIds as $lid)vp_notify_license('license_suspended',(int)$lid,['dedupe'=>'lsus:'.$lid.':'.gmdate('Ymd')]);
    $grace=gmdate('Y-m-d H:i:s',time()-86400*max(0,(int)vp_setting('suspend_after_days','10')));
    $done['suspended']=vp_q("UPDATE licenses SET status='askida' WHERE status='suresi_doldu' AND expires_at<?",[$grace])->rowCount();
    if(function_exists('vp_authority_sync_all')){try{vp_authority_sync_all();}catch(Throwable $t){error_log('[veniux-panel] lisans merkezi eşitleme: '.$t->getMessage());}}
    if(function_exists('vp_notify_reminders')){try{vp_notify_reminders();}catch(Throwable $t){error_log('[veniux-panel] reminders: '.$t->getMessage());}}
    if(array_sum($done)>0)vp_log('sistem',null,'Otomasyon','Otomasyon çalıştı',"Yenileme faturası: {$done['renewals']}, süresi dolan: {$done['expired']}, askıya alınan: {$done['suspended']}");
    return $done;
}

// ---------- durum etiketleri ----------
function vp_status(string $kind,string $value): array {
    $map=[
        'license'=>['aktif'=>['Aktif','ok'],'bekliyor'=>['Ödeme bekliyor','wait'],'askida'=>['Askıda','warn'],'suresi_doldu'=>['Süresi doldu','warn'],'iptal'=>['İptal','off']],
        'invoice'=>['odenmedi'=>['Ödenmedi','warn'],'odendi'=>['Ödendi','ok'],'iptal'=>['İptal','off'],'iade'=>['İade','off']],
        'order'=>['bekliyor'=>['Bekliyor','wait'],'onaylandi'=>['Onaylandı','ok'],'iptal'=>['İptal','off']],
        'ticket'=>['acik'=>['Açık','warn'],'yanitlandi'=>['Yanıtlandı','ok'],'musteri_yaniti'=>['Müşteri yanıtı','warn'],'beklemede'=>['Beklemede','wait'],'kapali'=>['Kapalı','off']],
        'client'=>['aktif'=>['Aktif','ok'],'pasif'=>['Pasif','off'],'kara_liste'=>['Kara liste','bad']],
        'transfer'=>['bekliyor'=>['İncelemede','wait'],'onaylandi'=>['Onaylandı','ok'],'reddedildi'=>['Reddedildi','bad']],
        'attempt'=>['bekliyor'=>['Bekliyor','wait'],'basarili'=>['Başarılı','ok'],'basarisiz'=>['Başarısız','bad'],'inceleme'=>['İncelemede','warn']],
        'priority'=>['dusuk'=>['Düşük','off'],'normal'=>['Normal','wait'],'yuksek'=>['Yüksek','warn'],'acil'=>['Acil','bad']],
    ];
    return $map[$kind][$value]??[$value,'off'];
}
function vp_badge(string $kind,string $value): string { [$l,$t]=vp_status($kind,$value);return '<span class="vp-badge vp-badge--'.$t.'">'.e($l).'</span>'; }
function vp_departments(): array {
    $out=[];foreach(preg_split('/\R/',vp_setting('ticket_departments'))?:[] as $line){[$k,$l]=array_pad(explode('|',$line,2),2,'');$k=trim($k);if($k!=='')$out[$k]=trim($l)?:$k;}
    return $out?:['teknik'=>'Teknik destek'];
}

function vp_barcode(string $seed,int $height=34): string {
    $x=0;$bars='';$hash=hash('crc32b',$seed).hash('md5',$seed);
    foreach(str_split($hash) as $i=>$c){$v=hexdec($c);$w=1+$v%3;if($i%2===0)$bars.='<rect x="'.$x.'" y="0" width="'.$w.'" height="'.$height.'"/>';$x+=$w+($v%2);}
    return '<svg class="vp-barcode" viewBox="0 0 '.$x.' '.$height.'" preserveAspectRatio="none" aria-hidden="true">'.$bars.'</svg>';
}

/** Basit metin biçimlendirme: paragraflar ve satır sonları, HTML kaçışlı. */
function vp_text(string $body): string {
    $out='';foreach(preg_split('/\R{2,}/',trim($body))?:[] as $p)$out.='<p>'.nl2br(e($p)).'</p>';
    return preg_replace('~(https?://[^\s<]+)~','<a href="$1" rel="noopener noreferrer" target="_blank">$1</a>',$out)??$out;
}

function vp_paginate(string $countSql,array $args,int $per=20): array {
    $total=(int)vp_val($countSql,$args);$pages=max(1,(int)ceil($total/$per));
    $page=max(1,min($pages,(int)($_GET['s']??1)));
    return [$total,$page,$pages,($page-1)*$per,$per];
}
