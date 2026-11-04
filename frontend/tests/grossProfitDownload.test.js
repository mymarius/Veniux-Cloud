import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateReportDownload } from '../src/utils/grossProfitDownload.js';
const require=createRequire(import.meta.url),X=require('../../backend/node_modules/xlsx');
const expected={from:'2026-10-05',to:'2026-10-06',fingerprint:'same-report'};
const response=(format,bytes)=>({headers:{'content-type':format==='csv'?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="brut-kar_${expected.from}_${expected.to}.${format}"`,'x-report-fingerprint':expected.fingerprint},data:new Blob([bytes])});
const csv='\uFEFF"Tarih";"Ürün";"Barkod";"Net satış"\r\n"2026-10-06";"Çığ şeftali";"0000123456789";"90,00"\r\n"TOPLAM";;;"90,00"\r\n"Başlangıç tarihi";"2026-10-05"\r\n"Bitiş tarihi";"2026-10-06"';
const book=X.utils.book_new();X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([['Tarih','Ürün','Barkod','Net satış'],['2026-10-06','Çığ şeftali','0000123456789',90]]),'Brüt kâr');
const excel=X.write(book,{type:'buffer',bookType:'xlsx',compression:false});
test('geçerli CSV ve tekrar açılabilen Excel kabul edilir',async()=>{
  for(const [format,bytes] of [['csv',csv],['xlsx',excel]]){
    const file=await validateReportDownload(response(format,bytes),format,expected);
    assert.equal(file.filename,`brut-kar_2026-10-05_2026-10-06.${format}`);
  }
  assert.equal(X.read(excel,{type:'buffer'}).Sheets['Brüt kâr'].C2.v,'0000123456789');
});
test('boş, JSON/HTML, yanlış içerik türü veya dosya adı reddedilir',async()=>{
  for(const bytes of ['', '<html>hata</html>', '{"error":"Hata"}'])await assert.rejects(validateReportDownload(response('csv',bytes),'csv',expected),/geçersiz/);
  const wrong=response('csv',csv);wrong.headers['content-type']='text/html';await assert.rejects(validateReportDownload(wrong,'csv',expected),/geçersiz/);
  const wrongName=response('csv',csv);wrongName.headers['content-disposition']='attachment; filename="yanlis.xlsx"';await assert.rejects(validateReportDownload(wrongName,'csv',expected),/geçersiz/);
});
test('kesilmiş veya CRC bozulmuş Excel dosyası sunulmaz',async()=>{
  await assert.rejects(validateReportDownload(response('xlsx',excel.subarray(0,excel.length-1)),'xlsx',expected),/geçersiz/);
  const broken=Buffer.from(excel);const marker=broken.indexOf(Buffer.from('<?xml'));assert.ok(marker>0);broken[marker+3]^=1;
  await assert.rejects(validateReportDownload(response('xlsx',broken),'xlsx',expected),/geçersiz/);
});
test('rapor değişikliği veya UTF-8 bozulması indirmeyi engeller',async()=>{
  const stale=response('csv',csv);stale.headers['x-report-fingerprint']='changed';await assert.rejects(validateReportDownload(stale,'csv',expected),/Rapor değişti/);
  const broken=Buffer.from(csv);broken[10]=0xff;await assert.rejects(validateReportDownload(response('csv',broken),'csv',expected),/geçersiz/);
});
