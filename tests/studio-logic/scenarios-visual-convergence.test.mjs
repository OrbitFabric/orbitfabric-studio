import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {ScenarioWorkspace}=require('../../.test-dist/features/scenarios/ScenarioWorkspace.js');
const {scenarioContextGraph}=require('../../.test-dist/features/experience/graphModel.js');
const {consumeScenarioReport}=require('../../.test-dist/convergence/scenarioProtocol.js');
const {buildScenarioUnderstanding}=require('../../.test-dist/convergence/scenarioUnderstanding.js');
const {emptyScenarioSlot}=require('../../.test-dist/convergence/scenarioSlot.js');
const reports=JSON.parse(readFileSync('docs/evidence/visual-slice-1.1/retained-core/reports.json'));
const report=k=>JSON.parse(reports.invocations[k].reportText);
const records=report('run_core_export_entity_index').entities;
const relations=report('run_core_export_relationship_manifest').relationships;
const key=r=>`${r.domain}\u0000${r.id}`;
const session={snapshot:report('run_core_export_mission_snapshot'),readiness:{relationships:'ready'},readModel:{entityRecordsByKey:new Map(records.map(r=>[key(r),r])),relationshipsById:new Map(relations.map(r=>[r.relationship_id,r]))}};
const model=buildScenarioUnderstanding({...emptyScenarioSlot(),accepted:{membership:{sessionId:'retained',generation:1},targetPath:reports.scenarioPath,declaration:consumeScenarioReport(reports.invocations.run_core_export_scenario_declaration.reportText)}});
function render(m=model,s=session){let calls=0;const html=renderToStaticMarkup(React.createElement(ScenarioWorkspace,{model:m,session:s,selectedEntity:null,disabled:false,pickerFailure:null,onChoose(){calls++},onRefresh(){calls++},onInspectEntity(){calls++}}));assert.equal(calls,0);return html;}
test('canonical retained Core context is five exact entities and four producer relationships',()=>{
 const context=scenarioContextGraph(session,model,null);assert.equal(context.records.length,5);assert.equal(context.relations.length,4);assert.equal(context.unresolved,0);
 for(const r of context.relations)assert.deepEqual(r,relations.find(x=>x.relationship_id===r.relationship_id));
 assert.equal(model.atoms.length,8);assert.deepEqual(model.atoms.map(a=>a.declarationPosition),[1,2,3,4,5,6,7,8]);
});
test('structured declaration exposes all exact atoms, fields and expected PASSED with no observed verdict',()=>{
 const html=render();assert.equal((html.match(/data-atom-id=/g)||[]).length,8);assert.match(html,/Expectation · DECLARED/);assert.match(html,/PASSED/);assert.match(html,/expected/);assert.match(html,/Accepted declaration source/);assert.ok(html.includes(model.sourceSha256));assert.ok(html.includes(reports.scenarioPath));assert.doesNotMatch(html,/Scenario evaluation: PASSED|New question|Search entities/);
 for(const a of model.atoms)assert.ok(html.includes(`data-atom-id="${a.id}"`));
});
test('pending relationships are unavailable rather than a misleading zero relations claim',()=>{
 const html=render(model,{...session,readiness:{relationships:'pending'}});assert.match(html,/Core relations<\/dt><dd>Unavailable/);
});
test('retained accepted declaration remains explicitly attributed after refresh failure',()=>{
 const html=render({...model,retainedObservation:true,hydrationFailure:{class:'transport',message:'source missing'}});assert.match(html,/previously accepted declaration/);assert.match(html,/source missing/);assert.ok(html.includes(model.sourceSha256));
});
const {SourceInventory}=require('../../.test-dist/features/experience/SourceInventory.js');
// Names verified read-only at Reference Mission e8f4a392e0bc3075df1ea3b00b842ba6b9e6e5ca.
const names=['adcs_degraded_pointing_payload_inhibit.yaml','delayed_sband_downlink_backlog_pending.yaml','eclipse_low_power_payload_suspension.yaml','nominal_payload_acquisition.yaml','payload_stop_acquisition_verification.yaml'];
const inventory=lane=>renderToStaticMarkup(React.createElement(SourceInventory,{kind:'scenario',lane,disabled:false,onAssociate(){throw Error('implicit association')},onRefresh(){throw Error('implicit refresh')},onSelect(){throw Error('implicit selection')}}));
test('five YAML candidates remain file identities, never five validated Scenarios',()=>{
 const html=inventory({root:'/reference/scenarios',pending:false,error:null,inventory:{root:'/reference/scenarios',entries:names.map(name=>({name,path:'/reference/scenarios/'+name,status:'available',reason:null}))}});
 assert.equal((html.match(/File candidate · not validated/g)||[]).length,5);for(const n of names)assert.ok(html.includes(n));
});
test('source inventory distinguishes empty, unavailable, pending and unassociated roots',()=>{
 assert.match(inventory({root:null,inventory:null,pending:false,error:null}),/No bounded source folder/);
 assert.match(inventory({root:'/empty',inventory:{root:'/empty',entries:[]},pending:false,error:null}),/No matching file candidates/);
 assert.match(inventory({root:'/missing',inventory:null,pending:false,error:'No such file'}),/Source unavailable: No such file/);
 assert.match(inventory({root:'/pending',inventory:null,pending:true,error:null}),/Reading file inventory/);
});
const {scenarioAtomPreview,scenarioAtomLayout}=require('../../.test-dist/features/scenarios/scenarioPresentation.js');
test('at-a-glance values retain false, READY and PASSED as exact declared fields',()=>{
 for(const atom of model.atoms){
  const preview=scenarioAtomPreview(atom);
  assert.deepEqual(preview.references,atom.references.map(r=>`${r.entity.domain}:${r.entity.id}`));
  for(const f of preview.fields)assert.ok(Object.hasOwn(atom.declaration,f.name));
 }
 assert.deepEqual(scenarioAtomPreview(model.atoms[5]).fields,[{name:'expected',value:'false'}]);
 assert.ok(scenarioAtomPreview(model.atoms[6]).fields.some(f=>f.name==='state'&&f.value==='READY'));
 assert.deepEqual(scenarioAtomPreview(model.atoms[7]).fields,[{name:'expected',value:'PASSED'}]);
});
test('presentation preserves arbitrary authored order, including reappearing roles',()=>{
 const atoms=[model.atoms[4],model.atoms[3],model.atoms[5],model.atoms[1]];
 const original=JSON.stringify(atoms),layout=scenarioAtomLayout(atoms);
 assert.equal(JSON.stringify(atoms),original);assert.equal(layout.length,atoms.length);
 assert.ok(layout.every((box,i)=>i===0||box.position.x>layout[i-1].position.x));
 const canonical=scenarioAtomLayout(model.atoms);
 for(let i=0;i<canonical.length;i++)for(let j=i+1;j<canonical.length;j++){
  const a=canonical[i],b=canonical[j];assert.ok(a.position.x+a.width<=b.position.x||a.position.y+a.height<=b.position.y||b.position.y+b.height<=a.position.y);
 }
});
test('accepted declaration provenance does not validate inventory bytes',()=>{
 assert.match(render(),/Core-validated declaration\. File inventory is separate/);
 const html=renderToStaticMarkup(React.createElement(SourceInventory,{kind:'scenario',lane:{root:'/s',pending:false,error:null,inventory:{root:'/s',entries:[{name:'a.yaml',path:'/s/a.yaml',status:'available',reason:null}]}},selectedPath:'/s/a.yaml',disabled:false,onAssociate(){},onRefresh(){},onSelect(){}}));
 assert.match(html,/Matches displayed declaration path · content may have changed/);
 assert.match(html,/File candidate · not validated/);
 assert.doesNotMatch(html,/Core-validated/);
});
test('source disclosure starts collapsed without changing the selected declaration',()=>{
 const {ScenarioSources}=require('../../.test-dist/features/scenarios/ScenarioWorkspace.js');
 const html=renderToStaticMarkup(React.createElement(ScenarioSources,null,'exact.yaml'));
 assert.doesNotMatch(html,/ open=/);assert.match(html,/exact.yaml/);
});
