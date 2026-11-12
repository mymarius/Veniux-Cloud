import { useEffect, useRef } from 'react';
import api from '../../api/client';
import { asList } from '../../lib/stockAnalytics';
import { openAlerts, unseenAlerts } from '../../lib/alerts.mjs';
import { notify } from './sector/SectorKit';

const KEY = 'veniux-seen-alerts';
const readSeen = () => { try { const raw = localStorage.getItem(KEY); return raw === null ? null : new Set(JSON.parse(raw)); } catch { return null; } };
const writeSeen = set => { try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-300))); } catch { /* depolama yok */ } };

// Açık uyarıları dakikada bir yoklar (ekran görünürken): sayıyı onCount'a verir, yeni gelen uyarılar için telefon bildirimi gönderir.
// Bu cihazda ilk turda mevcut uyarılar "görüldü" sayılır; geçmiş uyarılar için bildirim yağmaz.
export default function useAlertWatcher(onCount, ms = 60000) {
  const callback = useRef(onCount); callback.current = onCount;
  useEffect(() => {
    let stopped = false, timer;
    const tick = async () => {
      if (stopped) return;
      if (!document.hidden) {
        try {
          const list = asList((await api.get('/alerts')).data), open = openAlerts(list), seen = readSeen();
          if (stopped) return;
          callback.current(open.length, open);
          if (seen) unseenAlerts(list, seen).slice(0, 3).forEach(alert => notify(alert.title || 'Stok uyarısı', alert.message || alert.description || ''));
          writeSeen(new Set([...(seen || []), ...open.map(alert => String(alert.id))]));
        } catch { /* sonraki turda yeniden denenir */ }
      }
      timer = setTimeout(tick, ms);
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }, [ms]);
}
