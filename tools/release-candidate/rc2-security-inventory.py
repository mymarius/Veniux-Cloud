"""Metadata-only recovery inventory; never opens customer DB rows or PEM bodies."""
import os,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'.local/release-candidate-2'
report={'key_use_sites':[],'plaintext_recovery_manifests':[],'private_key_file_locations':[],'recovery_previous_directories':[],'encrypted_backup_file_locations':[],'errors':[],'scope':'workspace metadata and first-party source references; no DB rows, PEM or environment bodies read'}
skip={'node_modules','.git','mysql-bin','mysql-data','font-tools'}
for base,dirs,files in os.walk(root):
 dirs[:]=[d for d in dirs if d not in skip and not d.startswith('mysql-data-')]
 parent=Path(base);rel=parent.relative_to(root)
 for name in files:
  file=parent/name;label=str(file.relative_to(root)).replace('\\','/')
  if re.search(r'(license[_-]private|signing-private).*\.pem$',name):report['private_key_file_locations'].append(label)
  if name.endswith('.vnxsecure'):report['encrypted_backup_file_locations'].append(label)
  if name=='manifest.json' and 'recovery' in rel.parts:
   try:
    m=json.loads(file.read_text(encoding='utf-8-sig'))
    if m.get('format')==1 and any(v.get('name')=='database.sqlite' for v in m.get('files',[])):report['plaintext_recovery_manifests'].append({'manifest':label,'file_count':len(m['files']),'contains_key_paths':any('keys' in v.get('name','') for v in m['files'])})
   except Exception as e:report['errors'].append({'path':label,'error':type(e).__name__})
  if name in ('install.env','database.sqlite') and any(p.startswith('restore-') for p in rel.parts):report['recovery_previous_directories'].append(label)
  if '.local' not in rel.parts and file.suffix in ('.js','.cjs','.php','.ps1'):
   try:
    for i,line in enumerate(file.read_text(encoding='utf-8-sig').splitlines(),1):
     if re.search(r'LICENSE_PRIVATE_KEY_PATH|license_private_key\.pem|signing-private\.pem|signPayload\(|openssl_sign\(',line):report['key_use_sites'].append({'path':label,'line':i})
   except Exception as e:report['errors'].append({'path':label,'error':type(e).__name__})
out.mkdir(exist_ok=True,parents=True)
(out/'security-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:len(v) for k,v in report.items() if isinstance(v,list)}))
