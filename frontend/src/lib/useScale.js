import { useCallback, useEffect, useRef, useState } from 'react';
import { MODELS, LineFramer, parseScaleLine } from '../../../shared/scaleProtocols.mjs';

const KEY = 'veniux_scale';
const readPrefs = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { model: MODELS[v.model] ? v.model : 'generic', baud: Number(v.baud) || MODELS[MODELS[v.model] ? v.model : 'generic'].baud }; }
  catch { return { model: 'generic', baud: 9600 }; }
};
const savePrefs = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* tarayıcı depolaması kapalı olabilir */ } };

// Terazi seri portunu Web Serial ile okur. Son çerçeve: { weight, unit, stable, timestamp } ya da null.
// Bağlantıyı kullanıcı kurar (tarayıcı kuralı); sonraki açılışlarda daha önce izin verilen port kendiliğinden bağlanır.
export function useScale() {
  const [prefs, setPrefsState] = useState(readPrefs);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState('Terazi bağlı değil');
  const [error, setError] = useState('');
  const resource = useRef(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.serial && (typeof window === 'undefined' || window.isSecureContext);

  const setPrefs = useCallback(next => { setPrefsState(old => { const merged = { ...old, ...next }; savePrefs(merged); return merged; }); }, []);

  const disconnect = useCallback(async () => {
    const r = resource.current; resource.current = null;
    await r?.close();
    setFrame(null); setStatus('Terazi bağlı değil');
  }, []);

  const open = useCallback(async (port, config) => {
    const model = MODELS[config.model] || MODELS.generic;
    let closed = false, reader, writer, timer;
    const framer = new LineFramer(line => {
      const parsed = parseScaleLine(config.model, line);
      if (parsed) setFrame({ ...parsed, timestamp: Date.now() });
    });
    const close = async () => {
      closed = true; clearInterval(timer); framer.reset();
      try { await reader?.cancel(); } catch { /* zaten kapalı */ }
      try { writer?.releaseLock(); } catch { /* zaten kapalı */ }
      try { await port.close(); } catch { /* zaten kapalı */ }
    };
    await port.open({ baudRate: config.baud, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    resource.current = { close };
    setStatus('Terazi bağlı'); setError('');
    if (model.request) {
      writer = port.writable.getWriter();
      const bytes = new TextEncoder().encode(model.request);
      timer = setInterval(() => { writer.write(bytes).catch(() => {}); }, model.pollMs || 300);
    }
    reader = port.readable.getReader();
    const decoder = new TextDecoder();
    (async () => {
      try {
        while (!closed) { const { value, done } = await reader.read(); if (done) break; framer.feed(decoder.decode(value, { stream: true })); }
      } catch { if (!closed) setError('Terazi bağlantısı koptu. Kabloyu kontrol edip yeniden bağlayın.'); }
      finally { if (!closed) { await close(); resource.current = null; setFrame(null); setStatus('Terazi bağlı değil'); } }
    })();
  }, []);

  const connect = useCallback(async () => {
    setError('');
    if (!supported) { setError('Bu ortamda seri port erişimi yok. Windows programını veya Chrome/Edge kullanın.'); return; }
    try { await disconnect(); const port = await navigator.serial.requestPort(); await open(port, prefs); }
    catch (e) { if (e?.name !== 'NotFoundError') setError('Terazi bağlanamadı. Port başka bir programda açık olabilir.'); }
  }, [supported, prefs, open, disconnect]);

  // Daha önce izin verilmiş tek port varsa kendiliğinden bağlan.
  useEffect(() => {
    let live = true;
    if (!supported) return undefined;
    navigator.serial.getPorts().then(ports => { if (live && ports.length === 1 && !resource.current) open(ports[0], readPrefs()).catch(() => {}); }).catch(() => {});
    return () => { live = false; resource.current?.close(); resource.current = null; };
  }, [supported, open]);

  const connected = status === 'Terazi bağlı';
  return { supported, prefs, setPrefs, frame, status, connected, error, connect, disconnect };
}
