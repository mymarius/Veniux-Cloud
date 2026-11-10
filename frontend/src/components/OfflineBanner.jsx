import { useEffect, useState } from 'react';
import { pendingWarning } from '../lib/offline/offlineQueue.mjs';

// Kasada bağlantı durumu ve bekleyen çevrimdışı satışlar. Satışlar sunucu işledi diyene kadar bu cihazda saklanır.
// Gönderim sonucu (işlenen satış, stok açığı) kuyruk boşalsa da "Tamam" denene kadar görünür; stok açığı mesajı kaçırılmamalı.
export default function OfflineBanner({ offline }) {
  const { online, counts, flushing, catalog, lastSummary } = offline;
  const [seen, setSeen] = useState(null), [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const wait = counts.pending > 0 ? pendingWarning(counts.oldestPendingAt, now) : { level: 'none', hours: 0 };
  const notice = Boolean(lastSummary && (lastSummary.sent > 0 || lastSummary.shortfalls > 0) && seen !== lastSummary);
  if (online && counts.total === 0 && !notice) return null;
  return <div role="status" className="pos-offline-banner border rounded p-3 text-sm space-y-1" style={{ background: online ? '#fff8e6' : '#fdecea', borderColor: online ? '#e0b84c' : '#b42318' }}>
    {!online && <p><b>Çevrimdışı.</b> Satışlar bu cihazda saklanıyor; bağlantı gelince kendiliğinden gönderilecek. Yalnız nakit ve kart satış yapılabilir; indirim, iade, veresiye ve sadakat kapalıdır.{!catalog.ready && ' Ürün listesi bu cihaza indirilmemiş: barkod okutulamaz.'}</p>}
    {counts.pending > 0 && <p><b>{counts.pending}</b> satış gönderilmeyi bekliyor. Bu cihazın tarayıcı verisini temizlemeyin.</p>}
    {wait.level !== 'none' && <p role={wait.level === 'notice' ? 'status' : 'alert'}>{wait.level === 'critical' ? <b>En eski satış {wait.hours} saattir gönderilemedi; bu satışlar cihazda kaybolabilir. Bağlantıyı denetleyin veya yöneticiye bildirin.</b> : <>En eski satış <b>{wait.hours} saattir</b> bekliyor.{wait.level === 'alert' ? ' Bağlantıyı denetleyin.' : ''}</>}</p>}
    {counts.conflict > 0 && <p role="alert"><b>{counts.conflict}</b> satış sunucu tarafından kabul edilmedi ve cihazda duruyor (müdüre bildirin).</p>}
    {online && counts.pending > 0 && <button type="button" className="btn-soft" disabled={flushing} onClick={offline.flush}>{flushing ? 'Gönderiliyor…' : 'Şimdi gönder'}</button>}
    {notice && lastSummary.sent > 0 && <p>{lastSummary.sent} satış sunucuya işlendi.</p>}
    {notice && lastSummary.shortfalls > 0 && <p role="alert"><b>{lastSummary.shortfalls}</b> üründe stok açığı oluştu; satışlar kaydedildi, stok eksiye düşmedi. Müdür Ayarlar &gt; Barkod okuyucular ve kasa &gt; Çevrimdışı uyuşmazlıklar bölümünden kontrol etmeli.</p>}
    {notice && counts.total === 0 && <button type="button" className="btn-soft" onClick={() => setSeen(lastSummary)}>Tamam</button>}
  </div>;
}
