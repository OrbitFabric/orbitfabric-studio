import type { ComponentProps } from 'react';
import { MissionAtlas } from '../atlas/MissionAtlas';
import { MissionModel } from './EngineeringGraph';
import { usePresentationMemory } from './presentationMemory';

export function MissionPerspective(props:ComponentProps<typeof MissionModel>) {
  const [view,setView]=usePresentationMemory<'atlas'|'model'>('overview:perspective','atlas');
  return <section aria-label="Mission perspectives">
    <div className="experience-tools perspective-switch" aria-label="Overview perspective">
      <button className="secondary-action" aria-pressed={view==='atlas'} onClick={()=>setView('atlas')}>Overview / Atlas</button>
      <button className="secondary-action" aria-pressed={view==='model'} onClick={()=>setView('model')}>Mission Model</button>
      <span>{props.selected?`Inspected · ${props.selected.domain}:${props.selected.id}`:'Choose a subject in either perspective'}</span>
    </div>
    {view==='atlas'?<MissionAtlas session={props.session} selectedEntity={props.selected} onSelectEntity={props.onInspect}/>:<MissionModel {...props}/>}
  </section>;
}
