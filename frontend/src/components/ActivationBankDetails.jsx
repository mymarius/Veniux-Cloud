import React, { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import apiClient from '../api/client';

// Merkezi lisansta müşteri henüz oturum açamaz: havale bilgisi etkinleştirme ekranında gösterilir, anahtar ödeme onayından sonra verilir.
export default function ActivationBankDetails() {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    let active = true;
    apiClient.get('/license/bank-details').then(res => { if (active) setBank(res.data.bank); }).catch(() => { if (active) setBank(null); });
    return () => { active = false; };
  }, []);

  if (!bank) return null;
  return (
    <section data-testid="activation-bank-details" className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Landmark className="w-4 h-4" />Lisans anahtarınız yok mu?</h2>
      <p className="text-gray-600">Havale açıklamasına firma adınızı yazın. Ödeme hesabımıza geçip onaylandığında lisans anahtarınız e-posta ile gönderilir; onay otomatik değildir.</p>
      <p className="font-mono font-semibold text-gray-900 break-all" data-testid="activation-iban">{bank.iban}</p>
      <p className="text-gray-700">{bank.account_name}{bank.bank_name ? ` · ${bank.bank_name}` : ''}</p>
    </section>
  );
}
