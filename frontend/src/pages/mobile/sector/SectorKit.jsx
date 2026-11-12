import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import api from '../../../api/client';
import { useSectorPacks } from '../../../lib/useSectorPacks';
import { disablePush, enablePush, getPushState, sendTestPush } from '../../../lib/pushClient';
import '../mobile-hub.css';
import { SUPPORT_URL } from '../mobileKit';

export const usePacks = useSectorPacks;

export const PACK_TITLES = { hardware: 'Hırdavat paketi', tableware: 'Züccaciye paketi', restaurant: 'Pide ve restoran paketi' };

// Paket yoksa ekran açılmaz; satın alma için iletişime yönlendirir.
export function PackGate({ pack, children }) {
  const packs = usePacks();
  if (!packs) return <div className="vm-body" style={{ marginTop: 0 }}><p role="status" className="vm-note">Yükleniyor…</p></div>;
  if (!packs[pack]) return <div className="vm-body" style={{ marginTop: 0, paddingTop: 18 }}>
    <section className="vm-card" role="alert"><Lock size={24} />
      <h2 style={{ fontSize: 17, margin: '10px 0 6px' }}>{PACK_TITLES[pack]} etkin değil</h2>
      <p className="vm-note" style={{ marginBottom: 12 }}>Bu özellik ayrı bir pakettir. Hesabınıza eklenmesi için bize ulaşın; her paketin kendi fiyatı vardır.</p>
      <a className="vm-btn" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Paketi öğren</a></section>
  </div>;
  return children;
}

export function errorText(e, fallback) { return e?.response?.data?.error || fallback; }

// İki tonlu kısa bip (mutfak ve esnaf uyarısı). Kullanıcı etkileşimi öncesi tarayıcı sesi engelleyebilir; sessizce yok sayılır.
let audioContext = null;
export function beep(times = 2) {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioContext; if (ctx.state === 'suspended') ctx.resume();
    for (let i = 0; i < times; i++) {
      const start = ctx.currentTime + i * 0.32, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(i % 2 ? 880 : 1175, start);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain).connect(ctx.destination); osc.start(start); osc.stop(start + 0.3);
    }
  } catch { /* ses yok */ }
}

// Telefon bildirimi: izin verilmişse sistem bildirimi, ayrıca titreşim. Uygulama açıkken çalışır.
export function notify(title, body) {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* yok say */ }
  // Android uygulaması (WebView): web bildirimi yok, telefonun kendi bildirim sistemi kullanılır.
  try { const bridge = window.VeniuxAndroid; if (bridge?.showNotification && bridge.canNotify?.()) { bridge.showNotification(String(title || 'Veniux'), String(body || '')); return; } } catch { /* yok say */ }
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag: 'veniux-sector' }); } catch { /* yok say */ }
}

function NativeNotify({ bridge }) {
  const [granted, setGranted] = useState(() => { try { return Boolean(bridge.canNotify()); } catch { return false; } }), [message, setMessage] = useState('');
  const ask = () => {
    setMessage('');
    try { bridge.requestNotify(); } catch { /* yok say */ }
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1; let ok = false;
      try { ok = Boolean(bridge.canNotify()); } catch { /* yok say */ }
      if (ok || tries > 20) { clearInterval(timer); setGranted(ok); if (!ok) setMessage('Bildirim izni verilmedi. Telefonun Ayarlar > Uygulamalar > Veniux > Bildirimler bölümünden açabilirsiniz.'); }
    }, 500);
  };
  if (granted) return <div><p className="vm-note">Telefon bildirimleri açık: uygulama açıkken yeni ve kritik stok uyarıları telefon bildirimi olarak gelir.</p>
    <button type="button" className="vm-btn soft" onClick={() => { notify('Veniux deneme', 'Bildirimler çalışıyor.'); setMessage('Deneme bildirimi gönderildi.'); }}>Deneme gönder</button>{message && <p role="status" className="vm-note">{message}</p>}</div>;
  return <div><p className="vm-note">Uygulama açıkken yeni ve kritik stok uyarılarını telefon bildirimi olarak almak için izin verin.</p>
    <button type="button" className="vm-btn soft" onClick={ask}>Bildirimlere izin ver</button>{message && <p role="alert" className="vm-err">{message}</p>}</div>;
}

export function NotifyButton() {
  const [state, setState] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const refresh = async () => setState(await getPushState());
  useEffect(() => { refresh(); }, []);
  const run = async (fn, ok) => { setBusy(true); setMessage(''); try { await fn(); setMessage(ok || ''); } catch (e) { setMessage(errorText(e, e.message || 'İşlem başarısız.')); } finally { setBusy(false); await refresh(); } };
  const nativeBridge = typeof window !== 'undefined' ? window.VeniuxAndroid : null;
  if (nativeBridge?.showNotification) return <NativeNotify bridge={nativeBridge} />;
  if (!state) return null;
  if (state.status === 'unsupported') return <p className="vm-note">{state.reason} Uygulama açıkken uyarılar ekranda ve titreşimle gelir.</p>;
  if (state.status === 'blocked') return <p className="vm-note">Bildirim izni kapalı. Tarayıcı ayarlarından Veniux için bildirime izin verin.</p>;
  if (state.status === 'on') return <div><p className="vm-note">Telefon bildirimleri açık: uygulama kapalıyken de uyarı gelir.</p>
    <div style={{ display: 'flex', gap: 10 }}><button type="button" className="vm-btn soft" disabled={busy} onClick={() => run(async () => { await sendTestPush(); }, 'Deneme bildirimi gönderildi.')}>Deneme gönder</button>
      <button type="button" className="vm-btn ghost" disabled={busy} onClick={() => run(disablePush, 'Bildirimler kapatıldı.')}>Kapat</button></div>{message && <p role="status" className="vm-note">{message}</p>}</div>;
  return <div><button type="button" className="vm-btn soft" disabled={busy} onClick={() => run(enablePush, 'Bildirimler açıldı.')}>Telefon bildirimlerini aç</button>{message && <p role="alert" className="vm-err">{message}</p>}</div>;
}

// Belirli aralıkla yoklar; sekme gizliyken durur. fn her turda çağrılır, hata sessiz yutulur.
export function usePolling(fn, ms, enabled = true) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false, timer;
    const tick = async () => { if (stopped) return; if (!document.hidden) { try { await ref.current(); } catch { /* sonraki turda yeniden */ } } timer = setTimeout(tick, ms); };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [ms, enabled]);
}

export function useAsync(load, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const reload = useCallback(async () => {
    try { setState(s => ({ ...s, loading: true, error: '' })); setState({ loading: false, data: await load(), error: '' }); }
    catch (e) { setState({ loading: false, data: null, error: errorText(e, 'Yüklenemedi.') }); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export const SectorLink = ({ to, children }) => <Link to={to} className="vm-btn ghost" style={{ marginTop: 10 }}>{children}</Link>;
