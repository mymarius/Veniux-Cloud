import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { setupProgress, shouldShowBand, snoozeUntil, bandKey } from '../lib/setupBand.mjs';

const readUntil = key => { try { return Number(localStorage.getItem(key)) || null; } catch { return null; } };

// İlk kurulum bandı: yalnız Genel Bakış'ta, tek satır ve ilerleme çubuklu. "Daha sonra" bandı 7 gün gizler.
export default function SetupBand({ setup, user, profileName, path }) {
  const key = bandKey(user?.id);
  const [until, setUntil] = useState(() => readUntil(key));
  if (!shouldShowBand({ setup, role: user?.role, path, until })) return null;
  const { done, total, percent } = setupProgress(setup.steps);
  const snooze = () => {
    const next = snoozeUntil();
    try { localStorage.setItem(key, String(next)); } catch { /* bu oturumda gizlenir */ }
    setUntil(next);
  };
  return (
    <section className="vx-setup-band" aria-label="İşletme kurulum durumu">
      <div className="vx-setup-band-text">
        <b>İlk iş gününe hazırlık</b>
        <span>{profileName ? `${profileName} · ` : ''}{total ? `${done}/${total} adım tamamlandı` : 'Kurulum adımları sizi bekliyor'}</span>
        {total > 0 && <i className="vx-setup-bar" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100"><em style={{ width: percent + '%' }} /></i>}
      </div>
      <div className="vx-setup-band-actions">
        <button type="button" className="btn-secondary" onClick={snooze}>Daha sonra</button>
        <Link className="btn-primary" to="/setup">Devam et</Link>
      </div>
    </section>
  );
}
