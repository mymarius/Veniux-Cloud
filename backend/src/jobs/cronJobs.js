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
const startCronJobs = () => {
  if (started) return;
  started = true;
  try {
    if (ruleEngineJob) ruleEngineJob.start();
    if (aiAnalysisJob) aiAnalysisJob.start();
    ownerAutomationJob.start();
    alertDeliveryJob.start();
    auditIntegrityJob.start();
    console.log('[Cron] Scheduled tasks started: Rule Engine (6h) | AI Health Check (08:00)');
  } catch (error) {
    console.error('Failed to start cron jobs:', error.message);
  }
};

module.exports = {
  startCronJobs,
  stopCronJobs: () => { for(const job of [ruleEngineJob,aiAnalysisJob,ownerAutomationJob,alertDeliveryJob,auditIntegrityJob]) job?.stop(); started=false; }
};
