process.env.NODE_ENV='test';
const request=require('supertest');
const app=require('../src/index');
const {createTenant}=require('../tests/factories');
(async()=>{const tenant=await createTenant();const result=await request(app).post('/api/ai/chat').set('Authorization','Bearer '+tenant.token).send({message:'Bu bir bağlantı testidir. Yalnızca: Veniux canlı AI hazır. yaz.'});console.log(JSON.stringify({status:result.status,source:result.body.source,reply:result.body.reply,error:result.body.error}));if(result.status!==200||result.body.source!=='nvidia')process.exitCode=1;})().catch(()=>{console.log('AI endpoint test failed');process.exitCode=1;});
