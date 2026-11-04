"""Read-only ZIP/APK inventory. No extraction and no secret values in output."""
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / '.local/production-readiness-3'
out.mkdir(parents=True, exist_ok=True)
reports = []
for relative in ['.local/android-build-2.4.32/Veniux-Android-2.4.32.apk', 'veniux.com.zip']:
    artifact = root / relative
    if not artifact.exists():
        reports.append({'artifact': relative, 'status': 'NOT TESTED: unavailable'})
        continue
    findings = []
    count = 0
    with zipfile.ZipFile(artifact) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            count += 1
            reasons = []
            if re.search(r'(^|/)(\.env(?:\.(?!example|sample)[\w-]+)?|local-key\.bin|[^/]+\.(pfx|p12|jks|keystore|db|sqlite|sqlite3|vnxsecure))$', info.filename, re.I):
                reasons.append('sensitive-filename')
            if info.file_size < 4 * 1024 * 1024:
                content = archive.read(info)
                if re.search(rb'-----BEGIN (RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----', content):
                    reasons.append('private-key-header')
                if content.startswith(b'SQLite format 3\x00'):
                    reasons.append('sqlite-database')
            if reasons:
                findings.append({'path': info.filename, 'reasons': reasons})
    reports.append({'artifact': relative, 'entries': count, 'findings': findings,
                    'limit': 'Content scanned only below 4 MiB per entry. No decompilation, malware or arbitrary hardcoded-secret certification.'})
(out / 'archive-audit.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
print(json.dumps(reports))
