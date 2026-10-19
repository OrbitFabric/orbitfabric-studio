import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type NodeProps, type Node, type Viewport } from '@xyflow/react';
import type { MissionSession } from '../../mission/MissionSession';
import { entityKey, type EntityRef } from '../../mission/entityRef';
import type { ScenarioUnderstandingModel, ScenarioAtomUnderstanding } from '../../convergence/scenarioUnderstanding';
import { presentScenarioAtom } from '../scenarios/scenarioPresentation';
import { FamilyLabel } from '../presentation/FamilyLabel';
import { familyForDomain, familyForScenarioAtom, type DisplayFamily } from '../presentation/familyMarkers';
import { authoredGraph, missionGraph } from './graphModel';

type CardData = { title: string; family: DisplayFamily | null; kind: string; exact: string; detail: string; vertical?: boolean };
function EngineeringNode({data, selected}: NodeProps<Node<CardData>>) {
  return <article className={`engineering-node${selected ? ' is-selected' : ''}`}>
    <Handle type="target" position={data.vertical ? Position.Top : Position.Left} isConnectable={false}/>
    <small><FamilyLabel family={data.family}>{data.kind}</FamilyLabel></small><strong>{data.title}</strong>
    <code>{data.exact}</code><p>{data.detail}</p>
    <Handle type="source" position={data.vertical ? Position.Bottom : Position.Right} isConnectable={false}/>
  </article>;
}
const nodeTypes = { engineering: EngineeringNode };
export function MissionModel({session, selected, onInspect, onRelation}: {session: MissionSession; selected: EntityRef | null; onInspect:(ref:EntityRef)=>void; onRelation:(id:string)=>void}) {
  const [domain, setDomain] = useState('subsystems');
  const [anchor, setAnchor] = useState<EntityRef | null>(null);
  const [viewport, setViewport] = useState<Viewport>({x:35,y:35,zoom:.85});
  const graph = useMemo(() => missionGraph(session, domain, anchor), [session,domain,anchor]);
  const nodes = graph.records.map((r,i) => ({id:entityKey(r), type:'engineering', position:{x:(i%3)*330,y:Math.floor(i/3)*210},
    selected:!!selected && entityKey(selected)===entityKey(r), data:{title:r.display_name, family:familyForDomain(r.domain),kind:r.domain,exact:r.id,detail:r.provenance}}));
  const edges = graph.relations.map(r => ({id:r.relationship_id, source:entityKey(r.from),target:entityKey(r.to), label:r.relationship_type,markerEnd:{type:MarkerType.ArrowClosed}}));
  return <section className="experience-model" aria-label="Mission Model">
    <header><div><p className="eyebrow">UNDERSTAND · CORE DECLARATIONS</p><h2>Mission Model</h2><p>Explore typed objects and their explicit declared relationships.</p></div></header>
    <div className="experience-tools"><label>Representation <select value={domain} onChange={e=>{setDomain(e.target.value);setAnchor(null);}}>{[...session.readModel.entityRefsByDomain.keys()].map(d=><option key={d}>{d}</option>)}</select></label>
      <button className="secondary-action" disabled={!selected} onClick={()=>setAnchor(selected)}>Show declared neighbors</button>
      {anchor && <button className="secondary-action" onClick={()=>setAnchor(null)}>Return to family</button>}
      <span>{graph.records.length} represented / {graph.total} indexed · {graph.unresolved} unresolved endpoints</span>
    </div>
    <div className="engineering-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} viewport={viewport} onViewportChange={setViewport}
      nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={.25} maxZoom={1.6}
      onNodeClick={(_,n)=>{const r=graph.records.find(r=>entityKey(r)===n.id);if(r)onInspect({domain:r.domain,id:r.id});}}
      onEdgeClick={(_,e)=>onRelation(e.id)}><Background gap={24}/><Controls showInteractive={false}/></ReactFlow></div>
    <p className="experience-boundary">Arrows are Core relationships, not causality. Family and neighborhood change representation, not investigation Scope. Relations readiness: {session.readiness.relationships}.</p>
    <details><summary>Read displayed relationships ({graph.relations.length})</summary>{graph.relations.map(r=><button className="experience-relation" key={r.relationship_id} onClick={()=>onRelation(r.relationship_id)}>{r.from.domain}:{r.from.id} → {r.relationship_type} → {r.to.domain}:{r.to.id}</button>)}</details>
  </section>;
}
export function ScenarioGraph({model, selectedAtom, onInspect}: {model:ScenarioUnderstandingModel;selectedAtom:string|null;onInspect:(atom:ScenarioAtomUnderstanding)=>void}) {
  const graph = authoredGraph(model);
  const [viewport,setViewport] = useState<Viewport>({x:40,y:25,zoom:.9});
  const nodes = graph.atoms.map((atom,i)=>{const p=presentScenarioAtom(atom);return {id:atom.id,type:'engineering',position:{x:70,y:i*230},selected:selectedAtom===atom.id,
    data:{title:p.title,kind:`${p.role} · ${p.declaredTime ?? 'DECLARED'}`,family:familyForScenarioAtom(atom.kind),exact:atom.id,detail:p.fields.map(f=>`${f.name}: ${f.value}`).join(' · '),vertical:true}};});
  const edges=graph.order.map(o=>({id:JSON.stringify([o.from,o.to]),source:o.from,target:o.to,label:'Authored order',markerEnd:{type:MarkerType.ArrowClosed}}));
  return <section className="experience-model" aria-label="Graphical Scenario declaration"><div className="experience-tools"><h3>Authored declaration</h3><label>Inspect atom <select value={selectedAtom??''} onChange={e=>{const a=model.atoms.find(a=>a.id===e.target.value);if(a)onInspect(a);}}><option value="">Choose an atom</option>{model.atoms.map(a=><option key={a.id} value={a.id}>{a.declarationPosition} · {presentScenarioAtom(a).title}</option>)}</select></label><span>{model.atoms.length} atoms · DECLARED</span></div>
    <div className="engineering-canvas scenario-engineering-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} viewport={viewport} onViewportChange={setViewport} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={.25} maxZoom={1.5}
      onNodeClick={(_,n)=>{const a=model.atoms.find(a=>a.id===n.id);if(a)onInspect(a);}}><Background gap={24}/><Controls showInteractive={false}/></ReactFlow></div>
    <p className="experience-boundary">Order follows the Core declaration. Expected effects are authored intent, never observed behavior. Full fields and all references remain below.</p>
  </section>;
}
