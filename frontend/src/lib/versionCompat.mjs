// Sürüm karşılaştırması ve istemci-sunucu uyumu. Bilinmeyen sürümlerde uyarı üretmez.
export function compareVersions(a,b){
  const parse=value=>{const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(value??''));return match?match.slice(1).map(Number):null;};
  const left=parse(a),right=parse(b);
  if(!left||!right)return null;
  for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]<right[i]?-1:1;
  return 0;
}

export function evaluateCompatibility({clientVersion,minServer,server}){
  if(!server)return null;
  if(compareVersions(clientVersion,server.minClient)===-1)return {kind:'client-outdated',message:`Bu program sürümü (${clientVersion}) sunucuyla uyumlu değil. Lütfen ${server.minClient} veya üzerine güncelleyin.`};
  if(compareVersions(server.version,minServer)===-1)return {kind:'server-outdated',message:`Sunucu sürümü (${server.version}) bu programla uyumlu değil. Sunucunun ${minServer} veya üzerine güncellenmesi gerekiyor.`};
  return null;
}
