// Netgsm SMS gönderimi (1:n XML). İstek biçimi Netgsm'in kendi yayımladığı PHP paketiyle aynıdır
// (github.com/netgsm1/sms, src/SmsSend.php: POST https://api.netgsm.com.tr/sms/send/xml, Content-Type: text/xml).
// - <filter>0: ticari olmayan ileti (stok/sayım bildirimleri reklam değildir; İYS kontrolü uygulanmaz).
// - <encoding>TR: Türkçe karakterler korunur.
// - Yanıt düz metindir: "00|01|02 <görev no>" başarılıdır; diğer kodlar hata nedenidir.
const {normalizePhone}=require('./ownerPhone');
const configured=()=>Boolean(process.env.NETGSM_USERCODE&&process.env.NETGSM_PASSWORD&&process.env.NETGSM_MSGHEADER);
const escapeXml=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
// CDATA içinde "]]>" dizisi bölünür; böylece ileti metni XML'i bozamaz.
const cdata=value=>'<![CDATA['+String(value).replace(/]]>/g,']]]]><![CDATA[>')+']]>';
const ERRORS={
 '20':'Mesaj metni hatalı veya çok uzun.',
 '30':'Netgsm kullanıcı adı/parolası geçersiz, API izni yok veya IP kısıtlaması var.',
 '40':'Gönderici adı (başlık) Netgsm\'de tanımlı değil.',
 '50':'Hesap İYS kontrollü gönderim yapamıyor.',
 '51':'Aboneliğe tanımlı İYS marka bilgisi yok.',
 '70':'Eksik veya hatalı parametre.',
 '80':'Gönderim sınırı aşıldı.',
 '85':'Aynı numaraya kısa sürede çok fazla gönderim yapıldı.'
};
function request(phone,message){
 return `<?xml version="1.0" encoding="UTF-8"?><mainbody><header><company dil="TR">Netgsm</company><usercode>${escapeXml(process.env.NETGSM_USERCODE)}</usercode><password>${escapeXml(process.env.NETGSM_PASSWORD)}</password><type>1:n</type><msgheader>${escapeXml(process.env.NETGSM_MSGHEADER)}</msgheader><filter>0</filter><encoding>TR</encoding></header><body><msg>${cdata(String(message).slice(0,500))}</msg><no>${phone}</no></body></mainbody>`;
}
async function send(phone,message){
 if(!configured())return {status:'not_configured'};
 const normalized=normalizePhone(phone);if(!normalized)return {status:'invalid_phone'};
 try{
  const response=await fetch(process.env.NETGSM_TEST_BASE_URL||'https://api.netgsm.com.tr/sms/send/xml',{method:'POST',headers:{'Content-Type':'text/xml; charset=UTF-8'},body:request(normalized.slice(1),message),signal:AbortSignal.timeout(15000),redirect:'error'});
  const result=(await response.text()).trim();const match=/^(00|01|02)\s+(\d+)$/.exec(result);
  if(response.ok&&match)return {status:'accepted',job_id:match[2]};
  const code=/^(\d{2})\b/.exec(result)?.[1];
  return {status:'rejected',...(code?{code,detail:ERRORS[code]||'Netgsm isteği reddetti ('+code+').'}:{})};
 }catch{return {status:'unknown'};}
}
module.exports={configured,send,request,ERRORS};
