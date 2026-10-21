// Pack disconnected components for orientation only; preserve all exact edges and
// each connected component's donor geometry. No column denotes ownership or order.
export function packComponents<N extends {id:string;position:{x:number;y:number};width?:number;height?:number}>(nodes:N[],edges:{source:string;target:string}[]):N[] {
  const remaining=new Set(nodes.map(n=>n.id));const groups:N[][]=[];
  while(remaining.size){
    const ids=new Set([remaining.values().next().value!]);let changed=true;
    while(changed){changed=false;for(const e of edges)if(ids.has(e.source)||ids.has(e.target))for(const id of [e.source,e.target])if(remaining.has(id)&&!ids.has(id)){ids.add(id);changed=true;}}
    const group=nodes.filter(n=>ids.has(n.id));groups.push(group);for(const n of group)remaining.delete(n.id);
  }
  if(groups.length<3)return nodes;
  const columns=2;let x=30,y=30,rowHeight=0;
  return groups.flatMap((group,i)=>{
    const left=Math.min(...group.map(n=>n.position.x)),top=Math.min(...group.map(n=>n.position.y));
    const width=Math.max(...group.map(n=>n.position.x+(n.width??300)))-left;
    const height=Math.max(...group.map(n=>n.position.y+(n.height??150)))-top;
    if(i%columns===0&&i){y+=rowHeight+100;x=30;rowHeight=0;}
    const placed=group.map(n=>({...n,position:{x:n.position.x-left+x,y:n.position.y-top+y}}));
    x+=width+150;rowHeight=Math.max(rowHeight,height);return placed;
  });
}
