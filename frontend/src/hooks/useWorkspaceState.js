import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

export function useWorkspaceState(scope, keys) {
  const initial = Object.fromEntries(keys.map(key => [key, []]));
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(initial);
  const revision = useRef(0);
  const ready = useRef(false);
  const queue = useRef(Promise.resolve(true));
  const epoch = useRef(0);
  const pending = useRef(0);
  const load = useCallback(async () => {
    ready.current = false; setLoading(true);
    try {
      const response = await api.get(`/workspaces/${scope}`);
      current.current = response.data.data; revision.current = response.data.revision;
      setData(current.current); ready.current = true;
    } catch (err) { setError(err.response?.data?.error || 'Kayıtlar yüklenemedi.'); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const warn = event => { if (pending.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const set = (key, value) => {
    if (!ready.current) return Promise.resolve(false);
    const next = typeof value === 'function' ? value(key === null ? current.current : current.current[key]) : value;
    const snapshot = key === null ? next : { ...current.current, [key]: next };
    current.current = snapshot; setData(snapshot); setSaving(true); setError(''); pending.current++;
    const expectedEpoch = epoch.current;
    queue.current = queue.current.then(async () => {
      if (epoch.current !== expectedEpoch) return false;
      try {
        const response = await api.put(`/workspaces/${scope}`, { data: snapshot, revision: revision.current });
        revision.current = response.data.revision; return true;
      } catch (err) {
        epoch.current++; setError(err.response?.data?.error || 'Kaydedilemedi. Güncel kayıtlar yeniden yükleniyor.');
        await load(); return false;
      }
    }).finally(() => { pending.current--; if (!pending.current) setSaving(false); });
    return queue.current;
  };
  return { data, set, loading, saving, error, reload: load, flush: () => queue.current };
}
