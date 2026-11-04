import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = "md" // sm, md, lg, xl
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />
      
      {/* Drawer Panel with Oval Rounded Left Edge */}
      <div className={`relative flex flex-col bg-white h-full rounded-l-3xl shadow-2xl border-l border-gray-100 animate-slide-in-right overflow-hidden ${sizeClasses[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{title}</h2>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
