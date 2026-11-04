import React from 'react';
import { Dropdown } from '../../ui/Dropdown';

/**
 * CRM & Personel çalışma alanının ortak parçaları.
 * Ana panelin görsel dilini (veniux-card, oval rozetler, turuncu vurgu)
 * birebir izler — CRM'in eski ayrı kabuğundaki crm-card görünümünü değil.
 */

export function Panel({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function PanelHead({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-500">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, detail, icon: Icon, tone = 'slate' }) {
  const tones = {
    orange: 'bg-brand-50 text-brand-600 border-brand-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-rose-50 text-rose-600 border-rose-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200'
  };
  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && (
          <span className={`rounded-md border p-2 ${tones[tone] || tones.slate}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <strong className="text-3xl font-light tracking-tight tabular-nums text-slate-800">{value}</strong>
        {detail && (
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-right text-[10.5px] font-semibold text-slate-500">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 36, tone }) {
  const initials = String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase('tr');

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-bold text-slate-600 bg-slate-100 border border-slate-200"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.35)
      }}
    >
      {initials}
    </span>
  );
}

export function Bar({ value, max = 100, tone = '#94A3B8', className = '' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <span className={`block h-1.5 flex-1 overflow-hidden rounded bg-slate-100 ${className}`}>
      <span className="block h-full rounded transition-all duration-300" style={{ width: `${pct}%`, background: tone }} />
    </span>
  );
}

export function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    orange: 'bg-brand-50 text-brand-600 border-brand-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-rose-50 text-rose-600 border-rose-200',
    violet: 'bg-violet-50 text-violet-600 border-violet-200'
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export function Empty({ icon: Icon, title, hint, action }) {
  return (
    <div className="px-5 py-12 text-center flex flex-col items-center justify-center">
      {Icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Etiket + değer. Değer kırpılmaz, sarar: özlük ve iletişim alanlarında
 * kırpma gerçek veriyi gizler (e-posta, eğitim, acil durum kişisi gibi).
 */
export function Field({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className={`mt-1 text-[12.5px] font-semibold leading-snug text-gray-800 break-words ${mono ? 'tabular-nums' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

/* ── Form parçaları — CRM ve Personel formları aynı görünümü paylaşır ── */

const FIELD_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20';

function Labelled({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

export function FormInput({ label, required, ...props }) {
  return (
    <Labelled label={label} required={required}>
      <input {...props} className={FIELD_CLS} />
    </Labelled>
  );
}

export function FormTextarea({ label, required, rows = 2, ...props }) {
  return (
    <Labelled label={label} required={required}>
      <textarea {...props} rows={rows} className={`${FIELD_CLS} resize-none`} />
    </Labelled>
  );
}

/** Yerel select yerine geçen Dropdown'ı sarar; children olarak <option> alır. */
export function FormSelect({ label, required, children, ...props }) {
  return (
    <Labelled label={label} required={required}>
      <Dropdown {...props} className={FIELD_CLS}>
        {children}
      </Dropdown>
    </Labelled>
  );
}

export const tl = (n) =>
  `₺${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

export const trDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
