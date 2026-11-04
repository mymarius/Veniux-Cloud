const {boundary}=require('../src/middlewares/productionPrivacy');
const mode=process.env.NODE_ENV;
beforeEach(()=>{process.env.NODE_ENV='production'});afterAll(()=>{process.env.NODE_ENV=mode});
function reply(value){let result;const res={statusCode:502,json:v=>{result=v}};boundary({requestId:'test-request'},res,()=>{});res.json(value);return result;}
test('known AI failures use fixed safe descriptions',()=>{const result=reply({code:'AI_INVALID_RESPONSE',error:'secret provider body',stack:'private stack'});expect(result.code).toBe('AI_INVALID_RESPONSE');expect(result.error).toBe('Asistan yanıtı tamamlanamadı. Lütfen tekrar deneyin.');expect(JSON.stringify(result)).not.toMatch(/secret|private/);});
test('unrecognized server errors remain masked',()=>{const result=reply({code:'UNKNOWN_ERROR',error:'SELECT password FROM users',stack:'private stack'});expect(JSON.stringify(result)).not.toMatch(/SELECT|password|private/);expect(result.error).toContain('sunucu hatası');});
