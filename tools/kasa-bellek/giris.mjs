// Ölçüm kurulumu: perf-seed.js'in yazdığı kiracı hesabıyla giriş yapar, token'ı Electron sayfasının localStorage'ına koyar ve kasayı açar.
// Kullanım: EMAIL=<owner_...@tenant.com> node giris.mjs   (şifre/telefon perf-seed fabrikasından: password123 / 05551234567; yalnız TEST veritabanı)
import {connect} from './cdp.mjs';
const base=process.env.BASE||'http://127.0.0.1:3100';
const c=await connect();
const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.EMAIL,phone:'05551234567',password:'password123'})});
const j=await r.json();if(!j.token)throw new Error('giriş başarısız: '+JSON.stringify(j));
await c.ev(`localStorage.setItem('token',${JSON.stringify(j.token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify(j.user))});location.href='/magaza/kasa';1`);
await new Promise(r=>setTimeout(r,5000));
console.log('kasa açıldı');c.close();
