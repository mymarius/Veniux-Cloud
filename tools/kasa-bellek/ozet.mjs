import fs from 'node:fs';
const f=process.argv[2];const L=fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const mb=x=>x==null?'-':(x/1e6).toFixed(1);
console.log('n | heapPost MB | nodes | attached | listeners | renderer ws/priv MB | browser ws | gpu ws | server ws/priv | idb MB | scan med | pay med | catReq');
for(const r of L.filter(x=>x.kind==='sample')){const p=Object.entries(r.proc);const g=t=>p.find(([k])=>k.startsWith(t))?.[1]||{};const rn=p.filter(([k])=>k.startsWith('renderer')).sort((a,b)=>b[1].ws-a[1].ws)[0]?.[1]||{};
console.log([r.n,mb(r.heapPost),r.nodes,r.extra.domAll,r.listeners,mb(rn.ws)+'/'+mb(rn.priv),mb(g('browser').ws),mb(g('GPU').ws),mb(r.proc.server?.ws)+'/'+mb(r.proc.server?.priv),mb(r.extra.idb_usage),r.lat.scan,r.lat.pay,r.extra.xhr.catalog].join(' | '));}
