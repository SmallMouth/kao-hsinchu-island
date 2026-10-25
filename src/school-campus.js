import * as THREE from 'three';

/** Courtyard campus with brick facades and a rounded open stair tower. */
export function addSchoolCampus(group, { box, mesh, cylinder, tree, geometry }) {
  const brick = 0xc4937e, edge = 0xe4c3a5, glass = 0x7c9489, paving = 0xb8b7a5;
  function wing(x, z, width, depth, floors, side = false) {
    const height = floors * 0.56;
    box(group, brick, x, 0.43 + height / 2, z, width, height, depth);
    for (let floor = 0; floor < floors; floor++) {
      const y = 0.74 + floor * 0.56;
      if (side) {
        box(group, glass, x - width / 2 - 0.01, y, z, 0.025, 0.27, depth - 0.2);
        for (let p = -depth / 2 + 0.12; p < depth / 2; p += 0.4) box(group, edge, x - width / 2 - 0.03, y, z + p, 0.06, 0.32, 0.06);
      } else {
        box(group, glass, x, y, z + depth / 2 + 0.012, width - 0.18, 0.27, 0.025);
        for (let p = -width / 2 + 0.13; p < width / 2; p += 0.4) box(group, edge, x + p, y, z + depth / 2 + 0.03, 0.055, 0.32, 0.06);
      }
      box(group, edge, x, 0.96 + floor * 0.56, z, width + 0.055, 0.075, depth + 0.055);
      box(group, 0xb78772, x, 0.52 + floor * 0.56, z + depth / 2 + 0.025, width, 0.025, 0.025);
    }
    box(group, edge, x, 0.47 + height, z, width + 0.1, 0.09, depth + 0.1);
    box(group, 0xc5c4af, x, 0.52 + height, z, width - 0.1, 0.025, depth - 0.08);
  }
  wing(0, -1.15, 2.7, 0.65, 3);
  wing(1.32, -0.25, 0.65, 1.75, 3, true);
  wing(-1.25, -0.55, 0.55, 1.0, 2);
  // Floors, open landings and curved parapets expose the central stair tower.
  const parapet = new THREE.CylinderGeometry(0.34, 0.34, 1, 24, 1, true, -Math.PI / 2, Math.PI);
  geometry.add(parapet);
  box(group, edge, 0, 1.73, -0.82, 0.12, 2.6, 0.13);
  for (let level = 0; level < 4; level++) {
    const y = 0.65 + level * 0.65;
    mesh(group, cylinder, edge, 0, y, -0.65, 0.35, 0.075, 0.35);
    mesh(group, parapet, brick, 0, y + 0.17, -0.65, 1, 0.27, 1);
    for (const x of [-0.29, 0.29]) box(group, edge, x, y + 0.35, -0.68, 0.055, 0.55, 0.055);
    if (level < 3) for (let step = 0; step < 5; step++) {
      box(group, 0xb9b9a3, -0.14 + step * 0.06, y + 0.08 + step * 0.105, -0.72, 0.085, 0.045, 0.18);
    }
  }
  mesh(group, cylinder, edge, 0, 3.01, -0.65, 0.37, 0.1, 0.37);
  // Recessed entrance and a planted courtyard follow the photograph's layout.
  box(group, glass, 0, 0.74, -0.79, 0.42, 0.52, 0.035);
  box(group, paving, 0, 0.46, 0.4, 2.1, 0.05, 1.75);
  for (const z of [0.1, 0.85]) {
    box(group, edge, 0, 0.53, z, 0.46, 0.14, 0.4);
    box(group, 0x8ea278, 0, 0.61, z, 0.37, 0.025, 0.31);
    tree(group, 0, z, z < 0.5 ? 0.55 : 0.7);
  }
  for (const x of [-1.7, 1.85]) {
    box(group, edge, x, 0.52, 0.15, 0.35, 0.16, 1.6);
    for (const z of [-0.4, 0.2, 0.8]) tree(group, x, z, x < 0 ? 1.1 : 0.85);
  }
  box(group, 0x82918d, 0, 0.48, 1.65, 3.35, 0.06, 0.45);
  box(group, 0x9db58e, 0, 0.51, 1.25, 3.35, 0.055, 0.32);
  for (let z = 1.45; z < 1.9; z += 0.1) box(group, 0xf8f0da, 0, 0.52, z, 0.6, 0.015, 0.045);
  for (const x of [-1.35, -0.9, 0.9, 1.35]) mesh(group, cylinder, 0xe3ba5e, x, 0.7, 1.36, 0.045, 0.4, 0.045);
}
