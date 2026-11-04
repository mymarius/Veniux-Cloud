const express=require('express'),request=require('supertest');
const privacy=require('../src/middlewares/productionPrivacy');
test('production default origins omit unrelated developer ports while retaining installed desktop origin',()=>{
 expect(privacy.defaultOrigins(44079,'production')).toEqual(['http://127.0.0.1:44079','http://localhost:44079','null']);
 expect(privacy.defaultOrigins(44079,'development')).toContain('http://localhost:5173');
});
test('production hides controller-handled failures and preserves validation and success contracts',async()=>{
 const old=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try {
  const app=express();app.use((req,res,next)=>{req.requestId='test-request';next();},privacy.boundary);
  app.get('/failure',(req,res)=>res.status(502).json({error:'password=never-expose mysql://user:pass@host/db',stack:'private stack'}));
  app.get('/validation',(req,res)=>res.status(409).json({error:'Stok yetersiz.',code:'STOCK_CONFLICT'}));
  app.get('/success',(req,res)=>res.json({sale_id:12,total_cents:12345}));
  const fail=await request(app).get('/failure');expect(fail.status).toBe(502);expect(JSON.stringify(fail.body)).not.toMatch(/never-expose|mysql|stack/);expect(fail.body.requestId).toBe('test-request');
  expect((await request(app).get('/validation')).body).toEqual({error:'Stok yetersiz.',code:'STOCK_CONFLICT'});
  expect((await request(app).get('/success')).body).toEqual({sale_id:12,total_cents:12345});
 }finally{process.env.NODE_ENV=old;}
});
test('logs remove error objects, nested secrets, serialized payloads and connection URIs',()=>{
 expect(privacy.logValue(new Error('private password'))).toEqual({error:'Operation failed'});
 const value=privacy.logValue({authorization:'Bearer private',nested:{password:'private',value:2}});
 expect(JSON.stringify(value)).not.toContain('private');expect(value.nested.value).toBe(2);
 expect(privacy.logValue('{"password":"private","count":3}')).not.toContain('private');
 expect(privacy.text('mysql://user:pass@host/db Bearer abcd token=secret',{FISH_API_KEY:'abc123'})).not.toMatch(/pass@|abcd|=secret/);
 expect(privacy.text('configured abc123',{FISH_API_KEY:'abc123'})).not.toContain('abc123');
});
test('controller-reclassified SQL failures cannot disclose schema or query parameters as validation errors',()=>{
 expect(privacy.errorBody({error:'SQLITE_ERROR no such table: private_records',sql:'SELECT secret',parameters:['private'],requestId:'abc'})).toEqual({error:'İşlem tamamlanamadı. Sistem yöneticisine başvurun.',requestId:'abc'});
 expect(privacy.errorBody({error:'Stok yetersiz.',code:'STOCK_CONFLICT'})).toEqual({error:'Stok yetersiz.',code:'STOCK_CONFLICT'});
});
test('installed production logger drops dynamic provider error text and retains only correlation',()=>{
 const old=process.env.NODE_ENV,originals=Object.fromEntries(['log','info','warn','error','debug'].map(k=>[k,console[k]]));
 const output=[];
 try {
  process.env.NODE_ENV='production';for(const k of Object.keys(originals))console[k]=(...args)=>output.push(args);
  privacy.installLogs();console.error('Login error:',new Error('private-sentinel'),{requestId:'11111111-1111-1111-1111-111111111111',message:'private-sentinel'});
  console.warn('dynamic '+ 'private-sentinel@host');
  expect(JSON.stringify(output)).not.toContain('private-sentinel');expect(JSON.stringify(output)).toContain('11111111-1111-1111-1111-111111111111');
 }finally{process.env.NODE_ENV=old;Object.assign(console,originals);}
});
