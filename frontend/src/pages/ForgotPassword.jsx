import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';
import { AuthShell } from '../components/AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'İstek gönderilemedi. Daha sonra tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Hesap kurtarma" title="Şifrenizi sıfırlayın" description="E-posta adresinize 30 dakika geçerli bir bağlantı göndeririz." footer={<Link to="/login" className="font-bold text-brand-500 hover:underline">Girişe dön</Link>}>
      {error && <div data-testid="status-forgot-error" className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-600"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div>}
      {message ? (
        <p data-testid="status-forgot-sent" className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-xs font-semibold text-green-700">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-600">Kurumsal e-posta</span>
            <span className="relative block">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
              <input data-testid="input-forgot-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="isim@sirket.com" autoComplete="email" className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand-500" />
            </span>
          </label>
          <button data-testid="button-forgot-submit" type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-full disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Gönderiliyor...' : 'Bağlantı Gönder'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
