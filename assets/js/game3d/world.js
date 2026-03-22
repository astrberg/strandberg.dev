import * as THREE from 'three';

// ── Terrain heightmap for Northshire valley ───────────────────────────────────
// World is 512×512 units. Heights are sampled from a hand-crafted function
// that mimics the Northshire valley: flat central valley, hills on north/south
// edges, gentle slopes.

export const WORLD_SIZE = 512;
export const TERRAIN_SEGS = 128;

/** Northshire terrain height at normalized coords (u,v) in [0,1]. */
export function terrainHeight(u, v) {
  // Valley centre
  const cx = 0.5, cz = 0.52;
  const dx = u - cx, dz = v - cz;

  // Broad valley dish — deeper in centre
  const valleyFloor = Math.pow(dx * 1.6, 2) + Math.pow(dz * 1.1, 2);

  // Northern ridge (top of map)
  const northRidge = Math.max(0, 1 - v * 5) * 28;

  // Southern hills
  const southHill = Math.max(0, (v - 0.75) * 3.5) * 22;

  // Eastern hills
  const eastHill = Math.max(0, (u - 0.80) * 5) * 18;

  // Western abbey hillside (slight elevation)
  const westAbbey = Math.max(0, (0.22 - u) * 3) * 12;

  // Gentle noise-like bumps (deterministic)
  const bump = Math.sin(u * 14) * Math.cos(v * 11) * 1.2 +
               Math.sin(u * 27 + 1) * Math.cos(v * 19) * 0.5;

  const base = valleyFloor * 55 + northRidge + southHill + eastHill + westAbbey + bump;
  return Math.max(0, base);
}

export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(
    WORLD_SIZE, WORLD_SIZE,
    TERRAIN_SEGS, TERRAIN_SEGS
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = (x + WORLD_SIZE / 2) / WORLD_SIZE;
    const v = (z + WORLD_SIZE / 2) / WORLD_SIZE;
    pos.setY(i, terrainHeight(u, v));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Vertex colours for natural variation
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const x = (pos.getX(i) + WORLD_SIZE / 2) / WORLD_SIZE;
    const z = (pos.getZ(i) + WORLD_SIZE / 2) / WORLD_SIZE;

    let r, g, b;
    if (y < 0.5) {
      // River/low wetland: dark green
      r = 0.18; g = 0.32; b = 0.10;
    } else if (y < 6) {
      // Valley floor: rich Elwynn green
      r = 0.20 + Math.sin(x * 18) * 0.03; g = 0.42 + Math.cos(z * 14) * 0.04; b = 0.12;
    } else if (y < 16) {
      // Slope: medium green
      r = 0.22; g = 0.37; b = 0.13;
    } else if (y < 26) {
      // Upper slope: darker green/brown mix
      r = 0.28; g = 0.33; b = 0.14;
    } else {
      // Ridge: earthy brown
      r = 0.35; g = 0.28; b = 0.16;
    }
    colors[i * 3]     = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  return { mesh, geo };
}

/** Sample the terrain height at a world-space (x, z) position. */
export function getHeightAt(x, z) {
  const u = (x + WORLD_SIZE / 2) / WORLD_SIZE;
  const v = (z + WORLD_SIZE / 2) / WORLD_SIZE;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  return terrainHeight(u, v);
}

export function buildLighting(scene) {
  // Ambient — warm Elwynn daytime
  const ambient = new THREE.AmbientLight(0xb8c8e8, 0.7);
  scene.add(ambient);

  // Sun — slightly south-west, mid-day angle
  const sun = new THREE.DirectionalLight(0xfff4d8, 1.2);
  sun.position.set(120, 180, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far  = 800;
  sun.shadow.camera.left   = -300;
  sun.shadow.camera.right  =  300;
  sun.shadow.camera.top    =  300;
  sun.shadow.camera.bottom = -300;
  scene.add(sun);

  // Hemisphere — sky blue top, warm ground bounce
  const hemi = new THREE.HemisphereLight(0x8ab4f8, 0x6a8840, 0.45);
  scene.add(hemi);

  return { sun, ambient, hemi };
}

export function buildSky(scene) {
  // Large sphere inverted as a sky dome
  const geo = new THREE.SphereGeometry(900, 32, 16);
  geo.scale(-1, 1, 1); // invert normals

  // Vertical gradient via vertex colours
  const pos    = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 900) / 1800; // 0=bottom, 1=top
    // Bottom: horizon haze (warm light blue), Top: deep sky blue
    const r = 0.60 + t * (-0.15);
    const g = 0.75 + t * (-0.10);
    const b = 0.92 + t * (-0.08);
    colors[i * 3]     = Math.max(0, Math.min(1, r));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, g));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, b));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat  = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  scene.add(dome);

  // Sun disc
  const sunGeo  = new THREE.CircleGeometry(22, 24);
  const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfffae0, fog: false });
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  sunDisc.position.set(200, 350, -350);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  return { dome };
}

export function buildFog(scene) {
  scene.fog = new THREE.Fog(0xb8d8e8, 80, 520);
}
