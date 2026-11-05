import type { ComponentProps } from 'react';
import { MissionAtlas } from '../atlas/MissionAtlas';
import { MissionModel } from './EngineeringGraph';
import { usePresentationMemory } from './presentationMemory';

export function MissionPerspective(props:ComponentProps<typeof MissionModel> & {onNavigate:(view:'operations'|'explore'|'relations'|'scenarios'|'integrations'|'evidence')=>void}) {
  const [view,setView]=usePresentationMemory<'atlas'|'model'>('overview:perspective','atlas');
  return <section className={`mission-perspective perspective-${view}`} aria-label="Mission perspectives">
    <div className="experience-tools perspective-switch" aria-label="Overview perspective">
      <button className="secondary-action" aria-pressed={view==='atlas'} onClick={()=>setView('atlas')}>Overview / Atlas</button>
      <button className="secondary-action" aria-pressed={view==='model'} onClick={()=>setView('model')}>Mission Model</button>
      <span>Core declarations · read-only exploration</span>
    </div>
    {view==='atlas'?<MissionAtlas onOpenModel={()=>setView('model')} onNavigate={props.onNavigate} session={props.session} selectedEntity={props.selected} onSelectEntity={props.onInspect}/>:<MissionModel {...props}/>}
  </section>;
}
