import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createSourceRequests,loadSourceCandidate,readLocalReference}=require('../../.test-dist/features/experience/sourceRequests.js');
const {packComponents}=require('../../.test-dist/features/experience/graphFraming.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('inventory revisions reject stale roots without coupling independent lane completions',()=>{
 const r=createSourceRequests();assert.equal(r.untouched('scenario'),true);
 const old=r.begin('scenario'), current=r.begin('scenario'), evidence=r.begin('evidence');
 assert.equal(r.accepts(old),false);assert.equal(r.accepts(current),true);assert.equal(r.accepts(evidence),true);
 assert.equal(r.untouched('scenario'),false);
});
test('Mission teardown invalidates every ticket even after effect reactivation',()=>{
 const r=createSourceRequests(),t=r.begin('result'),s=r.beginSelection('scenario');r.close();r.activate();
 assert.equal(r.accepts(t),false);assert.equal(r.acceptsSelection(s),false);
 assert.equal(createSourceRequests().untouched('scenario'),true);
});
test('candidate presence invokes nothing; explicit selection resolves exact root/name before loading',async()=>{
 const calls=[],r=createSourceRequests();r.begin('scenario');assert.deepEqual(calls,[]);
 await loadSourceCandidate(r,'scenario','/authorized','same.yaml',async(root,name)=>{calls.push(['resolve',root,name]);return '/authorized/same.yaml';},async path=>calls.push(['hydrate',path]),error=>calls.push(['error',error]));
 assert.deepEqual(calls,[['resolve','/authorized','same.yaml'],['hydrate','/authorized/same.yaml']]);
});
test('missing or stale source preserves error and cannot hydrate or execute',async()=>{
 for(const reason of ['missing source','stale association','symlink excluded']) {
  const calls=[];
  await loadSourceCandidate(createSourceRequests(),'result','/authorized','result.json',async()=>{throw Error(reason);},async()=>calls.push('hydrate'),error=>calls.push(error));
  assert.deepEqual(calls,['Error: '+reason]);
 }
});
test('later explicit selection wins even when earlier path resolution completes last',async()=>{
 const r=createSourceRequests(),a=deferred(),calls=[];
 const first=loadSourceCandidate(r,'scenario','/root','old.yaml',()=>a.promise,async p=>calls.push(p),e=>calls.push(e));
 await loadSourceCandidate(r,'scenario','/root','new.yaml',async()=>'/root/new.yaml',async p=>calls.push(p),e=>calls.push(e));
 a.resolve('/root/old.yaml');await first;assert.deepEqual(calls,['/root/new.yaml']);
});
test('refresh or Mission replacement during resolution prevents stale hydration and stale errors',async()=>{
 for(const invalidate of [r=>r.begin('evidence'),r=>r.close()]) {
  const r=createSourceRequests(),a=deferred(),calls=[];
  const pending=loadSourceCandidate(r,'evidence','/root','e.json',()=>a.promise,async p=>calls.push(p),e=>calls.push(e));
  invalidate(r);a.resolve('/root/e.json');await pending;assert.deepEqual(calls,[]);
 }
 const r=createSourceRequests(),a=deferred(),errors=[];
 const pending=loadSourceCandidate(r,'result','/root','r.json',()=>a.promise,async()=>{},e=>errors.push(e));
 r.close();a.reject(Error('old failure'));await pending;assert.deepEqual(errors,[]);
});
test('local missing reference remains local and unavailable, never invalid semantic content',async()=>{
 let parses=0;
 const entry=await readLocalReference('/old/package.json',async()=>{throw Error('ENOENT');},()=>{parses++;});
 assert.deepEqual(entry,{manifestPath:'/old/package.json',descriptor:null,health:'unavailable',error:'ENOENT'});assert.equal(parses,0);
});
test('read bytes rejected by parser are invalid content, retaining exact source identity',async()=>{
 const entry=await readLocalReference('/local/package.json',async path=>({path,text:'bad'}),()=>{throw Error('manifest rejected');});
 assert.equal(entry.health,'invalid content');assert.equal(entry.manifestPath,'/local/package.json');assert.equal(entry.descriptor,null);
});
test('available local reference passes exact bytes and provenance without promoting installed state',async()=>{
 const calls=[];const entry=await readLocalReference('/alias',async()=>({path:'/canonical/package.json',text:'exact bytes'}),(path,text)=>{calls.push([path,text]);return {id:'package'};});
 assert.deepEqual(calls,[['/canonical/package.json','exact bytes']]);assert.equal(entry.health,'available');
 assert.deepEqual(Object.keys(entry).sort(),['descriptor','error','health','manifestPath']);
});
test('whole Mission packing preserves connected geometry, source records and exact edge topology',()=>{
 const nodes=[['a',0,0],['b',0,230],['c',0,500],['d',0,750],['e',0,1000]].map(([id,x,y])=>({id,position:{x,y},width:300,height:150,data:{exact:id}}));
 const edges=[{source:'a',target:'b',id:'declared'}],before=structuredClone({nodes,edges});
 const packed=packComponents(nodes,edges);
 assert.deepEqual({nodes,edges},before);assert.deepEqual(packed.map(n=>n.id),nodes.map(n=>n.id));
 assert.equal(packed[1].position.y-packed[0].position.y,230);
 assert.ok(new Set(packed.map(n=>n.position.x)).size>1);
 for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
  const a=packed[i],b=packed[j];assert.ok(a.position.x+a.width<=b.position.x||b.position.x+b.width<=a.position.x||a.position.y+a.height<=b.position.y||b.position.y+b.height<=a.position.y);
 }
 assert.deepEqual(packComponents(nodes,edges),packed);
});
test('single connected component retains accepted geometry without repacking',()=>{
 const nodes=[{id:'a',position:{x:15,y:30}},{id:'b',position:{x:300,y:500}}];
 assert.strictEqual(packComponents(nodes,[{source:'a',target:'b'}]),nodes);
});
