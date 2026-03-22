import * as THREE from 'three';
import { getHeightAt } from './world.js';
import { loadGLTF, findClip, cloneModel } from './model-loader.js';

export const PLAYER_HEIGHT = 1.75;
export const PLAYER_SPEED  = 8.0;
export const PLAYER_RUN_MULT = 1.85;

export class Player3D {
  constructor(scene) {
    this.hp    = 100;
    this.maxHp = 100;
    this.mp    = 100;
    this.maxMp = 100;

    this._mixer      = null;
    this._animations = null;
    this._idleAction = null;
    this._walkAction = null;
    this._runAction  = null;
    this._isMoving   = false;
    this._isRunning  = false;
    this._scene      = scene;
    this._boxGroup   = new THREE.Group(); // holds the fallback box mesh children

    // The player "body" group — camera is attached above this
    this.group = new THREE.Group();
    this.group.position.set(-50, 0, 0);
    this.group.position.y = getHeightAt(-50, 0);
    scene.add(this.group);

    // Build fallback box mesh inside _boxGroup, add _boxGroup to main group
    this._buildMesh();
    this.group.add(this._boxGroup);

    // Camera pivot
    this.cameraPivot = new THREE.Object3D();
    this.group.add(this.cameraPivot);
  }

  _buildMesh() {
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.36, 1.6, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3860c0 });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    this._boxGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 10, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xe8b870 });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.88;
    head.castShadow = true;
    this._boxGroup.add(head);

    // Cloak
    const cloakGeo = new THREE.ConeGeometry(0.48, 1.0, 8, 1, true);
    const cloakMat = new THREE.MeshLambertMaterial({ color: 0x1a3880, side: THREE.DoubleSide });
    const cloak    = new THREE.Mesh(cloakGeo, cloakMat);
    cloak.position.y = 0.4;
    this._boxGroup.add(cloak);

    // Shadow disc
    const sGeo = new THREE.CircleGeometry(0.45, 10);
    const sMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
    const s    = new THREE.Mesh(sGeo, sMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.02;
    this._boxGroup.add(s);
  }

  /** Async: try to load a glTF human model. Falls back to box mesh on failure. */
  async initModel() {
    const gltf = await loadGLTF('/assets/models/knight.glb');
    if (!gltf) return;

    this._boxGroup.visible = false;

    const model = cloneModel(gltf);

    const bbox = new THREE.Box3().setFromObject(model);
    const modelH = bbox.max.y - bbox.min.y;
    const scale  = PLAYER_HEIGHT / modelH;
    model.scale.setScalar(scale);
    model.position.y = -bbox.min.y * scale;

    model.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
    this.group.add(model);

    if (gltf.animations && gltf.animations.length > 0) {
      this._mixer = new THREE.AnimationMixer(model);
      this._animations = gltf.animations;

      const idleClip = findClip(gltf.animations, 'Idle', 'Unarmed_Idle', 'idle', 'TPose');
      const walkClip = findClip(gltf.animations, 'Walking_A', 'Walking_B', 'Walk', 'Running_A');
      const runClip  = findClip(gltf.animations, 'Running_A', 'Running_B', 'Run');

      if (idleClip) {
        this._idleAction = this._mixer.clipAction(idleClip);
        this._idleAction.play();
      }
      if (walkClip) {
        this._walkAction = this._mixer.clipAction(walkClip);
        this._walkAction.setEffectiveWeight(0);
        this._walkAction.play();
      }
      if (runClip && runClip !== walkClip) {
        this._runAction = this._mixer.clipAction(runClip);
        this._runAction.setEffectiveWeight(0);
        this._runAction.play();
      }
    }
  }

  get position() { return this.group.position; }

  // ── Action abilities ────────────────────────────────────────────────────────
  _torchLight = null;

  performAction(action, hud) {
    switch (action.id) {
      case 'deploy':
        this._playOnce('1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop');
        hud.addChat('You push to production!', 'sys');
        break;
      case 'review':
        this._playOnce('Blocking', 'Block');
        hud.addChat('You review a pull request.', 'sys');
        break;
      case 'coffee': {
        const heal = 15 + Math.floor(Math.random() * 10);
        this.hp = Math.min(this.maxHp, this.hp + heal);
        hud.updatePlayer(this.hp, this.maxHp, this.mp, this.maxMp);
        hud.addChat(`Coffee break restores ${heal} energy. (${this.hp}/${this.maxHp})`, 'sys');
        this._playOnce('Spellcast_Shoot', 'Spellcast_Raise', 'Interact');
        break;
      }
      case 'monitor':
        this._toggleTorch();
        hud.addChat(this._torchLight ? 'Monitor on.' : 'Monitor off.', 'sys');
        break;
    }
  }

  _playOnce(...clipNames) {
    if (!this._mixer || !this._animations) return;
    for (const name of clipNames) {
      const clip = this._animations.find(c => c.name === name);
      if (clip) {
        const action = this._mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.reset().play();
        // Return to idle after completion
        const dur = clip.duration * 1000;
        setTimeout(() => action.stop(), dur + 50);
        return;
      }
    }
  }

  _toggleTorch() {
    if (this._torchLight) {
      this.group.remove(this._torchLight);
      this._torchLight = null;
    } else {
      this._torchLight = new THREE.PointLight(0xffaa44, 2, 20);
      this._torchLight.position.set(0.5, 2.2, 0.3);
      this.group.add(this._torchLight);
    }
  }

  update(inputState, delta) {
    const { forward, back, left, right, running } = inputState;
    const speed = PLAYER_SPEED * (running ? PLAYER_RUN_MULT : 1.0) * delta;

    // Movement relative to the camera's horizontal facing
    const yaw = inputState.cameraYaw;

    let mx = 0, mz = 0;
    if (forward) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
    if (back)    { mx += Math.sin(yaw); mz += Math.cos(yaw); }
    if (left)    { mx -= Math.sin(yaw + Math.PI / 2); mz -= Math.cos(yaw + Math.PI / 2); }
    if (right)   { mx -= Math.sin(yaw - Math.PI / 2); mz -= Math.cos(yaw - Math.PI / 2); }

    const moving = mx !== 0 || mz !== 0;

    if (moving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;

      this.group.position.x += mx;
      this.group.position.z += mz;

      // Clamp to world bounds
      const h = HALF_WORLD;
      this.group.position.x = Math.max(-h, Math.min(h, this.group.position.x));
      this.group.position.z = Math.max(-h, Math.min(h, this.group.position.z));

      // Face direction of travel
      this.group.rotation.y = Math.atan2(mx, mz);
    }

    // Terrain follow
    const targetY = getHeightAt(this.group.position.x, this.group.position.z);
    this.group.position.y += (targetY - this.group.position.y) * 0.25;

    // Animation blending
    if (this._mixer) {
      const wasMoving  = this._isMoving;
      const wasRunning = this._isRunning;
      this._isMoving  = moving;
      this._isRunning = moving && running;

      if (moving !== wasMoving || (moving && running !== wasRunning)) {
        if (this._idleAction) this._idleAction.setEffectiveWeight(moving ? 0 : 1);
        if (this._walkAction) this._walkAction.setEffectiveWeight(moving && !running ? 1 : 0);
        if (this._runAction)  this._runAction.setEffectiveWeight(moving && running ? 1 : 0);
        if (moving && !running && !this._runAction && this._walkAction) {
          this._walkAction.setEffectiveWeight(1);
        }
        if (moving && running && !this._runAction && this._walkAction) {
          this._walkAction.setEffectiveWeight(1);
        }
      }
      this._mixer.update(delta);
    }
  }
}

