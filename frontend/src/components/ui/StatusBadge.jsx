import React from 'react';

export function StatusBadge({ status, text, className = "" }) {
  const getStyles = () => {
    switch (status) {
      case 'success':
      case 'active':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
      case 'warning':
      case 'pending':
      case 'in_progress':
      case 'PROCESSING':
        return 'bg-amber-50 text-amber-700 border-amber-200/70';
      case 'danger':
      case 'error':
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200/70';
      case 'info':
      case 'new':
        return 'bg-brand-50 text-brand-700 border-brand-200/70';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span data-status={status || "neutral"} className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getStyles()} ${className}`}>
      {text || status}
    </span>
  );
}
