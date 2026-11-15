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
    $nav = ['/' => 'Pano', '/yonetim' => 'Yönetim', '/musteriler' => 'Müşteriler', '/lisanslar' => 'Lisanslar', '/satislar' => 'Satışlar', '/paketler' => 'Paketler', '/sistem' => 'Sistem'];
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . e($title) . ' | Veniux Yönetim</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/console.css?v=' . assetVersion() . '"></head><body>';
    echo '<a class="skip" href="#icerik">İçeriğe geç</a><header class="top"><div class="wrap nav"><div class="brandwrap"><a class="brand" href="/" aria-label="Veniux ana sayfa (pano)"><img src="/assets/logo-40-v1.webp" srcset="/assets/logo-40-v1.webp 1x, /assets/logo-80-v1.webp 2x" alt="" width="28" height="28"><span>Veniux</span></a><a class="brand-sub" href="/yonetim">yönetim</a></div><nav aria-label="Ana menü">';
    foreach ($nav as $href => $label) echo '<a href="' . $href . '"' . ($active === $href ? ' aria-current="page"' : '') . '>' . e($label) . '</a>';
    echo '</nav><form method="post" action="/cikis" class="out"><input type="hidden" name="csrf" value="' . e(csrfToken()) . '"><button class="link" type="submit">Çıkış</button></form></div></header>' . $strip;
    echo '<main id="icerik" class="wrap">' . $body . '</main><footer class="wrap foot"><div>' . barcodeSvg('yonetim-' . $title, 26) . '</div><p>Bu sayfa yalnızca Veniux sahibine açıktır. Müşteri verileri bulut veritabanından salt okunur çekilir; lisans işlemleri lisans merkezine yazılır ve kayda geçer.</p></footer></body></html>';
}

function statBox(string $label, string $value, string $note = '', string $tone = ''): string {
    return '<div class="tag' . ($tone ? ' tag-' . e($tone) : '') . '"><span class="k">VENIUX · ' . e(mb_strtoupper($label)) . '</span><b>' . e($value) . '</b>' . ($note !== '' ? '<small>' . e($note) . '</small>' : '') . '</div>';
}

