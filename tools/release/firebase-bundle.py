#!/usr/bin/env python
"""Firebase Messaging'i Gradle'suz Android derlemesine hazırlar.

  python tools/release/firebase-bundle.py resolve [sürüm]   Google Maven + Maven Central'dan bağımlılık grafiğini çözer, sağlama toplamını doğrular, .local/firebase/libs altına indirir.
  python tools/release/firebase-bundle.py bundle            İndirilenleri açar: sınıf jar'ları, derlenmiş kaynaklar, manifest parçası, yerel kitaplıklar.
  python tools/release/firebase-bundle.py merge <uygulama-manifesti> <çıktı>   Uygulama manifestine kitaplık bileşenlerini ekler.
  python tools/release/firebase-bundle.py config <google-services.json>   Firebase istemci değerlerini .local/firebase/firebase-config.json'a yazar.

Çıktılar .local/firebase/bundle altındadır (depoya girmez). build-android.ps1 bu klasör ve mobile/android/firebase-config.json varsa Firebase'li derler.
"""
import glob, hashlib, json, os, pathlib, re, shutil, subprocess, sys, urllib.error, urllib.request, zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOCAL = ROOT / '.local/firebase'
LIBS, WORK, BUNDLE = LOCAL / 'libs', LOCAL / 'work', LOCAL / 'bundle'
AAPT2 = ROOT / '.local/android-sdk/build-tools/android-15/aapt2.exe'
REPOS = ['https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2']
POM = {'m': 'http://maven.apache.org/POM/4.0.0'}
ANDROID = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ANDROID)
ET.register_namespace('tools', 'http://schemas.android.com/tools')
SKIP_PROVIDERS = {'com.google.firebase.provider.FirebaseInitProvider'}  # Firebase elle başlatılır (MainActivity)


def get(url, binary=False):
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read()
            return data if binary else data.decode('utf-8', 'replace')
    except urllib.error.HTTPError as error:
        if error.code == 404: return None
        raise


def locate(group, artifact, version, ext):
    path = f"{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.{ext}"
    for repo in REPOS:
        data = get(f'{repo}/{path}', binary=(ext != 'pom'))
        if data is not None: return repo, path, data
    return None, path, None


def tag(node, name):
    el = node.find(f'm:{name}', POM)
    return el.text.strip() if el is not None and el.text else ''


def parse_pom(group, artifact, version):
    repo, path, body = locate(group, artifact, version, 'pom')
    if body is None: raise SystemExit(f'POM yok: {group}:{artifact}:{version}')
    root = ET.fromstring(body)
    props = {}
    properties = root.find('m:properties', POM)
    if properties is not None:
        for child in properties: props[child.tag.split('}')[1]] = (child.text or '').strip()
    deps = []
    section = root.find('m:dependencies', POM)
    if section is not None:
        for dep in section.findall('m:dependency', POM):
            g, a, v, scope, optional = tag(dep, 'groupId'), tag(dep, 'artifactId'), tag(dep, 'version'), tag(dep, 'scope') or 'compile', tag(dep, 'optional')
            if v.startswith('${'): v = props.get(v[2:-1], '')
            if v[:1] in '[(': v = v.strip('[]()').split(',')[0].strip()
            if scope in ('compile', 'runtime') and optional != 'true' and v: deps.append((g, a, v))
    return (tag(root, 'packaging') or 'jar'), deps


def version_key(v): return [int(p) if p.isdigit() else 0 for p in v.replace('-', '.').split('.')]


