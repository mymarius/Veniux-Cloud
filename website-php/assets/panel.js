// Veniux panel: kopyalama, onay, hazır yanıt ve hesaplayıcılar. JS yokken tüm işlemler formlarla çalışır.
(function () {
  'use strict';
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () { var old = btn.textContent; btn.textContent = 'Kopyalandı'; btn.classList.add('vp-copy-ok'); setTimeout(function () { btn.textContent = old; btn.classList.remove('vp-copy-ok'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest('form[data-confirm]');
    if (f && !window.confirm(f.getAttribute('data-confirm'))) ev.preventDefault();
  });
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('.vp-side a')) { var t = document.getElementById('vp-nav-toggle'); if (t) t.checked = false; }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { var t = document.getElementById('vp-nav-toggle'); if (t) t.checked = false; }
    if (ev.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { var s = document.querySelector('.vp-search input'); if (s) { ev.preventDefault(); s.focus(); } }
  });
  document.querySelectorAll('select[data-canned]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var area = document.getElementById(sel.getAttribute('data-canned'));
      var opt = sel.options[sel.selectedIndex];
      if (area && opt && opt.getAttribute('data-body')) { area.value = (area.value ? area.value + '\n\n' : '') + opt.getAttribute('data-body'); area.focus(); }
      sel.selectedIndex = 0;
    });
  });
  var fmt = function (n) { return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'; };
  var num = function (v) { v = String(v || '').trim(); if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, ''); return parseFloat(v.replace(',', '.')) || 0; };
  document.querySelectorAll('[data-calc]').forEach(function (form) {
    var out = form.querySelector('[data-out]');
    var run = function () {
      var a = num(form.elements.amount.value), r = num(form.elements.rate.value), mode = form.elements.mode ? form.elements.mode.value : '';
      var html = '';
      if (form.getAttribute('data-calc') === 'kdv') {
        var net, tax, gross;
        if (mode === 'dahil') { gross = a; net = a / (1 + r / 100); tax = gross - net; } else { net = a; tax = a * r / 100; gross = net + tax; }
        html = '<span class="vp-label">KDV hariç</span><b>' + fmt(net) + '</b><span class="vp-label">KDV (%' + r + ')</span><b>' + fmt(tax) + '</b><span class="vp-label">KDV dahil</span><strong>' + fmt(gross) + '</strong>';
      } else {
        var d = a * r / 100;
        html = '<span class="vp-label">İndirim tutarı</span><b>' + fmt(d) + '</b><span class="vp-label">İndirimli fiyat</span><strong>' + fmt(a - d) + '</strong>';
      }
      out.innerHTML = html;
    };
    form.addEventListener('input', run); form.addEventListener('submit', function (e) { e.preventDefault(); run(); }); run();
  });
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) { el.addEventListener('change', function () { if (el.form) el.form.submit(); }); });
  var pr = document.querySelector('[data-print]');
  if (pr) pr.addEventListener('click', function () { window.print(); });
})();
