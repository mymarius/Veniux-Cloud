// Sayımda istisna ile sayım ve onay özeti. Saf fonksiyonlar; stok yazmaz.
import { countKey } from './countScan.mjs';

// İstisna: sayılmamış satırlar. Sayılmayan satır "sıfır" değil, "bu turda sayılmadı"dır; stok değişmez, onaya gitmez.
export function exceptionReport(rows, counts) {
  const countable = rows.filter(r => r.product_id);
  const counted = [], uncounted = [];
  for (const row of countable) {
    const v = counts[countKey(row)];
    (v === '' || v === undefined || v === null ? uncounted : counted).push(row);
  }
  return { total: countable.length, counted, uncounted, complete: countable.length > 0 && !uncounted.length };
}

const q = n => Number(Number(n).toFixed(6));

// Onay bekleyen sayımlar için özet: fark yok / fazla / eksik, net fark, en büyük 5 fark.
export function approvalSummary(reviews) {
  const lines = (reviews || []).map(r => ({ ...r, diff: q(Number(r.counted_qty) - Number(r.system_qty)) })).filter(r => Number.isFinite(r.diff));
  const surplus = lines.filter(r => r.diff > 0), shortage = lines.filter(r => r.diff < 0), match = lines.filter(r => r.diff === 0);
  return {
    lines: lines.length, match: match.length, surplus: surplus.length, shortage: shortage.length,
    surplusQty: q(surplus.reduce((s, r) => s + r.diff, 0)), shortageQty: q(shortage.reduce((s, r) => s + r.diff, 0)),
    net: q(lines.reduce((s, r) => s + r.diff, 0)),
    largest: lines.filter(r => r.diff !== 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)
  };
}
