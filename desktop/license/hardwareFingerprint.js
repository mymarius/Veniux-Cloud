const os = require('os');
const crypto = require('crypto');

/**
 * Hardware Fingerprinting Engine for Windows Enterprise Workstations
 * Generates an irreversible machine hash without leaking PII.
 */
function getHardwareFingerprint() {
  try {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Generic-CPU';
    const cpuCores = cpus.length;
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // in GB

    // Network MAC addresses (non-internal)
    const netInterfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(netInterfaces)) {
      for (const net of netInterfaces[name]) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          macs.push(net.mac);
        }
      }
    }
    const primaryMac = macs.sort()[0] || '00:11:22:33:44:55';

    const machineId = require('node-machine-id').machineIdSync(true);
    const rawHardwareString = `${machineId}|${platform}|${arch}`;
    const hash = crypto.createHash('sha256').update(rawHardwareString).digest('hex');

    return {
      fingerprint: `HW-${hash.substring(0, 32).toUpperCase()}`,
      deviceName: hostname,
      osInfo: `${platform === 'win32' ? 'Windows' : platform} ${os.release()} (${arch})`,
      specs: `${cpuModel} (${cpuCores} Cores, ${totalMem}GB RAM)`
    };
  } catch (err) {
    throw new Error('Terminal kimliği doğrulanamadı. Lisans aktivasyonu durduruldu.');
  }
}

module.exports = {
  getHardwareFingerprint
};
