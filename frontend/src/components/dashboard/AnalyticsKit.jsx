import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import './analytics.css';


// Sayıyı sıfırdan hedef değere doğru yumuşakça sayar.
export function CountUp({ value = 0, format = v => Math.round(v).toLocaleString('tr-TR') }) {
  return format(value);
}

// Küçük, kendini çizen çizgi grafik (KPI kartları için).
export function Sparkline({ data = [], color = '#3563b1' }) {
  if (data.length < 2 || !data.some(Boolean)) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24 - 2}`).join(' ');
  return <svg className="ax-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={`0,30 ${points} 100,30`} fill={color} opacity=".08" stroke="none" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" pathLength="100" className="ax-spark-line" />
  </svg>;
}

export function Trend({ value, inverse = false, suffix = 'önceki döneme göre' }) {
  const good = inverse ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return <span className="ax-trend" data-state={value === 0 ? 'flat' : good ? 'up' : 'down'}><Icon size={12} />%{Math.abs(value)} <em>{suffix}</em></span>;
}

export function Kpi({ label, value, format, icon: Icon, tone = 'blue', detail, trend, trendInverse, spark, sparkColor, to }) {
  const Tag = to ? Link : 'article';
  return <Tag className="ax-kpi" data-tone={tone} {...(to ? { to } : {})}>
    <div className="ax-kpi-top"><span>{label}</span>{Icon && <i><Icon size={17} /></i>}</div>
    <strong><CountUp value={Number(value) || 0} format={format} /></strong>
    <div className="ax-kpi-bottom">
      {trend !== undefined ? <Trend value={trend} inverse={trendInverse} /> : <small>{detail}</small>}
    </div>
    <Sparkline data={spark} color={sparkColor} />
  </Tag>;
}

export function Panel({ title, subtitle, action, children, className = '', icon: Icon }) {
  return <section className={`ax-panel ${className}`}>
    {(title || action) && <header className="ax-panel-head">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <i className="ax-panel-icon"><Icon size={16} /></i>}
        <div className="min-w-0"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      {action}
    </header>}
    {children}
  </section>;
}

export function Segmented({ value, onChange, options, label }) {
  return <div className="ax-segmented" role="group" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

// Sıralı liste + animasyonlu yatay çubuklar.
export function BarList({ rows, format = v => v.toLocaleString('tr-TR'), color = '#3563b1', empty = 'Henüz veri yok.' }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <p className="ax-empty">{empty}</p>;
  return <ul className="ax-barlist">
    {rows.map((row, i) => <li key={row.label + i} style={{ '--w': `${(row.value / max) * 100}%`, '--c': row.color || color, '--d': `${i * 60}ms` }}>
      <div><span>{row.label}</span><b>{format(row.value)}</b></div>
      <i />
      {row.hint && <small>{row.hint}</small>}
    </li>)}
  </ul>;
}

// 0-100 arası puanı dolarak çizilen halka.
export function ScoreRing({ score, label, caption }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 80 ? '#21a69b' : score >= 55 ? '#e9ad51' : '#e58282';
  return <div className="ax-score">
    <svg viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="64" cy="64" r={r} stroke="#eef2f6" strokeWidth="11" fill="none" />
      <circle cx="64" cy="64" r={r} stroke={color} strokeWidth="11" fill="none" strokeLinecap="round"
        strokeDasharray={c} style={{ '--off': c - (c * score) / 100, '--full': c }} className="ax-score-arc" transform="rotate(-90 64 64)" />
    </svg>
    <div className="ax-score-text"><strong><CountUp value={score} /></strong><span>{label}</span></div>
    {caption && <p>{caption}</p>}
  </div>;
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export function Heatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  if (!grid.flat().some(Boolean)) return <p className="ax-empty">Hareket oluştukça yoğun saatler burada görünecek.</p>;
  return <div className="ax-heatmap" role="img" aria-label="Gün ve saate göre hareket yoğunluğu">
    <span />
    {Array.from({ length: 24 }, (_, h) => <em key={h}>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</em>)}
    {grid.map((row, d) => <React.Fragment key={d}>
      <b>{DAYS[d]}</b>
      {row.map((v, h) => <i key={h} title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00 · ${v} hareket`} style={{ '--a': v ? 0.15 + (v / max) * 0.85 : 0, '--d': `${(d * 24 + h) * 4}ms` }} />)}
    </React.Fragment>)}
  </div>;
}

export function Legend({ items }) {
  return <div className="ax-legend">{items.map(([label, color, value]) => <span key={label}><i style={{ background: color }} />{label}{value !== undefined && <b>{value}</b>}</span>)}</div>;
}
