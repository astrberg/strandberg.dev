import * as THREE from 'three';
import { buildTerrain, buildLighting, buildSky, buildFog, getHeightAt } from './world.js';
import {
  buildAbbey,
  buildInn,
  buildBarracks,
  buildVineyards,
  buildRoad,
  loadBuildingModels,
} from './buildings.js';
import { buildForest, buildRiver, loadEnvironmentModels } from './environment.js';
import { createNPCs } from './npcs.js';
import { Player3D, ThirdPersonCamera } from './player.js';
import { HUD3D } from './hud.js';
import { input } from './input.js';
import { clearColliders } from './physics.js';

// ── Renderer setup ────────────────────────────────────────────────────────────
const container = document.getElementById('renderer-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// PCFShadowMap (4 samples) vs PCFSoftShadowMap (9 samples) — ~50% shadow cost saving
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 1000);

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud = new HUD3D();

// ── Async world build with loading progress ───────────────────────────────────
async function buildWorld() {
  clearColliders();
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
  buildRiver(scene);
  hud.setLoadingProgress(75);

  await tick();
  buildForest(scene);
  hud.setLoadingProgress(88);

  await tick();
  hud.setLoadingProgress(95);

  await tick();
}

function tick() {
  return new Promise(r => setTimeout(r, 0));
}

// ── Zone detection ─────────────────────────────────────────────────────────────
const ZONE_DEFS = [
  { name: 'Northshire Valley', xMin: -120, xMax: 120, zMin: -120, zMax: -30 },
  { name: 'Goldshire Crossroads', xMin: -35, xMax: 35, zMin: -30, zMax: 60 },
  { name: 'Crystal Lake', xMin: 35, xMax: 120, zMin: -30, zMax: 60 },
  { name: 'Fargodeep Mine', xMin: -120, xMax: 120, zMin: 60, zMax: 120 },
];

function getZone(px, pz) {
  for (const z of ZONE_DEFS) {
    if (px >= z.xMin && px <= z.xMax && pz >= z.zMin && pz <= z.zMax) return z.name;
  }
  return 'Elwynn Forest';
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  await buildWorld();

  // Player & camera
  const player = new Player3D(scene);
  const camCtrl = new ThirdPersonCamera(camera, player);
  const npcs = createNPCs(scene);

  // Link player reference to HUD for speech bubbles
  hud.player = player;

  // Load saved level & experience progress
  player.loadProgress(hud);

  hud.setLoadingProgress(100);
  await tick();
  hud.hideLoading();

  // Async-load glTF models (graceful fallback to box mesh if files absent)
  player.initModel();
  npcs.forEach((npc, i) => npc.initModel(i));

  // Initial HUD state
  hud.updatePlayer(100, 100, 100, 100);
  const initialZone = getZone(player.position.x, player.position.z);
  hud.showZone(initialZone, 'Elwynn Forest');
  player.discoverZone(initialZone, hud);
  hud.addChat('Welcome, traveler. Your journey begins.', 'sys');
  hud.addChat('WASD · Move  |  Right-click drag · Look  |  E · Talk  |  Scroll · Zoom', 'sys');
  hud.addChat('1-4 · Action bar  |  Shift · Run', 'sys');

  let currentZone = initialZone;
  let targetNPC = null;
  let interactCooldown = 0;
  let _frameTick = 0; // used to throttle infrequent checks

  // Mouse click targeting using Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // Only left click
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const npcObjects = npcs.map(n => n.group);
    const intersects = raycaster.intersectObjects(npcObjects, true);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      let curr = hitObj;
      while (curr) {
        const found = npcs.find(n => n.group === curr);
        if (found) {
          targetNPC = found;
          hud.setTarget(found);
          return;
        }
        curr = curr.parent;
      }
    }
  });

  // Tab (cycle target) and Escape (clear target) key handlers
  let tabIndex = 0;
  window.addEventListener('keydown', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const aliveNpcs = npcs.filter(n => !n.isDead);
      if (aliveNpcs.length === 0) return;

      // Sort by distance to player
      aliveNpcs.sort((a, b) => a.distanceTo(player.position) - b.distanceTo(player.position));

      tabIndex = (tabIndex + 1) % aliveNpcs.length;
      targetNPC = aliveNpcs[tabIndex];
      hud.setTarget(targetNPC);
    }

    if (e.key === 'Escape') {
      targetNPC = null;
      hud.setTarget(null);
    }
  });

  const clock = new THREE.Clock();

  // ── Game loop ───────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    input.cameraYaw = camCtrl.getYaw();
    input.isDragging = camCtrl._isDragging;

    player.update(input, delta, hud);
    camCtrl.update(input, delta);

    for (const npc of npcs) npc.update(delta, player, hud);

    // Zone check — throttled to every 10 frames (zones are large, no need to check every tick)
    if (++_frameTick % 10 === 0) {
      const px = player.position.x,
        pz = player.position.z;
      const zone = getZone(px, pz);
      if (zone !== currentZone) {
        currentZone = zone;
        hud.showZone(zone, 'Elwynn Forest');
        hud.addChat(`You have entered: ${zone}`, 'sys');
        player.discoverZone(zone, hud);
      }
    }

    // Nearest NPC interaction
    const INTERACT_RANGE = 6;
    let nearest = null;
    let nearestDist = Infinity;
    for (const npc of npcs) {
      const d = npc.distanceTo(player.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = npc;
      }
    }

    // Target leash check: clear target if it dies or is too far away (> 35 units)
    if (targetNPC) {
      const dist = targetNPC.distanceTo(player.position);
      if (dist > 35 || targetNPC.isDead) {
        targetNPC = null;
        hud.setTarget(null);
      }
    }

    const canInteract =
      nearestDist < INTERACT_RANGE && !hud.isDialogueOpen && nearest && !nearest.isDead;
    hud.showInteractPrompt(canInteract, nearest && nearest.hostile);

    if (interactCooldown > 0) interactCooldown -= delta;
    if (input.interact && canInteract && interactCooldown <= 0) {
      input.interact = false;
      interactCooldown = 0.4;

      // Auto-target on interact
      if (targetNPC !== nearest) {
        targetNPC = nearest;
        hud.setTarget(nearest);
      }

      const line = nearest.getNextDialogue();

      if (nearest.hostile) {
        // Melee attack trigger on E
        player._playOnce('1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop');
        const dmg = 5 + Math.floor(Math.random() * 5);
        hud.addChat(`You hit ${nearest.name} for ${dmg} damage!`, 'sys');
        nearest.takeDamage(dmg, player, hud);

        // Still trigger dialogue shout
        hud.addChat(`${nearest.name}: "${line}"`);
        hud.spawnSpeechBubble(nearest.def.id, nearest.group, line);
      } else {
        // Friendly merchant dialogue UI
        player.talkToNpc(nearest.def.id, nearest.name, hud);
        hud.showDialogue(nearest.name, line);
        hud.addChat(`${nearest.name}: "${line}"`);
        hud.spawnSpeechBubble(nearest.def.id, nearest.group, line);
      }
    }

    if (input.interact && hud.isDialogueOpen) {
      hud.closeDialogue();
      input.interact = false;
    }

    // Action bar
    if (input.actionSlot > 0) {
      const action = hud.triggerAction(input.actionSlot - 1);
      if (action) player.performAction(action, hud, targetNPC);
      input.actionSlot = 0;
    }
    hud.updateCooldowns(delta);

    hud.drawMinimap(player.position, npcs);
    hud.updateSpeechBubbles(camera);

    renderer.render(scene, camera);
  }

  animate();
})();
