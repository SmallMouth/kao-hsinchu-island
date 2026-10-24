import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWalkGraph, routeBetween, sampleRoute, redirectRoute } from '../src/route-logic.js';
import {createCityLife,normalizeAvatar,DEFAULT_AVATAR,FLOWS} from '../src/city-life.js';
import { ISLAND_POSITIONS as positions } from '../src/island-layout.js';
const categories=positions.map((_,i)=>({id:`c${i+1}`,title:`主題${i+1}`}));
const graph=buildWalkGraph(positions,categories.map(c=>c.id));
const equalPoint=(a,b)=>a.forEach((value,index)=>assert.ok(Math.abs(value-b[index])<1e-9));
const life=()=>createCityLife({THREE,scene:new THREE.Scene(),positions:positions.map(p=>new THREE.Vector3(...p)),categories});

test('every illustrative flow follows connected walkway edges rather than straight lines across water',()=>{
  for(const flow of FLOWS){
    const route=routeBetween(graph,flow.from,flow.to);
    assert.ok(route.total>0);
    assert.equal(route.nodeIds[0],graph.stops.get(flow.from));assert.equal(route.nodeIds.at(-1),graph.stops.get(flow.to));
    for(let i=1;i<route.nodeIds.length;i++)assert.ok(graph.edges[route.nodeIds[i-1]].some(edge=>edge.to===route.nodeIds[i]));
    assert.equal(flow.basis,'視覺示意，非經查證政策關係');
  }
});
test('redirecting repeatedly while between nodes preserves the current position',()=>{
  const first=routeBetween(graph,'c1','c12');
  const second=redirectRoute(graph,first,.17,'c7');
  equalPoint(second.points[0],sampleRoute(first,.17).position);
  assert.equal(second.nodeIds[0],null);
  const third=redirectRoute(graph,second,.03,'c3');
  equalPoint(third.points[0],sampleRoute(second,.03).position);
  assert.equal(third.nodeIds.at(-1),graph.stops.get('c3'));
});
test('NPCs arrive, wait, then reverse without moving while paused',()=>{
  const city=life();let person=city.getSnapshot().people[0];
  for(let tick=0;tick<3000&&person.state!=='waiting';tick++){city.update(.1);person=city.getSnapshot().people[0];}
  assert.equal(person.state,'waiting');
  const frozen=city.getSnapshot();city.update(0);assert.deepEqual(city.getSnapshot(),frozen);
  for(let i=0;i<20;i++)city.update(.1);
  const returning=city.getSnapshot().people[0];assert.equal(returning.state,'walking');assert.ok(returning.progress<1);
  assert.ok(city.getSnapshot().logs.some(entry=>entry.text.includes('抵達')));city.dispose();
});
test('avatar changes do not teleport; all pose, progress and logs freeze at dt zero',()=>{
  const city=life();city.moveAvatar('c12');for(let i=0;i<20;i++)city.update(.1);
  const before=city.getAvatarPosition();city.moveAvatar('c5');equalPoint(city.getAvatarPosition().toArray(),before.toArray());
  city.update(.05);const next=city.getAvatarPosition();city.moveAvatar('c3');equalPoint(city.getAvatarPosition().toArray(),next.toArray());
  const frozen=city.getSnapshot();city.update(0);assert.deepEqual(city.getSnapshot(),frozen);
  city.setAvatarAuto(true);assert.equal(city.getSnapshot().avatar.auto,true);city.dispose();
});
test('invalid saved avatar input is normalized and appearance ranges are bounded',()=>{
  assert.deepEqual(normalizeAvatar(null),DEFAULT_AVATAR);
  const actual=normalizeAvatar({name:'x'.repeat(100),role:'__proto__',skin:'bad',shirt:'javascript:alert(1)',height:9,width:-2,hat:'invalid',accessory:'invalid',face:'invalid'});
  assert.equal(actual.name.length,24);assert.equal(actual.role,'citizen');assert.equal(actual.skin,DEFAULT_AVATAR.skin);assert.equal(actual.shirt,DEFAULT_AVATAR.shirt);assert.equal(actual.height,1.4);assert.equal(actual.width,.7);assert.equal(actual.hat,'none');assert.equal(actual.face,'none');
});
test('flow hiding removes selected lines and photo pose waits for arrival',()=>{
  const city=life();city.selectFlow('f1');assert.equal(city.getFlowPickables().length,10);city.setFlowVisible(false);assert.equal(city.getFlowPickables().length,0);
  city.poseAvatar({categoryId:'c2',pose:'wave',yaw:1});assert.equal(city.getSnapshot().avatar.pose,null);
  for(let i=0;i<3000&&city.getSnapshot().avatar.state!=='idle';i++)city.update(.1);
  assert.equal(city.getSnapshot().avatar.pose,'wave');city.moveAvatar('c1');assert.equal(city.getSnapshot().avatar.pose,null);city.dispose();
});

test('expanded island layout keeps perimeter paths on land and all islands reachable',()=>{
  const radius = 2.49 * 1.3;
  for (const [index, center] of positions.entries()) {
    const ring = graph.nodes.slice(index * 12, index * 12 + 12);
    for (const node of ring) {
      const x = node.point[0] - center[0], z = node.point[2] - center[2];
      assert.ok(Math.hypot(x, z) + 0.11 < radius * Math.cos(Math.PI / 6));
    }
    for (const target of categories) assert.ok(routeBetween(graph, categories[index].id, target.id).points.length > 0);
  }
});
