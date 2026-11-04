const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('SheetJS 0.20.3 preserves Turkish text, text barcodes, dates and money through Excel round trip',()=>{
 const XLSX=require('xlsx');assert.equal(XLSX.version,'0.20.3');
 const sheet=XLSX.utils.aoa_to_sheet([['Ürün','Barkod','Tutar','Tarih'],['İlaç Çığ','0012345678905',123.45,'2026-10-08']]);
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Ürünler');
 const parsed=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer',cellDates:true}).Sheets['Ürünler'];
 assert.equal(parsed.A2.v,'İlaç Çığ');assert.equal(parsed.B2.t,'s');assert.equal(parsed.B2.v,'0012345678905');assert.equal(parsed.C2.v,123.45);assert.equal(parsed.D2.v,'2026-10-08');
});

test('Nodemailer 10 creates the existing UTF-8 notification MIME using a local stream transport',async()=>{
 const nodemailer=require('nodemailer');assert.equal(require('nodemailer/package.json').version,'10.0.16');
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const sent=await transport.sendMail({from:'sender@test.invalid',to:'owner@test.invalid',subject:'Stok uyarısı',text:'İade ve düşük stok',html:'<p>İade ve düşük stok</p>'});
 assert.deepEqual(sent.envelope.to,['owner@test.invalid']);assert.ok(sent.messageId);assert.ok(Buffer.isBuffer(sent.message));
 assert.match(sent.message.toString(),/charset=utf-8/i);assert.match(sent.message.toString(),/multipart\/alternative/);transport.close();
});

test('Scoped js-yaml 4 override loads YAML and extended NYC coverage configurations through the actual parent',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-nyc-'));
 try{
 fs.writeFileSync(path.join(dir,'package.json'),'{}');fs.writeFileSync(path.join(dir,'base.yml'),'include:\n  - src/**/*.js\n');fs.writeFileSync(path.join(dir,'.nycrc.yml'),'extends: ./base.yml\nall: true\nexclude:\n  - tests/**\n');
 const result=await require('@istanbuljs/load-nyc-config').loadNycConfig({cwd:dir,nycrcPath:'.nycrc.yml'});
 assert.equal(result.all,true);assert.deepEqual(result.include,['src/**/*.js']);assert.deepEqual(result.exclude,['tests/**']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('WhatsApp SDK works with Puppeteer 25 CommonJS bridge and real local browser page APIs; no WhatsApp login/delivery',async(t)=>{
 const puppeteer=require('puppeteer'),{Client,LocalAuth}=require('whatsapp-web.js');
 const client=new Client({authStrategy:new LocalAuth({clientId:'dependency-compatibility'}),puppeteer:{headless:true}});
 assert.equal(typeof client.initialize,'function');assert.equal(typeof puppeteer.connect,'function');assert.equal(typeof puppeteer.launch,'function');
 const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
 if(!executable){t.skip('Local Chromium unavailable: browser compatibility requires separate verification');return;}
 const browser=await puppeteer.launch({executablePath:executable,headless:true,timeout:20000});
 try{
 const [page]=await browser.pages();await page.setUserAgent(client.options.userAgent);await page.setBypassCSP(true);
 await page.evaluateOnNewDocument(()=>{window.compatibilityMarker='loaded';});await page.exposeFunction('hostEcho',v=>v);
 await page.goto('data:text/html,<html><title>Compatibility</title><body>Local page</body></html>');
 await page.waitForFunction(()=>window.compatibilityMarker==='loaded');assert.equal(await page.evaluate(()=>window.hostEcho('ok')),'ok');
 assert.equal(await page.title(),'Compatibility');assert.equal(typeof page.on,'function');assert.equal(typeof page.waitForNavigation,'function');
 const remote=await puppeteer.connect({browserWSEndpoint:browser.wsEndpoint()});assert.ok((await remote.pages()).length);await remote.disconnect();
 }finally{await browser.close();}
});
