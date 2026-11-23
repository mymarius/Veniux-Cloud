export async function connect(port=9444){
 const list=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
 const t=list.find(x=>x.type==='page');const ws=new WebSocket(t.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pend=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{r,j}=pend.get(m.id);pend.delete(m.id);m.error?j(new Error(JSON.stringify(m.error))):r(m.result);}};
 const send=(method,params={})=>new Promise((r,j)=>{const i=++id;pend.set(i,{r,j});ws.send(JSON.stringify({id:i,method,params}));});
 const ev=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 return {send,ev,close:()=>ws.close()};
}
