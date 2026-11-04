import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldAlert } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from '../components/Toast';
import { AuthShell } from '../components/AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirm) return setError('Şifreler eşleşmiyor.');
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/reset-password', { token, password });
      showToast(response.data.message, 'success');
      navigate('/login');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const field = (testId, label, value, onChange) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
      <span className="relative block">
        <Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
        <input data-testid={testId} type="password" required minLength={8} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand-500" />
      </span>
    </label>
  );

  return (
    <AuthShell eyebrow="Hesap kurtarma" title="Yeni şifre belirleyin" description="Şifreniz değişince açık oturumlarınız kapanır." footer={<Link to="/login" className="font-bold text-brand-500 hover:underline">Girişe dön</Link>}>
      {error && <div data-testid="status-reset-error" className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-600"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div>}
      {!token ? (
        <p className="text-sm text-gray-600">Bağlantı eksik. <Link to="/forgot-password" className="font-bold text-brand-600 hover:underline">Yeni bağlantı isteyin</Link>.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('input-reset-password', 'Yeni şifre', password, setPassword)}
          {field('input-reset-confirm', 'Yeni şifre (tekrar)', confirm, setConfirm)}
          <button data-testid="button-reset-submit" type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-full disabled:cursor-wait disabled:opacity-60">
            {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
