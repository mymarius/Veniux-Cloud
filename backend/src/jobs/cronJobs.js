const cron = require('node-cron');
const { runAlertRuleEngine } = require('../services/alertRuleEngine');
const { runAIAnalysis } = require('../services/aiAnalysisService');

/**
 * Scheduled Tasks using node-cron (5-field standard format: min hour day month weekday)
 */

// Rule engine: Run every 6 hours at minute 0
let ruleEngineJob;
try {
  ruleEngineJob = cron.createTask('0 */6 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Scheduled alert rule engine running...`);
    try {
      const result = await runAlertRuleEngine();
      console.log(`[${new Date().toISOString()}] Rule engine result:`, result);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Rule engine error:`, error.message);
    }
  }, { timezone: 'Europe/Istanbul', noOverlap: true });
} catch (e) {
  console.warn('Rule engine cron init deferred:', e.message);
}

// AI analysis: Run every day at 08:00
let aiAnalysisJob;
try {
  aiAnalysisJob = cron.createTask('0 8 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Scheduled AI analysis running...`);
    try {
      const result = await runAIAnalysis();
      console.log(`[${new Date().toISOString()}] AI analysis result:`, result);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AI analysis error:`, error.message);
    }
  }, { timezone: 'Europe/Istanbul', noOverlap: true });
} catch (e) {
  console.warn('AI analysis cron init deferred:', e.message);
}

let started = false;
const ownerAutomationJob=cron.createTask('* * * * *',()=>require('../services/ownerAutomationService').tick(),{timezone:'Europe/Istanbul',noOverlap:true});
// Uyarı özetleri 10 dakikada bir; sessiz saatler ve günlük sınır servis içinde uygulanır.
// Denetim kaydı zinciri dakikada bir mühürlenir; saklama süresi dolanlar günde bir kez silinir.
const auditIntegrityJob=cron.createTask('* * * * *',()=>require('../services/auditIntegrityService').tick(),{timezone:'Europe/Istanbul',noOverlap:true});
const alertDeliveryJob=cron.createTask('*/10 * * * *',()=>require('../services/alertDeliveryService').tick(),{timezone:'Europe/Istanbul',noOverlap:true});
// Süresi dolan ücretli lisansı Lite'a indirir; yalnız VENIUX_LITE_DOWNGRADE=1 iken çalışır.
const liteDowngradeJob=cron.createTask('30 3 * * *',async()=>{const d=require('../services/liteDowngrade');if(d.enabled())await d.run();},{timezone:'Europe/Istanbul',noOverlap:true});
// TCMB günlük kuru: her gün 10:05 ve hafta içi 15:45 (kur 15:30'da yayınlanır). Hafta sonu/tatilde dosya son kuru verir; ağ hatasında son kur kalır.
const fxRateJob=cron.createTask('5 10 * * *',()=>require('../services/fxAutoService').run().catch(e=>console.warn('[Kur]',e.message)),{timezone:'Europe/Istanbul',noOverlap:true});
const fxRateAfternoonJob=cron.createTask('45 15 * * 1-5',()=>require('../services/fxAutoService').run().catch(e=>console.warn('[Kur]',e.message)),{timezone:'Europe/Istanbul',noOverlap:true});
const startCronJobs = () => {
  if (started) return;
  started = true;
  try {
    if (ruleEngineJob) ruleEngineJob.start();
    if (aiAnalysisJob) aiAnalysisJob.start();
    ownerAutomationJob.start();
    alertDeliveryJob.start();
    auditIntegrityJob.start();
    liteDowngradeJob.start();
    fxRateJob.start();
    fxRateAfternoonJob.start();
    console.log('[Cron] Scheduled tasks started: Rule Engine (6h) | AI Health Check (08:00)');
  } catch (error) {
    console.error('Failed to start cron jobs:', error.message);
  }
};

module.exports = {
  startCronJobs,
  stopCronJobs: () => { for(const job of [ruleEngineJob,aiAnalysisJob,ownerAutomationJob,alertDeliveryJob,auditIntegrityJob,liteDowngradeJob,fxRateJob,fxRateAfternoonJob]) job?.stop(); started=false; }
};
