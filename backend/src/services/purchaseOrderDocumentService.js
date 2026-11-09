// Satın alma siparişi belgesi: yazdırılabilir HTML, PDF, tedarikçiye e-posta ve WhatsApp bağlantısı.
// Gönderim her zaman kullanıcının açık isteğiyle yapılır; otomatik tedarikçi gönderimi yoktur.
const db = require('../config/database');
const procurement = require('./procurementService');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tl = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
const qty = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 3 });
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

async function load(user, id) {
  const order = await procurement.detail(user, id);
  const company = (await db.query('SELECT company_name,email,phone,address,tax_number,tax_office FROM tenants WHERE id=$1', [user.tenantId])).rows[0] || {};
  return { order, company };
}

function html({ order, company }) {
  const rows = order.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.product_name)}<br><small>${esc(i.barcode || i.sku || '')}</small></td><td class="r">${qty(i.quantity)} ${esc(i.unit || '')}</td><td class="r">${tl(i.unit_price)}</td><td class="r">${tl(Number(i.quantity) * Number(i.unit_price))}</td></tr>`).join('');
  const total = order.items.reduce((t, i) => t + Number(i.quantity) * Number(i.unit_price), 0);
  const tax = company.tax_number ? 'VKN: ' + esc(company.tax_number) + (company.tax_office ? ' / ' + esc(company.tax_office) : '') : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sipariş ${esc(order.order_no)}</title><style>
body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f2f2f2}.r{text-align:right}.cols{display:flex;gap:32px;margin-top:12px}.cols div{flex:1}small{color:#555}.total{font-weight:bold;font-size:14px}</style></head><body>
<h1>Satın alma siparişi</h1><div>Sipariş no: <b>${esc(order.order_no)}</b> · Tarih: ${esc(String(order.created_at || '').slice(0, 10))}</div>
<div class="cols"><div><b>Sipariş veren</b><br>${esc(company.company_name)}<br>${esc(company.address || '')}<br>${esc(company.phone || '')} ${esc(company.email || '')}<br>${tax}</div>
<div><b>Tedarikçi</b><br>${esc(order.supplier_name)}<br>${esc(order.supplier_phone || '')} ${esc(order.supplier_email || '')}</div>
<div><b>Teslim yeri</b><br>${esc(order.target_warehouse_name)}</div></div>
<table><thead><tr><th>#</th><th>Ürün</th><th class="r">Miktar</th><th class="r">Birim fiyat</th><th class="r">Tutar</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" class="r total">Toplam (KDV durumu tedarikçi faturasına göre)</td><td class="r total">${tl(total)}</td></tr></tfoot></table>
${order.notes ? `<p><b>Not:</b> ${esc(order.notes)}</p>` : ''}<p><small>Bu belge Veniux ile hazırlanan sipariş talebidir; fatura veya irsaliye yerine geçmez.</small></p></body></html>`;
}

function browserPath() {
  const fs = require('fs');
  return [process.env.PDF_BROWSER_PATH, process.env.WHATSAPP_BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean).find(p => fs.existsSync(p));
}

// HTML belgeyi yerel tarayıcıyla PDF'e çevirir. Dış ağ istekleri ve betikler kapalıdır.
async function pdf(page) {
  const puppeteer = require('puppeteer');
  const executablePath = browserPath();
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--disable-gpu'] });
    const tab = await browser.newPage();
    await tab.setJavaScriptEnabled(false);
    await tab.setRequestInterception(true);
    tab.on('request', r => (r.url().startsWith('data:') || r.url() === 'about:blank') ? r.continue() : r.abort());
    await tab.setContent(page, { waitUntil: 'load', timeout: 20000 });
    return Buffer.from(await tab.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } }));
  } catch {
    fail('PDF oluşturulamadı: bu bilgisayarda Chrome veya Edge bulunamadı. Belgeyi yazdırma ekranından PDF olarak kaydedebilirsiniz.', 503);
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function document(user, id, format = 'html') {
  const data = await load(user, id), page = html(data);
  if (format === 'pdf') return { type: 'application/pdf', body: await pdf(page), filename: `siparis-${data.order.order_no}.pdf` };
  return { type: 'text/html; charset=utf-8', body: page, filename: `siparis-${data.order.order_no}.html` };
}

async function sendEmail(user, id, body = {}) {
  const data = await load(user, id), { order, company } = data;
  if (['cancelled', 'received', 'closed'].includes(order.status)) fail('İptal edilmiş veya tamamlanmış sipariş gönderilemez.', 409);
  const to = typeof body.to === 'string' && body.to.trim() ? body.to.trim() : order.supplier_email;
  if (!to || !EMAIL.test(to)) fail('Tedarikçinin geçerli bir e-posta adresi yok. Tedarikçi kartına e-posta ekleyin veya adres yazın.');
  const note = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  const page = html(data);
  let attachment;
  try { attachment = { filename: `siparis-${order.order_no}.pdf`, content: await pdf(page), contentType: 'application/pdf' }; }
  catch { attachment = { filename: `siparis-${order.order_no}.html`, content: page, contentType: 'text/html; charset=utf-8' }; }
  const subject = `Sipariş ${order.order_no} - ${company.company_name || 'Veniux'}`;
  const text = `Merhaba,\n\n${company.company_name || 'Firmamız'} adına ${order.order_no} numaralı siparişimiz ektedir.${note ? '\n\n' + note : ''}\n\nTeslim yeri: ${order.target_warehouse_name}\n\nİyi çalışmalar.`;
  const extra = { attachments: [attachment], ...(company.email && EMAIL.test(company.email) ? { replyTo: company.email } : {}) };
  const result = await require('./notificationService').sendEmail(to, subject, text, page, extra);
  await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'purchase_order.emailed', 'purchase_order', order.id, JSON.stringify({ to, success: Boolean(result.success), attachment: attachment.filename })]);
  if (!result.success) fail(result.error === 'Not configured' ? 'E-posta sunucusu (SMTP) ayarlı değil. Belgeyi indirip kendi e-postanızdan gönderebilirsiniz.' : 'E-posta gönderilemedi. Bağlantı ayarlarını kontrol edin.', 502);
  return { sent: true, to, attachment: attachment.filename };
}

// WhatsApp: işletmenin kendi WhatsApp'ında hazır mesaj açılır (wa.me). Ücretsizdir; mesajı kullanıcı kendisi gönderir.
function whatsappPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const phone = digits.startsWith('90') ? digits : digits.startsWith('0') ? '9' + digits : digits.length === 10 ? '90' + digits : digits;
  return phone.length >= 11 && phone.length <= 15 ? phone : null;
}
async function whatsappLink(user, id) {
  const { order, company } = await load(user, id);
  const phone = whatsappPhone(order.supplier_phone);
  if (!phone) fail('Tedarikçinin geçerli bir telefon numarası yok.');
  const lines = order.items.map(i => `- ${i.product_name}: ${qty(i.quantity)} ${i.unit || ''}`.trim());
  let text = `Merhaba, ${company.company_name || ''} olarak ${order.order_no} numaralı siparişimiz:\n${lines.join('\n')}\nTeslim yeri: ${order.target_warehouse_name}`;
  if (text.length > 1800) text = text.slice(0, 1780) + '\n(devamı PDF belgede)';
  return { url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, text };
}

module.exports = { html, pdf, document, sendEmail, whatsappLink, whatsappPhone };
