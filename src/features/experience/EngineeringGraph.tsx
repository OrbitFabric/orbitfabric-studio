import { useContext, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type NodeProps, type Node, type Edge, type Viewport, type XYPosition } from '@xyflow/react';
import { PresentationMemory, usePresentationMemory } from './presentationMemory';
import type { MissionSession } from '../../mission/MissionSession';
import { entityKey, type EntityRef } from '../../mission/entityRef';
import type { ScenarioUnderstandingModel, ScenarioAtomUnderstanding } from '../../convergence/scenarioUnderstanding';
import { presentScenarioAtom } from '../scenarios/scenarioPresentation';
import { FamilyLabel } from '../presentation/FamilyLabel';
import { familyForDomain, familyForScenarioAtom, type DisplayFamily } from '../presentation/familyMarkers';
import { graphEntityKey, authoredGraph, orientedMissionGraph, scenarioContextGraph } from './graphModel';
import { initialGeometry, movedGeometry, changePositions, routeGeometry } from './geometry/geometry.mjs';
import { geometryEdgeTypes } from './GeometryEdge';

type CardData = { title:string; family:DisplayFamily|null; kind:string; exact:string; object:{label:string;objectId:string}; anchor?:boolean; vertical?:boolean; fields?:{name:string;value:string}[] };
function EngineeringNode({data,selected}:NodeProps<Node<CardData>>) {
  return <article className={`engineering-node${selected?' is-selected':''}${data.anchor?' is-context-anchor':''}${data.vertical?' is-declaration':''}`}>
    <Handle type="target" position={data.vertical?Position.Top:Position.Left} isConnectable={false}/>
    <small><FamilyLabel family={data.family}>{data.kind}</FamilyLabel></small>
    <strong>{data.title}</strong><code>{data.exact}</code>
    {data.fields && <dl>{data.fields.map(f=><div key={f.name}><dt>{f.name}</dt><dd>{f.value}</dd></div>)}</dl>}
    <Handle type="source" position={data.vertical?Position.Bottom:Position.Right} isConnectable={false}/>
  </article>;
}
type RepresentationCallback = (identities:string[])=>void;
function useRepresentation(identities:string[], report?:RepresentationCallback) {
  const signature=JSON.stringify(identities);
  useEffect(()=>{report?.(JSON.parse(signature));},[signature,report]);
}
const nodeTypes={engineering:EngineeringNode};
type Graph = ReturnType<typeof orientedMissionGraph>;
function RelationalCanvas({graph,memoryKey,selected,selectedRelation,focus,onInspect,onRelation,draggable=true}:{graph:Graph;memoryKey:string;selected:EntityRef|null;selectedRelation:string|null;focus:EntityRef|null;onInspect:(r:EntityRef)=>void;onRelation:(id:string)=>void;draggable?:boolean}) {
  const memory=useContext(PresentationMemory);
  const [initialFit]=useState(()=>!memory.has(`${memoryKey}:viewport`));
  const [positions,setPositions]=usePresentationMemory<Record<string,XYPosition>>(`${memoryKey}:positions`,{});
  const [viewport,setViewport]=usePresentationMemory<Viewport>(`${memoryKey}:viewport`,{x:25,y:25,zoom:0.85});
  // Selection does not enter geometric computation. E2-B/P2 is the accepted donor,
  // unchanged; context-sized cards accommodate product domain-qualified identities.
  const base=useMemo(()=>({nodes:graph.records.map(r=>({id:graphEntityKey(r),type:'engineering',position:{x:0,y:0},data:{title:r.display_name,family:familyForDomain(r.domain),kind:r.domain,exact:r.id,object:{label:r.display_name,objectId:r.id}}})),edges:graph.relations.map(r=>({id:r.relationship_id,source:graphEntityKey(r.from),target:graphEntityKey(r.to),label:r.relationship_type}))}),[graph]);
  const initial=useMemo(()=>initialGeometry(base,'context'),[base]);
  const placed=useMemo(()=>movedGeometry(initial,positions),[initial,positions]);
  const routed=useMemo(()=>routeGeometry(placed,base.edges),[placed,base]);
  const nodes=placed.map(n=>({...n,measured:{width:n.width,height:n.height},selected:!!selected&&graphEntityKey(selected)===n.id,data:{...n.data,anchor:!!focus&&graphEntityKey(focus)===n.id}}));
  const edges=routed.map(e=>({...e,selected:e.id===selectedRelation,markerEnd:{type:MarkerType.ArrowClosed},style:{stroke:e.id===selectedRelation?'#e6edf3':'#8098ad',strokeWidth:e.id===selectedRelation?3:1.5}}));
  const showSelected=()=>{const n=nodes.find(n=>n.selected);if(n)setViewport({x:30-n.position.x*0.9,y:30-n.position.y*0.9,zoom:0.9});};
  const outside=selected&&!nodes.some(n=>n.selected)||selectedRelation&&!edges.some(e=>e.selected);
  return <>
    <div className="experience-tools geometry-tools">
      <label>Inspect represented entity <select aria-label="Inspect represented entity" value={selected&&graph.records.some(r=>graphEntityKey(r)===graphEntityKey(selected))?graphEntityKey(selected):''} onChange={e=>{const r=graph.records.find(r=>graphEntityKey(r)===e.target.value);if(r)onInspect(r);}}><option value="">Choose exact entity</option>{graph.records.map(r=><option key={graphEntityKey(r)} value={graphEntityKey(r)}>{r.domain}:{r.id}</option>)}</select></label>
      {draggable&&<button className="secondary-action" onClick={()=>setPositions({})}>Reset layout</button>}
      <button className="secondary-action" disabled={!nodes.some(n=>n.selected)} onClick={showSelected}>Show inspected subject</button>
      <span>{graph.records.length} represented · {graph.relations.length} Core relations · {graph.unresolved} unresolved endpoints</span>
    </div>
    {viewport.zoom<0.6&&<p className="experience-boundary">Broad overview · use a narrower context or Inspect represented entity, then Show inspected subject for readable detail.</p>}
    {outside&&<p role="status" className="experience-boundary">Inspected subject is outside this representation. Inspection, Anchor and Scope are retained. Use explicit context controls to reveal it.</p>}
    <div className="engineering-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={geometryEdgeTypes} viewport={viewport} onViewportChange={setViewport}
        nodesDraggable={draggable} onNodesChange={changes=>setPositions(p=>changePositions(p,changes))} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={0.2} maxZoom={1.6}
        fitView={initialFit} fitViewOptions={{padding:0.12,minZoom:0.25,maxZoom:1}}
        onNodeClick={(_,n)=>{const r=graph.records.find(r=>graphEntityKey(r)===n.id);if(r)onInspect({domain:r.domain,id:r.id});}}
        onEdgeClick={(_,e)=>onRelation(e.id)} panOnScroll zoomOnScroll={false}>
        <Background gap={24}/><Controls showInteractive={false}/>
      </ReactFlow>
    </div>
    <details><summary>Read displayed relationships ({graph.relations.length})</summary>{graph.relations.map(r=><button className="experience-relation" key={r.relationship_id} aria-pressed={selectedRelation===r.relationship_id} onClick={()=>onRelation(r.relationship_id)}>{r.from.domain}:{r.from.id} → {r.relationship_type} → {r.to.domain}:{r.to.id}</button>)}</details>
  </>;
}
export function MissionModel({session,selected,selectedRelation,onInspect,onRelation,onRepresented}:{session:MissionSession;selected:EntityRef|null;selectedRelation:string|null;onInspect:(r:EntityRef)=>void;onRelation:(id:string)=>void;onRepresented?:RepresentationCallback}) {
  const [domain,setDomain]=usePresentationMemory('mission:domain','commands');
  const [focus,setFocus]=usePresentationMemory<EntityRef|null>('mission:focus',null);
  const [neighbor,setNeighbor]=usePresentationMemory<EntityRef|null>('mission:neighbor',null);
  const graph=useMemo(()=>orientedMissionGraph(session,domain,focus,neighbor),[session,domain,focus,neighbor]);
  useRepresentation([...graph.records.map(r=>JSON.stringify(['entity',r.domain,r.id])),...graph.relations.map(r=>JSON.stringify(['relation',r.relationship_id]))],onRepresented);
  const systems=[...session.readModel.entityRecordsByKey.values()].filter(r=>r.domain==='subsystems');
  const focusRecord=focus&&session.readModel.entityRecordsByKey.get(entityKey(focus));
  const viewKey=JSON.stringify(['mission',focus,domain,neighbor]);
  return <section className="experience-model" aria-label="Mission Model">
    <header><p className="eyebrow">UNDERSTAND · CORE DECLARATIONS</p><h2>Mission Model</h2><p>Explore typed objects and their explicit declared relationships.</p>
      <div className="experience-tools"><strong>{focusRecord?`Focus · ${focusRecord.display_name}`:'Whole Mission · declared subsystem and payload structure'}</strong><button className="secondary-action" onClick={()=>{setFocus(null);setNeighbor(null);}}>Whole Mission</button></div>
      <div className="experience-tools" aria-label="Mission subsystem orientation">{systems.map(r=><button className="secondary-action" key={graphEntityKey(r)} aria-pressed={!!focus&&graphEntityKey(focus)===graphEntityKey(r)} onClick={()=>{setFocus({domain:r.domain,id:r.id});setNeighbor(null);onInspect(r);}}>{r.display_name}</button>)}</div>
    </header>
    <div className="experience-tools">
      <label>Representation <select aria-label="Mission representation" value={domain} onChange={e=>{setDomain(e.target.value);setNeighbor(null);}}>{[...session.readModel.entityRefsByDomain.keys()].map(d=><option key={d}>{d}</option>)}</select></label>
      {!focus&&!neighbor&&<span>Select a subsystem to reveal one local family.</span>}
      <button className="secondary-action" disabled={!selected} onClick={()=>setNeighbor(selected)}>Show declared neighbors</button>
      {neighbor&&<><span>Temporary context · {neighbor.domain}:{neighbor.id}</span><button className="secondary-action" onClick={()=>setNeighbor(null)}>Return to family</button></>}
    </div>
    <RelationalCanvas key={viewKey} graph={graph} memoryKey={viewKey} selected={selected} selectedRelation={selectedRelation} focus={focus} onInspect={onInspect} onRelation={onRelation}/>
    <p className="experience-boundary">Arrows are Core relationships, not causality. Focus, family, geometry and neighborhood change representation, not investigation Scope. Relations readiness: {session.readiness.relationships}.</p>
  </section>;
}
export function ScenarioGraph({model,selectedAtom,onInspect,session,selectedEntity,selectedRelation,onInspectEntity,onRelation,onRepresented}:{model:ScenarioUnderstandingModel;selectedAtom:string|null;onInspect:(a:ScenarioAtomUnderstanding)=>void;session:MissionSession;selectedEntity:EntityRef|null;selectedRelation:string|null;onInspectEntity:(r:EntityRef)=>void;onRelation:(id:string)=>void;onRepresented?:RepresentationCallback}) {
  const key=`scenario:${model.sourceSha256}`;
  const [view,setView]=usePresentationMemory(`${key}:view`,'declaration');
  const [focus,setFocus]=usePresentationMemory<EntityRef|null>(`${key}:focus`,null);
  const [viewport,setViewport]=usePresentationMemory<Viewport>(`${key}:viewport`,{x:30,y:25,zoom:0.85});
  const context=useMemo(()=>scenarioContextGraph(session,model,focus),[session,model,focus]);
  useRepresentation(view==='context'?[...context.records.map(r=>JSON.stringify(['entity',r.domain,r.id])),...context.relations.map(r=>JSON.stringify(['relation',r.relationship_id]))]:model.atoms.map(a=>JSON.stringify(['atom',model.exactIdentity?.scenarioId,model.sourceSha256,a.id])),onRepresented);
  const graph=authoredGraph(model);
  let y=30;
  const nodes:Node<CardData>[]=graph.atoms.map(atom=>{
    const p=presentScenarioAtom(atom);
    // Declaration preserves Core normalized order, with field-sized cards, not ranks.
    const height=132+p.fields.reduce((h,f)=>h+38+f.value.split('\n').reduce((count,l)=>count+Math.max(1,Math.ceil(l.length/38)),0)*19,0);
    const n={id:atom.id,type:'engineering',position:{x:40,y},width:380,height,measured:{width:380,height},style:{width:380,height},selected:selectedAtom===atom.id,data:{title:p.title,kind:`${p.role} · ${p.declaredTime??'DECLARED'}`,family:familyForScenarioAtom(atom.kind),exact:atom.id,object:{label:p.title,objectId:atom.id},fields:p.fields,vertical:true}};
    y+=height+85;return n;
  });
  const edges:Edge[]=graph.order.map(o=>({id:JSON.stringify([o.from,o.to]),source:o.from,target:o.to,type:'straight',label:'Authored order',selectable:false,markerEnd:{type:MarkerType.ArrowClosed}}));
  return <section className="experience-model" aria-label="Graphical Scenario declaration">
    <div className="experience-tools" role="group" aria-label="Scenario representation"><button className="secondary-action" aria-pressed={view==='declaration'} onClick={()=>setView('declaration')}>Declaration</button><button className="secondary-action" aria-pressed={view==='context'} onClick={()=>setView('context')}>Declared context</button><span>{model.atoms.length} atoms · DECLARED</span></div>
    {view==='declaration'?<>
      <div className="experience-tools"><h3>Authored declaration</h3><label>Inspect atom <select aria-label="Inspect atom" value={selectedAtom??''} onChange={e=>{const a=model.atoms.find(a=>a.id===e.target.value);if(a)onInspect(a);}}><option value="">Choose an atom</option>{model.atoms.map(a=><option key={a.id} value={a.id}>{a.declarationPosition} · {presentScenarioAtom(a).title}</option>)}</select></label>
      <button className="secondary-action" disabled={!selectedAtom} onClick={()=>{const n=nodes.find(n=>n.id===selectedAtom);if(n)setViewport({x:30,y:25-n.position.y*0.85,zoom:0.85});}}>Show inspected atom</button></div>
      <div className="engineering-canvas scenario-engineering-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} viewport={viewport} onViewportChange={setViewport} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={0.25} maxZoom={1.5} onNodeClick={(_,n)=>{const a=model.atoms.find(a=>a.id===n.id);if(a)onInspect(a);}} panOnScroll zoomOnScroll={false}><Background gap={24}/><Controls showInteractive={false}/></ReactFlow></div>
    </>:<>
      <div className="experience-tools"><label>Context focus <select aria-label="Scenario context focus" value={focus?graphEntityKey(focus):''} onChange={e=>{const p=model.participants.find(p=>graphEntityKey(p.entity)===e.target.value);setFocus(p?.entity??null);}}><option value="">All declared participants</option>{model.participants.map(p=><option key={graphEntityKey(p.entity)} value={graphEntityKey(p.entity)}>{p.entity.domain}:{p.entity.id}</option>)}</select></label><button className="secondary-action" disabled={!selectedEntity||!model.participants.some(p=>graphEntityKey(p.entity)===graphEntityKey(selectedEntity))} onClick={()=>setFocus(selectedEntity)}>Focus inspected participant</button>{focus&&<button className="secondary-action" onClick={()=>setFocus(null)}>Return to Scenario context</button>}<span>{focus?`Context focus · ${focus.domain}:${focus.id}`:'Exact Scenario participants · Core relations between represented entities'}</span></div>
      <RelationalCanvas key={`${key}:context:${JSON.stringify(focus)}`} graph={context} memoryKey={`${key}:context:${JSON.stringify(focus)}`} selected={selectedEntity} selectedRelation={selectedRelation} focus={focus} onInspect={onInspectEntity} onRelation={onRelation} draggable={false}/>
      <p className="experience-boundary">Only exact referenced Mission entities and available Core relationships are represented. Scenario roles and witnesses remain in the declaration and Inspector. No inferred state nodes, execution or completeness claim.</p>
    </>}
    <p className="experience-boundary">Order follows the Core declaration. Expected effects are authored intent, never observed behavior. Full fields and all references remain below.</p>
  </section>;
}
