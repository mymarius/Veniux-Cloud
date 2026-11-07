#!/usr/bin/env python
"""Derlenmiş sürümü tek komutla yayınlar: dosyalar, güncelleme kanalı, sürüm notları ve arşiv.

Kullanım:
  python tools/release/publish-release.py             Parola sorar ve programRelease.json sürümünü yayınlar
  python tools/release/publish-release.py --dry-run   Yapılacakları denetleyip listeler, sunucuya yazmaz
  python tools/release/publish-release.py --local KLASÖR  Sunucu yerine klasöre yayınlar (deneme için)
Parola komut satırına veya dosyaya yazılmaz. Site sürümü ve notları yeni dosyalardan kendisi okur.

Sıra önemlidir: paketler geçici adla yüklenip doğrulanır, kanal dosyaları en son değişir. Bu yüzden
yükleme yarıda kalırsa cihazlar eski sürümde kalır. Yayınlanmış bir sürüm üzerine yazılmaz, eski sürüme dönülmez.
"""
import argparse, base64, datetime, ftplib, getpass, hashlib, io, json, os, pathlib, re, ssl, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HOST, USER, REMOTE = 'plesk.hostimux.tr', 'veniu8e1', 'license-private'
UNSIGNED = 'Geçici imzasız Windows yayını; SmartScreen uyarısı çıkabilir.'
FIRST_NOTES = 24


PASSWORD_DROP = ROOT / '.local' / 'ftp-parola.txt'
PASSWORD_FILE = pathlib.Path(os.environ.get('LOCALAPPDATA', str(ROOT))) / 'Veniux' / 'ftp-password.dpapi'


def _powershell(script, text=None):
    return subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], input=text, capture_output=True, text=True, encoding='utf-8')


def saved_password():
    """Windows DPAPI ile şifreli parolayı okur; bu kullanıcı ve bu bilgisayar dışında çözülemez."""
    if PASSWORD_DROP.is_file():
        # Parola bu dosyaya bir kez yazılır: şifrelenip saklanır, düz metin dosya hemen silinir.
        typed = PASSWORD_DROP.read_text(encoding='utf-8-sig').strip()
        if typed and save_password(typed): PASSWORD_DROP.unlink()
    if not PASSWORD_FILE.is_file(): return None
    script = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;Add-Type -AssemblyName System.Security;$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim());[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))"
    result = _powershell(script, PASSWORD_FILE.read_text(encoding='ascii'))
    return result.stdout.rstrip('\r\n') if result.returncode == 0 and result.stdout.strip() else None


def save_password(password):
    script = "[Console]::InputEncoding=[Text.Encoding]::UTF8;Add-Type -AssemblyName System.Security;$p=[Console]::In.ReadToEnd();[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($p),$null,'CurrentUser'))"
    result = _powershell(script, password)
    if result.returncode: return False
    PASSWORD_FILE.parent.mkdir(parents=True, exist_ok=True)
    PASSWORD_FILE.write_text(result.stdout.strip(), encoding='ascii')
    return True


def forget_password(): PASSWORD_FILE.unlink(missing_ok=True)


def version_key(value): return tuple(int(x) for x in value.split('.'))