def resolve(version):
    start = ('com.google.firebase', 'firebase-messaging', version)
    chosen, queue = {}, [start]
    while queue:
        g, a, v = queue.pop(0)
        if (g, a) in chosen and version_key(chosen[(g, a)]) >= version_key(v): continue
        chosen[(g, a)] = v
        queue.extend(parse_pom(g, a, v)[1])
    final = {}
    def walk(g, a):
        if (g, a) in final: return
        final[(g, a)] = chosen[(g, a)]
        for dg, da, _ in parse_pom(g, a, chosen[(g, a)])[1]:
            if (dg, da) in chosen: walk(dg, da)
    walk(start[0], start[1])
    LIBS.mkdir(parents=True, exist_ok=True)
    lock = []
    for (g, a), v in sorted(final.items()):
        packaging, _ = parse_pom(g, a, v)
        ext = 'aar' if packaging == 'aar' else 'jar'
        repo, path, data = locate(g, a, v, ext)
        if data is None: raise SystemExit(f'Dosya yok: {path}')
        verified = None
        for algo in ('sha256', 'sha1'):
            reference = get(f'{repo}/{path}.{algo}')
            if reference:
                expected = reference.strip().split()[0].lower()
                actual = hashlib.new(algo, data).hexdigest()
                if actual != expected: raise SystemExit(f'SAĞLAMA UYUŞMUYOR ({algo}): {path}')
                verified = algo; break
        if not verified: raise SystemExit(f'Sağlama dosyası yok: {path}')
        name = f'{g}_{a}_{v}.{ext}'
        (LIBS / name).write_bytes(data)
        lock.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'verified_with': verified, 'repo': repo.split('//')[1].split('/')[0]})
        print(f'{ext} {g}:{a}:{v}  ({verified}) tamam')
    (LOCAL / 'libs.lock.json').write_text(json.dumps(lock, indent=1), encoding='utf-8')
    print('toplam', len(lock), 'parça')


def bundle():
    for folder in (WORK, BUNDLE):
        if folder.exists(): shutil.rmtree(folder)
    (BUNDLE / 'jars').mkdir(parents=True); (BUNDLE / 'compiled').mkdir(); (BUNDLE / 'jni').mkdir()
    jars, manifests, packages = [], [], []
    for file in sorted(LIBS.glob('*')):
        if file.suffix == '.jar': jars.append((file.stem, file))
        elif file.suffix == '.aar':
            target = WORK / file.stem
            zipfile.ZipFile(file).extractall(target)
            classes = target / 'classes.jar'
            if classes.exists() and zipfile.ZipFile(classes).namelist(): jars.append((file.stem, classes))
            manifests.append(target / 'AndroidManifest.xml')
            rtxt = target / 'R.txt'
            if (target / 'res').is_dir() and any((target / 'res').rglob('*')):
                out = BUNDLE / 'compiled' / (file.stem + '.zip')
                subprocess.run([str(AAPT2), 'compile', '--dir', str(target / 'res'), '-o', str(out)], check=True)
            if rtxt.exists() and rtxt.read_text().strip():
                match = re.search(r'package="([^"]+)"', (target / 'AndroidManifest.xml').read_text(encoding='utf-8', errors='ignore'))
                if match: packages.append(match.group(1))
            if (target / 'jni').is_dir(): shutil.copytree(target / 'jni', BUNDLE / 'jni', dirs_exist_ok=True)
    # çift sınıf: bir jar'ın bütün sınıfları başka jar'da varsa (Kotlin çok platformlu "kabuk" jar'ları) o jar atılır
    owners, listing = {}, {}
    for name, path in jars:
        listing[name] = {n for n in zipfile.ZipFile(path).namelist() if n.endswith('.class')}
    for name in sorted(listing, key=lambda n: -len(listing[n])):
        for cls in listing[name]: owners.setdefault(cls, name)
    kept = []
    for name, path in jars:
        own = [c for c in listing[name] if owners[c] == name]
        if listing[name] and not own: print('atlandı (tamamı başka jar\'da):', name); continue
        if not listing[name]: print('atlandı (sınıf yok):', name); continue
        target = BUNDLE / 'jars' / (name + '.jar')
        if len(own) == len(listing[name]): shutil.copy(path, target)
        else:  # kısmen çift sınıf: çift olanlar çıkarılır (D8 aynı sınıfın iki kez tanımlanmasını kabul etmez)
            with zipfile.ZipFile(path) as source, zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as out:
                for entry in source.infolist():
                    if entry.filename.endswith('.class') and owners.get(entry.filename) != name: continue
                    out.writestr(entry, source.read(entry.filename))
            print('çift sınıflar ayıklandı:', name, len(listing[name]) - len(own))
        kept.append(name)
    (BUNDLE / 'extra-packages.txt').write_text(':'.join(sorted(set(packages))), encoding='utf-8')
    (BUNDLE / 'manifests.json').write_text(json.dumps([str(m) for m in manifests]), encoding='utf-8')
    print('jar:', len(kept), '| kaynak paketi:', len(list((BUNDLE / 'compiled').glob('*.zip'))), '| R paketi:', len(set(packages)), '| yerel kitaplık:', len(list((BUNDLE / 'jni').rglob('*.so'))))


