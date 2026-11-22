import React, { useEffect, useId, useRef, useState } from 'react';
import apiClient from '../api/client';
import { mergeProducts, searchProducts } from '../lib/productSearch';

// Yazdıkça sunucudan aranan ürün seçici: 50 bin ürünlük katalogda <select> yerine en fazla 20 sonuç gösterir.
// value: seçili ürün kimliği (metin); onChange(id, product). `selected` verilirse etiket için ek istek atılmaz.
// Seçili ürün başka yerden gelirse (ör. varsayılan ürün) /products/:id ile bir kez yüklenir.
export default function ProductSelect({ value, onChange, selected = null, disabled = false, required = false, className = 'vx-input', placeholder = 'Ürün adı, SKU veya barkod ara…', ariaLabel = 'Ürün', initial = null }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(initial || []);
  const [known, setKnown] = useState(selected ? [selected] : []);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const current = known.find(p => String(p.id) === String(value)) || options.find(p => String(p.id) === String(value)) || (selected && String(selected.id) === String(value) ? selected : null);

  // Seçili ürün listede yoksa tek ürünü getir.
  useEffect(() => {
    if (!value || current) return undefined;
    let live = true;
    apiClient.get(`/products/${value}`).then(r => { if (live && r.data?.id) setKnown(k => mergeProducts(k, [r.data])); }).catch(() => {});
    return () => { live = false; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arama: 250 ms bekler, eski yanıtları yok sayar.
  useEffect(() => {
    if (!open) return undefined;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true); setFailed(false);
      try {
        const rows = await searchProducts(apiClient, query);
        if (mine === seq.current) setOptions(rows);
      } catch { if (mine === seq.current) setFailed(true); }
      finally { if (mine === seq.current) setBusy(false); }
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, open]);

  const choose = p => {
    setKnown(k => mergeProducts([p], k));
    setOpen(false); setQuery('');
    onChange?.(String(p.id), p);
  };
  const label = p => `${p.name} · ${p.sku}`;

  return <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <input
      type="text" className={className} role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-label={ariaLabel}
      disabled={disabled} autoComplete="off" placeholder={current && !open ? label(current) : placeholder}
      value={open ? query : (current ? label(current) : '')}
      onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && open && options[0]) { e.preventDefault(); choose(options[0]); } }}
    />
    {required && <input tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}} style={{ position: 'absolute', opacity: 0, height: 1, width: 1, bottom: 0, left: 0, pointerEvents: 'none' }} />}
    {open && <ul id={id} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
      {busy && <li className="px-3 py-2 text-slate-500">Aranıyor…</li>}
      {failed && <li role="alert" className="px-3 py-2 text-red-700">Ürünler alınamadı.</li>}
      {!busy && !failed && !options.length && <li className="px-3 py-2 text-slate-500">Ürün bulunamadı.</li>}
      {options.map(p => <li key={p.id} role="option" aria-selected={String(p.id) === String(value)}>
        <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none" onMouseDown={e => e.preventDefault()} onClick={() => choose(p)}>
          {p.name} <span className="text-slate-500">· {p.sku}</span>
        </button>
      </li>)}
      {options.length >= 20 && !query && <li className="px-3 py-1 text-xs text-slate-400">İlk 20 ürün gösteriliyor; aramak için yazın.</li>}
    </ul>}
  </div>;
}