function pageLogin(string $error = ''): void {
    $form = '<form method="post" action="/giris" autocomplete="off"><input type="hidden" name="csrf" value="' . e(csrfToken()) . '">'
        . '<label for="f-mail">E-posta</label><input id="f-mail" name="email" type="email" required autocomplete="username" autofocus>'
        . '<label for="f-pass">Parola</label><input id="f-pass" name="password" type="password" required autocomplete="current-password">'
        . '<label for="f-code">Doğrulama kodu</label><input id="f-code" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6" required autocomplete="one-time-code" placeholder="6 haneli kod" aria-describedby="f-help">'
        . '<p id="f-help" class="help">Authenticator uygulamasındaki 6 haneli kod. Kod 30 saniyede bir değişir.</p>'
        . '<button class="btn wide" type="submit">Giriş yap</button></form>';
    $b = '<div class="gate"><aside class="gate-brand" aria-hidden="false"><div class="gate-top"><img src="/assets/logo-hero-240-v2.webp" srcset="/assets/logo-hero-240-v2.webp 1x, /assets/logo-hero-420-v2.webp 2x" alt="Veniux" width="120" height="120"><span class="gate-name">Veniux</span></div>'
        . '<h1>Yönetim<br>merkezi.</h1><p class="gate-lead">Müşteriler, lisanslar, paketler ve satışlar tek yerde. Yalnızca Veniux sahibi içindir.</p>'
        . '<div class="gate-label" role="img" aria-label="Raf etiketi: Veniux yönetim, erişim kısıtlı"><span>VENIUX · YÖNETİM</span><b>Erişim kısıtlı</b><small>Parola + doğrulama kodu</small>' . barcodeSvg('yonetim-giris', 30) . '</div></aside>'
        . '<section class="gate-card"><h2>Giriş yap</h2>' . ($error !== '' ? '<p class="err" role="alert">' . e($error) . '</p>' : '') . $form
        . '<ul class="gate-notes"><li>Her giriş denemesi kaydedilir.</li><li>5 hatalı denemeden sonra 15 dakika engellenirsin.</li><li>Oturum 30 dakika işlem yapılmazsa kapanır.</li></ul></section></div>';
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Giriş | Veniux Yönetim</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/console.css?v=' . assetVersion() . '"></head><body class="gate-page"><main>' . $b . '</main></body></html>';
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
    $now = gmdate('Y-m-d H:i:s'); $in30 = gmdate('Y-m-d H:i:s', time() + 30 * 86400); $act = $soon = $none = 0;
    foreach ($list as $r) { if (!$r['license_status']) { $none++; continue; } if ($r['license_status'] === 'ACTIVE' && $r['expires_at'] > $now) { if ($r['expires_at'] <= $in30) $soon++; else $act++; } }
    $b = '<h1>Müşteriler</h1><div class="tags small">' . statBox('Listelenen', num(count($list))) . statBox('Lisansı aktif', num($act)) . statBox('Yakında bitiyor', num($soon), '', $soon ? 'warn' : '') . statBox('Lisansı yok', num($none), '', $none ? 'bad' : '') . '</div>';
    $b .= '<form class="filters" method="get" action="/musteriler"><input name="q" type="search" value="' . e($q) . '" placeholder="Ad, e-posta, kod veya telefon" aria-label="Ara"><select name="durum" aria-label="Durum">';
    foreach (['' => 'Hepsi', 'aktif' => 'Aktif hesap', 'pasif' => 'Kapalı hesap', 'bitecek' => 'Lisansı 30 günde bitecek', 'suresi-doldu' => 'Lisansı bitmiş'] as $val => $l) $b .= '<option value="' . e($val) . '"' . ($filter === $val ? ' selected' : '') . '>' . e($l) . '</option>';
    $b .= '</select><button class="btn" type="submit">Filtrele</button></form><section class="panel flush"><div class="scroll"><table><thead><tr><th>Müşteri</th><th>Paket</th><th>Eklentiler</th><th>Lisans</th><th>Bitiş</th><th class="r">Kullanıcı</th><th class="r">Cihaz</th><th class="r">Satış (30 g)</th><th>Son giriş</th></tr></thead><tbody>';
    foreach ($list as $r) {
        [$label, $kind] = licenseState($r['license_status'], $r['expires_at']);
        $b .= '<tr><td><div class="who"><span class="av" aria-hidden="true">' . e(mb_strtoupper(mb_substr(trim((string) preg_replace("/^(\\[[^\\]]*\\]|Veniux Demo\\s*[–-]\\s*)/u", '', (string) $r['company_name'])) ?: (string) $r['company_name'], 0, 1))) . '</span><div><a href="/musteriler/' . (int) $r['id'] . '">' . e($r['company_name']) . '</a>' . ($r['is_active'] ? '' : ' ' . badge('Kapalı', 'bad')) . '<small>' . e($r['email']) . '</small></div></div></td><td>' . e(planName($r['features'], $r['plan_id'])) . '</td><td>' . packLabels($r['packs']) . '</td><td>' . badge($label, $kind) . '</td><td>' . dayOf($r['expires_at']) . '</td><td class="r">' . num($r['users']) . '</td><td class="r">' . num($r['devices']) . '</td><td class="r">' . money($r['sales30']) . '</td><td>' . when($r['last_login']) . '</td></tr>';
    }
    return $b . '</tbody></table></div></section>';
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
    $isSector = fn($p) => (bool) array_intersect($p['modules'] ?? [], ['hardware', 'tableware', 'restaurant', 'online_store']);
    $card = function (array $p, string $usage = '') {
        $price = !empty($p['annual_cents']) ? money($p['annual_cents'] / 100) : 'Teklifle';
        $mods = ''; foreach ($p['modules'] ?? [] as $m) $mods .= '<span class="chip2">' . e($m) . '</span>';
        return '<article class="tag' . (empty($p['available']) ? ' tag-bad' : '') . '"><span class="k">' . e($p['code']) . '</span><h3>' . e($p['name']) . '</h3><b>' . $price . '</b><small>' . (!empty($p['annual_cents']) ? 'yıllık · KDV dahil' : 'Fiyat, web sitesindeki tekliften belirlenir') . '</small><div class="chips">' . $mods . '</div><div class="foot2">' . (!empty($p['available']) ? badge('Satışta', 'ok') : badge('Kapalı', 'bad')) . ($usage !== '' ? '<span>' . e($usage) . '</span>' : '') . '</div></article>';
    };
    $b = '<h1>Paketler</h1><p class="lead">Katalog revizyonu ' . num($c['revision']) . ' · ' . num(count($c['plans'])) . ' paket. Fiyatlar yıllık ve KDV dahildir.</p><h2>Sektör ve eklenti paketleri</h2><div class="tags">';
    foreach ($c['plans'] as $p) if ($isSector($p)) { $key = array_intersect($p['modules'], array_keys(PACK_NAMES)); $k = $key ? reset($key) : ''; $b .= $card($p, $k ? num($c['packCounts'][$k] ?? 0) . ' müşteri' : ''); }
    $b .= '</div><h2>Genel paketler</h2><div class="tags">';
    foreach ($c['plans'] as $p) if (!$isSector($p)) $b .= $card($p);
    return $b . '</div>';
}

