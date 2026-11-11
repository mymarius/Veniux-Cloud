// Canlı destek yönetim ekranı: sohbet listesi, konuşma ve yanıt. Yalnız anahtar ile giriş yapılabilir.
(() => {
  const root = document.getElementById('ch-admin');
  if (!root) return;
  const API = '/api/destek/yonetim/';
  let csrf = root.dataset.csrf || '';
  let current = null, lastN = 0, lastTotalUnread = 0, listTimer = null, threadTimer = null, audio = null;
  let me = { name: root.dataset.name || '', role: root.dataset.role || '' };

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
  const call = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (options.method === 'POST') { headers['Content-Type'] = 'application/json'; headers['X-Chat-CSRF'] = csrf; }
    const response = await fetch(API + path, { credentials: 'same-origin', ...options, headers });
    let data = {};
    try { data = await response.json(); } catch { /* boş */ }
    if (!response.ok) throw Object.assign(new Error(data.error || 'İstek tamamlanamadı.'), { status: response.status });
    return data;
  };
  const fmt = iso => {
    const date = new Date(iso), now = new Date();
    const same = date.toDateString() === now.toDateString();
    return same ? date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };
  const beep = () => {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = 880; gain.gain.value = 0.08;
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(); osc.stop(audio.currentTime + 0.18);
    } catch { /* ses kapalı */ }
  };

  const login = () => {
    root.replaceChildren();
    clearTimeout(listTimer); clearTimeout(threadTimer);
    if (root.dataset.enabled !== '1') {
      root.append(h('section', { class: 'ch-login' }, h('h1', {}, 'Canlı destek yönetimi'), h('p', {}, 'Yönetim anahtarı sunucuda tanımlı değil. VENIUX_CHAT_ADMIN_KEY (en az 16 karakter) ayarlanınca bu ekran açılır.')));
      return;
    }
    const key = h('input', { type: 'password', autocomplete: 'current-password', required: true, 'aria-label': 'Yönetim anahtarı', placeholder: 'Yönetim anahtarı' });
    const error = h('p', { class: 'ch-error', role: 'alert', hidden: true });
    const form = h('form', { class: 'ch-login-form', onsubmit: async event => {
      event.preventDefault(); error.hidden = true;
      try { const data = await call('giris', { method: 'POST', body: JSON.stringify({ key: key.value }) }); csrf = data.csrf; me = { name: data.name, role: data.role }; key.value = ''; desk(); }
      catch (failure) { error.textContent = failure.message; error.hidden = false; }
    } }, key, h('button', { class: 'hx-btn', type: 'submit' }, 'Giriş yap'), error);
    root.append(h('section', { class: 'ch-login' }, h('h1', {}, 'Canlı destek yönetimi'), h('p', {}, 'Devam etmek için yönetim anahtarını girin.'), form));
    key.focus();
  };

  const desk = () => {
    root.replaceChildren();
    const list = h('div', { class: 'ch-list', role: 'list', 'aria-label': 'Sohbetler' });
    const thread = h('div', { class: 'ch-thread' }, h('p', { class: 'ch-empty' }, 'Soldan bir sohbet seçin.'));
    root.append(h('div', { class: 'ch-desk' },
      h('aside', { class: 'ch-side' },
        h('div', { class: 'ch-side-head' }, h('b', {}, 'Sohbetler'), me.role === 'owner' ? h('button', { type: 'button', class: 'ch-link', onclick: () => team() }, 'Ekip') : null, h('button', { type: 'button', class: 'ch-link', onclick: async () => { try { await call('cikis', { method: 'POST', body: '{}' }); } catch { /* çıkış */ } root.dataset.auth = '0'; login(); } }, 'Çıkış')),
        h('p', { class: 'ch-me' }, 'Giriş: ', h('b', {}, me.name || '—')),
        list),
      thread));

    const open = async id => {
      current = id; lastN = 0;
      clearTimeout(threadTimer);
      const header = h('header', { class: 'ch-thread-head' });
      const log = h('div', { class: 'ch-log ch-log-admin', role: 'log', 'aria-live': 'polite' });
      const text = h('textarea', { rows: 2, maxlength: 1000, required: true, placeholder: 'Yanıtınızı yazın (Enter: gönder, Shift+Enter: yeni satır)', 'aria-label': 'Yanıt' });
      const error = h('p', { class: 'ch-error', role: 'alert', hidden: true });
      const form = h('form', { class: 'ch-form ch-reply', onsubmit: async event => {
        event.preventDefault(); if (!text.value.trim()) return; error.hidden = true;
        try { await call('yanit', { method: 'POST', body: JSON.stringify({ id, text: text.value }) }); text.value = ''; await load(true); }
        catch (failure) { error.textContent = failure.message; error.hidden = false; }
      } }, text, h('button', { class: 'ch-send', type: 'submit' }, 'Yanıtla'), error);
      text.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
      thread.replaceChildren(header, log, form);
      const load = async first => {
        if (current !== id) return;
        try {
          const data = await call(`konu?id=${id}&after=${lastN}&read=1`);
          if (first || !header.childNodes.length) {
            header.replaceChildren(h('div', {}, h('b', {}, data.name), h('small', {}, data.email || 'E-posta bırakılmadı')),
              h('button', { type: 'button', class: 'ch-link', onclick: async () => { await call('kapat', { method: 'POST', body: JSON.stringify({ id }) }); refresh(); } }, data.status === 'closed' ? 'Kapalı' : 'Sohbeti kapat'));
          }
          const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
          for (const m of data.messages) {
            lastN = Math.max(lastN, m.n);
            log.append(h('div', { class: 'ch-msg ch-' + (m.from === 'o' ? 'me' : 'them') }, h('p', {}, m.text), h('time', {}, (m.from === 'o' ? (m.by && m.by !== me.name ? m.by : 'Siz') : data.name) + ' · ' + fmt(m.t))));
          }
          if (stick || first) log.scrollTop = log.scrollHeight;
        } catch (failure) { if (failure.status === 401) login(); }
        threadTimer = setTimeout(() => load(false), 3000);
      };
      await load(true);
      text.focus();
      refresh();
    };

    const team = async () => {
      current = null; clearTimeout(threadTimer);
      const box = h('div', { class: 'ch-team' });
      thread.replaceChildren(h('header', { class: 'ch-thread-head' }, h('div', {}, h('b', {}, 'Ekip'), h('small', {}, 'Her çalışanın kendi anahtarı olur; istediğiniz zaman kapatabilirsiniz.'))), box);
      const draw = async (agents, newKey) => {
        const nameInput = h('input', { type: 'text', maxlength: 40, required: true, placeholder: 'Çalışanın adı', 'aria-label': 'Çalışanın adı' });
        const err = h('p', { class: 'ch-error', role: 'alert', hidden: true });
        const form = h('form', { class: 'ch-team-form', onsubmit: async event => {
          event.preventDefault(); err.hidden = true;
          try { const data = await call('ekip-ekle', { method: 'POST', body: JSON.stringify({ name: nameInput.value }) }); draw(data.agents, { name: nameInput.value, key: data.key }); }
          catch (failure) { err.textContent = failure.message; err.hidden = false; }
        } }, nameInput, h('button', { class: 'ch-send', type: 'submit' }, 'Ekle'), err);
        const keyBox = newKey ? h('div', { class: 'ch-newkey', role: 'status' },
          h('b', {}, newKey.name + ' için anahtar'), h('code', {}, newKey.key),
          h('p', {}, 'Bu anahtar yalnızca şimdi gösterilir; saklanmaz. Çalışana güvenli bir yoldan iletin. Kaybolursa kişiyi kapatıp yeniden ekleyin.'),
          h('button', { type: 'button', class: 'ch-link', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(newKey.key); } }, 'Kopyala')) : null;
        box.replaceChildren(form, keyBox, h('ul', { class: 'ch-agents' }, ...(agents.length ? agents.map(a => h('li', { class: a.active ? '' : 'ch-agent-off' },
          h('span', {}, h('b', {}, a.name), h('small', {}, (a.active ? 'Etkin' : 'Kapalı') + ' · ' + fmt(a.created))),
          h('button', { type: 'button', class: 'ch-link', onclick: async () => { const data = await call('ekip-durum', { method: 'POST', body: JSON.stringify({ id: a.id, active: !a.active }) }); draw(data.agents); } }, a.active ? 'Kapat' : 'Aç'))) : [h('li', { class: 'ch-empty' }, 'Henüz ekip kişisi yok.')])));
      };
      try { const data = await call('ekip'); draw(data.agents); } catch (failure) { box.textContent = failure.message; }
    };

    const refresh = async () => {
      try {
        const data = await call('liste');
        const totalUnread = data.conversations.reduce((sum, c) => sum + c.unread, 0);
        if (totalUnread > lastTotalUnread) { beep(); }
        lastTotalUnread = totalUnread;
        document.title = (totalUnread ? `(${totalUnread}) ` : '') + 'Canlı destek yönetimi | Veniux';
        list.replaceChildren(...(data.conversations.length ? data.conversations.map(c => h('button', { type: 'button', role: 'listitem', class: 'ch-item' + (c.id === current ? ' ch-item-on' : '') + (c.status === 'closed' ? ' ch-item-closed' : ''), onclick: () => open(c.id) },
          h('span', { class: 'ch-item-top' }, h('b', {}, c.name), h('time', {}, fmt(c.updated))),
          h('span', { class: 'ch-item-last' }, c.last),
          c.agent ? h('span', { class: 'ch-item-agent' }, 'İlgilenen: ' + c.agent) : null,
          c.unread ? h('span', { class: 'ch-badge ch-badge-list' }, String(c.unread)) : null)) : [h('p', { class: 'ch-empty' }, 'Henüz sohbet yok.')]));
      } catch (failure) { if (failure.status === 401) { login(); return; } }
      listTimer = setTimeout(refresh, 3500);
    };
    clearTimeout(listTimer); refresh();
  };

  if (root.dataset.auth === '1') desk(); else login();
})();
