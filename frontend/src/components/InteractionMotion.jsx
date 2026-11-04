import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Decorative feedback stays outside buttons, forms and their React-owned DOM.
export default function InteractionMotion() {
  const [ripples, setRipples] = useState([]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sequence = 0;
    const clear = () => setRipples(previous => previous.length ? [] : previous);
    const press = event => {
      if (preference.matches || document.documentElement.dataset.motion==='off' || event.button !== 0) return;
      const button = event.target instanceof Element
        ? event.target.closest('button, a.btn-primary, a.btn-secondary') : null;
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      const rect = button.getBoundingClientRect();
      const size = Math.min(100, Math.max(48, rect.height * 1.6));
      setRipples(previous => [...previous.slice(-5), {
        id: ++sequence, x: event.clientX, y: event.clientY, size
      }]);
    };
    document.addEventListener('pointerdown', press, { passive: true });
    window.addEventListener('scroll', clear, true);
    preference.addEventListener('change', clear);
    return () => {
      document.removeEventListener('pointerdown', press);
      window.removeEventListener('scroll', clear, true);
      preference.removeEventListener('change', clear);
    };
  }, []);
  return createPortal(<div aria-hidden="true" className="interaction-motion-layer">
    {ripples.map(ripple => <span key={ripple.id} className="interaction-ripple"
      style={{ left: ripple.x - ripple.size / 2, top: ripple.y - ripple.size / 2, width: ripple.size, height: ripple.size }}
      onAnimationEnd={() => setRipples(previous => previous.filter(item => item.id !== ripple.id))} />)}
  </div>, document.body);
}
