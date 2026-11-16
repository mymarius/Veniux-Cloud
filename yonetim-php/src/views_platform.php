<?php
declare(strict_types=1);
// Atama: işletmelere sektör paketi hakkı verme ve (sözleşmesiz) lisans atama. Programdaki platform ekranlarının yönetim sitesindeki karşılığı.
// Tüm yazma işlemleri bulutta imzalı istekle yapılır, gerekçe ister ve denetim kaydına düşer.

function pageAssign(array $packs, array $plans): string {
    $labels = $packs['labels'] ?? [];
    $b = '<h1>Atama</h1><p class="lead">İşletmelere sektör paketi hakkı verin veya lisans atayın. Her işlem gerekçe ister ve denetim kaydına yazılır.</p>' . flashHtml();
    $b .= '<h2>Sektör paketleri</h2><section class="panel flush"><div class="scroll"><table><thead><tr><th>İşletme</th><th>Paketler</th><th>Gerekçe</th><th></th></tr></thead><tbody>';
    foreach ($packs['tenants'] ?? [] as $t) {
        $id = (int) $t['id'];
        $b .= '<tr><td>' . e($t['company_name']) . '<small>#' . $id . '</small></td><td><form class="inline" method="post" action="/atama/paket/' . $id . '" id="pk' . $id . '">' . csrfField();
        foreach ($packs['packs'] ?? [] as $p) $b .= '<label class="chk"><input type="checkbox" name="packs[]" value="' . e($p) . '"' . (in_array($p, $t['packs'] ?? [], true) ? ' checked' : '') . '> ' . e($labels[$p] ?? $p) . '</label>';
        $b .= '</form></td><td><input form="pk' . $id . '" name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300"></td><td><button class="btn" form="pk' . $id . '" type="submit">Kaydet</button></td></tr>';
    }
    if (empty($packs['tenants'])) $b .= '<tr><td colspan="4" class="muted">İşletme yok.</td></tr>';
    $b .= '</tbody></table></div></section>';
    $b .= '<h2>Lisans ata</h2><p class="muted">Seçilen işletmenin etkin lisansı iptal edilir, yerine yeni lisans açılır.</p><form class="form" method="post" action="/atama/lisans">' . csrfField() . '<label>İşletme<select name="tenant" required>';
    foreach ($packs['tenants'] ?? [] as $t) $b .= '<option value="' . (int) $t['id'] . '">' . e($t['company_name']) . ' (#' . (int) $t['id'] . ')</option>';
    $b .= '</select></label><label>Paket<select name="plan" required>';
    foreach ($plans as $p) $b .= '<option value="' . e($p['id']) . '">' . e($p['name']) . '</option>';
    $b .= '</select></label><label>Süre (gün, 1–366)<input name="days" type="number" min="1" max="366" value="365" required></label>'
        . '<label>Gerekçe<input name="reason" required minlength="5" maxlength="300"></label>'
        . '<label class="chk"><input type="checkbox" name="confirm" value="EVET" required> Mevcut etkin lisansın iptal edileceğini onaylıyorum</label><button class="btn" type="submit">Lisansı ata</button></form>';
    return $b;
}
