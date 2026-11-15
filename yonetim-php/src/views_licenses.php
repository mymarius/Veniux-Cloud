<?php
declare(strict_types=1);

function flashSet(string $kind, string $msg): void { $_SESSION['flash'] = [$kind, $msg]; }
function flashHtml(): string {
    if (empty($_SESSION['flash'])) return '';
    [$k, $m] = $_SESSION['flash']; unset($_SESSION['flash']);
    return '<p class="' . ($k === 'ok' ? 'note-ok' : 'err') . '" role="status">' . e($m) . '</p>';
}
function csrfField(): string { return '<input type="hidden" name="csrf" value="' . e(csrfToken()) . '">'; }
function addonChecks(string $csv): string {
    $have = array_filter(explode(',', $csv)); $o = '<fieldset><legend>Sektör ve eklenti paketleri</legend>';
    foreach (AUTH_ADDONS as $k => $n) $o .= '<label class="chk"><input type="checkbox" name="addons[]" value="' . e($k) . '"' . (in_array($k, $have, true) ? ' checked' : '') . '> ' . e($n) . '</label>';
    return $o . '</fieldset>';
}
function planSelect(string $cur): string {
    $o = '<select name="plan" required>'; foreach (AUTH_PLANS as $k => $n) $o .= '<option value="' . e($k) . '"' . ($cur === $k ? ' selected' : '') . '>' . e($n) . ' (' . e($k) . ')</option>';
    return $o . '</select>';
}
function licenseFields(array $l = []): string {
    return '<label>Firma<input name="company" value="' . e($l['company'] ?? '') . '" maxlength="120" required></label>'
        . '<label>Paket' . planSelect((string) ($l['plan'] ?? 'BUSINESS_ANNUAL')) . '</label>'
        . '<label>Terminal sınırı<input name="seats" type="number" min="1" max="1000" value="' . e($l['seats'] ?? 3) . '" required></label>'
        . '<label>Bitiş günü (YYYY-AA-GG)<input name="expires" value="' . e(isset($l['expires_at']) ? substr((string) $l['expires_at'], 0, 10) : gmdate('Y-m-d', time() + 365 * 86400)) . '" pattern="\d{4}-\d{2}-\d{2}" required></label>'
        . '<label>İletişim e-postası<input name="contact_email" type="email" value="' . e($l['contact_email'] ?? '') . '" maxlength="254"></label>'
        . '<label>Not (en çok 500 karakter)<textarea name="notes" maxlength="500" rows="3">' . e($l['notes'] ?? '') . '</textarea></label>'
        . addonChecks((string) ($l['addons'] ?? ''));
}
function authState(array $l): array { return licenseState($l['status'], $l['expires_at']); }

