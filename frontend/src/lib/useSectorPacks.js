import { useEffect, useState } from 'react';
import api from '../api/client';

// Hangi sektör paketleri (hırdavat, züccaciye, pide/restoran) açık? Oturum başına bir kez sorulur.
let packsCache = null;
export function useSectorPacks() {
  const token = localStorage.getItem('token') || '';
  const [packs, setPacks] = useState(() => (packsCache?.token === token ? packsCache.value : null));
  useEffect(() => {
    if (!token) return undefined;
    if (packsCache?.token === token) { setPacks(packsCache.value); return undefined; }
    let live = true;
    api.get('/sector/packs/me').then(r => { packsCache = { token, value: r.data.packs }; if (live) setPacks(r.data.packs); })
      .catch(() => { if (live) setPacks({ hardware: false, tableware: false, restaurant: false }); });
    return () => { live = false; };
  }, [token]);
  return packs;
}
