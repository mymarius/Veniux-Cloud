// MySQL miktarları "48.000000", UTC zaman damgalarını "2026-11-05 10:00:00" metni olarak döndürür; ekran her iki motorda da aynı değeri görsün.
const QUANTITY=/^-?\d+\.\d{6}$/,UTC_STAMP=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$/;
export function normalizeResponse(value,key=''){
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=normalizeResponse(value[i]);return value;}
  if(typeof value==='string'){
    if(QUANTITY.test(value))return Number(value);
    if(/_at$/.test(key)&&UTC_STAMP.test(value))return value.replace(' ','T')+'Z';
    return value;
  }
  if(value&&Object.getPrototypeOf(value)===Object.prototype)for(const name of Object.keys(value))value[name]=normalizeResponse(value[name],name);
  return value;
}
