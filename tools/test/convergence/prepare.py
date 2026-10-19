"""Retain actual Core outputs for explicit, pinned source files. No semantic fixtures."""
import argparse, json, pathlib, subprocess, tempfile, hashlib
p=argparse.ArgumentParser();p.add_argument('reference_root',type=pathlib.Path);p.add_argument('--core',required=True);a=p.parse_args()
subprocess.run(['python','tools/test/scenario-browser/prepare.py',str(a.reference_root),'--core',a.core],check=True)
f=pathlib.Path('.sp2-acceptance/reports.json');r=json.loads(f.read_text());r['scenarioInvocations']={}
for name in ['payload_stop_acquisition_verification','adcs_degraded_pointing_payload_inhibit','eclipse_low_power_payload_suspension']:
 source=(a.reference_root/'scenarios'/f'{name}.yaml').resolve()
 with tempfile.TemporaryDirectory() as temp:
  out=pathlib.Path(temp)/'declaration.json';args=['export','scenario-declaration',str(source),'--json',str(out)]
  run=subprocess.run([a.core,*args],capture_output=True,text=True,timeout=60)
  if run.returncode:raise RuntimeError(run.stderr or run.stdout)
  text=out.read_text();r['scenarioInvocations'][str(source)]={'operation':'run_core_export_scenario_declaration','executable':a.core,'args':args,'exitCode':run.returncode,'processCompleted':True,'timedOut':False,'stdout':run.stdout,'stderr':run.stderr,'reportPath':str(out),'reportText':text}
r['convergenceProvenance']={'referenceHead':subprocess.check_output(['git','-C',str(a.reference_root),'rev-parse','HEAD'],text=True).strip(),'sources':{path:hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest() for path in r['scenarioInvocations']},'coreExecutable':a.core}
f.write_text(json.dumps(r,indent=2)+'\n')
print('Retained three explicit Core declarations with exact source hashes')
