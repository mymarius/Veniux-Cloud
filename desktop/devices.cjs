// Cihaz algılama: bilgisayara takılı yazıcı, seri/COM port, USB ve HID aygıtlarını listeler.
// Komut sabittir; arayüzden hiçbir metin komuta karışmaz. Yalnız okur, hiçbir ayarı değiştirmez.
const { execFile } = require('child_process');

const SCRIPT = [
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
  "$ErrorActionPreference='SilentlyContinue'",
  "$cls=@('Printer','PrintQueue','Ports','USB','HIDClass','Bluetooth','Keyboard','Camera','Image','Media')",
  "$pnp=@(Get-PnpDevice -PresentOnly | Where-Object { $cls -contains $_.Class -and $_.FriendlyName } | Select-Object -First 200 FriendlyName,Class,Status)",
  "$prn=@(Get-Printer | Select-Object -First 64 Name,DriverName,PortName,PrinterStatus)",
  "[pscustomobject]@{pnp=$pnp;printers=$prn} | ConvertTo-Json -Compress -Depth 4"
].join(';');

const short = (v, n = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const asList = v => (Array.isArray(v) ? v : v ? [v] : []);

function categorize(pnp) {
  const out = { ports: [], usb: [], hid: [], bluetooth: [], camera: [] };
  for (const d of pnp) {
    const item = { name: short(d.FriendlyName), status: short(d.Status, 20) };
    if (d.Class === 'Ports') out.ports.push(item);
    else if (d.Class === 'Bluetooth') out.bluetooth.push(item);
    else if (d.Class === 'Camera' || d.Class === 'Image') out.camera.push(item);
    else if (d.Class === 'HIDClass' || d.Class === 'Keyboard') out.hid.push(item);
    else if (d.Class === 'USB') out.usb.push(item);
  }
  return out;
}

function parse(stdout) {
  const data = JSON.parse(String(stdout).trim() || '{}');
  const printers = asList(data.printers).map(p => ({
    name: short(p.Name), driver: short(p.DriverName), port: short(p.PortName, 60), status: short(p.PrinterStatus, 20)
  }));
  return { printers, ...categorize(asList(data.pnp)) };
}

function scan(execImpl = execFile) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(Error('Cihaz taraması yalnız Windows programında çalışır.'));
    execImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { timeout: 20000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(Error('Cihazlar taranamadı.'));
      try { resolve({ ...parse(stdout), scannedAt: new Date().toISOString() }); } catch { reject(Error('Cihaz listesi okunamadı.')); }
    });
  });
}

function register(handle) {
  let running = null;
  handle('device-scan', () => (running ||= scan().finally(() => { running = null; })));
}

module.exports = { register, scan, parse, categorize };
