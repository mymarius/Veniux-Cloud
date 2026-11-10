// Kasada bağlantı durumu ve bekleyen çevrimdışı satışlar. Satışlar sunucu işledi diyene kadar bu cihazda saklanır.
export default function OfflineBanner({ offline }) {
  const { online, counts, flushing, catalog, lastSummary } = offline;
  if (online && counts.total === 0) return null;
  return <div role="status" className="border rounded p-3 text-sm space-y-1" style={{ background: online ? '#fff8e6' : '#fdecea', borderColor: online ? '#e0b84c' : '#b42318' }}>
    {!online && <p><b>Çevrimdışı.</b> Satışlar bu cihazda saklanıyor; bağlantı gelince kendiliğinden gönderilecek. Yalnız nakit ve kart satış yapılabilir; indirim, iade, veresiye ve sadakat kapalıdır.{!catalog.ready && ' Ürün listesi bu cihaza indirilmemiş: barkod okutulamaz.'}</p>}
    {counts.pending > 0 && <p><b>{counts.pending}</b> satış gönderilmeyi bekliyor. Bu cihazın tarayıcı verisini temizlemeyin.</p>}
    {counts.conflict > 0 && <p role="alert"><b>{counts.conflict}</b> satış sunucu tarafından kabul edilmedi ve cihazda duruyor (müdüre bildirin).</p>}
    {online && counts.pending > 0 && <button type="button" className="btn-soft" disabled={flushing} onClick={offline.flush}>{flushing ? 'Gönderiliyor…' : 'Şimdi gönder'}</button>}
    {lastSummary && lastSummary.sent > 0 && <p>{lastSummary.sent} satış sunucuya işlendi.</p>}
  </div>;
}
