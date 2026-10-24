import * as THREE from 'three';

/** A compact ballpark inspired by the supplied aerial photograph. */
export function addBaseballStadium(group, { box, mesh, cylinder, geometry }) {
  const turf = 0x6e9e59, clay = 0xb95e49, chalk = 0xf8efda;
  function surface(points, color, height) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    geometry.add(geo);
    return mesh(group, geo, color, 0, height, 0, 1, 1, 1);
  }
  function line(ax, az, bx, bz, color = chalk, width = 0.025, height = 0.515) {
    const part = box(group, color, (ax + bx) / 2, height, (az + bz) / 2, width, 0.015, Math.hypot(bx - ax, bz - az));
    part.rotation.y = Math.atan2(bx - ax, bz - az);
  }
  mesh(group, cylinder, 0xc8c6b6, 0, 0.47, -0.1, 2.43, 0.08, 2.22);
  mesh(group, cylinder, clay, 0, 0.515, -0.1, 2.04, 0.025, 1.87);
  const homeZ = 1.15;
  const field = [[0, homeZ]];
  for (let i = 0; i <= 48; i++) {
    const angle = -Math.PI / 4 + i / 48 * Math.PI / 2;
    field.push([Math.sin(angle) * 2.65, homeZ - Math.cos(angle) * 2.65]);
  }
  surface(field, turf, 0.54);
  // Clip mowing stripes to the fan-shaped field, keeping the warning track clear.
  function clip(points, boundary, greater) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const insideA = greater ? a[0] >= boundary : a[0] <= boundary;
      const insideB = greater ? b[0] >= boundary : b[0] <= boundary;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (boundary - a[0]) / (b[0] - a[0]);
        result.push([boundary, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return result;
  }
  for (let x = -1.9; x < 1.9; x += 0.46) {
    const stripe = clip(clip(field, x, true), x + 0.23, false);
    if (stripe.length >= 3) surface(stripe, 0x91ad61, 0.545);
  }
  surface([[0, 1.3], [-1.0, 0.35], [0, -0.65], [1.0, 0.35]], clay, 0.56);
  surface([[0, 1.08], [-0.73, 0.35], [0, -0.38], [0.73, 0.35]], turf, 0.57);
  for (const [x, z] of [[-0.8, 0.35], [0, -0.45], [0.8, 0.35]]) {
    mesh(group, cylinder, 0xd9af82, x, 0.58, z, 0.16, 0.018, 0.16);
    box(group, chalk, x, 0.6, z, 0.09, 0.025, 0.09).rotation.y = Math.PI / 4;
  }
  mesh(group, cylinder, 0xd6a578, 0, 0.59, 0.35, 0.2, 0.045, 0.2);
  box(group, chalk, 0, 0.62, 0.35, 0.105, 0.012, 0.035);
  mesh(group, cylinder, 0xd6a578, 0, 0.57, homeZ, 0.3, 0.025, 0.3);
  surface([[-0.06, 1.1], [0.06, 1.1], [0.06, 1.18], [0, 1.23], [-0.06, 1.18]], chalk, 0.6);
  for (const x of [-0.16, 0.16]) {
    line(x - 0.05, 1.05, x + 0.05, 1.05, chalk, 0.012, 0.6);
    line(x - 0.05, 1.28, x + 0.05, 1.28, chalk, 0.012, 0.6);
    for (const dx of [-0.05, 0.05]) line(x + dx, 1.05, x + dx, 1.28, chalk, 0.012, 0.6);
  }
  for (const side of [-1, 1]) {
    line(0, homeZ, side * 1.9, -0.75, chalk, 0.018, 0.605);
    mesh(group, cylinder, 0xe9c368, side * 1.9, 1.1, -0.75, 0.018, 1.05, 0.018);
    box(group, 0x6c8586, side * 1.18, 0.77, 0.98, 0.5, 0.3, 0.23).rotation.y = side * -0.65;
  }
  // Tiered seating is split into sections with red access stairs.
  for (let section = 0; section < 32; section++) {
    const angle = section / 32 * Math.PI * 2;
    for (let tier = 0; tier < 4; tier++) {
      const radius = 2.08 + tier * 0.095;
      const stand = box(group, section % 8 === 0 ? clay : 0x9eafb2,
        Math.sin(angle) * radius, 0.62 + tier * 0.13,
        Math.cos(angle) * radius * 0.9 - 0.1, 0.37, 0.12, 0.12);
      stand.rotation.y = angle;
      if (section % 8 !== 0) {
        const seats = box(group, 0xd5ddda, Math.sin(angle) * radius, 0.72 + tier * 0.13,
          Math.cos(angle) * radius * 0.9 - 0.1, 0.34, 0.055, 0.06);
        seats.rotation.y = angle;
      }
    }
  }
  box(group, 0x455e65, 0, 1.25, -2.13, 0.95, 0.58, 0.12);
  box(group, 0x233c44, 0, 1.28, -2.05, 0.81, 0.36, 0.025);
  for (let i = 0; i < 5; i++) box(group, chalk, -0.28 + i * 0.14, 1.29, -2.03, 0.06, 0.09, 0.015);
  for (const [x, z] of [[-1.75, -1.45], [1.75, -1.45], [-1.75, 1.25], [1.75, 1.25]]) {
    mesh(group, cylinder, 0x758885, x, 1.4, z, 0.035, 1.85, 0.035);
    box(group, 0x657875, x, 2.34, z, 0.48, 0.2, 0.1);
    for (let k = 0; k < 4; k++) box(group, 0xffedc1, x - 0.17 + k * 0.115, 2.34, z + 0.06, 0.075, 0.11, 0.035, 'window');
  }
}
