process.env.NODE_ENV='test';
const path=require('path'),fs=require('fs'),http=require('http');
const B=path.resolve(__dirname,'../../backend');
const app=require(B+'/src/index'),db=require(B+'/src/config/database');
const DIST=path.resolve(process.env.DIST_DIR||path.join(__dirname,'../../frontend/dist'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
db.ready.then(()=>{
 http.createServer((req,res)=>{
  if(req.url.startsWith('/api')||req.url.startsWith('/health'))return app(req,res);
  let p=decodeURIComponent(req.url.split('?')[0]);let f=path.join(DIST,p);
  if(!f.startsWith(DIST)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){const parts=p.split('/').filter(Boolean);let g=null;for(let i=1;i<parts.length;i++){const c=path.join(DIST,...parts.slice(i));if(fs.existsSync(c)&&fs.statSync(c).isFile()){g=c;break;}}f=g||path.join(DIST,'index.html');}
  res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(f).pipe(res);
 }).listen(Number(process.env.PORT||3100),'127.0.0.1',()=>console.log('up 3100 pid',process.pid));
});
