import {metrics} from './geometry-quality.mjs';
// Presentation only. This module never reads or writes engineering state.
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = items => [...items].sort((a, b) => compare(a.id, b.id));
const lines = (text, columns) => Math.max(1, Math.ceil(String(text || '').length / columns));
export function nodeSize(node, surface) {
  const object = node.data.object;
  if (surface === 'operations') return { width: 190, height: 80 };
  if (surface === 'mission') return { width: 280, height: Math.max(112, 64 + lines(object.label, 22) * 23) };
  return { width: 300, height: 80 + lines(object.label, 24) * 23 + lines(object.objectId || object.id, 28) * 19 };
}

// Stable DFS removes feedback arcs ONLY from ranking. All original edges are routed.
// Six median sweeps reduce crossings; neither ranks nor coordinates are domain facts.
export function initialGeometry(graph, surface) {
  const nodes = sorted(graph.nodes), edges = sorted(graph.edges);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) if (byId.has(e.source) && byId.has(e.target)) outgoing.get(e.source).push(e);
  const state = new Map(), order = [], forward = [];
  function visit(id) {
    state.set(id, 1);
    for (const e of outgoing.get(id)) {
      if (state.get(e.target) === 1) continue;
      if (!state.has(e.target)) visit(e.target);
      forward.push(e);
    }
    state.set(id, 2); order.push(id);
  }
  // Sources before other stable IDs makes the layout independent of array insertion order.
  const incoming = new Set(edges.map(e => e.target));
  for (const n of [...nodes.filter(n => !incoming.has(n.id)), ...nodes]) if (!state.has(n.id)) visit(n.id);
  const rank = new Map(nodes.map(n => [n.id, 0]));
  for (const id of order.reverse()) for (const e of forward.filter(e => e.source === id)) rank.set(e.target, Math.max(rank.get(e.target), rank.get(id) + 1));
  const columns = [];
  for (const n of nodes) (columns[rank.get(n.id)] ||= []).push(n);
  for (let sweep = 0; sweep < 6; sweep++) {
    const indices = columns.map((_, i) => i); if (sweep % 2) indices.reverse();
    for (const r of indices) {
      const adjacent = r + (sweep % 2 ? 1 : -1);
      if (!columns[adjacent]) continue;
      const positions = new Map(columns[adjacent].map((n, i) => [n.id, i]));
      const score = n => {
        const neighbors = edges.filter(e => e.source === n.id || e.target === n.id).map(e => e.source === n.id ? e.target : e.source).filter(id => positions.has(id)).map(id => positions.get(id)).sort((a,b)=>a-b);
        return neighbors.length ? neighbors[Math.floor(neighbors.length / 2)] : columns[r].indexOf(n);
      };
      const scores = new Map(columns[r].map(n => [n.id, score(n)]));
      columns[r].sort((a,b)=>scores.get(a.id)-scores.get(b.id)||compare(a.id,b.id));
    }
  }
  const sizes = new Map(nodes.map(n => [n.id, nodeSize(n, surface)]));
  const heights = columns.map(c => c.reduce((h,n)=>h+sizes.get(n.id).height+90,0)-90);
  const maxHeight = Math.max(0,...heights), positions = new Map();
  let x = 50;
  for (let r = 0; r < columns.length; r++) {
    let y = 50 + (maxHeight - heights[r]) / 2;
    for (const n of columns[r]) { positions.set(n.id,{x,y}); y += sizes.get(n.id).height + 90; }
    x += Math.max(...columns[r].map(n=>sizes.get(n.id).width)) + (surface === 'operations' ? 370 : 280);
  }
  return graph.nodes.map(n=>({...n,position:positions.get(n.id),...sizes.get(n.id),style:{...n.style,...sizes.get(n.id)}}));
}

export function movedGeometry(initial, overrides = {}) {
  return initial.map(n=>({...n,position:{...(overrides[n.id] || n.position)}}));
}
export function changePositions(previous, changes) {
  const moved = changes.filter(c=>c.type==='position' && c.position && Number.isFinite(c.position.x) && Number.isFinite(c.position.y));
  return moved.length ? {...previous,...Object.fromEntries(moved.map(c=>[c.id,{x:c.position.x,y:c.position.y}]))} : previous;
}
const box = (n, pad=0) => ({x:n.position.x-pad,y:n.position.y-pad,width:n.width+2*pad,height:n.height+2*pad});
export const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
function blocked(a,b,boxes) {
  return boxes.some(r => a.x === b.x
    ? a.x > r.x && a.x < r.x+r.width && Math.max(a.y,b.y)>r.y && Math.min(a.y,b.y)<r.y+r.height
    : a.y > r.y && a.y < r.y+r.height && Math.max(a.x,b.x)>r.x && Math.min(a.x,b.x)<r.x+r.width);
}
const pointKey = p => `${p.x},${p.y}`;
const simplify = points => points.filter((p,i)=>!i || i===points.length-1 || !((points[i-1].x===p.x && p.x===points[i+1].x)||(points[i-1].y===p.y && p.y===points[i+1].y)));

