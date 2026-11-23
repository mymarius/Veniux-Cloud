'use strict';
// PHP şablonlarında (>metin<) düğümlerinden, lib/i18n/az.php sözlüğünde anahtarı olan metinleri <?=vxT('metin')?> ile sarar.
// Önce anahtarları dışa aktarın:  php -r "echo json_encode(array_keys(require 'website-php/lib/i18n/az.php'),JSON_UNESCAPED_UNICODE);" > anahtarlar.json
// Kullanım: node tools/i18n/wrap-php.cjs anahtarlar.json <dosya...>
const fs = require('fs');
const [keysFile, ...files] = process.argv.slice(2);
const keys = new Set(JSON.parse(fs.readFileSync(keysFile, 'utf8')));
const TEXT = />([^<>\n]*[A-Za-zÇĞİÖŞÜçğıöşü][^<>\n]*)</g;
for (const file of files) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n'); t = t.replace(/\r\n/g, '\n');
  let n = 0;
  t = t.replace(TEXT, (all, text) => {
    if (/<\?|\?>/.test(text)) return all;
    const s = text.trim();
    if (!keys.has(s)) return all;
    n++;
    const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
    return '>' + lead + "<?=vxT('" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "')?>" + tail + '<';
  });
  if (n) fs.writeFileSync(file, t.split('\n').join(crlf ? '\r\n' : '\n'));
  console.log(file, n, 'metin sarıldı');
}
