import { sampleWind, WIND_DIRECTION } from './wind.js';
import * as THREE from 'three';

/** Stylized river and weather; no live weather or geographic data is used. */
export function createRiverWeather(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const geometries = [], materials = [];
  const material = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
    materials.push(m); return m;
  };
  const center = z => Math.sin(z * 0.065) * 3.5;
  const width = z => 14.5 + Math.cos(z * 0.08) * 1.0;
  function ribbon(inner, outer, color, height) {
    const vertices = [], indices = [];
    for (let i = 0; i <= 100; i++) {
      const z = -75 + i * 1.5;
      for (const edge of [inner, outer]) vertices.push(center(z) + width(z) * edge, height, z);
      if (i < 100) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices); g.computeVertexNormals(); geometries.push(g);
    const m = new THREE.Mesh(g, material(color)); m.receiveShadow = true; root.add(m);
    return m;
  }
  const landGeometry = new THREE.PlaneGeometry(180, 180);
  landGeometry.rotateX(-Math.PI / 2); geometries.push(landGeometry);
  const land = new THREE.Mesh(landGeometry, material(0xa9b79a)); land.position.y = -0.69; root.add(land);
  ribbon(-1.06, 1.06, 0xd1c8a9, -0.64);
  const water = ribbon(-1, 1, 0x6dacae, -0.59);
  water.material.roughness = 0.36; water.material.metalness = 0.12;
  ribbon(-1, -0.96, 0x94c2ba, -0.58);
  ribbon(0.96, 1, 0x94c2ba, -0.58);
  const rippleGeometry = new THREE.BoxGeometry(1, 1, 1); geometries.push(rippleGeometry);
  const rippleMaterial = material(0xc5e1d5, { transparent: true, opacity: 0.5, depthWrite: false });
  const ripples = new THREE.InstancedMesh(rippleGeometry, rippleMaterial, 160);
  root.add(ripples);
  const matrix = new THREE.Object3D();
  let elapsed = 0, mode = 'changing';
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 2); geometries.push(cloudGeometry);
  const cloudMaterial = material(0xf4f6ed, { roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();
    group.position.set(-34 + (i % 5) * 15, 5.5 + (i % 3) * 0.8, -10 - Math.floor(i / 5) * 13);
    for (let puff = 0; puff < 5; puff++) {
      const m = new THREE.Mesh(cloudGeometry, cloudMaterial);
      m.position.set((puff - 2) * 1.1, Math.sin(puff * 1.7 + i) * 0.35, Math.cos(puff * 2) * 0.5);
      m.scale.set(1.5, 0.65 + (puff % 3) * 0.25, 1.05);
      group.add(m);
    }
    root.add(group); clouds.push({ group, x: group.position.x, z: group.position.z });
  }
  function update(dt) {
    elapsed += dt;
    const wind = sampleWind(elapsed);
    const cover = mode === 'sunny' ? 0.1 : mode === 'overcast' ? 0.95 : 0.45 + Math.sin(elapsed / 24) * 0.35;
    cloudMaterial.color.set(0xf7f7ef).lerp(new THREE.Color(0xa4b5bd), cover * 0.65);
    clouds.forEach(({ group }, i) => {
      // Wrap along one diagonal trajectory and fade at its ends, never per axis.
      const distance = (i * 8 + wind.travel * 0.4) % 80;
      const lane = (i % 3 - 1) * 14;
      group.position.x = -24 + distance * WIND_DIRECTION.x + lane * WIND_DIRECTION.z;
      group.position.z = -64 + distance * WIND_DIRECTION.z - lane * WIND_DIRECTION.x;
      const fade = Math.min(1, distance / 6, (80 - distance) / 6);
      group.scale.setScalar((0.65 + cover * 0.65) * fade);
      group.visible = i < 3 + Math.round(cover * 7);
    });
    for (let i = 0; i < 160; i++) {
      const z = ((i * 1.71 + wind.travel * WIND_DIRECTION.z) % 120) - 60;
      const x = ((i * 7.13 + wind.travel * WIND_DIRECTION.x) % 42) - 21;
      const edgeDistance = width(z) - Math.abs(x - center(z));
      const fade = Math.max(0, Math.min(1, edgeDistance / 1.4, (60 - Math.abs(z)) / 3));
      matrix.position.set(x, -0.565, z);
      const shimmer = 0.65 + Math.sin(elapsed * 2.8 + i * 1.7) * 0.3;
      matrix.scale.set((0.025 + wind.gust * 0.035) * fade, 0.01, (0.3 + (i % 5) * 0.2) * shimmer * (0.7 + wind.gust) * fade);
      matrix.rotation.set(0, Math.atan2(WIND_DIRECTION.x, WIND_DIRECTION.z), 0);
      matrix.updateMatrix(); ripples.setMatrixAt(i, matrix.matrix);
    }
    ripples.instanceMatrix.needsUpdate = true;
    // Instances flow through the entire ribbon, so avoid stale instance bounds.
    ripples.frustumCulled = false;
    return cover;
  }
  update(0);
  return {
    update,
    getElapsed() { return elapsed; },
    setWeather(value) { if (['changing', 'sunny', 'overcast'].includes(value)) mode = value; },
    dispose() { scene.remove(root); ripples.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
