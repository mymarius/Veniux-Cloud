const {complete}=require('../src/services/nvidiaAIService');
const saved={};
beforeEach(()=>{for(const k of ['NVIDIA_API_KEY','GEMINI_API_KEY'])saved[k]=process.env[k];process.env.NVIDIA_API_KEY='n';process.env.GEMINI_API_KEY='g';});
afterEach(()=>{jest.restoreAllMocks();for(const k of Object.keys(saved)){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
const nvidia=(status,body)=>({ok:status<400,status,body:{cancel:async()=>{}},json:async()=>body});
const gemini={ok:true,status:200,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'merhaba'}]}}]})};
test('uses Gemini when NVIDIA rejects the model, keeping the system prompt',async()=>{
 const spy=jest.spyOn(global,'fetch').mockResolvedValueOnce(nvidia(404)).mockResolvedValueOnce(gemini);
 expect(await complete([{role:'system',content:'kural'},{role:'user',content:'selam'},{role:'assistant',content:'a'},{role:'user',content:'b'}])).toBe('merhaba');
 const [url,opt]=spy.mock.calls[1];const body=JSON.parse(opt.body);
 expect(url).toContain('generativelanguage');expect(url).not.toContain('key=');
 expect(body.systemInstruction.parts[0].text).toBe('kural');
 expect(body.contents.map(c=>c.role)).toEqual(['user','model','user']);
});
test('NVIDIA success does not call Gemini',async()=>{
 const spy=jest.spyOn(global,'fetch').mockResolvedValueOnce(nvidia(200,{choices:[{message:{content:'tamam'}}]}));
 expect(await complete([{role:'user',content:'x'}])).toBe('tamam');expect(spy).toHaveBeenCalledTimes(1);
});
test('rate limit is not hidden by fallback',async()=>{
 jest.spyOn(global,'fetch').mockResolvedValueOnce(nvidia(429));
 await expect(complete([{role:'user',content:'x'}])).rejects.toMatchObject({code:'AI_RATE_LIMITED'});
});
test('without any key it reports not configured',async()=>{
 delete process.env.NVIDIA_API_KEY;delete process.env.GEMINI_API_KEY;
 await expect(complete([{role:'user',content:'x'}])).rejects.toMatchObject({code:'AI_NOT_CONFIGURED'});
});
