import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, ImagePlus, Pencil, Search, Trash2 } from 'lucide-react';
import api from '../../../api/client';
import DialogShell from '../../ui/DialogShell';
import { useToast } from '../../Toast';
import { EmptyState, MedicineImage, Pagination, SOURCE_LABELS, StatusPill, money } from '../MedicineParts';
import MedicineForm from './MedicineForm';
import ImageDialog from './ImageDialog';

// Tüm İlaçlar ve Görsel Kontrolü sekmeleri (imageMode ile görsel odaklı liste).
export default function MedicineList({ imageMode = false }) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ marketStatus: '', source: '', image: imageMode ? 'unverified' : '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [imageFor, setImageFor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api.get('/admin/medicines', { params: { q: q || undefined, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 25 } })
        .then(r => { if (active) setResult(r.data); })
        .catch(e => { if (active) showToast(e.response?.data?.message || 'Liste yüklenemedi.', 'error'); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [q, filters, page, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detay sayfasındaki "Düzenle" bağlantısı (?edit=ID) düzenleme penceresini açar.
  useEffect(() => {
    const id = params.get('edit');
    if (!id) return;
    api.get(`/medicines/${id}`).then(r => setEditing(r.data.data)).catch(() => {});
    const next = new URLSearchParams(params); next.delete('edit'); setParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const replaceRow = updated => {
    setResult(r => r && ({ ...r, data: r.data.map(m => (m.id === updated.id ? updated : m)) }));
    if (imageFor?.id === updated.id) setImageFor(updated);
  };
  const save = async form => {
    setBusy(true);
    try { const r = await api.put(`/admin/medicines/${editing.id}`, form); replaceRow(r.data.data); setEditing(null); showToast('İlaç güncellendi.', 'success'); }
    catch (e) { showToast(e.response?.data?.message || 'Kaydedilemedi.', 'error'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/medicines/${confirm.medicine.id}`, { params: confirm.permanent ? { permanent: 1 } : {} });
      showToast(confirm.permanent ? 'İlaç kalıcı olarak silindi.' : 'İlaç pasife alındı.', 'success');
      setConfirm(null); setTick(t => t + 1);
    } catch (e) { showToast(e.response?.data?.message || 'İşlem başarısız.', 'error'); }
    finally { setBusy(false); }
  };
  const setFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };

  return <div className="ax-panel">
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="md-search flex-1" style={{ minWidth: 240, padding: '2px 4px 2px 14px', borderWidth: 1 }}>
        <Search size={17} />
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Ad, barkod, etken madde, firma, ATC" aria-label="İlaç ara" style={{ height: 38, fontSize: 14 }} />
      </div>
      <select className="ax-select" value={filters.marketStatus} onChange={e => setFilter('marketStatus', e.target.value)} aria-label="Durum">
        <option value="">Tüm durumlar</option><option value="active">Piyasada</option><option value="suspended">Askıda</option><option value="passive">Pasif</option>
      </select>
      <select className="ax-select" value={filters.source} onChange={e => setFilter('source', e.target.value)} aria-label="Kaynak">
        <option value="">Tüm kaynaklar</option>{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className="ax-select" value={filters.image} onChange={e => setFilter('image', e.target.value)} aria-label="Görsel durumu">
        <option value="">Tüm görseller</option><option value="unverified">Doğrulanmamış görsel</option><option value="missing">Görseli olmayan</option><option value="verified">Doğrulanmış görsel</option>
      </select>
    </div>
    {imageMode && <p className="mb-4 rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-600">Barkodla kesin eşleşmeyen görseller otomatik onaylanmaz. Her görselin ilgili ilacın kutusu olduğunu kontrol edip onaylayın veya doğru görseli yükleyin.</p>}

    {result && !result.data.length ? <EmptyState title={imageMode ? 'Kontrol bekleyen görsel yok' : 'Kayıt bulunamadı'} text={imageMode ? 'Filtreyi "Görseli olmayan" yaparak eksik görselleri listeleyebilirsiniz.' : 'Filtreleri değiştirin veya yeni ilaç ekleyin.'} />
      : <div className="overflow-x-auto" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 160ms' }}>
        <table className="md-list">
          <thead><tr><th /><th>İlaç</th><th>Barkod</th><th>Firma</th><th>Kaynak</th><th>Durum</th><th style={{ textAlign: 'right' }}>Fiyat</th><th style={{ textAlign: 'right' }}>İşlem</th></tr></thead>
          <tbody>{(result?.data || []).map(m => <tr key={m.id} onClick={() => (imageMode ? setImageFor(m) : setEditing(m))}>
            <td><MedicineImage medicine={m} size="sm" showBadge={false} /></td>
            <td><b>{m.name}</b><div className="text-[11px] text-slate-500">{m.activeIngredient || '—'}</div>{m.image && <span className="md-pill mt-1" data-tone={m.imageVerified ? 'green' : 'amber'}>{m.imageVerified ? 'Görsel doğrulandı' : 'Görsel doğrulanmadı'}</span>}</td>
            <td className="md-barcode">{m.barcode}</td>
            <td>{m.company || '—'}</td>
            <td><span className="md-pill" data-tone={m.source === 'manual' ? 'blue' : 'slate'}>{SOURCE_LABELS[m.source] || m.source}</span>{m.manualOverride && <div className="mt-1 text-[10.5px] text-amber-700">elle düzenlendi</div>}</td>
            <td><StatusPill status={m.marketStatus} /></td>
            <td style={{ textAlign: 'right' }} className="tabular-nums">{money(m.price, m.currency)}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
              <button className="vx-dialog-close inline-grid" title="Düzenle" aria-label="Düzenle" onClick={() => setEditing(m)}><Pencil size={15} /></button>
              <button className="vx-dialog-close inline-grid" title="Görsel" aria-label="Görsel" onClick={() => setImageFor(m)}><ImagePlus size={15} /></button>
              {m.marketStatus !== 'passive' && <button className="vx-dialog-close inline-grid" title="Pasife al" aria-label="Pasife al" onClick={() => setConfirm({ medicine: m, permanent: false })}><Ban size={15} /></button>}
              <button className="vx-dialog-close inline-grid" title="Kalıcı sil" aria-label="Kalıcı sil" onClick={() => setConfirm({ medicine: m, permanent: true })}><Trash2 size={15} /></button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>}
    <Pagination pagination={result?.pagination} onPage={setPage} />

    <DialogShell isOpen={!!editing} onClose={() => setEditing(null)} title="İlacı düzenle" subtitle={editing?.name} icon={Pencil} size="lg"
      footer={<><button type="button" className="vx-btn" onClick={() => setEditing(null)}>Vazgeç</button><button form="medicine-edit-form" className="vx-btn" data-variant="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button></>}>
      <MedicineForm initial={editing} onSubmit={save} formId="medicine-edit-form" showActions={false} />
    </DialogShell>

    <DialogShell isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.permanent ? 'İlacı kalıcı olarak sil' : 'İlacı pasife al'} icon={confirm?.permanent ? Trash2 : Ban} tone="red" size="sm"
      footer={<><button type="button" className="vx-btn" onClick={() => setConfirm(null)}>Vazgeç</button><button className="vx-btn" data-variant="red" disabled={busy} onClick={remove}>{confirm?.permanent ? 'Kalıcı olarak sil' : 'Pasife al'}</button></>}>
      <p className="text-[13px] text-slate-600"><b className="text-slate-800">{confirm?.medicine.name}</b> {confirm?.permanent ? 'veritabanından silinecek. Bu işlem geri alınamaz; kaynak listede hâlâ varsa sonraki senkronizasyonda yeniden eklenir.' : 'aramalarda gösterilmeyecek. İstediğiniz zaman durumu yeniden "Piyasada" yapabilirsiniz.'}</p>
    </DialogShell>

    <ImageDialog medicine={imageFor} onClose={() => setImageFor(null)} onChanged={replaceRow} />
  </div>;
}
