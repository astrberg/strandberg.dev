import * as THREE from 'three';
import { getHeightAt } from './world.js';
import { loadGLTF } from './model-loader.js';

// ── SEB Headquarters and surrounding campus buildings ────────────────────────────
// Uses KayKit Medieval models (CC0) with procedural fallback.

const STONE_COLOR   = 0x9a9080;
const STONE_DARK    = 0x6a6058;
const ROOF_COLOR    = 0x5a4838;
const WOOD_COLOR    = 0x7a5030;
const THATCH_COLOR  = 0xb89040;

// Model URLs
const MODELS = {
  church:     '/assets/models/church.glb',
  tavern:     '/assets/models/tavern.glb',
  barracks:   '/assets/models/barracks.glb',
  tower_a:    '/assets/models/tower_a.glb',
  tower_b:    '/assets/models/tower_b.glb',
  well:       '/assets/models/well.glb',
  castle:     '/assets/models/castle.glb',
  home_a:     '/assets/models/home_a.glb',
  fence_stone: '/assets/models/fence_stone.glb',
  fence_stone_gate: '/assets/models/fence_stone_gate.glb',
  fence_wood: '/assets/models/fence_wood.glb',
  barrel:     '/assets/models/barrel.glb',
};

// Loaded model cache (populated by loadBuildingModels)
const loaded = {};

export async function loadBuildingModels() {
  const entries = Object.entries(MODELS);
  await Promise.all(entries.map(async ([key, url]) => {
    try { loaded[key] = await loadGLTF(url); }
    catch (e) { console.warn(`Building model ${key} failed:`, e); }
  }));
}

function placeModel(key, scene, x, z, scale = 1, rotY = 0) {
  const gltf = loaded[key];
  if (!gltf) return null;
  const model = gltf.scene.clone(true);
  model.scale.setScalar(scale);
  model.rotation.y = rotY;
  const gy = getHeightAt(x, z);
  model.position.set(x, gy, z);
  model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  scene.add(model);
  return model;
}

function stoneMat(color = STONE_COLOR) {
  return new THREE.MeshLambertMaterial({ color });
}

