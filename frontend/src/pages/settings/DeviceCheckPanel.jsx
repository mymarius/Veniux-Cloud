import React, { useRef, useState } from 'react';
import { classifyScan, printerStatusText, looksThermal } from '../../lib/scannerProbe.mjs';

// Pide/restoran ve market kasası için "cihaz algılıyor mu?" testi: yazıcı, COM port, USB/HID ve barkod okuyucu.
export default function DeviceCheckPanel() {
  const desktop = typeof window !== 'undefined' ? window.veniuxDesktop : null;
  const [state, setState] = useState({ busy: false, error: '', result: null });
  const [probe, setProbe] = useState(null);
  const times = useRef([]);

  async function scan() {
    setState(s => ({ ...s, busy: true, error: '' }));
    try {
      const result = await desktop.scanDevices();
      setState({ busy: false, error: '', result });
    } catch (e) {
      setState({ busy: false, error: e?.message || 'Cihazlar taranamadı.', result: null });
    }
  }

  function onKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const text = event.currentTarget.value;
      setProbe(classifyScan(times.current, text));
      times.current = [];
      event.currentTarget.value = '';
      return;
    }
    if (event.key.length === 1) times.current.push(performance.now());
  }

  const r = state.result;
  const row = (d, i) => <li key={d.name + i} className="text-sm">{d.name}{d.status && d.status !== 'OK' ? ' · ' + d.status : ''}</li>;
  const group = (title, list, empty) => (
    <div className="rounded-xl border p-3">
      <p className="font-semibold text-sm">{title} <span className="text-slate-500 font-normal">({list.length})</span></p>
      {list.length ? <ul className="mt-1 space-y-0.5">{list.map(row)}</ul> : <p className="text-sm text-slate-500 mt-1">{empty}</p>}
    </div>
  );

  return (
    <section className="veniux-card p-6 space-y-4" aria-labelledby="device-check-title">
      <div>
        <h3 id="device-check-title" className="font-semibold">Cihaz testi</h3>
        <p className="text-sm text-slate-500 mt-1">Fiş yazıcısı, barkod okuyucu, terazi ve diğer cihazları bu bilgisayarın görüp görmediğini kontrol edin. Hiçbir ayarı değiştirmez.</p>
      </div>

      {desktop?.scanDevices ? (
        <div className="space-y-3">
          <button type="button" className="veniux-button" onClick={scan} disabled={state.busy}>{state.busy ? 'Taranıyor…' : 'Cihazları tara'}</button>
          {state.error && <p role="alert" className="text-sm">{state.error}</p>}
          {r && (
            <div className="grid sm:grid-cols-2 gap-3" aria-live="polite">
              <div className="rounded-xl border p-3">
                <p className="font-semibold text-sm">Yazıcılar <span className="text-slate-500 font-normal">({r.printers.length})</span></p>
                {r.printers.length ? <ul className="mt-1 space-y-0.5">{r.printers.map((p, i) => (
                  <li key={p.name + i} className="text-sm">{p.name} · {printerStatusText(p.status)}{looksThermal(p.name) ? ' · fiş yazıcısı olabilir' : ''} <span className="text-slate-500">({p.port})</span></li>
                ))}</ul> : <p className="text-sm text-slate-500 mt-1">Yazıcı bulunamadı. Sürücüsünü kurup Windows'ta görünmesini sağlayın.</p>}
              </div>
              {group('Seri/COM portlar (terazi, yazarkasa)', r.ports, 'COM port yok. Terazi veya yazarkasa USB-seri kablosuyla takılıysa sürücüsü kurulu olmalı.')}
              {group('USB aygıtları', r.usb, 'USB aygıtı görünmüyor.')}
              {group('Klavye/HID (barkod okuyucular genelde burada)', r.hid, 'HID aygıtı görünmüyor.')}
              {group('Bluetooth', r.bluetooth, 'Bluetooth aygıtı yok.')}
              {group('Kamera', r.camera, 'Kamera yok.')}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Cihaz taraması yalnız Windows programında çalışır. Aşağıdaki barkod testi tarayıcıda da kullanılabilir.</p>
      )}

      <div className="rounded-xl border p-3 space-y-2">
        <label className="font-semibold text-sm" htmlFor="scanner-probe">Barkod okuyucu testi</label>
        <p className="text-sm text-slate-500">Aşağıdaki kutuya tıklayın ve bir ürünün barkodunu okutun. Okuyucu çok hızlı yazdığı için elle yazmaktan ayırt edilir.</p>
        <input id="scanner-probe" className="veniux-input w-full" autoComplete="off" placeholder="Buraya tıklayıp barkod okutun" onKeyDown={onKey} />
        {probe && <p role="status" className="text-sm">{probe.message}{probe.average != null ? ' (tuş aralığı ~' + probe.average + ' ms)' : ''}</p>}
      </div>
    </section>
  );
}
