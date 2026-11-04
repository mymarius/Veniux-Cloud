import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  DollarSign,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useCRM } from '../../context/CRMContext';

export default function CRMAnalytics() {
  const { revenueTimeline, pipelineStageSummary, funnelStages, teamMembers, dateRange, setDateRange } = useCRM();

  const [activeReport, setActiveReport] = useState('revenue'); // 'revenue' | 'pipeline' | 'win_loss' | 'sources'

  const winLossData = [
    { name: 'Product Capability & UX', value: 45, color: '#10b981' },
    { name: 'Price & Contract Flexibility', value: 25, color: '#3b82f6' },
    { name: 'Security & Compliance', value: 20, color: '#8b5cf6' },
    { name: 'Lost to Competitor', value: 10, color: '#ef4444' }
  ];

  const sourceAttribution = [
    { source: 'Inbound Demo Request', leads: 420, wonDeals: 68, arr: 980000, conversion: '16.2%' },
    { source: 'Partner Referral', leads: 180, wonDeals: 42, arr: 640000, conversion: '23.3%' },
    { source: 'Product Hunt Launch', leads: 310, wonDeals: 28, arr: 290000, conversion: '9.0%' },
    { source: 'LinkedIn Campaign', leads: 240, wonDeals: 22, arr: 310000, conversion: '9.1%' },
    { source: 'Cold Outreach', leads: 520, wonDeals: 16, arr: 240000, conversion: '3.1%' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Enterprise Reports & Revenue Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-green-600 text-xs font-bold font-mono border border-emerald-200 dark:border-emerald-800">
              ARR Forecast: $3.85M
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Deep econometric modeling, cohort retention rates, pipeline velocity, and quota attainment reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              window.print();
            }}
            className="btn-secondary"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Executive PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="crm-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Net Revenue Retention (NRR)</span>
          <div className="text-2xl font-semibold text-gray-900 text-gray-900 font-mono tabular-nums">
            134.5%
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">+6.2% vs. SaaS benchmark</span>
        </div>

        <div className="crm-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Average Contract Value (ACV)</span>
          <div className="text-2xl font-semibold text-gray-900 text-gray-900 font-mono tabular-nums">
            $84,500
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">+14.8% YoY growth</span>
        </div>

        <div className="crm-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Sales Cycle Velocity</span>
          <div className="text-2xl font-semibold text-brand-500 font-mono tabular-nums">
            28.4 Days
          </div>
          <span className="text-[11px] text-gray-500">From MQL to Closed Won</span>
        </div>

        <div className="crm-card p-4 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Customer Acquisition Cost (CAC)</span>
          <div className="text-2xl font-semibold text-gray-900 text-gray-900 font-mono tabular-nums">
            $6,800
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">Payback: 4.2 months</span>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/50 border-gray-200 pb-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'revenue', label: 'Revenue Forecasting & MRR' },
          { id: 'pipeline', label: 'Pipeline Stage Velocity' },
          { id: 'win_loss', label: 'Win / Loss Reason Analysis' },
          { id: 'sources', label: 'Lead Source Attribution ROI' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`px-3.5 py-1.5 rounded-md transition ${
              activeReport === tab.id
                ? 'bg-gray-100 dark:bg-gray-100 text-white dark:text-gray-900 shadow-2xs font-bold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: REVENUE FORECAST */}
      {activeReport === 'revenue' && (
        <div className="crm-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 border-gray-200">
            <div>
              <h3 className="font-bold text-sm text-gray-900 text-gray-900">Annual Recurring Revenue (ARR) Trajectory</h3>
              <p className="text-xs text-gray-500">Monthly pacing against 2026 Board Targets</p>
            </div>
            <span className="badge-success font-mono font-bold">+28.5% YoY Growth</span>
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorArr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v / 1000000}M`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    border: '1px solid #1e293b',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(val) => [`$${Number(val).toLocaleString()}`, 'ARR Run Rate']}
                />
                <Area type="monotone" dataKey="arr" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorArr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* REPORT 2: PIPELINE STAGES */}
      {activeReport === 'pipeline' && (
        <div className="crm-card p-6 space-y-6">
          <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
            Pipeline Health & Stage Valuation
          </h3>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineStageSummary}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    border: '1px solid #1e293b',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Pipeline Value']}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* REPORT 3: WIN / LOSS */}
      {activeReport === 'win_loss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="crm-card p-6 space-y-4">
            <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
              Primary Win / Loss Drivers
            </h3>
            <div className="h-[260px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={winLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="crm-card p-6 space-y-4">
            <h3 className="font-bold text-sm text-gray-900 text-gray-900 pb-3 border-b border-gray-200/50 border-gray-200">
              Key Takeaways
            </h3>
            <div className="space-y-3 text-xs">
              {winLossData.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-gray-200/50 border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-gray-900 dark:text-gray-900">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-gray-900 text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REPORT 4: SOURCE ATTRIBUTION */}
      {activeReport === 'sources' && (
        <div className="crm-card overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 border-gray-200">
            <h3 className="font-bold text-sm text-gray-900 text-gray-900">Channel ROI & Lead Source Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 dark:bg-white border-b border-gray-200/50 border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lead Source</th>
                  <th className="py-3 px-4">Total Ingested Leads</th>
                  <th className="py-3 px-4">Closed Won Deals</th>
                  <th className="py-3 px-4">Generated ARR</th>
                  <th className="py-3 px-4">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 dark:divide-slate-800 font-mono">
                {sourceAttribution.map((src, idx) => (
                  <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-white/40">
                    <td className="py-3 px-4 font-sans font-bold text-gray-900 text-gray-900">{src.source}</td>
                    <td className="py-3 px-4">{src.leads}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{src.wonDeals}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-gray-900">${src.arr.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">{src.conversion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



