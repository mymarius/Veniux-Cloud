import React, { useEffect, useState } from 'react';
import { Landmark, Copy } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from './Toast';

const money = (amount, currency) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(Number(amount));

// Firma yöneticisine açık havale faturasını gösterir; ödenecek bir şey yoksa ekranda yer kaplamaz.
export default function BankTransferPayment({ billing }) {
  const { showToast } = useToast();
  const [fetched, setFetched] = useState(null);
  const data = billing || fetched;

  useEffect(() => {
    if (billing) return undefined;
    let active = true;
    apiClient.get('/license/billing').then(res => { if (active) setFetched(res.data); }).catch(() => { if (active) setFetched(null); });
    return () => { active = false; };
  }, [billing]);

  const pending = data?.invoices?.filter(invoice => invoice.status === 'PENDING') || [];
  if (!pending.length) return null;

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} kopyalandı.`, 'success');
    } catch {
      showToast(`${label} kopyalanamadı; elle seçin.`, 'warning');
    }
  };

  return (
    <section data-testid="bank-transfer-payment" className="veniux-card p-6 space-y-4 border border-amber-200">
      <div className="flex items-center gap-3">
        <Landmark className="w-5 h-5 text-amber-600" />
        <div>
          <h2 className="font-semibold text-gray-900">Havale ile ödeme bekleniyor</h2>
          <p className="text-sm text-gray-500">Açıklamaya fatura numarasını yazın. Ödeme hesabımıza geçip onaylandığında lisansınız açılır; onay otomatik değildir.</p>
        </div>
      </div>
      {data.bank ? (
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="sm:col-span-2 p-3 rounded-lg bg-gray-50">
            <dt className="text-xs text-gray-500">IBAN</dt>
            <dd className="font-mono font-semibold text-gray-900 flex flex-wrap items-center gap-2 break-all">
              <span data-testid="bank-iban">{data.bank.iban}</span>
              <button type="button" className="icon-btn" aria-label="IBAN'ı kopyala" title="Kopyala" onClick={() => copy(data.bank.iban, 'IBAN')}><Copy className="w-4 h-4" /></button>
            </dd>
          </div>
          <div className="p-3 rounded-lg bg-gray-50"><dt className="text-xs text-gray-500">Hesap sahibi</dt><dd className="font-semibold text-gray-900">{data.bank.account_name}</dd></div>
          {data.bank.bank_name && <div className="p-3 rounded-lg bg-gray-50"><dt className="text-xs text-gray-500">Banka</dt><dd className="font-semibold text-gray-900">{data.bank.bank_name}</dd></div>}
        </dl>
      ) : <p role="alert" className="text-sm text-red-700">Hesap bilgileri şu an gösterilemiyor. Veniux yöneticisiyle iletişime geçin.</p>}
      <ul className="divide-y divide-gray-200">
        {pending.map(invoice => (
          <li key={invoice.invoice_no} className="py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-sm text-gray-900 flex items-center gap-2 break-all">
              {invoice.invoice_no}
              <button type="button" className="icon-btn" aria-label="Fatura numarasını kopyala" title="Kopyala" onClick={() => copy(invoice.invoice_no, 'Fatura numarası')}><Copy className="w-4 h-4" /></button>
            </span>
            <strong className="text-gray-900">{money(invoice.amount, invoice.currency)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
