<?php
declare(strict_types=1);
// Lisans merkezi (api.veniux.com) veritabanı: lisans ve terminal yönetimi. Kurallar lisans merkezindeki core.php ile aynıdır
// (paket listesi, terminal sınırı, gelecek tarih, sonlandırılmış lisans değişmez). Bağlantı, yalnız gereken tablolara yetkili ayrı kullanıcıyla yapılır (authority.json).
const AUTH_PLANS = ['STARTER_ANNUAL' => 'Başlangıç', 'BUSINESS_ANNUAL' => 'İşletme', 'ENTERPRISE_ANNUAL' => 'Kurumsal'];
const AUTH_ADDONS = ['hardware' => 'Hırdavat', 'tableware' => 'Züccaciye', 'restaurant' => 'Pide ve restoran', 'online_store' => 'Online mağaza'];

function authorityConfigured(): bool { $c = privateJson('authority.json'); return is_array($c) && !empty($c['dsn']); }
function authorityDb(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = privateJson('authority.json');
    if (!$c || empty($c['dsn'])) throw new RuntimeException('Lisans merkezi veritabanı ayarı (authority.json) yok.');
    $pdo = new PDO((string) $c['dsn'], (string) ($c['user'] ?? ''), (string) ($c['password'] ?? ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    return $pdo;
}
function aRows(string $sql, array $p = []): array { $s = authorityDb()->prepare($sql); $s->execute($p); return $s->fetchAll(); }
function aOne(string $sql, array $p = []): array { return aRows($sql, $p)[0] ?? []; }
function aNow(): string { return gmdate('Y-m-d H:i:s'); }
function aAtomic(callable $fn) {
    $db = authorityDb(); $db->beginTransaction();
    try { $r = $fn(); $db->commit(); return $r; } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
function aLock(): string { return authorityDb()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''; }
function aHasExtras(): bool {
    static $has = null;
    if ($has !== null) return $has;
    try { aRows('SELECT notes, contact_email, addons FROM licenses LIMIT 1'); return $has = true; } catch (Throwable) { return $has = false; }
}
// İşlem kaydı: lisans merkezinin kendi denetim tablosu (actor 0 = yönetim sitesi) ve gerekçeyle birlikte özel günlük.
function aAudit(string $action, int $licenseId, string $reason = ''): void {
    aOne('SELECT 1');
    $s = authorityDb()->prepare('INSERT INTO audit(actor,action,subject,created_at) VALUES(?,?,?,?)'); $s->execute([0, mb_substr($action, 0, 40), (string) $licenseId, aNow()]);
    auditLine('lisans ' . $action . ' #' . $licenseId . ($reason !== '' ? ' neden=' . preg_replace('/\s+/', ' ', mb_substr($reason, 0, 200)) : ''));
}

// ---------- Doğrulamalar (lisans merkeziyle aynı kurallar) ----------
function validDay(string $day, ?int $now = null): ?DateTimeImmutable {
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $day);
    if (!$d || $d->format('Y-m-d') !== $day) return null;
    $limit = (new DateTimeImmutable('@' . ($now ?? time())));
    return $d->setTime(23, 59, 59) <= $limit ? null : $d;
}
function cleanNotes(string $s): string { return trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s)); }
// Form girdisini doğrular; hata durumunda InvalidArgumentException. Dönüş: temiz alanlar.
function checkLicenseInput(array $in, ?int $now = null): array {
    $company = trim((string) ($in['company'] ?? '')); $plan = (string) ($in['plan'] ?? ''); $seats = (int) ($in['seats'] ?? 0); $day = (string) ($in['expires'] ?? '');
    if ($company === '' || mb_strlen($company) > 120 || !isset(AUTH_PLANS[$plan]) || $seats < 1 || $seats > 1000) throw new InvalidArgumentException('Firma, paket veya terminal sınırı geçersiz.');
    $date = validDay($day, $now);
    if (!$date) throw new InvalidArgumentException('Gelecekteki geçerli bir bitiş günü seçin (YYYY-AA-GG).');
    $email = trim((string) ($in['contact_email'] ?? ''));
    if ($email !== '' && (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL))) throw new InvalidArgumentException('İletişim e-postasını kontrol edin.');
    $notes = cleanNotes((string) ($in['notes'] ?? ''));
    if (mb_strlen($notes) > 500) throw new InvalidArgumentException('Not en fazla 500 karakter olabilir.');
    $picked = $in['addons'] ?? [];
    if (!is_array($picked)) $picked = [];
    foreach ($picked as $k) if (!is_string($k) || !isset(AUTH_ADDONS[$k])) throw new InvalidArgumentException('Sektör paketi seçimi geçersiz.');
    return ['company' => $company, 'plan' => $plan, 'seats' => $seats, 'expires' => $date->format('Y-m-d') . ' 23:59:59', 'contact_email' => $email, 'notes' => $notes, 'addons' => implode(',', array_values(array_unique($picked)))];
}
function needReason(string $reason): string {
    $r = trim($reason);
    if (mb_strlen($r) < 5 || mb_strlen($r) > 300) throw new InvalidArgumentException('Gerekçe en az 5 karakter olmalı.');
    return $r;
}

