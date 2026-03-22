import * as THREE from 'three';
import { getHeightAt } from './world.js';
import { loadGLTF, findClip, cloneModel } from './model-loader.js';

// ── SEB Campus NPC definitions ────────────────────────────────────────────────

const NPC_DEFS = [
  {
    id: 'head_of_engineering',
    name: 'Head of Engineering',
    title: 'Cloud Platform Division',
    portrait: '🛡',
    level: 6,
    pos: [-60, -5],
    color: 0x6080a0,
    patrol: [[-60, -5], [-60, 10], [-45, 5]],
    dialogue: [
      "Welcome, engineer. I oversee the Cloud Platform Division here at SEB. We're migrating our core banking to GCP this quarter.",
      "Our Python microservices handle millions of transactions daily. Latency is measured in milliseconds — every optimisation counts.",
      "SEB has been a pillar of Nordic finance for over a century. We will not let legacy systems slow our digital transformation.",
    ],
  },
  {
    id: 'the_barista',
    name: 'The Barista',
    title: 'Fika Lounge',
    portrait: '☕',
    level: 40,
    pos: [10, 36],
    color: 0xb08040,
    dialogue: [
      "Welcome to the Fika Lounge! Grab a seat — the oat milk is fresh and the kanelbullar just came out of the oven.",
      "Engineers come through here all the time. Most are heading to the trading floor to debug latency issues.",
      "You know what they say: every successful deployment begins with a good cup of coffee and a clear head.",
    ],
  },
  {
    id: 'the_scrum_master',
    name: 'The Scrum Master',
    title: 'Agile Coach',
    portrait: '📋',
    level: 20,
    pos: [-75, -30],
    color: 0xd0d0ff,
    patrol: [[-75, -30], [-65, -30], [-65, -20], [-75, -20]],
    dialogue: [
      "The Sprint watches over all who dwell in this codebase. May it guide your velocity, developer.",
      "These are troubled times. Technical debt grows bolder, and legacy bugs push ever further into production.",
      "I facilitate the retro for those lost to merge conflicts. The standup bell rings for them at nine.",
    ],
  },
  {
    id: 'legacy_bug',
    name: 'Legacy Bug',
    title: 'Hostile',
    portrait: '🐛',
    level: 1,
    pos: [120, -80],
    color: 0xa06040,
    hostile: true,
    patrol: [[120, -80], [130, -70], [125, -90]],
    dialogue: [
      "You no take my stack trace!!",
      "Bug no want fix! Bug just want to live in production!",
      "*segfaults and lurks deeper into the legacy codebase*",
    ],
  },
  {
    id: 'devops_lead',
    name: 'DevOps Lead',
    title: 'Infrastructure Team',
    portrait: '⚙',
    level: 5,
    pos: [28, -28],
    color: 0x7090b0,
    patrol: [[28, -28], [40, -28], [40, -14], [28, -14]],
    dialogue: [
      "Keep your pipelines green out there. Flaky tests have been spotted near the server farm.",
      "The Head of Engineering has us running double deployments. Can't be too careful with compliance.",
      "I heard the audit team to the east might make a push this quarter. Keep your Terraform state clean.",
    ],
  },
  {
    id: 'data_analyst',
    name: 'The Data Analyst',
    title: 'Business Intelligence',
    portrait: '📊',
    level: 10,
    pos: [-10, 50],
    color: 0x60a060,
    dialogue: [
      "Pssst. You there — I'm not just a dashboard builder. I have access to every KPI in the organisation.",
      "The quarterly numbers are more volatile than the engineers give them credit for.",
      "If you come across any anomalous transaction patterns, report it immediately. And tell no one I showed you that data.",
    ],
  },
];

// Model assignments per NPC
const NPC_MODELS = {
  'head_of_engineering': '/assets/models/knight.glb',
  'the_barista':         '/assets/models/barbarian.glb',
  'the_scrum_master':    '/assets/models/mage.glb',
  'legacy_bug':          '/assets/models/rogue_hooded.glb',
  'devops_lead':         '/assets/models/knight.glb',
  'data_analyst':        '/assets/models/rogue.glb',
};

// ── NPC 3D class ─────────────────────────────────────────────────────────────

export class NPC3D {
  constructor(def, scene) {
    this.def          = def;
    this.name         = def.name;
    this.hostile      = def.hostile || false;
    this.dialogueIndex = 0;
    this.patrolIndex  = 0;
    this.patrolWait   = 0;
    this.patrolSpeed  = 0.04;

    this._mixer      = null;
    this._idleAction = null;
    this._walkAction = null;
    this._isMoving   = false;
    this._boxGroup   = new THREE.Group();

    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildMesh();
    this.group.add(this._boxGroup);

    this._buildLabel();

    const [wx, wz] = def.pos;
    const gy = getHeightAt(wx, wz);
    this.group.position.set(wx, gy, wz);

    this._patrolPoints = (def.patrol || [def.pos]).map(([px, pz]) => {
      const py = getHeightAt(px, pz);
      return new THREE.Vector3(px, py, pz);
    });
  }

