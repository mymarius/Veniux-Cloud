import { formatMoney } from '../../../shared/money.mjs';
import { useEffect, useState } from 'react';
import { DISPLAY_CHANNEL, readLastDisplay } from '../lib/customerDisplay.mjs';
import './CustomerDisplay.css';

const money = v => formatMoney(Number(v || 0));

// Müşteri ekranı: ikinci monitörde tam ekran açılır; okutulan ürünler, adetler ve toplam müşteriye görünür.
export default function CustomerDisplay() {
  const [snap, setSnap] = useState(() => readLastDisplay());
  useEffect(() => {
    document.title = 'Müşteri ekranı';
    let ch;
    try { ch = new BroadcastChannel(DISPLAY_CHANNEL); ch.onmessage = e => setSnap(e.data); } catch { /* kanal yoksa yoklama devreye girer */ }
    const poll = setInterval(() => setSnap(s => { const l = readLastDisplay(); return l && (!s || l.at > s.at) ? l : s; }), 1500);
    return () => { if (ch) ch.close(); clearInterval(poll); };
  }, []);
  const lines = snap?.lines || [];
  const done = snap?.status === 'done';
  return <main className="cd-screen">
    <header><b>{snap?.business || 'Hoş geldiniz'}</b></header>
    {done ? <section className="cd-done"><h1>Teşekkür ederiz</h1><p>Ödenen tutar</p><strong>{money(snap.total)}</strong></section>
      : lines.length === 0 ? <section className="cd-done"><h1>Hoş geldiniz</h1><p>Ürünleriniz okutuldukça burada görünecek.</p></section>
        : <><ul className="cd-lines">{[...lines].reverse().map((l, i) => <li key={lines.length - i} className={i === 0 ? 'last' : ''}><span className="n">{l.name}</span><span className="q">{l.qty} × {money(l.unit)}</span><b>{money(l.total)}</b></li>)}</ul>
          <footer>{(snap.discount > 0 || snap.cut > 0) && <small>İndirim {money(snap.discount + snap.cut)}</small>}<span>Toplam</span><strong>{money(snap.total)}</strong></footer></>}
  </main>;
}
