import React, { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut, PolarArea, Radar } from 'react-chartjs-2';

ChartJS.defaults.font.family = 'Segoe UI, system-ui, sans-serif';
ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const formatNumber = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value);

// '#3563b1' -> 'rgba(53,99,177,a)'
export function alpha(hex, a) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Çizgi grafiklerin altını yukarıdan aşağı solan bir gradyanla doldurur.
const gradientFill = color => ({ chart }) => {
  const { ctx, chartArea } = chart;
  if (!chartArea) return alpha(color, 0.12);
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, alpha(color, 0.28));
  gradient.addColorStop(1, alpha(color, 0));
  return gradient;
};

// Grafik türüne göre giriş animasyonu: çizgiler soldan sağa çizilir,
// çubuklar sırayla büyür, halkalar dönerek açılır.
function entryAnimation(type, count) {
  return { animation: false };
  if (type === 'line') {
    // Noktalar soldan sağa sırayla taban çizgisinden yükselir. Başlangıç değeri
    // her zaman gerçek bir piksel olduğundan, animasyon yarıda kesilse bile
    // (ör. yeniden boyutlanma) noktalar doğru yerde kalır.
    const step = Math.min(40, 700 / Math.max(count, 1));
    return {
      animations: {
        y: {
          type: 'number', easing: 'easeOutQuart', duration: 800,
          from: ctx => (ctx.type === 'data' ? ctx.chart.scales[ctx.chart.getDatasetMeta(ctx.datasetIndex).yAxisID]?.getPixelForValue(0) : undefined),
          delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.index * step + ctx.datasetIndex * 120 : 0)
        }
      }
    };
  }
  if (type === 'bar') {
    return { animation: { duration: 700, easing: 'easeOutQuart', delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 45 + ctx.datasetIndex * 120 : 0) } };
  }
  return { animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutQuart' } };
}

export default function BusinessChart({
  type = 'line', labels, datasets, title, height = 260,
  stacked = false, horizontal = false, legend = true, valueFormat = formatNumber, center, options: extra = {}
}) {
  const Component = { line: Line, bar: Bar, doughnut: Doughnut, polar: PolarArea, radar: Radar }[type];
  const empty = !datasets.some(set => set.data.some(value => Number(value) !== 0));
  const circular = ['doughnut', 'polar'].includes(type);

  // Grafiği yalnızca ekrana girdiğinde çiz: animasyon kullanıcı görürken oynasın.
  const holder = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!holder.current || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.15 });
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);

  const prepared = datasets.map(set => {
    if (type === 'line') {
      const color = set.borderColor || '#3563b1';
      return {
        tension: 0.38, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12,
        pointBackgroundColor: '#fff', pointBorderWidth: 2, pointBorderColor: color,
        ...set,
        backgroundColor: set.fill === false ? color : set.backgroundColor || gradientFill(color),
        fill: set.fill ?? true
      };
    }
    if (type === 'bar') return { borderRadius: 6, borderSkipped: false, maxBarThickness: 34, ...set };
    if (type === 'radar') {
      const color = set.borderColor || '#3563b1';
      return { borderWidth: 2, pointRadius: 3, pointBackgroundColor: color, backgroundColor: alpha(color, 0.18), ...set };
    }
    return { borderWidth: 3, borderColor: '#fff', hoverOffset: 8, ...set };
  });

  const axis = { color: '#8290a4', font: { size: 11 } };
  const scales = type === 'doughnut' ? undefined : type === 'polar'
    ? { r: { grid: { color: 'rgba(128,128,128,.18)' }, angleLines: { display: false }, ticks: { display: false } } }
    : type === 'radar'
    ? { r: { beginAtZero: true, angleLines: { color: 'rgba(128,128,128,.18)' }, grid: { color: 'rgba(128,128,128,.18)' }, pointLabels: { color: '#52657f', font: { size: 11, weight: '600' } }, ticks: { display: false } } }
    : {
      x: { stacked, grid: { display: horizontal, color: 'rgba(128,128,128,.18)' }, border: { display: false }, ticks: { ...axis, maxTicksLimit: horizontal ? 5 : 8, maxRotation: 0, ...(horizontal ? { callback: v => valueFormat(v) } : {}) }, beginAtZero: horizontal },
      y: { stacked, beginAtZero: true, border: { display: false }, grid: { display: !horizontal, color: 'rgba(128,128,128,.18)' }, ticks: { ...axis, maxTicksLimit: horizontal ? 10 : 5, ...(horizontal ? {} : { callback: v => valueFormat(v) }) } }
    };

  const options = {
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    ...entryAnimation(type, labels.length),
    interaction: circular ? { mode: 'nearest', intersect: true } : { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: legend, position: 'bottom', labels: { usePointStyle: true, boxWidth: 7, padding: 18, color: '#64748b', font: { size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#dce5f0', borderWidth: 1,
        titleColor: '#243750', bodyColor: '#52657f',
        titleFont: { size: 13, weight: '700' },
        bodyFont: { size: 12, weight: '500' },
        padding: { top: 14, right: 18, bottom: 14, left: 14 },
        cornerRadius: 12, titleMarginBottom: 10, bodySpacing: 8,
        usePointStyle: true, boxWidth: 8, boxHeight: 8, boxPadding: 7,
        caretSize: 6, caretPadding: 10,
        callbacks: {
          label: context => {
            const raw = context.parsed;
            const value = typeof raw === 'number' ? raw : horizontal ? raw.x : raw.r ?? raw.y;
            const label = circular ? context.label : context.dataset.label || context.label;
            return ` ${label}   ${valueFormat(value)}`;
          },
          labelPointStyle: () => ({ pointStyle: 'circle', rotation: 0 }),
          labelColor: context => {
            const colors = circular ? context.dataset.backgroundColor : context.dataset.borderColor || context.dataset.backgroundColor;
            const color = Array.isArray(colors) ? colors[context.dataIndex] : typeof colors === 'string' ? colors : '#3563b1';
            return { borderColor: color, backgroundColor: color, borderWidth: 0 };
          }
        }
      }
    },
    ...(type === 'doughnut' ? { cutout: '74%' } : {}),
    ...(scales ? { scales } : {}),
    ...extra
  };

  return <div ref={holder} style={{ height }} className="relative min-w-0">
    {empty
      ? <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-50 text-center"><span className="text-sm font-semibold text-slate-600">Henüz veri yok</span><span className="mt-2 text-xs text-slate-400">Kayıtlar oluştuğunda grafik burada görünecek.</span></div>
      : visible && <Component role="img" aria-label={title} options={options} data={{ labels, datasets: prepared }} />}
    {!empty && center && <div className="chart-center" style={legend ? { bottom: 34 } : undefined}><strong>{center.value}</strong><span>{center.label}</span></div>}
    {!empty && <details className="sr-only focus-within:not-sr-only"><summary>{title} verileri</summary>{labels.map((label, i) => <p key={`${label}-${i}`}>{label}: {datasets.map(set => `${set.label || ''} ${set.data[i]}`).join(', ')}</p>)}</details>}
  </div>;
}
