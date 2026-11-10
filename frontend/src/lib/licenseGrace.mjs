// Ağ kesintisinde lisans kararı. Kasa çevrimdışı satış yaparken lisans denetimi sunucuya ulaşamadığı için kullanıcıyı
// etkinleştirme ekranına atmamalı. Kural: oturum zaten lisanslı doğrulanmışsa ve son BAŞARILI doğrulamadan beri
// 24 saat geçmediyse, yalnızca ağ hatasında (sunucudan hiçbir cevap yok) lisans korunur.
// Sunucu cevap verip lisansı reddederse (iptal, süre, cihaz) hiçbir koşulda korunmaz. Satışlar yine sunucuda doğrulanır.
export const OUTAGE_GRACE_MS = 24 * 3600000;

export function holdLicenseDuringOutage({ error, licensedBefore, lastGoodAt, now = Date.now(), graceMs = OUTAGE_GRACE_MS }) {
  if (!licensedBefore) return false;
  if (!error || error.response) return false;                // sunucu cevap verdiyse ağ kesintisi değildir
  if (!Number.isFinite(lastGoodAt) || lastGoodAt <= 0) return false;
  const age = now - lastGoodAt;
  return age >= 0 && age < graceMs;
}
