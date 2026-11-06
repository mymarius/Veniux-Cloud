import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, X } from 'lucide-react';
import apiClient from '../api/client';
import { speechChunks } from '../lib/speechChunks';
import { speakOnDevice, stopDeviceSpeech } from '../lib/deviceSpeech.mjs';

const OFF_KEY = 'veniux-welcome-off';
const safeGet = (store, key) => { try { return store.getItem(key); } catch { return null; } };
const safeSet = (store, key, value) => { try { store.setItem(key, value); } catch { /* yalnız kolaylık */ } };

// Açılışta sahibine kayıtlı durumu okur. Yalnız bilgi verir, hiçbir kaydı değiştirmez.
export default function OwnerWelcome({ userId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const run = useRef(0);
  const audio = useRef(null);

  function stop() {
    run.current += 1;
    audio.current?.pause();
    audio.current = null;
    stopDeviceSpeech();
    setSpeaking(false);
  }

  async function speak(text) {
    stop();
    const mine = ++run.current;
    setSpeaking(true);
    setVoiceNote('');
    try {
      for (const chunk of speechChunks(text)) {
        const { data: blob } = await apiClient.post('/ai/speech', { text: chunk, profile: 'google-soft' }, { responseType: 'blob', timeout: 55000 });
        if (mine !== run.current) return;
        const url = URL.createObjectURL(blob);
        try {
          await new Promise((resolve, reject) => {
            const player = new Audio(url);
            audio.current = player;
            player.onended = resolve;
            player.onpause = resolve;
            player.onerror = reject;
            player.play().catch(reject);
          });
        } finally { URL.revokeObjectURL(url); }
        if (mine !== run.current) return;
      }
    } catch (error) {
      if (mine !== run.current) return;
      // Tarayıcı kullanıcı dokunmadan sesi engellediyse düğme yeterli; cihaz sesini zorlamayız.
      if (error?.name === 'NotAllowedError') setVoiceNote('Dinlemek için hoparlör düğmesine basın.');
      else {
        try { await speakOnDevice(text); }
        catch { if (mine === run.current) setVoiceNote('Ses şu anda kullanılamıyor.'); }
      }
    }
    if (mine === run.current) setSpeaking(false);
  }

  useEffect(() => {
    if (!userId || safeGet(localStorage, OFF_KEY) === '1') return undefined;
    const sessionKey = `veniux-welcome-shown-${userId}`, seenKey = `veniux-welcome-seen-${userId}`;
    if (safeGet(sessionStorage, sessionKey)) return undefined;
    let active = true;
    const since = safeGet(localStorage, seenKey);
    apiClient.get('/ai/briefing', { params: since ? { since } : {} }).then(({ data: next }) => {
      if (!active) return;
      safeSet(sessionStorage, sessionKey, '1');
      safeSet(localStorage, seenKey, new Date().toISOString());
      setData(next);
      speak(next.speech);
    }).catch(() => { /* Yetkisi olmayan rollerde karşılama görünmez. */ });
    return () => { active = false; stop(); };
  }, [userId]);

  if (!data) return null;
  const close = () => { stop(); setData(null); };
  const go = path => { close(); navigate(path); };

  return (
    <div className="vx-welcome-wrap" role="dialog" aria-modal="true" aria-labelledby="vx-welcome-title" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
      <section className="vx-welcome">
        <header>
          <h2 id="vx-welcome-title">{data.greeting}</h2>
          <button type="button" autoFocus className="vx-welcome-x" aria-label="Kapat" onClick={close}><X aria-hidden="true" /></button>
        </header>
        <ul>{data.lines.map(line => <li key={line}>{line}</li>)}</ul>
        {voiceNote && <p role="status" className="vx-welcome-note">{voiceNote}</p>}
        <footer>
          <button type="button" onClick={() => (speaking ? stop() : speak(data.speech))}>
            {speaking ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}{speaking ? 'Sustur' : 'Dinle'}
          </button>
          {data.facts.alerts > 0 && <button type="button" onClick={() => go('/alerts')}>Uyarılara git</button>}
          <button type="button" onClick={() => go('/ai-assistant')}>Asistana sor</button>
          <button type="button" className="is-primary" onClick={close}>Tamam</button>
        </footer>
        <label className="vx-welcome-off">
          <input type="checkbox" onChange={e => safeSet(localStorage, OFF_KEY, e.target.checked ? '1' : '0')} />
          Açılışta gösterme
        </label>
      </section>
    </div>
  );
}
