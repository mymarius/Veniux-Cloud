<?php
declare(strict_types=1);
// Havale ve fatura: bekleyen faturalar, dekontla onay, yanlış faturayı geri alma, yeni fatura kesme. Tüm yazma işlemleri bulutta imzalı istekle yapılır.

function pageBankTransfers(array $d): string {
    $b = '<h1>Havale ve fatura</h1><p class="lead">Havalesi hesaba geçen müşterinin faturasını dekont numarasıyla onaylayın; lisans bu anda açılır ve uzar. Her işlem gerekçe ister ve denetim kaydına düşer.</p>' . flashHtml();
    if (!empty($d['bank'])) $b .= '<p class="note-ok">Havale hesabı: <b>' . e($d['bank']['account_name']) . '</b> · ' . e($d['bank']['iban']) . '</p>';
    else $b .= '<p class="err">Havale bilgileri bulutta tanımlı değil (BANK_IBAN ve BANK_ACCOUNT_NAME). Fatura kesilemez.</p>';
    $b .= '<h2>Bekleyen faturalar (' . num(count($d['pending'])) . ')</h2>';
    if (!$d['pending']) $b .= '<p class="muted">Bekleyen havale faturası yok.</p>';
    else {
        $b .= '<section class="panel flush"><div class="scroll"><table><thead><tr><th>Firma</th><th>Fatura</th><th class="r">Tutar</th><th>Kesilme</th><th>Onay</th></tr></thead><tbody>';
        foreach ($d['pending'] as $i) {
            $act = '/havale/' . (int) $i['tenant_id'] . '/' . (int) $i['license_id'] . '/' . (int) $i['id'];
            $b .= '<tr><td>' . e($i['company_name']) . '</td><td>' . e($i['invoice_no']) . '</td><td class="r">' . e(number_format((float) $i['amount'], 2, ',', '.')) . ' ' . e($i['currency']) . '</td><td>' . when((string) $i['created_at']) . '</td><td>'
                . '<form class="inline" method="post" action="' . $act . '/onay">' . csrfField() . '<input name="reference" placeholder="Dekont / işlem no" required minlength="3" maxlength="100"><input name="amount" placeholder="Tutar" required size="9" value="' . e((string) $i['amount']) . '"><input name="reason" placeholder="Gerekçe" required minlength="5" maxlength="300" value="Havale hesapta görüldü"><button class="btn" type="submit">Onayla</button></form>'
                . '<form class="inline" method="post" action="' . $act . '/iptal" onsubmit="return confirm(\'Bu fatura geri alınsın mı?\')">' . csrfField() . '<input name="reason" placeholder="Geri alma gerekçesi" required minlength="5" maxlength="300"><button class="btn ghost" type="submit">Geri al</button></form></td></tr>';
        }
        $b .= '</tbody></table></div></section>';
    }
    $b .= '<h2>Yeni havale faturası</h2><form class="form" method="post" action="/havale/fatura">' . csrfField() . '<label>Lisans<select name="license" required>';
    foreach ($d['licenses'] as $l) $b .= '<option value="' . (int) $l['tenant_id'] . ':' . (int) $l['id'] . '">' . e($l['company_name']) . ' · ' . e($l['plan_id']) . ' · ' . e($l['status']) . '</option>';
    $b .= '</select></label><label>Tutar (örn. 14388,00)<input name="amount" required inputmode="decimal"></label><label>Para birimi<select name="currency"><option>TRY</option><option>USD</option><option>EUR</option></select></label>'
        . '<label>Gerekçe<input name="reason" required minlength="5" maxlength="300" value="Yıllık lisans faturası"></label><button class="btn" type="submit">Fatura kes</button></form>';
    return $b;
}
