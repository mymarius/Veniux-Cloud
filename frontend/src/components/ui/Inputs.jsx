import React from 'react';
import { Dropdown } from './Dropdown';

export const Input = React.forwardRef(({ label, error, className = "", ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = props.id || generatedId;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-600">
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        ref={ref}
        className={`w-full bg-gray-100 border ${error ? 'border-danger focus:border-danger' : 'border-gray-200 focus:border-brand-500'} rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-text-muted outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} role="alert" className="text-xs text-red-600 mt-0.5">{error}</span>
      )}
    </div>
  );
});
Input.displayName = 'Input';

export const Select = ({ label, error, options = [], className = "", ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider font-mono">
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <Dropdown
        className={`w-full bg-gray-100 border ${error ? 'border-danger' : 'border-gray-200'} rounded-lg px-3 py-2 text-sm text-gray-900 transition-all`}
        {...props}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>{opt.label}</option>
        ))}
      </Dropdown>
      {error && (
        <span className="text-[10px] font-bold text-red-500 mt-0.5">{error}</span>
      )}
    </div>
  );
};
Select.displayName = 'Select';
