// Yolculuk kartı kaydırmayla değişir; kasa canlandırması ekrana gelince bir kez, sonra düğmeyle oynar.
(() => {
  const steps = [...document.querySelectorAll('.hx-step')], cards = [...document.querySelectorAll('.hx-stage .hx-card')];
  if (steps.length && 'IntersectionObserver' in window) {
    const show = index => cards.forEach((card, i) => { card.toggleAttribute('data-on', i === index); });
    const watcher = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) show(Number(entry.target.dataset.step));
    }, { rootMargin: '-45% 0px -50% 0px' });
    steps.forEach(step => watcher.observe(step));
  }

  const pos = document.getElementById('hx-pos'), play = document.getElementById('hx-play');
  if (!pos || !play) return;
  const lines = [...pos.querySelectorAll('.hx-pos-line')], total = document.getElementById('hx-total'), pay = document.getElementById('hx-paybtn'), foot = document.getElementById('hx-foot');
  const amounts = ['0,00 ₺', '46,00 ₺', '114,00 ₺', '204,00 ₺'], reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const reset = () => {
    timers.forEach(clearTimeout); timers = [];
    pos.classList.add('js-play');
    lines.forEach(line => line.removeAttribute('data-on'));
    total.textContent = amounts[0]; pay.textContent = 'Ödeme al · F8'; pay.removeAttribute('data-done');
    foot.textContent = 'Barkod bekleniyor…'; foot.removeAttribute('data-done');
  };
  const run = () => {
    reset();
    lines.forEach((line, i) => timers.push(setTimeout(() => {
      line.setAttribute('data-on', ''); total.textContent = amounts[i + 1]; foot.textContent = 'Okundu: ' + line.firstElementChild.textContent;
    }, 700 * (i + 1))));
    timers.push(setTimeout(() => { pay.textContent = 'Ödeme alındı'; pay.setAttribute('data-done', ''); }, 3100));
    timers.push(setTimeout(() => { foot.textContent = 'Stok düştü: filtre kahve 18 → 17'; foot.setAttribute('data-done', ''); }, 3800));
  };
  play.addEventListener('click', run);
  if (!reduced && 'IntersectionObserver' in window) {
    const once = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { once.disconnect(); run(); }
    }, { threshold: 0.5 });
    once.observe(pos);
  }
})();
