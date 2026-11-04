import React, { useState, useEffect } from 'react';
import { ImageOff, Pill, ShieldCheck, ShieldAlert } from 'lucide-react';
import apiClient from '../../api/client';
import './medicines.css';

export const STATUS = {
  active: ['Piyasada', 'green'],
  suspended: ['Askıda', 'amber'],
  passive: ['Piyasada değil', 'slate']
};
export const SOURCE_LABELS = { titck: 'TİTCK kamu listesi', manual: 'Manuel kayıt' };
export const IMAGE_SOURCE_LABELS = { provider: 'Veri kaynağı', manufacturer: 'Üretici', manual: 'Elle yüklendi' };

export const money = (value, currency = 'TRY') => (value === null || value === undefined ? '—' : Number(value).toLocaleString('tr-TR', { style: 'currency', currency }));
export const dateTime = value => {
  if (!value) return '—';
  const text = String(value);
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function StatusPill({ status }) {
  const [label, tone] = STATUS[status] || [status || '—', 'slate'];
  return <span className="md-pill" data-tone={tone}>{label}</span>;
}

// Görsel yoksa veya yüklenemezse "Görsel bulunamadı" yer tutucusu gösterilir.
// Görseller yalnızca kendi API'mizden yüklenir; dış HTML hiçbir zaman basılmaz.
export function MedicineImage({ medicine, size = 'md', showBadge = true }) {
  const [failed, setFailed] = useState(false);
  useEffect(()=>setFailed(false),[medicine?.id,medicine?.image,medicine?.imageLookup]);
  const imagePath=medicine?.image||medicine?.imageLookup;
  const src = imagePath && !failed ? (apiClient.defaults.baseURL || '/api').replace(/\/$/,'') + imagePath : null;
  return <div className="md-image" data-size={size}>
    {src
      ? <img src={src} alt={`${medicine.name} kutu görseli`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <div className="md-placeholder"><span><Pill size={size === 'lg' ? 34 : 22} /></span>{size !== 'sm' && <small>Kutu görseli henüz yok</small>}</div>}
    {showBadge && src && size !== 'sm' && !medicine.imageLookup && (medicine.imageVerified
      ? <em className="md-verify" data-ok title="Görsel barkodla eşleşti / yönetici onayladı"><ShieldCheck size={12} /> Doğrulandı</em>
      : <em className="md-verify" title="Doz ve ürün adı eşleşir; ambalaj boyutu ve barkod yönetici onayı gerektirir"><ShieldAlert size={12} /> Ambalajı doğrulayın</em>)}
  </div>;
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  return <nav className="md-pages" aria-label="Sayfalar">
    <span>{total.toLocaleString('tr-TR')} kayıt</span>
    <div>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Önceki</button>
      {nums.map((n, i) => <React.Fragment key={n}>{i > 0 && n - nums[i - 1] > 1 && <i>…</i>}<button type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button></React.Fragment>)}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sonraki</button>
    </div>
  </nav>;
}

export function EmptyState({ icon: Icon = ImageOff, title, text, action }) {
  return <div className="md-empty"><i><Icon size={26} /></i><b>{title}</b>{text && <p>{text}</p>}{action}</div>;
}