function pageLicenses(array $list): string {
    $b = '<h1>Lisanslar</h1><p class="lead">Lisans merkezindeki (api.veniux.com) gerçek lisans kayıtları. Terminal ve paket sınırları buradan belirlenir.</p><p><a class="btn" href="/lisanslar/yeni">Yeni lisans oluştur</a></p>' . flashHtml()
        . '<div class="scroll"><table><thead><tr><th>Firma</th><th>Paket</th><th>Eklentiler</th><th>Durum</th><th>Bitiş</th><th class="r">Terminal</th><th>Son görülme</th><th>Anahtar</th></tr></thead><tbody>';
    foreach ($list as $l) { [$s, $k] = authState($l);
        $b .= '<tr><td><a href="/lisanslar/' . (int) $l['id'] . '">' . e($l['company']) . '</a><small>' . e($l['contact_email'] ?: '') . '</small></td><td>' . e(AUTH_PLANS[$l['plan']] ?? $l['plan']) . '</td><td>' . packLabels($l['addons']) . '</td><td>' . badge($s, $k) . '</td><td>' . dayOf($l['expires_at']) . '</td><td class="r">' . num($l['used']) . ' / ' . num($l['seats']) . '</td><td>' . when($l['last_seen']) . '</td><td>…' . e($l['key_suffix']) . '</td></tr>'; }
    return $b . '</tbody></table></div>';
}
function pageLicenseNew(string $error = ''): string {
    return '<p><a href="/lisanslar">← Lisanslar</a></p><h1>Yeni lisans</h1>' . ($error !== '' ? '<p class="err" role="alert">' . e($error) . '</p>' : '') . '<form class="form" method="post" action="/lisanslar/yeni">' . csrfField() . licenseFields() . '<button class="btn" type="submit">Lisansı oluştur</button></form><p class="muted">Lisans anahtarı oluşturulunca yalnızca bir kez gösterilir; sunucuda yalnızca özeti saklanır.</p>';
}
function pageLicenseKey(array $r, string $company): string {
    return '<h1>Lisans oluşturuldu</h1><p class="lead">' . e($company) . ' için anahtar. <b>Bu anahtar yalnızca şimdi görünür</b>; kopyalayıp müşteriye güvenli bir yolla ilet.</p><p class="key">' . e($r['key']) . '</p><p><a href="/lisanslar/' . (int) $r['id'] . '">Lisansa git</a> · <a href="/lisanslar">Lisanslar</a></p>';
}
function pageLicense(array $l): string {
    [$s, $k] = authState($l); $id = (int) $l['id'];
    $b = '<p><a href="/lisanslar">← Lisanslar</a></p><h1>' . e($l['company']) . '</h1><p class="lead">Lisans #' . $id . ' · anahtar …' . e($l['key_suffix']) . ' · ' . badge($s, $k) . ' · bitiş ' . dayOf($l['expires_at']) . '</p>' . flashHtml();
    if ($l['status'] !== 'REVOKED') {
        $b .= '<h2>Hızlı uzat</h2><form class="inline" method="post" action="/lisanslar/' . $id . '/uzat">' . csrfField() . '<select name="days" aria-label="Süre"><option value="30">+30 gün</option><option value="90">+90 gün</option><option value="180">+180 gün</option><option value="365" selected>+365 gün</option></select><input name="reason" placeholder="Gerekçe (örn. yıllık yenileme, havale alındı)" required minlength="5" maxlength="300"><button class="btn" type="submit">Uzat</button></form>';
        $b .= '<h2>Bilgileri düzenle</h2><form class="form" method="post" action="/lisanslar/' . $id . '/duzenle">' . csrfField() . licenseFields($l) . '<label>Gerekçe<input name="reason" required minlength="5" maxlength="300" placeholder="Neden değiştiriyorsun?"></label><button class="btn" type="submit">Kaydet</button></form>';
        $b .= '<h2>Durum</h2><div class="inline">';
        if ($l['status'] === 'ACTIVE') $b .= '<form class="inline" method="post" action="/lisanslar/' . $id . '/durum">' . csrfField() . '<input type="hidden" name="state" value="SUSPENDED"><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"><button class="btn ghost" type="submit">Askıya al</button></form>';
        else $b .= '<form class="inline" method="post" action="/lisanslar/' . $id . '/durum">' . csrfField() . '<input type="hidden" name="state" value="ACTIVE"><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"><button class="btn" type="submit">Yeniden etkinleştir</button></form>';
        $b .= '</div><h2>Sonlandır (geri alınamaz)</h2><form class="inline" method="post" action="/lisanslar/' . $id . '/durum">' . csrfField() . '<input type="hidden" name="state" value="REVOKED"><input name="confirm" placeholder="Onay için SONLANDIR yaz" required pattern="SONLANDIR"><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"><button class="btn danger" type="submit">Lisansı sonlandır</button></form>';
    } else $b .= '<p class="err">Bu lisans sonlandırılmış; değiştirilemez.</p>';
    $b .= '<h2>Terminaller (' . num(count($l['devices'])) . ' / sınır ' . num($l['seats']) . ')</h2>';
    if ($l['devices']) { $b .= '<div class="scroll"><table><thead><tr><th>Ad</th><th>Cihaz adı</th><th>Sistem</th><th>Durum</th><th>Son görülme</th><th></th></tr></thead><tbody>';
        foreach ($l['devices'] as $d) { $on = (int) $d['enabled'] === 1;
            $b .= '<tr><td>' . e($d['alias']) . '</td><td>' . e($d['reported_name']) . '</td><td>' . e($d['os_info'] ?: '—') . '</td><td>' . badge($on ? 'Açık' : 'Kapalı', $on ? 'ok' : 'bad') . '</td><td>' . when($d['last_seen']) . '</td><td>' . ($l['status'] === 'REVOKED' ? '' : '<form class="inline" method="post" action="/lisanslar/' . $id . '/terminal">' . csrfField() . '<input type="hidden" name="device" value="' . (int) $d['id'] . '"><input type="hidden" name="enabled" value="' . ($on ? '0' : '1') . '"><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"><button class="btn ghost" type="submit">' . ($on ? 'Kapat' : 'Aç') . '</button></form>') . '</td></tr>'; }
        $b .= '</tbody></table></div>'; }
    else $b .= '<p class="muted">Henüz etkinleştirilmiş terminal yok.</p>';
    $b .= '<h2>Not ve iletişim</h2><p>' . e($l['contact_email'] ?: 'e-posta yok') . '</p><p>' . nl2br(e($l['notes'] ?: 'Not yok.')) . '</p><h2>Son işlemler</h2><table><tbody>';
    foreach ($l['audit'] as $a) $b .= '<tr><td>' . e($a['action']) . '</td><td>' . when($a['created_at']) . '</td></tr>';
    return $b . '</tbody></table>';
}
