import * as THREE from 'three';
import { buildTerrain, buildLighting, buildSky, buildFog, getHeightAt } from './world.js';
import { buildAbbey, buildInn, buildBarracks, buildVineyards, buildRoad, loadBuildingModels } from './buildings.js';
import { buildForest, buildRiver, buildGroundDetail, buildWell, loadEnvironmentModels } from './environment.js';
import { createNPCs } from './npcs.js';
import { Player3D, ThirdPersonCamera } from './player.js';
import { HUD3D } from './hud.js';
import { input } from './input.js';

// ── Renderer setup ────────────────────────────────────────────────────────────
const container = document.getElementById('renderer-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 1000);

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud = new HUD3D();

// ── Async world build with loading progress ───────────────────────────────────
async function buildWorld() {
  hud.setLoadingProgress(5);

  buildFog(scene);
  buildSky(scene);
  hud.setLoadingProgress(10);

  buildLighting(scene);
  hud.setLoadingProgress(15);

  buildTerrain(scene);
  hud.setLoadingProgress(25);

  // Load 3D models (buildings + environment) in parallel
  await Promise.all([loadBuildingModels(), loadEnvironmentModels()]);
  hud.setLoadingProgress(45);

  await tick();
  buildRoad(scene);
  buildAbbey(scene);
  hud.setLoadingProgress(55);

  await tick();
  buildInn(scene);
  buildBarracks(scene);
  buildVineyards(scene);
  hud.setLoadingProgress(65);

  await tick();
  buildWell(scene);
  buildRiver(scene);
  hud.setLoadingProgress(75);

  await tick();
  buildForest(scene);
  hud.setLoadingProgress(88);

  await tick();
  buildGroundDetail(scene);
  hud.setLoadingProgress(95);

  await tick();
}

function tick() {
  return new Promise(r => setTimeout(r, 0));
}

// ── Zone detection ─────────────────────────────────────────────────────────────
const ZONE_DEFS = [
  { name: 'SEB Headquarters',    xMin: -120, xMax:  -30, zMin: -60, zMax:  30 },
  { name: 'The Trading Floor',   xMin:  -30, xMax:   80, zMin: -80, zMax:  80 },
  { name: 'The Server Farm',     xMin:   -5, xMax:   75, zMin: -10, zMax:  90 },
  { name: 'The Data Vault',      xMin:   90, xMax:  160, zMin: -120, zMax: -40 },
  { name: 'The Coffee Stream',   xMin:   60, xMax:  110, zMin: -80, zMax:  80 },
];

function getZone(px, pz) {
  for (const z of ZONE_DEFS) {
    if (px >= z.xMin && px <= z.xMax && pz >= z.zMin && pz <= z.zMax) return z.name;
  }
  return 'Solna Business Park';
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  await buildWorld();

  // Player & camera
  const player  = new Player3D(scene);
  const camCtrl = new ThirdPersonCamera(camera, player);
  const npcs    = createNPCs(scene);

  hud.setLoadingProgress(100);
  await tick();
  hud.hideLoading();

  // Async-load glTF models (graceful fallback to box mesh if files absent)
  player.initModel();
  npcs.forEach((npc, i) => npc.initModel(i));

  // Initial HUD state
  hud.updatePlayer(100, 100, 100, 100);
  hud.showZone('SEB Headquarters', 'Solna Business Park');
  hud.addChat('Welcome to SEB, engineer. Your desk awaits.', 'sys');
  hud.addChat('WASD · Move  |  Right-click drag · Look  |  E · Talk  |  Scroll · Zoom', 'sys');
  hud.addChat('1-4 · Action bar  |  Shift · Run', 'sys');

  let currentZone    = 'SEB Headquarters';
  let targetNPC      = null;
  let interactCooldown = 0;

  const clock = new THREE.Clock();

  // ── Game loop ───────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    input.cameraYaw = camCtrl.getYaw();

    player.update(input, delta);
    camCtrl.update();

    for (const npc of npcs) npc.update(delta);

    // Zone check
    const px = player.position.x, pz = player.position.z;
    const zone = getZone(px, pz);
    if (zone !== currentZone) {
      currentZone = zone;
      hud.showZone(zone, 'Solna Business Park');
      hud.addChat(`You have entered: ${zone}`, 'sys');
    }

    // Nearest NPC interaction
    const INTERACT_RANGE = 6;
    let nearest     = null;
    let nearestDist = Infinity;
    for (const npc of npcs) {
      const d = npc.distanceTo(player.position);
      if (d < nearestDist) { nearestDist = d; nearest = npc; }
    }

    const canInteract = nearestDist < INTERACT_RANGE && !hud.isDialogueOpen;
    hud.showInteractPrompt(canInteract);
    if (canInteract && nearest !== targetNPC) {
      targetNPC = nearest;
      hud.setTarget(nearest);
    } else if (!canInteract && targetNPC) {
      targetNPC = null;
      hud.setTarget(null);
    }

    if (interactCooldown > 0) interactCooldown -= delta;
    if (input.interact && canInteract && interactCooldown <= 0) {
      input.interact = false;
      interactCooldown = 0.4;
      const line = nearest.getNextDialogue();
      hud.showDialogue(nearest.name, line);
      hud.addChat(`${nearest.name}: "${line}"`);
    }

    if (input.interact && hud.isDialogueOpen) {
      hud.closeDialogue();
      input.interact = false;
    }

    // Action bar
    if (input.actionSlot > 0) {
      const action = hud.triggerAction(input.actionSlot - 1);
      if (action) player.performAction(action, hud);
      input.actionSlot = 0;
    }
    hud.updateCooldowns(delta);

    hud.drawMinimap(player.position, npcs);

    renderer.render(scene, camera);
  }

  animate();
})();
