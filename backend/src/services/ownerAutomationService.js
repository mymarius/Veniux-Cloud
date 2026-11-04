const db=require('../config/database');
const policies=require('./settingsPolicyService');
const defaults={enabled:false,intervalMinutes:1440,ruleChecks:true,aiAnalysis:true,smsOnCompletion:true,whatsappOnCompletion:false};
async function config(tenant){return {...defaults,...await policies.read(tenant,'automation')};}
async function run(tenant,{scheduled=false,centralLicense}={}){
 const settings=await config(tenant);
 if(scheduled&&!settings.enabled)return {skipped:true};
 const id=await db.transaction(async client=>{
  const previous=(await client.query('SELECT status,started_at FROM assistant_runs WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1',[tenant])).rows[0];
  if(previous?.status==='running')return null;
  if(scheduled&&previous&&Date.now()-Date.parse(previous.started_at)<settings.intervalMinutes*60000)return null;
  const result=await client.query("INSERT INTO assistant_runs (tenant_id,status,started_at) VALUES ($1,'running',$2) RETURNING id",[tenant,new Date().toISOString()]);
  return result.rows[0].id;
 });
 if(!id)return {skipped:true};
 let summary='',status='completed';
 try{
  let created=0;
  if(settings.ruleChecks)created+=(await require('./alertRuleEngine').runAlertRuleEngine(tenant)).created;
  if(settings.aiAnalysis){const result=await require('./aiAnalysisService').runAIAnalysis(tenant);if(result.skipped)throw new Error('AI sağlayıcısı yapılandırılmamış.');created+=result.created;}
  const moduleType=await require('./moduleAccess').getModuleType(tenant,centralLicense);
  const overview=await require('./assistantMonitor').overview({tenantId:tenant,moduleType});
  summary=`Kontroller tamamlandı. ${created} yeni uyarı kaydedildi. ${overview.summary}`;
 }catch{status='failed';summary='Otomatik kontrolün bazı adımları tamamlanamadı. Yapılan işlemler ve işletme uyarıları panelden kontrol edilmelidir.';}
 await db.query('UPDATE assistant_runs SET summary=$1 WHERE tenant_id=$2 AND id=$3',[summary,tenant,id]);
 let sms={status:'not_requested'};
 if(settings.smsOnCompletion){
  const company=(await db.query('SELECT owner_phone FROM tenants WHERE id=$1',[tenant])).rows[0];
  await db.query("UPDATE assistant_runs SET sms_status='sending' WHERE tenant_id=$1 AND id=$2",[tenant,id]);
  sms=await require('./ownerSmsService').send(company?.owner_phone,`Veniux: ${summary}`);
  await db.query('UPDATE assistant_runs SET sms_status=$1,sms_job_id=$2 WHERE tenant_id=$3 AND id=$4',[sms.status,sms.job_id||null,tenant,id]);
 }
 let whatsapp={status:'not_requested'};
 if(settings.whatsappOnCompletion){
  await db.query("UPDATE assistant_runs SET whatsapp_status='sending' WHERE tenant_id=$1 AND id=$2",[tenant,id]);
  whatsapp=await require('./ownerWhatsAppService').send(tenant,`Veniux: ${summary}`);
  await db.query('UPDATE assistant_runs SET whatsapp_status=$1,whatsapp_message_id=$2 WHERE tenant_id=$3 AND id=$4',[whatsapp.status,whatsapp.message_id||null,tenant,id]);
 }
 await db.query('UPDATE assistant_runs SET status=$1,finished_at=$2 WHERE tenant_id=$3 AND id=$4',[status,new Date().toISOString(),tenant,id]);
 await db.query('INSERT INTO audit_logs (tenant_id,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5)',[tenant,'owner_automation_run','assistant_run',id,JSON.stringify({status,sms_status:sms.status})]);
 return {id,status,summary,sms_status:sms.status,whatsapp_status:whatsapp.status};
}
async function tick({centralLicense}={}){
 // A stopped server cannot finish a run. Mark it visibly failed; never resend an ambiguous SMS.
 const cutoff=new Date(Date.now()-60*60000).toISOString();
 await db.query("UPDATE assistant_runs SET status='failed',sms_status=CASE WHEN sms_status='sending' THEN 'unknown' ELSE sms_status END,whatsapp_status=CASE WHEN whatsapp_status='sending' THEN 'unknown' ELSE whatsapp_status END,summary='Sunucu kesintisi nedeniyle kontrol tamamlanamadı.',finished_at=$1 WHERE status='running' AND started_at<$2",[new Date().toISOString(),cutoff]);
 const tenants=(await db.query('SELECT id FROM tenants WHERE is_active=1')).rows;
 for(const tenant of tenants){
  try{if(await require('./moduleAccess').getModuleType(tenant.id,centralLicense)==='NONE')continue;await run(tenant.id,{scheduled:true,centralLicense});}
  catch{console.error('[Owner automation] Tenant job failed:',tenant.id);}
 }
}
module.exports={defaults,config,run,tick};
