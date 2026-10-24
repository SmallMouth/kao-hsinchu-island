import * as THREE from 'three';

/** A stylized urban shoreline, not a reconstruction of geographic coordinates. */
export function createCityBackdrop(scene) {
  const group = new THREE.Group();
  group.name = 'urban-shoreline';
  scene.add(group);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const batches = new Map();
  let seed = 84721;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function add(shape, color, x, y, z, w, h, d, yaw = 0) {
    const key = `${shape}:${color}`;
    if (!batches.has(key)) batches.set(key, { shape, color, items: [] });
    batches.get(key).items.push({ x, y, z, w, h, d, yaw });
  }
  const block = (color, x, y, z, w, h, d, yaw = 0) => add('box', color, x, y, z, w, h, d, yaw);
  const greens = [0x6e9471, 0x80a080, 0x9aaf82];
  function tree(x, z, scale = 1) {
    block(0x8c8975, x, 0.1 + scale * 0.3, z, 0.08, scale * 0.6, 0.08);
    add('crown', greens[Math.floor(random() * greens.length)], x, 0.15 + scale * 0.8, z, scale * 0.5, scale * 0.65, scale * 0.5);
  }
  function building(x, z, w, d, h, glass = false) {
    const color = glass ? 0x799ca5 : [0xe3e5da, 0xf1ede1, 0xd6ddda][Math.floor(random() * 3)];
    block(color, x, 0.15 + h / 2, z, w, h, d);
    block(0xb4bdb4, x, 0.2 + h, z, w + 0.08, 0.1, d + 0.08);
    block(0xd7d9ce, x + w * 0.18, 0.35 + h, z, w * 0.32, 0.22, d * 0.35);
    for (let level = 0.45; level < h; level += 0.44) {
      block(glass ? 0xc3d4d0 : 0x8da7a8, x, level, z + d / 2 + 0.008, w * 0.83, 0.17, 0.018);
      block(glass ? 0xc3d4d0 : 0x8da7a8, x + w / 2 + 0.008, level, z, 0.018, 0.17, d * 0.83);
    }
  }
  // Keep a clear waterfront around the interactive islands and their routes.
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = -6; gz <= 3; gz++) {
      const x = gx * 5.2, z = gz * 5.2;
      if (Math.hypot(x, z) < 17 || Math.hypot(x, z) > 35 || z > 8) continue;
      block(0xb6c3a3, x, -0.18, z, 5.2, 0.55, 5.2);
      block(0xd6d7c7, x, 0.11, z, 4.48, 0.05, 4.48);
      block(0x89958f, x - 2.4, 0.105, z, 0.38, 0.035, 5.2);
      block(0x89958f, x, 0.105, z - 2.4, 5.2, 0.035, 0.38);
      for (let t = -1.8; t <= 1.8; t += 0.9) {
        block(0xe3e2cc, x - 2.4, 0.13, z + t, 0.025, 0.012, 0.34);
        block(0xe3e2cc, x + t, 0.13, z - 2.4, 0.34, 0.012, 0.025);
        tree(x + t, z + 2.02, 0.5 + random() * 0.25);
      }
      const park = (gx + gz * 3) % 5 === 0;
      if (park) {
        block(0x9fb68c, x, 0.15, z, 3.8, 0.08, 3.8);
        block(0xdad8bf, x, 0.2, z, 0.25, 0.025, 3.8);
        for (let i = 0; i < 12; i++) tree(x + (random() - 0.5) * 3.3, z + (random() - 0.5) * 3.3, 0.6 + random() * 0.6);
      } else if ((gx - gz) % 4 === 0) {
        building(x, z - 0.9, 3.5, 1.35, 1.25);
        building(x - 1.1, z + 0.75, 1.25, 1.6, 1.05);
        block(0x8da9a0, x + 0.85, 0.17, z + 0.8, 1.25, 0.06, 1.4);
        block(0xe7e7d4, x + 0.85, 0.21, z + 0.8, 0.035, 0.015, 1.3);
        tree(x + 1.6, z - 0.05, 0.65);
      } else {
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
          const height = 0.65 + random() * 1.6 + (random() > 0.88 ? 1.3 : 0);
          building(x + dx, z + dz, 1.1 + random() * 0.55, 1.1 + random() * 0.55, height, (gx - gz) % 7 === 0);
        }
        tree(x, z, 0.75);
      }
      if ((gx + gz) % 3 === 0) {
        block(0xe7e5da, x - 2.4, 0.24, z + 0.5, 0.19, 0.2, 0.42);
        block(0x75939a, x - 2.4, 0.35, z + 0.5, 0.17, 0.08, 0.22);
      }
    }
  }
  // Layered low hills form a soft horizon behind the campus-like city blocks.
  for (let i = 0; i < 26; i++) {
    const angle = Math.PI + i / 25 * Math.PI;
    const radius = 39 + random() * 4;
    add('crown', [0x92aaa0, 0xa3b7ab, 0x7f9d8d][i % 3], Math.cos(angle) * radius, -1.8, Math.sin(angle) * radius - 4, 6 + random() * 4, 4 + random() * 5, 5 + random() * 4);
  }
  const matrix = new THREE.Object3D();
  const resources = [];
  for (const { shape, color, items } of batches.values()) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const mesh = new THREE.InstancedMesh(shape === 'box' ? box : crown, material, items.length);
    items.forEach((item, index) => {
      matrix.position.set(item.x, item.y, item.z);
      matrix.scale.set(item.w, item.h, item.d);
      matrix.rotation.set(0, item.yaw, 0);
      matrix.updateMatrix();
      mesh.setMatrixAt(index, matrix.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    resources.push(mesh);
  }
  return {
    dispose() {
      scene.remove(group);
      resources.forEach(mesh => { mesh.dispose(); mesh.material.dispose(); });
      box.dispose();
      crown.dispose();
    },
  };
}
