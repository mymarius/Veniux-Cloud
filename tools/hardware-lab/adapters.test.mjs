import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VirtualHid,VirtualSerialPort,assertLab} from './adapters.mjs';
import {Framer,defaults,clean,ScanQueue} from '../../shared/scanner.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('LAB-HID keyboard events preserve EAN/UPC/Code128/GS1/DataMatrix payloads and intentional repeats',async()=>{
 const scans=[],queue=new ScanQueue(async e=>scans.push(clean(e.raw)));
 const framer=new Framer(defaults,raw=>queue.push({raw}));
 const hid=new VirtualHid(e=>framer.feed(e.key==='Enter'?'\r':e.key));
 const values=['0001234567895','012345678905','CODE128-A-0007',']C1010001234567890510LOT7',']d2010001234567890510LOT7\x1d17291231'];
 for(const value of values)hid.scan(value);hid.scan(values[0]);await queue.tail;framer.reset();
 assert.deepEqual(scans,[...values,values[0]]);
 hid.disconnect();assert.throws(()=>hid.scan('0001'),/disconnected/);
 assert.throws(()=>clean(''));assert.throws(()=>clean('bad\x00data'));
});
test('LAB-COM production bridge streams split frames, reports cable errors and closes the virtual port',async()=>{
 const {createBridge}=require('../../scanner-bridge/server.cjs');
 const origin='http://127.0.0.1:5173',token='lab-'.repeat(16);
 const bridge=createBridge({token,origins:[origin],SerialPort:VirtualSerialPort});
 await new Promise(r=>bridge.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+bridge.server.address().port,headers={Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const abort=new AbortController();let reader;
 try{
  assert.equal((await fetch(base+'/connect',{method:'POST',headers,body:JSON.stringify({path:'LAB-COM1'})})).status,200);
  reader=(await fetch(base+'/events',{headers,signal:abort.signal})).body.getReader();let buffered='';
  async function event(){while(!buffered.includes('\n')){const r=await reader.read();assert(!r.done);buffered+=new TextDecoder().decode(r.value);}const i=buffered.indexOf('\n'),line=buffered.slice(0,i);buffered=buffered.slice(i+1);return JSON.parse(line);}
  assert.equal((await event()).state,'connected');
  const scans=[],framer=new Framer(defaults,x=>scans.push(x));
  VirtualSerialPort.instance.receive('000');VirtualSerialPort.instance.receive('123\r');
  for(let i=0;i<2;i++){const e=await event();assert.equal(e.type,'data');framer.feed(e.data);}
  assert.deepEqual(scans,['000123']);
  VirtualSerialPort.instance.fail();assert.equal((await event()).type,'error');
  assert.equal((await fetch(base+'/disconnect',{method:'POST',headers})).status,200);
  assert.equal((await event()).state,'disconnected');assert.equal(VirtualSerialPort.instance.opened,false);framer.reset();
 }finally{abort.abort();await reader?.cancel().catch(()=>{});bridge.server.closeAllConnections();await new Promise(r=>bridge.server.close(r));}
});
test('LAB-GUARD production cannot activate simulated hardware',()=>{const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.throws(assertLab,/test-only/);}finally{process.env.NODE_ENV=previous;}});
