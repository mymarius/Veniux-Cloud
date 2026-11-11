import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, HelpCircle, X } from 'lucide-react';
import release from '../../../data/programRelease.json';
import { CHECKS, STATUS_LABELS, detect, reportText, summarize } from '../../../lib/deviceCheck.mjs';
import { bluetoothSupported, connectPrinter, printBytes } from '../../../lib/bluetoothPrinter';
import { encodeLabel } from '../../../lib/escpos.mjs';
import { enablePush, sendTestPush } from '../../../lib/pushClient';
import { MobileTop } from '../mobileKit';
import { beep } from './SectorKit';

const env = () => ({
  getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext,
  barcodeDetector: 'BarcodeDetector' in window,
  audio: Boolean(window.AudioContext || window.webkitAudioContext),
  vibrate: typeof navigator.vibrate === 'function',
  push: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext && !window.veniuxMobile,
  bluetooth: bluetoothSupported(),
  serviceWorker: 'serviceWorker' in navigator,
  controlled: Boolean(navigator.serviceWorker?.controller),
  standalone: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
  ios: /iPhone|iPad|iPod/.test(navigator.userAgent)
});

// Cihaz testi: gerçek telefonda kamera, barkod, ses, titreşim, bildirim ve Bluetooth yazıcıyı adım adım dener.
// Sonucu rapor olarak kopyalayıp paylaşabilirsiniz; hangi özelliğin o cihazda çalışmadığı net görünür.
export default function MobileDeviceTest() {
  const [results, setResults] = useState(() => detect(env()));
  const [asking, setAsking] = useState(null), [busy, setBusy] = useState(''), [copied, setCopied] = useState('');
  useEffect(() => { setResults(detect(env())); }, []);
  const set = (key, status, note) => setResults(r => ({ ...r, [key]: { status, note } }));
  const summary = summarize(results);
  const report = useMemo(() => reportText(results, { version: release.version, userAgent: navigator.userAgent }), [results]);

  const confirm = (key, question, then) => setAsking({ key, question, then });
  const answer = yes => { const a = asking; setAsking(null); set(a.key, yes ? 'pass' : 'fail', yes ? a.then.pass : a.then.fail); };

  async function run(key) {
    setBusy(key);
    try {
      if (key === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const label = stream.getVideoTracks()[0]?.label || 'kamera'; stream.getTracks().forEach(t => t.stop());
        set('camera', 'pass', label);
      } else if (key === 'barcode') {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        const need = ['ean_13', 'code_128'].filter(f => !formats.includes(f));
        set('barcode', need.length ? 'warn' : 'pass', need.length ? 'Eksik biçim: ' + need.join(', ') : formats.length + ' barkod biçimi okunur');
      } else if (key === 'sound') { beep(3); confirm('sound', 'Üç kısa bip duydunuz mu?', { pass: 'Ses çalıyor.', fail: 'Ses duyulmadı (sessiz mod veya ses kapalı olabilir).' }); }
      else if (key === 'vibrate') { navigator.vibrate([250, 120, 250]); confirm('vibrate', 'Telefon titredi mi?', { pass: 'Titreşim çalışıyor.', fail: 'Titreşim hissedilmedi (sessiz mod veya cihaz desteği).' }); }
      else if (key === 'notify') {
        await enablePush(); const r = await sendTestPush();
        confirm('notify', 'Bildirim geldi mi? (Uygulamayı ekrandan çıkarıp bakabilirsiniz.)', { pass: 'Bildirim ' + r.sent + ' cihaza gitti ve alındı.', fail: 'Sunucu gönderdi ama bildirim görülmedi (bildirim ayarları veya pil tasarrufu).' });
      } else if (key === 'bluetooth') {
        const printer = await connectPrinter();
        await printBytes(encodeLabel({ name: 'Veniux deneme etiketi', price: 12.5, barcode: '4006381333931', unit: 'adet' }));
        confirm('bluetooth', printer.name + ' yazıcısından etiket çıktı mı?', { pass: printer.name + ' ile yazdırıldı.', fail: printer.name + ' bağlandı ama doğru basmadı (ESC/POS desteklemeyebilir).' });
      }
    } catch (e) { set(key, 'fail', e.message || e.name || 'Hata'); }
    finally { setBusy(''); }
  }

  const tone = s => ({ pass: 'var(--vm-good)', fail: 'var(--vm-bad)', warn: 'var(--vm-accent)', skip: 'var(--vm-muted)', pending: 'var(--vm-muted)' }[s]);
  const runnable = ['camera', 'barcode', 'sound', 'vibrate', 'notify', 'bluetooth'];
  return <div className="vm">
    <MobileTop title="Cihaz Testi" flat />
    <div className="vm-body" style={{ marginTop: 0, paddingTop: 14 }}>
      <p className="vm-note">Bu ekran telefonunuzda hangi özelliklerin çalıştığını gösterir. Her satırdaki "Dene" düğmesine dokunun, sorulara cevap verin; en altta raporu kopyalayıp paylaşabilirsiniz.</p>
      <section className="vm-card" aria-label="Özet"><b>{summary.pass} çalışıyor</b> · {summary.warn} kısmen · {summary.fail} çalışmıyor · {summary.skip} desteklenmiyor · {summary.pending} denenmedi</section>
      <div className="vm-list">{CHECKS.map(([key, label]) => { const r = results[key] || { status: 'pending' }; return <div key={key} className="vm-row" style={{ alignItems: 'flex-start' }}>
        <span style={{ color: tone(r.status), marginTop: 2 }}>{r.status === 'pass' ? <Check size={20} /> : r.status === 'fail' ? <X size={20} /> : <HelpCircle size={20} />}</span>
        <span className="grow"><b>{label}</b><small style={{ color: tone(r.status) }}>{STATUS_LABELS[r.status]}{r.note ? ' — ' + r.note : ''}</small></span>
        {runnable.includes(key) && r.status !== 'skip' && <button type="button" className="vm-btn soft" style={{ width: 'auto', minHeight: 38, padding: '0 14px' }} disabled={busy === key} onClick={() => run(key)}>{busy === key ? '…' : 'Dene'}</button>}</div>; })}</div>
      <div className="vm-label"><span>Rapor</span></div>
      <textarea readOnly aria-label="Cihaz testi raporu" value={report} rows={12} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--vm-line)', padding: 10, background: 'var(--vm-card)', color: 'var(--vm-text)', fontSize: 12 }} />
      <button type="button" className="vm-btn" style={{ marginTop: 10 }} onClick={async () => { try { await navigator.clipboard.writeText(report); setCopied('Rapor kopyalandı.'); } catch { setCopied('Kopyalanamadı; metni seçip kopyalayın.'); } }}><Copy size={16} /> Raporu kopyala</button>
      {copied && <p role="status" className="vm-note">{copied}</p>}
    </div>
    {asking && <div className="vm-sheet-back" style={{ alignItems: 'center' }}><div className="vm-dialog" role="alertdialog" aria-modal="true" aria-label={asking.question}><h2>{asking.question}</h2>
      <div className="two"><button type="button" className="vm-btn ghost" onClick={() => answer(false)}>Hayır</button><button type="button" className="vm-btn" onClick={() => answer(true)}>Evet</button></div></div></div>}
  </div>;
}
