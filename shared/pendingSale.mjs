// Persist only the operation, never authentication credentials. Each terminal tab owns its recovery record.
export function readPendingSale(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
export function savePendingSale(storage,key,operation){storage.setItem(key,JSON.stringify(operation));}
export function clearPendingSale(storage,key){storage.removeItem(key);}
