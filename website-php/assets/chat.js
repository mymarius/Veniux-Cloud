// Canlı destek kutusu: sağ altta düğme, açılınca sohbet paneli. Kayıtlar Veniux sunucusunda tutulur.
(() => {
  if (location.pathname === '/destek-yonetim' || document.querySelector('.ch-admin')) return;
  const KEY = 'veniux-chat';
  const API = '/api/destek/';
  let state = null;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  const save = () => { try { state ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch { /* depolama kapalı */ } };

  const h = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return node;
  };
  const time = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const call = async (path, options) => {
    const response = await fetch(API + path, { credentials: 'same-origin', ...options });
    let data = {};
    try { data = await response.json(); } catch { /* boş yanıt */ }
    if (!response.ok) throw Object.assign(new Error(data.error || 'İstek tamamlanamadı.'), { status: response.status });
    return data;
  };
  const post = (path, body) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  let open = false, lastN = 0, unread = 0, online = false, poll = null, sending = false;
  const log = h('div', { class: 'ch-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Sohbet mesajları' });
  const status = h('p', { class: 'ch-status' });
  const badge = h('span', { class: 'ch-badge', hidden: true, 'aria-hidden': 'true' });
  const launcher = h('button', { class: 'ch-launcher', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'ch-panel', onclick: () => toggle() },
    h('span', { class: 'ch-launcher-icon', 'aria-hidden': 'true' }), h('span', {}, 'Canlı destek'), badge);
  const closeButton = h('button', { class: 'ch-close', type: 'button', 'aria-label': 'Sohbeti kapat', onclick: () => toggle(false) }, '×');
  const startForm = h('form', { class: 'ch-form ch-start', novalidate: true });
  const replyForm = h('form', { class: 'ch-form ch-reply', hidden: true });
  const panel = h('section', { class: 'ch-panel', id: 'ch-panel', role: 'dialog', 'aria-label': 'Canlı destek', hidden: true },
    h('header', { class: 'ch-head' },
      h('div', {}, h('small', {}, 'VENİUX · DESTEK'), h('b', {}, 'Canlı destek')), closeButton),
    status, log, startForm, replyForm);
  const root = h('div', { class: 'ch-root' }, panel, launcher);

  // --- Başlangıç formu
  const name = h('input', { name: 'name', maxlength: 80, autocomplete: 'name', required: true, placeholder: 'Adınız' });
  const email = h('input', { name: 'email', type: 'email', maxlength: 254, autocomplete: 'email', placeholder: 'E-posta (isteğe bağlı, çevrimdışıyken dönebilmemiz için)' });
  const first = h('textarea', { name: 'message', maxlength: 1000, rows: 3, required: true, placeholder: 'Nasıl yardımcı olabiliriz?' });
  const consent = h('input', { type: 'checkbox', name: 'consent' });
  const trap = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', class: 'ch-trap', 'aria-hidden': 'true' });
  const startError = h('p', { class: 'ch-error', role: 'alert', hidden: true });
  const startButton = h('button', { class: 'ch-send', type: 'submit' }, 'Sohbeti başlat');
  startForm.append(
    h('label', {}, 'Adınız', name), h('label', {}, 'E-posta', email), h('label', {}, 'Mesajınız', first),
    h('label', { class: 'ch-consent' }, consent, h('span', {}, 'Adım, e-postam ve mesajlarım bu görüşme için işlensin. ', h('a', { href: '/gizlilik-politikasi', target: '_blank', rel: 'noopener' }, 'Gizlilik politikası'))),
    trap, startError, startButton);

  // --- Yanıt formu
  const text = h('textarea', { name: 'text', maxlength: 1000, rows: 2, required: true, placeholder: 'Mesajınızı yazın', 'aria-label': 'Mesajınız' });
  const replyError = h('p', { class: 'ch-error', role: 'alert', hidden: true });
  replyForm.append(text, h('button', { class: 'ch-send', type: 'submit', 'aria-label': 'Gönder' }, 'Gönder'), replyError);

  const showError = (node, message) => { node.textContent = message || ''; node.hidden = !message; };
  const setStatus = () => {
    status.textContent = online ? 'Şu an çevrimiçiyiz, hemen yanıtlarız.' : 'Şu an çevrimdışıyız (hafta içi 09:00–18:00). Mesajınız kaydedilir; e-posta bıraktıysanız dönerek yanıt veririz.';
    status.dataset.online = online ? '1' : '0';
  };
  const addMessages = list => {
    if (!list.length) return;
    const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    for (const m of list) {
      lastN = Math.max(lastN, m.n);
      log.append(h('div', { class: 'ch-msg ch-' + (m.from === 'v' ? 'me' : 'them') }, h('p', {}, m.text), h('time', {}, (m.from === 'v' ? 'Siz' : 'Veniux' + (m.by ? ' · ' + m.by : '')) + ' · ' + time(m.t))));
      if (m.from === 'o' && !open) unread += 1;
    }
    badge.textContent = unread ? String(unread) : '';
    badge.hidden = !unread;
    if (stick || open) log.scrollTop = log.scrollHeight;
  };
  const render = () => {
    const has = Boolean(state && state.id);
    startForm.hidden = has; replyForm.hidden = !has; log.hidden = !has;
    setStatus();
  };
  const fetchMessages = async () => {
    if (!state) return;
    try {
      const data = await call(`mesajlar?id=${encodeURIComponent(state.id)}&secret=${encodeURIComponent(state.secret)}&after=${lastN}`);
      online = Boolean(data.online);
      addMessages(data.messages);
      setStatus();
    } catch (error) {
      if (error.status === 404) { state = null; save(); lastN = 0; log.replaceChildren(); render(); }
    }
  };
  const schedule = () => {
    clearTimeout(poll);
    if (!state || document.hidden) { poll = setTimeout(schedule, 8000); return; }
    fetchMessages().finally(() => { poll = setTimeout(schedule, open ? 4000 : 20000); });
  };

  function toggle(force) {
    open = force === undefined ? !open : force;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    root.classList.toggle('ch-open', open);
    if (open) {
      unread = 0; badge.hidden = true;
      render();
      log.scrollTop = log.scrollHeight;
      (state ? text : name).focus();
      state ? fetchMessages() : call('durum').then(data => { online = Boolean(data.online); setStatus(); }).catch(() => {});
    } else launcher.focus();
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) toggle(false); });

  startForm.addEventListener('submit', async event => {
    event.preventDefault();
    showError(startError, '');
    if (name.value.trim().length < 2 || !first.value.trim()) { showError(startError, 'Adınızı ve mesajınızı yazın.'); return; }
    if (!consent.checked) { showError(startError, 'Devam etmek için onay kutusunu işaretleyin.'); return; }
    startButton.disabled = true;
    try {
      const data = await post('baslat', { name: name.value, email: email.value, message: first.value, consent: true, website: trap.value });
      state = { id: data.id, secret: data.secret };
      save(); lastN = 0; log.replaceChildren(); online = Boolean(data.online);
      first.value = '';
      render();
      await fetchMessages();
      text.focus();
    } catch (error) { showError(startError, error.message); }
    finally { startButton.disabled = false; }
  });
  replyForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !text.value.trim()) return;
    sending = true; showError(replyError, '');
    try { await post('gonder', { id: state.id, secret: state.secret, text: text.value }); text.value = ''; await fetchMessages(); }
    catch (error) { showError(replyError, error.message); }
    finally { sending = false; }
  });
  text.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); replyForm.requestSubmit(); } });

  // Yönetim anahtarı sunucuda tanımlı değilse kutu hiç gösterilmez: yanıtlayacak kimse yokken ziyaretçi mesaj bırakmasın.
  call('durum').then(data => {
    if (!data.enabled) return;
    online = Boolean(data.online);
    document.body.append(root);
    render();
    if (state) schedule();
  }).catch(() => { /* canlı destek kapalı */ });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state) schedule(); });
  // Başka sayfadaki "Canlı destek" bağlantıları kutuyu açar.
  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('[data-open-chat]');
    if (link) { event.preventDefault(); toggle(true); }
  });
})();
