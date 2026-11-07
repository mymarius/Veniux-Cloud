#!/usr/bin/env python
"""PHP siteyi yayınlar: sürümleri eşitler, değişen dosyaları yedekler, doğrulayıp değiştirir, hatada geri alır.

Kullanım:
  python tools/release/publish-site.py            Parola sorar ve yayınlar
  python tools/release/publish-site.py --dry-run  Değişecek dosyaları listeler, hiçbir şey yazmaz
  python tools/release/publish-site.py --local KLASÖR  Sunucu yerine klasöre yayınlar (deneme için)
Parola komut satırına veya dosyaya yazılmaz; yalnız bu çalıştırmada kullanılır.
"""
import argparse, datetime, ftplib, getpass, hashlib, importlib.util, io, json, pathlib, re, shutil, ssl, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
WEB = ROOT / 'website-php'
HOST, USER, REMOTE = 'plesk.hostimux.tr', 'veniu8e1', 'httpdocs'
SKIP_NAMES = {'router.php', 'check-mail.php', 'README.md', 'SEO-ALTYAPISI.md', 'design-tokens.json'}
SKIP_DIRS = {'bin', 'preview'}
HASHED = re.compile(r'^assets/[a-z]+\.[0-9a-f]{12}\.(css|js)$')


def site_files():
    listed = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard', 'website-php'], cwd=ROOT, check=True, capture_output=True, text=True).stdout.split('\n')
    manifest = set(re.findall(r'=>"([^"]+)"', (WEB / 'asset-manifest.php').read_text(encoding='utf-8')))
    files = []
    for line in filter(None, listed):
        name = pathlib.PurePosixPath(line).relative_to('website-php').as_posix()
        if not (WEB / name).is_file() or name.split('/')[0] in SKIP_DIRS or name in SKIP_NAMES:
            continue
        if HASHED.match(name) and name.split('/')[-1] not in manifest:
            continue
        files.append(name)
    return files


def hosting_password():
    # Sürüm yayınıyla aynı şifreli kayıt kullanılır; kayıt yoksa sorulur.
    spec = importlib.util.spec_from_file_location('publish_release', pathlib.Path(__file__).with_name('publish-release.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.saved_password() or getpass.getpass('Hosting parolası: ')


class Folder:
    def __init__(self, base): self.base = pathlib.Path(base)
    def get(self, name):
        path = self.base / name
        return path.read_bytes() if path.is_file() else None
    def put(self, name, data):
        path = self.base / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
    def move(self, old, new): (self.base / old).replace(self.base / new)
    def delete(self, name): (self.base / name).unlink(missing_ok=True)
    def close(self): pass


class Ftps:
    def __init__(self):
        self.ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=90)
        self.ftp.connect(HOST)
        self.ftp.login(USER, hosting_password())
        self.ftp.prot_p()
        self.dirs = set()
    def get(self, name):
        out = io.BytesIO()
        try: self.ftp.retrbinary(f'RETR {REMOTE}/{name}', out.write)
        except ftplib.error_perm as error:
            if str(error).startswith('550'): return None
            raise
        return out.getvalue()
    def put(self, name, data):
        parts = name.split('/')[:-1]
        for i in range(1, len(parts) + 1):
            folder = '/'.join(parts[:i])
            if folder not in self.dirs:
                try: self.ftp.mkd(f'{REMOTE}/{folder}')
                except ftplib.error_perm: pass
                self.dirs.add(folder)
        self.ftp.storbinary(f'STOR {REMOTE}/{name}', io.BytesIO(data))
    def move(self, old, new):
        try: self.ftp.delete(f'{REMOTE}/{new}')
        except ftplib.error_perm: pass
        self.ftp.rename(f'{REMOTE}/{old}', f'{REMOTE}/{new}')
    def delete(self, name):
        try: self.ftp.delete(f'{REMOTE}/{name}')
        except ftplib.error_perm: pass
    def close(self): self.ftp.quit()


def publish(target, dry_run=False, fail_after=None):
    changes = []
    for name in site_files():
        old, new = target.get(name), (WEB / name).read_bytes()
        if old != new: changes.append((name, old, new))
    print(f'Değişen dosya: {len(changes)}', flush=True)
    for name, old, _ in changes: print(('  güncellenecek ' if old is not None else '  yeni ') + name)
    if dry_run or not changes: return changes
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = ROOT / '.local' / f'site-publish-backup-{stamp}'
    for name, old, _ in changes:
        if old is not None:
            path = backup / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(old)
    backup.mkdir(parents=True, exist_ok=True)
    (backup / 'manifest.json').write_text(json.dumps([{'path': n, 'existed': o is not None} for n, o, _ in changes], indent=1), encoding='utf-8')
    print('Yedek:', backup, flush=True)
    # Canlı dosyaya dokunmadan önce hepsi geçici adla yüklenip doğrulanır.
    for name, _, new in changes:
        target.put(name + '.next', new)
        if hashlib.sha256(target.get(name + '.next') or b'').digest() != hashlib.sha256(new).digest():
            for item, _, _ in changes: target.delete(item + '.next')
            raise RuntimeError('Yükleme doğrulanamadı: ' + name)
    applied = []
    try:
        for name, old, new in changes:
            if fail_after is not None and len(applied) == fail_after: raise RuntimeError('Deneme hatası')
            target.move(name + '.next', name); applied.append((name, old))
    except Exception:
        for name, old in reversed(applied):
            target.put(name, old) if old is not None else target.delete(name)
        for name, _, _ in changes: target.delete(name + '.next')
        print('Hata oluştu; değişen dosyalar geri alındı.', file=sys.stderr)
        raise
    print('Yayın tamamlandı.')
    return changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--local')
    parser.add_argument('--no-sync', action='store_true')
    parser.add_argument('--fail-after', type=int, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not args.no_sync:
        subprocess.run(['node', str(WEB / 'bin/sync-release-notes.cjs')], check=True, cwd=ROOT)
    target = Folder(args.local) if args.local else Ftps()
    try: publish(target, args.dry_run, args.fail_after)
    finally: target.close()


if __name__ == '__main__':
    main()
