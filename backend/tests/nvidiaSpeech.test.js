jest.mock('@grpc/grpc-js',()=>({
 Metadata:class{set(){}},credentials:{createSsl:()=>({})},
 loadPackageDefinition:()=>({nvidia:{riva:{tts:{RivaSpeechSynthesis:class{
  synthesize(request,metadata,options,callback){if(request.language_code!=='tr-TR')throw new Error('Wrong language');callback(null,{audio:Buffer.alloc(4800)});}
 }}}}})
}));
const {synthesize,cleanText,wav}=require('../src/services/nvidiaSpeechService');
test('speech text omits markdown and links and pronounces currency',()=>{
 expect(cleanText('**Merhaba** [Kayıt ol](/register) 990 USD')).toBe('Merhaba Kayıt ol 990 Amerikan doları');
});
test('PCM audio is returned as playable 24 kHz mono WAV',()=>{
 const b=wav(Buffer.alloc(4800));expect(b.subarray(0,4).toString()).toBe('RIFF');expect(b.readUInt32LE(24)).toBe(24000);expect(b.readUInt32LE(40)).toBe(4800);expect(b.length).toBe(4844);
});
test('invalid voice requests are rejected',async()=>{
 await expect(synthesize('')).rejects.toMatchObject({status:400});await expect(synthesize('x'.repeat(2001))).rejects.toMatchObject({status:400});
});
test('Turkish synthesis returns WAV without exposing credentials',async()=>{
 const original=process.env.NVIDIA_API_KEY;process.env.NVIDIA_API_KEY='test-only';
 try{const result=await synthesize('Veniux’a hoş geldiniz.');expect(result.length).toBe(4844);expect(result.toString()).not.toContain('test-only');}finally{if(original===undefined)delete process.env.NVIDIA_API_KEY;else process.env.NVIDIA_API_KEY=original;}
});