// ---------- Okuma ----------
function authorityLicenses(): array {
    $extras = aHasExtras() ? ', l.notes, l.contact_email, l.addons' : ", '' AS notes, '' AS contact_email, '' AS addons";
    return aRows("SELECT l.id, l.company, l.plan, l.key_suffix, l.status, l.seats, l.expires_at, l.created_at $extras,
        (SELECT COUNT(*) FROM devices d WHERE d.license_id=l.id AND d.enabled=1) AS used,
        (SELECT MAX(d.last_seen) FROM devices d WHERE d.license_id=l.id) AS last_seen FROM licenses l ORDER BY l.id DESC LIMIT 500");
}
function authorityLicense(int $id): ?array {
    $row = aRows(authorityLicenseSql() . ' WHERE l.id=?', [$id])[0] ?? null;
    if (!$row) return null;
    $row['devices'] = aRows('SELECT id, reported_name, alias, enabled, os_info, last_seen, created_at FROM devices WHERE license_id=? ORDER BY id', [$id]);
    $row['audit'] = aRows("SELECT action, created_at FROM audit WHERE subject=? ORDER BY id DESC LIMIT 15", [(string) $id]);
    return $row;
}
function authorityLicenseSql(): string {
    $extras = aHasExtras() ? ', l.notes, l.contact_email, l.addons' : ", '' AS notes, '' AS contact_email, '' AS addons";
    return "SELECT l.id, l.company, l.plan, l.key_suffix, l.status, l.seats, l.expires_at, l.created_at $extras FROM licenses l";
}

// ---------- Yazma ----------
function issueAuthorityLicense(array $in): array {
    $c = checkLicenseInput($in);
    $key = 'VNX-' . strtoupper(bin2hex(random_bytes(24)));
    $id = aAtomic(function () use ($c, $key) {
        $db = authorityDb();
        $db->prepare('INSERT INTO licenses(company,plan,key_hash,key_suffix,status,seats,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)')->execute([$c['company'], $c['plan'], hash('sha256', $key), substr($key, -6), 'ACTIVE', $c['seats'], $c['expires'], aNow()]);
        $id = (int) $db->lastInsertId();
        if (aHasExtras()) $db->prepare('UPDATE licenses SET contact_email=?, notes=?, addons=?, updated_at=? WHERE id=?')->execute([$c['contact_email'], $c['notes'], $c['addons'], aNow(), $id]);
        return $id;
    });
    aAudit('license.created', $id, 'yeni lisans');
    return ['id' => $id, 'key' => $key];
}
function updateAuthorityLicense(int $id, array $in, string $reason): void {
    $c = checkLicenseInput($in); $reason = needReason($reason);
    aAtomic(function () use ($id, $c) {
        $row = aOne('SELECT status FROM licenses WHERE id=?' . aLock(), [$id]);
        if (!$row) throw new InvalidArgumentException('Lisans bulunamadı.');
        if ($row['status'] === 'REVOKED') throw new InvalidArgumentException('Sonlandırılmış lisans düzenlenemez.');
        $used = (int) aOne('SELECT COUNT(*) AS n FROM devices WHERE license_id=? AND enabled=1', [$id])['n'];
        if ($c['seats'] < $used) throw new InvalidArgumentException("Terminal sınırı etkin terminal sayısından ($used) az olamaz. Önce terminal kapatın.");
        $set = 'company=?,plan=?,seats=?,expires_at=?'; $vals = [$c['company'], $c['plan'], $c['seats'], $c['expires']];
        if (aHasExtras()) { $set .= ',contact_email=?,notes=?,addons=?,updated_at=?'; array_push($vals, $c['contact_email'], $c['notes'], $c['addons'], aNow()); }
        $vals[] = $id; authorityDb()->prepare("UPDATE licenses SET $set WHERE id=?")->execute($vals);
    });
    aAudit('license.updated', $id, $reason);
}
// Hızlı uzatma: bitiş günü, bugünden ya da mevcut bitişten (hangisi ileriyse) itibaren N gün ilerler.
function extendAuthorityLicense(int $id, int $days, string $reason, ?int $now = null): string {
    if (!in_array($days, [30, 90, 180, 365], true)) throw new InvalidArgumentException('Uzatma süresi geçersiz.');
    $reason = needReason($reason); $now ??= time();
    $newDay = aAtomic(function () use ($id, $days, $now) {
        $row = aOne('SELECT status, expires_at FROM licenses WHERE id=?' . aLock(), [$id]);
        if (!$row) throw new InvalidArgumentException('Lisans bulunamadı.');
        if ($row['status'] === 'REVOKED') throw new InvalidArgumentException('Sonlandırılmış lisans uzatılamaz.');
        $base = max($now, strtotime((string) $row['expires_at'] . ' UTC') ?: 0);
        $to = gmdate('Y-m-d', $base + $days * 86400) . ' 23:59:59';
        authorityDb()->prepare('UPDATE licenses SET expires_at=?' . (aHasExtras() ? ', updated_at=?' : '') . ' WHERE id=?')->execute(aHasExtras() ? [$to, aNow(), $id] : [$to, $id]);
        return $to;
    });
    aAudit('license.extended', $id, $reason . ' (+' . $days . ' gün)');
    return $newDay;
}
function setAuthorityState(int $id, string $state, string $reason): void {
    if (!in_array($state, ['ACTIVE', 'SUSPENDED', 'REVOKED'], true)) throw new InvalidArgumentException('Durum geçersiz.');
    $reason = needReason($reason);
    aAtomic(function () use ($id, $state) {
        $row = aOne('SELECT status FROM licenses WHERE id=?' . aLock(), [$id]);
        if (!$row) throw new InvalidArgumentException('Lisans bulunamadı.');
        if ($row['status'] === 'REVOKED') throw new InvalidArgumentException('Sonlandırılmış lisans yeniden açılamaz; yeni lisans düzenleyin.');
        authorityDb()->prepare('UPDATE licenses SET status=?' . (aHasExtras() ? ', updated_at=?' : '') . ' WHERE id=?')->execute(aHasExtras() ? [$state, aNow(), $id] : [$state, $id]);
    });
    aAudit('license.' . strtolower($state), $id, $reason);
}
function setAuthorityDevice(int $licenseId, int $deviceId, bool $enabled, string $reason): void {
    $reason = needReason($reason);
    aAtomic(function () use ($licenseId, $deviceId, $enabled) {
        $lic = aOne('SELECT seats, status FROM licenses WHERE id=?' . aLock(), [$licenseId]);
        $dev = aOne('SELECT enabled FROM devices WHERE id=? AND license_id=?', [$deviceId, $licenseId]);
        if (!$lic || !$dev) throw new InvalidArgumentException('Terminal bulunamadı.');
        if ($enabled && !(int) $dev['enabled']) {
            $used = (int) aOne('SELECT COUNT(*) AS n FROM devices WHERE license_id=? AND enabled=1', [$licenseId])['n'];
            if ($used >= (int) $lic['seats']) throw new InvalidArgumentException('Terminal sınırına ulaşıldı; önce başka bir terminali kapatın ya da sınırı artırın.');
        }
        authorityDb()->prepare('UPDATE devices SET enabled=? WHERE id=?')->execute([$enabled ? 1 : 0, $deviceId]);
    });
    aAudit($enabled ? 'device.enabled' : 'device.disabled', $licenseId, 'terminal #' . $deviceId . ' ' . $reason);
}