const HALF_WORLD = 245;

// ── Third-person camera controller ───────────────────────────────────────────

export class ThirdPersonCamera {
  constructor(camera, player) {
    this.camera  = camera;
    this.player  = player;
    this.yaw     = 0;
    this.pitch   = 0.35;
    this.dist    = 14;
    this.minDist = 1.5;
    this.maxDist = 45;
    this.minPitch = 0.05;
    this.maxPitch = 1.35;

    this._isDragging = false;
    this._lastMX     = 0;
    this._lastMY     = 0;

    this._bindEvents();
  }

  _bindEvents() {
    const canvas = document.getElementById('renderer-container');

    canvas.addEventListener('mousedown', e => {
      if (e.button === 1 || e.button === 2) {
        this._isDragging = true;
        this._lastMX = e.clientX;
        this._lastMY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 1 || e.button === 2) this._isDragging = false;
    });

    window.addEventListener('mousemove', e => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastMX;
      const dy = e.clientY - this._lastMY;
      this._lastMX = e.clientX;
      this._lastMY = e.clientY;
      this.yaw   -= dx * 0.006;
      this.pitch += dy * 0.005;
      this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    });

    canvas.addEventListener('wheel', e => {
      this.dist += e.deltaY * 0.02;
      this.dist  = Math.max(this.minDist, Math.min(this.maxDist, this.dist));
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  getYaw() { return this.yaw; }

  update() {
    const p = this.player.position;

    // Camera orbit around player
    const camX = p.x + Math.sin(this.yaw)   * Math.cos(this.pitch) * this.dist;
    const camZ = p.z + Math.cos(this.yaw)   * Math.cos(this.pitch) * this.dist;
    const camY = p.y + PLAYER_HEIGHT + Math.sin(this.pitch) * this.dist;

    // Don't go below terrain
    const terrainAtCam = getHeightAt(camX, camZ) + 0.5;
    this.camera.position.set(camX, Math.max(terrainAtCam, camY), camZ);

    // Look at the player's shoulders
    const lookAt = new THREE.Vector3(p.x, p.y + PLAYER_HEIGHT * 1.1, p.z);
    this.camera.lookAt(lookAt);
  }
}