  _buildMesh() {
    const color = this.def.color;

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.6, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body    = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    this._boxGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.38, 10, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: this.hostile ? 0x806040 : 0xe0b880 });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.9;
    head.castShadow = true;
    this._boxGroup.add(head);

    // Cloak / tabard
    const cloakGeo = new THREE.ConeGeometry(0.5, 1.0, 8, 1, true);
    const cloakMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    const cloak    = new THREE.Mesh(cloakGeo, cloakMat);
    cloak.position.y = 0.45;
    this._boxGroup.add(cloak);

    // Shadow disc
    const shadowGeo = new THREE.CircleGeometry(0.5, 10);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow    = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this._boxGroup.add(shadow);
  }

  _buildLabel() {
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 48;
    const ctx2d   = canvas.getContext('2d');

    const color   = this.hostile ? '#ff6060' : '#ffe890';
    ctx2d.font    = 'bold 22px Georgia, serif';
    ctx2d.shadowColor = 'rgba(0,0,0,0.9)';
    ctx2d.shadowBlur  = 6;
    ctx2d.fillStyle   = color;
    ctx2d.textAlign   = 'center';
    ctx2d.fillText(this.name, 128, 28);

    if (this.def.title) {
      ctx2d.font      = '16px Georgia, serif';
      ctx2d.fillStyle = this.hostile ? '#c04040' : '#90a870';
      ctx2d.fillText(this.def.title, 128, 46);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    this._label = new THREE.Sprite(mat);
    this._label.scale.set(3.0, 0.6, 1);
    this._label.position.y = 2.8;
    this.group.add(this._label);
  }

  /** Async: try to load a glTF model. Falls back to box mesh on failure. */
  async initModel(modelIndex) {
    const url  = NPC_MODELS[this.def.id];
    if (!url) return;
    const gltf = await loadGLTF(url);
    if (!gltf) return;

    this._boxGroup.visible = false;

    const model = cloneModel(gltf);
    const bbox  = new THREE.Box3().setFromObject(model);
    const modelH = bbox.max.y - bbox.min.y;
    const scale  = 1.72 / modelH;
    model.scale.setScalar(scale);
    model.position.y = -bbox.min.y * scale;
    model.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.group.add(model);

    // Update label height to sit above glTF head
    this._label.position.y = 1.72 + 0.4;

    if (gltf.animations && gltf.animations.length > 0) {
      this._mixer = new THREE.AnimationMixer(model);

      const idleClip = findClip(gltf.animations, 'Idle', 'Unarmed_Idle', 'idle', 'Stand', 'TPose');
      const walkClip = findClip(gltf.animations, 'Walking_A', 'Walking_B', 'Walk', 'Running_A');

      if (idleClip) {
        this._idleAction = this._mixer.clipAction(idleClip);
        this._idleAction.play();
      }
      if (walkClip) {
        this._walkAction = this._mixer.clipAction(walkClip);
        this._walkAction.setEffectiveWeight(0);
        this._walkAction.play();
      }
    }
  }

  update(delta) {
    if (this._patrolPoints.length < 2) {
      if (this._mixer) this._mixer.update(delta);
      return;
    }
    if (this.patrolWait > 0) {
      this.patrolWait -= delta;
      // Standing still — switch to idle
      if (this._mixer) {
        if (this._isMoving) {
          this._isMoving = false;
          if (this._idleAction && this._walkAction) {
            this._idleAction.setEffectiveWeight(1);
            this._walkAction.setEffectiveWeight(0);
          }
        }
        this._mixer.update(delta);
      }
      return;
    }

    const target  = this._patrolPoints[this.patrolIndex];
    const current = this.group.position;
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.25) {
      this.patrolIndex = (this.patrolIndex + 1) % this._patrolPoints.length;
      this.patrolWait  = 1.5 + Math.random() * 2;
      if (this._mixer) this._mixer.update(delta);
      return;
    }

    // Walking — switch to walk animation
    if (this._mixer && !this._isMoving) {
      this._isMoving = true;
      if (this._idleAction && this._walkAction) {
        this._idleAction.setEffectiveWeight(0);
        this._walkAction.setEffectiveWeight(1);
      }
    }

    const step = this.patrolSpeed;
    current.x += (dx / dist) * step;
    current.z += (dz / dist) * step;
    current.y  = getHeightAt(current.x, current.z);
    this.group.rotation.y = Math.atan2(dx, dz);

    if (this._mixer) this._mixer.update(delta);
  }

  getNextDialogue() {
    const line = this.def.dialogue[this.dialogueIndex];
    this.dialogueIndex = (this.dialogueIndex + 1) % this.def.dialogue.length;
    return line;
  }

  distanceTo(pos) {
    return this.group.position.distanceTo(pos);
  }

  get position() { return this.group.position; }
}

export function createNPCs(scene) {
  return NPC_DEFS.map(def => new NPC3D(def, scene));
}