def merge(app_manifest, output, package='com.veniux.companion'):
    tree = ET.parse(app_manifest); root = tree.getroot()
    application = root.find('application')
    def name(el): return el.get(f'{{{ANDROID}}}name')
    have = {(c.tag, name(c)) for c in application if name(c)}
    perms = {name(p) for p in root.findall('uses-permission')}
    discovery = None
    for el in application:
        if el.tag == 'service' and name(el) == 'com.google.firebase.components.ComponentDiscoveryService': discovery = el
    for path in json.loads((BUNDLE / 'manifests.json').read_text(encoding='utf-8')):
        lib = ET.parse(path).getroot()
        for p in lib.findall('uses-permission'):
            if name(p) not in perms: perms.add(name(p)); root.insert(0, p)
        declared = {name(x) for x in root.findall('permission')}
        for decl in lib.findall('permission'):  # ör. androidx.core DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION: kullanılan izin tanımsız kalmasın
            if name(decl) not in declared: declared.add(name(decl)); root.insert(0, decl)
        app = lib.find('application')
        if app is None: continue
        for el in app:
            if el.tag == 'meta-data' and name(el) and name(el).startswith('com.google.android.gms.version'): continue
            n = name(el)
            if el.tag == 'provider' and n in SKIP_PROVIDERS: continue
            if el.tag == 'service' and n == 'com.google.firebase.messaging.FirebaseMessagingService': continue  # uygulamanın kendi alt sınıfı kullanılır
            for attr in list(el.attrib):
                if attr.startswith('{http://schemas.android.com/tools}'): del el.attrib[attr]
            if el.tag == 'service' and n == 'com.google.firebase.components.ComponentDiscoveryService':
                if discovery is None: application.append(el); discovery = el
                else:
                    known = {name(m) for m in discovery.findall('meta-data')}
                    for meta in el.findall('meta-data'):
                        if name(meta) not in known: discovery.append(meta)
                continue
            if (el.tag, n) in have: continue
            have.add((el.tag, n)); application.append(el)
    service = ET.SubElement(application, 'service', {f'{{{ANDROID}}}name': 'com.veniux.companion.VeniuxMessagingService', f'{{{ANDROID}}}exported': 'false', f'{{{ANDROID}}}directBootAware': 'true'})
    ET.SubElement(ET.SubElement(service, 'intent-filter'), 'action', {f'{{{ANDROID}}}name': 'com.google.firebase.MESSAGING_EVENT'})
    ET.SubElement(application, 'meta-data', {f'{{{ANDROID}}}name': 'com.google.firebase.messaging.default_notification_channel_id', f'{{{ANDROID}}}value': 'veniux-alerts'})
    ET.SubElement(application, 'meta-data', {f'{{{ANDROID}}}name': 'com.google.firebase.messaging.default_notification_icon', f'{{{ANDROID}}}resource': '@drawable/logo'})
    text = ET.tostring(root, encoding='unicode').replace('${applicationId}', package)
    pathlib.Path(output).write_text('<?xml version="1.0" encoding="utf-8"?>\n' + text, encoding='utf-8')
    print('manifest birleştirildi:', output)


def config(google_services):
    data = json.loads(pathlib.Path(google_services).read_text(encoding='utf-8'))
    client = next((c for c in data.get('client', []) if c.get('client_info', {}).get('android_client_info', {}).get('package_name') == 'com.veniux.companion'), None)
    if not client: raise SystemExit("google-services.json içinde com.veniux.companion uygulaması yok. Firebase'e Android uygulamasını bu paket adıyla ekleyin.")
    keys = client.get('api_key') or []
    if not keys: raise SystemExit('google-services.json içinde api_key yok.')
    values = {'app_id': client['client_info']['mobilesdk_app_id'], 'api_key': keys[0]['current_key'], 'project_id': data['project_info']['project_id'], 'sender_id': data['project_info']['project_number']}
    LOCAL.mkdir(parents=True, exist_ok=True)
    (LOCAL / 'firebase-config.json').write_text(json.dumps(values, indent=1), encoding='utf-8')
    print('yapılandırma yazıldı: proje', values['project_id'], '| gönderen', values['sender_id'])


if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else ''
    if command == 'resolve': resolve(sys.argv[2] if len(sys.argv) > 2 else '26.0.2')
    elif command == 'bundle': bundle()
    elif command == 'merge': merge(sys.argv[2], sys.argv[3])
    elif command == 'config': config(sys.argv[2])
    else: print(__doc__)
