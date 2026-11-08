import { useEffect, useState } from 'react';
import api from '../api/client';

// Yedek alınamadığında veya ikinci kopya olmadığında yöneticiye sabit uyarı. Durumu 30 dakikada bir yeniler.
const role = () => { try { return JSON.parse(localStorage.getItem('user') || '{}').role; } catch { return null; } };

export default function BackupHealth() {
  const [health, setHealth] = useState(null), [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!['admin', 'manager'].includes(role())) return undefined;
    let live = true;
    const load = () => api.get('/backups/health').then(r => { if (live) setHealth(r.data); }).catch(() => {});
    load();
    const timer = setInterval(load, 1800000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  if (!health || hidden || !['error', 'warning'].includes(health.level)) return null;
  const error = health.level === 'error';
  return <div role={error ? 'alert' : 'status'} className={'veniux-backup-health' + (error ? ' veniux-backup-health-error' : '')}>
    <strong>{error ? 'Yedekleme sorunu:' : 'Yedekleme uyarısı:'}</strong> {health.messages.join(' ')}
    {health.last_success_at && <span> Son sağlam yedek: {new Date(health.last_success_at).toLocaleString('tr-TR')}.</span>}
    {!error && <button type="button" onClick={() => setHidden(true)} aria-label="Uyarıyı kapat">Kapat</button>}
  </div>;
}
