import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { MissionSession } from '../../mission/MissionSession';

import { createSourceRequests, loadSourceCandidate, type SourceKind } from './sourceRequests';
export type { SourceKind } from './sourceRequests';
type Entry = {name:string;path:string;status:string;reason:string|null};
type Inventory = {root:string;entries:Entry[]};
export type SourceLane = {root:string|null;inventory:Inventory|null;pending:boolean;error:string|null};
const empty = ():SourceLane => ({root:null,inventory:null,pending:false,error:null});

// App mounts this hook by Mission generation. It never starts Core or an adapter.
export function useSourceInventory(session:MissionSession) {
  const [lanes,setLanes]=useState<Record<SourceKind,SourceLane>>({scenario:empty(),result:empty(),evidence:empty()});
  const alive=useRef(true);
  const [requests]=useState(createSourceRequests);
  useEffect(()=>{alive.current=true;requests.activate();return()=>{alive.current=false;requests.close();};},[requests]);
  async function refresh(kind:SourceKind,root:string) {
    const ticket=requests.begin(kind);
    setLanes(v=>({...v,[kind]:{root,inventory:null,pending:true,error:null}}));
    try {
      const inventory=await invoke<Inventory>('list_source_files',{root,kind});
      if(requests.accepts(ticket))setLanes(v=>({...v,[kind]:{root:inventory.root,inventory,pending:false,error:null}}));
    }catch(e){if(requests.accepts(ticket))setLanes(v=>({...v,[kind]:{root,inventory:null,pending:false,error:String(e)}}));}
  }
  useEffect(()=>{
    let current=true;
    invoke<string|null>('scenario_source_root',{selectedPath:session.source.selectedPath,missionDir:session.source.missionDir})
      .then(root=>{if(current&&root&&requests.untouched('scenario'))void refresh('scenario',root);})
      .catch(e=>{if(current&&requests.untouched('scenario'))setLanes(v=>({...v,scenario:{...empty(),error:String(e)}}));});
    return()=>{current=false;};
  },[]);
  async function associate(kind:SourceKind) {
    try {
      const root=await open({directory:true,multiple:false,title:`Associate ${kind} source folder with this Mission session`});
      if(alive.current&&typeof root==='string')await refresh(kind,root);
    }catch(e){if(alive.current)setLanes(v=>({...v,[kind]:{...v[kind],error:String(e)}}));}
  }
  async function select(kind:SourceKind,name:string,load:(path:string)=>Promise<void>) {
    const lane=lanes[kind];if(!lane.root)return;
    await loadSourceCandidate(requests,kind,lane.root,name,
      (root,name)=>invoke<string>('resolve_source_file',{root,name}),load,
      error=>setLanes(v=>({...v,[kind]:{...v[kind],error}})));
  }
  return {lanes,refresh,associate,select};
}
export function SourceInventory({kind,lane,onAssociate,onRefresh,onSelect,disabled,selectedPath}:{kind:SourceKind;lane:SourceLane;onAssociate:()=>void;onRefresh:()=>void;onSelect:(name:string)=>void;disabled:boolean;selectedPath?:string|null}) {
  const title=kind==='scenario'?'Scenario sources':kind==='result'?'Retained Result sources':'Retained Evidence sources';
  return <section className="source-inventory" aria-label={title}>
    <header><h2>{title}</h2><div className="experience-tools">
      <button className="secondary-action" disabled={disabled} onClick={onAssociate}>Associate {kind} folder</button>
      {lane.root&&<button className="secondary-action" disabled={disabled||lane.pending} onClick={onRefresh}>Refresh file list</button>}
    </div></header>
    <p>{kind==='scenario'?'Select a file to read its declaration through Core.':'Select a JSON candidate to read it through the existing contract validator.'} File presence establishes no validation, producer identity, execution or assessment.</p>
    {lane.root?<small>Session-associated source folder · direct children only <code>{lane.root}</code></small>:<p>No bounded source folder is linked. Associate one explicitly; unrelated directories are never scanned.</p>}
    {lane.pending&&<p role="status">Reading file inventory…</p>}
    {lane.error&&<p role="alert">Source unavailable: {lane.error}</p>}
    {lane.inventory&&!lane.inventory.entries.length&&<p>No matching file candidates in this root.</p>}
    <ul>{lane.inventory?.entries.map(e=><li key={e.path}><button className="source-candidate" aria-pressed={selectedPath===e.path} disabled={disabled||lane.pending||e.status!=='available'} onClick={()=>onSelect(e.name)}>
      <strong>{e.name.replace(/\.(yaml|yml|json)$/i,'').replace(/[_-]/g,' ')}</strong><code>{e.name}</code><small>{e.status==='available'?'File candidate · not validated':`Unavailable · ${e.reason}`}</small>
    </button></li>)}</ul>
  </section>;
}

const Sources = createContext<ReturnType<typeof useSourceInventory>|null>(null);
export function SourceInventoryProvider({session,children}:{session:MissionSession;children:ReactNode}) {
  const inventory=useSourceInventory(session);
  return <Sources.Provider value={inventory}>{children}</Sources.Provider>;
}
export function SourceBrowser({kind,onLoad,disabled,selectedPath}:{kind:SourceKind;onLoad:(path:string)=>Promise<void>;disabled:boolean;selectedPath?:string|null}) {
  const source=useContext(Sources)!;const lane=source.lanes[kind];
  return <SourceInventory kind={kind} lane={lane} disabled={disabled} selectedPath={selectedPath}
    onAssociate={()=>void source.associate(kind)} onRefresh={()=>{if(lane.root)void source.refresh(kind,lane.root);}}
    onSelect={name=>void source.select(kind,name,onLoad)}/>;
}
