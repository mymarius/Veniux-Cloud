import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBackupDownload} from './backupDownload.js';
const id='isolated-id', headers={'content-type':'application/octet-stream','content-disposition':`attachment; filename="veniux-${id}.vnxbackup"`};
const blob=new Blob(['VNXBACKUP1\n',Uint8Array.from([0x1f,0x8b,0,0,0,0,0,0,0,0])]);
test('backup download preserves expected filename and binary blob',async()=>{const result=await validateBackupDownload({headers,data:blob},id);assert.equal(result.blob,blob);assert.equal(result.filename,'veniux-isolated-id.vnxbackup');});
test('MySQL backup header is accepted and malformed MySQL payload is rejected',async()=>{const mysqlBlob=new Blob(['VNXMYSQL1\n',Uint8Array.from([0x1f,0x8b,0,0,0,0,0,0,0,0])]);assert.equal((await validateBackupDownload({headers,data:mysqlBlob},id)).blob,mysqlBlob);await assert.rejects(validateBackupDownload({headers,data:new Blob(['VNXMYSQL1\ninvalid payload'])},id),/Yedek dosyası doğrulanamadı/);});
test('backup download rejects empty, wrong MIME/name, JSON or truncated success bodies',async()=>{for(const response of [{headers,data:new Blob([])},{headers:{...headers,'content-type':'application/json'},data:blob},{headers:{...headers,'content-disposition':'attachment; filename="other.vnxbackup"'},data:blob},{headers,data:new Blob(['{"success":true,"invalid":true}'])},{headers,data:new Blob(['VNXBACKUP1\n'])}])await assert.rejects(validateBackupDownload(response,id),/Yedek dosyası doğrulanamadı/);});
