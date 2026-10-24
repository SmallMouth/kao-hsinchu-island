import { sampleTreeWind, WIND_DIRECTION } from './wind.js';
import { createRiverWeather } from './river-weather.js';
import { addBaseballStadium } from './baseball-stadium.js';
import { addIslandDetails } from './island-details.js';
import { ISLAND_SCALE, ISLAND_POSITIONS, NEIGHBOR_DISTANCE } from './island-layout.js';
import * as THREE from 'three';
import { createCityLife } from './city-life.js';
import { createCityBackdrop } from './city-backdrop.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const SHORT_NAMES = ['財政民生', '育兒家庭', '敬老健康', '教育校園', '青年發展', '交通運輸', '數位市政', '環境休閒', '市場產業', '城市安全', '文化觀光', '推動中'];
const COLORS = [0xd9ae67, 0xe5a79d, 0x95b6b1, 0xdab46e, 0x9bafcd, 0x80aaa7, 0xa2afc4, 0x8ba77d, 0xcb9c7b, 0xd28d7d, 0xc5afa0, 0xb3b1a0];

/** Build an illustrative city; island positions do not represent actual geography. */
export function createIslandScene(container, categories, onSelect) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8cfca, 48, 115);
  const backdrop = createCityBackdrop(scene);
  let following = null, pickMode = false, photoMode = false;
  let showLabels = true, showFlows = false, showCarry = true;
  let life;
  const emit = (name, detail) => container.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  function chooseCategory(id) {
    if (pickMode) {
      life?.moveAvatar(id);
      setPickMode(false);
      followPerson('avatar');
      emit('city-destination', { categoryId: id });
    } else onSelect(id);
  }
  function setPickMode(value) {
    pickMode = Boolean(value);
    renderer.domElement.style.cursor = pickMode ? 'crosshair' : '';
    emit('city-mode', { pickMode });
  }
  function followPerson(id) {
    following = id && life?.getPersonPosition(id) ? id : null;
    document.body.classList.toggle('following-person', Boolean(following));
    controls.minDistance = following ? 2 : 10;
    if (following) {
      const target = life.getPersonPosition(following).clone().add(new THREE.Vector3(0, 0.7, 0));
      moveTo(target.clone().add(new THREE.Vector3(3, 4.5, 5)), target);
    }
    emit('city-follow', { following });
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-label', '互動城市示意圖；拖曳旋轉、滾輪縮放，亦可使用主題清單探索');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = 'none';
  container.append(renderer.domElement);
  const labels = new CSS2DRenderer();
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
  container.append(labels.domElement);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 220);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.minDistance = 10;
  controls.maxDistance = 65;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hemisphere = new THREE.HemisphereLight(0xf6fbff, 0x667859, 2.8);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.4);
  sun.position.set(-12, 25, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const materials = new Map();
  const geometry = new Set();
  const material = (color, extra = '') => {
    const key = `${color}:${extra}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...(extra === 'window' ? { emissive: 0xffdb83, emissiveIntensity: 0.12 } : {}) }));
    return materials.get(key);
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 7);
  const hex = new THREE.CylinderGeometry(1, 1, 1, 6);
  [cube, cylinder, sphere, cone, hex].forEach(g => geometry.add(g));
  function mesh(parent, shape, color, x, y, z, sx, sy, sz, extra = '') {
    const m = new THREE.Mesh(shape, material(color, extra));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (p, c, x, y, z, w, h, d, extra) => mesh(p, cube, c, x, y, z, w, h, d, extra);
  const grass = 0xb9c69b, cream = 0xf3e8d6, roof = 0xb16e55, ink = 0x52696b;
  const groundY = 0.43;
  const windTrees = [];
  function tree(parent, x, z, scale = 1) {
    const pivot = new THREE.Group();
    pivot.position.set(x, groundY, z);
    parent.add(pivot);
    mesh(pivot, cylinder, 0x99846a, 0, 0.25 * scale, 0, 0.055 * scale, 0.5 * scale, 0.055 * scale);
    const upper = new THREE.Group();
    upper.position.y = 0.48 * scale;
    pivot.add(upper);
    mesh(upper, cylinder, 0x99846a, 0, 0.24 * scale, 0, 0.04 * scale, 0.5 * scale, 0.04 * scale);
    const branches = [];
    for (let i = 0; i < 3; i++) {
      const branch = new THREE.Group();
      const angle = i * Math.PI * 2 / 3;
      branch.position.set(0, (0.18 + i * 0.12) * scale, 0);
      upper.add(branch);
      const dx = Math.cos(angle) * 0.23 * scale, dz = Math.sin(angle) * 0.23 * scale;
      const twig = mesh(branch, cylinder, 0x8b8065, dx * 0.5, 0.12 * scale, dz * 0.5, 0.025 * scale, 0.34 * scale, 0.025 * scale);
      twig.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0.24 * scale, dz).normalize());
      mesh(branch, sphere, [0x729761, 0x8caa73, 0xa3b982][i], dx, 0.28 * scale, dz, 0.31 * scale, 0.36 * scale, 0.27 * scale);
      branches.push(branch);
    }
    mesh(upper, sphere, 0x8ba971, 0, 0.75 * scale, 0, 0.25 * scale, 0.34 * scale, 0.23 * scale);
    windTrees.push({ pivot, upper, branches, x: x + parent.position.x, z: z + parent.position.z });
  }

  function building(parent, x, z, w, d, h, color = cream, top = roof) {
    box(parent, color, x, groundY + h / 2, z, w, h, d);
    box(parent, top, x, groundY + h + 0.09, z, w + 0.12, 0.18, d + 0.12);
    for (let level = 0; level < Math.max(1, Math.floor(h / 0.48)); level++) {
      for (let col = 0; col < Math.max(1, Math.floor(w / 0.4)); col++) {
        const px = x - w / 2 + 0.23 + col * 0.4;
        box(parent, 0x6f9298, px, groundY + 0.3 + level * 0.48, z + d / 2 + 0.012, 0.18, 0.21, 0.025, 'window');
      }
    }
    return h;
  }
  function pavilion(parent, x, z, color, s = 1) {
    box(parent, cream, x, groundY + 0.42 * s, z, 0.9 * s, 0.84 * s, 0.75 * s);
    const m = mesh(parent, cone, color, x, groundY + 1.02 * s, z, 0.8 * s, 0.5 * s, 0.7 * s);
    m.rotation.y = Math.PI / 4;
  }
  function car(parent, x, z, color, rotation = 0) {
    const carGroup = new THREE.Group();
    carGroup.position.set(x, groundY + 0.05, z);
    carGroup.rotation.y = rotation;
    parent.add(carGroup);
    box(carGroup, color, 0, 0.13, 0, 0.3, 0.2, 0.55);
    box(carGroup, 0xe6ece2, 0, 0.27, -0.02, 0.25, 0.14, 0.28);
    for (const dx of [-0.16, 0.16]) for (const dz of [-0.17, 0.17]) {
      const wheel = mesh(carGroup, cylinder, 0x4a5555, dx, 0.09, dz, 0.07, 0.04, 0.07);
      wheel.rotation.z = Math.PI / 2;
    }
    return carGroup;
  }
  function lamp(parent, x, z) {
    mesh(parent, cylinder, 0x6e7974, x, 0.96, z, 0.025, 1.05, 0.025);
    box(parent, 0xffe5af, x, 1.52, z, 0.17, 0.13, 0.17, 'window');
    box(parent, 0x6e7974, x, 1.61, z, 0.22, 0.05, 0.22);
  }
  const positions = ISLAND_POSITIONS.map(p => new THREE.Vector3(...p));
  const islandGroups = new Map();
  const labelButtons = [];
  const pickables = [];
  const moving = [];
  const roads = new THREE.Group();
  scene.add(roads);
  positions.forEach((p, i) => positions.slice(i + 1).forEach(other => {
    const distance = p.distanceTo(other);
    if (distance > NEIGHBOR_DISTANCE) return;
    const mid = p.clone().add(other).multiplyScalar(0.5);
    const road = box(roads, 0xd3cfbd, mid.x, 0.39, mid.z, 0.48, 0.15, distance);
    road.rotation.y = Math.atan2(other.x - p.x, other.z - p.z);
    const stripe = box(roads, 0xf2eee2, mid.x, 0.475, mid.z, 0.025, 0.015, distance);
    stripe.rotation.y = road.rotation.y;
  }));

  categories.forEach((category, index) => {
    const p = positions[index % positions.length];
    const group = new THREE.Group();
    group.position.copy(p);
    group.userData.categoryId = category.id;
    scene.add(group);
    islandGroups.set(category.id, group);
    const base = mesh(group, hex, 0xd5c3a2, 0, -0.05, 0, 2.54 * ISLAND_SCALE, 0.78, 2.54 * ISLAND_SCALE);
    base.rotation.y = Math.PI / 6;
    const lawn = mesh(group, hex, index === 11 ? 0xc5c2a5 : grass, 0, 0.35, 0, 2.49 * ISLAND_SCALE, 0.13, 2.49 * ISLAND_SCALE);
    lawn.rotation.y = Math.PI / 6;
    const curb = mesh(group, hex, 0xe6ddc4, 0, 0.24, 0, 2.56 * ISLAND_SCALE, 0.09, 2.56 * ISLAND_SCALE);
    curb.rotation.y = Math.PI / 6;
    const accent = COLORS[index % COLORS.length];
    if (index !== 7) {
      box(group, 0xe1dcc8, 0, 0.435, 0.05, 4.8, 0.035, 0.32);
      box(group, 0xe1dcc8, -0.15, 0.44, 0, 0.3, 0.035, 4.6);
    }
    if (index === 0) {
      building(group, 0, -0.65, 2, 0.95, 1.45, cream, accent);
      for (const x of [-0.65, -0.2, 0.25, 0.7]) box(group, 0xfaf1db, x, 1.05, -0.11, 0.15, 1.05, 0.2);
      mesh(group, cone, accent, 0, 2.25, -0.65, 1.4, 0.7, 0.75).rotation.y = Math.PI / 4;
      for (let i = 0; i < 3; i++) mesh(group, cylinder, 0xe7bc62, 0.8, 0.56 + i * 0.14, 0.85, 0.3, 0.12, 0.3);
    } else if (index === 1) {
      pavilion(group, -0.8, -0.5, accent, 1.2);
      pavilion(group, 0.55, -0.7, 0xc6a75e, 0.85);
      box(group, 0xd3aa6c, 0.5, 0.75, 0.8, 1.05, 0.08, 0.1);
      for (const x of [0.05, 0.95]) box(group, ink, x, 0.85, 0.8, 0.06, 0.8, 0.06);
      box(group, accent, 0.5, 0.6, 0.8, 0.35, 0.06, 0.3);
    } else if (index === 2) {
      building(group, -0.45, -0.5, 1.45, 1.05, 1.9, 0xf4f1e5, accent);
      building(group, 0.8, -0.4, 0.75, 0.9, 1.05, 0xe0e3cf, accent);
      box(group, 0xc67963, -0.45, 2.12, 0.04, 0.42, 0.13, 0.06);
      box(group, 0xc67963, -0.45, 2.12, 0.045, 0.13, 0.42, 0.065);
      car(group, 0.65, 0.9, cream, Math.PI / 2);
    } else if (index === 3) {
      building(group, 0, -0.7, 2.25, 0.8, 1.05, cream, accent);
      building(group, -0.85, 0.35, 0.6, 1.25, 1.05, cream, accent);
      box(group, 0xa4b9a3, 0.6, 0.46, 0.7, 1.1, 0.045, 0.85);
      box(group, 0xebdfbd, 0.6, 0.49, 0.7, 0.02, 0.015, 0.8);
      mesh(group, cylinder, ink, 0.05, 1.35, -1.25, 0.035, 1.8, 0.035);
      box(group, accent, 0.23, 2.1, -1.25, 0.4, 0.23, 0.025);
    } else if (index === 4 || index === 6) {
      building(group, -0.6, -0.6, 0.9, 0.9, index === 6 ? 2.65 : 1.8, 0xc6d3ce, accent);
      building(group, 0.6, -0.3, 0.85, 1.05, 1.35, cream, accent);
      box(group, 0x6c898b, -0.6, index === 6 ? 3.25 : 2.4, -0.6, 0.55, 0.08, 0.55);
      box(group, accent, 0.6, 0.52, 1, 1.2, 0.12, 0.4);
      for (let j = 0; j < 3; j++) box(group, 0x718796, 0.25 + j * 0.32, 0.63, 1, 0.24, 0.1, 0.26);
    } else if (index === 5) {
      building(group, -0.3, -0.9, 2.0, 0.75, 0.9, cream, accent);
      box(group, 0x7c8b86, 0, 0.48, 0.5, 3.6, 0.06, 0.85);
      for (let x = -1.5; x < 1.6; x += 0.45) box(group, 0xf0e6ce, x, 0.52, 0.5, 0.22, 0.012, 0.035);
      const bus = car(group, 0.4, 0.5, 0xdbb560, Math.PI / 2);
      bus.scale.z = 1.9;
      car(group, -0.9, 0.6, 0xe8eeea, Math.PI / 2);
      for (let j = 0; j < 5; j++) mesh(group, cylinder, ink, -1 + j * 0.35, 0.65, 1.4, 0.035, 0.4, 0.035);
    } else if (index === 7) {
      addBaseballStadium(group, { box, mesh, cylinder, geometry });
    } else if (index === 8) {
      for (let j = 0; j < 3; j++) {
        building(group, -0.95 + j * 0.9, -0.65, 0.74, 0.85, 0.85, cream, j % 2 ? 0x8ca293 : accent);
        box(group, j % 2 ? 0x8ca293 : accent, -0.95 + j * 0.9, 1.1, 0, 0.78, 0.1, 0.48);
      }
      for (let j = 0; j < 3; j++) box(group, 0xb79871, -0.8 + j * 0.75, 0.63, 0.8, 0.5, 0.35, 0.45);
    } else if (index === 9) {
      building(group, -0.4, -0.5, 1.7, 1.1, 1.15, cream, accent);
      building(group, 0.9, -0.7, 0.5, 0.55, 2.0, cream, accent);
      car(group, -0.5, 0.8, 0xc87561, Math.PI / 2).scale.z = 1.6;
      box(group, 0x7895a1, -0.5, 0.89, 0.8, 0.1, 0.08, 0.15);
    } else if (index === 10) {
      // The gate and glass pavilion are original architectural motifs.
      box(group, 0xbd9b7e, -0.9, 0.95, -0.4, 0.5, 1.05, 0.85);
      box(group, 0xbd9b7e, 0.2, 0.95, -0.4, 0.5, 1.05, 0.85);
      box(group, 0xbd9b7e, -0.35, 1.56, -0.4, 1.6, 0.3, 0.85);
      box(group, cream, -0.35, 1.95, -0.4, 1.2, 0.55, 0.7);
      mesh(group, cone, 0x768b80, -0.35, 2.42, -0.4, 1.05, 0.5, 0.72).rotation.y = Math.PI / 4;
      box(group, 0xe9dbc4, -0.35, 0.47, 0.2, 1.6, 0.06, 1.6);
      const glassGeometry = new THREE.OctahedronGeometry(0.7);
      geometry.add(glassGeometry);
      const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x9bc8c8, metalness: 0.22, roughness: 0.23, transparent: true, opacity: 0.8 });
      materials.set('glass-pavilion', glassMaterial);
      const glass = new THREE.Mesh(glassGeometry, glassMaterial);
      glass.position.set(1.1, 1.05, 0.9);
      glass.scale.set(0.75, 1.2, 0.75);
      group.add(glass);
      box(group, cream, 1.1, 0.5, 0.9, 0.8, 0.13, 0.8);
    } else {
      building(group, -0.5, -0.5, 1.2, 1.1, 0.65, 0xc6c1b0, 0xabb2a3);
      const crane = new THREE.Group();
      group.add(crane);
      box(crane, 0xc6a553, 0.8, 1.7, -0.3, 0.13, 2.6, 0.13);
      box(crane, 0xc6a553, 0.25, 2.9, -0.3, 2.4, 0.15, 0.14);
      box(crane, ink, -0.7, 2.4, -0.3, 0.025, 0.95, 0.025);
      box(group, 0xbdac83, -0.7, 0.58, 0.9, 0.8, 0.3, 0.55);
      for (let j = 0; j < 3; j++) mesh(group, cone, 0xd39a66, 0.5 + j * 0.35, 0.6, 1.15, 0.1, 0.32, 0.1);
    }
    if (index !== 7) {
      for (const [x, z, s] of [[-1.7, 0.6, 0.85], [1.6, -0.5, 0.85], [1.25, 1.35, 0.65]]) tree(group, x, z, s);
      lamp(group, -1.45, -1.15);
      lamp(group, 1.2, 0.3);

      box(group, 0xab8d68, -1.3, 0.64, 1.1, 0.5, 0.09, 0.19);
      box(group, 0xab8d68, -1.3, 0.8, 1.19, 0.5, 0.24, 0.06);
    }
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      mesh(group, cylinder, 0xddd6b9, Math.cos(a) * 2.18 * ISLAND_SCALE, 0.59, Math.sin(a) * 2.18 * ISLAND_SCALE, 0.045, 0.32, 0.045);
    }
    addIslandDetails(index, group, { box, mesh, cylinder, sphere, cone, tree, building, accent });

    // The category ID is inherited by every pickable mesh via its parent.
    group.traverse(o => { if (o.isMesh) pickables.push(o); });
    const button = document.createElement('button');
    button.className = 'island-label';
    button.type = 'button';
    button.dataset.category = category.id;
    button.setAttribute('aria-label', `${category.title}，${category.items.length} 項`);
    button.setAttribute('aria-pressed', 'false');
    button.style.pointerEvents = 'auto';
    button.innerHTML = `<span>${SHORT_NAMES[index] || category.title}</span><small>${category.items.length}</small>`;
    button.addEventListener('click', () => chooseCategory(category.id));
    const label = new CSS2DObject(button);
    label.position.set(0, 0.75, 2.45);
    group.add(label);
    labelButtons.push(button);
  });

  const atmosphere = createRiverWeather(scene);
  let daylightLevel = 1;
  function boat(x, z, color) {
    const boatGroup = new THREE.Group();
    x *= ISLAND_SCALE; z *= ISLAND_SCALE;
    boatGroup.position.set(x, -0.35, z);
    scene.add(boatGroup);
    box(boatGroup, color, 0, 0, 0, 0.42, 0.18, 1.2);
    mesh(boatGroup, cone, color, 0, 0, 0.58, 0.28, 0.45, 0.28).rotation.x = Math.PI / 2;
    box(boatGroup, cream, 0, 0.2, -0.08, 0.32, 0.25, 0.4);
    moving.push({ object: boatGroup, x, z, phase: x });
  }
  boat(-11, 5, 0xd6a56c);
  boat(10, 0, 0xbb8067);
  boat(4, 11, 0x789d97);
  for (const [x, z] of [[-12, -7], [11, 7], [-6, 12]].map(p => p.map(v => v * ISLAND_SCALE))) {
    mesh(scene, cylinder, 0xd7c9a5, x, -0.42, z, 1.3, 0.4, 0.85);
    const islet = new THREE.Group();
    islet.position.set(x, -0.5, z);
    scene.add(islet);
    tree(islet, 0, 0, 1.1);
  }

  life = createCityLife({
    THREE, scene, positions, categories,
    onEvent: event => emit('city-event', event),
    onSelectPerson: id => followPerson(id),
  });
  life.setFlowVisible(showFlows);
  life.setCarryVisible(showCarry);
  const center = new THREE.Vector3(0, 0.5, 0.7);
  const cityBounds = new THREE.Box3();
  const fitPoints = [];
  islandGroups.forEach(group => {
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    cityBounds.union(bounds);
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) fitPoints.push(new THREE.Vector3(x, y, z));
      }
    }
  });
  let destination = null, paused = reduced.matches, topView = false, selected = null, disposed = false;
  let width = 1, height = 1;
  const isNarrow = () => width < 640;
  const overviewTarget = () => isNarrow() ? cityBounds.getCenter(new THREE.Vector3()) : center.clone();
  function overviewPosition() {
    if (!isNarrow()) {
      const distance = width / height < 1 ? 49 : 39;
      return topView ? new THREE.Vector3(0, distance, 0.71) : new THREE.Vector3(distance * 0.45, distance * 0.72, distance * 0.8);
    }
    // Fit the actual island bounds into the space between the intro and controls.
    const target = overviewTarget();
    const direction = topView ? new THREE.Vector3(0, 1, 0.081).normalize() : new THREE.Vector3(0.1, 1.1, 1).normalize();
    const probe = camera.clone();
    const availableWidth = Math.max(220, width - 30);
    const availableHeight = Math.max(210, height - Math.min(310, height * 0.36) - 165);
    let distance = 40;
    for (let iteration = 0; iteration < 6; iteration++) {
      probe.position.copy(target).addScaledVector(direction, distance);
      probe.lookAt(target);
      probe.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      fitPoints.forEach(point => {
        const projected = point.clone().project(probe);
        minX = Math.min(minX, projected.x); maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y); maxY = Math.max(maxY, projected.y);
      });
      const ratio = Math.max((maxX - minX) * width / 2 / availableWidth, (maxY - minY) * height / 2 / availableHeight);
      distance *= ratio;
      if (Math.abs(ratio - 1) < 0.005) break;
    }
    controls.maxDistance = Math.max(90, distance * 1.4);
    return target.clone().addScaledVector(direction, distance);
  }
  function moveTo(position, target) {
    if (reduced.matches) {
      camera.position.copy(position);
      controls.target.copy(target);
      destination = null;
    } else destination = { position, target };
  }
  function reset() {
    followPerson(null);
    selected = null;
    labelButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    moveTo(overviewPosition(), overviewTarget());
  }
  function select(id) {
    followPerson(null);
    selected = id;
    labelButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === id)));
    if (!id || !islandGroups.has(id)) { reset(); return; }
    const target = islandGroups.get(id).position.clone().add(new THREE.Vector3(0, 0.9, 0));
    const offset = topView ? new THREE.Vector3(0, 18, 1.46) : new THREE.Vector3(9, 14, 15);
    if (isNarrow()) offset.multiplyScalar(1.55);
    moveTo(target.clone().add(offset), target);
  }
  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    if (isNarrow()) {
      const safeTop = Math.min(310, height * 0.36);
      const safeBottom = height - 165;
      const offsetY = height / 2 - (safeTop + safeBottom) / 2;
      camera.setViewOffset(width, height, 0, offsetY, width, height);
    } else {
      camera.clearViewOffset();
      controls.maxDistance = 65;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labels.setSize(width, height);
    if (following) followPerson(following);
    else selected ? select(selected) : reset();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  camera.position.copy(overviewPosition());
  controls.target.copy(overviewTarget());
  destination = null;
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.16;
  const pointer = new THREE.Vector2();
  let pointerStart = null;
  const down = e => {
    pointerStart = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
  };
  const up = e => {
    if (!pointerStart || Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) { pointerStart = null; return; }
    pointerStart = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const person = !pickMode && raycaster.intersectObjects(life.getPickables(), false)[0];
    if (person) {
      let object = person.object;
      while (object && !object.userData.personId) object = object.parent;
      if (object) { followPerson(following === object.userData.personId ? null : object.userData.personId); return; }
    }
    const flowHit = !pickMode && !photoMode && raycaster.intersectObjects(life.getFlowPickables?.() || [], false)[0];
    if (flowHit) {
      showFlows = true;
      life.selectFlow(flowHit.object.userData.flowId);
      emit('city-flow', { id: flowHit.object.userData.flowId });
      return;
    }
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (!hit) return;
    let object = hit.object;
    while (object && !object.userData.categoryId) object = object.parent;
    if (object) chooseCategory(object.userData.categoryId);
  };
  const cancel = () => { pointerStart = null; };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancel);
  const stopTransition = () => { destination = null; if(following) followPerson(null); };
  controls.addEventListener('start', stopTransition);
  const keydown = e => {
    if(e.key === 'Escape') { setPickMode(false); followPerson(null); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) return;
    e.preventDefault();
    destination = null;
    if(following) followPerson(null);
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (e.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (e.key === 'ArrowRight') spherical.theta += 0.12;
    if (e.key === 'ArrowUp') spherical.phi = Math.max(0.08, spherical.phi - 0.1);
    if (e.key === 'ArrowDown') spherical.phi = Math.min(Math.PI / 2.5, spherical.phi + 0.1);
    if (e.key === '+' || e.key === '=') spherical.radius = Math.max(10, spherical.radius - 2);
    if (e.key === '-') spherical.radius = Math.min(controls.maxDistance, spherical.radius + 2);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  };
  renderer.domElement.addEventListener('keydown', keydown);
  const escapeModes = event => { if(event.key === 'Escape' && !document.querySelector('dialog[open]')) { setPickMode(false); followPerson(null); } };
  window.addEventListener('keydown', escapeModes);
  let last = 0, elapsed = 0, frame = 0;
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    life.update(!paused && !document.hidden ? dt : 0);
    const environmentDt = !paused && !document.hidden ? dt : 0;
    const cloudCover = atmosphere.update(environmentDt);
    const windTime = atmosphere.getElapsed();
    if (environmentDt > 0) {
      windTrees.forEach(({ pivot, upper, branches, x, z }) => {
        const motion = sampleTreeWind(windTime, x, z);
        pivot.rotation.set(motion.trunk * WIND_DIRECTION.z, 0, -motion.trunk * WIND_DIRECTION.x);
        upper.rotation.set(motion.crown * WIND_DIRECTION.z, 0, -motion.crown * WIND_DIRECTION.x);
        branches.forEach((branch, i) => {
          const flutter = motion.flutter * (0.7 + i * 0.25);
          branch.rotation.set(flutter * WIND_DIRECTION.z, 0, -flutter * WIND_DIRECTION.x);
        });
      });
      backdrop.updateWind(windTime);
    }
    sun.intensity = (0.3 + daylightLevel * 3.1) * (1 - cloudCover * 0.32);
    scene.fog.color.set(0xb8cfca).lerp(new THREE.Color(0xa5b9c2), cloudCover * 0.6);
    if (!paused && !document.hidden) {
      elapsed += dt;
      moving.forEach(({ object, x, z, phase }) => {
        object.position.set(x + Math.sin(elapsed * 0.08 + phase) * 0.6, -0.35 + Math.sin(elapsed * 1.5 + phase) * 0.025, z + Math.cos(elapsed * 0.08 + phase) * 0.5);
        object.rotation.z = Math.sin(elapsed + phase) * 0.025;
      });
    }
    if (following) {
      const personPosition = life.getPersonPosition(following);
      if (personPosition) {
        const target = personPosition.clone().add(new THREE.Vector3(0, 0.7, 0));
        if (destination) {
          destination.target.copy(target);
          destination.position.copy(target).add(new THREE.Vector3(3, 4.5, 5));
        } else {
          const delta = target.sub(controls.target);
          controls.target.add(delta);
          camera.position.add(delta);
        }
      }
    }
    if (destination) {
      const ease = 1 - Math.exp(-dt * 4.5);
      camera.position.lerp(destination.position, ease);
      controls.target.lerp(destination.target, ease);
      if (camera.position.distanceTo(destination.position) < 0.015) destination = null;
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  const onReduced = () => { if (reduced.matches) paused = true; controls.enableDamping = !reduced.matches; };
  reduced.addEventListener('change', onReduced);
  onReduced();
  return {
    select,
    reset,
    getLifeSnapshot() { return { ...life.getSnapshot(), following, pickMode, photoMode, paused, flowVisible: showFlows, carryVisible: showCarry }; },
    setFlowVisible(value) { showFlows = Boolean(value); life.setFlowVisible(showFlows && !photoMode); },
    setCarryVisible(value) { showCarry = Boolean(value); life.setCarryVisible(showCarry && !photoMode); },
    selectFlow(id) { if(id) showFlows = true; life.selectFlow(id); },
    setAvatar(config) { const result = life.setAvatar(config); if(photoMode) life.setMarkersVisible(false); return result; },
    moveAvatar(id) { return life.moveAvatar(id); },
    setAvatarAuto(value) { return life.setAvatarAuto(value); },
    followPerson,
    setPickMode,
    poseAvatar(config) { life.poseAvatar(config); followPerson('avatar'); },
    setPhotoMode(value) {
      photoMode = Boolean(value);
      document.body.classList.toggle('photo-mode', photoMode);
      labels.domElement.style.display = showLabels && !photoMode ? '' : 'none';
      life.setFlowVisible(showFlows && !photoMode);
      life.setCarryVisible(showCarry && !photoMode);
      life.setMarkersVisible?.(!photoMode);
    },
    setWeather(value) { atmosphere.setWeather(value); },
    setTime(hours) {
      const hour = Math.min(24, Math.max(0, Number(hours)));
      if (!Number.isFinite(hour)) return;
      const daylight = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
      daylightLevel = daylight;
      hemisphere.intensity = 0.65 + daylight * 2.15;
      sun.intensity = 0.3 + daylight * 3.1;
      sun.color.set(daylight < 0.5 ? 0xf1bc89 : 0xfff1d6);
      sun.position.x = (hour - 12) * 2;
      sun.position.y = 8 + daylight * 17;
      renderer.toneMappingExposure = 0.72 + daylight * 0.4;
      materials.forEach((m, key) => { if (key.endsWith(':window')) m.emissiveIntensity = 0.15 + (1 - daylight) * 1.2; });
    },
    setPaused(value) { paused = Boolean(value); },
    setLabels(value) {
      showLabels = Boolean(value);
      labels.domElement.style.display = showLabels && !photoMode ? '' : 'none';
      labelButtons.forEach(b => { b.tabIndex = value ? 0 : -1; });
    },
    setTopView(value) { topView = Boolean(value); selected ? select(selected) : reset(); },
    dispose() {
      disposed = true;
      life.dispose();
      backdrop.dispose();
      atmosphere.dispose();
      document.body.classList.remove('following-person', 'photo-mode');
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', escapeModes);
      reduced.removeEventListener('change', onReduced);
      controls.removeEventListener('start', stopTransition);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      renderer.domElement.removeEventListener('keydown', keydown);
      geometry.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
