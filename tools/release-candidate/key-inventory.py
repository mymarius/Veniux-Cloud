"""Read-only key provenance inventory. Never exports private material or DB rows."""
import hashlib,json,os,re,subprocess,zipfile,tarfile
from pathlib import Path
from cryptography.hazmat.primitives import serialization
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local/release-candidate-1';OUT.mkdir(parents=True,exist_ok=True)
target=serialization.load_pem_private_key((ROOT/'backend/config/keys/license_private_key.pem').read_bytes(),password=None)
def public_id(key):
 return hashlib.sha256(key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).digest()
target_id=public_id(target)
pattern=re.compile(rb'-----BEGIN (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----')
report={'target':'current local legacy license key; fingerprint retained only in memory','matches':[],'other_private_key_files':0,'other_private_key_locations':[],'encrypted_or_unsupported_key_files':[],'archives':[],'opaque_files':[],'errors':[],'files_checked':0,'git':{},'scope':'workspace incl. backups and ZIP/APK entries; node_modules regular source excluded, PEM/KEY files included; no customer DB records opened'}
def inspect(label,content):
 matched=False;other=False
 for block in pattern.findall(content):
  try:
   key=serialization.load_pem_private_key(block,password=None)
   if public_id(key)==target_id:matched=True
   else:other=True
  except (TypeError,ValueError):report['encrypted_or_unsupported_key_files'].append(label)
 if matched:report['matches'].append(label)
 if other:
  report['other_private_key_files']+=1;report['other_private_key_locations'].append(label)
def inspect_zip(file,label):
 try:
  with zipfile.ZipFile(file) as z:
   checked=0;limited=0
   for i in z.infolist():
    if i.is_dir():continue
    if i.file_size>4*1024*1024:limited+=1;continue
    if 'node_modules/' in i.filename and not i.filename.lower().endswith(('.pem','.key')):continue
    if not i.filename.lower().endswith(('.pem','.key','.json','.js','.cjs','.mjs','.txt','.sql','.env','.local','.php','.md')):continue
    inspect(label+'!/'+i.filename,z.read(i));checked+=1
   report['archives'].append({'path':label,'entries_checked':checked,'over_4MiB_entries_not_read':limited})
 except Exception as e:report['errors'].append({'path':label,'type':type(e).__name__})
for folder,dirs,files in os.walk(ROOT,followlinks=False):
 dirs[:]=[d for d in dirs if d not in ['.git','__pycache__','font-tools'] and not Path(folder,d).is_symlink()]
 for name in files:
  p=Path(folder,name);label=p.relative_to(ROOT).as_posix()
  try:
   if p.is_symlink():continue
   if name.lower().endswith(('.zip','.apk')):inspect_zip(p,label);continue
   if name.lower().endswith(('.tar','.tar.gz','.tgz')):
    try:
     checked=0
     with tarfile.open(p,'r:*') as archive:
      for member in archive:
       if not member.isfile() or member.size>4*1024*1024 or ('node_modules/' in member.name and not member.name.endswith(('.pem','.key'))):continue
       if not member.name.lower().endswith(('.pem','.key','.json','.js','.txt','.env','.php')):continue
       inspect(label+'!/'+member.name,archive.extractfile(member).read());checked+=1
     report['archives'].append({'path':label,'entries_checked':checked,'kind':'tar'})
    except Exception as e:report['errors'].append({'path':label,'type':type(e).__name__})
    continue
   if name.lower().endswith(('.exe','.asar','.7z','.gz','.vnxsecure','.pfx','.p12','.jks','.keystore')):
    report['opaque_files'].append({'path':label,'status':'container/binary or encrypted; not decompressed by this PEM inventory'});continue
   if 'node_modules' in p.parts and not name.lower().endswith(('.pem','.key')):continue
   if p.stat().st_size>4*1024*1024:continue
   if p.suffix.lower() not in ['.pem','.key','.json','.js','.cjs','.mjs','.txt','.sql','.env','.local','.php','.md'] and not name.startswith('.env'):continue
   inspect(label,p.read_bytes());report['files_checked']+=1
  except Exception as e:report['errors'].append({'path':label,'type':type(e).__name__})
git=subprocess.run(['git','-C',str(ROOT),'rev-parse','--show-toplevel'],capture_output=True)
report['git']={'repository_found':git.returncode==0,'history_status':'NOT TESTED: no repository at workspace' if git.returncode else 'BLOCKED: history scan requires repository object walk'}
report['matches']=sorted(set(report['matches']))
(OUT/'key-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'matching_locations':len(report['matches']),'regular_files_checked':report['files_checked'],'archives_checked':len(report['archives']),'opaque_containers':len(report['opaque_files']),'read_errors':len(report['errors']),'git_history':report['git']['history_status']}))