function pageSystem(array $s): string {
    $h = $s['health']; $ok = $h && ($h['status'] ?? '') === 'ok';
    $b = '<h1>Sistem</h1><p class="lead">Bulut uygulaması, veritabanları ve lisans merkezi durumu.</p><div class="tags">';
    $b .= statBox('Bulut uygulaması', $ok ? 'Çalışıyor' : ($h ? (string) ($h['status'] ?? 'bilinmiyor') : 'Tanımsız'), $ok ? 'app.veniux.com sağlık kontrolü geçti' : 'Sağlık adresi yanıt vermedi', $ok ? '' : 'bad');
    $b .= statBox('Bulut şeması', $h && isset($h['migrations']['version']) ? substr((string) $h['migrations']['version'], 0, 3) : '—', ($h['migrations']['version'] ?? '') . ' · ' . ($h['migrations']['status'] ?? ''));
    $b .= statBox('Veritabanı', num($s['tables']) . ' tablo', $s['db_version']);
    $a = $s['authority']; $b .= statBox('Lisans merkezi', $a ? ($a['ok'] ? 'Bağlı' : 'Hata') : 'Tanımsız', $a && $a['ok'] ? num($a['licenses']) . ' lisans kaydı okundu' : 'authority.json yok ya da bağlanamadı', $a && $a['ok'] ? '' : 'bad');
    $b .= statBox('Yönetim sitesi', 'PHP ' . $s['php'], 'Sunucu saati ' . $s['time']);
    return $b . '</div>';
}

// ---------- Yönetim merkezi ----------
function actionCard(string $title, string $text, string $href = '', string $cta = '', bool $soon = false): string {
    $body = '<h3>' . e($title) . '</h3><p>' . e($text) . '</p>';
    if ($soon) return '<div class="act soon"><span class="k">YAKINDA</span>' . $body . '</div>';
    return '<div class="act"><span class="k">İŞLEM</span>' . $body . '<a class="btn" href="' . e($href) . '">' . e($cta) . '</a></div>';
}
function pageManage(array $due, array $stuck, bool $authority): string {
    $b = '<h1>Yönetim</h1><p class="lead">Lisans, paket ve hesap işlemleri. Her işlem gerekçe ister ve denetim kaydına geçer.</p>' . flashHtml();
    if (!$authority) return $b . '<p class="err">Lisans merkezi veritabanı (authority.json) tanımlı değil.</p>';
    $b .= '<div class="acts">'
        . actionCard('Yeni lisans oluştur', 'Yeni müşteriye anahtar üret: paket, terminal sınırı, bitiş günü ve sektör paketleri.', '/lisanslar/yeni', 'Lisans oluştur')
        . actionCard('Tüm lisanslar', 'Paket değiştir, terminal sınırını ayarla, askıya al ya da sonlandır.', '/lisanslar', 'Lisansları aç')
        . actionCard('Satışlar ve müşteriler', 'Müşteri bazında kasa ve online ciro, çalışan ve terminal sayıları.', '/satislar', 'Satışlara git')
        . actionCard('Hesap açma / kapatma', 'Bir müşterinin bulut hesabına erişimi kapatıp açma.', '', '', true)
        . actionCard('Paket fiyatları', 'Katalogdaki yıllık fiyatları ve satışa açık/kapalı durumunu düzenleme.', '', '', true)
        . actionCard('Sürüm yayınlama', 'Windows ve Android sürümlerini yayınlama ve geri alma.', '', '', true) . '</div>';
    $b .= '<section class="panel"><h2>Yenileme bekleyenler</h2><p class="muted">Süresi 30 gün içinde bitecek ya da bitmiş etkin lisanslar. Hızlı uzatma için gerekçe yaz ve süreyi seç.</p>';
    if (!$due) $b .= '<p class="muted">Şu an yenileme bekleyen lisans yok.</p>';
    else {
        $b .= '<div class="scroll"><table><thead><tr><th>Firma</th><th>Paket</th><th>Bitiş</th><th>Durum</th><th>Uzat</th></tr></thead><tbody>';
        foreach ($due as $l) { [$s, $k] = licenseState($l['status'], $l['expires_at']); $id = (int) $l['id'];
            $b .= '<tr><td><a href="/lisanslar/' . $id . '">' . e($l['company']) . '</a><small>' . e($l['contact_email'] ?: '') . '</small></td><td>' . e(AUTH_PLANS[$l['plan']] ?? $l['plan']) . '</td><td>' . dayOf($l['expires_at']) . '</td><td>' . badge($s, $k) . '</td><td><form class="inline" method="post" action="/lisanslar/' . $id . '/uzat">' . csrfField() . '<input type="hidden" name="back" value="yonetim"><select name="days" aria-label="Süre"><option value="30">+30 gün</option><option value="90">+90 gün</option><option value="180">+180 gün</option><option value="365" selected>+365 gün</option></select><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"><button class="btn ghost" type="submit">Uzat</button></form></td></tr>'; }
        $b .= '</tbody></table></div>';
    }
    $b .= '</section>';
    if ($stuck) { $b .= '<section class="panel"><h2>Askıdaki lisanslar</h2><table><thead><tr><th>Firma</th><th>Paket</th><th>Bitiş</th><th></th></tr></thead><tbody>'; foreach ($stuck as $l) $b .= '<tr><td>' . e($l['company']) . '</td><td>' . e(AUTH_PLANS[$l['plan']] ?? $l['plan']) . '</td><td>' . dayOf($l['expires_at']) . '</td><td><a class="btn ghost" href="/lisanslar/' . (int) $l['id'] . '">Aç</a></td></tr>'; $b .= '</tbody></table></section>'; }
    return $b;
}
