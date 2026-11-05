import type { CSSProperties } from "react";
import { EntityGlyph, entityDecoration } from "../presentation/EntityGlyph";
import { componentLayouts, packComponents } from './graphFraming';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ReactFlow, useReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, type NodeProps, type Node, type Edge, type Viewport, type XYPosition } from '@xyflow/react';
import { PresentationMemory, usePresentationMemory } from './presentationMemory';
import type { MissionSession } from '../../mission/MissionSession';
import { entityKey, type EntityRef } from '../../mission/entityRef';
import type { ScenarioUnderstandingModel, ScenarioAtomUnderstanding } from '../../convergence/scenarioUnderstanding';
import { presentScenarioAtom, scenarioAtomPreview, scenarioAtomLayout } from '../scenarios/scenarioPresentation';
import { FamilyLabel } from '../presentation/FamilyLabel';
import { familyForDomain, familyForScenarioAtom, type DisplayFamily } from '../presentation/familyMarkers';
import { graphEntityKey, authoredGraph, orientedMissionGraph, scenarioContextGraph } from './graphModel';
import { initialGeometry, movedGeometry, changePositions, routeGeometry } from './geometry/geometry.mjs';
import { geometryEdgeTypes } from './GeometryEdge';

type CardData = { declaredType?:unknown; title:string; family:DisplayFamily|null; kind:string; exact:string; object:{label:string;objectId:string}; anchor?:boolean; vertical?:boolean; atomRole?:string; references?:string[]; fields?:{name:string;value:string}[] };
function EngineeringNode({data,selected}:NodeProps<Node<CardData>>) {
  return <article className={`engineering-node${selected?' is-selected':''}${data.anchor?' is-context-anchor':''}${data.vertical?' is-declaration':''}`} data-family={data.family ?? undefined} data-atom-role={data.atomRole} style={{'--entity-accent':entityDecoration(data.declaredType).color} as CSSProperties}>
    <Handle type="target" position={data.vertical?Position.Top:Position.Left} isConnectable={false}/>
    <small><FamilyLabel family={data.family}>{data.kind}</FamilyLabel></small>
    {!data.vertical && <EntityGlyph declaredType={data.declaredType}/>}<strong>{data.title}</strong><code className="node-exact-id">{data.exact}</code>
    {data.references && <div className="atom-preview-refs">{data.references.map((ref,index)=><code key={index} title={ref}>{ref}</code>)}</div>}
    {data.fields && <dl>{data.fields.map(f=><div key={f.name}><dt>{f.name}</dt><dd title={f.value}>{f.value}</dd></div>)}</dl>}
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
function RelationalCanvas({frameSelector,graph,memoryKey,selected,selectedRelation,focus,onInspect,onRelation,draggable=true,whole=false,declaredTypes={},minimapStyle}:{frameSelector?:string;minimapStyle?:CSSProperties;declaredTypes?:Record<string,unknown>;graph:Graph;memoryKey:string;selected:EntityRef|null;selectedRelation:string|null;focus:EntityRef|null;onInspect:(r:EntityRef)=>void;onRelation:(id:string)=>void;draggable?:boolean;whole?:boolean}) {
  const memory=useContext(PresentationMemory);

  const [positions,setPositions]=usePresentationMemory<Record<string,XYPosition>>(`${memoryKey}:positions`,{});
  const [viewport,setViewport]=usePresentationMemory<Viewport>(`${memoryKey}:viewport`,{x:25,y:25,zoom:0.85});
  // Selection does not enter geometric computation. E2-B/P2 is the accepted donor,
  // unchanged; context-sized cards accommodate product domain-qualified identities.
  const base=useMemo(()=>({nodes:graph.records.map(r=>({id:graphEntityKey(r),type:'engineering',position:{x:0,y:0},data:{declaredType:declaredTypes[graphEntityKey(r)],title:r.display_name,family:familyForDomain(r.domain),kind:r.domain,exact:r.id,object:{label:r.display_name,objectId:r.id}}})),edges:graph.relations.map(r=>({id:r.relationship_id,source:graphEntityKey(r.from),target:graphEntityKey(r.to),label:r.relationship_type}))}),[graph,declaredTypes]);
  const initial=useMemo(()=>{return whole?packComponents(componentLayouts(base,component=>initialGeometry(component,'context').map(n=>({...n,position:{...n.position,x:n.position.x*1.25}}))),base.edges):initialGeometry(base,'context');},[base,whole]);
  const placed=useMemo(()=>movedGeometry(initial,positions),[initial,positions]);
  const routed=useMemo(()=>routeGeometry(placed,base.edges),[placed,base]);
  const nodes=placed.map(n=>({...n,measured:{width:n.width,height:n.height},selected:!!selected&&graphEntityKey(selected)===n.id,data:{...n.data,anchor:!!focus&&graphEntityKey(focus)===n.id}}));
  const edges=routed.map(e=>({...e,selected:e.id===selectedRelation,markerEnd:{type:MarkerType.ArrowClosed},style:{stroke:e.id===selectedRelation?'#e6edf3':'#4da8ff',strokeWidth:e.id===selectedRelation?3:1.5}}));
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
    <p className="experience-boundary canvas-help">Scroll to read · drag the background to pan · use + / − to zoom. Layout is presentation only.</p>
    <div className="engineering-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={geometryEdgeTypes} viewport={viewport} onViewportChange={setViewport}
        nodesDraggable={draggable} onNodesChange={changes=>setPositions(p=>changePositions(p,changes))} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={0.2} maxZoom={1.6}

        onNodeClick={(_,n)=>{const r=graph.records.find(r=>graphEntityKey(r)===n.id);if(r)onInspect({domain:r.domain,id:r.id});}}
        onEdgeClick={(_,e)=>onRelation(e.id)} panOnScroll={false} zoomOnScroll={false} zoomOnPinch={false} preventScrolling={false} panOnDrag={true}>
        <ResponsiveGraphFrame selector={frameSelector} nodes={nodes} edges={routed} memoryKey={memoryKey}/><Background gap={22} color="#23425b"/><Controls showInteractive={false}/><MiniMap style={minimapStyle} pannable zoomable nodeColor="#3375a4" maskColor="#04101caa"/>
        <div className="graph-legend" aria-label="Represented node types"><strong>Node types</strong>{[...new Set(graph.records.map(r=>r.domain))].map(d=><span key={d}><FamilyLabel family={familyForDomain(d)}>{d}</FamilyLabel><b>{graph.records.filter(r=>r.domain===d).length}</b></span>)}<small>Declared links only</small></div>
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
  const declaredTypes=useMemo(()=>Object.fromEntries((session.snapshot.model?.subsystems??[]).map(p=>[graphEntityKey({domain:'subsystems',id:p.id}),p.type])),[session]);
  const viewKey=JSON.stringify(['mission',focus,domain,neighbor]);
  return <section className="experience-model mission-model" aria-label="Mission Model">
    <header><p className="eyebrow">UNDERSTAND · CORE DECLARATIONS</p><h2>Mission Model</h2><p>Explore typed objects and their explicit declared relationships.</p>
    </header>
    <div className="experience-tools model-toolbar" aria-label="Mission representation controls">
      <button className="secondary-action" aria-pressed={!focus&&!neighbor} onClick={()=>{setFocus(null);setNeighbor(null);}}>Whole Mission</button>
      <label>Focus <select aria-label="Mission subsystem orientation" value={focus?graphEntityKey(focus):''} onChange={e=>{const r=systems.find(r=>graphEntityKey(r)===e.target.value);setFocus(r?{domain:r.domain,id:r.id}:null);setNeighbor(null);}}><option value="">All declared participants</option>{systems.map(r=><option key={graphEntityKey(r)} value={graphEntityKey(r)}>{r.display_name}</option>)}</select></label>
      <label>Local family <select disabled={!focus||!!neighbor} aria-label="Mission representation" value={domain} onChange={e=>{setDomain(e.target.value);setNeighbor(null);}}>{[...session.readModel.entityRefsByDomain.keys()].map(d=><option key={d}>{d}</option>)}</select></label>
      <button className="secondary-action" disabled={!selected} onClick={()=>setNeighbor(selected)}>Show declared neighbors</button>
      {neighbor&&<button className="secondary-action" onClick={()=>setNeighbor(null)}>Return to family</button>}
      <span className="model-context">{neighbor?`Neighbors · ${neighbor.domain}:${neighbor.id}`:focusRecord?focusRecord.display_name:'Whole Mission'}</span>
    </div>
    <RelationalCanvas minimapStyle={{width:120,height:74}} declaredTypes={declaredTypes} whole={!focus&&!neighbor} key={viewKey} graph={graph} memoryKey={viewKey} selected={selected} selectedRelation={selectedRelation} focus={focus} onInspect={onInspect} onRelation={onRelation}/>
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
  const layout=scenarioAtomLayout(graph.atoms);
  const nodes:Node<CardData>[]=graph.atoms.map((atom,index)=>{
    const p=presentScenarioAtom(atom);
    const box=layout[index],preview=scenarioAtomPreview(atom);
    return {id:atom.id,type:'engineering',position:box.position,width:box.width,height:box.height,measured:{width:box.width,height:box.height},style:{width:box.width,height:box.height},selected:selectedAtom===atom.id,data:{title:p.title,kind:`${String(atom.declarationPosition).padStart(2,'0')} · ${p.role} · DECLARED`,family:familyForScenarioAtom(atom.kind),exact:atom.id,object:{label:p.title,objectId:atom.id},vertical:true,atomRole:atom.role,references:preview.references,fields:preview.fields}};
  });
  // Numbered positions communicate authored order. No invented semantic or causal edges.
  const edges:Edge[]=[];
  return <section className="experience-model scenario-representation" aria-label="Graphical Scenario declaration">
    <div className="experience-tools" role="group" aria-label="Scenario representation"><button className="secondary-action" aria-pressed={view==='declaration'} onClick={()=>setView('declaration')}>Declaration</button><button className="secondary-action" aria-pressed={view==='context'} onClick={()=>setView('context')}>Declared context</button><span>{model.atoms.length} atoms · DECLARED</span></div>
    {view==='declaration'?<>
      <div className="experience-tools"><h3>Authored intent · document order</h3><label>Inspect atom <select aria-label="Inspect atom" value={selectedAtom??''} onChange={e=>{const a=model.atoms.find(a=>a.id===e.target.value);if(a)onInspect(a);}}><option value="">Choose an atom</option>{model.atoms.map(a=><option key={a.id} value={a.id}>{a.declarationPosition} · {presentScenarioAtom(a).title}</option>)}</select></label>
      <button className="secondary-action" disabled={!selectedAtom} onClick={()=>{const n=nodes.find(n=>n.id===selectedAtom);if(n)setViewport({x:30-n.position.x*0.85,y:25-n.position.y*0.85,zoom:0.85});}}>Show inspected atom</button></div>
      <div className="engineering-canvas scenario-engineering-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} viewport={viewport} onViewportChange={setViewport} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={0.25} maxZoom={1.5} onNodeClick={(_,n)=>{const a=model.atoms.find(a=>a.id===n.id);if(a)onInspect(a);}} panOnScroll={false} zoomOnScroll={false} zoomOnPinch={false} preventScrolling={false} panOnDrag={true}><ResponsiveGraphFrame selector=".scenario-engineering-canvas" inset={30} verticalInset={40} nodes={nodes} edges={[]} memoryKey={key}/><Background gap={24}/><Controls showInteractive={false}/><MiniMap style={{width:120,height:74}} pannable zoomable/></ReactFlow></div>
    </>:<>
      <details className="scenario-focus-controls"><summary>Context focus</summary><div className="experience-tools"><label>Context focus <select aria-label="Scenario context focus" value={focus?graphEntityKey(focus):''} onChange={e=>{const p=model.participants.find(p=>graphEntityKey(p.entity)===e.target.value);setFocus(p?.entity??null);}}><option value="">All declared participants</option>{model.participants.map(p=><option key={graphEntityKey(p.entity)} value={graphEntityKey(p.entity)}>{p.entity.domain}:{p.entity.id}</option>)}</select></label><button className="secondary-action" disabled={!selectedEntity||!model.participants.some(p=>graphEntityKey(p.entity)===graphEntityKey(selectedEntity))} onClick={()=>setFocus(selectedEntity)}>Focus inspected participant</button>{focus&&<button className="secondary-action" onClick={()=>setFocus(null)}>Return to Scenario context</button>}{focus&&<span>{`Context focus · ${focus.domain}:${focus.id}`}</span>}</div></details>
      <RelationalCanvas frameSelector=".scenario-representation .engineering-canvas" minimapStyle={{width:120,height:74}} key={`${key}:context:${JSON.stringify(focus)}`} graph={context} memoryKey={`${key}:context:${JSON.stringify(focus)}`} selected={selectedEntity} selectedRelation={selectedRelation} focus={focus} onInspect={onInspectEntity} onRelation={onRelation} draggable={false}/>
      <p className="experience-boundary">Only exact referenced Mission entities and available Core relationships are represented. Scenario roles and witnesses remain in the declaration and Inspector. No inferred state nodes, execution or completeness claim.</p>
    </>}
    <p className="experience-boundary">Numbering is authored order, not time or causality. Expectations are DECLARED, never observed results. Read every field and reference in Declared intent below.</p>
  </section>;
}

// Keep the same relative camera across inspector resizing. Never touch graph identities.
function ResponsiveGraphFrame({nodes,edges,memoryKey,selector=".mission-model .engineering-canvas",inset:requestedInset,verticalInset=80}:{selector?:string;inset?:number;verticalInset?:number;nodes:Node[];edges:ReturnType<typeof routeGeometry>;memoryKey:string}) {
  const flow=useReactFlow();
  const memory=useContext(PresentationMemory);
  useEffect(()=>{
    const canvas=document.querySelector<HTMLElement>(selector);
    if(!canvas)return;
    const frame=()=>{
      if(document.body.hasAttribute("data-studio-capture"))return;
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height||!nodes.length)return;
      const key=`${memoryKey}:frame-size`;
      const previous=memory.get(key) as {width:number;height:number;base:Viewport}|undefined;
      if(previous?.width===width&&previous.height===height)return;
      const points=edges.flatMap(e=>e.data?.geometry?.points??[]);
      const left=Math.min(...nodes.map(n=>n.position.x),...points.map(p=>p.x));
      const top=Math.min(...nodes.map(n=>n.position.y),...points.map(p=>p.y));
      const right=Math.max(...nodes.map(n=>n.position.x+(n.width??300)),...points.map(p=>p.x));
      const bottom=Math.max(...nodes.map(n=>n.position.y+(n.height??150)),...points.map(p=>p.y));
      const inset=requestedInset ?? (width>900?180:145);
      const zoom=Math.max(.2,Math.min(1,(width-inset-35)/Math.max(1,right-left),(height-verticalInset)/Math.max(1,bottom-top)));
      const base={x:inset+(width-inset-35-(right-left)*zoom)/2-left*zoom,y:Math.min(30,verticalInset/2)+(height-verticalInset-(bottom-top)*zoom)/2-top*zoom,zoom};
      let viewport=base;
      if(previous && memory.has(`${memoryKey}:viewport`)) {
        const old=memory.get(`${memoryKey}:viewport`) as Viewport;
        const ratio=base.zoom/previous.base.zoom;
        viewport={x:base.x+(old.x-previous.base.x)*ratio,y:base.y+(old.y-previous.base.y)*ratio,zoom:old.zoom*ratio};
      }
      memory.set(key,{width,height,base});
      void flow.setViewport(viewport);
    };
    const observer=new ResizeObserver(frame);observer.observe(canvas);frame();
    return()=>observer.disconnect();
  },[flow,memory,memoryKey,nodes,edges,selector,requestedInset,verticalInset]);
  return null;
}