def load_release(version=None):
    data = json.loads((ROOT / 'frontend/src/data/programRelease.json').read_text(encoding='utf-8'))
    version = version or data['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version): raise SystemExit('Geçersiz sürüm: ' + version)
    if not any(r['version'] == version for r in data['releases']): raise SystemExit('Bu sürümün notu yok: ' + version)
    return version, data['releases']


def windows_package(version):
    folder = ROOT / f'.local/desktop-installer-{version}'
    exe = folder / f'Veniux-Setup-{version}.exe'
    yml = folder / 'latest.yml'
    if not exe.is_file() or not yml.is_file(): raise SystemExit('Windows paketi yok: ' + str(folder))
    data = exe.read_bytes()
    sha512 = base64.b64encode(hashlib.sha512(data).digest()).decode()
    text = yml.read_text(encoding='utf-8')
    if f'version: {version}' not in text or sha512 not in text: raise SystemExit('latest.yml paketle uyuşmuyor')
    manifest = {'version': version, 'filename': exe.name, 'bytes': len(data), 'sha512': sha512, 'signing_status': 'unsigned', 'notice': UNSIGNED}
    latest = text.rstrip('\n') + '\n\nreleaseNotes: "Temporary unsigned Windows release. SmartScreen warning may appear."\n'
    return {'platform': 'windows', 'manifest_name': 'windows.json', 'manifest': manifest, 'files': [exe, folder / (exe.name + '.blockmap')], 'extra': {'latest.yml': latest.encode()}, 'main': data}


def android_package(version):
    folder = ROOT / f'.local/android-build-{version}'
    apk = folder / f'Veniux-Android-{version}.apk'
    meta = folder / 'android.json'
    if not apk.is_file() or not meta.is_file(): raise SystemExit('Android paketi yok: ' + str(folder))
    data = apk.read_bytes()
    manifest = json.loads(meta.read_text(encoding='utf-8-sig'))
    if manifest.get('version') != version or manifest.get('sha256') != hashlib.sha256(data).hexdigest() or manifest.get('bytes') != len(data):
        raise SystemExit('android.json paketle uyuşmuyor')
    return {'platform': 'android', 'manifest_name': 'android.json', 'manifest': manifest, 'files': [apk], 'extra': {}, 'main': data}


class Folder:
    def __init__(self, base): self.base = pathlib.Path(base); (self.base / 'updates').mkdir(parents=True, exist_ok=True)
    def get(self, name):
        path = self.base / name
        return path.read_bytes() if path.is_file() else None
    def put(self, name, data): (self.base / name).write_bytes(data)
    def move(self, old, new): (self.base / old).replace(self.base / new)
    def delete(self, name): (self.base / name).unlink(missing_ok=True)
    def close(self): pass


class Ftps:
    def __init__(self):
        self.ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=180)
        self.ftp.connect(HOST)
        saved = saved_password()
        password = saved or getpass.getpass('Hosting (FTP) parolası: ')
        try: self.ftp.login(USER, password)
        except ftplib.error_perm:
            forget_password()
            raise SystemExit('FTP parolası reddedildi; dosyalara dokunulmadı. Plesk > Web Hosting Access ekranından parolayı kontrol edip yeniden deneyin.')
        if not saved: save_password(password)
        self.ftp.prot_p()
    def get(self, name):
        out = io.BytesIO()
        try: self.ftp.retrbinary(f'RETR {REMOTE}/{name}', out.write, blocksize=262144)
        except ftplib.error_perm as error:
            if str(error).startswith('550'): return None
            raise
        return out.getvalue()
    def put(self, name, data): self.ftp.storbinary(f'STOR {REMOTE}/{name}', io.BytesIO(data), blocksize=262144)
    def move(self, old, new):
        try: self.ftp.delete(f'{REMOTE}/{new}')
        except ftplib.error_perm: pass
        self.ftp.rename(f'{REMOTE}/{old}', f'{REMOTE}/{new}')
    def delete(self, name):
        try: self.ftp.delete(f'{REMOTE}/{name}')
        except ftplib.error_perm: pass
    def close(self): self.ftp.quit()


def upload_immutable(target, path):
    name, data = 'updates/' + path.name, path.read_bytes()
    existing = target.get(name)
    if existing is not None:
        if existing != data: raise SystemExit('Yayınlanmış dosya farklı, üzerine yazılmadı: ' + path.name)
        print('  zaten var, doğrulandı:', path.name, flush=True)
        return
    target.put(name + '.next', data)
    if target.get(name + '.next') != data:
        target.delete(name + '.next')
        raise SystemExit('Yükleme doğrulanamadı: ' + path.name)
    target.move(name + '.next', name)
    print('  yüklendi, doğrulandı:', path.name, flush=True)


