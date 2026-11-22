import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { playBeep } from '../utils/sound';
import { feedbackFor, tally } from '../lib/serialScan.mjs';

// Seri okutma kutusu: Enter ya da Tab ile biten okutmayı onScan'e verir, kutu sürekli odakta kalır.
// onScan(code, cfg) -> serialScan.scanIntoLines sonucu (status: added | incremented | notfound | empty).
// Okuyucu ayarlarındaki ön/son ek (Ayarlar › Barkod okuyucu) cfg ile iletilir.
export default function SerialScanInput({ onScan, id = 'serial-scan', label = 'Barkod okutun', hint = 'Okutunca ürün eklenir; aynı ürünü tekrar okutunca adet artar.', disabled = false }) {
  const [value, setValue] = useState('');
  const [cfg, setCfg] = useState({});
  const [last, setLast] = useState(null);
  const [stats, setStats] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    let live = true;
    api.get('/scanner/settings').then(r => { if (live) setCfg({ prefix: r.data?.prefix || '', suffix: r.data?.suffix || '' }); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const submit = async raw => {
    if (!String(raw).trim()) return;
    setValue('');
    const result = await onScan(raw, cfg); // eşzamansız tarama (sunucuda ürün arama) da desteklenir
    const fb = feedbackFor(result);
    if (result.status !== 'empty') {
      playBeep(fb.beep);
      try { navigator.vibrate?.(fb.vibrate); } catch { /* titreşim yok */ }
      setLast(fb);
      setStats(prev => tally(prev, result));
    }
    setValue('');
    input.current?.focus({ preventScroll: true });
  };

  const onKey = event => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      if (!value.trim()) { if (event.key === 'Enter') event.preventDefault(); return; }
      event.preventDefault();
      submit(value);
    }
  };

  return (
    <div className="vx-scan-add" data-testid="serial-scan">
      <label htmlFor={id}>{label}</label>
      <input
        ref={input}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoFocus
        disabled={disabled}
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={onKey}
        onBlur={event => { if (!disabled && !event.relatedTarget && document.activeElement === document.body) setTimeout(() => input.current?.focus({ preventScroll: true }), 0); }}
        className={last?.tone === 'error' ? 'border-red-500 ring-1 ring-red-400' : ''}
        placeholder={hint}
      />
      {last && <p role={last.tone === 'error' ? 'alert' : 'status'} data-testid="serial-scan-status" className={'text-sm font-semibold mt-1 ' + (last.tone === 'error' ? 'text-red-700' : 'text-emerald-700')}>{last.text}</p>}
      {stats && <p className="text-xs text-slate-500 mt-1">{stats.total} okutma · {stats.added} yeni · {stats.incremented} adet artışı{stats.notfound ? <span className="text-red-700"> · {stats.notfound} tanınmadı</span> : null}</p>}
    </div>
  );
}