// Rectilinear visibility grid, shortest path with a bend cost. Reserved label boxes
// are obstacles too. The grid is bounded by the displayed graph, not the whole mission.
function orthogonalPath(start,end,boxes,lane) {
  const xs = [...new Set([start.x,end.x,...boxes.flatMap(b=>[b.x-lane,b.x+b.width+lane])])].sort((a,b)=>a-b);
  const ys = [...new Set([start.y,end.y,...boxes.flatMap(b=>[b.y-lane,b.y+b.height+lane])])].sort((a,b)=>a-b);
  const index = (x,y,d) => (y*xs.length+x)*3+d;
  const startX=xs.indexOf(start.x),startY=ys.indexOf(start.y),endX=xs.indexOf(end.x),endY=ys.indexOf(end.y);
  const dist=new Map(),parent=new Map(),heap=[];
  function push(item) { heap.push(item); let i=heap.length-1; while(i){const p=(i-1)>>1;if(heap[p].cost<=item.cost)break;heap[i]=heap[p];i=p;}heap[i]=item; }
  function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
  const first=index(startX,startY,0);dist.set(first,0);push({x:startX,y:startY,d:0,key:first,cost:0});
  while(heap.length){
    const current=pop();if(current.cost!==dist.get(current.key))continue;
    if(current.x===endX&&current.y===endY){
      const points=[];let k=current.key;
      while(k!==undefined){const cell=Math.floor(k/3);points.push({x:xs[cell%xs.length],y:ys[Math.floor(cell/xs.length)]});k=parent.get(k);}
      return simplify(points.reverse());
    }
    for(const [dx,dy,d] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){
      const x=current.x+dx,y=current.y+dy;if(x<0||y<0||x>=xs.length||y>=ys.length)continue;
      const a={x:xs[current.x],y:ys[current.y]},b={x:xs[x],y:ys[y]};if(blocked(a,b,boxes))continue;
      const key=index(x,y,d),cost=current.cost+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+(current.d&&current.d!==d?28:0);
      if(cost>=(dist.get(key)??Infinity))continue;
      dist.set(key,cost);parent.set(key,current.key);push({x,y,d,key,cost});
    }
  }
  // Drag can deliberately overlap nodes; never invent a different relation or crash.
  return [start,{x:start.x,y:end.y},end];
}

export function routeWithAttachments(nodes, edges, assignment = {}) {
  return routeWithReuse(nodes,edges,assignment);
}

