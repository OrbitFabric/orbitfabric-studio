import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initialGeometry,routeGeometry,changePositions,movedGeometry} from '../../src/features/experience/geometry/geometry.mjs';
import {metrics} from '../../src/features/experience/geometry/geometry-quality.mjs';
const require=createRequire(import.meta.url);
const {investigationSubject,advanceInspection}=require('../../.test-dist/features/experience/inspection.js');
const {graphEntityKey,orientedMissionGraph,scenarioContextGraph}=require('../../.test-dist/features/experience/graphModel.js');
const key=r=>`${r.domain}\u0000${r.id}`;
const a={domain:'commands',id:'same'},b={domain:'events',id:'same'};
test('endpoint inspection proposes exact inspected subject, retaining distinct native selection',()=>{
 assert.deepEqual(investigationSubject({kind:'entity',entity:b},a),b);
 assert.deepEqual(investigationSubject(null,a),a);
 assert.equal(investigationSubject({kind:'relation',id:'r'},a),null);
 assert.equal(investigationSubject({kind:'atom'},a),null);
});
test('inspection Return stack separates exact domains and never inherits an old generation',()=>{
 let state={membership:'one:1',current:{kind:'entity',entity:a},history:[]};
 state=advanceInspection(state,'one:1',{kind:'entity',entity:b});
 assert.deepEqual(state.history,[{kind:'entity',entity:a}]);
 state=advanceInspection(state,'one:2',{kind:'entity',entity:b});
 assert.deepEqual(state.history,[]);
 assert.equal(state.membership,'one:2');
});
const subsystem={domain:'subsystems',id:'system'},payload={domain:'payloads',id:'payload'};
const missing={domain:'telemetry',id:'missing'};
const relations=[{relationship_id:'p-s',from:payload,to:subsystem,relationship_type:'declared'},{relationship_id:'a-p',from:a,to:payload,relationship_type:'target'},{relationship_id:'b-a',from:b,to:a,relationship_type:'declared'},{relationship_id:'a-missing',from:a,to:missing,relationship_type:'explicit'}];
const session={readiness:{relationships:'ready'},readModel:{entityRecordsByKey:new Map([subsystem,payload,a,b].map(r=>[key(r),r])),relationshipsById:new Map(relations.map(r=>[r.relationship_id,r]))}};
test('oriented Mission retains explicit anchors and filters one family without inferred edges',()=>{
 const g=orientedMissionGraph(session,'commands',subsystem,null);
 assert.deepEqual(new Set(g.records.map(key)),new Set([subsystem,payload,a].map(key)));
 assert.deepEqual(g.relations.map(r=>r.relationship_id),['p-s','a-p']);
 assert.equal(g.unresolved,1);
 assert.equal(orientedMissionGraph(session,'events',null,null).records.length,2);
});
test('Scenario context preserves exact referenced population and refuses missing endpoints or label joins',()=>{
 const model={atoms:[{references:[{entity:a},{entity:b},{entity:missing}]}]};
 const g=scenarioContextGraph(session,model,null);
 assert.deepEqual(g.relations.map(r=>r.relationship_id),['b-a']);
 assert.equal(g.unresolved,1);
 assert.equal(g.records.length,2);
 assert.equal(scenarioContextGraph({...session,readiness:{relationships:'pending'}},model,null).relations.length,0);
});
test('accepted geometry and quality donor blobs are exact, excluding S2-04A',()=>{
 for(const [name,sha] of [['geometry.mjs','dfdbc4fde7c0dd5e5ea6138307ce6b41bb699e8d'],['geometry-quality.mjs','26fe96eb2fc7a29ea30aa87f91b0abfc19c75cd3']]) {
  const bytes=readFileSync(new URL('../../src/features/experience/geometry/'+name,import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),sha);
 }
});
const node=(id,label=id)=>({id,data:{object:{label,objectId:id}},position:{x:0,y:0}});
const edge=(id,source,target)=>({id,source,target,label:id,data:{witness:id}});
test('dense cyclic and parallel presentation preserves identity, finite routes and deterministic layout',()=>{
 const nodes=['a','b','c','d','e','f'].map(id=>node(id,id==='d'?'Long engineering recognition label '.repeat(4):id));
 const edges=[edge('ab','a','b'),edge('ab2','a','b'),edge('ba','b','a'),edge('ac','a','c'),edge('bd','b','d'),edge('ce','c','e'),edge('df','d','f'),edge('ef','e','f')];
 const placed=initialGeometry({nodes,edges},'context');
 const reversed=initialGeometry({nodes:[...nodes].reverse(),edges:[...edges].reverse()},'context');
 assert.deepEqual([...placed].sort((a,b)=>a.id.localeCompare(b.id)),[...reversed].sort((a,b)=>a.id.localeCompare(b.id)));
 const routed=routeGeometry(placed,edges);
 const m=metrics(placed,routed);
 assert.equal(m.nodeNode,0);assert.equal(m.labelNode,0);assert.equal(m.labelLabel,0);
 for(let i=0;i<edges.length;i++) {
  assert.equal(routed[i].id,edges[i].id);assert.equal(routed[i].source,edges[i].source);assert.equal(routed[i].target,edges[i].target);
  assert.equal(routed[i].data.witness,edges[i].data.witness);
  assert.ok(routed[i].data.geometry.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
 assert.notDeepEqual(routed[0].data.geometry.points,routed[1].data.geometry.points);
});
test('drag and reset change only geometry; invalid coordinates cannot enter presentation',()=>{
 const initial=initialGeometry({nodes:[node('a'),node('b')],edges:[edge('ab','a','b')]},'context');
 const moved=changePositions({},[{type:'position',id:'a',position:{x:500,y:200}},{type:'position',id:'b',position:{x:NaN,y:5}}]);
 assert.deepEqual(Object.keys(moved),['a']);
 const after=movedGeometry(initial,moved);assert.deepEqual(after[0].data,initial[0].data);
 assert.deepEqual(movedGeometry(initial,{}),initial);
});

test('React Flow identities retain exact domain tuples without DOM-invalid NUL',()=>{
 assert.notEqual(graphEntityKey(a),graphEntityKey(b));
 assert.equal(graphEntityKey(a).includes('\u0000'),false);
 assert.deepEqual(JSON.parse(graphEntityKey(a)),[a.domain,a.id]);
});
