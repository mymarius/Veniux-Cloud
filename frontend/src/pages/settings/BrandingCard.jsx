import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Palette, Save, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import { useToast } from '../../components/Toast';
import { Input } from '../../components/ui';
import { loadBranding, setBranding, shrinkLogo } from '../../lib/branding';

// Marka: işletmenin adı ve logosu yan menüde, mobil üst barda, kasada ve fişin üst satırında görünür.
export default function BrandingCard() {
  const { showToast } = useToast();
  const [name, setName] = useState(''), [logo, setLogo] = useState(null), [removed, setRemoved] = useState(false), [fresh, setFresh] = useState(null);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const file = useRef(null);
  useEffect(() => { loadBranding(true).then(b => { setName(b.brand_name || ''); setLogo(b.logo || null); setLoaded(true); }); }, []);
  const pick = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { showToast('Logo PNG, JPEG ya da WebP olmalı.', 'error'); return; }
    try { const url = await shrinkLogo(f); setFresh(url); setRemoved(false); } catch { showToast('Görsel okunamadı.', 'error'); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = { brand_name: name };
      if (fresh) body.logo_data_url = fresh; else if (removed) body.remove_logo = true;
      const r = (await apiClient.put('/branding', body)).data;
      setBranding(r); setName(r.brand_name || ''); setLogo(r.logo || null); setFresh(null); setRemoved(false);
      showToast('Marka ayarları kaydedildi.', 'success');
    } catch (e) { showToast(e?.response?.data?.error || 'Kaydedilemedi.', 'error'); } finally { setBusy(false); }
  };
  const shown = fresh || (removed ? null : logo);
  if (!loaded) return null;
  return <div className="veniux-card p-6 space-y-4">
    <div className="flex items-center gap-2 pb-3 border-b border-gray-200"><Palette className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-sm text-gray-900">Marka (logo ve ad)</h2></div>
    <p className="text-sm text-gray-500">Mağazanızın adı ve logosu programın yan menüsünde, telefondaki üst barda, kasada ve fişin üst satırında görünür. Boş bırakırsanız Veniux görünür.</p>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50" aria-label="Logo önizleme">
        {shown ? <img src={shown} alt="Logo önizlemesi" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">Logo yok</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => file.current.click()}><ImagePlus className="w-4 h-4" /> Logo seç</button>
        {(shown) && <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => { setFresh(null); setRemoved(true); }}><Trash2 className="w-4 h-4" /> Logoyu kaldır</button>}
      </div>
    </div>
    <div className="max-w-md"><Input label="Marka adı (en çok 60 karakter)" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Örn. Güneş Market" /></div>
    <p className="text-xs text-gray-400">Logo en çok 200 KB, 32-1024 piksel; PNG, JPEG ya da WebP. SVG kabul edilmez.</p>
    <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet</button>
  </div>;
}
