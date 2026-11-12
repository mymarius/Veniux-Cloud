import { useEffect } from 'react';
import api from '../../api/client';
import { readSessionUser } from '../../lib/sessionUser';

const KEY = 'veniux-fcm-registered';

// Android uygulaması: Firebase token'ını sunucuya kaydeder, böylece uygulama kapalıyken de bildirim gelir.
// Yalnız bulut hesabında ve sunucu FCM'i yapılandırmışsa çalışır; aksi halde sessizce hiçbir şey yapmaz.
export default function useFcmRegistration() {
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.VeniuxAndroid : null;
    if (!bridge || typeof bridge.fcmToken !== 'function') return undefined;
    let stopped = false, timer, tries = 0;
    const attempt = async () => {
      if (stopped) return;
      try {
        if (typeof bridge.isCloud === 'function' && !bridge.isCloud()) return; // yerel bilgisayar eşleşmesi: sunucu FCM kullanmaz
        const token = bridge.fcmToken();
        if (!token) { bridge.requestFcmToken(); if (++tries < 12) timer = setTimeout(attempt, 5000); return; }
        const user = readSessionUser(), marker = String(user.id ?? user.userId ?? '') + ':' + token;
        let seen = null; try { seen = localStorage.getItem(KEY); } catch { /* depolama yok */ }
        if (seen === marker) return;
        if (!(await api.get('/push/fcm')).data.configured) return;
        await api.post('/push/fcm', { token });
        try { localStorage.setItem(KEY, marker); } catch { /* depolama yok */ }
      } catch { if (++tries < 12 && !stopped) timer = setTimeout(attempt, 30000); }
    };
    attempt();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
}

// Çıkış yaparken bu cihazın kaydı silinir: çıkış yapmış kullanıcıya bildirim gitmesin. En iyi çaba, sonucu beklenmez.
export async function unregisterFcm() {
  try {
    const bridge = window.VeniuxAndroid;
    const token = bridge && typeof bridge.fcmToken === 'function' ? bridge.fcmToken() : '';
    if (token) await Promise.race([api.delete('/push/fcm', { data: { token } }), new Promise(resolve => setTimeout(resolve, 2500))]);
    localStorage.removeItem(KEY);
  } catch { /* çıkış engellenmez */ }
}
