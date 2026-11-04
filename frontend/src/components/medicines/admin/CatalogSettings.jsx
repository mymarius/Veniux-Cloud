import React, { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import api from '../../../api/client';
import { useToast } from '../../Toast';
import { Panel } from '../../dashboard/AnalyticsKit';

export default function CatalogSettings() {
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState([]);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([api.get('/admin/medicines/settings'), api.get('/admin/medicines/sync/status')])
      .then(([s, st]) => { setSettings(s.data.data); setProviders(st.data.data.providers); })
      .catch(() => showToast('Ayarlar yüklenemedi.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = key => e => setSettings(s => ({ ...s, [key]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '0') : e.target.value }));
  const save = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const { active_provider, chunk_size, auto_deactivate, deactivate_max_percent, enrich_price_list, enrich_controlled_lists } = settings;
      const r = await api.put('/admin/medicines/settings', { active_provider, chunk_size, auto_deactivate, deactivate_max_percent, enrich_price_list, enrich_controlled_lists });
      setSettings(r.data.data); showToast('Ayarlar kaydedildi.', 'success');
    } catch (err) { showToast(err.response?.data?.message || 'Kaydedilemedi.', 'error'); }
    finally { setBusy(false); }
  };

  if (!settings) return <div className="skeleton h-80 rounded-2xl" />;
  return <Panel icon={Settings2} title="Katalog ayarları" subtitle="Veri kaynağı ve senkronizasyon davranışı">
    <form onSubmit={save} className="grid max-w-2xl gap-5">
      <label className="vx-field">Aktif veri kaynağı
        <select className="vx-input" value={settings.active_provider} onChange={set('active_provider')}>
          {providers.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <small>{providers.find(p => p.key === settings.active_provider)?.description}</small>
      </label>
      <label className="vx-field">Parça büyüklüğü (kayıt)
        <input className="vx-input" type="number" min="50" max="2000" step="50" value={settings.chunk_size} onChange={set('chunk_size')} />
        <small>Büyük listeler bu büyüklükte parçalar halinde işlenir; zaman aşımı oluşmaz.</small>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-[13px]">
        <input type="checkbox" className="mt-1" checked={settings.auto_deactivate === '1'} onChange={set('auto_deactivate')} />
        <span><b className="block text-slate-800">Listeden çıkan ilaçları pasife al</b><span className="text-slate-500">Tam katalog sunan kaynakta artık bulunmayan ilaçlar "Piyasada değil" olarak işaretlenir. Manuel kayıtlar ve elle düzenlenenler etkilenmez.</span></span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-[13px]">
        <input type="checkbox" className="mt-1" checked={settings.enrich_controlled_lists !== '0'} onChange={set('enrich_controlled_lists')} />
        <span><b className="block text-slate-800">Reçete türünü TİTCK Kırmızı / Yeşil reçete listelerinden belirle</b><span className="text-slate-500">Her senkronizasyonda TİTCK'nin kontrole tabi ilaç listeleri indirilir; etken maddesi veya markası listede olan ilaçlar Kırmızı / Yeşil, diğerleri "Kontrole tabi değil" olarak işaretlenir.</span></span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-[13px]">
        <input type="checkbox" className="mt-1" checked={settings.enrich_price_list !== '0'} onChange={set('enrich_price_list')} />
        <span><b className="block text-slate-800">Yüklenen fiyat listesini her senkronizasyonda uygula</b><span className="text-slate-500">İçe Aktar sekmesinden yüklediğiniz barkodlu fiyat / reçete listesi, her senkronizasyonun sonunda barkodla eşleşen ilaçlara yeniden uygulanır.</span></span>
      </label>
      <label className="vx-field">Pasife alma güvenlik eşiği (%)
        <input className="vx-input" type="number" min="1" max="100" value={settings.deactivate_max_percent} onChange={set('deactivate_max_percent')} />
        <small>Kaynakta bulunmayan kayıtların oranı bu eşiği aşarsa (ör. eksik / kesik dosya) hiçbir kayıt pasife alınmaz.</small>
      </label>
      <div className="rounded-xl bg-slate-50 p-4 text-[12px] text-slate-600">
        <b className="mb-1 block text-slate-800">Sunucu ortam değişkenleri</b>
        TİTCK liste adresi (MEDICINE_TITCK_LIST_URL): <b>{settings.titckUrlConfigured ? 'tanımlı' : 'tanımlı değil'}</b><br />
        Görsel kopyalama izinli alan adları (MEDICINE_IMAGE_CACHE_HOSTS): <b>{settings.imageCacheHosts?.length ? settings.imageCacheHosts.join(', ') : 'yok — uzak görseller kopyalanmaz'}</b>
      </div>
      <div><button className="vx-btn" data-variant="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Ayarları kaydet'}</button></div>
    </form>
  </Panel>;
}
