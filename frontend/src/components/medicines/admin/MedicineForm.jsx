import React, { useEffect, useState } from 'react';

const EMPTY = { barcode: '', name: '', activeIngredient: '', dosage: '', pharmaceuticalForm: '', packageSize: '', company: '', manufacturer: '', atcCode: '', prescriptionType: '', licenseDate: '', licenseNumber: '', marketStatus: 'active', price: '', currency: 'TRY', kubUrl: '', ktUrl: '' };
const PRESCRIPTIONS = ['Normal', 'Kırmızı', 'Turuncu', 'Mor', 'Yeşil', 'Reçetesiz'];

// İlaç ekleme / düzenleme formu (yönetici).
export default function MedicineForm({ initial, onSubmit, submitLabel = 'Kaydet', busy, formId = 'medicine-form', showActions = true, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  useEffect(() => { setForm(initial ? Object.fromEntries(Object.keys(EMPTY).map(k => [k, initial[k] ?? EMPTY[k]])) : EMPTY); }, [initial]);
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const field = (key, label, props = {}) => <label className="vx-field" key={key}>{label}<input className="vx-input" value={form[key] ?? ''} onChange={set(key)} {...props} /></label>;
  const submit = e => { e.preventDefault(); onSubmit({ ...form, price: form.price === '' ? null : Number(form.price) }); };

  return <form id={formId} onSubmit={submit} className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {field('barcode', 'Barkod *', { required: true, inputMode: 'numeric', pattern: '\\d{8,14}', title: '8-14 haneli barkod', placeholder: '869…' })}
      {field('name', 'İlaç adı *', { required: true, maxLength: 300, placeholder: 'Örn: PAROL 500 MG 20 TABLET' })}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {field('activeIngredient', 'Etken madde', { placeholder: 'Örn: Parasetamol' })}
      {field('dosage', 'Doz', { placeholder: 'Örn: 500 mg' })}
      {field('pharmaceuticalForm', 'Farmasötik form', { placeholder: 'Örn: Film tablet' })}
      {field('packageSize', 'Paket bilgisi', { placeholder: 'Örn: 20 tablet' })}
      {field('company', 'Ruhsat sahibi / firma')}
      {field('manufacturer', 'Üretici')}
      {field('atcCode', 'ATC kodu', { maxLength: 10, placeholder: 'Örn: N02BE01' })}
      <label className="vx-field">Reçete tipi
        <input className="vx-input" list="prescription-types" value={form.prescriptionType ?? ''} onChange={set('prescriptionType')} />
        <datalist id="prescription-types">{PRESCRIPTIONS.map(p => <option key={p} value={p} />)}</datalist>
      </label>
      <label className="vx-field">Piyasa durumu
        <select className="vx-input" value={form.marketStatus} onChange={set('marketStatus')}>
          <option value="active">Piyasada</option><option value="suspended">Askıda</option><option value="passive">Piyasada değil</option>
        </select>
      </label>
      {field('licenseDate', 'Ruhsat tarihi', { type: 'date' })}
      {field('licenseNumber', 'Ruhsat numarası', { maxLength: 100 })}
      {field('price', 'Fiyat (₺)', { type: 'number', min: 0, step: '0.01', inputMode: 'decimal' })}
      {field('kubUrl', 'KÜB bağlantısı', { type: 'url', placeholder: 'https://…' })}
      {field('ktUrl', 'Kullanma talimatı bağlantısı', { type: 'url', placeholder: 'https://…' })}
    </div>
    {initial?.source && initial.source !== 'manual' && <p className="rounded-xl bg-amber-50 p-3 text-[12px] text-amber-800">Bu kayıt <b>{initial.source}</b> kaynağından geliyor. Elle düzenlerseniz sonraki senkronizasyonlar bu kaydın üzerine yazmaz.</p>}
    {showActions && <div className="flex justify-end gap-2">
      {onCancel && <button type="button" className="vx-btn" onClick={onCancel}>Vazgeç</button>}
      <button className="vx-btn" data-variant="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : submitLabel}</button>
    </div>}
  </form>;
}
