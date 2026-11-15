// Özel alan adıyla gelen istekler: doğrulanmış bir mağaza alan adı ise yalnız o mağazanın vitrini sunulur.
// Kök adres mağaza sayfasına, /sitemap.xml mağaza site haritasına yönlendirilir; uygulamanın diğer sayfaları bu alan adında açılmaz.
const domains = require('../services/onlineStoreDomain');
const ALLOWED = [/^\/assets\//, /^\/favicon/, /^\/icons?\//, /^\/apple-touch/, /^\/manifest/];
module.exports = async function shopDomain(req, res, next) {
  try {
    const hit = await domains.lookup(req.hostname || req.get('host'));
    if (!hit) return next();
    const slug = hit.slug;
    req.shopDomain = hit;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return res.status(405).end();
    const path = req.path;
    if (path === '/') { req.url = `/magaza/${slug}` + req.url.slice(1); return next(); }
    if (path === '/sitemap.xml') { req.url = `/magaza/${slug}/sitemap.xml`; return next(); }
    if (path === '/robots.txt') return res.type('text').send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
    if (path.startsWith(`/magaza/${slug}`) || path.startsWith(`/api/public/shop/${slug}`) || ALLOWED.some(r => r.test(path))) return next();
    return res.redirect(302, '/');
  } catch (e) { next(e); }
};
