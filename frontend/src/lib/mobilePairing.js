import api from '../api/client';
import {browserDeviceInfo} from './browserDevice';
export async function mobilePairing(){
 if(!window.veniuxMobile)return;
 if(window.VeniuxAndroid?.isCloud?.())return;
 const ticket=window.VeniuxAndroid?.pairingTicket?.();
 if(!/^[a-f0-9]{64}$/.test(ticket||''))throw new Error('Otomatik giriş için bilgisayarı güncelleyin ve yeni QR kodunu okutun.');
 const device=browserDeviceInfo();
 const headers=license=>{api.defaults.headers.common['x-veniux-device-token']=license.payload.device_token;api.defaults.headers.common['x-device-id']=device.fingerprint;};
 if(localStorage.getItem('veniux_claimed_ticket')===ticket&&localStorage.getItem('token')&&localStorage.getItem('veniux_license_token')){
  try{const payload=JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const license=JSON.parse(localStorage.getItem('veniux_license_token'));if(payload.exp*1000>Date.now()&&license.payload.device_fingerprint===device.fingerprint){headers(license);return;}}catch{}
 }
 const {data}=await api.post('/mobile/claim',{ticket,device_fingerprint:device.fingerprint},{timeout:30000});
 if(!data.token||!data.user?.id||!data.license?.payload?.device_token)throw new Error('Mobil giriş yanıtı doğrulanamadı. Yeni QR kodu alın.');
 localStorage.setItem('token',data.token);localStorage.setItem('user',JSON.stringify(data.user));localStorage.setItem('veniux_license_token',JSON.stringify(data.license));localStorage.setItem('veniux_claimed_ticket',ticket);
 headers(data.license);
 sessionStorage.removeItem('platform-tenant');if(data.tenant_context)sessionStorage.setItem('platform-tenant',data.tenant_context);
}
