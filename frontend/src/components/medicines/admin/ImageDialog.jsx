import React, { useEffect, useRef, useState } from 'react';
import { CloudDownload, ImagePlus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import api from '../../../api/client';
import DialogShell from '../../ui/DialogShell';
import { useToast } from '../../Toast';
import { IMAGE_SOURCE_LABELS, MedicineImage } from '../MedicineParts';

// Bir ilacın görselini yönetir: dosya yükleme, uzak adres, doğrulama, önbellek.
export default function ImageDialog({ medicine, onClose, onChanged }) {
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('manufacturer');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!medicine) return;
    setUrl(medicine.imageUrl || ''); setSource(medicine.imageSource && medicine.imageSource !== 'manual' ? medicine.imageSource : 'manufacturer'); setVerified(medicine.imageVerified);
  }, [medicine]);

  const run = async (work, message) => {
    setBusy(true);
    try { const r = await work(); onChanged(r.data.data); showToast(message, 'success'); }
    catch (e) { showToast(e.response?.data?.message || 'İşlem başarısız oldu.', 'error'); }
    finally { setBusy(false); }
  };
  const uploadFile = file => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showToast('Yalnızca JPEG, PNG veya WEBP yükleyebilirsiniz.', 'warning');
    if (file.size > 2 * 1024 * 1024) return showToast('Görsel en fazla 2 MB olabilir.', 'warning');
    run(() => api.post(`/admin/medicines/${medicine.id}/image`, file, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 60000 }), 'Görsel yüklendi ve doğrulandı.');
  };

  return <DialogShell isOpen={!!medicine} onClose={onClose} title="Görsel yönetimi" subtitle={medicine?.name} icon={ImagePlus} size="lg"
    footer={<button type="button" className="vx-btn" onClick={onClose}>Kapat</button>}>
    {medicine && <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div>
        <MedicineImage medicine={medicine} />
        <p className="mt-2 text-[11.5px] text-slate-500">{medicine.image ? `Kaynak: ${IMAGE_SOURCE_LABELS[medicine.imageSource] || '—'}${medicine.imageCached ? ' · yerel kopya' : ''}` : 'Görsel yok — yer tutucu gösteriliyor.'}</p>
        {medicine.image && <div className="mt-3 grid gap-2">
          <button className="vx-btn" disabled={busy} onClick={() => run(() => api.put(`/admin/medicines/${medicine.id}/image`, { verified: !medicine.imageVerified }), medicine.imageVerified ? 'Doğrulama kaldırıldı.' : 'Görsel doğrulandı.')}><ShieldCheck size={15} /> {medicine.imageVerified ? 'Doğrulamayı kaldır' : 'Doğru ilaç, onayla'}</button>
          {medicine.imageUrl && !medicine.imageCached && <button className="vx-btn" disabled={busy} onClick={() => run(() => api.post(`/admin/medicines/${medicine.id}/image/cache`), 'Görsel yerel depoya kopyalandı.')}><CloudDownload size={15} /> Yerel kopyala</button>}
          <button className="vx-btn" data-variant="red" disabled={busy} onClick={() => run(() => api.delete(`/admin/medicines/${medicine.id}/image`), 'Görsel kaldırıldı.')}><Trash2 size={15} /> Görseli kaldır</button>
        </div>}
      </div>
      <div className="grid content-start gap-4">
        <div className="md-drop" data-drag={drag} role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={e => e.key === 'Enter' && fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); uploadFile(e.dataTransfer.files[0]); }}>
          <Upload size={24} />
          <b>Kutu görseli yükleyin</b>
          <small>JPEG, PNG veya WEBP · en fazla 2 MB · yüklediğiniz görsel doğrulanmış sayılır</small>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => uploadFile(e.target.files[0])} />
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="mb-3 text-[12.5px] font-semibold text-slate-700">veya resmi görsel adresi girin</p>
          <div className="grid gap-3">
            <label className="vx-field">Görsel adresi (https)<input className="vx-input" type="url" placeholder="https://uretici.com.tr/urun/kutu.png" value={url} onChange={e => setUrl(e.target.value)} /></label>
            <label className="vx-field">Görsel kaynağı
              <select className="vx-input" value={source} onChange={e => setSource(e.target.value)}>
                <option value="manufacturer">Üreticinin resmi görseli</option>
                <option value="provider">Veri kaynağının görseli</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-[12.5px] text-slate-600"><input type="checkbox" className="mt-0.5" checked={verified} onChange={e => setVerified(e.target.checked)} /> Görselin bu barkoddaki ilaca ait olduğunu kontrol ettim</label>
            <button className="vx-btn" data-variant="primary" disabled={busy} onClick={() => run(() => api.put(`/admin/medicines/${medicine.id}/image`, { imageUrl: url.trim() || null, imageSource: source, verified }), url.trim() ? 'Görsel adresi kaydedildi.' : 'Uzak görsel kaldırıldı.')}>Adresi kaydet</button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Uzak görseller sunucuya kopyalanmaz; yalnızca kullanım izni olan alan adları (MEDICINE_IMAGE_CACHE_HOSTS) yerel olarak kopyalanabilir.</p>
        </div>
      </div>
    </div>}
  </DialogShell>;
}
