<?php
declare(strict_types=1);
// Bulut veritabanından SALT OKUNUR raporlar. Bağlantı, yalnızca SELECT yetkili ayrı bir veritabanı kullanıcısıyla yapılır (özel klasördeki db.json).
// Parola özeti, lisans anahtarı ve kimlik doğrulama alanları hiçbir sorguda seçilmez.

function consoleDb(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $cfg = privateJson('db.json');
    if (!$cfg || empty($cfg['dsn'])) throw new RuntimeException('Veritabanı ayarı (db.json) yok.');
    $pdo = new PDO((string) $cfg['dsn'], (string) ($cfg['user'] ?? ''), (string) ($cfg['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
function rows(string $sql, array $params = []): array { $st = consoleDb()->prepare($sql); $st->execute($params); return $st->fetchAll(); }
function one(string $sql, array $params = []): array { return rows($sql, $params)[0] ?? []; }
function scalar(string $sql, array $params = []) { $r = one($sql, $params); return $r ? array_values($r)[0] : null; }
const SALE_OK = "('completed','partially_returned')";

function dashboard(): array {
    $now = gmdate('Y-m-d H:i:s'); $d30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400); $d7 = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
    $in30 = gmdate('Y-m-d H:i:s', time() + 30 * 86400); $today = gmdate('Y-m-d') . ' 00:00:00';
    $t = one('SELECT COUNT(*) AS n, COALESCE(SUM(is_active=1),0) AS active, COALESCE(SUM(created_at>=?),0) AS fresh FROM tenants', [$d30]);
    $lic = one("SELECT COALESCE(SUM(status='ACTIVE' AND (expires_at IS NULL OR expires_at>?)),0) AS active, COALESCE(SUM(status='ACTIVE' AND expires_at>? AND expires_at<=?),0) AS expiring, COALESCE(SUM(status='ACTIVE' AND expires_at<=?),0) AS lapsed FROM licenses", [$now, $now, $in30, $now]);
    $u = one('SELECT COUNT(*) AS n, COALESCE(SUM(status=\'active\'),0) AS active, COALESCE(SUM(last_login>=?),0) AS recent FROM users', [$d7]);
    $dev = one("SELECT COUNT(*) AS n, COALESCE(SUM(last_seen_at>=?),0) AS recent FROM pos_devices", [$d7]);
    $s30 = one('SELECT COUNT(*) AS n, COALESCE(SUM(net_amount),0) AS total FROM pos_sales WHERE status IN ' . SALE_OK . ' AND created_at>=?', [$d30]);
    $sToday = one('SELECT COUNT(*) AS n, COALESCE(SUM(net_amount),0) AS total FROM pos_sales WHERE status IN ' . SALE_OK . ' AND created_at>=?', [$today]);
    $o30 = one("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM online_orders WHERE status<>'cancelled' AND created_at>=?", [$d30]);
    $stores = one('SELECT COUNT(*) AS n, COALESCE(SUM(published=1),0) AS live FROM online_stores');
    $daily = rows('SELECT DATE(created_at) AS day, COUNT(*) AS n, COALESCE(SUM(net_amount),0) AS total FROM pos_sales WHERE status IN ' . SALE_OK . ' AND created_at>=? GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 14', [gmdate('Y-m-d H:i:s', time() - 14 * 86400)]);
    $expiring = rows("SELECT t.id, t.company_name, l.plan_id, l.expires_at FROM licenses l JOIN tenants t ON t.id=l.tenant_id WHERE l.status='ACTIVE' AND l.expires_at>? AND l.expires_at<=? ORDER BY l.expires_at LIMIT 15", [$now, $in30]);
    $recent = rows('SELECT id, company_name, industry, created_at, is_active FROM tenants ORDER BY id DESC LIMIT 8');
    return compact('t', 'lic', 'u', 'dev', 's30', 'sToday', 'o30', 'stores', 'daily', 'expiring', 'recent');
}

// Bulutta bağlı (merkezi) lisansı olan müşterilerde plan, durum, bitiş ve eklentiler lisans merkezindeki gerçek kayıttan alınır.
function applyAuthority(array &$list): void {
    if (!function_exists('authorityConfigured') || !authorityConfigured() || !$list) return;
    try {
        $bind = array_column(rows('SELECT tenant_id, authority_license_id FROM cloud_license_bindings'), 'authority_license_id', 'tenant_id');
        $byId = []; foreach (authorityLicenses() as $l) $byId[(int) $l['id']] = $l;
    } catch (Throwable) { return; }
    foreach ($list as &$r) {
        $lic = $byId[(int) ($bind[$r['id']] ?? 0)] ?? null;
        if (!$lic) continue;
        $r['plan_id'] = (AUTH_PLANS[$lic['plan']] ?? $lic['plan']); $r['features'] = null; $r['license_status'] = $lic['status']; $r['expires_at'] = $lic['expires_at']; $r['central_id'] = (int) $lic['id'];
        $merged = array_unique(array_filter(array_merge(explode(',', (string) ($r['packs'] ?? '')), explode(',', (string) $lic['addons']))));
        sort($merged); $r['packs'] = implode(',', $merged);
    }
}

function planName(?string $featuresJson, ?string $planId): string {
    $f = $featuresJson ? json_decode($featuresJson, true) : null;
    if (is_array($f) && isset($f['product_package']['name'])) return (string) $f['product_package']['name'];
    if ($planId && defined('AUTH_PLANS') && isset(AUTH_PLANS[$planId])) return AUTH_PLANS[$planId];
    $legacy = ['BUSINESS_ANNUAL' => 'İşletme', 'STARTER_ANNUAL' => 'Başlangıç', 'ENTERPRISE_ANNUAL' => 'Kurumsal'];
    return (string) ($legacy[$planId] ?? ($planId ?: '—'));
}

function customers(string $q = '', string $filter = ''): array {
    $now = gmdate('Y-m-d H:i:s'); $d30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400); $in30 = gmdate('Y-m-d H:i:s', time() + 30 * 86400);
    $where = ['1=1']; $params = [];
    if ($q !== '') { $where[] = '(t.company_name LIKE ? OR t.email LIKE ? OR t.tenant_code LIKE ? OR t.phone LIKE ?)'; $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%'; array_push($params, $like, $like, $like, $like); }
    if ($filter === 'pasif') $where[] = 't.is_active=0';
    if ($filter === 'aktif') $where[] = 't.is_active=1';
    $sql = "SELECT t.id, t.company_name, t.tenant_code, t.email, t.phone, t.industry, t.is_active, t.created_at,
      (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id) AS users,
      (SELECT COUNT(*) FROM pos_devices d WHERE d.tenant_id=t.id) AS devices,
      (SELECT MAX(u.last_login) FROM users u WHERE u.tenant_id=t.id) AS last_login,
      (SELECT l.plan_id FROM licenses l WHERE l.tenant_id=t.id ORDER BY l.id DESC LIMIT 1) AS plan_id,
      (SELECT l.enabled_features_json FROM licenses l WHERE l.tenant_id=t.id ORDER BY l.id DESC LIMIT 1) AS features,
      (SELECT l.status FROM licenses l WHERE l.tenant_id=t.id ORDER BY l.id DESC LIMIT 1) AS license_status,
      (SELECT l.expires_at FROM licenses l WHERE l.tenant_id=t.id ORDER BY l.id DESC LIMIT 1) AS expires_at,
      (SELECT GROUP_CONCAT(p.pack ORDER BY p.pack SEPARATOR ',') FROM sector_packs p WHERE p.tenant_id=t.id) AS packs,
      (SELECT COALESCE(SUM(s.net_amount),0) FROM pos_sales s WHERE s.tenant_id=t.id AND s.status IN " . SALE_OK . " AND s.created_at>=?) AS sales30
      FROM tenants t WHERE " . implode(' AND ', $where) . ' ORDER BY t.id DESC LIMIT 500';
    $list = rows($sql, array_merge([$d30], $params));
    applyAuthority($list);
    if ($filter === 'bitecek') $list = array_values(array_filter($list, fn($r) => $r['expires_at'] && $r['expires_at'] > $now && $r['expires_at'] <= $in30));
    if ($filter === 'suresi-doldu') $list = array_values(array_filter($list, fn($r) => $r['expires_at'] && $r['expires_at'] <= $now));
    return $list;
}

function customerDetail(int $id): ?array {
    $t = one('SELECT id, company_name, tenant_code, email, phone, tax_number, tax_office, address, is_active, created_at, industry, currency, timezone FROM tenants WHERE id=?', [$id]);
    if (!$t) return null;
    $d30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
    $licenses = rows('SELECT id, plan_id, status, max_users, max_warehouses, max_devices, enabled_features_json, issued_at, activated_at, expires_at, last_validation_at FROM licenses WHERE tenant_id=? ORDER BY id DESC LIMIT 20', [$id]);
    foreach ($licenses as &$l) $l['plan_name'] = planName($l['enabled_features_json'], $l['plan_id']);
    unset($l);
    $central = null;
    if (function_exists('authorityConfigured') && authorityConfigured()) { try { $bid = (int) scalar('SELECT authority_license_id FROM cloud_license_bindings WHERE tenant_id=?', [$id]); $central = $bid ? authorityLicense($bid) : null; } catch (Throwable) { $central = null; } }
    return [
        'tenant' => $t, 'licenses' => $licenses, 'central' => $central,
        'users' => rows('SELECT id, email, full_name, role, status, last_login, created_at FROM users WHERE tenant_id=? ORDER BY id LIMIT 200', [$id]),
        'devices' => rows('SELECT id, label, platform, status, created_at, last_seen_at FROM pos_devices WHERE tenant_id=? ORDER BY id LIMIT 100', [$id]),
        'warehouses' => rows('SELECT id, name, warehouse_type, location FROM warehouses WHERE tenant_id=? ORDER BY id LIMIT 100', [$id]),
        'packs' => rows('SELECT pack, granted_at FROM sector_packs WHERE tenant_id=? ORDER BY pack', [$id]),
        'sales' => one('SELECT COUNT(*) AS n, COALESCE(SUM(net_amount),0) AS total FROM pos_sales WHERE tenant_id=? AND status IN ' . SALE_OK . ' AND created_at>=?', [$id, $d30]),
        'salesAll' => one('SELECT COUNT(*) AS n, COALESCE(SUM(net_amount),0) AS total, MAX(created_at) AS last FROM pos_sales WHERE tenant_id=? AND status IN ' . SALE_OK, [$id]),
        'store' => one('SELECT slug, name, published, accepting_orders, created_at FROM online_stores WHERE tenant_id=?', [$id]),
        'orders' => one("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM online_orders WHERE tenant_id=? AND status<>'cancelled'", [$id]),
        'products' => (int) scalar('SELECT COUNT(*) FROM products WHERE tenant_id=?', [$id]),
        'invoices' => rows('SELECT invoice_no, amount, currency, payment_method, status, paid_at, created_at FROM invoices WHERE tenant_id=? ORDER BY id DESC LIMIT 20', [$id]),
        'audit' => rows('SELECT user_email, action, entity_type, created_at FROM audit_logs WHERE tenant_id=? ORDER BY id DESC LIMIT 20', [$id]),
    ];
}

function salesByTenant(int $days = 30): array {
    $from = gmdate('Y-m-d H:i:s', time() - $days * 86400);
    return rows("SELECT t.id, t.company_name,
      (SELECT COUNT(*) FROM pos_sales s WHERE s.tenant_id=t.id AND s.status IN " . SALE_OK . " AND s.created_at>=?) AS sales,
      (SELECT COALESCE(SUM(s.net_amount),0) FROM pos_sales s WHERE s.tenant_id=t.id AND s.status IN " . SALE_OK . " AND s.created_at>=?) AS revenue,
      (SELECT COUNT(*) FROM online_orders o WHERE o.tenant_id=t.id AND o.status<>'cancelled' AND o.created_at>=?) AS orders,
      (SELECT COALESCE(SUM(o.total),0) FROM online_orders o WHERE o.tenant_id=t.id AND o.status<>'cancelled' AND o.created_at>=?) AS online_revenue
      FROM tenants t ORDER BY revenue DESC, t.id DESC LIMIT 300", [$from, $from, $from, $from]);
}

function catalogue(): array {
    $owner = one('SELECT u.tenant_id FROM platform_admins p JOIN users u ON u.id=p.user_id ORDER BY p.user_id LIMIT 1');
    $payload = $owner ? one("SELECT payload, revision FROM workspace_collections WHERE tenant_id=? AND scope='settings' AND name='product_packages_v1'", [$owner['tenant_id']]) : [];
    $plans = $payload ? (json_decode((string) $payload['payload'], true)['plans'] ?? []) : [];
    $counts = rows("SELECT pack, COUNT(*) AS n FROM sector_packs GROUP BY pack");
    return ['revision' => (int) ($payload['revision'] ?? 0), 'plans' => $plans, 'packCounts' => array_column($counts, 'n', 'pack')];
}
function systemInfo(): array {
    $info = ['db_version' => (string) scalar('SELECT VERSION()'), 'migration' => (string) scalar('SELECT version FROM veniux_mysql_migrations ORDER BY version DESC LIMIT 1'), 'tables' => (int) scalar('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()'),
        'php' => PHP_VERSION, 'time' => gmdate('Y-m-d H:i:s') . ' UTC', 'authority' => null, 'smtp' => null];
    $cfg = privateJson('app.json') ?? []; $url = (string) ($cfg['cloud_health_url'] ?? '');
    $info['health'] = null;
    if ($url !== '' && (str_starts_with($url, 'https://') || str_starts_with($url, 'http://127.0.0.1'))) {
        $ctx = stream_context_create(['http' => ['timeout' => 6, 'ignore_errors' => true]]);
        $body = @file_get_contents($url, false, $ctx);
        $info['health'] = $body ? json_decode($body, true) : ['status' => 'ulaşılamadı'];
    }
    if (function_exists('authorityConfigured') && authorityConfigured()) { try { $info['authority'] = ['licenses' => count(authorityLicenses()), 'ok' => true]; } catch (Throwable) { $info['authority'] = ['ok' => false]; } }
    return $info;
}


// Pano grafikleri: 30 günlük kasa+online satış, 12 haftalık müşteri büyümesi, lisans durumu, paket dağılımı.
function dashboardCharts(): array {
    $n = 30; $from = gmdate('Y-m-d H:i:s', time() - ($n - 1) * 86400 - (int) gmdate('G') * 3600);
    $pos = array_column(rows('SELECT DATE(created_at) AS d, COALESCE(SUM(net_amount),0) AS t FROM pos_sales WHERE status IN ' . SALE_OK . ' AND created_at>=? GROUP BY DATE(created_at)', [gmdate('Y-m-d', time() - ($n - 1) * 86400) . ' 00:00:00']), 't', 'd');
    $onl = array_column(rows("SELECT DATE(created_at) AS d, COALESCE(SUM(total),0) AS t FROM online_orders WHERE status<>'cancelled' AND created_at>=? GROUP BY DATE(created_at)", [gmdate('Y-m-d', time() - ($n - 1) * 86400) . ' 00:00:00']), 't', 'd');
    $days = [];
    for ($i = $n - 1; $i >= 0; $i--) { $ts = time() - $i * 86400; $d = gmdate('Y-m-d', $ts); $days[] = ['label' => gmdate('d.m', $ts), 'a' => (float) ($pos[$d] ?? 0), 'b' => (float) ($onl[$d] ?? 0)]; }
    // haftalık birikimli müşteri
    $weeks = 12; $start = time() - ($weeks - 1) * 7 * 86400;
    $base = (int) scalar('SELECT COUNT(*) FROM tenants WHERE created_at<?', [gmdate('Y-m-d H:i:s', $start)]);
    $created = array_map(fn($r) => strtotime($r['created_at'] . ' UTC'), rows('SELECT created_at FROM tenants WHERE created_at>=?', [gmdate('Y-m-d H:i:s', $start)]));
    $growth = [];
    for ($w = 0; $w < $weeks; $w++) { $end = $start + ($w + 1) * 7 * 86400; $cnt = $base + count(array_filter($created, fn($t) => $t < $end)); $growth[] = ['label' => gmdate('d.m', $end - 86400), 'v' => $cnt]; }
    // lisans durumu ve paket dağılımı: lisans merkezi varsa gerçek kaynak o
    $states = ['Aktif' => 0, 'Yakında bitiyor' => 0, 'Süresi doldu' => 0, 'Askıda' => 0, 'Sonlandırılmış' => 0]; $plans = []; $packs = [];
    $src = [];
    if (function_exists('authorityConfigured') && authorityConfigured()) { try { $src = authorityLicenses(); } catch (Throwable) { $src = []; } }
    if (!$src) $src = array_map(fn($r) => ['status' => $r['status'], 'expires_at' => $r['expires_at'], 'plan' => $r['plan_id'], 'addons' => ''], rows('SELECT status, expires_at, plan_id FROM licenses'));
    $now = gmdate('Y-m-d H:i:s'); $in30 = gmdate('Y-m-d H:i:s', time() + 30 * 86400);
    foreach ($src as $l) {
        if ($l['status'] === 'REVOKED' || $l['status'] === 'CANCELLED') { $states['Sonlandırılmış']++; continue; }
        if ($l['status'] === 'SUSPENDED') { $states['Askıda']++; continue; }
        if ($l['expires_at'] && $l['expires_at'] <= $now) { $states['Süresi doldu']++; continue; }
        if ($l['expires_at'] && $l['expires_at'] <= $in30) $states['Yakında bitiyor']++; else $states['Aktif']++;
        $name = planName(null, (string) $l['plan']); $plans[$name] = ($plans[$name] ?? 0) + 1;
        foreach (array_filter(explode(',', (string) ($l['addons'] ?? ''))) as $a) $packs[$a] = ($packs[$a] ?? 0) + 1;
    }
    foreach (rows('SELECT pack, COUNT(*) AS n FROM sector_packs GROUP BY pack') as $r) $packs[$r['pack']] = max($packs[$r['pack']] ?? 0, (int) $r['n']);
    arsort($plans);
    return compact('days', 'growth', 'states', 'plans', 'packs');
}
function salesRanking(int $days): array {
    $from = gmdate('Y-m-d H:i:s', time() - $days * 86400);
    $kasa = rows('SELECT t.company_name AS label, t.id, COALESCE(SUM(s.net_amount),0) AS v FROM tenants t JOIN pos_sales s ON s.tenant_id=t.id WHERE s.status IN ' . SALE_OK . ' AND s.created_at>=? GROUP BY t.id, t.company_name ORDER BY v DESC LIMIT 10', [$from]);
    $onl = rows("SELECT t.company_name AS label, t.id, COALESCE(SUM(o.total),0) AS v FROM tenants t JOIN online_orders o ON o.tenant_id=t.id WHERE o.status<>'cancelled' AND o.created_at>=? GROUP BY t.id, t.company_name ORDER BY v DESC LIMIT 10", [$from]);
    return ['kasa' => $kasa, 'online' => $onl];
}


// Müşteri ayrıntısı grafikleri: 30 günlük kasa+online satış, ödeme yöntemi dağılımı, kullanım doluluğu, online sipariş durumları.
function customerCharts(int $id): array {
    $n = 30; $startDay = gmdate('Y-m-d', time() - ($n - 1) * 86400) . ' 00:00:00';
    $pos = array_column(rows('SELECT DATE(created_at) AS d, COALESCE(SUM(net_amount),0) AS t FROM pos_sales WHERE tenant_id=? AND status IN ' . SALE_OK . ' AND created_at>=? GROUP BY DATE(created_at)', [$id, $startDay]), 't', 'd');
    $onl = array_column(rows("SELECT DATE(created_at) AS d, COALESCE(SUM(total),0) AS t FROM online_orders WHERE tenant_id=? AND status<>'cancelled' AND created_at>=? GROUP BY DATE(created_at)", [$id, $startDay]), 't', 'd');
    $days = [];
    for ($i = $n - 1; $i >= 0; $i--) { $ts = time() - $i * 86400; $dd = gmdate('Y-m-d', $ts); $days[] = ['label' => gmdate('d.m', $ts), 'a' => (float) ($pos[$dd] ?? 0), 'b' => (float) ($onl[$dd] ?? 0)]; }
    $pay = rows('SELECT payment_method AS m, COUNT(*) AS n FROM pos_sales WHERE tenant_id=? AND status IN ' . SALE_OK . ' AND created_at>=? GROUP BY payment_method ORDER BY n DESC', [$id, $startDay]);
    $orders = rows('SELECT status AS s, COUNT(*) AS n FROM online_orders WHERE tenant_id=? GROUP BY status ORDER BY n DESC', [$id]);
    $lic = one('SELECT max_users, max_warehouses, max_devices FROM licenses WHERE tenant_id=? ORDER BY id DESC LIMIT 1', [$id]);
    $use = [
        ['label' => 'Kullanıcı', 'value' => (int) scalar('SELECT COUNT(*) FROM users WHERE tenant_id=?', [$id]), 'max' => (int) ($lic['max_users'] ?? 0)],
        ['label' => 'Depo / mağaza', 'value' => (int) scalar('SELECT COUNT(*) FROM warehouses WHERE tenant_id=?', [$id]), 'max' => (int) ($lic['max_warehouses'] ?? 0)],
        ['label' => 'Cihaz', 'value' => (int) scalar('SELECT COUNT(*) FROM pos_devices WHERE tenant_id=?', [$id]), 'max' => (int) ($lic['max_devices'] ?? 0)],
    ];
    $top = rows('SELECT p.name AS label, COUNT(*) AS v FROM stock_movements m JOIN products p ON p.id=m.product_id WHERE m.tenant_id=? AND m.movement_type=\'sale\' AND m.created_at>=? GROUP BY p.id, p.name ORDER BY v DESC LIMIT 6', [$id, $startDay]);
    return compact('days', 'pay', 'orders', 'use', 'top');
}
