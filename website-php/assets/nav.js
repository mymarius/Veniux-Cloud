// Üst menü davranışı: kayarken küçülme, ilerleme çizgisi, Çözümler menüsünü tıkla/klavye ile aç-kapa, mobil menü yüksekliği.
(() => {
  const header = document.querySelector('[data-nav]');
  if (!header) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || 0;
    header.toggleAttribute('data-scrolled', y > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    header.style.setProperty('--vs-head', header.getBoundingClientRect().height + 'px');
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  update();

  const menu = header.querySelector('[data-menu]');
  const trigger = menu && menu.querySelector('.vs-nav-trigger');
  if (menu && trigger) {
    const set = open => { menu.toggleAttribute('data-open', open); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    menu.addEventListener('mouseenter', () => set(true));
    menu.addEventListener('mouseleave', () => set(false));
    trigger.addEventListener('click', () => set(!menu.hasAttribute('data-open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.hasAttribute('data-open')) { set(false); trigger.focus(); } });
    document.addEventListener('click', e => { if (!menu.contains(e.target)) set(false); });
    menu.addEventListener('focusin', () => trigger.setAttribute('aria-expanded', 'true'));
    menu.addEventListener('focusout', e => { if (!menu.contains(e.relatedTarget) && !menu.hasAttribute('data-open')) trigger.setAttribute('aria-expanded', 'false'); });
  }

  const mobile = header.querySelector('[data-mobile]');
  if (mobile) {
    mobile.addEventListener('toggle', update);
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mobile.open = false; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') mobile.open = false; });
  }
})();
