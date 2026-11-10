// Kasa için service worker kaydı (public/sw.js). Yalnız üretim derlemesinde, web tarayıcısında (http/https) çalışır;
// masaüstü programı ve Android uygulaması kendi yolunu kullanır. Kayıt başarısız olursa uygulama aynen çalışmaya devam eder.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.veniuxDesktop?.isDesktop || window.veniuxMobile || !/^https?:$/.test(window.location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(ready => {
        // SW ilk yüklemede sayfayı devralmadan önce indirilen dosyaları da önbelleğe aldır.
        const urls = [...new Set(performance.getEntriesByType('resource').map(r => r.name).filter(name => name.startsWith(window.location.origin + '/')))];
        (ready.active || navigator.serviceWorker.controller)?.postMessage({ type: 'cache-urls', urls });
      })
      .catch(() => { /* kayıt yoksa çevrimdışı açılış yok; çevrimiçi çalışma etkilenmez */ });
  });
}
