const {complete}=require('../src/services/nvidiaAIService');
const savedFetch=global.fetch,savedKey=process.env.NVIDIA_API_KEY;
beforeEach(()=>{process.env.NVIDIA_API_KEY='synthetic-test-key';global.fetch=jest.fn();});
afterAll(()=>{global.fetch=savedFetch;if(savedKey===undefined)delete process.env.NVIDIA_API_KEY;else process.env.NVIDIA_API_KEY=savedKey;});
const answer=content=>({ok:true,json:async()=>({choices:[{message:{content},finish_reason:'stop'}]})});
test('a temporary provider failure is retried once',async()=>{global.fetch.mockResolvedValueOnce({ok:false,status:502}).mockResolvedValueOnce(answer('{"reply":"Merhaba","action":null}'));expect(JSON.parse(await complete([],{json:true})).reply).toBe('Merhaba');expect(global.fetch).toHaveBeenCalledTimes(2);});
test('JSON code fences are accepted without executing content',async()=>{global.fetch.mockResolvedValue(answer('```json\n{"reply":"Merhaba","action":null}\n```'));expect(JSON.parse(await complete([],{json:true})).action).toBeNull();});
test('invalid output fails closed after one retry',async()=>{global.fetch.mockResolvedValue(answer('invalid JSON'));await expect(complete([],{json:true})).rejects.toMatchObject({code:'AI_INVALID_RESPONSE'});expect(global.fetch).toHaveBeenCalledTimes(2);});
test('rate limits and invalid credentials are not retried',async()=>{for(const status of [429,401]){global.fetch.mockReset().mockResolvedValue({ok:false,status});await expect(complete([],{json:true})).rejects.toMatchObject({code:status===429?'AI_RATE_LIMITED':'AI_PROVIDER_AUTH'});expect(global.fetch).toHaveBeenCalledTimes(1);}});
