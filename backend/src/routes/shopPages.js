// Online mağaza sayfaları (HTML): tek sayfalı uygulamanın index.html'ine sayfaya özel başlık, açıklama, paylaşım ve yapılandırılmış veri eklenir.
// Sipariş ve sepet sayfaları arama dizinine alınmaz. Olmayan/kapalı mağaza 404 döner (içerik yine uygulamayla gösterilir, noindex).
const fs = require('fs');
const path = require('path');
const express = require('express');
const store = require('../services/onlineStoreService');
const router = express.Router();
const dist = path.join(__dirname, '../../../frontend/dist/index.html');
const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const origin = req => `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;

function inject(html, req, meta) {
  const base = origin(req);
  const tags = ['<base href="/">', `<meta name="description" content="${esc(meta.description)}">`, `<link rel="canonical" href="${esc(base + meta.canonical)}">`,
    `<meta name="robots" content="${meta.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
    `<meta property="og:type" content="${meta.jsonld && meta.jsonld['@type'] === 'Product' ? 'product' : 'website'}">`, `<meta property="og:title" content="${esc(meta.title)}">`, `<meta property="og:description" content="${esc(meta.description)}">`, `<meta property="og:url" content="${esc(base + meta.canonical)}">`,
    meta.image ? `<meta property="og:image" content="${esc(base + meta.image)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'];
  if (meta.jsonld && !meta.noindex) tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonld).replace(/</g, '\\u003c')}</script>`);
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`) : html.replace('<head>', `<head><title>${esc(meta.title)}</title>`);
  return withTitle.replace('<head>', '<head>' + tags.join(''));
}
const page = (req, res, next, loader) => {
  if (!fs.existsSync(dist)) return next();
  Promise.resolve(loader()).then(meta => {
    const html = fs.readFileSync(dist, 'utf8');
    const fallback = { title: 'Mağaza', description: 'Online mağaza', canonical: req.path, noindex: true, jsonld: null };
    res.status(meta && !meta.notFound ? 200 : 404).set('Cache-Control', 'no-cache').type('html').send(inject(html, req, meta || fallback));
  }).catch(next);
};
const valid = slug => /^[a-z0-9-]{3,40}$/.test(slug);

router.get('/:slug/sitemap.xml', async (req, res, next) => {
  try {
    const found = valid(req.params.slug) ? await store.sitemapFor(req.params.slug) : null;
    if (!found) return res.status(404).type('text').send('Bulunamadı');
    const base = origin(req) + '/magaza/' + found.slug;
    const urls = [base, ...found.ids.map(id => `${base}/urun/${id}`)];
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join('') + '</urlset>');
  } catch (e) { next(e); }
});
router.get('/:slug', (req, res, next) => page(req, res, next, () => (valid(req.params.slug) ? store.seoFor(req.params.slug, null) : null)));
router.get('/:slug/urun/:id', (req, res, next) => page(req, res, next, () => (valid(req.params.slug) ? store.seoFor(req.params.slug, req.params.id) : null)));
router.get(['/:slug/sepet', '/:slug/siparis/:code'], (req, res, next) => page(req, res, next, async () => { const meta = valid(req.params.slug) ? await store.seoFor(req.params.slug, null) : null; return meta ? { ...meta, noindex: true, canonical: req.path } : null; }));

module.exports = router;
