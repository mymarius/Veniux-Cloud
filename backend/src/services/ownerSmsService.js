const {normalizePhone}=require('./ownerPhone');
const configured=()=>Boolean(process.env.NETGSM_USERCODE&&process.env.NETGSM_PASSWORD&&process.env.NETGSM_MSGHEADER);
const escapeXml=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
async function send(phone,message){
 if(!configured())return {status:'not_configured'};
 const normalized=normalizePhone(phone);if(!normalized)return {status:'invalid_phone'};
 const xml=`<?xml version="1.0" encoding="UTF-8"?><mainbody><header><company dil="TR">Netgsm</company><usercode>${escapeXml(process.env.NETGSM_USERCODE)}</usercode><password>${escapeXml(process.env.NETGSM_PASSWORD)}</password><type>1:n</type><msgheader>${escapeXml(process.env.NETGSM_MSGHEADER)}</msgheader></header><body><msg>${escapeXml(message.slice(0,500))}</msg><no>${normalized.slice(1)}</no></body></mainbody>`;
 try{
  const response=await fetch('https://api.netgsm.com.tr/sms/send/xml',{method:'POST',headers:{'Content-Type':'application/xml; charset=UTF-8'},body:xml,signal:AbortSignal.timeout(15000)});
  const result=(await response.text()).trim();const match=/^(00|01|02)\s+(\d+)$/.exec(result);
  if(response.ok&&match)return {status:'accepted',job_id:match[2]};
  return {status:'rejected'};
 }catch{return {status:'unknown'};}
}
module.exports={configured,send};
