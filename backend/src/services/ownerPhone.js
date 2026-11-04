function normalizePhone(value) {
 if(typeof value!=='string'||!/^[+\d\s().-]+$/.test(value))return null;
 let digits=value.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(/^05\d{9}$/.test(digits))digits='90'+digits.slice(1);
 if(/^5\d{9}$/.test(digits))digits='90'+digits;
 return /^905\d{9}$/.test(digits)?'+'+digits:null;
}
module.exports={normalizePhone};
