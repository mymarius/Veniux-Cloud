const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.NODE_ENV!=='test')throw Error('Receipt preview is test-only');
const root=path.resolve(__dirname,'../..'),run=JSON.parse(fs.readFileSync(path.join(root,'.local/hardware-lab-runs/latest.json'))).run;
if(path.dirname(run)!==path.join(root,'.local/hardware-lab-runs')||!/^run-[a-f0-9]{24}$/.test(path.basename(run))||fs.realpathSync(run)!==run)throw Error('Unexpected laboratory path');
const server=http.createServer((req,res)=>{const name=req.url?.slice(1);if(!/^(?:receipt|multirate|refund)-(58|80)\.html$/.test(name)||!fs.existsSync(path.join(run,name))){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end(fs.readFileSync(path.join(run,name)));});
server.listen(0,'127.0.0.1',()=>console.log('Isolated receipt preview: http://127.0.0.1:'+server.address().port));
