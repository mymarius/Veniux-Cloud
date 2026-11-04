import React, { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import api from '../api/client';

const money = (amount, currency) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(Number(amount));
const emptyForm = { license: '', amount: '', currency: 'TRY', period: 'ANNUAL' };

// Platform yöneticisi: havale faturası keser, hesaba geçen ödemeyi dekontla onaylar.
export default function PlatformBankTransfers() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newLicense, setNewLicense] = useState({ tenant: '', plan: '' });
  const [confirmations, setConfirmations] = useState({});

  const refresh = async () => {
    try { setData((await api.get('/platform/bank-transfers')).data); }
    catch (e) { setError(e.response?.data?.error || 'Havale bilgileri alınamadı.'); }
  };
  useEffect(() => { refresh(); }, []);

  const act = async (work, success) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); await refresh(); return true; }
    catch (e) { setError(e.response?.data?.error || 'İşlem tamamlanamadı.'); return false; }
    finally { setBusy(false); }
  };

  const createInvoice = async event => {
    event.preventDefault();
    const license = data.licenses.find(item => String(item.id) === form.license);
    if (!license) return setError('Lisans seçin.');
    const created = await act(() => api.post(`/platform/tenants/${license.tenant_id}/licenses/${license.id}/invoices`, { payment_method: 'BANK_TRANSFER', amount: Number(form.amount), currency: form.currency, billing_period: form.period }), 'Fatura kesildi; firma yöneticisi girişte veya Lisans ve plan ekranında görür.');
    if (created) setForm(emptyForm);
  };
  const createPending = async event => {
    event.preventDefault();
    const created = await act(() => api.post(`/platform/tenants/${newLicense.tenant}/licenses/pending`, { plan_id: newLicense.plan }), 'Ödeme bekleyen lisans açıldı; şimdi fatura kesebilirsiniz.');
    if (created) setNewLicense({ tenant: '', plan: '' });
  };
  const entry = id => confirmations[id] || { amount: '', reference: '' };
  const setEntry = (id, patch) => setConfirmations(current => ({ ...current, [id]: { ...entry(id), ...patch } }));
  const invoiceUrl = invoice => `/platform/tenants/${invoice.tenant_id}/licenses/${invoice.license_id}/invoices/${invoice.id}`;
  const confirm = invoice => act(() => api.post(`${invoiceUrl(invoice)}/confirm-bank-transfer`, { amount: Number(entry(invoice.id).amount), reference: entry(invoice.id).reference }), `${invoice.company_name} lisansı açıldı.`);
  const cancel = invoice => { if (window.confirm(`${invoice.invoice_no} faturası iptal edilsin mi?`)) act(() => api.post(`${invoiceUrl(invoice)}/void`, {}), 'Fatura iptal edildi.'); };

  const field = 'bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500';

  return (
    <section data-testid="platform-bank-transfers" className="veniux-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold flex gap-2 items-center"><Landmark size={18} />Havale ile ödemeler</h2>
        <p className="text-sm text-slate-500 mt-1">Onay vermeden önce paranın hesaba geçtiğini ve açıklamadaki fatura numarasını kontrol edin.</p>
      </div>
      {error && <p role="alert" className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="bg-emerald-50 text-emerald-700 rounded-lg p-3 text-sm">{notice}</p>}
      {data && !data.bank && <p role="alert" className="bg-amber-50 text-amber-800 rounded-lg p-3 text-sm">BANK_IBAN ve BANK_ACCOUNT_NAME tanımlı veya geçerli değil. Bunlar ayarlanmadan havale faturası kesilemez.</p>}
      {data && (
        <form onSubmit={createPending} className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-slate-500 flex flex-col gap-1 min-w-0 flex-1">Lisansı olmayan işletme
            <select required aria-label="Lisansı olmayan işletme" className={field} value={newLicense.tenant} onChange={e => setNewLicense({ ...newLicense, tenant: e.target.value })}>
              <option value="">Seçin</option>
              {data.unlicensed.map(item => <option key={item.id} value={item.id}>{item.company_name}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1 min-w-0 flex-1">Paket
            <select required aria-label="Paket" className={field} value={newLicense.plan} onChange={e => setNewLicense({ ...newLicense, plan: e.target.value })}>
              <option value="">Seçin</option>
              {data.plans.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy} className="btn-secondary">Ödeme bekleyen lisans aç</button>
        </form>
      )}
      {data && (
        <form onSubmit={createInvoice} className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-slate-500 flex flex-col gap-1 min-w-0 flex-1">Lisans
            <select required aria-label="Lisans" className={field} value={form.license} onChange={e => setForm({ ...form, license: e.target.value })}>
              <option value="">Seçin</option>
              {data.licenses.map(item => <option key={item.id} value={item.id}>{item.company_name} · {item.plan_id} · {item.status}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Tutar
            <input required aria-label="Tutar" type="number" min="0.01" step="0.01" className={field} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Para birimi
            <select aria-label="Para birimi" className={field} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              {['TRY', 'USD', 'EUR'].map(code => <option key={code}>{code}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Dönem
            <select aria-label="Dönem" className={field} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>
              <option value="ANNUAL">Yıllık</option>
              <option value="MONTHLY">Aylık</option>
            </select>
          </label>
          <button type="submit" disabled={busy || !data.bank} className="btn-primary">Fatura kes</button>
        </form>
      )}
      {data?.pending.length === 0 && <p className="text-sm text-slate-500">Bekleyen havale yok.</p>}
      <ul className="divide-y divide-gray-200">
        {data?.pending.map(invoice => (
          <li key={invoice.id} className="py-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-semibold text-gray-900">{invoice.company_name}</span>
              <span className="font-mono break-all">{invoice.invoice_no}</span>
              <strong>{money(invoice.amount, invoice.currency)}</strong>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input aria-label={`${invoice.invoice_no} gelen tutar`} placeholder="Gelen tutar" type="number" step="0.01" className={field} value={entry(invoice.id).amount} onChange={e => setEntry(invoice.id, { amount: e.target.value })} />
              <input aria-label={`${invoice.invoice_no} dekont numarası`} placeholder="Dekont numarası" className={field} value={entry(invoice.id).reference} onChange={e => setEntry(invoice.id, { reference: e.target.value })} />
              <button type="button" disabled={busy} className="btn-primary" onClick={() => confirm(invoice)}>Ödeme geldi</button>
              <button type="button" disabled={busy} className="btn-secondary" onClick={() => cancel(invoice)}>İptal</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
