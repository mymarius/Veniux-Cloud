import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Award,
  DollarSign,
  Briefcase,
  Target,
  Percent,
  Mail,
  UserPlus
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';

export default function CRMTeam() {
  const { teamMembers } = useCRM();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200/50 border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 text-gray-900">
              Sales Team Performance & Quota Leaderboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 bg-brand-500/10 text-brand-500 dark:text-brand-500 text-xs font-bold font-mono border border-brand-500/20 border-brand-500/20">
              Team Quota: $2.8M
            </span>
          </div>
          <p className="text-xs text-gray-500 text-gray-500 mt-1">
            Individual rep closed revenue, active pipeline weighting, and commission attainment rankings.
          </p>
        </div>

        <button
          onClick={() => alert('Invite new Account Executive or SDR')}
          className="btn-primary"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite Representative</span>
        </button>
      </div>

      {/* Rep Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teamMembers.map((rep, idx) => (
          <div key={rep.id} className="crm-card p-5 space-y-4 relative overflow-hidden">
            {idx === 0 && (
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold border border-amber-400/30 flex items-center gap-1">
                <Award className="w-3 h-3" /> #1 Top Closer
              </div>
            )}

            <div className="flex items-start gap-3.5">
              <img
                src={rep.avatar}
                alt={rep.name}
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-200 dark:ring-slate-700"
              />
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-gray-900 text-[14px] truncate">{rep.name}</div>
                <div className="text-[11px] text-gray-500 truncate">{rep.role}</div>
                <div className="text-[10.5px] text-gray-500 font-mono mt-0.5">{rep.email}</div>
              </div>
            </div>

            {/* Quota Progress */}
            <div className="space-y-1.5 pt-2 border-t border-gray-200/50 border-gray-200 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-gray-500">Q3 Quota Attainment</span>
                <span className="font-mono text-gray-900 text-gray-900 font-bold">{rep.quotaAttainment}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    rep.quotaAttainment >= 85 ? 'bg-emerald-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${Math.min(100, rep.quotaAttainment)}%` }}
                />
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-100/50 border border-gray-200/50 border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Closed ARR</span>
                <span className="font-semibold text-gray-900 text-gray-900 text-sm mt-0.5 block">
                  ${rep.closedRevenue.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-100/50 border border-gray-200/50 border-gray-200">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">Active Pipeline</span>
                <span className="font-semibold text-brand-500 text-sm mt-0.5 block">
                  ${rep.activePipeline.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


