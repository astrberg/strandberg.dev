import * as THREE from 'three';
import { getHeightAt, WORLD_SIZE } from './world.js';
import { loadGLTF } from './model-loader.js';

// ── Model-based environment ──────────────────────────────────────────────────

const ENV_MODELS = {
  tree_a:       '/assets/models/tree_a.glb',
  tree_b:       '/assets/models/tree_b.glb',
  trees_large:  '/assets/models/trees_large.glb',
  trees_medium: '/assets/models/trees_medium.glb',
  rock_a:       '/assets/models/rock_a.glb',
  rock_b:       '/assets/models/rock_b.glb',
  rock_c:       '/assets/models/rock_c.glb',
  hills_trees:  '/assets/models/hills_trees.glb',
  well:         '/assets/models/well.glb',
};

const envLoaded = {};

export async function loadEnvironmentModels() {
  const entries = Object.entries(ENV_MODELS);
  await Promise.all(entries.map(async ([key, url]) => {
    try { envLoaded[key] = await loadGLTF(url); }
    catch (e) { console.warn(`Env model ${key} failed:`, e); }
  }));
}

function placeEnvModel(key, scene, x, z, scale = 1, rotY = 0) {
  const gltf = envLoaded[key];
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

// ── Campus trees ─────────────────────────────────────────────────────────────────
// Each tree = cone canopy + cylinder trunk. Billboard leaves for far trees.

function makeTree(scene, x, z, scale = 1.0) {
  const gy = getHeightAt(x, z);

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e12 });
  const trunkH   = (5 + Math.random() * 3) * scale;
  const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, trunkH, 7);
  const trunk    = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, gy + trunkH / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);

  // Two stacked cones for richer silhouette
  const leafColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.04, 0.55 + Math.random() * 0.1, 0.22 + Math.random() * 0.06);
  const leafMat   = new THREE.MeshLambertMaterial({ color: leafColor });

  const cone1H = (7 + Math.random() * 4) * scale;
  const cone1R = (2.5 + Math.random() * 1) * scale;
  const cone1Geo = new THREE.ConeGeometry(cone1R, cone1H, 7);
  const cone1    = new THREE.Mesh(cone1Geo, leafMat);
  cone1.position.set(x, gy + trunkH + cone1H * 0.45, z);
  cone1.castShadow = true;
  scene.add(cone1);

  const cone2H = cone1H * 0.65;
  const cone2Geo = new THREE.ConeGeometry(cone1R * 0.7, cone2H, 7);
  const cone2    = new THREE.Mesh(cone2Geo, leafMat);
  cone2.position.set(x, gy + trunkH + cone1H * 0.85 + cone2H * 0.4, z);
  cone2.castShadow = true;
  scene.add(cone2);
}

// Deterministic pseudo-random from seed
function seededRand(seed) {
  const s = Math.sin(seed * 9301 + 49297) * 233280;
  return s - Math.floor(s);
}

