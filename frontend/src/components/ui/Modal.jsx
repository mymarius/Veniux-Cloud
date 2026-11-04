import React from 'react';
import DialogShell from './DialogShell';

const SIZES = { sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' };

export function Modal({ isOpen, onClose, title, subtitle, icon, children, size = 'md' }) {
  return (
    <DialogShell isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} icon={icon} size={SIZES[size] || size}>
      {children}
    </DialogShell>
  );
}
