// Bounded presentation measurements, preserved from Experiment 1.
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const rect=n=>({...n.position,width:n.width,height:n.height});
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const hit=(a,b,r)=>a.x===b.x ? a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height : a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width;
const segments=e=>e.data.geometry.points.slice(1).map((b,i)=>[e.data.geometry.points[i],b]).filter(([a,b])=>a.x!==b.x||a.y!==b.y);
function rays(segs,p){
  const dirs=new Set();
  for(const [a,b] of segs){
    if(a.y===b.y&&p.y===a.y&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)){if(Math.min(a.x,b.x)<p.x)dirs.add('L');if(Math.max(a.x,b.x)>p.x)dirs.add('R');}
    if(a.x===b.x&&p.x===a.x&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)){if(Math.min(a.y,b.y)<p.y)dirs.add('U');if(Math.max(a.y,b.y)>p.y)dirs.add('D');}
  }
  return dirs;
}
export function crossingPoints(a,b){
  const as=segments(a),bs=segments(b),points=new Map();
  for(const [p,q] of as)for(const [r,s] of bs){
    if((p.y===q.y)===(r.y===s.y))continue;
    const h=p.y===q.y?[p,q]:[r,s],v=p.x===q.x?[p,q]:[r,s],t={x:v[0].x,y:h[0].y};
    if(t.x<Math.min(h[0].x,h[1].x)||t.x>Math.max(h[0].x,h[1].x)||t.y<Math.min(v[0].y,v[1].y)||t.y>Math.max(v[0].y,v[1].y))continue;
    const x=rays(as,t),y=rays(bs,t);
    if((x.has('L')&&x.has('R')&&y.has('U')&&y.has('D'))||(y.has('L')&&y.has('R')&&x.has('U')&&x.has('D')))points.set(`${t.x},${t.y}`,t);
  }
  return [...points.values()];
}
export function metrics(nodes,edges){
  const byId=new Map(nodes.map(n=>[n.id,n]));
  let inversions=0,crossings=0,localCrossings=0,bends=0,reversals=0,length=0,sharedLength=0,routeNode=0,routeLabel=0,nodeNode=0,labelNode=0,labelLabel=0;
  for(const n of nodes)for(const outgoing of [true,false]){
    const group=edges.filter(e=>e[outgoing?'source':'target']===n.id),point=e=>outgoing?e.data.geometry.points[0]:e.data.geometry.points.at(-1),peer=e=>{const p=byId.get(e[outgoing?'target':'source']);return p.position.y+p.height/2;};
    for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)if((point(group[i]).y-point(group[j]).y)*(peer(group[i])-peer(group[j]))<0)inversions++;
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(overlaps(rect(nodes[i]),rect(nodes[j])))nodeNode++;
  for(const e of edges){
    const segs=segments(e);let last;
    for(const [a,b] of segs){const d=[Math.sign(b.x-a.x),Math.sign(b.y-a.y)];length+=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);if(last&&(last[0]!==d[0]||last[1]!==d[1])){bends++;if(last[0]===-d[0]&&last[1]===-d[1])reversals++;}last=d;}
    for(const n of nodes){if(overlaps(e.data.geometry.label,rect(n)))labelNode++;if(segs.some(([a,b])=>hit(a,b,rect(n))))routeNode++;}
    for(const f of edges)if(f!==e&&segs.some(([a,b])=>hit(a,b,f.data.geometry.label)))routeLabel++;
  }
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const e=edges[i],f=edges[j],pts=crossingPoints(e,f);crossings+=pts.length;
    const zones=[];
    if(e.source===f.source){const n=byId.get(e.source);zones.push({x:n.position.x+n.width,y:n.position.y-14,width:96,height:n.height+28});}
    if(e.target===f.target){const n=byId.get(e.target);zones.push({x:n.position.x-96,y:n.position.y-14,width:96,height:n.height+28});}
    localCrossings+=pts.filter(p=>zones.some(z=>inside(p,z))).length;
    if(overlaps(e.data.geometry.label,f.data.geometry.label))labelLabel++;
    for(const [a,b] of segments(e))for(const [c,d] of segments(f)){
      if(a.y===b.y&&c.y===d.y&&a.y===c.y)sharedLength+=Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));
      if(a.x===b.x&&c.x===d.x&&a.x===c.x)sharedLength+=Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)));
    }
  }
  return {inversions,localCrossings,crossings,nodeNode,labelNode,labelLabel,routeNode,routeLabel,bends,reversals,length:+length.toFixed(2),sharedLength:+sharedLength.toFixed(2)};
}
