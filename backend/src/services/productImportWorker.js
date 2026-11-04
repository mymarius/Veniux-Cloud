const {parentPort,workerData}=require('worker_threads');
try{
 const buffer=Buffer.from(workerData.base64,'base64'),name=workerData.filename.toLowerCase();let headers,rows,sheet;
 if(name.endsWith('.csv')){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');
  const result=require('papaparse').parse(text,{skipEmptyLines:'greedy',dynamicTyping:false});if(result.errors.length)throw Error('CSV yapısı hatalı: '+result.errors[0].message);
  const data=result.data;if(data.length>1001)throw Error('Bir aktarım en fazla 1000 satır olabilir.');headers=data.shift()||[];
  rows=data.map((r,i)=>({row:i+2,cells:r.map(v=>({value:v,type:'s'}))}));
 }else if(name.endsWith('.xlsx')||name.endsWith('.xls')){
  const XLSX=require('xlsx'),book=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellNF:true,sheetRows:1002});sheet=book.SheetNames[0];const tab=book.Sheets[sheet];if(!tab||!tab['!ref'])throw Error('Excel sayfası boş.');const range=XLSX.utils.decode_range(tab['!fullref']||tab['!ref']);if(range.e.r-range.s.r>1000||range.e.c-range.s.c>49)throw Error('En fazla 1000 satır ve 50 sütun desteklenir.');
  const cells=r=>Array.from({length:range.e.c-range.s.c+1},(_,i)=>{const c=tab[XLSX.utils.encode_cell({r,c:range.s.c+i})];return {value:c?.v??'',type:c?.t||'s',formula:!!c?.f};});headers=cells(range.s.r).map(c=>String(c.value));rows=[];for(let r=range.s.r+1;r<=range.e.r;r++){const v=cells(r);if(v.some(c=>c.value!==''||c.formula))rows.push({row:r+1,cells:v});}
 }else throw Error('Yalnızca Excel (.xlsx/.xls) veya UTF-8 CSV yükleyin.');
 if(!headers.length||headers.length>50||!rows.length)throw Error('Başlık ve en az bir ürün satırı gerekli.');
 if(rows.some(r=>r.cells.length!==headers.length))throw Error('Satır ve başlık sütun sayıları eşleşmiyor.');
 if(headers.some(h=>String(h).length>200)||rows.some(r=>r.cells.some(c=>String(c.value).length>2000)))throw Error('Hücre metni çok uzun.');
 parentPort.postMessage({headers:headers.map(String),rows,sheet:sheet||'CSV'});
}catch(e){parentPort.postMessage({error:e.message});}
