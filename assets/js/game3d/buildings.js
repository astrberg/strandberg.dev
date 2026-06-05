import * as THREE from 'three';
import { getHeightAt } from './world.js';
import { loadGLTF } from './model-loader.js';

// ── Headquarters and surrounding campus buildings ───────────────────────────────
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
  
  // Calculate bounding box in default position to find the correct bottom offset
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(model);
  
  const gy = getHeightAt(x, z);
  // Align the actual bottom of the mesh to the terrain
  model.position.set(x, gy - bbox.min.y, z);
  
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

// ── Goldshire Abbey (Hybrid small layout) ───────────────────────────────
export function buildAbbey(scene) {
  const AX = 0, AZ = -50;
  placeModel('church', scene, AX, AZ, 14, 0);
  
  // Stone wall enclosing the Abbey backyard
  for (let i = 0; i < 5; i++) {
    placeModel('fence_stone', scene, AX - 16 + i * 8, AZ - 20, 6, 0);
  }
  placeModel('fence_stone', scene, AX - 20, AZ - 16, 6, Math.PI / 2);
  placeModel('fence_stone', scene, AX + 20, AZ - 16, 6, Math.PI / 2);
}

// ── The Inn & Blacksmith ────────────────────────────────────────────────────────
export function buildInn(scene) {
  // Tavern (West of the road)
  placeModel('tavern', scene, -25, 15, 10, Math.PI / 2);
  
  // Barrels stacked outside the tavern
  placeModel('barrel', scene, -15, 8, 4, 0.2);
  placeModel('barrel', scene, -13, 9, 4, -0.4);
  placeModel('barrel', scene, -14, 6, 4, 1.1);

  // Blacksmith (East of the road)
  if (loaded['blacksmith']) {
    placeModel('blacksmith', scene, 25, 10, 8, -Math.PI / 2);
  } else {
    // fallback if no blacksmith
    placeModel('castle', scene, 25, 10, 6, -Math.PI / 2);
  }
}

// ── Village Houses ─────────────────────────────────────────────────────────────
export function buildBarracks(scene) {
  // We repurpose this to build the small houses
  placeModel('home_a', scene, 22, 45, 8, -Math.PI / 2 + 0.2);
  placeModel('home_b', scene, -24, 55, 8, Math.PI / 2 - 0.1);
  
  // Wooden fences around the houses
  placeModel('fence_wood', scene, 18, 55, 5, 0);
  placeModel('fence_wood', scene, 26, 55, 5, 0);
}

// ── Village Props ──────────────────────────────────────────────────────────────
export function buildVineyards(scene) {
  // Repurposed for general props and well
  placeModel('well', scene, -8, -15, 5, 0);
  
  placeModel('barrel', scene, 18, 35, 4, 0);
}

// ── Stone road through the town ───────────────────────────────────────────────
export function buildRoad(scene) {
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x7a7060 });

  // Main road runs North-South
  const segments = 25;
  const roadW = 8;
  for (let i = 0; i < segments; i++) {
    const x = Math.sin(i * 0.2) * 2; // Very slight curve
    const z = -30 + i * 6;
    const gy = getHeightAt(x, z) + 0.05;
    
    // Skip road mesh if it's perfectly under a large building to prevent z-fighting,
    // but in this layout it's mostly open.
    const geo = new THREE.BoxGeometry(roadW, 0.2, 6.2);
    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.position.set(x, gy, z);
    mesh.rotation.y = Math.cos(i * 0.2) * 0.05;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