export function buildForest(scene) {
  const treeKeys = ['tree_a', 'tree_b'];
  const clusterKeys = ['trees_large', 'trees_medium'];
  const hasModels = treeKeys.some(k => envLoaded[k]);

  // Forest belts
  const zones = [
    { xMin: -250, xMax: 250, zMin: -240, zMax: -120, density: 110, scale: 1.1 },
    { xMin: -250, xMax: 250, zMin:  120, zMax:  240, density: 90,  scale: 1.0 },
    { xMin:  150, xMax:  250, zMin: -120, zMax:  120, density: 60,  scale: 1.0 },
    { xMin: -200, xMax: -120, zMin: -80,  zMax:  80,  density: 50,  scale: 1.2 },
    { xMin: -100, xMax:  150, zMin:  60,  zMax:  120, density: 30,  scale: 0.85 },
    { xMin: -100, xMax:  150, zMin: -110, zMax:  -60, density: 30,  scale: 0.85 },
  ];

  let seed = 0;
  for (const z of zones) {
    for (let i = 0; i < z.density; i++) {
      const rx = z.xMin + seededRand(seed++) * (z.xMax - z.xMin);
      const rz = z.zMin + seededRand(seed++) * (z.zMax - z.zMin);
      const rs = (0.75 + seededRand(seed++) * 0.6) * z.scale;

      if (hasModels) {
        // Use model trees: alternate between tree_a and tree_b
        const key = treeKeys[i % treeKeys.length];
        const rotY = seededRand(seed + 100) * Math.PI * 2;
        placeEnvModel(key, scene, rx, rz, rs * 6, rotY);
      } else {
        makeTree(scene, rx, rz, rs);
      }
    }
  }

  // Add tree clusters at forest edges using the cluster models
  if (envLoaded['trees_large']) {
    const clusterPositions = [
      [-180, -180], [-120, -200], [180, -160], [200, 140],
      [-160, 160], [100, 180], [-200, -40], [220, 0],
    ];
    for (const [cx, cz] of clusterPositions) {
      const key = clusterKeys[Math.abs(cx + cz) % clusterKeys.length];
      placeEnvModel(key, scene, cx, cz, 8, seededRand(cx * 7 + cz) * Math.PI * 2);
    }
  }

  // Add rocks scattered around
  if (envLoaded['rock_a']) {
    const rockKeys = ['rock_a', 'rock_b', 'rock_c'];
    let rseed = 1000;
    for (let i = 0; i < 30; i++) {
      const rx = -200 + seededRand(rseed++) * 400;
      const rz = -200 + seededRand(rseed++) * 400;
      const gy = getHeightAt(rx, rz);
      if (gy > 20) continue;
      const key = rockKeys[i % rockKeys.length];
      const rs = 3 + seededRand(rseed++) * 5;
      placeEnvModel(key, scene, rx, rz, rs, seededRand(rseed) * Math.PI * 2);
    }
  }
}

// ── Crystal-clear Northshire stream ───────────────────────────────────────────
export function buildRiver(scene) {
  // The Northshire stream runs roughly north-south through the valley centre
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x1a5080,
    transparent: true,
    opacity: 0.78,
  });

  const segments = 20;
  for (let i = 0; i < segments; i++) {
    const t  = i / segments;
    const x  = 80 + Math.sin(t * Math.PI * 1.8) * 25; // meander
    const z  = -200 + t * 400;
    const gy = getHeightAt(x, z);
    const geo = new THREE.BoxGeometry(10, 0.3, 22);
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.position.set(x, gy + 0.05, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Small waterfall where river meets north slope
  const wfMat = new THREE.MeshLambertMaterial({ color: 0x80b4d0, transparent: true, opacity: 0.7 });
  const wfGeo = new THREE.BoxGeometry(8, 6, 3);
  const wf    = new THREE.Mesh(wfGeo, wfMat);
  wf.position.set(78, getHeightAt(78, -190) + 2, -195);
  scene.add(wf);
}

// ── Ground detail (disabled) ─────────────────────────────────────────────────
export function buildGroundDetail(scene) {}

// ── Abbott's Well (landmark) ──────────────────────────────────────────────────
export function buildWell(scene) {
  const WX = -30, WZ = 5;
  const gy = getHeightAt(WX, WZ);

  if (envLoaded['well']) {
    placeEnvModel('well', scene, WX, WZ, 5, 0);
    return;
  }

  // Procedural fallback
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888070 });
  const ringGeo = new THREE.CylinderGeometry(2, 2.2, 0.8, 12);
  const ring    = new THREE.Mesh(ringGeo, stoneMat);
  ring.position.set(WX, gy + 0.4, WZ);
  ring.castShadow = true;
  scene.add(ring);

  const wallGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.6, 12, 1, true);
  const wall    = new THREE.Mesh(wallGeo, stoneMat);
  wall.position.set(WX, gy + 1.2, WZ);
  wall.castShadow = true;
  scene.add(wall);

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a3810 });
  const roofGeo = new THREE.ConeGeometry(2.6, 2, 4);
  const roof    = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(WX, gy + 2 + 1 + 0.5, WZ);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);

  const postMat = new THREE.MeshLambertMaterial({ color: 0x6a4020 });
  for (let i = 0; i < 4; i++) {
    const a   = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px  = WX + Math.cos(a) * 1.9;
    const pz  = WZ + Math.sin(a) * 1.9;
    const pGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 5);
    const p   = new THREE.Mesh(pGeo, postMat);
    p.position.set(px, gy + 1.5, pz);
    p.castShadow = true;
    scene.add(p);
  }
}