def replace_small(target, name, data):
    target.put(name + '.next', data)
    if target.get(name + '.next') != data: raise SystemExit('Yükleme doğrulanamadı: ' + name)
    target.move(name + '.next', name)


def notes_document(releases, published):
    newest = max(version_key(v) for v in published.values())
    selected = []
    for release in releases:
        key = version_key(release['version'])
        if key[-1] < FIRST_NOTES or key > newest: continue
        platforms = [p for p, v in published.items() if v == release['version']] or ['android']
        selected.append({'version': release['version'], 'date': release.get('date', ''), 'title': release['title'], 'items': release['items'], 'platforms': platforms,
                         'notice': f"İndirme kanalı: Windows {published['windows']}, Android {published['android']}. Fiziksel cihaz uyumluluğu ayrıca doğrulanmalıdır."})
    return {'schema': 1, 'published_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'downloads': published, 'releases': selected}


def archive_document(raw, packages, version):
    data = json.loads(raw) if raw else {'schema': 1, 'releases': []}
    for package in packages:
        for row in data['releases']:
            if row.get('platform') == package['platform'] and row.get('version') != version: row['historical'] = True
        data['releases'] = [r for r in data['releases'] if not (r.get('platform') == package['platform'] and r.get('version') == version)]
        row = {'platform': package['platform'], 'version': version, 'filename': package['manifest']['filename'], 'bytes': len(package['main']), 'sha256': hashlib.sha256(package['main']).hexdigest()}
        if package['platform'] == 'windows': row['notice'] = UNSIGNED
        data['releases'].append(row)
    return data


def publish(target, version, releases, packages, dry_run=False):
    published = {}
    backup = {}
    for package in packages:
        raw = target.get('updates/' + package['manifest_name'])
        current = json.loads(raw)['version'] if raw else '0.0.0'
        if version_key(current) > version_key(version): raise SystemExit(f"{package['platform']}: {current} yayında, eski sürüme dönülmez")
        print(f"{package['platform']}: {current} -> {version}", flush=True)
        backup[package['manifest_name']] = raw
    for platform in ('windows', 'android'):
        raw = target.get(f'updates/{platform}.json')
        published[platform] = json.loads(raw)['version'] if raw else '0.0.0'
    for package in packages: published[package['platform']] = version
    if dry_run:
        print('Deneme: sunucuya yazılmadı. Paketler ve özetleri doğru.')
        return published
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = ROOT / '.local' / f'release-publish-backup-{version}-{stamp}'
    folder.mkdir(parents=True)
    for name, raw in backup.items():
        if raw: (folder / name).write_bytes(raw)
    old_archive = target.get('release-archive.json')
    if old_archive: (folder / 'release-archive.json').write_bytes(old_archive)
    for package in packages:
        for path in package['files']: upload_immutable(target, path)
    # Kanal en son değişir; site notları ve arşiv önce hazır olur ki sürüm notsuz görünmesin.
    replace_small(target, 'release-archive.json', json.dumps(archive_document(old_archive, packages, version), ensure_ascii=False, indent=1).encode())
    replace_small(target, 'updates/release-notes.json', json.dumps(notes_document(releases, published), ensure_ascii=False).encode())
    for package in packages:
        for name, data in package['extra'].items(): replace_small(target, 'updates/' + name, data)
        replace_small(target, 'updates/' + package['manifest_name'], json.dumps(package['manifest'], ensure_ascii=False).encode())
    print('Yayın tamamlandı:', published, '| önceki kanal yedeği:', folder)
    return published


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version')
    parser.add_argument('--platform', choices=['windows', 'android', 'both'], default='both')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--local')
    args = parser.parse_args()
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    version, releases = load_release(args.version)
    packages = []
    if args.platform in ('windows', 'both'): packages.append(windows_package(version))
    if args.platform in ('android', 'both'): packages.append(android_package(version))
    target = Folder(args.local) if args.local else Ftps()
    try: publish(target, version, releases, packages, args.dry_run)
    finally: target.close()


if __name__ == '__main__':
    main()
