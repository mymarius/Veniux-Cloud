export function browserDeviceInfo(storage=localStorage,random=crypto){
 let fingerprint='';
 try{fingerprint=storage.getItem('veniux_browser_device')||'';if(!/^HW-[A-F0-9]{32}$/.test(fingerprint)){const bytes=random.getRandomValues(new Uint8Array(16));fingerprint='HW-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();storage.setItem('veniux_browser_device',fingerprint);if(storage.getItem('veniux_browser_device')!==fingerprint)throw Error('Storage unavailable');}}catch{fingerprint='';}
 const android=typeof navigator!=='undefined'&&navigator.userAgent.includes('VeniuxAndroid/');
 return {fingerprint,deviceName:android?'Android telefon/tablet':'Web tarayıcısı',osInfo:android?'Veniux Android uygulaması':'Tarayıcı cihaz kaydı (donanım parmak izi değildir)'};
}
