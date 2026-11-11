const express = require('express');
const cors = require('cors');
const path = require('path');
require('./middlewares/productionPrivacy').installLogs();
require('./config/runtimeConfig').validate();
require('./services/runtimeControl').assertManagedStart();

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');
if(process.env.NODE_ENV==='production'&&process.env.VENIUX_WEB_ACCESS==='1')app.set('trust proxy','loopback');
app.use(require('./middlewares/requestContext'));
app.use(require('./middlewares/requestFirewall').createFirewall());
app.use(require('./middlewares/productionPrivacy').boundary);

const localOrigins=require('./middlewares/productionPrivacy').defaultOrigins(PORT);
const allowedOrigins=new Set(process.env.CORS_ORIGIN?process.env.CORS_ORIGIN.split(',').map(s=>s.trim()):localOrigins);
app.use((req,res,next)=>{
  const origin=req.get('origin');
  if(!require('./middlewares/productionPrivacy').originAllowed(origin,allowedOrigins,req.get('x-veniux-desktop-origin')))return res.status(403).json({error:'Bu kaynaktan erişime izin verilmiyor.'});
  if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
  next();
});

// Security & CORS Configuration
app.use(cors({
  origin: (origin,callback)=>callback(null,!origin||allowedOrigins.has(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-veniux-device-token', 'idempotency-key', 'x-tenant-id', 'x-file-name','x-upload-type','x-veniux-recovery-code','x-veniux-device-uid','x-veniux-device-platform'],
  exposedHeaders: ['X-Request-Id', 'Content-Disposition', 'X-Report-Fingerprint', 'X-Veniux-Offline-Until']
}));

// Basic Security Response Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if(process.env.NODE_ENV==='production')res.setHeader('Content-Security-Policy', require('./middlewares/productionPrivacy').contentSecurityPolicy);
  next();
});

