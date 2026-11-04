import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function WMSMetricCard({
  title,
  value,
  unit = '',
  change = null,
  trend = 'neutral', // 'up', 'down', 'neutral'
  subtitle = null,
  icon: Icon = null,
  status = 'normal', // 'normal', 'success', 'warning', 'danger', 'info'
  onClick = null
}) {
  const statusGlow = {
    normal: 'border-gray-200 border-gray-200',
    success: 'border-emerald-500/30 bg-emerald-500/[0.02]',
    warning: 'border-amber-500/30 bg-amber-500/[0.02]',
    danger: 'border-rose-500/30 bg-rose-500/[0.02]',
    info: 'border-brand-500/30 bg-indigo-500/[0.02]'
  }[status] || 'border-gray-200 border-gray-200';

  const statusDot = {
    normal: 'bg-slate-400',
    success: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    warning: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    danger: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    info: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
  }[status];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white bg-gray-100 rounded-xl p-4 border ${statusGlow} shadow-xs transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-indigo-500/50 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${statusDot}`}></span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 text-gray-500">
            {title}
          </span>
        </div>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/80 text-gray-500 text-gray-500">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-gray-900 text-gray-900">
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-gray-500 text-gray-500">{unit}</span>}
      </div>

      {(change !== null || subtitle) && (
        <div className="mt-2 pt-2 border-t border-gray-200 border-gray-200/60 flex items-center justify-between text-[11px]">
          {change !== null && (
            <div
              className={`flex items-center space-x-1 font-bold ${
                trend === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trend === 'down'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-gray-500'
              }`}
            >
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend === 'neutral' && <Minus className="w-3 h-3" />}
              <span>{change}</span>
            </div>
          )}
          {subtitle && <span className="text-gray-500 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
