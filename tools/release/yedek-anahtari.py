#!/usr/bin/env python
"""Sunucu dışı yedek anahtarını sunucuya güvenle yazar.

Çift tıkla: proje kökündeki Veniux-Yedek-Anahtari.cmd
Anahtar ekrana yazdırılmaz, dosyaya veya git'e kaydedilmez. Önce Backblaze'e deneme dosyası yüklenip anahtar sınanır;
çalışmazsa sunucuya hiçbir şey yazılmaz. Sunucudaki integrations.env önce yedeklenir, sonra yalnız OFFSITE_ satırları değişir.
"""
import datetime, getpass, importlib.util, json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENV_PATH = 'veniux-business/data/integrations.env'
FIXED = {'OFFSITE_S3_ENDPOINT': 'https://s3.us-east-005.backblazeb2.com', 'OFFSITE_S3_REGION': 'us-east-005', 'OFFSITE_S3_BUCKET': 'veniux-yedek'}


def publisher():
    spec = importlib.util.spec_from_file_location('publish_release', ROOT / 'tools/release/publish-release.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_key(values):
    # Arka uçtaki gerçek yükleme koduyla küçük bir deneme dosyası yüklenir ve boyutu doğrulanır, sonra silinir.
    script = ("const o=require('./backend/src/services/offsiteBackup');"
              "(async()=>{const name='baglanti-denemesi-'+Date.now()+'.txt';const r=await o.upload(name,Buffer.from('veniux'));"
              "if(r.status==='ok')await o.remove(name);console.log(JSON.stringify(r));})();")
    env = {**__import__('os').environ, **values}
    out = subprocess.run(['node', '-e', script], cwd=ROOT, env=env, capture_output=True, text=True, timeout=180)
    try: return json.loads(out.stdout.strip().splitlines()[-1])
    except Exception: return {'status': 'failed'}


def clipboard():
    out = subprocess.run(['powershell', '-NoProfile', '-Command', 'Get-Clipboard -Raw'], capture_output=True, text=True, encoding='utf-8', timeout=30)
    return (out.stdout or '').strip()


# Değer panodan alınır; ekrana yalnız ilk 4 karakteri ve uzunluğu yazılır. Elle yapıştırılan değer de kabul edilir.
def from_clipboard(label):
    while True:
        typed = input(f"Backblaze'de {label} değerini kopyalayın (kopyala simgesi veya seçip Ctrl+C), sonra burada Enter'a basın: ").strip()
        value = typed or clipboard()
        if value:
            print(f'  alındı: {value[:4]}… ({len(value)} karakter)')
            return value
        print("  Pano boş görünüyor. Değeri kopyalayıp yeniden Enter'a basın.")


def merge(text, values):
    lines = [line for line in text.replace('\r\n', '\n').split('\n') if not re.match(r'^\s*OFFSITE_S3_[A-Z_]+=', line)]
    while lines and not lines[-1].strip(): lines.pop()
    return '\n'.join(lines + [f'{k}={v}' for k, v in values.items()]) + '\n'


def main():
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    print('Backblaze anahtar penceresini açık tutun. Hiçbir şey yazmanız gerekmez.\n')
    key_id = from_clipboard('keyID')
    secret = from_clipboard('applicationKey')
    if not re.fullmatch(r'[A-Za-z0-9]{10,40}', key_id) or not re.fullmatch(r'[A-Za-z0-9/+]{20,60}', secret):
        raise SystemExit('Anahtar biçimi beklenen gibi değil. keyID ve applicationKey değerlerini kontrol edip yeniden deneyin.')
    values = {**FIXED, 'OFFSITE_S3_KEY_ID': key_id, 'OFFSITE_S3_SECRET': secret}

    print('Anahtar Backblaze üzerinde deneniyor...', flush=True)
    result = test_key(values)
    if result.get('status') != 'ok':
        raise SystemExit('Anahtar çalışmadı: deneme dosyası yüklenemedi. Anahtarın veniux-yedek bucket\'ına "Read and Write" yetkisi olduğunu kontrol edin. Sunucuya hiçbir şey yazılmadı.')
    print('Anahtar çalışıyor: deneme dosyası yüklendi, doğrulandı ve silindi.')

    module = publisher()
    target = module.Ftps()
    try:
        import io
        ftp = target.ftp
        current = io.BytesIO()
        try: ftp.retrbinary('RETR ' + ENV_PATH, current.write)
        except Exception as error:
            if not str(error).startswith('550'): raise
        old = current.getvalue().decode('utf-8')
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        if old: ftp.storbinary(f'STOR {ENV_PATH}.before-offsite-{stamp}', io.BytesIO(old.encode('utf-8')))
        new = merge(old, values)
        ftp.storbinary('STOR ' + ENV_PATH, io.BytesIO(new.encode('utf-8')))
        check = io.BytesIO(); ftp.retrbinary('RETR ' + ENV_PATH, check.write)
        if check.getvalue().decode('utf-8') != new: raise SystemExit('UYARI: Sunucudaki dosya beklenenle aynı değil. Önceki hali .before-offsite yedeğinde.')
        kept = [line.split('=', 1)[0] for line in old.splitlines() if '=' in line and not line.startswith('OFFSITE_S3_')]
        print(f'Sunucu ayarı yazıldı ve doğrulandı. Diğer {len(kept)} ayar korundu, önceki hali yedeklendi.')
    finally:
        target.close()
    print('\nTAMAM. Sunucu dışı yedek bir sonraki sürüm sunucuya kurulunca çalışmaya başlayacak.')


if __name__ == '__main__':
    raise SystemExit(main())
