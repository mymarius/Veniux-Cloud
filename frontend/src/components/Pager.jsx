import React from 'react';

// Liste altı sayfa denetimi; tek sayfalık listede görünmez.
export default function Pager({ info, onPage }) {
  if (!info || info.pages <= 1) return null;
  return <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600" aria-label="Sayfalama">
    <span aria-live="polite">{info.from.toLocaleString('tr-TR')}–{info.to.toLocaleString('tr-TR')} / {info.total.toLocaleString('tr-TR')}</span>
    <span className="flex items-center gap-2">
      <button type="button" className="btn-secondary" disabled={info.page <= 0} onClick={() => onPage(info.page - 1)}>Önceki</button>
      <span>Sayfa {info.page + 1} / {info.pages}</span>
      <button type="button" className="btn-secondary" disabled={info.page >= info.pages - 1} onClick={() => onPage(info.page + 1)}>Sonraki</button>
    </span>
  </nav>;
}
