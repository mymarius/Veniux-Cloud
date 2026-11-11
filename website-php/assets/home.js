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
  const amounts = ['0,00 ₺', '46,00 ₺', '114,00 ₺', '204,00 ₺'];
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
  if ('IntersectionObserver' in window) {
    const once = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { once.disconnect(); run(); }
    }, { threshold: 0.5 });
    once.observe(pos);
  }
})();

// Görünüm hareketleri. Ekranın altında kalanları gizler; betik çalışmazsa içerik olduğu gibi görünür.
(() => {
  if (!('IntersectionObserver' in window)) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const main = document.querySelector('main') || document.body;

  const reveal = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      reveal.unobserve(target);
      target.classList.add('vx-in');
      setTimeout(() => target.classList.remove('vx-rv', 'vx-print', 'vx-in'), 1700);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  const prepare = (element, name) => {
    const order = [...element.parentElement.children].indexOf(element) % 6;
    element.classList.add(name);
    element.style.setProperty('--vx-d', `${order * 70}ms`);
    reveal.observe(element);
  };
  // Her sayfanın içeriğini gezer: düzen kutularına iner, içerik bloklarını sırayla getirir.
  const skip = '.pr-page,.hx-shelf,.hx-obj,.hx-stage,.hx-hero h1,.hx-lead,.hx-cta,.vx-band,dialog,script,style,[hidden]';
  const atomic = 'form,table,figure,details,pre,img,svg,h1,h2,h3,h4,p,a,button,.hx-pos,.hx-step,.hx-card,.pr-tag,.pg-ticket,.hx-hang';
  const walk = (element, depth) => {
    if (element.matches(skip) || !element.getClientRects().length) return;
    if (element.matches('.hx-receipt')) { prepare(element, 'vx-print'); return; }
    const blocks = [...element.children].filter(child => getComputedStyle(child).display !== 'inline');
    if (element.matches('table') ) { element.querySelectorAll('tbody tr').forEach(row => prepare(row, 'vx-rv')); return; }
    if (depth < 6 && !element.matches(atomic) && blocks.length) { blocks.forEach(child => walk(child, depth + 1)); return; }
    prepare(element, 'vx-rv');
  };
  [...main.children].forEach(child => walk(child, 0));

  const steps = main.querySelectorAll('.hx-step');
  if (steps.length) {
    const active = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.toggleAttribute('data-active', entry.isIntersecting);
    }, { rootMargin: '-45% 0px -50% 0px' });
    steps.forEach(step => active.observe(step));
  }

  const journey = main.querySelector('.hx-journey');
  if (journey) {
    const band = document.createElement('div'), words = ['Mal kabul', 'Raf', 'Kasa', 'Sipariş önerisi', 'Sayım', 'Lot ve miat', 'El terminali'];
    band.className = 'vx-band'; band.setAttribute('aria-hidden', 'true');
    const line = document.createElement('div');
    for (let i = 0; i < 6; i++) for (const word of words) { const item = document.createElement('span'); item.textContent = word + ' ·'; line.append(item); }
    band.append(line); journey.before(band);
  }

  const total = document.getElementById('hx-total');
  if (total) new MutationObserver(() => total.animate([{ scale: 1.14, color: '#ffb48a' }, { scale: 1 }], { duration: 320, easing: 'ease-out' })).observe(total, { childList: true });

  const bar = document.createElement('div');
  bar.className = 'vx-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  let queued = false;
  const paint = () => { queued = false; const room = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${room > 0 ? Math.min(1, scrollY / room) : 0})`; };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();

  const shelf = document.querySelector('.hx-shelf'), label = shelf?.querySelector('.hx-label'), stamp = shelf?.querySelector('.hx-stamp');
  if (!calm && label && stamp && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = shelf.closest('.hx-hero');
    hero.addEventListener('pointermove', event => {
      const box = hero.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - .5, y = (event.clientY - box.top) / box.height - .5;
      label.style.translate = `${(x * 10).toFixed(1)}px ${(y * 6).toFixed(1)}px`;
      stamp.style.translate = `${(x * 22).toFixed(1)}px ${(y * 14).toFixed(1)}px`;
    });
    hero.addEventListener('pointerleave', () => { label.style.translate = ''; stamp.style.translate = ''; });
  }
})();

// Alt bilgideki dev VENIUX: ekrana her girişte canlanır, fareye harf harf tepki verir.
(() => {
  const word = document.querySelector('.vf-word');
  if (!word || !('IntersectionObserver' in window)) return;
  const force = /[?&]hareket=acik(&|$)/.test(location.search);
  if (force) document.documentElement.classList.add('pr-force');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches && !force;
  const text = word.textContent.trim();
  word.textContent = '';
  const letters = [...text].map((char, i) => {
    const letter = document.createElement('span');
    letter.className = 'vf-l'; letter.textContent = char; letter.style.setProperty('--i', i);
    word.append(letter);
    return letter;
  });
  // Dalga: harfler soldan sağa sırayla hafifçe yükselip iner, üzerlerinden ışık geçer.
  let busy = false, visible = false;
  const domino = (start = 0) => {
    if (busy) return;
    busy = true;
    word.classList.toggle('vf-soft', calm);
    const gap = 130, length = 1500;
    word.classList.add('vf-dancing');
    letters.forEach((letter, i) => {
      letter.style.setProperty('--d', `${Math.abs(i - start) * gap}ms`);
      letter.classList.add('vf-dance');
    });
    setTimeout(() => {
      letters.forEach(letter => letter.classList.remove('vf-dance'));
      word.classList.remove('vf-dancing');
      busy = false;
    }, length + letters.length * gap);
  };
  // Birkaç saniyede bir kendiliğinden oynar; hareketi azalt açıksa yumuşak, küçük zıplamayla.
  const loop = () => {
    if (visible && !busy) domino(0);
    setTimeout(loop, 9000 + Math.random() * 3000);
  };
  setTimeout(loop, 5000);
  let timer;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) setTimeout(() => { if (visible) domino(0); }, 1900);
  }, { threshold: .35 }).observe(word);
  new IntersectionObserver(([entry]) => {
    clearTimeout(timer);
    if (!entry.isIntersecting) { word.classList.remove('vf-on'); word.classList.add('vf-idle'); return; }
    word.classList.remove('vf-idle'); word.classList.add('vf-on');
    timer = setTimeout(() => { word.classList.remove('vf-on'); word.classList.add('vf-idle'); }, 3400);
  }, { threshold: .05 }).observe(word);
  if (calm || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  word.addEventListener('pointermove', event => {
    if (word.classList.contains('vf-on')) return;
    word.classList.add('vf-near');
    for (const letter of letters) {
      const box = letter.getBoundingClientRect();
      const pull = Math.max(0, 1 - Math.abs(event.clientX - (box.left + box.width / 2)) / (box.width * 1.5));
      letter.style.translate = `0 ${(-pull * 13).toFixed(1)}%`;
      letter.style.color = pull > .35 ? '#fff' : '';
    }
  });
  word.addEventListener('pointerleave', () => {
    word.classList.remove('vf-near');
    for (const letter of letters) { letter.style.translate = ''; letter.style.color = ''; }
  });
})();


// Fiyat sayfası: sakin giriş hareketi ve fiyat sayacı. Betik yoksa her şey olduğu gibi görünür.
(() => {
  const page = document.querySelector('.pr-page');
  if (!page) return;
  // ?hareket=acik: sistem "hareketi azalt" açıkken bile tam hareketi önizlemek için.
  const force = /[?&]hareket=acik(&|$)/.test(location.search);
  if (force) document.documentElement.classList.add('pr-force');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches && !force;
  const items = [...page.querySelectorAll('[data-pr]')];
  if (!('IntersectionObserver' in window)) return;
  items.forEach(item => { if (item.dataset.i) item.style.setProperty('--i', item.dataset.i); });
  // Hareketi azalt açıksa yalnız yumuşak solma kalır: kayma ve sayaç yok.
  document.documentElement.classList.add('pr-js');
  if (calm) document.documentElement.classList.add('pr-calm');
  const money = value => Math.round(value).toLocaleString('tr-TR');
  const count = span => {
    const end = Number(span.dataset.count);
    if (!end) return;
    const start = performance.now(), length = 900;
    const tick = now => {
      const t = Math.min(1, (now - start) / length);
      span.textContent = money(end * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick); else span.textContent = money(end);
    };
    requestAnimationFrame(tick);
  };
  const seen = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      seen.unobserve(target);
      target.classList.add('pr-in');
      if (!calm) target.querySelectorAll('[data-count]').forEach(count);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  items.forEach(item => seen.observe(item));
  // Güvenlik: gözlemci hiç tetiklenmezse içerik gizli kalmasın.
  setTimeout(() => items.forEach(item => item.classList.add('pr-in')), 4000);
})();