// Ödeme bildiriminin imzası sağlayıcının gönderdiği ham gövde üzerinden doğrulanır.
app.use(express.json({ limit: '10mb', verify: (req, res, buffer) => { if ((req.originalUrl || '').startsWith('/api/license/webhooks/')) req.rawBody = buffer.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(require('./middlewares/requestFirewall').safeJson);
app.use(require('./middlewares/backupMaintenance').barrier);

// Database initialization
const database = require('./config/database');
require('./services/runtimeControl').install(app,database);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await database.query('SELECT 1');
    const migrations=await database.migrationStatus();
    const isActive = await database.isTargetActive();
    const fenceInfo = await database.getTargetFenceInfo();
    const healthy = migrations.status==='current' && isActive;
    res.status(healthy?200:503).json({ status:healthy?'ok':(isActive?'unavailable':'fenced'),target_active:isActive,fence_version:fenceInfo.fence_version,database:database.getEngine(),app_version:require('../package.json').version,migrations:{status:migrations.status,version:migrations.version,applied:migrations.applied,expected:migrations.expected},timestamp:new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unavailable',migrations:{status:'failed'} });
  }
});

// Retired sector APIs: block before entitlement or controller dispatch.
app.use(['/api/pharmacy','/api/eczane-depo','/api/pharmacy-migration','/api/medicines','/api/admin/medicines'],(req,res)=>res.status(410).json({code:'MODULE_REMOVED',error:'Bu modül artık sunulmuyor.'}));

// Register all API routes
app.get('/api/version',(req,res)=>{const {version,minClient}=require('./config/release.json');res.set('Cache-Control','no-store').json({version,minClient});});
// Token cihaz bildirimi lisans kapısının dışındadır; paylaşılan gizli değerle doğrulanır.
app.post('/integrations/tokenx/callback', express.json({ limit: '64kb' }), async (req, res) => {
  const tokenx = require('./services/tokenxAdapter');
  if (!tokenx.callbackAuthorized(req.get('authorization'))) return res.status(401).json({ error: 'Yetkisiz.' });
  try { const ok = await require('./services/retailExternalService').applyCallback(req.body?.data?.basketID, tokenx.parseResult(req.body)); res.json({ received: true, matched: ok }); }
  catch { res.status(500).json({ error: 'Bildirim işlenemedi.' }); }
});
app.use('/api', require('./services/centralLicense').gate);
app.use('/api/updates', (req,res,next)=>{
 if(!require('./services/updateStorage').validName(req.path.slice(1)))return res.sendStatus(404);
 next();
}, express.static(require('./services/updateStorage').directory,{index:false,maxAge:0}));
if(process.env.VENIUX_CLOUD_SERVICE==='1')app.use('/api/auth/register',(req,res)=>res.status(403).json({error:'Bu çalışma alanında hesaplar yönetici davetiyle açılır.'}));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/business', require('./routes/businessRoutes'));
app.use('/api/packages', require('./routes/packageRoutes'));
app.use('/api/platform', require('./routes/platformRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/warehouses', require('./routes/warehouseRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/stock-counts', require('./routes/stockCountRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/wms', require('./routes/wmsRoutes'));
app.use('/api/license', require('./routes/licenseRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/normal-depo', require('./routes/normalDepo'));
app.use('/api/terminal', require('./routes/terminalRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/mobile', require('./routes/mobileRoutes'));
app.use('/api/backups', require('./routes/backupRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/scanner', require('./routes/scannerRoutes'));
app.use('/api/labels', require('./routes/labelRoutes'));
app.use('/api/retail', require('./routes/retailRoutes'));
app.use('/api/store-sync', require('./routes/storeSyncRoutes'));
app.use('/api/label-checks', require('./routes/labelCheckRoutes'));
app.use('/api/sector', require('./routes/sectorRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
// Token ÖKC adaptörü yalnız ayarları tamsa etkinleşir (Token geliştirici ekibinden gelen adres ve yollar).
try { const tokenx = require('./services/tokenxAdapter'); if (tokenx.config()) require('./services/retailExternalService').register('tokenx', tokenx.adapter()); } catch (error) { console.error('[TokenX] Ayar geçersiz:', error.message); }
app.use('/api/edocuments', require('./routes/edocumentRoutes'));
app.use('/api/accounting-exports', require('./routes/accountingExportRoutes'));

// Serve the built panel from the same local API server.
const frontendDirectory=path.join(__dirname,'../../frontend/dist');
if(process.env.VENIUX_API_ONLY!=='1'){
app.use(express.static(frontendDirectory,{index:'index.html'}));
app.get(/^(?!\/api(?:\/|$)).*/, (req,res,next)=>{
 if(!require('fs').existsSync(path.join(frontendDirectory,'index.html')))return next();
 res.type('html').send(require('fs').readFileSync(path.join(frontendDirectory,'index.html'),'utf8').replace('<head>','<head><base href="/">'));
});
}

// Global error handler with safe production masking
app.use((err, req, res, next) => {
  require('./services/aiErrorJournal').record(req,err);
  console.error('[Server Error]', { requestId: req.requestId, message: err.message });
  const isProd = process.env.NODE_ENV === 'production';
  const status = err.status || 500;
  const aiMessage = Object.prototype.hasOwnProperty.call(require('./services/aiPublicErrors'),err.code) ? require('./services/aiPublicErrors')[err.code] : null;
  
  res.status(status).json({
    error: aiMessage || (err.type === 'entity.parse.failed' ? 'İstek geçerli JSON biçiminde olmalı.' : (isProd && status >= 500 && err.code !== 'TARGET_FENCED') ? 'İşlem sırasında sunucu hatası oluştu' : (err.message || 'Internal server error')),
    code: err.code || undefined,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  database.ready.then(async () => { await require('./services/backupService').recoverInterruptedRestore(); return app.locals.server=app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
    console.log(`=========================================`);
    console.log(`🚀 Veniux Stock Backend running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`=========================================`);

    require('./services/backupService').startScheduler();
    // Mağaza–bulut eşitleme: yalnız masaüstünde (bulut kendisi mağaza değildir); ayar yoksa hiçbir şey yapmaz.
    if (process.env.VENIUX_CLOUD_SERVICE !== '1' && process.env.VENIUX_DISABLE_BACKGROUND_JOBS !== '1') {
      const storeSync = require('./services/storeSyncService');
      setInterval(() => storeSync.pushAll().catch(() => {}), 120000).unref();
    }
    if (process.env.VENIUX_DISABLE_BACKGROUND_JOBS !== '1') { require('./services/stockLossMonitor').startScheduler(); require('./services/marketplaceService').startScheduler(); }
    // Optional: Start cron background tasks
    try {
      if (process.env.NODE_ENV !== 'test' && process.env.VENIUX_DISABLE_BACKGROUND_JOBS!=='1' && !require('./services/centralLicense').enabled()) {
        const { startCronJobs } = require('./jobs/cronJobs');
        startCronJobs();

      }
    } catch (cronErr) {
      console.log('[Cron] Background jobs initialization deferred:', cronErr.message);
    }
  }); }).catch(error => { console.error('Database startup failed:', error.message); process.exitCode = 1; });
}

module.exports = app;

