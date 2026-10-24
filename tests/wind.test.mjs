import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleWind } from '../src/wind.js';
import { createCityBackdrop } from '../src/city-backdrop.js';

test('gusts remain bounded and integrated drift moves continuously forward', () => {
  let previous = 0;
  for (let t = 0; t < 300; t += 0.05) {
    const wind = sampleWind(t, 3, 7);
    assert.ok(wind.gust >= 0.32 && wind.gust <= 0.98);
    assert.ok(wind.sway >= 0 && wind.sway < 0.15);
    assert.ok(wind.travel >= previous);
    assert.ok(wind.travel - previous < 0.05);
    previous = wind.travel;
  }
});

test('background tree animation is deterministic and does not move buildings or hills', () => {
  const scene = new THREE.Scene();
  const backdrop = createCityBackdrop(scene);
  const meshes = scene.children[0].children;
  const initial = meshes.map(mesh => [...mesh.instanceMatrix.array]);
  backdrop.updateWind(4);
  const windy = meshes.map(mesh => [...mesh.instanceMatrix.array]);
  assert.ok(windy.some((values, index) => values.some((v, j) => v !== initial[index][j])));
  meshes.forEach((mesh, index) => {
    if (![0x6e9471, 0x80a080, 0x9aaf82].includes(mesh.material.color.getHex())) assert.deepEqual(windy[index], initial[index]);
  });
  backdrop.updateWind(4);
  assert.deepEqual(meshes.map(mesh => [...mesh.instanceMatrix.array]), windy);
  backdrop.dispose();
  assert.equal(scene.children.length, 0);
});
