const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, scan } = require('./devices.cjs');

test('PowerShell çıktısı yazıcı, COM, USB ve HID olarak ayrılır; tek kayıt da liste olur', () => {
  const out = JSON.stringify({
    pnp: [
      { FriendlyName: 'USB Seri Aygıt (COM3)', Class: 'Ports', Status: 'OK' },
      { FriendlyName: 'HID Klavye Aygıtı', Class: 'Keyboard', Status: 'OK' },
      { FriendlyName: 'USB Yazdırma Desteği', Class: 'USB', Status: 'OK' }
    ],
    printers: { Name: 'EPSON TM-T20', DriverName: 'EPSON', PortName: 'USB001', PrinterStatus: 0 }
  });
  const r = parse(out);
  assert.equal(r.printers.length, 1);
  assert.equal(r.printers[0].name, 'EPSON TM-T20');
  assert.equal(r.ports[0].name, 'USB Seri Aygıt (COM3)');
  assert.equal(r.hid.length, 1);
  assert.equal(r.usb.length, 1);
});

test('boş çıktı boş listeler verir; bozuk çıktı hata verir', () => {
  const r = parse('{}');
  assert.deepEqual([r.printers.length, r.ports.length, r.usb.length, r.hid.length], [0, 0, 0, 0]);
  assert.throws(() => parse('bozuk'));
});

test('komut sabittir ve PowerShell hatası anlaşılır mesaj olur', async () => {
  let seen;
  const failing = (file, args, options, cb) => { seen = { file, args }; cb(Error('x')); };
  await assert.rejects(scan(failing), /taranamadı|yalnız Windows/);
  if (process.platform === 'win32') {
    assert.equal(seen.file, 'powershell.exe');
    assert.ok(seen.args.includes('-NonInteractive'));
  }
});

test('uzun ve kontrol karakterli adlar kısaltılır', () => {
  const r = parse(JSON.stringify({ pnp: [{ FriendlyName: 'A\u0000'.repeat(300), Class: 'USB', Status: 'OK' }], printers: [] }));
  assert.ok(r.usb[0].name.length <= 120);
  assert.ok(!/\u0000/.test(r.usb[0].name));
});
