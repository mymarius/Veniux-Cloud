// UI checkpoint only: this never grants sale permissions or replaces server checks.
export function acceptTerminalIdentity(mode,current,candidate){
 if(!candidate?.id||String(candidate.tenant_id)!==String(current.tenant_id))throw Error('Aynı işletmeye ait yetkili hesap gerekli.');
 if(mode==='unlock'&&String(candidate.id)!==String(current.id))throw Error('Kilidi yalnız bu kasiyerin hesabı açabilir.');
 if(mode==='approve'&&!['admin','manager'].includes(candidate.role))throw Error('Yönetici hesabı gerekli.');
 if(mode==='switch'&&!['admin','manager','cashier'].includes(candidate.role))throw Error('Satış yetkili kasiyer hesabı gerekli.');
 if(!['unlock','approve','switch'].includes(mode))throw Error('Geçersiz doğrulama.');
 return true;
}
