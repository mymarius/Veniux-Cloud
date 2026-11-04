// Prefer sentence boundaries so a new synthesis request does not restart the
// speaker halfway through a sentence. Hard-limit pathological long tokens.
export function speechChunks(value,max=1800){
  const chunks=[];let remaining=String(value??'').trim();
  while(remaining.length>max){
    const prefix=remaining.slice(0,max+1);
    const endings=[...prefix.matchAll(/[.!?…](?:[”"']?)(?=\s)/g)];
    const sentence=endings.at(-1);
    let end=sentence&&sentence.index>=max/3?sentence.index+sentence[0].length:remaining.lastIndexOf(' ',max);
    if(end<1)end=max;
    chunks.push(remaining.slice(0,end).trim());remaining=remaining.slice(end).trim();
  }
  if(remaining)chunks.push(remaining);
  return chunks;
}
