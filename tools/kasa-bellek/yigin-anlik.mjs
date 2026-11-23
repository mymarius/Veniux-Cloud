import {connect} from './cdp.mjs';
import fs from 'node:fs';
const list=await (await fetch('http://127.0.0.1:9444/json')).json();
const ws=new WebSocket(list.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();let chunks=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='HeapProfiler.addHeapSnapshotChunk')chunks.push(m.params.chunk);else if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
await send('HeapProfiler.enable');await send('HeapProfiler.collectGarbage');
await send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});
const snap=JSON.parse(chunks.join(''));fs.writeFileSync(process.argv[2]||'snap.json',JSON.stringify({nodes:snap.nodes.length}));
const M=snap.snapshot.meta,nf=M.node_fields,ef=M.edge_fields,nfc=nf.length,efc=ef.length;
const iN={type:nf.indexOf('type'),name:nf.indexOf('name'),ec:nf.indexOf('edge_count'),det:nf.indexOf('detachedness'),sz:nf.indexOf('self_size')};
const nodes=snap.nodes,edges=snap.edges,strs=snap.strings,N=nodes.length/nfc;
const ntypes=M.node_types[0],etypes=M.edge_types[0];
const first=new Uint32Array(N+1);let e=0;for(let i=0;i<N;i++){first[i]=e;e+=nodes[i*nfc+iN.ec];}first[N]=e;
const det={};const detIdx=[];
for(let i=0;i<N;i++){if(nodes[i*nfc+iN.det]===2){const n=strs[nodes[i*nfc+iN.name]];det[n]=(det[n]||0)+1;detIdx.push(i);}}
console.log('detached total',detIdx.length);console.log(Object.entries(det).sort((a,b)=>b[1]-a[1]).slice(0,14));
// geri bağlantılar
const retN=new Int32Array(N).fill(-1),retE=new Int32Array(N).fill(-1);
// BFS kökten (GC root = düğüm 0) ve her düğümün ebeveyni (en kısa yol)
const par=new Int32Array(N).fill(-1),pe=new Int32Array(N).fill(-1);const q=[0];par[0]=0;
for(let h=0;h<q.length;h++){const u=q[h];for(let k=first[u];k<first[u+1];k++){const et=etypes[edges[k*efc]];if(et==='weak'||et==='shortcut')continue;const to=edges[k*efc+2]/nfc;if(par[to]===-1){par[to]=u;pe[to]=k;q.push(to);}}}
const nm=i=>ntypes[nodes[i*nfc+iN.type]]+':'+strs[nodes[i*nfc+iN.name]].slice(0,60);
const en=k=>{const t=etypes[edges[k*efc]];const v=edges[k*efc+1];return t+(['element','hidden'].includes(t)?'['+v+']':'.'+strs[v]);};
const seen=new Set();let shown=0;
for(const i of detIdx){if(shown>=6)break;if(par[i]===-1)continue;let path=[];let cur=i;let guard=0;while(cur!==0&&guard++<60){path.push(nm(cur)+'  <-'+en(pe[cur]));cur=par[cur];}
 const key=path.slice(-6).join('|');if(seen.has(key))continue;seen.add(key);shown++;console.log('--- yol ('+path.length+')');console.log(path.slice().reverse().slice(0,40).join('\n'));}
process.exit(0);