// Reuse is private to one evaluateAttachments call: nodes, edges, labels, lane,
// direction and obstacles are invariant there. Only endpoint coordinates vary.
// No cache survives a call or is accepted from an external caller.
function routeWithReuse(nodes, edges, assignment = {}, reuse) {
  const byId=new Map(nodes.map(n=>[n.id,n])),ordered=sorted(edges),nodeBoxes=nodes.map(n=>box(n,14));
  const labels=[],routes=new Map();
  for(const [i,e] of ordered.entries()){
    const s=byId.get(e.source),t=byId.get(e.target);if(!s||!t)continue;
    const width=Math.max(90,Math.min(320,String(e.label||'').length*8+24));
    const height=22*Math.ceil((String(e.label||'').length*8+1)/(width-20))+12;
    const forward=t.position.x>s.position.x;
    const left=forward?s:t,right=forward?t:s;
    let x=(left.position.x+left.width+right.position.x-width)/2;
    const baseY=(s.position.y+s.height/2+t.position.y+t.height/2)/2-height/2;
    let rect;
    // Stable per-edge label reservation. Reciprocal and parallel labels cannot coincide.
    for(let step=0;!rect;step++){
      const y=baseY+(step===0?0:(step%2?1:-1)*Math.ceil(step/2)*(height+22));
      const candidate={x,y,width,height};
      if(![...nodes.map(n=>box(n,40)),...labels].some(b=>overlaps({...candidate,x:x-16,y:y-12,width:width+32,height:height+24},b)))rect=candidate;
    }
    labels.push(rect);routes.set(e.id,{id:e.id,label:rect,forward,index:i});
  }
  return edges.map(e=>{
    const route=routes.get(e.id);if(!route)return e;
    const s=byId.get(e.source),t=byId.get(e.target);
    // Separate endpoint slots as well as middle lanes, including same-direction parallels.
    const sourceEdges=ordered.filter(other=>other.source===e.source),targetEdges=ordered.filter(other=>other.target===e.target);
    const apply=(group,key)=>{const ids=assignment[key];if(ids)group.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));};
    apply(sourceEdges,JSON.stringify(['source',e.source]));apply(targetEdges,JSON.stringify(['target',e.target]));
    const source={x:s.position.x+s.width,y:s.position.y+s.height*(sourceEdges.findIndex(other=>other.id===e.id)+1)/(sourceEdges.length+1)};
    const target={x:t.position.x,y:t.position.y+t.height*(targetEdges.findIndex(other=>other.id===e.id)+1)/(targetEdges.length+1)};
    const key=reuse && [source.x,source.y,target.x,target.y].map(n=>Object.is(n,-0)?'-0':String(n)).join(',');
    const cached=reuse?.routes.get(e.id)?.get(key);
    if(reuse)reuse.counts.candidateEdgeEvaluations++;
    if(cached){
      reuse.counts.reuseHits++;
      return {...e,type:'geometry',data:{...e.data,geometry:{...cached,label:route.label}}};
    }
    if(reuse){reuse.counts.routeComputations++;reuse.counts.reuseMisses++;}
    const lane=10+route.index*3;
    const start={x:source.x+24,y:source.y},end={x:target.x-24,y:target.y};
    const r=route.label,entry={x:route.forward?r.x-4:r.x+r.width+4,y:r.y+r.height/2},exit={x:route.forward?r.x+r.width+4:r.x-4,y:entry.y};
    const obstacles=[...nodeBoxes,r,...labels.filter(b=>b!==r).map(b=>({...b,x:b.x-4,y:b.y-4,width:b.width+8,height:b.height+8}))];
    const points=simplify([source,...orthogonalPath(start,entry,obstacles,lane),exit,...orthogonalPath(exit,end,obstacles,lane).slice(1),target]);
    const geometry={id:e.id,points,label:r,path:points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')};
    if(reuse){
      if(!reuse.routes.has(e.id))reuse.routes.set(e.id,new Map());
      reuse.routes.get(e.id).set(key,geometry);
    }
    return {...e,type:'geometry',data:{...e.data,geometry}};
  });
}

export function routeBounds(edge) {
  const geometry=edge?.data?.geometry;
  if(!geometry)return null;
  const r=geometry.label,points=[...geometry.points,{x:r.x,y:r.y},{x:r.x+r.width,y:r.y+r.height}];
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}