function makeBox(w, h, d, mat, scene, x, y, z, rotY = 0) {
  const geo  = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makePrism(w, h, d, scene, x, y, z, rotY = 0, color = ROOF_COLOR) {
  // Triangular prism as a roof ridge
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(w / 2, 0);
  shape.lineTo(-w / 2, 0);
  const extrudeSettings = { steps: 1, depth: d, bevelEnabled: false };
  const geo  = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mat  = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  // Centre the extrusion
  mesh.position.set(x - d / 2, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function towerAt(scene, x, z, radius = 3.5, height = 22) {
  const mat = stoneMat(STONE_DARK);
  const geo  = new THREE.CylinderGeometry(radius, radius + 0.5, height, 12);
  const mesh = new THREE.Mesh(geo, mat);
  const y    = getHeightAt(x, z) + height / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Battlements (ring of merlons)
  const mMat  = stoneMat(STONE_DARK);
  const mGeo  = new THREE.BoxGeometry(1.4, 2, 1.4);
  const mCount = 8;
  for (let i = 0; i < mCount; i++) {
    const a = (i / mCount) * Math.PI * 2;
    const mx = x + Math.cos(a) * (radius - 0.2);
    const mz = z + Math.sin(a) * (radius - 0.2);
    const m  = new THREE.Mesh(mGeo, mMat);
    m.position.set(mx, y + height / 2 + 1, mz);
    m.castShadow = true;
    scene.add(m);
  }

  // Conical cap
  const capGeo  = new THREE.ConeGeometry(radius + 0.3, height * 0.35, 12);
  const capMat  = new THREE.MeshLambertMaterial({ color: 0x4a3830 });
  const cap     = new THREE.Mesh(capGeo, capMat);
  cap.position.set(x, y + height / 2 + height * 0.175 + 0.8, z);
  cap.castShadow = true;
  scene.add(cap);
}

// ── SEB Headquarters (main structure) ────────────────────────────────────────
export function buildAbbey(scene) {
  const AX = -80, AZ = -20;
  const groundY = getHeightAt(AX, AZ);

  // Try placing glTF church model as the main abbey
  const abbeyModel = placeModel('church', scene, AX, AZ, 18, 0);
  if (abbeyModel) {
    // Add castle for the fortified look
    placeModel('castle', scene, AX - 25, AZ, 10, Math.PI / 2);
    // Corner towers
    placeModel('tower_a', scene, AX - 20, AZ - 22, 8, 0);
    placeModel('tower_a', scene, AX - 20, AZ + 22, 8, 0);
    placeModel('tower_b', scene, AX + 20, AZ, 8, 0);
    // Courtyard walls using fence_stone
    for (let i = 0; i < 6; i++) {
      placeModel('fence_stone', scene, AX - 20 + i * 8, AZ - 28, 6, 0);
      placeModel('fence_stone', scene, AX - 20 + i * 8, AZ + 28, 6, 0);
    }
    placeModel('fence_stone_gate', scene, AX + 16, AZ, 6, Math.PI / 2);
    // Barrels near abbey
    placeModel('barrel', scene, AX + 12, AZ - 8, 4, 0);
    placeModel('barrel', scene, AX + 14, AZ - 6, 4, 0.5);
    return;
  }

  // Procedural fallback

  // Main nave — long hall east-west
  makeBox(40, 16, 18, stoneMat(), scene, AX, groundY + 8, AZ);
  // Roof
  makePrism(20, 7, 40, scene, AX - 0.5, groundY + 16 + 0.5, AZ - 9, 0);

  // North transept
  makeBox(14, 14, 12, stoneMat(STONE_DARK), scene, AX, groundY + 7, AZ - 14);
  makePrism(15, 5, 14, scene, AX - 7, groundY + 14 + 0.5, AZ - 7, Math.PI / 2);

  // South transept
  makeBox(14, 14, 12, stoneMat(STONE_DARK), scene, AX, groundY + 7, AZ + 14);
  makePrism(15, 5, 14, scene, AX - 7, groundY + 14 + 0.5, AZ + 7, Math.PI / 2);

  // Apse (east end, rounded)
  const apseGeo = new THREE.CylinderGeometry(9, 9, 14, 8, 1, false, 0, Math.PI);
  const apseMesh = new THREE.Mesh(apseGeo, stoneMat());
  apseMesh.position.set(AX + 26, groundY + 7, AZ);
  apseMesh.castShadow = apseMesh.receiveShadow = true;
  scene.add(apseMesh);

  // Central tower
  towerAt(scene, AX, AZ, 4.5, 28);

  // Corner towers
  towerAt(scene, AX - 20, AZ - 9, 3, 20);
  towerAt(scene, AX - 20, AZ + 9, 3, 20);

  // Courtyard wall (cloister)
  const wallMat = stoneMat(STONE_DARK);
  const wallH = 5;
  // North wall
  makeBox(36, wallH, 1.5, wallMat, scene, AX - 2, groundY + wallH / 2, AZ - 24);
  // South wall
  makeBox(36, wallH, 1.5, wallMat, scene, AX - 2, groundY + wallH / 2, AZ + 24);
  // West wall
  makeBox(1.5, wallH, 48, wallMat, scene, AX - 20, groundY + wallH / 2, AZ);

  // Gate archway (east entrance)
  makeBox(1.5, wallH, 12, wallMat, scene, AX + 16, groundY + wallH / 2, AZ - 18);
  makeBox(1.5, wallH, 12, wallMat, scene, AX + 16, groundY + wallH / 2, AZ + 18);
  // Arch lintel
  makeBox(1.5, 3, 12, stoneMat(), scene, AX + 16, groundY + wallH + 1.5, AZ);
}

// ── The Fika Lounge ────────────────────────────────────────────────────────────
export function buildInn(scene) {
  const IX = 10, IZ = 40;
  const groundY = getHeightAt(IX, IZ);

  // Try glTF tavern model
  const innModel = placeModel('tavern', scene, IX, IZ, 12, 0);
  if (innModel) {
    placeModel('barrel', scene, IX + 8, IZ - 4, 4, 0.3);
    placeModel('barrel', scene, IX + 9, IZ - 2, 4, -0.2);
    placeModel('barrel', scene, IX - 8, IZ + 3, 4, 1.0);
    return;
  }

  // Procedural fallback

  // Main timber frame building
  makeBox(18, 10, 12, new THREE.MeshLambertMaterial({ color: WOOD_COLOR }), scene, IX, groundY + 5, IZ);
  // Stone ground floor
  makeBox(18, 5, 12, stoneMat(), scene, IX, groundY + 2.5, IZ);
  // Thatched roof
  makePrism(14, 8, 20, scene, IX - 1.5, groundY + 10 + 0.5, IZ - 10, 0, THATCH_COLOR);

  // Sign post
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5a3818 });
  makeBox(0.3, 6, 0.3, postMat, scene, IX + 11, groundY + 3, IZ - 5);
  makeBox(4, 0.3, 0.3, postMat, scene, IX + 9, groundY + 6.2, IZ - 5);
}

// ── DevOps Command Center ─────────────────────────────────────────────────────
export function buildBarracks(scene) {
  // Try glTF barracks model
  const barracksModel = placeModel('barracks', scene, 60, -60, 12, 0);
  if (barracksModel) {
    // Guard post buildings
    placeModel('home_a', scene, 30, -30, 8, 0);
    placeModel('home_a', scene, 30, 20, 8, Math.PI);
    placeModel('tower_a', scene, 60, -50, 6, 0);
    return;
  }

  // Procedural fallback
  // Two guard posts flanking the abbey entrance road
  const positions = [
    [30, -30],
    [30,  20],
  ];
  for (const [bx, bz] of positions) {
    const gy = getHeightAt(bx, bz);
    makeBox(10, 7, 8, stoneMat(STONE_DARK), scene, bx, gy + 3.5, bz);
    makePrism(10, 4, 10, scene, bx - 1, gy + 7 + 0.5, bz - 5, 0, ROOF_COLOR);
  }

  // Main barracks building
  const BX = 60, BZ = -60;
  const gy = getHeightAt(BX, BZ);
  makeBox(22, 8, 12, stoneMat(), scene, BX, gy + 4, BZ);
  makePrism(14, 5, 24, scene, BX - 2, gy + 8 + 0.5, BZ - 12, 0, ROOF_COLOR);
  towerAt(scene, BX - 8, BZ - 5, 2.5, 14);
}

// ── The Server Farm ──────────────────────────────────────────────────────────────
export function buildVineyards(scene) {
  // Try glTF fence models
  if (loaded['fence_wood']) {
    for (let row = 0; row < 6; row++) {
      const fz = -10 + row * 14;
      for (let p = 0; p < 8; p++) {
        const px = p * 8;
        placeModel('fence_wood', scene, px, fz, 5, 0);
      }
      // Vines — dark green rows
      const vineMat = new THREE.MeshLambertMaterial({ color: 0x2a5820 });
      for (let v = 0; v < 7; v++) {
        const vx = v * 8 + 4;
        const gy = getHeightAt(vx, fz);
        const vineGeo = new THREE.BoxGeometry(3, 1.2, 6);
        const vine = new THREE.Mesh(vineGeo, vineMat);
        vine.position.set(vx, gy + 0.9, fz);
        vine.castShadow = true;
        scene.add(vine);
      }
    }
    return;
  }

  // Procedural fallback
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x6a4820 });
  // Server racks on the gentle slopes east of HQ
  for (let row = 0; row < 6; row++) {
    const fz = -10 + row * 14;
    const fx  = 0;
    // Fence post row
    for (let p = 0; p < 8; p++) {
      const px = fx + p * 8;
      const gy = getHeightAt(px, fz);
      makeBox(0.4, 2.5, 0.4, fenceMat, scene, px, gy + 1.25, fz);
      if (p < 7) {
        makeBox(8, 0.3, 0.3, fenceMat, scene, px + 4, gy + 2.4, fz);
      }
    }
    // Vines — dark green rows
    const vineMat = new THREE.MeshLambertMaterial({ color: 0x2a5820 });
    for (let v = 0; v < 7; v++) {
      const vx = fx + v * 8 + 4;
      const gy = getHeightAt(vx, fz);
      const vineGeo = new THREE.BoxGeometry(3, 1.2, 6);
      const vine = new THREE.Mesh(vineGeo, vineMat);
      vine.position.set(vx, gy + 0.9, fz);
      vine.castShadow = true;
      scene.add(vine);
    }
  }
}

// ── Stone road through the valley ─────────────────────────────────────────────
export function buildRoad(scene) {
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x7a7060 });

  // Main road: runs east from HQ gate (~-64,0) to east edge
  const segments = 30;
  const roadW = 7;
  for (let i = 0; i < segments; i++) {
    const x = -64 + i * 14;
    const z = Math.sin(i * 0.3) * 8; // gentle curve
    const gy = getHeightAt(x, z) + 0.05;
    const geo = new THREE.BoxGeometry(14.5, 0.2, roadW);
    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.position.set(x, gy, z);
    mesh.rotation.y = Math.atan2(Math.sin((i + 0.5) * 0.3) - Math.sin(i * 0.3), 14) * 0.3;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
