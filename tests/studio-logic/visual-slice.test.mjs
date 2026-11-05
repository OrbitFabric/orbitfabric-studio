import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MissionAtlas}=require('../../.test-dist/features/atlas/MissionAtlas.js');
const {packComponents}=require('../../.test-dist/features/experience/graphFraming.js');
const {preserveCaptureReadingPosition}=require('../../.test-dist/features/capture/captureComposition.js');
const session=()=>({snapshot:{mission:{id:'actual-id',name:'Actual mission',model_version:'source-version'},model:{subsystems:[{id:'exact<&>',name:'Exact participant',description:'Actual source description'}],payloads:[],contacts:{},modes:{},mode_transitions:[],commands:[],faults:[],telemetry:[],events:[],packets:[],data_products:[]}},readiness:{entities:'pending',relationships:'failed',lint:'pending'},lint:null});
test('Atlas renders actual source counts and pending/failed hydration without illustrative claims',()=>{
 const s=session(),before=structuredClone(s);let calls=0;
 const html=renderToStaticMarkup(React.createElement(MissionAtlas,{session:s,selectedEntity:null,onSelectEntity(){calls++},onOpenModel(){calls++},onNavigate(){calls++}}));
 assert.match(html,/Actual mission/);assert.match(html,/exact&lt;&amp;&gt;/);assert.match(html,/source-version/);
 assert.match(html,/<strong>1<\/strong> participants/);assert.match(html,/<strong>0<\/strong> commands/);
 assert.match(html,/hydration-failed/);assert.match(html,/hydration-pending/);assert.doesNotMatch(html,/Validated|Executed|Observed|Reference Mission/);
 assert.equal(calls,0);assert.deepEqual(s,before);
});
test('Atlas handles empty and unavailable source without demo fallback',()=>{
 const s=session();s.snapshot.model.subsystems=[];
 const html=renderToStaticMarkup(React.createElement(MissionAtlas,{session:s,onOpenModel(){},onNavigate(){},onSelectEntity(){}}));
 assert.match(html,/<strong>0<\/strong> participants/);assert.doesNotMatch(html,/participant-card/);
 s.snapshot.model=null;assert.equal(renderToStaticMarkup(React.createElement(MissionAtlas,{session:s})), '');
});
test('whole Mission shelves keep exact connected geometry and non-overlap with bounded sparse extent',()=>{
 const nodes=Array.from({length:8},(_,i)=>({id:String(i),position:{x:i===1?580:0,y:0},width:300,height:i===2?168:145,data:{exact:String(i)}}));
 const edges=[{source:'0',target:'1'}];const before=structuredClone({nodes,edges});
 const out=packComponents(nodes,edges);
 assert.deepEqual({nodes,edges},before);assert.equal(out[1].position.x-out[0].position.x,580);
 assert.deepEqual(out.map(n=>n.data),nodes.map(n=>n.data));
 assert.ok(Math.max(...out.map(n=>n.position.x+n.width))<=1070);
 assert.ok(Math.max(...out.map(n=>n.position.y+n.height))<=600);
 for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
  const a=out[i],b=out[j];assert.ok(a.position.x+a.width<=b.position.x||b.position.x+b.width<=a.position.x||a.position.y+a.height<=b.position.y||b.position.y+b.height<=a.position.y);
 }
 assert.deepEqual(packComponents(nodes,edges),out);
});
test('Capture restores nested reading positions after success/failure, excluding graph and detached nodes',()=>{
 const node=(top,left,graph=false)=>({scrollTop:top,scrollLeft:left,isConnected:true,closest:()=>graph?{}:null});
 const primary=node(880,4),investigation=node(112,8),detached=node(44,5),graph=node(9,10,true);
 const root={...node(20,0),querySelectorAll:()=>[primary,investigation,detached,graph],contains:n=>n!==detached};
 const restore=preserveCaptureReadingPosition(root);
 for(const n of [root,primary,investigation,detached,graph]){n.scrollTop=0;n.scrollLeft=0;}
 detached.isConnected=false;restore();
 assert.equal(root.scrollTop,20);assert.deepEqual([primary.scrollTop,primary.scrollLeft],[880,4]);assert.deepEqual([investigation.scrollTop,investigation.scrollLeft],[112,8]);assert.equal(detached.scrollTop,0);assert.equal(graph.scrollTop,0);
 assert.doesNotThrow(()=>preserveCaptureReadingPosition(null)());
});
test('Atlas actions navigate existing routes and inspect exact identity only on explicit clicks',()=>{
 const calls=[],s=session();
 const tree=MissionAtlas({session:s,selectedEntity:null,onSelectEntity:ref=>calls.push(['inspect',ref]),onOpenModel:()=>calls.push(['model']),onNavigate:route=>calls.push(['route',route])});
 const elements=[];
 function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(typeof node.type==='function'){visit(node.type(node.props));return;}elements.push(node);visit(node.props?.children);}
 visit(tree);assert.deepEqual(calls,[]);
 const buttons=elements.filter(e=>e.type==='button');
 buttons.find(e=>e.props.className?.includes('participant-card')).props.onClick();
 assert.deepEqual(calls,[['inspect',{domain:'subsystems',id:'exact<&>'}]]);
 for(const button of buttons.filter(e=>!e.props.className?.includes('participant-card')))button.props.onClick();
 assert.deepEqual(calls.slice(1),[['model'],['model'],...['operations','relations','scenarios','integrations','evidence'].map(r=>['route',r])]);
});
test('disconnected records cannot inflate the geometry input of the only real relationship',()=>{
 const {componentLayouts}=require('../../.test-dist/features/experience/graphFraming.js');
 const graph={nodes:Array.from({length:8},(_,i)=>({id:String(i)})),edges:[{source:'4',target:'6',id:'exact'}]};const calls=[];
 const result=componentLayouts(graph,g=>{calls.push(g);return g.nodes;});
 assert.equal(result.length,8);assert.equal(calls.length,7);assert.deepEqual(calls.find(c=>c.edges.length),{nodes:[{id:'4'},{id:'6'}],edges:graph.edges});
 assert.ok(calls.filter(c=>!c.edges.length).every(c=>c.nodes.length===1));
});

test('entity decoration uses exact declared types, with a neutral fallback and no identity inference',()=>{
 const {entityDecoration}=require('../../.test-dist/features/presentation/EntityGlyph.js');
 const neutral=entityDecoration(undefined);
 assert.deepEqual(entityDecoration('obc'),neutral);
 assert.deepEqual(entityDecoration('unknown_power_management'),neutral);
 assert.deepEqual(entityDecoration(null),neutral);
 assert.deepEqual(entityDecoration({type:'power_management'}),neutral);
 assert.notDeepEqual(entityDecoration('power_management'),neutral);
 assert.notDeepEqual(entityDecoration('command_and_data_handling'),entityDecoration('power_management'));
 const s=session();s.snapshot.model.subsystems[0].type='power_management';const before=structuredClone(s);
 const html=renderToStaticMarkup(React.createElement(MissionAtlas,{session:s,onOpenModel(){},onNavigate(){},onSelectEntity(){}}));
 assert.match(html,/--entity-accent:#ffbd43/);assert.match(html,/exact&lt;&amp;&gt;/);assert.deepEqual(s,before);
});
