const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, minimum-privilege desktop APIs to React frontend
contextBridge.exposeInMainWorld('veniuxDesktop', {
  isDesktop: true,
  setupRequired: process.argv.includes('--veniux-setup-required'),
  completeFirstSetup: (selection) => ipcRenderer.invoke('complete-first-setup', selection),
  appVersion: decodeURIComponent((process.argv.find(arg => arg.startsWith('--veniux-app-version=')) || '--veniux-app-version=unknown').split('=')[1]),
  centralLicenseRequired: process.argv.includes('--veniux-central-required'),
  apiBase: decodeURIComponent((process.argv.find(arg=>arg.startsWith('--veniux-api-base='))||'--veniux-api-base=http%3A%2F%2F127.0.0.1%3A3000%2Fapi').split('=')[1]),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  copyMobileCode: (code) => ipcRenderer.invoke('copy-mobile-code', code),

  listLabelPrinters: () => ipcRenderer.invoke('label-printers'),
  labelStation: scope => ipcRenderer.invoke('label-station',scope),
  enableLabelStation: (scope,enabled) => ipcRenderer.invoke('label-station-enable',scope,enabled),
  printLabelJob: (scope,job,auth) => ipcRenderer.invoke('label-print-job',scope,job,auth),

  // Window Controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChange: (callback) => {
    const subscription = (event, state) => callback(state);
    ipcRenderer.on('window-state-changed', subscription);
    return () => ipcRenderer.removeListener('window-state-changed', subscription);
  },

  // Hardware & Machine Fingerprint
  getHardwareInfo: () => ipcRenderer.invoke('get-hardware-info'),

  // Secure License Storage
  loadCachedLicense: () => ipcRenderer.invoke('load-cached-license'),
  saveCachedLicense: (tokenData) => ipcRenderer.invoke('save-cached-license', tokenData),
  clearCachedLicense: () => ipcRenderer.invoke('clear-cached-license'),

  // System Diagnostics
  getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
  openExternal: (url) => ipcRenderer.send('open-external-url', url)
});

