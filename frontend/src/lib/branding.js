// İşletmenin marka adı ve logosu: tek yerde önbelleğe alınır; ayar değişince tüm ekranlar (yan menü, mobil üst bar, kasa) birlikte güncellenir.
import { useEffect, useState } from 'react';
import apiClient from '../api/client';

let cache = null, inflight = null;
const listeners = new Set();
const EMPTY = { brand_name: '', logo: null };

export function loadBranding(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) inflight = apiClient.get('/branding').then(r => { cache = r.data; listeners.forEach(f => f(cache)); return cache; }).catch(() => cache || EMPTY).finally(() => { inflight = null; });
  return inflight;
}
export function setBranding(value) { cache = value; listeners.forEach(f => f(value)); }
export function useBranding() {
  const [value, setValue] = useState(cache);
  useEffect(() => {
    let live = true; const listener = v => { if (live) setValue(v); };
    listeners.add(listener); loadBranding().then(listener);
    return () => { live = false; listeners.delete(listener); };
  }, []);
  return value || EMPTY;
}

// Görseli en uzun kenar `max` olacak şekilde küçültüp PNG data adresi üretir (sunucu sınırı 200 KB).
export async function shrinkLogo(file, max = 512) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(32, Math.round(bitmap.width * scale)), height = Math.max(32, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  let url = canvas.toDataURL('image/png');
  if (url.length > 270000) url = canvas.toDataURL('image/webp', 0.85);
  return url;
}
