import { chunk } from './escpos.mjs';

// Mini Bluetooth termal yazıcılar (BLE) için bilinen seri hizmet adresleri; yazıcı hangisini sunuyorsa kullanılır.
const SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
let session = null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Web Bluetooth: Android Chrome/Edge (https). iPhone ve Android uygulamasının içi desteklemez.
export const bluetoothSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.bluetooth) && window.isSecureContext && !window.veniuxMobile;

function friendly(error) {
  if (error && error.name === 'NotFoundError') return new Error('Yazıcı seçilmedi.');
  if (error && error.name === 'SecurityError') return new Error('Bluetooth için tarayıcı izni gerekir.');
  if (error && error.name === 'NetworkError') return new Error('Yazıcıya bağlanılamadı. Yazıcı açık ve yakın mı?');
  return error instanceof Error ? error : new Error('Bluetooth hatası.');
}

export async function connectPrinter() {
  if (!bluetoothSupported()) throw new Error('Bu cihazda Bluetooth yazdırma yok (Android Chrome veya Edge gerekir).');
  try {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
    const server = await device.gatt.connect();
    for (const service of await server.getPrimaryServices()) {
      for (const characteristic of await service.getCharacteristics()) {
        if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) { session = { device, characteristic }; return { name: device.name || 'Yazıcı' }; }
      }
    }
    throw new Error('Bu yazıcıda yazılabilir Bluetooth özelliği bulunamadı.');
  } catch (error) { throw friendly(error); }
}

export async function printBytes(bytes) {
  if (!session) throw new Error('Önce yazıcıya bağlanın.');
  try {
    if (!session.device.gatt.connected) { await session.device.gatt.connect(); }
    const { characteristic } = session;
    for (const part of chunk(bytes, 100)) {
      if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(part);
      else await characteristic.writeValue(part);
      await sleep(30); // küçük yazıcıların tamponu taşmasın
    }
  } catch (error) { throw friendly(error); }
}

export const printerName = () => session?.device?.name || null;
export function disconnectPrinter() { try { session?.device?.gatt?.disconnect(); } catch { /* yok say */ } session = null; }
