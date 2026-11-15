<?php
declare(strict_types=1);

// Stil dosyası değişince tarayıcı önbelleği otomatik yenilensin diye dosya zamanı adrese eklenir.
function assetVersion(): string { return (string) (@filemtime(dirname(__DIR__) . '/public/assets/console.css') ?: 1); }
function e($v): string { return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function money($v): string { return number_format((float) $v, 2, ',', '.') . ' ₺'; }
function num($v): string { return number_format((float) $v, 0, ',', '.'); }
function when(?string $v): string { return $v ? '<span class="nw">' . e(substr(str_replace('T', ' ', $v), 0, 16)) . '</span>' : '—'; }
function dayOf(?string $v): string { return $v ? '<span class="nw">' . e(substr($v, 0, 10)) . '</span>' : '—'; }
const PACK_NAMES = ['hardware' => 'Hırdavat', 'tableware' => 'Züccaciye', 'restaurant' => 'Pide ve restoran', 'online_store' => 'Online mağaza'];
const ROLE_NAMES = ['admin' => 'Yönetici', 'manager' => 'Müdür', 'cashier' => 'Kasiyer', 'warehouse_staff' => 'Depo', 'waiter' => 'Garson', 'kitchen' => 'Mutfak', 'viewer' => 'İzleyici'];
function packLabels(?string $csv): string {
    if (!$csv) return '—';
    return e(implode(', ', array_map(fn($p) => PACK_NAMES[$p] ?? $p, explode(',', $csv))));
}
function licenseState(?string $status, ?string $expires): array {
    if (!$status) return ['Lisans yok', 'bad'];
    if ($status !== 'ACTIVE') return [$status === 'CANCELLED' ? 'İptal' : ($status === 'SUSPENDED' ? 'Askıda' : $status), 'bad'];
    if ($expires && $expires <= gmdate('Y-m-d H:i:s')) return ['Süresi doldu', 'bad'];
    if ($expires && $expires <= gmdate('Y-m-d H:i:s', time() + 30 * 86400)) return ['Yakında bitiyor', 'warn'];
    return ['Aktif', 'ok'];
}
function badge(string $text, string $kind = 'ok'): string { return '<span class="b b-' . e($kind) . '">' . e($text) . '</span>'; }

function layout(string $title, string $body, string $active = '', string $strip = ''): void {
    $nav = ['/' => 'Pano', '/musteriler' => 'Müşteriler', '/lisanslar' => 'Lisanslar', '/satislar' => 'Satışlar', '/paketler' => 'Paketler', '/sistem' => 'Sistem'];
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . e($title) . ' | Veniux Yönetim</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/console.css?v=' . assetVersion() . '"></head><body>';
    echo '<a class="skip" href="#icerik">İçeriğe geç</a><header class="top"><div class="wrap nav"><a class="brand" href="/" aria-label="Veniux yönetim ana sayfa"><img src="/assets/logo-40-v1.webp" srcset="/assets/logo-40-v1.webp 1x, /assets/logo-80-v1.webp 2x" alt="" width="28" height="28"><span>Veniux</span><em>yönetim</em></a><nav aria-label="Ana menü">';
    foreach ($nav as $href => $label) echo '<a href="' . $href . '"' . ($active === $href ? ' aria-current="page"' : '') . '>' . e($label) . '</a>';
    echo '</nav><form method="post" action="/cikis" class="out"><input type="hidden" name="csrf" value="' . e(csrfToken()) . '"><button class="link" type="submit">Çıkış</button></form></div></header>' . $strip;
    echo '<main id="icerik" class="wrap">' . $body . '</main><footer class="wrap foot"><div>' . barcodeSvg('yonetim-' . $title, 26) . '</div><p>Bu sayfa yalnızca Veniux sahibine açıktır. Müşteri verileri bulut veritabanından salt okunur çekilir; lisans işlemleri lisans merkezine yazılır ve kayda geçer.</p></footer></body></html>';
}

function statBox(string $label, string $value, string $note = '', string $tone = ''): string {
    return '<div class="tag' . ($tone ? ' tag-' . e($tone) : '') . '"><span class="k">VENIUX · ' . e(mb_strtoupper($label)) . '</span><b>' . e($value) . '</b>' . ($note !== '' ? '<small>' . e($note) . '</small>' : '') . '</div>';
}

function pageLogin(string $error = ''): void {
    $b = '<section class="login"><h1>Yönetim girişi</h1><p class="lead">Yalnızca Veniux sahibi için.</p>';
    if ($error !== '') $b .= '<p class="err" role="alert">' . e($error) . '</p>';
    $b .= '<form method="post" action="/giris" autocomplete="off"><input type="hidden" name="csrf" value="' . e(csrfToken()) . '">'
        . '<label>E-posta<input name="email" type="email" required autocomplete="username"></label>'
        . '<label>Parola<input name="password" type="password" required autocomplete="current-password"></label>'
        . '<label>Doğrulama kodu (6 hane)<input name="code" inputmode="numeric" pattern="\d{6}" maxlength="6" required autocomplete="one-time-code"></label>'
        . '<button class="btn" type="submit">Giriş yap</button></form></section>';
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Giriş | Veniux Yönetim</title><link rel="stylesheet" href="/assets/console.css?v=' . assetVersion() . '"></head><body><main class="wrap">' . $b . '</main></body></html>';
}

function pageDashboard(array $d, array $c): string {
    $b = '<h1>Pano</h1><p class="lead">Müşteriler, lisanslar ve satışlar tek bakışta.</p><div class="tags">';
    $b .= statBox('Müşteri', num($d['t']['n']), num($d['t']['active']) . ' aktif · son 30 günde ' . num($d['t']['fresh']) . ' yeni');
    $b .= statBox('Geçerli lisans', num($c['states']['Aktif'] + $c['states']['Yakında bitiyor']), num($c['states']['Yakında bitiyor']) . ' tanesi 30 gün içinde bitiyor', $c['states']['Yakında bitiyor'] ? 'warn' : '');
    $b .= statBox('Çalışan', num($d['u']['n']), num($d['u']['recent']) . ' kişi son 7 günde giriş yaptı');
    $b .= statBox('Terminal / cihaz', num($d['dev']['n']), num($d['dev']['recent']) . ' tanesi son 7 günde görüldü');
    $b .= statBox('Satış (30 gün)', money($d['s30']['total']), num($d['s30']['n']) . ' kasa satışı');
    $b .= statBox('Bugün', money($d['sToday']['total']), num($d['sToday']['n']) . ' satış');
    $b .= statBox('Online mağaza', num($d['stores']['live']) . ' yayında', num($d['stores']['n']) . ' mağaza · 30 günde ' . num($d['o30']['n']) . ' sipariş, ' . money($d['o30']['total']));
    $b .= statBox('Süresi dolmuş', num($c['states']['Süresi doldu']), 'etkin kalmış ama süresi bitmiş lisans', $c['states']['Süresi doldu'] ? 'bad' : '');
    $b .= '</div><section class="panel"><h2>Günlük satış (son 30 gün)</h2>' . chartStacked($c['days'], 'Kasa', 'Online', 'Son 30 günün günlük kasa ve online cirosu') . '</section>';
    $b .= '<div class="cols"><section class="panel"><h2>Lisans durumu</h2>' . chartDonut([
        ['label' => 'Aktif', 'value' => $c['states']['Aktif'], 'color' => C_GREEN], ['label' => 'Yakında bitiyor', 'value' => $c['states']['Yakında bitiyor'], 'color' => C_ORANGE],
        ['label' => 'Süresi doldu', 'value' => $c['states']['Süresi doldu'], 'color' => C_RED], ['label' => 'Askıda', 'value' => $c['states']['Askıda'], 'color' => C_SOFT], ['label' => 'Sonlandırılmış', 'value' => $c['states']['Sonlandırılmış'], 'color' => C_LINE]], 'Lisans durumu dağılımı', 'lisans') . '</section>'
        . '<section class="panel"><h2>Müşteri sayısı (12 hafta)</h2>' . chartLine($c['growth'], 'Haftalık birikimli müşteri sayısı') . '</section></div>';
    $packRows = []; foreach (PACK_NAMES as $k => $n) if (!empty($c['packs'][$k])) $packRows[] = ['label' => $n, 'value' => $c['packs'][$k]];
    $planRows = []; foreach ($c['plans'] as $n => $v2) $planRows[] = ['label' => $n, 'value' => $v2];
    $b .= '<div class="cols"><section class="panel"><h2>Genel paketler</h2>' . chartHBars($planRows) . '</section><section class="panel"><h2>Sektör ve eklenti paketleri</h2>' . chartHBars($packRows) . '</section></div>';
    $b .= '<div class="cols"><section class="panel"><h2>Yakında bitecek lisanslar</h2>';
    if ($d['expiring']) { $b .= '<table><thead><tr><th>Müşteri</th><th>Paket</th><th>Bitiş</th></tr></thead><tbody>'; foreach ($d['expiring'] as $r) $b .= '<tr><td><a href="/musteriler/' . (int) $r['id'] . '">' . e($r['company_name']) . '</a></td><td>' . e(planName(null, $r['plan_id'])) . '</td><td>' . dayOf($r['expires_at']) . '</td></tr>'; $b .= '</tbody></table>'; }
    else $b .= '<p class="muted">30 gün içinde biten lisans yok.</p>';
    $b .= '</section><section class="panel"><h2>Son açılan hesaplar</h2><table><thead><tr><th>Müşteri</th><th>Sektör</th><th>Açılış</th></tr></thead><tbody>';
    foreach ($d['recent'] as $r) $b .= '<tr><td><a href="/musteriler/' . (int) $r['id'] . '">' . e($r['company_name']) . '</a>' . ($r['is_active'] ? '' : ' ' . badge('Kapalı', 'bad')) . '</td><td>' . e($r['industry'] ?: '—') . '</td><td>' . dayOf($r['created_at']) . '</td></tr>';
    return $b . '</tbody></table></section></div>';
}

function pageCustomers(array $list, string $q, string $filter): string {
    $b = '<h1>Müşteriler</h1><form class="filters" method="get" action="/musteriler"><input name="q" type="search" value="' . e($q) . '" placeholder="Ad, e-posta, kod veya telefon" aria-label="Ara"><select name="durum" aria-label="Durum">';
    foreach (['' => 'Hepsi', 'aktif' => 'Aktif hesap', 'pasif' => 'Kapalı hesap', 'bitecek' => 'Lisansı 30 günde bitecek', 'suresi-doldu' => 'Lisansı bitmiş'] as $v => $l) $b .= '<option value="' . e($v) . '"' . ($filter === $v ? ' selected' : '') . '>' . e($l) . '</option>';
    $b .= '</select><button class="btn" type="submit">Filtrele</button></form><p class="muted">' . num(count($list)) . ' müşteri listeleniyor.</p><div class="scroll"><table><thead><tr><th>Müşteri</th><th>Paket</th><th>Eklentiler</th><th>Lisans</th><th>Bitiş</th><th class="r">Kullanıcı</th><th class="r">Cihaz</th><th class="r">Satış (30 g)</th><th>Son giriş</th></tr></thead><tbody>';
    foreach ($list as $r) {
        [$label, $kind] = licenseState($r['license_status'], $r['expires_at']);
        $b .= '<tr><td><a href="/musteriler/' . (int) $r['id'] . '">' . e($r['company_name']) . '</a>' . ($r['is_active'] ? '' : ' ' . badge('Kapalı', 'bad')) . '<small>' . e($r['tenant_code']) . ' · ' . e($r['email']) . '</small></td><td>' . e(planName($r['features'], $r['plan_id'])) . '</td><td>' . packLabels($r['packs']) . '</td><td>' . badge($label, $kind) . '</td><td>' . dayOf($r['expires_at']) . '</td><td class="r">' . num($r['users']) . '</td><td class="r">' . num($r['devices']) . '</td><td class="r">' . money($r['sales30']) . '</td><td>' . when($r['last_login']) . '</td></tr>';
    }
    return $b . '</tbody></table></div>';
}

function pageCustomer(array $c): string {
    $t = $c['tenant'];
    $b = '<p><a href="/musteriler">← Müşteriler</a></p><h1>' . e($t['company_name']) . '</h1><p class="lead">' . e($t['tenant_code']) . ' · ' . e($t['email']) . ' · ' . e($t['phone'] ?: 'telefon yok') . ($t['is_active'] ? '' : ' ' . badge('Hesap kapalı', 'bad')) . '</p><div class="stats">';
    $b .= statBox('Satış (30 gün)', money($c['sales']['total']), num($c['sales']['n']) . ' satış');
    $b .= statBox('Toplam satış', money($c['salesAll']['total']), num($c['salesAll']['n']) . ' satış · son: ' . ($c['salesAll']['last'] ? substr((string) $c['salesAll']['last'], 0, 10) : '—'));
    $b .= statBox('Ürün', num($c['products']), num(count($c['warehouses'])) . ' depo/mağaza');
    $b .= statBox('Online mağaza', $c['store'] ? ($c['store']['published'] ? 'Yayında' : 'Yayında değil') : 'Yok', $c['store'] ? '/magaza/' . $c['store']['slug'] . ' · ' . num($c['orders']['n']) . ' sipariş, ' . money($c['orders']['total']) : '');
    $b .= '</div><h2>Bilgiler</h2><table class="kv"><tbody>';
    foreach (['Sektör' => $t['industry'], 'Vergi no' => $t['tax_number'], 'Vergi dairesi' => $t['tax_office'], 'Adres' => $t['address'], 'Para birimi' => $t['currency'], 'Saat dilimi' => $t['timezone'], 'Açılış' => $t['created_at']] as $k => $v) $b .= '<tr><th>' . e($k) . '</th><td>' . e($v ?: '—') . '</td></tr>';
    $b .= '</tbody></table>';
    if (!empty($c['central'])) { $cl = $c['central']; [$cs, $ck] = licenseState($cl['status'], $cl['expires_at']); $b .= '<h2>Merkezi lisans</h2><p>' . e($cl['company']) . ' · ' . e(AUTH_PLANS[$cl['plan']] ?? $cl['plan']) . ' · ' . badge($cs, $ck) . ' · bitiş ' . dayOf($cl['expires_at']) . ' · terminal sınırı ' . num($cl['seats']) . ' · <a href="/lisanslar/' . (int) $cl['id'] . '">Lisansı yönet</a></p>'; }
    $b .= '<h2>Bulut lisans kaydı</h2>';
    if ($c['licenses']) { $b .= '<div class="scroll"><table><thead><tr><th>Paket</th><th>Durum</th><th>Bitiş</th><th class="r">Kullanıcı</th><th class="r">Depo</th><th class="r">Cihaz</th><th>Son doğrulama</th></tr></thead><tbody>'; foreach ($c['licenses'] as $l) { [$lb, $lk] = licenseState($l['status'], $l['expires_at']); $b .= '<tr><td>' . e($l['plan_name']) . '</td><td>' . badge($lb, $lk) . '</td><td>' . dayOf($l['expires_at']) . '</td><td class="r">' . num($l['max_users']) . '</td><td class="r">' . num($l['max_warehouses']) . '</td><td class="r">' . num($l['max_devices']) . '</td><td>' . when($l['last_validation_at']) . '</td></tr>'; } $b .= '</tbody></table></div>'; }
    else $b .= '<p class="muted">Lisans kaydı yok.</p>';
    $b .= '<p>Sektör ve eklenti paketleri: <b>' . ($c['packs'] ? e(implode(', ', array_map(fn($p) => PACK_NAMES[$p['pack']] ?? $p['pack'], $c['packs']))) : 'yok') . '</b></p>';
    $b .= '<h2>Çalışanlar (' . num(count($c['users'])) . ')</h2><div class="scroll"><table><thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Son giriş</th></tr></thead><tbody>';
    foreach ($c['users'] as $u) $b .= '<tr><td>' . e($u['full_name'] ?: '—') . '</td><td>' . e($u['email']) . '</td><td>' . e(ROLE_NAMES[$u['role']] ?? $u['role']) . '</td><td>' . badge($u['status'] === 'active' ? 'Aktif' : (string) $u['status'], $u['status'] === 'active' ? 'ok' : 'bad') . '</td><td>' . when($u['last_login']) . '</td></tr>';
    $b .= '</tbody></table></div><h2>Terminaller ve cihazlar (' . num(count($c['devices'])) . ')</h2>';
    if ($c['devices']) { $b .= '<table><thead><tr><th>Ad</th><th>Platform</th><th>Durum</th><th>Son görülme</th></tr></thead><tbody>'; foreach ($c['devices'] as $d) $b .= '<tr><td>' . e($d['label'] ?: 'Adsız') . '</td><td>' . e($d['platform']) . '</td><td>' . e($d['status']) . '</td><td>' . when($d['last_seen_at']) . '</td></tr>'; $b .= '</tbody></table>'; }
    else $b .= '<p class="muted">Kayıtlı kasa cihazı yok.</p>';
    $b .= '<h2>Depolar ve mağazalar</h2><table><thead><tr><th>Ad</th><th>Tür</th><th>Konum</th></tr></thead><tbody>';
    foreach ($c['warehouses'] as $w) $b .= '<tr><td>' . e($w['name']) . '</td><td>' . e($w['warehouse_type']) . '</td><td>' . e($w['location'] ?: '—') . '</td></tr>';
    $b .= '</tbody></table><h2>Faturalar</h2>';
    if ($c['invoices']) { $b .= '<table><thead><tr><th>No</th><th>Tutar</th><th>Yöntem</th><th>Durum</th><th>Tarih</th></tr></thead><tbody>'; foreach ($c['invoices'] as $i) $b .= '<tr><td>' . e($i['invoice_no']) . '</td><td>' . money($i['amount']) . '</td><td>' . e($i['payment_method']) . '</td><td>' . e($i['status']) . '</td><td>' . dayOf($i['paid_at'] ?: $i['created_at']) . '</td></tr>'; $b .= '</tbody></table>'; }
    else $b .= '<p class="muted">Fatura yok.</p>';
    $b .= '<h2>Son işlemler</h2><table><thead><tr><th>Kullanıcı</th><th>İşlem</th><th>Tür</th><th>Zaman</th></tr></thead><tbody>';
    foreach ($c['audit'] as $a) $b .= '<tr><td>' . e($a['user_email']) . '</td><td>' . e($a['action']) . '</td><td>' . e($a['entity_type']) . '</td><td>' . when($a['created_at']) . '</td></tr>';
    return $b . '</tbody></table>';
}

function pageSales(array $rows, int $days, array $rank = [], array $series = []): string {
    $b = '<h1>Satışlar</h1><p class="lead">Son ' . $days . ' gün · kasa satışları ve online mağaza siparişleri müşteri bazında. Ciro, tamamlanmış POS satışlarıdır; muhasebe cirosu değildir.</p><p class="filters2">';
    foreach ([7, 30, 90, 365] as $g) $b .= '<a class="chip' . ($g === $days ? ' on' : '') . '" href="/satislar?gun=' . $g . '">' . $g . ' gün</a>';
    $b .= '</p>';
    if ($series) $b .= '<section class="panel"><h2>Günlük satış</h2>' . chartStacked($series, 'Kasa', 'Online', 'Günlük kasa ve online ciro') . '</section>';
    if ($rank) $b .= '<div class="cols"><section class="panel"><h2>En çok kasa cirosu yapanlar</h2>' . chartHBars(array_map(fn($r) => ['label' => $r['label'], 'value' => (float) $r['v'], 'href' => '/musteriler/' . (int) $r['id']], $rank['kasa']), 'money') . '</section><section class="panel"><h2>En çok online sipariş cirosu</h2>' . chartHBars(array_map(fn($r) => ['label' => $r['label'], 'value' => (float) $r['v'], 'href' => '/musteriler/' . (int) $r['id']], $rank['online']), 'money') . '</section></div>';
    $b .= '<section class="panel"><h2>Müşteri bazında</h2><div class="scroll"><table><thead><tr><th>Müşteri</th><th class="r">Kasa satışı</th><th class="r">Kasa cirosu</th><th class="r">Online sipariş</th><th class="r">Online ciro</th></tr></thead><tbody>';
    $ts = $ta = $to = $tr = 0.0;
    foreach ($rows as $r) { $ts += $r['sales']; $ta += $r['revenue']; $to += $r['orders']; $tr += $r['online_revenue'];
        $b .= '<tr><td><a href="/musteriler/' . (int) $r['id'] . '">' . e($r['company_name']) . '</a></td><td class="r">' . num($r['sales']) . '</td><td class="r">' . money($r['revenue']) . '</td><td class="r">' . num($r['orders']) . '</td><td class="r">' . money($r['online_revenue']) . '</td></tr>'; }
    return $b . '</tbody><tfoot><tr><th>Toplam</th><th class="r">' . num($ts) . '</th><th class="r">' . money($ta) . '</th><th class="r">' . num($to) . '</th><th class="r">' . money($tr) . '</th></tr></tfoot></table></div></section>';
}

function pagePackages(array $c): string {
    $b = '<h1>Paketler</h1><p class="lead">Katalog revizyonu ' . num($c['revision']) . '. Fiyatlar KDV dahil yıllık.</p><table><thead><tr><th>Kod</th><th>Ad</th><th>Modüller</th><th class="r">Yıllık</th><th>Satışta</th></tr></thead><tbody>';
    foreach ($c['plans'] as $p) $b .= '<tr><td>' . e($p['code']) . '</td><td>' . e($p['name']) . '</td><td>' . e(implode(', ', $p['modules'] ?? [])) . '</td><td class="r">' . (isset($p['annual_cents']) && $p['annual_cents'] ? money($p['annual_cents'] / 100) : '—') . '</td><td>' . (!empty($p['available']) ? 'Evet' : 'Hayır') . '</td></tr>';
    $b .= '</tbody></table><h2>Sektör ve eklenti paketi kullanımı</h2><table><thead><tr><th>Paket</th><th class="r">Müşteri</th></tr></thead><tbody>';
    foreach (PACK_NAMES as $k => $n) $b .= '<tr><td>' . e($n) . '</td><td class="r">' . num($c['packCounts'][$k] ?? 0) . '</td></tr>';
    return $b . '</tbody></table>';
}

function pageSystem(array $s): string {
    $h = $s['health'];
    $b = '<h1>Sistem</h1><table class="kv"><tbody><tr><th>Veritabanı</th><td>' . e($s['db_version']) . '</td></tr><tr><th>Şema</th><td>' . e($s['migration']) . '</td></tr><tr><th>Tablo sayısı</th><td>' . num($s['tables']) . '</td></tr>';
    $b .= '<tr><th>Bulut uygulaması</th><td>' . ($h ? (($h['status'] ?? '') === 'ok' ? badge('Çalışıyor', 'ok') : badge((string) ($h['status'] ?? 'bilinmiyor'), 'bad')) : 'Sağlık adresi tanımlı değil') . '</td></tr>';
    if ($h && isset($h['migrations'])) $b .= '<tr><th>Bulut şeması</th><td>' . e($h['migrations']['version'] ?? '—') . ' (' . e($h['migrations']['status'] ?? '') . ')</td></tr>';
    return $b . '</tbody></table>';
}
