// Üst menü davranışı: yüzen çubuk, ilerleme şeridi, Çözümler menüsü ve önizleme etiketi, mobil menü.
(() => {
  const header = document.querySelector('[data-nav]');
  if (!header) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Kaydırma: yüzen çubuğa dönüş ve ilerleme çizgisi
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || 0;
    header.toggleAttribute('data-scrolled', y > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
  };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  update();

  // Çözümler menüsü
  const menu = header.querySelector('[data-menu]');
  const trigger = menu && menu.querySelector('.vs-nav-trigger');
  if (menu && trigger) {
    const set = open => { menu.toggleAttribute('data-open', open); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    let timer = 0;
    menu.addEventListener('mouseenter', () => { clearTimeout(timer); set(true); });
    menu.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(() => set(false), 140); });
    trigger.addEventListener('click', () => set(!menu.hasAttribute('data-open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.hasAttribute('data-open')) { set(false); trigger.focus(); } });
    document.addEventListener('click', e => { if (!menu.contains(e.target)) set(false); });
    menu.addEventListener('focusin', () => trigger.setAttribute('aria-expanded', 'true'));
    menu.addEventListener('focusout', e => { if (!menu.contains(e.relatedTarget) && !menu.hasAttribute('data-open')) trigger.setAttribute('aria-expanded', 'false'); });

    // Canlı önizleme: üzerine gelinen ürünün küçük, hareketli örneğini gösterir
    const prev = menu.querySelector('[data-prev]');
    if (prev) {
      const show = key => { if (prev.getAttribute('data-prev') !== key) prev.setAttribute('data-prev', key); };
      menu.querySelectorAll('.vs-mega-item[data-pv]').forEach(a => {
        a.addEventListener('mouseenter', () => show(a.dataset.pv));
        a.addEventListener('focus', () => show(a.dataset.pv));
      });
      // Menü her açıldığında ilk önizleme baştan oynasın
      new MutationObserver(() => { if (menu.hasAttribute('data-open')) { const k = prev.getAttribute('data-prev'); prev.removeAttribute('data-prev'); void prev.offsetWidth; prev.setAttribute('data-prev', k); } }).observe(menu, { attributes: true, attributeFilter: ['data-open'] });
    }
  }

  // Mobil menü
  const mobile = header.querySelector('[data-mobile]');
  if (mobile) {
    mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mobile.open = false; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') mobile.open = false; });
  }
})();
