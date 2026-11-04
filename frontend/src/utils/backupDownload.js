export async function validateBackupDownload(response, id) {
  const headers = response.headers || {};
  const header = key => headers.get?.(key) ?? headers[key.toLowerCase()];
  const filename = `veniux-${id}.vnxbackup`;
  const fail = () => { throw new Error('Yedek dosyası doğrulanamadı. Geçmişi yenileyip tekrar indirin.'); };
  if (String(header('Content-Type') || '').split(';')[0] !== 'application/octet-stream' ||
      !String(header('Content-Disposition') || '').includes(`filename="${filename}"`) ||
      !(response.data instanceof Blob) || response.data.size < 20) fail();
  const prefix = new Uint8Array(await response.data.slice(0, 13).arrayBuffer());
  // Complete archive/schema/hash validation remains on the existing server path.
  const text=new TextDecoder().decode(prefix),magic=['VNXBACKUP1\n','VNXMYSQL1\n'].find(value=>text.startsWith(value));
  if (!magic || prefix[magic.length] !== 0x1f || prefix[magic.length+1] !== 0x8b) fail();
  return { blob: response.data, filename };
}
