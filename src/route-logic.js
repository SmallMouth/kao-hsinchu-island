import { WALK_RADIUS, NEIGHBOR_DISTANCE } from './island-layout.js';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Build perimeter paths and only connect adjacent islands across their shared bridge. */
export function buildWalkGraph(positions, ids) {
  const nodes = [], edges = [], stops = new Map();
  const link = (a, b) => { const cost = distance(nodes[a].point, nodes[b].point); edges[a].push({to:b,cost}); edges[b].push({to:a,cost}); };
  positions.forEach((position, index) => {
    const p = Array.isArray(position) ? position : [position.x, position.y, position.z];
    const base = nodes.length;
    for (let k = 0; k < 12; k++) {
      const angle = k * Math.PI / 6;
      nodes.push({id:nodes.length,island:ids[index],point:[p[0]+WALK_RADIUS*Math.cos(angle),0.51,p[2]+WALK_RADIUS*Math.sin(angle)]});
      edges.push([]);
    }
    for (let k=0;k<12;k++) link(base+k,base+(k+1)%12);
    stops.set(ids[index],base+3);
  });
  positions.forEach((p,i)=>positions.slice(i+1).forEach((q,offset)=>{
    const j=i+offset+1, a=Array.isArray(p)?p:[p.x,p.y,p.z], b=Array.isArray(q)?q:[q.x,q.y,q.z];
    if(distance(a,b)>NEIGHBOR_DISTANCE) return;
    const direction=Math.atan2(b[2]-a[2],b[0]-a[0]);
    const k=((Math.round(direction/(Math.PI/6))%12)+12)%12;
    link(i*12+k,j*12+(k+6)%12);
  }));
  return {nodes,edges,stops};
}
export function shortestPath(graph, from, to) {
  if(!graph.nodes[from]||!graph.nodes[to]) return [];
  const costs=graph.nodes.map(()=>Infinity), previous=graph.nodes.map(()=>null), visited=new Set();
  costs[from]=0;
  while(visited.size<graph.nodes.length){
    let current=-1;
    for(let i=0;i<costs.length;i++) if(!visited.has(i)&&(current<0||costs[i]<costs[current])) current=i;
    if(current<0||!Number.isFinite(costs[current])) return [];
    if(current===to) break;
    visited.add(current);
    for(const edge of graph.edges[current]) if(costs[current]+edge.cost<costs[edge.to]) {costs[edge.to]=costs[current]+edge.cost;previous[edge.to]=current;}
  }
  const path=[];
  for(let current=to;current!==null;current=previous[current]) path.unshift(current);
  return path[0]===from?path:[];
}
export function makeRoute(points, nodeIds=[]) {
  const lengths=[0];
  for(let i=1;i<points.length;i++) lengths.push(lengths[i-1]+distance(points[i-1],points[i]));
  return {points:points.map(p=>[...p]),nodeIds:[...nodeIds],lengths,total:lengths.at(-1)||0};
}
export function routeBetween(graph, from, to) {
  const ids=shortestPath(graph,graph.stops.get(from),graph.stops.get(to));
  return makeRoute(ids.map(id=>graph.nodes[id].point),ids);
}
export function sampleRoute(route, travelled) {
  if(!route.points.length) return {position:[0,0.51,0],direction:[0,0,1],segment:0};
  if(route.points.length===1) return {position:[...route.points[0]],direction:[0,0,1],segment:0};
  const s=Math.min(route.total,Math.max(0,travelled));
  let i=1;
  while(i<route.lengths.length-1&&route.lengths[i]<s) i++;
  const a=route.points[i-1],b=route.points[i],d=route.lengths[i]-route.lengths[i-1],t=d?(s-route.lengths[i-1])/d:0;
  return {position:a.map((value,k)=>value+(b[k]-value)*t),direction:b.map((value,k)=>d?(value-a[k])/d:0),segment:i-1};
}

/** Redirect through the current segment endpoint so a new destination never teleports the avatar. */
export function redirectRoute(graph, route, travelled, target) {
  const sampled=sampleRoute(route,travelled);
  const candidates=[sampled.segment,Math.min(sampled.segment+1,route.points.length-1)]
    .filter(index=>Number.isInteger(route.nodeIds[index]));
  let best=null;
  for(const index of candidates){
    const ids=shortestPath(graph,route.nodeIds[index],graph.stops.get(target));
    if(!ids.length) continue;
    const next=makeRoute([sampled.position,...ids.map(id=>graph.nodes[id].point)],[null,...ids]);
    if(!best||next.total<best.total) best=next;
  }
  return best;
}
