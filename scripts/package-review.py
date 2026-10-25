"""Package reviewable source only; exclude runtime databases, sessions and dependencies."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
excluded = {'node_modules', '.temp', '.local-stage', '.test-review', '.git', '__pycache__'}
files = [p for p in root.rglob('*')
         if p.is_file() and not any(part in excluded for part in p.relative_to(root).parts)
         and p.name != 'FILE-HASHES.json'
         and p.name != '.env' and not p.name.startswith('.env.')]
manifest = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in files}
manifest_path = root / 'docs/FILE-HASHES.json'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
files.append(manifest_path)
archive = root.parent / 'Ispovesti-ba-v2-priprema.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for path in sorted(files):
        output.write(path, str(Path(root.name) / path.relative_to(root)))
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
    assert not any(part in excluded for name in output.namelist()
                   for part in Path(name).parts)
print(json.dumps({'archive': str(archive), 'files': len(files),
                  'bytes': archive.stat().st_size, 'integrity': 'verified'}))
