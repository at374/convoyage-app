"""Stage and test a rolling public SNCF dataset before replacing published files."""
import argparse, hashlib, json, re, shutil, subprocess, tempfile, urllib.request, zipfile
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from build_sncf_days import build, SOURCE

def refresh(root, archive=None, today=None):
    today=today or datetime.now(ZoneInfo('Europe/Paris')).date()
    start=(today-timedelta(days=1)).isoformat()
    expected={(today+timedelta(days=i)).isoformat() for i in range(-1,7)}
    target=root/'data'/'sncf'
    current=json.loads((target/'manifest.json').read_text()) if (target/'manifest.json').exists() else {}
    with tempfile.TemporaryDirectory(prefix='convoyage-sncf-') as temp:
        temp=Path(temp);source=temp/'source.zip'
        if archive:shutil.copyfile(archive,source)
        else:
            with urllib.request.urlopen(SOURCE,timeout=45) as response:data=response.read(40_000_001)
            if len(data)>40_000_000:raise ValueError('Source exceeds size limit')
            source.write_bytes(data)
        sha=hashlib.sha256(source.read_bytes()).hexdigest()
        if current.get('sourceSha256')==sha and set(current.get('dates',{}))==expected:
            # Retained files must still match the recorded hashes before skipping.
            for entry in current['dates'].values():
                if not re.fullmatch(r'sncf-20\d{2}-\d{2}-\d{2}\.json',entry['file']):raise ValueError('Invalid filename')
                if hashlib.sha256((target/entry['file']).read_bytes()).hexdigest()!=entry['sha256']:raise ValueError('Published file hash mismatch')
            return {'updated':False,'reason':'same_source_and_dates'}
        staged=temp/'staged';manifest=build(source,staged,start,8)
        if set(manifest['dates'])!=expected:raise ValueError('Unexpected date range')
        for entry in manifest['dates'].values():
            if entry['trips']<1000 or entry['stations']<1000:raise ValueError('Unexpectedly small national railway dataset')
        import os
        env={**os.environ,'SNCF_DATA_DIR':str(staged)}
        subprocess.run(['node',str(root/'tests'/'sncf-fallback.test.cjs')],check=True,env=env,capture_output=True,text=True)
        # No target file is changed until download, conversion and all tests pass.
        target.mkdir(parents=True,exist_ok=True)
        names=set()
        for entry in manifest['dates'].values():
            name=entry['file'];shutil.copyfile(staged/name,target/name);names.add(name)
        shutil.copyfile(staged/'manifest.json',target/'manifest.json')
        for old in target.glob('sncf-*.json'):
            if re.fullmatch(r'sncf-20\d{2}-\d{2}-\d{2}\.json',old.name) and old.name not in names:old.unlink()
        return {'updated':True,'sourceVersion':manifest['sourceVersion'],'dates':sorted(manifest['dates'])}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--archive',type=Path)
    args=parser.parse_args();print(json.dumps(refresh(args.root.resolve(),args.archive),ensure_ascii=False))
