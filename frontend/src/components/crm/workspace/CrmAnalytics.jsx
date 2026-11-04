import React, { useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Award, Filter, Percent, Table2, Target, TrendingUp, Wallet } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Panel, PanelHead, Stat, Avatar, Bar, Chip, tl } from './Parts';

/**
 * CRM Analitik.
 *
 * Renk kararları: aşama ve huni sıralı büyüklük gösterir → tek hue'lu turuncu
 * rampa (gökkuşağı değil). Gelir grafiğinde tek seri (MRR) turuncu, hedef ise
 * kategorik ikinci renk değil, nötr kesikli referans çizgisi. Rampanın en açık
 * iki adımı beyaz zeminde 3:1 kontrastın altında kaldığı için her çubukta
 * görünür değer etiketi var ve gelir grafiğinin tablo görünümü sunuluyor.
 */

// Sıralı rampa — açıktan koyuya, lightness monotonik.
const RAMP = ['#789ac5', '#426b9c', '#274e7c', '#203f65', '#1d3552'];
const ACTUAL = '#274e7c';
const REFERENCE = '#A8A29E';
const INK = '#1F2937';
const MUTED = '#6B7280';

const rampAt = (i, n) => RAMP[Math.min(RAMP.length - 1, Math.round((i / Math.max(1, n - 1)) * (RAMP.length - 1)))];

