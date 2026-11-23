<?php
declare(strict_types=1);
// Panel lisansları ile lisans merkezi (api.veniux.com) arasındaki köprü.
// Panelde ödenen/yenilenen/askıya alınan lisans, merkezin veritabanında aynı anda oluşur/güncellenir; böylece
// müşterinin panelde gördüğü VNX- anahtarı programda gerçekten etkinleşir. Merkezde anahtarın yalnız SHA-256 özeti durur,
// bu yüzden anahtar panelde saklanır. Bağlantı ayarı: <veri klasörü>/authority.json  {"dsn":"mysql:host=...;dbname=...;charset=utf8mb4","user":"...","password":"..."}
// Ayar yoksa köprü kapalıdır ve panel eskisi gibi çalışır (anahtarlar programda etkinleşmez).

const VP_AUTH_PLAN = ['lite' => 'STARTER_ANNUAL', 'pro' => 'BUSINESS_ANNUAL', 'lifetime_desktop' => 'BUSINESS_ANNUAL', 'business_wms' => 'ENTERPRISE_ANNUAL', 'pro_3m' => 'BUSINESS_ANNUAL', 'business_wms_3m' => 'ENTERPRISE_ANNUAL'];

function vp_authority_config(): ?array {
    static $c = false;
    if ($c !== false) return $c;
    $f = vp_data_dir() . '/authority.json';
    $j = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    return $c = (is_array($j) && !empty($j['dsn'])) ? $j : null;
}
function vp_authority_configured(): bool { return vp_authority_config() !== null; }

