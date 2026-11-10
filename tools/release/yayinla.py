#!/usr/bin/env python
"""Tek adımda yeni sürüm: notu sorar, sürümü artırır, test eder, derler, yükler ve canlıda doğrular.

Çift tıkla: proje kökündeki Veniux-Yayinla.cmd
Deneme:    python tools/release/yayinla.py --deneme   (hiçbir şeyi değiştirmez, ön koşulları denetler)

Testlerden biri geçmezse hiçbir şey yüklenmez. Kanal dosyaları en son değişir, yarıda kalan yayın cihazlara gitmez.
"""
import argparse, datetime, hashlib, importlib.util, json, pathlib, re, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'tools/release'
RELEASE = ROOT / 'frontend/src/data/programRelease.json'
FEED = 'https://api.veniux.com/updates/files/'
MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
NPM = 'npm.cmd' if sys.platform == 'win32' else 'npm'


def step(text): print(f'\n=== {text}', flush=True)


LOG = ROOT / '.local/son-yayin.log'
VERSION_FILES = ['frontend/src/data/programRelease.json', 'desktop/package.json', 'desktop/package-lock.json', 'backend/src/config/release.json', 'mobile/android/AndroidManifest.xml', 'mobile/android/src/com/veniux/companion/MainActivity.java']


def run(command, cwd=ROOT, shell=False):
    # Test ve derleme çıktısı ekrana değil dosyaya gider; hata olursa yalnız son satırlar gösterilir.
    with LOG.open('a', encoding='utf-8', errors='replace') as log:
        result = subprocess.run(command, cwd=cwd, shell=shell, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        tail = LOG.read_text(encoding='utf-8', errors='replace').splitlines()[-25:]
        print('\n'.join(tail))
        raise RuntimeError(f'{command if shell else " ".join(map(str, command))} başarısız oldu. Ayrıntı: {LOG}')


def undo_version():
    subprocess.run(['git', 'checkout', '--', *VERSION_FILES], cwd=ROOT)


def load_publisher():
    spec = importlib.util.spec_from_file_location('publish_release', TOOLS / 'publish-release.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def next_version(version):
    major, minor, patch = version.split('.')
    return f'{major}.{minor}.{int(patch) + 1}'


def ask_notes():
    title = input('Bu sürümün başlığı: ').strip()
    if not title: raise SystemExit('Başlık gerekli.')
    print('Değişiklikleri satır satır yazın. Bitince boş satırda Enter:')
    items = []
    while True:
        line = input('  - ').strip()
        if not line: break
        items.append(line)
    if not items: raise SystemExit('En az bir değişiklik gerekli.')
    return title, items


def bump(title, items):
    raw = RELEASE.read_bytes().decode('utf-8')
    data = json.loads(raw)
    version = next_version(data['version'])
    today = datetime.date.today()
    data['version'] = version
    data['releases'].insert(0, {'version': version, 'date': f'{today.day} {MONTHS[today.month - 1]} {today.year}', 'title': title, 'items': items})
    text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    RELEASE.write_bytes((text.replace('\n', '\r\n') if '\r\n' in raw else text).encode('utf-8'))
    return version


def tests():
    step('Testler çalışıyor, yaklaşık 3-5 dakika sürer. Pencereyi kapatmayın.')
    run(f'{NPM} test', cwd=ROOT / 'backend', shell=True)
    run('node --test tests/*.test.js src/lib/*.test.mjs ../shared/countScan.test.mjs', cwd=ROOT / 'frontend', shell=True)
    run(['node', 'desktop/update-check.cjs'])


def build():
    step('Derleniyor, yaklaşık 3-5 dakika sürer.')
    run(f'{NPM} run build', cwd=ROOT / 'frontend', shell=True)
    run(['node', str(TOOLS / 'build-windows.cjs')])
    run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(TOOLS / 'build-android.ps1')])


def verify(version, packages):
    step('Canlı doğrulama')
    for package in packages:
        with urllib.request.urlopen(FEED + package['manifest_name'], timeout=30) as response:
            live = json.load(response)
        if live.get('version') != version: raise SystemExit(f"UYARI: {package['manifest_name']} kanalda {live.get('version')} görünüyor.")
        name = package['manifest']['filename']
        with urllib.request.urlopen(FEED + name, timeout=300) as response:
            data = response.read()
        if hashlib.sha256(data).digest() != hashlib.sha256(package['main']).digest(): raise SystemExit('UYARI: Kanaldaki dosya paketle aynı değil: ' + name)
        print('  tamam:', name, flush=True)