// E2-B policy is declared before measurement. No factorial enumeration or route-cost change.
export const ATTACHMENT_POLICY = Object.freeze({maxCandidates:256,maxGroups:8,maxDegree:8,adjacentRadius:2});
const assignmentKey = assignment => JSON.stringify(Object.entries(assignment).sort(([a],[b])=>compare(a,b)));
export function attachmentCandidates(nodes, edges) {
  const ordered=sorted(edges),byId=new Map(nodes.map(n=>[n.id,n])),groups=[];
  for(const side of ['source','target'])for(const id of [...byId.keys()].sort(compare)){
    const members=ordered.filter(e=>e[side]===id&&byId.has(e.source)&&byId.has(e.target));
    if(members.length<2)continue;
    const peer=side==='source'?'target':'source';
    const peerSorted=[...members].sort((a,b)=>{
      const na=byId.get(a[peer]),nb=byId.get(b[peer]);
      return (na.position.y+na.height/2)-(nb.position.y+nb.height/2)||compare(a[peer],b[peer])||compare(a.id,b.id);
    });
    groups.push({key:JSON.stringify([side,id]),id:members.map(e=>e.id),peer:peerSorted.map(e=>e.id)});
  }
  const baseline=Object.fromEntries(groups.map(g=>[g.key,g.id]));
  const candidates=[],seen=new Set();
  const add=(name,assignment)=>{
    const key=assignmentKey(assignment);
    if(seen.has(key)||candidates.length>=ATTACHMENT_POLICY.maxCandidates)return;
    seen.add(key);candidates.push({name,key,assignment});
  };
  add('control:id',baseline);
  add('seed:peer',Object.fromEntries(groups.map(g=>[g.key,g.peer])));
  add('seed:reverse-peer',Object.fromEntries(groups.map(g=>[g.key,[...g.peer].reverse()])));
  // Only the first eight eligible groups in stable source/target + node-ID order.
  // Other groups remain ID-ordered in local candidates. Global seeds remain available.
  const eligible=groups.filter(g=>g.id.length<=ATTACHMENT_POLICY.maxDegree).slice(0,ATTACHMENT_POLICY.maxGroups);
  const queues=eligible.map(g=>{
    const variants=[],visited=new Set();
    for(const [seed,order] of [['id',g.id],['peer',g.peer],['reverse-peer',[...g.peer].reverse()]]){
      const seedSeen=new Set();let frontier=[{order,trail:[]}];
      for(let depth=0;depth<=ATTACHMENT_POLICY.adjacentRadius;depth++){
        const next=[];
        for(const item of frontier){
          const key=JSON.stringify(item.order);
          if(seedSeen.has(key))continue;
          seedSeen.add(key);
          if(!visited.has(key))variants.push({name:`local:${g.key}:${seed}:${item.trail.join('.')||'seed'}`,assignment:{...baseline,[g.key]:item.order}});
          visited.add(key);
          if(depth<ATTACHMENT_POLICY.adjacentRadius)for(let i=0;i<item.order.length-1;i++){
            const order=[...item.order];[order[i],order[i+1]]=[order[i+1],order[i]];
            next.push({order,trail:[...item.trail,i+1]});
          }
        }
        frontier=next;
      }
    }
    return variants;
  });
  // Round-robin avoids allowing one group to consume the candidate budget.
  for(let i=0;queues.some(q=>i<q.length)&&candidates.length<ATTACHMENT_POLICY.maxCandidates;i++){
    for(const q of queues)if(q[i])add(q[i].name,q[i].assignment);
  }
  return candidates;
}
const collisionKeys=['nodeNode','labelNode','labelLabel','routeNode','routeLabel'];
export function admissibleQuality(m,baseline) {
  return collisionKeys.every(k=>m[k]===0)&&m.crossings<=baseline.crossings&&m.localCrossings<=baseline.localCrossings&&m.sharedLength<=baseline.sharedLength&&m.bends<=baseline.bends&&m.length<=baseline.length*1.1;
}
export function compareAttachmentScores(a,b) {
  for(const k of ['crossings','localCrossings','sharedLength','bends','length']){
    const delta=a.metrics[k]-b.metrics[k];if(delta)return delta;
  }
  return compare(a.key,b.key);
}
const preservesEdges=(input,output)=>input.length===output.length&&output.every((e,i)=>{
  const original=input[i];
  if(['id','source','target','label'].some(k=>e[k]!==original[k]))return false;
  const {geometry,...data}=e.data||{}, {geometry:prior,...originalData}=original.data||{};
  return JSON.stringify(data)===JSON.stringify(originalData);
});
export function evaluateAttachments(nodes, edges, diagnostics) {
  const counts={candidateEvaluations:0,candidateEdgeEvaluations:0,routeComputations:0,reuseHits:0,reuseMisses:0};
  const reuse={routes:new Map(),counts};
  const candidates=attachmentCandidates(nodes,edges),evaluations=[];
  let winner,control,baseline;
  for(const candidate of candidates){
    counts.candidateEvaluations++;
    const routes=routeWithReuse(nodes,edges,candidate.assignment,reuse),measured=metrics(nodes,routes);
    if(!baseline){baseline=measured;control=routes;}
    const identity=preservesEdges(edges,routes);
    const admissible=identity&&admissibleQuality(measured,baseline);
    const evaluation={name:candidate.name,key:candidate.key,assignment:candidate.assignment,metrics:measured,identity,admissible};
    evaluations.push(evaluation);
    if(admissible&&(!winner||compareAttachmentScores(evaluation,winner)<0))winner={...evaluation,routes};
  }
  // User drag may deliberately overlap nodes. Return the original safe-behavior
  // control if no valid candidate exists, with an explicit invalid disposition.
  if(diagnostics)Object.assign(diagnostics,counts);
  return {routes:winner?.routes||control,selected:winner?.name||'control:id',selectedKey:winner?.key||candidates[0].key,valid:!!winner,baseline,evaluations};
}
export function routeGeometry(nodes,edges) { return evaluateAttachments(nodes,edges).routes; }
