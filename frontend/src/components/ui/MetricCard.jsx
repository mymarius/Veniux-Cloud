import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, // number (positive/negative)
  trendLabel, 
  className = "" 
}) {
  const isPositive = trend > 0;
  const isNegative = trend < 0;

  return (
    <div className={`veniux-card metric-card rounded-xl p-5 sm:p-6 border border-gray-100 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_-4px_rgba(39, 78, 124,0.09)] hover:border-brand-200/80 transition-all duration-300 flex flex-col justify-between group ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {title}
        </h3>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center text-brand-600">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="flex items-baseline justify-between mt-4">
        <div className="metric-value text-3xl font-bold text-gray-900 tracking-tight tabular-nums">
          {value}
        </div>
        
        {trend !== undefined && (
          <div className={`inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border ${
            isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' :
            isNegative ? 'bg-red-50 text-red-600 border-red-200/60' :
            'bg-gray-50 text-gray-600 border-gray-200'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3 stroke-[2.5]" /> :
             isNegative ? <TrendingDown className="w-3 h-3 stroke-[2.5]" /> :
             <Minus className="w-3 h-3 stroke-[2.5]" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      
      {trendLabel && (
        <div className="text-[11px] font-medium text-gray-400 mt-2">
          {trendLabel}
        </div>
      )}
    </div>
  );
}
