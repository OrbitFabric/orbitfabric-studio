#!/usr/bin/env python3
"""One batch for the exact product candidate. Failure/NOT_RUN are never converted to PASS."""
import argparse, json, os, pathlib, shutil, subprocess, sys, time
p=argparse.ArgumentParser()
p.add_argument('--expected-head',required=True)
p.add_argument('--expected-tree',required=True)
p.add_argument('--core-root',required=True,type=pathlib.Path)
p.add_argument('--core',required=True)
p.add_argument('--reference-root',required=True,type=pathlib.Path)
p.add_argument('--output',required=True,type=pathlib.Path)
p.add_argument('--playwright-module')
p.add_argument('--chromium')
a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[3];os.chdir(root)
out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()
checks={}; identity={'head':git(root,'rev-parse','HEAD'),'tree':git(root,'rev-parse','HEAD^{tree}')}
for name,actual,expected in [('candidate',identity['head'],a.expected_head),('candidate-tree',identity['tree'],a.expected_tree),('core',git(a.core_root,'rev-parse','HEAD'),'5196e128974510b4cbd3bcd89ea971ff2b68301b'),('reference',git(a.reference_root,'rev-parse','HEAD'),'e8f4a392e0bc3075df1ea3b00b842ba6b9e6e5ca')]:
 if actual!=expected:sys.exit(f'PIN FAILURE: {name}: {actual} != {expected}')
if git(root,'diff','HEAD','--','src','src-tauri','package.json','package-lock.json','tools','tests'):sys.exit('PIN FAILURE: candidate tracked implementation is modified')
for name,repo in [('core',a.core_root),('reference',a.reference_root)]:
 if git(repo,'diff','HEAD','--'):sys.exit(f'PIN FAILURE: {name} tracked source modified')
env=os.environ.copy()
if a.playwright_module:env['PLAYWRIGHT_MODULE']=a.playwright_module
if a.chromium:env['CHROMIUM_EXECUTABLE_PATH']=a.chromium
env.pop('CONVERGENCE_WIDTHS',None) # maintainer batch always exercises all three widths
env['CONVERGENCE_EVIDENCE_DIR']=str(out/'browser')
def run(name,argv):
 start=time.time()
 with (out/(name+'.log')).open('w') as log:
  try:r=subprocess.run(argv,stdout=log,stderr=subprocess.STDOUT,env=env,timeout=1200);checks[name]={'status':'PASS' if r.returncode==0 else 'FAIL','exitCode':r.returncode,'seconds':round(time.time()-start,2)}
  except (OSError,subprocess.TimeoutExpired) as e:checks[name]={'status':'FAIL','reason':str(e)}
 print(name,checks[name]['status'],flush=True)
run('install',['npm','ci'])
run('logic',['npm','run','test:logic'])
run('frontend',['npm','run','build'])
run('security',['npm','audit','--audit-level=low'])
run('core-reports',[sys.executable,'tools/test/convergence/prepare.py',str(a.reference_root.resolve()),'--core',a.core])
if checks['core-reports']['status']=='PASS' and env.get('PLAYWRIGHT_MODULE') and env.get('CHROMIUM_EXECUTABLE_PATH'):
 run('browser',['node','tools/test/convergence/browser-check.cjs'])
else:checks['browser']={'status':'NOT_RUN','reason':'Core reports or externally supplied Playwright/Chromium unavailable'}
if shutil.which('cargo'):
 run('rust-tests',['cargo','test','--locked','--manifest-path','src-tauri/Cargo.toml'])
 run('rust-check',['cargo','check','--locked','--manifest-path','src-tauri/Cargo.toml'])
 run('tauri-build',['npm','run','tauri:build','--','--no-bundle'])
else:
 for name in ['rust-tests','rust-check','tauri-build']:checks[name]={'status':'NOT_RUN','reason':'Cargo unavailable'}
for name in ['native-ipc-ui','webkitgtk','webview2','native-save-clipboard']:
 checks[name]={'status':'NOT_RUN','reason':'This batch does not automate native desktop rendering or OS dialogs. Browser IPC substitution does not close this gate.'}
(out/'verification.json').write_text(json.dumps({'identity':identity,'checks':checks},indent=2)+'\n')
sys.exit(1 if any(c['status']=='FAIL' for c in checks.values()) else 2 if any(c['status']=='NOT_RUN' for c in checks.values()) else 0)
