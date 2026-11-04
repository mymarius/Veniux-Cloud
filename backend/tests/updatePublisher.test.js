const publisher=require('../src/services/updatePublisher');
const crypto=require('crypto');
const originalFetch=global.fetch;
afterAll(()=>{global.fetch=originalFetch;});
test('publication requires a central owner session and sends manifest after local shape checks',async()=>{
 global.fetch=jest.fn(async(url,options)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{token:'a'.repeat(64)}:{success:true}}));
 await expect(publisher.upload(999,'Veniux-test.exe',Buffer.from('x'))).rejects.toMatchObject({status:409});
 expect(global.fetch).not.toHaveBeenCalled();
 await publisher.session(999,'test-password');
 await expect(publisher.upload(999,'latest.yml',Buffer.from('files: []'))).rejects.toMatchObject({status:400});
 const sha512=crypto.createHash('sha512').update('test').digest('base64');
 const body=Buffer.from(require('yaml').stringify({version:'3.0.0',files:[{url:'Veniux-Setup-3.0.0.exe',size:4,sha512}]}));
 await publisher.upload(999,'latest.yml',body);
 const [url,options]=global.fetch.mock.calls.at(-1);
 expect(url).toBe('https://api.veniux.com/updates/upload/windows.json');
 expect(options.redirect).toBe('error');expect(options.headers['X-Veniux-Publish-Token']).toBe('a'.repeat(64));
 expect(JSON.parse(options.body.toString())).toEqual({version:'3.0.0',filename:'Veniux-Setup-3.0.0.exe',bytes:4,sha512});
});
test('large installers are sent in bounded ordered chunks before commit',async()=>{
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,json:async()=>({success:true,token:'b'.repeat(64)})}));
 await publisher.session(1000,'test-password');global.fetch.mockClear();
 const body=Buffer.alloc(8*1048576+17,1);await publisher.upload(1000,'Veniux-test.exe',body);
 expect(global.fetch.mock.calls).toHaveLength(4);
 const chunks=global.fetch.mock.calls.slice(0,3);
 expect(chunks.map(([url])=>url.split('/').at(-1))).toEqual(['0','4194304','8388608']);
 expect(chunks.map(([,options])=>options.body.length)).toEqual([4194304,4194304,17]);
 expect(global.fetch.mock.calls[3][0]).toMatch(/\/finish\/[a-f0-9]{32}\/Veniux-test.exe$/);
});
test('expired central session does not invalidate the business login',async()=>{
 global.fetch=jest.fn(async()=>({ok:false,status:401,json:async()=>({error:'Yayın oturumunu yeniden açın.'})}));
 await expect(publisher.list(999)).rejects.toMatchObject({status:409});
});
