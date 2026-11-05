import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const EXIT_MS = 180;
const activeDialogs = [];
let previousBodyOverflow = '';

// Ortak pencere kabuğu: açılış/kapanış animasyonu, Esc ile kapanma,
// arka plana tıklayınca kapanma, kaydırma kilidi ve odak yönetimi.
export default function DialogShell({ isOpen, onClose, title, subtitle, icon: Icon, tone = 'blue', size = 'md', children, footer, labelledBy, ariaLabel, variant = 'dialog', blockEnter = false }) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const [layer,setLayer] = useState(60);
  const panel = useRef(null);
  const lastFocus = useRef(null);
  const uniqueTitleId = useId();

  useEffect(() => {
    if (isOpen) { setMounted(true); setClosing(false); return undefined; }
    if (!mounted) return undefined;
    setClosing(true);
    const timer = setTimeout(() => { setMounted(false); setClosing(false); }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // onClose çoğu yerde satır içi fonksiyon; ref sayesinde efekt yalnızca açılışta çalışır.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return undefined;
    lastFocus.current = document.activeElement;
    if (!activeDialogs.length) previousBodyOverflow = document.body.style.overflow;
    const identity = {};
    activeDialogs.push(identity);
    setLayer(60 + activeDialogs.length * 2);
    document.body.style.overflow = 'hidden';
    const focusable = () => [...(panel.current?.querySelectorAll('button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])') || [])].filter(node => node.getClientRects().length && node.tabIndex >= 0);
    const onKey = event => {
      if (activeDialogs.at(-1) !== identity) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const nodes=focusable(), first=nodes[0], last=nodes.at(-1);
        if (!nodes.length) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && (document.activeElement===first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement===last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    const moveFocus = () => {
      if (panel.current?.contains(document.activeElement)) return;
      const target = panel.current?.querySelector('[data-autofocus]:not([disabled])')
        || panel.current?.querySelector('input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])')
        || panel.current?.querySelector('button:not([disabled])');
      target?.focus({ preventScroll: true });
    };
    // İlk açılışta panel henüz odak alamayabilir; yazılanlar arkadaki alana gitmesin diye yeniden denenir.
    const frame = requestAnimationFrame(moveFocus);
    const retries = [60, 200].map(delay => setTimeout(moveFocus, delay));
    return () => {
      cancelAnimationFrame(frame);
      retries.forEach(clearTimeout);
      const index=activeDialogs.indexOf(identity);
      if(index!==-1)activeDialogs.splice(index,1);
      if(!activeDialogs.length)document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKey);
      if(lastFocus.current?.isConnected)lastFocus.current.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  if (!mounted) return null;
  const widths = { sm: 420, md: 500, lg: 620, xl: 760 };
  const titleId = labelledBy || uniqueTitleId;

  return createPortal(
    <div className="vx-dialog" style={{zIndex:layer}} data-variant={variant} data-state={closing ? 'closed' : 'open'} role="presentation">
      <div className="vx-dialog-backdrop" onClick={onClose} />
      <div tabIndex={-1} onKeyDownCapture={event => { if(blockEnter && event.key === "Enter"){event.preventDefault();event.stopPropagation();} }} ref={panel} className="vx-dialog-panel" role="dialog" aria-modal="true" aria-label={!title ? ariaLabel : undefined} aria-labelledby={title ? titleId : undefined} style={{ maxWidth: widths[size] || size }}>
        {title && <header className="vx-dialog-head">
          {Icon && <i data-tone={tone}><Icon size={19} /></i>}
          <div className="min-w-0 flex-1"><h3 id={titleId}>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="vx-dialog-close" onClick={onClose} aria-label="Kapat"><X size={17} /></button>
        </header>}
        <div className="vx-dialog-body">{children}</div>
        {footer && <footer className="vx-dialog-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
