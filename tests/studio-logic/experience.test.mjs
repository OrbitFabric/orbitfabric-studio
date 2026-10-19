import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {missionGraph,authoredGraph}=require('../../.test-dist/features/experience/graphModel.js');
const {inspectionIdentity}=require('../../.test-dist/features/experience/inspection.js');
const key=e=>JSON.stringify([e.domain,e.id]);
test('Mission graph uses exact endpoints and no name-inferred edge',()=>{
 const a={domain:'commands',id:'same'},b={domain:'events',id:'same'},c={domain:'payloads',id:'unresolved'};
 const r={relationship_id:'r',from:a,to:b,relationship_type:'declared'};
 const s={readiness:{relationships:'ready'},readModel:{entityRecordsByKey:new Map([[key(a),a],[key(b),b]]),relationshipsById:new Map([['r',r],['missing',{...r,relationship_id:'missing',to:c}]])}};
 const g=missionGraph(s,'commands',a);assert.equal(g.records.length,2);assert.deepEqual(g.relations,[r]);assert.equal(g.unresolved,1);
 assert.equal(missionGraph(s,'commands',null).relations.length,0);
 s.readiness.relationships='pending';assert.equal(missionGraph(s,'commands',a).relations.length,0);
});
test('Scenario graph retains every atom including metadata and expectations in Core order',()=>{
 const atoms=[{id:'metadata'},{id:'expect'},{id:'command'}];const g=authoredGraph({atoms});assert.equal(g.atoms,atoms);assert.deepEqual(g.order,[{from:'metadata',to:'expect'},{from:'expect',to:'command'}]);
});
test('Inspection keys separate domains and exact scenario revisions',()=>{
 assert.notEqual(inspectionIdentity({kind:'entity',entity:{domain:'commands',id:'same'}}),inspectionIdentity({kind:'entity',entity:{domain:'events',id:'same'}}));
 const a={kind:'atom',scenario:{exactIdentity:{scenarioId:'s'},sourceSha256:'a'},atom:{id:'same'}};
 assert.notEqual(inspectionIdentity(a),inspectionIdentity({...a,scenario:{...a.scenario,sourceSha256:'b'}}));
});
