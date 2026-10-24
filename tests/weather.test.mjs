import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRiverWeather } from '../src/river-weather.js';

test('weather and river animation freeze at zero delta and resume without invalid transforms', () => {
  const scene = new THREE.Scene();
  const weather = createRiverWeather(scene);
  const root = scene.children[0];
  const ripples = root.children.find(child => child.isInstancedMesh);
  const before = [...ripples.instanceMatrix.array];
  const cover = weather.update(0);
  assert.equal(weather.update(0), cover);
  assert.deepEqual([...ripples.instanceMatrix.array], before);
  weather.update(1);
  assert.notDeepEqual([...ripples.instanceMatrix.array], before);
  assert.ok([...ripples.instanceMatrix.array].every(Number.isFinite));
  weather.setWeather('sunny');
  const sunny = weather.update(0);
  weather.setWeather('overcast');
  assert.ok(weather.update(0) > sunny);
  weather.dispose();
  assert.equal(scene.children.length, 0);
});

test('clouds and water streaks advect along the same world-space direction', () => {
  const scene = new THREE.Scene();
  const weather = createRiverWeather(scene);
  const root = scene.children[0];
  const clouds = root.children.filter(child => child.isGroup);
  const before = clouds.map(cloud => cloud.position.clone());
  const ripples = root.children.find(child => child.isInstancedMesh);
  const matrix = new THREE.Matrix4();
  const start = new THREE.Vector3();
  ripples.getMatrixAt(1, matrix); start.setFromMatrixPosition(matrix);
  weather.update(0.1);
  clouds.forEach((cloud, i) => {
    const delta = cloud.position.clone().sub(before[i]);
    assert.ok(delta.x > 0 && delta.z > 0);
    assert.ok(Math.abs(delta.x * 0.8 - delta.z * 0.6) < 1e-9);
  });
  ripples.getMatrixAt(1, matrix);
  const delta = new THREE.Vector3().setFromMatrixPosition(matrix).sub(start);
  assert.ok(delta.x > 0 && delta.z > 0);
  assert.ok(Math.abs(delta.x * 0.8 - delta.z * 0.6) < 2e-6);
  weather.dispose();
});