def backend_changed():
    # Son yayından beri sunucu kodu değiştiyse kullanıcıya söylenir; bu araç sunucuyu güncellemez.
    tags = subprocess.run(['git', 'log', '-2', '--format=%H', '--', 'frontend/src/data/programRelease.json'], cwd=ROOT, capture_output=True, text=True).stdout.split()
    if len(tags) < 2: return False
    changed = subprocess.run(['git', 'diff', '--name-only', tags[1], 'HEAD', '--', 'backend/src'], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return [name for name in changed if not name.endswith('config/release.json')]


# Masaüstü yalnız yeni tablo ekleyen şema adımlarını kendisi uygular (local-server upgradeSchema). Yeni şema,
# eski bir kurulumu yeni sürümle açarak denenmeden buraya yazılmamalı.
SHIPPABLE_MYSQL_SCHEMA = '015-offline-sales'


def schema_guard():
    latest = sorted(path.stem for path in (ROOT / 'backend/src/database/mysql').glob('*.json'))[-1]
    if latest != SHIPPABLE_MYSQL_SCHEMA:
        raise SystemExit(f'DURDU: Yeni veritabanı şeması ({latest}) kurulu masaüstü programlarını açılmaz hale getirebilir. Önce yükseltme yolu tamamlanmalı; hiçbir şey değiştirilmedi.')


def pending_upload(publisher, version):
    try:
        with urllib.request.urlopen(FEED + 'windows.json', timeout=30) as response: live = json.load(response)['version']
        publisher.windows_package(version); publisher.android_package(version)
    except (SystemExit, OSError, ValueError, KeyError):
        return False
    return publisher.version_key(version) > publisher.version_key(live)


def upload_and_verify(publisher, version):
    step('Yükleme (Windows dosyası büyük, birkaç dakika sürebilir)')
    _, releases = publisher.load_release(version)
    packages = [publisher.windows_package(version), publisher.android_package(version)]
    target = publisher.Ftps()
    try: publisher.publish(target, version, releases, packages)
    finally: target.close()
    verify(version, packages)
    subprocess.run(['git', 'push', 'origin', 'HEAD'], cwd=ROOT)
    print(f'\nTAMAM: {version} yayında. Program ve uygulama kendiliğinden güncellenecek.')


def check_only(publisher):
    missing = [str(path) for path in [TOOLS / 'build-windows.cjs', TOOLS / 'build-android.ps1', ROOT / '.local/android-signing/signing.json', ROOT / '.local/android-signing/veniux-release.jks'] if not path.exists()]
    print('Eksik dosya:' if missing else 'Derleme dosyaları tamam.', *missing)
    current = json.loads(RELEASE.read_text(encoding='utf-8'))['version']
    print('Şu anki sürüm:', current, '-> sonraki:', next_version(current))
    print('Kayıtlı parola:', 'var' if publisher.saved_password() else 'yok (ilk yayında sorulur)')
    print('Temiz çalışma alanı:', 'evet' if not subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True).stdout.strip() else 'hayır')
    return 1 if missing else 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--deneme', action='store_true')
    args = parser.parse_args()
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stdin, 'reconfigure'): sys.stdin.reconfigure(encoding='utf-8')
    publisher = load_publisher()
    if args.deneme: return check_only(publisher)
    if subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True).stdout.strip():
        raise SystemExit('Kaydedilmemiş değişiklikler var. Önce commit edin; yayın bilinmeyen kodu içermemeli.')
    schema_guard()
    print('Sunucu bağlantısı kontrol ediliyor...', flush=True)
    publisher.Ftps().close()
    print('Bağlantı tamam.')
    # Önceki deneme derleyip yükleyemeden kaldıysa baştan başlamaz, hazır paketi yükler.
    current = json.loads(RELEASE.read_text(encoding='utf-8'))['version']
    if pending_upload(publisher, current):
        print(f'{current} daha önce derlenmiş ama yüklenmemiş; kaldığı yerden devam ediliyor.')
        upload_and_verify(publisher, current)
        return 0
    title, items = ask_notes()
    version = bump(title, items)
    print('Yeni sürüm:', version)
    LOG.write_text('', encoding='utf-8')
    try:
        run(['node', 'tools/release/sync-versions.cjs'])
        run(f'{NPM} version {version} --no-git-tag-version --allow-same-version', cwd=ROOT / 'desktop', shell=True)
        tests()
    except (RuntimeError, KeyboardInterrupt) as error:
        undo_version()
        raise SystemExit(f'\nDURDU, hiçbir şey yayınlanmadı ve sürüm geri alındı. {error}')
    run(['git', 'add', '-A', 'frontend', 'backend', 'desktop', 'mobile'])
    run(['git', 'commit', '-m', f'Surum {version}: {title}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'])
    try: build()
    except (RuntimeError, KeyboardInterrupt) as error: raise SystemExit(f'\nDURDU, hiçbir şey yayınlanmadı. Sürüm {version} commit edildi; düzeltip yeniden derlemek gerekir. {error}')
    upload_and_verify(publisher, version)
    changed = backend_changed()
    if changed:
        print('\nDİKKAT: Sunucu kodu da değişti, bu araç sunucuyu güncellemez. Claude\'a "sunucuyu güncelle" deyin:')
        for name in changed[:10]: print('  ', name)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