const short = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `₺${(v / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `₺${Math.round(v / 1_000)}B`;
  return `₺${v}`;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-bold text-slate-800">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-md" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="ml-auto font-bold tabular-nums text-slate-800">{tl(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CrmAnalytics() {
  const { revenueTimeline, funnelStages, pipelineStageSummary, teamMembers, deals } = useCRM();
  const [tableView, setTableView] = useState(false);

  const lastMonth = revenueTimeline[revenueTimeline.length - 1] || { mrr: 0, target: 1 };
  const targetHit = lastMonth.target > 0 ? Math.round((lastMonth.mrr / lastMonth.target) * 100) : null;
  const won = deals.filter((d) => d.stage === 'won');
  const closed = deals.filter((d) => d.stage === 'won' || d.stage === 'lost');
  const winRate = closed.length ? Math.round((won.length / closed.length) * 100) : 0;
  const avgDeal = won.length ? won.reduce((s, d) => s + Number(d.value || 0), 0) / won.length : 0;

  const totalQuota = teamMembers.reduce((s, m) => s + m.quotaQuarter, 0);
  const totalClosed = teamMembers.reduce((s, m) => s + m.closedRevenue, 0);
  const teamAttainment = Math.round((totalClosed / (totalQuota || 1)) * 100);

  const maxFunnel = funnelStages.length ? Math.max(...funnelStages.map((f) => f.value)) : 1;
  const maxStage = pipelineStageSummary.length ? Math.max(...pipelineStageSummary.map((s) => s.value)) : 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Kazanılan fırsat tutarı" value={short(lastMonth.mrr)} detail={targetHit == null ? 'Hedef tanımlanmamış' : `hedefin %${targetHit}'i`} icon={Wallet} tone={targetHit >= 100 ? 'green' : 'amber'} />
        <Stat label="Ekip Kotası" value={`%${teamAttainment}`} detail={`${short(totalClosed)} / ${short(totalQuota)}`} icon={Target} tone={teamAttainment >= 100 ? 'green' : 'amber'} />
        <Stat label="Kazanma Oranı" value={`%${winRate}`} detail={`${won.length}/${closed.length} kapanan`} icon={Percent} tone="green" />
        <Stat label="Ortalama Sözleşme" value={short(avgDeal)} detail="kazanılan fırsat" icon={TrendingUp} />
      </div>

      {/* Gelir zaman serisi */}
      <Panel>
        <PanelHead icon={TrendingUp} title="Aylık kazanılan fırsat tutarı" subtitle="Fırsat kayıtları; tahsilat veya yinelenen gelir değildir">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span className="h-0.5 w-4 rounded-md" style={{ background: ACTUAL }} /> Gerçekleşen
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <span className="h-0.5 w-4 rounded-md border-t-2 border-dashed" style={{ borderColor: REFERENCE }} /> Hedef
            </span>
            <button
              onClick={() => setTableView((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-600"
            >
              <Table2 className="h-3.5 w-3.5" /> {tableView ? 'Grafik' : 'Tablo'}
            </button>
          </div>
        </PanelHead>

        {tableView ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  {['Ay', 'Gerçekleşen', 'Hedef', 'Fark', 'Gerçekleşme'].map((h, i) => (
                    <th key={h} className={`border-b border-slate-100 bg-slate-50/90 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revenueTimeline.map((r) => {
                  const diff = r.target == null ? null : r.mrr - r.target;
                  const pct = r.target > 0 ? Math.round((r.mrr / r.target) * 100) : null;
                  return (
                    <tr key={r.month} className="transition-colors hover:bg-slate-50/60">
                      <td className="border-b border-slate-100 px-5 py-2.5 text-[12.5px] font-bold text-slate-800">{r.month}</td>
                      <td className="border-b border-slate-100 px-5 py-2.5 text-right text-[12.5px] font-bold tabular-nums text-slate-800">{tl(r.mrr)}</td>
                      <td className="border-b border-slate-100 px-5 py-2.5 text-right text-[12.5px] tabular-nums text-slate-500">{r.target == null ? '—' : tl(r.target)}</td>
                      <td className={`border-b border-slate-100 px-5 py-2.5 text-right text-[12.5px] font-bold tabular-nums ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {diff == null ? '—' : (diff >= 0 ? '+' : '−') + tl(Math.abs(diff))}
                      </td>
                      <td className="border-b border-slate-100 px-5 py-2.5 text-right text-[12.5px] font-bold tabular-nums text-slate-700">{pct == null ? '—' : `%${pct}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-3 py-5">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueTimeline} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#F1EFED" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 11, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={short} tick={{ fill: MUTED, fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#D6D3D1', strokeWidth: 1 }} />
                {/* isAnimationActive=false: çizim animasyonu sekme arka plandayken
                    yarıda donup çizgiyi görünmez bırakıyor; panoda gereği de yok. */}
                <Line isAnimationActive={false} type="monotone" dataKey="target" name="Hedef" stroke={REFERENCE} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} />
                <Line isAnimationActive={false} type="monotone" dataKey="mrr" name="Gerçekleşen" stroke={ACTUAL} strokeWidth={2} dot={{ r: 3, fill: ACTUAL, strokeWidth: 0 }} activeDot={{ r: 5, fill: ACTUAL, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Huni */}
        <Panel>
          <PanelHead icon={Filter} title="Satış hunisi" subtitle="Aşama geçiş oranlarıyla" />
          <div className="space-y-4 p-5">
            {funnelStages.map((f, i) => (
              <div key={f.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-bold text-slate-800">{f.name}</span>
                  <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-slate-500">
                    <span className="text-slate-800">{f.value.toLocaleString('tr-TR')}</span> · {f.rate}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={f.value} max={maxFunnel} tone={rampAt(i, funnelStages.length)} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-slate-500">
              Oranlar bir önceki aşamadan geçiş yüzdesini gösterir; toplam dönüşüm{' '}
              <b className="font-bold tabular-nums text-slate-700">
                %{funnelStages.length > 0 && funnelStages[0].value > 0 ? ((funnelStages[funnelStages.length - 1].value / funnelStages[0].value) * 100).toFixed(1) : '0.0'}
              </b>.
            </p>
          </div>
        </Panel>

        {/* Aşama dağılımı */}
        <Panel>
          <PanelHead icon={Wallet} title="Aşamaya göre pipeline" subtitle="Fırsat sayısı ve toplam değer" />
          <div className="space-y-4 p-5">
            {pipelineStageSummary.map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-bold text-slate-800">{s.stage}</span>
                  <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-slate-500">
                    <span className="text-slate-800">{tl(s.value)}</span> · {s.count} fırsat
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={s.value} max={maxStage} tone={rampAt(i, pipelineStageSummary.length)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Ekip kota tablosu */}
      <Panel>
        <PanelHead icon={Award} title="Ekip kota gerçekleşmesi" subtitle="Çeyrek bazında temsilci performansı" />
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                {['Temsilci', 'Kapanan', 'Kota', 'Gerçekleşme', 'Açık pipeline'].map((h, i) => (
                  <th key={h} className={`border-b border-slate-100 bg-slate-50/90 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${i > 1 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamMembers
                .slice()
                .sort((a, b) => b.quotaAttainment - a.quotaAttainment)
                .map((m, idx) => {
                  const hit = m.quotaAttainment >= 100;
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="border-b border-slate-100 px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.name} size={32} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[12.5px] font-bold text-slate-800">{m.name}</span>
                              {idx === 0 && <Chip tone="amber">Lider</Chip>}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-slate-500">{m.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3 text-[12.5px] font-bold tabular-nums text-slate-800">{tl(m.closedRevenue)}</td>
                      <td className="border-b border-slate-100 px-5 py-3 text-right text-[12.5px] tabular-nums text-slate-500">{tl(m.quotaQuarter)}</td>
                      <td className="border-b border-slate-100 px-5 py-3">
                        <div className="flex items-center justify-end gap-2.5">
                          <span className="w-28"><Bar value={Math.min(100, m.quotaAttainment)} tone={hit ? '#15803D' : ACTUAL} /></span>
                          <span className={`w-12 text-right text-[12px] font-bold tabular-nums ${hit ? 'text-emerald-600' : 'text-slate-700'}`}>
                            %{m.quotaAttainment}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-5 py-3 text-right text-[12.5px] font-bold tabular-nums text-slate-700">{tl(m.activePipeline)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
