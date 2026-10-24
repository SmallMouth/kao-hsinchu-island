/** Add small thematic scenes inside the expanded perimeter walkway. */
export function addIslandDetails(index, group, { box, mesh, cylinder, sphere, cone, tree, building, accent }) {
  if (index === 7) return;
  const cream = 0xf1e7d2, timber = 0xaf9069, green = 0x87a17b;
  const planter = (x, z) => {
    box(group, 0xd1b796, x, 0.54, z, 0.44, 0.2, 0.32);
    for (let k = 0; k < 3; k++) mesh(group, sphere, k % 2 ? 0xe0b376 : 0xc88f83, x - 0.14 + k * 0.14, 0.7, z, 0.09, 0.12, 0.09);
  };
  // Leave the ring at radius 2.665 unobstructed for walking characters.
  for (const x of [-0.65, 0.65]) {
    box(group, timber, x, 0.65, 2.12, 0.55, 0.09, 0.22);
    box(group, timber, x, 0.83, 2.23, 0.55, 0.26, 0.055);
    for (const dx of [-0.19, 0.19]) box(group, 0x64766b, x + dx, 0.54, 2.12, 0.045, 0.2, 0.16);
  }
  planter(-1.65, -1.5);
  planter(1.7, 1.25);
  tree(group, -1.3, -1.8, 0.7);
  tree(group, 1.35, -1.8, 0.75);
  box(group, 0x76918b, 2.15, 0.69, 0.65, 0.22, 0.5, 0.22);
  box(group, cream, 2.15, 0.96, 0.65, 0.25, 0.05, 0.25);
  if (index === 0) {
    // Public service kiosk and a small circular plaza fountain.
    building(group, 0, -1.95, 1.0, 0.48, 0.7, cream, accent);
    mesh(group, cylinder, 0xd3cbb4, -2.12, 0.53, 0.1, 0.36, 0.16, 0.36);
    mesh(group, cylinder, 0x86b7bd, -2.12, 0.63, 0.1, 0.29, 0.04, 0.29);
    mesh(group, sphere, 0xa5cbca, -2.12, 0.86, 0.1, 0.09, 0.3, 0.09);
  } else if (index === 1) {
    // Playhouse, sandbox and a slide.
    box(group, 0xdfcca3, 0, 0.49, -1.98, 1.4, 0.1, 0.55);
    for (const x of [-0.45, 0.45]) mesh(group, cone, accent, x, 0.7, -1.98, 0.16, 0.35, 0.16);
    box(group, 0xa5bd9b, -2.15, 0.8, -0.1, 0.42, 0.7, 0.55);
    const slide = box(group, 0xdba068, -2.15, 0.75, 0.4, 0.36, 0.07, 0.8);
    slide.rotation.x = 0.55;
  } else if (index === 2) {
    building(group, 0, -1.95, 1.05, 0.48, 0.75, cream, accent);
    for (let i = 0; i < 3; i++) {
      box(group, 0xc9bb9c, -2.1, 0.6, -0.65 + i * 0.5, 0.45, 0.3, 0.32);
      mesh(group, sphere, green, -2.1, 0.84, -0.65 + i * 0.5, 0.2, 0.2, 0.15);
    }
  } else if (index === 3) {
    building(group, 0, -1.95, 1.1, 0.5, 0.85, cream, accent);
    box(group, 0xc89a7d, -2.05, 0.46, 0, 0.65, 0.035, 1.6);
    for (const x of [-2.23, -2.05, -1.87]) box(group, cream, x, 0.485, 0, 0.025, 0.01, 1.5);
  } else if (index === 4 || index === 6) {
    building(group, 0, -1.95, 1.15, 0.5, index === 6 ? 1.25 : 0.9, 0xc6d6d4, accent);
    for (const z of [-0.6, 0, 0.6]) {
      box(group, 0x566f83, -2.12, 1.05, z, 0.48, 0.07, 0.36);
      box(group, 0xa5af9c, -2.12, 0.73, z, 0.06, 0.6, 0.06);
    }
  } else if (index === 5) {
    box(group, 0x869b93, 0, 0.5, -1.95, 1.65, 0.06, 0.6);
    box(group, accent, 0, 1.18, -1.95, 1.7, 0.09, 0.65);
    for (const x of [-0.7, 0.7]) box(group, 0x627e77, x, 0.84, -1.95, 0.06, 0.65, 0.06);
    for (let i = 0; i < 4; i++) box(group, cream, -2.1, 0.47, -0.6 + i * 0.35, 0.55, 0.02, 0.12);
  } else if (index === 8) {
    for (const x of [-0.5, 0.5]) {
      box(group, timber, x, 0.7, -1.95, 0.7, 0.5, 0.5);
      box(group, x < 0 ? accent : green, x, 1.15, -1.95, 0.8, 0.1, 0.65);
      for (let i = 0; i < 3; i++) mesh(group, sphere, i % 2 ? 0xd9b568 : 0xb4775d, x - 0.2 + i * 0.2, 1.0, -1.73, 0.08, 0.08, 0.08);
    }
    building(group, -2.1, 0, 0.5, 0.85, 0.8, cream, accent);
  } else if (index === 9) {
    building(group, 0, -1.95, 1.1, 0.5, 0.75, cream, accent);
    for (const z of [-0.6, 0, 0.6]) {
      mesh(group, cylinder, 0xb76f56, -2.12, 0.65, z, 0.09, 0.4, 0.09);
      box(group, cream, -2.12, 0.8, z, 0.28, 0.07, 0.08);
    }
  } else if (index === 10) {
    box(group, timber, 0, 0.55, -1.95, 1.3, 0.2, 0.6);
    for (const x of [-0.5, 0, 0.5]) {
      box(group, 0x8d9d8c, x, 1.05, -2.1, 0.05, 0.8, 0.05);
      box(group, x === 0 ? accent : 0xa6b9af, x, 1.18, -2.06, 0.36, 0.5, 0.04);
    }
    mesh(group, sphere, 0xc7ac7a, -2.12, 1.0, 0, 0.3, 0.55, 0.3);
    box(group, cream, -2.12, 0.52, 0, 0.55, 0.17, 0.55);
  } else {
    building(group, 0, -1.95, 1.2, 0.5, 0.6, 0xd3d8cb, accent);
    for (let i = 0; i < 3; i++) {
      box(group, timber, -2.1, 0.53 + i * 0.12, 0, 0.55, 0.1, 0.9);
      mesh(group, cone, 0xd79d65, -2.1, 0.6, -0.8 + i * 0.8, 0.1, 0.3, 0.1);
    }
  }
}