function vp_authority_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = vp_authority_config();
    if (!$c) throw new RuntimeException('authority.json yok');
    $pdo = new PDO((string) $c['dsn'], (string) ($c['user'] ?? ''), (string) ($c['password'] ?? ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    return $pdo;
}
function vp_authority_extras(): bool {
    static $has = null;
    if ($has !== null) return $has;
    try { vp_authority_db()->query('SELECT notes, contact_email FROM licenses LIMIT 1'); return $has = true; } catch (Throwable) { return $has = false; }
}
function vp_authority_audit(string $action, int $id, string $why): void {
    try { vp_authority_db()->prepare('INSERT INTO audit(actor,action,subject,created_at) VALUES(?,?,?,?)')->execute([0, mb_substr($action, 0, 40), (string) $id, gmdate('Y-m-d H:i:s')]); } catch (Throwable) { /* denetim yazılamazsa lisans işlemi bozulmasın */ }
    error_log('[veniux-panel] lisans merkezi ' . $action . ' #' . $id . ' ' . $why);
}

/** Panel lisansının merkezdeki karşılığı: [plan, terminal sayısı, bitiş, durum]. */
function vp_authority_shape(array $l): array {
    $code = (string) vp_val('SELECT code FROM products WHERE id=?', [$l['product_id']]);
    $plan = VP_AUTH_PLAN[$code] ?? 'BUSINESS_ANNUAL';
    $seats = $l['device_limit'] !== null ? max(1, (int) $l['device_limit']) : 50;
    $exp = $l['expires_at'] ?: gmdate('Y-m-d H:i:s', strtotime('+50 years')); // ömür boyu / süresiz
    $state = match ($l['status']) { 'iptal' => 'REVOKED', 'askida', 'bekliyor' => 'SUSPENDED', default => 'ACTIVE' };
    return [$plan, $seats, $exp, $state];
}

/** Merkezde yeni lisans açar, anahtarı panel lisansına yazar. Yapılandırma yoksa ya da zaten açılmışsa hiçbir şey yapmaz. */
function vp_authority_issue(int $lid): bool {
    if (!vp_authority_configured()) return false;
    $l = vp_row('SELECT * FROM licenses WHERE id=?', [$lid]);
    if (!$l || $l['authority_id']) return false;
    $cl = vp_row('SELECT company,email FROM clients WHERE id=?', [$l['client_id']]) ?: ['company' => '', 'email' => ''];
    [$plan, $seats, $exp, $state] = vp_authority_shape($l);
    $key = 'VNX-' . strtoupper(bin2hex(random_bytes(24)));
    try {
        $db = vp_authority_db();
        $db->beginTransaction();
        $db->prepare('INSERT INTO licenses(company,plan,key_hash,key_suffix,status,seats,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
            ->execute([mb_substr((string) ($cl['company'] ?: $cl['email']), 0, 120), $plan, hash('sha256', $key), substr($key, -6), $state, $seats, $exp, gmdate('Y-m-d H:i:s')]);
        $aid = (int) $db->lastInsertId();
        if (vp_authority_extras()) $db->prepare('UPDATE licenses SET contact_email=?, notes=?, updated_at=? WHERE id=?')->execute([mb_substr((string) $cl['email'], 0, 254), 'Panel lisansı #' . $lid, gmdate('Y-m-d H:i:s'), $aid]);
        $db->commit();
    } catch (Throwable $t) {
        if (isset($db) && $db->inTransaction()) $db->rollBack();
        error_log('[veniux-panel] lisans merkezi açılamadı #' . $lid . ': ' . $t->getMessage());
        return false;
    }
    vp_update('licenses', $lid, ['license_key' => $key, 'authority_id' => $aid, 'authority_hash' => sha1($plan . $seats . $exp . $state)]);
    vp_authority_audit('license.created', $aid, 'panel lisansı #' . $lid);
    // Ödemeden sonra merkez geç açıldıysa (ilk deneme başarısız, cron açtı) müşteriye bildirim şimdi gider; tekrar gönderilmez (dedupe).
    if (function_exists('vp_notify_license') && vp_val("SELECT 1 FROM orders WHERE license_id=? AND kind='yeni' AND status='onaylandi'", [$lid])) {
        try { vp_notify_license('license_activated', $lid, ['dedupe' => 'lic:' . $lid]); } catch (Throwable $t) { error_log('[veniux-panel] lisans bildirimi: ' . $t->getMessage()); }
    }
    return true;
}

/** Panel lisansının güncel halini merkeze yazar (paket, terminal sayısı, bitiş, durum). Değişiklik yoksa merkeze dokunmaz. */
function vp_authority_sync(int $lid): bool {
    if (!vp_authority_configured()) return false;
    $l = vp_row('SELECT * FROM licenses WHERE id=?', [$lid]);
    if (!$l) return false;
    if (!$l['authority_id']) return $l['status'] === 'bekliyor' ? false : vp_authority_issue($lid);
    [$plan, $seats, $exp, $state] = vp_authority_shape($l);
    $hash = sha1($plan . $seats . $exp . $state);
    if ($hash === (string) $l['authority_hash']) return true;
    try {
        $db = vp_authority_db();
        $row = $db->prepare('SELECT status FROM licenses WHERE id=?');
        $row->execute([(int) $l['authority_id']]);
        $cur = $row->fetch();
        if (!$cur) throw new RuntimeException('merkezde lisans yok');
        if ($cur['status'] === 'REVOKED') { vp_update('licenses', $lid, ['authority_hash' => $hash]); return true; } // sonlandırılmış lisans merkezde değişmez
        $used = (int) $db->query('SELECT COUNT(*) FROM devices WHERE license_id=' . (int) $l['authority_id'] . ' AND enabled=1')->fetchColumn();
        $db->prepare('UPDATE licenses SET plan=?, seats=?, expires_at=?, status=?' . (vp_authority_extras() ? ', updated_at=?' : '') . ' WHERE id=?')
            ->execute(array_merge([$plan, max($seats, $used), $exp, $state], vp_authority_extras() ? [gmdate('Y-m-d H:i:s')] : [], [(int) $l['authority_id']]));
    } catch (Throwable $t) {
        error_log('[veniux-panel] lisans merkezi güncellenemedi #' . $lid . ': ' . $t->getMessage());
        return false;
    }
    vp_update('licenses', $lid, ['authority_hash' => $hash]);
    vp_authority_audit('license.updated', (int) $l['authority_id'], 'panel eşitlemesi ' . $state);
    return true;
}

/** Cihaz kayıtlarını sıfırlar: merkezdeki terminal kayıtları silinir, program yeni cihazda yeniden etkinleştirilebilir. */
function vp_authority_reset_devices(int $lid): bool {
    if (!vp_authority_configured()) return false;
    $aid = (int) vp_val('SELECT authority_id FROM licenses WHERE id=?', [$lid]);
    if (!$aid) return false;
    try { vp_authority_db()->prepare('DELETE FROM devices WHERE license_id=?')->execute([$aid]); }
    catch (Throwable $t) { error_log('[veniux-panel] terminal sıfırlanamadı #' . $lid . ': ' . $t->getMessage()); return false; }
    vp_authority_audit('device.reset', $aid, 'panelden cihaz sıfırlama');
    return true;
}

/** Cron/otomasyon: merkeze hiç açılmamış ve değişmiş lisansları eşitler. Dönüş: eşitlenen sayısı. */
function vp_authority_sync_all(): int {
    if (!vp_authority_configured()) return 0;
    $n = 0;
    foreach (vp_all("SELECT id FROM licenses WHERE status<>'bekliyor' ORDER BY id") as $r) if (vp_authority_sync((int) $r['id'])) $n++;
    return $n;
}
