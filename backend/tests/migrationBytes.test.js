// Uygulanmış göçlerin sağlama toplamı dosya baytlarından hesaplanır; satır sonu değişirse uygulama açılmaz.
// Eski göçlerin satır sonları karışıktır, bu yüzden git bu klasörde hiçbir çevirme yapmamalıdır.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/database/migrations');

test('.gitattributes turns off line ending conversion for migrations', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../../.gitattributes'), 'utf8');
  expect(rules).toMatch(/^backend\/src\/database\/migrations\/\* -text\r?$/m);
});

// Eski göçlerin baytları kayıtlı sağlama toplamlarıyla aynı kalmalı; bu kural yalnız bu turda eklenenler içindir.
test.each(fs.readdirSync(dir).filter(name => name.endsWith('.js') && name >= '032'))('%s is stored with LF', name => {
  expect(fs.readFileSync(path.join(dir, name), 'utf8')).not.toContain('\r');
});
