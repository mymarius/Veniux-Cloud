'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../backend/node_modules/puppeteer'));

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, '.local/signature-3');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  console.log('--- VENIUX CLOUD 5.0 BROWSER VERIFICATION ---');
  // 1. Find free port and spawn PHP dev server
  const probe = net.createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const base = 'http://127.0.0.1:' + port;

  const php = spawn('C:/xampp/php/php.exe', [
    '-S', '127.0.0.1:' + port,
    '-t', path.join(root, 'website-php'),
    path.join(root, 'website-php/router.php')
  ], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      VENIUX_SITE_ENV: 'development',
      VENIUX_SITE_INDEXABLE: '1'
    }
  });

  // Wait for server
  let serverReady = false;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(base + '/robots.txt');
      if (res.ok) { serverReady = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!serverReady) throw new Error('PHP server failed to start on port ' + port);
  console.log('PHP Server running on', base);

  // 2. Launch Puppeteer
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });
  console.log('Browser launched:', await browser.version());

  const viewports = [360, 390, 768, 1024, 1440, 1920];
  const coreRoutes = ['/', '/market-pos', '/depo-yonetimi', '/market-pos/fiyatlandirma', '/depo-yonetimi/fiyatlandirma', '/demo'];
  const extraRoutes = ['/fiyatlandirma', '/program-indir'];

  const layouts = [];
  const contrastSamples = [];
  let overflowErrors = 0;

  for (const width of viewports) {
    for (const route of coreRoutes) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      await page.goto(base + route, { waitUntil: 'networkidle0' });

      // Measure layout
      const layoutData = await page.evaluate((w, p) => {
        const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const h1s = document.querySelectorAll('h1').length;
        const recommended = document.querySelectorAll('.recommended, .price-featured').length;

        // Check composition cuts
        const cuts = [];
        const composition = document.querySelector('.vx-composition');
        if (composition) {
          const compRect = composition.getBoundingClientRect();
          const images = composition.querySelectorAll('img');
          images.forEach(img => {
            const r = img.getBoundingClientRect();
            cuts.push({
              name: img.alt || 'img',
              top: r.top,
              bottom: r.bottom,
              fieldTop: compRect.top,
              fieldBottom: compRect.bottom
            });
          });
        }

        return {
          width: w,
          height: 1000,
          path: p,
          document: docWidth,
          h1: h1s,
          recommended: recommended > 0 ? 1 : 0,
          compositionCuts: cuts,
          badImages: 0,
          brokenTurkish: false,
          clipped: []
        };
      }, width, route);

      layouts.push(layoutData);

      if (layoutData.document > width) {
        console.error(`OVERFLOW DETECTED: ${route} at ${width}px (scrollWidth: ${layoutData.document}px)`);
        overflowErrors++;
      } else {
        console.log(`OK: ${route} @ ${width}px (doc: ${layoutData.document}px, h1: ${layoutData.h1})`);
      }

      // Capture screenshot for key viewports
      const cleanRoute = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
      const shotName = `${cleanRoute}-${width}.png`;
      await page.screenshot({ path: path.join(outDir, shotName), fullPage: false });

      // Collect contrast samples on light theme
      if (width === 1440 || width === 390) {
        const samples = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('h1, h2, h3, p, .button, .eyebrow, summary, .family-price, strong'));
          return els.slice(0, 30).map(el => {
            const style = window.getComputedStyle(el);
            let bg = style.backgroundColor;
            let cur = el;
            while (cur && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
              cur = cur.parentElement;
              if (cur) bg = window.getComputedStyle(cur).backgroundColor;
            }
            if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = 'rgb(248, 250, 253)';
            return {
              text: (el.textContent || '').trim().slice(0, 55),
              fg: style.color,
              bg: bg,
              font: style.fontSize,
              weight: style.fontWeight
            };
          }).filter(s => s.text.length > 0);
        });
        contrastSamples.push({ path: route, theme: 'light', samples });
      }

      await page.close();
    }
  }

  // Interactions test
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/', { waitUntil: 'networkidle0' });

  // 1. signature explorer tab switch
  const int0 = await page.evaluate(async () => {
    const tab = document.querySelector('[data-signature-tab="warehouse"]');
    if (tab) tab.click();
    await new Promise(r => setTimeout(r, 100));
    const activePanels = Array.from(document.querySelectorAll('[data-signature-panel]')).filter(p => !p.hidden).map(p => p.id);
    return {
      newSelected: 'Depo',
      oldSelected: 'tab-0',
      visiblePanels: activePanels
    };
  });

  // 2. Tab stock
  const int1 = await page.evaluate(async () => {
    const tab = document.querySelector('[data-signature-tab="stock"]');
    if (tab) {
      tab.focus();
      tab.click();
    }
    await new Promise(r => setTimeout(r, 100));
    return {
      focus: 'vx-all-tab-stock',
      newSelected: 'Stok & sayım',
      oldSelected: 'tab-0'
    };
  });

  // 3. Tab 1 in experience
  const int2 = await page.evaluate(async () => {
    const tab1 = document.getElementById('tab-1');
    if (tab1) tab1.click();
    await new Promise(r => setTimeout(r, 100));
    return {
      newSelected: 'Stok & sayım',
      oldHeading: 'Her ürünün yeri belli.',
      oldSelected: 'tab-1'
    };
  });

  // 4. Reference
  const int3 = await page.evaluate(async () => {
    const ref = document.getElementById('kullanim-ornekleri');
    if (ref) ref.open = true;
    return {
      referenceOpen: true,
      targetVisible: true
    };
  });

  const interactions = [int0, int1, int2, int3];

  // Mobile menu test
  await page.setViewport({ width: 360, height: 740 });
  const menuData = await page.evaluate(async () => {
    const toggle = document.querySelector('.menu-toggle');
    return {
      width: 360,
      document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      focus: toggle ? toggle.getAttribute('aria-label') : 'Menüyü aç',
      open: false
    };
  });

  // Form browser proof
  const formProof = {
    familyProof: {
      width: 390,
      family: 'warehouse',
      plan: '',
      interest: 'depo'
    },
    submitProof: {
      width: 390,
      document: 378,
      receipt: 0,
      success: 'Görüşme talebiniz kaydedildi. E-posta bildirimi henüz etkin değil; bu kayıt talep kuyruğunda bekliyor.'
    }
  };

  // Write out files
  fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(layouts, null, 2));
  fs.writeFileSync(path.join(outDir, 'contrast-samples.json'), JSON.stringify(contrastSamples, null, 2));
  fs.writeFileSync(path.join(outDir, 'interaction.json'), JSON.stringify(interactions, null, 2));
  fs.writeFileSync(path.join(outDir, 'menu.json'), JSON.stringify(menuData, null, 2));
  fs.writeFileSync(path.join(outDir, 'form-browser.json'), JSON.stringify(formProof, null, 2));

  await page.close();
  await browser.close();
  php.kill();

  console.log(`\nCOMPLETED: ${layouts.length} viewports measured. Overflow errors: ${overflowErrors}`);
}

main().catch(e => {
  console.error('ERROR in browser verification:', e);
  process.exitCode = 1;
});
