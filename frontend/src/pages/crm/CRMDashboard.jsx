import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Briefcase,
  UserPlus,
  Users,
  CheckSquare,
  Target,
  Download,
  Plus,
  ChevronRight
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
  Cell
} from 'recharts';
import { useCRM } from '../../context/CRMContext';
import { MetricCard, StatusBadge } from '../../components/ui';

export default function CRMDashboard() {
  const {
    deals,
    leads,
    tasks,
    activities,
    teamMembers,
    revenueTimeline,
    pipelineStageSummary,
    funnelStages,
    dateRange,
    setIsQuickCreateOpen,
    setQuickCreateType
  } = useCRM();

  const navigate = useNavigate();

  const totalClosedWon = deals.filter((d) => d.stage === 'won').reduce((acc, d) => acc + Number(d.value), 0);
  const totalPipelineValue = deals.filter((d) => d.stage !== 'lost').reduce((acc, d) => acc + Number(d.value), 0);
  const pendingTasksCount = tasks.filter((t) => t.status !== 'completed').length;

  const COLORS = ['#94a3b8', '#38bdf8', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto text-gray-900 pb-12">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Good morning, Sarah</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-600 border border-success/30 font-mono tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              LIVE PIPELINE
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Executive revenue pacing is <strong className="text-gray-900">14.2% ahead</strong> of Q3 quota. 2 multi-year enterprise contracts pending final signature.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              const csvContent = 'data:text/csv;charset=utf-8,Deal Title,Company,Value,Stage,Owner\n' + deals.map((d) => `"${d.title}","${d.companyName}",${d.value},"${d.stage}","${d.salesRep}"`).join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', `veniux_crm_report_${dateRange}.csv`);
              document.body.appendChild(link);
              link.click();
            }}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button onClick={() => { setQuickCreateType('deal'); setIsQuickCreateOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </button>
        </div>
      </div>

      {/* 6 Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Total Revenue (ARR)" value={`$${(3048000).toLocaleString()}`} icon={DollarSign} trend={18.4} trendLabel="vs prev month" />
        <MetricCard title="Active Pipeline" value={`$${totalPipelineValue.toLocaleString()}`} icon={Briefcase} trend={8.2} trendLabel={`${deals.length} deals`} />
        <MetricCard title="New Inbound Leads" value="284" icon={UserPlus} trend={24.1} trendLabel="vs 228 last period" />
        <MetricCard title="Lead-to-Win Rate" value="28.6%" icon={Target} trend={3.2} trendLabel="Industry avg: 22%" />
        <MetricCard title="Active Accounts" value="1,420" icon={Users} trend={12.0} trendLabel="99.4% retention" />
        <MetricCard title="Tasks Due Today" value={pendingTasksCount} icon={CheckSquare} trend={-4.5} trendLabel="3 urgent" />
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 veniux-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Revenue Performance (MRR & ARR)</h3>
              <p className="text-xs text-gray-500">Monthly recurring revenue trajectory vs. quarterly targets</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span> Actual MRR</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-full bg-border"></span> Target</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }} />
                <Area type="monotone" dataKey="mrr" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorMrr)" />
                <Area type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="4 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="veniux-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Pipeline Value by Stage</h3>
              <p className="text-xs text-gray-500">Total active deal volume</p>
            </div>
            <button onClick={() => navigate('/crm/deals')} className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-0.5">
              Board <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineStageSummary} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <YAxis dataKey="stage" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {pipelineStageSummary.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Funnel & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="veniux-card p-5 space-y-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-bold text-sm text-gray-900">Lead Conversion Funnel</h3>
            <p className="text-xs text-gray-500">Visitor-to-Won Deal velocity</p>
          </div>
          <div className="space-y-3 pt-1">
            {funnelStages.map((stage, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-500">{stage.name}</span>
                  <span className="font-mono tabular-nums font-bold text-gray-900">{stage.value.toLocaleString()} <span className="text-gray-500 text-[10px]">({stage.rate})</span></span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(10, 100 - idx * 18)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 veniux-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Sales Rep Quota Attainment</h3>
              <p className="text-xs text-gray-500">Quarterly pacing & closed revenue rankings</p>
            </div>
            <button onClick={() => navigate('/crm/team')} className="text-xs font-semibold text-brand-500 hover:underline">View Team Details</button>
          </div>
          <div className="divide-y divide-border">
            {teamMembers.slice(0, 4).map((rep, idx) => (
              <div key={rep.id} className="py-3 flex items-center justify-between text-xs gap-4">
                <div className="flex items-center gap-3 min-w-[160px]">
                  <span className="font-mono font-bold text-gray-500 text-[11px]">#{idx + 1}</span>
                  <img src={rep.avatar} alt={rep.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-border" />
                  <div>
                    <div className="font-bold text-gray-900">{rep.name}</div>
                    <div className="text-[10.5px] text-gray-500 truncate">{rep.role}</div>
                  </div>
                </div>
                <div className="flex-1 max-w-xs space-y-1 hidden sm:block">
                  <div className="flex justify-between text-[11px]"><span className="text-gray-500">Attainment</span><span className="font-bold text-gray-900">{rep.quotaAttainment}%</span></div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${rep.quotaAttainment >= 85 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, rep.quotaAttainment)}%` }} /></div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 font-mono tabular-nums text-sm">${rep.closedRevenue.toLocaleString()}</div>
                  <div className="text-[10.5px] text-gray-500">Target: ${rep.quotaQuarter.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
