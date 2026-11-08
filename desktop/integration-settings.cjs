const fs=require('node:fs'),path=require('node:path'),{parseEnv}=require('node:util');
const allowed=new Set(['TOKENX_AUTH_URL','TOKENX_API_URL','TOKENX_CLIENT_ID','TOKENX_CLIENT_SECRET','TOKENX_TERMINAL_ID','TOKENX_PATH_ADD_INSTANT','TOKENX_PATH_GET_BASKET','TOKENX_CALLBACK_AUTH','NVIDIA_API_KEY','NVIDIA_MODEL','GEMINI_API_KEY','GEMINI_TTS_MODEL','GEMINI_TTS_VOICE','FISH_API_KEY','FISH_TTS_MODEL','FISH_VOICE_ID','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','NETGSM_USERCODE','NETGSM_PASSWORD','NETGSM_MSGHEADER','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM']);
function load(directory,env=process.env){
 const file=path.join(directory,'integrations.env');if(!fs.existsSync(file))return;
 const values=parseEnv(fs.readFileSync(file,'utf8'));
 for(const [name,value]of Object.entries(values))if(allowed.has(name)&&value)env[name]=value;
}
module.exports={load,allowed};
