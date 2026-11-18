// Müşteri ekranı penceresi: ikinci monitör varsa orada tam ekran, yoksa ana pencerenin yanında küçük pencere.
function isCustomerDisplayUrl(url) {
  try { const u = new URL(url); return u.hash === '#/musteri-ekrani' || u.pathname === '/musteri-ekrani'; } catch { return false; }
}

function windowOptions(displays, primaryId) {
  const second = (displays || []).find(d => d.id !== primaryId);
  const base = { autoHideMenuBar: true, title: 'Müşteri ekranı', backgroundColor: '#0f1d2e' };
  if (!second) return { ...base, width: 1024, height: 768 };
  const { x, y, width, height } = second.bounds;
  return { ...base, x, y, width, height, fullscreen: true };
}

module.exports = { isCustomerDisplayUrl, windowOptions };
