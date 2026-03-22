// ── WoW-style HUD manager ─────────────────────────────────────────────────────
// All manipulation is via the DOM elements defined in world/index.html.

export class HUD3D {
  constructor() {
    // Zone
    this._zoneEl    = document.getElementById('zone-name');
    this._zoneText  = document.getElementById('zone-text');
    this._zoneSub   = document.getElementById('zone-sub');
    this._zoneTimer = 0;

    // HP / MP bars
    this._hpFill  = document.getElementById('player-hp-fill');
    this._hpText  = document.getElementById('player-hp-text');
    this._mpFill  = document.getElementById('player-mp-fill');
    this._mpText  = document.getElementById('player-mp-text');

    // Target frame
    this._targetFrame   = document.getElementById('target-frame');
    this._targetName    = document.getElementById('target-name');
    this._targetLevel   = document.getElementById('target-level');
    this._targetPortrait = document.getElementById('target-portrait');
    this._targetHpFill  = document.getElementById('target-hp-fill');
    this._targetHpText  = document.getElementById('target-hp-text');

    // Chat
    this._chatEl  = document.getElementById('chat-messages');

    // Interact prompt
    this._interactEl = document.getElementById('interact-prompt');

    // Dialogue
    this._dialogueBox  = document.getElementById('dialogue-box');
    this._dialogueName = document.getElementById('dialogue-npc-name');
    this._dialogueText = document.getElementById('dialogue-text');
    document.getElementById('dialogue-close').addEventListener('click', () => this.closeDialogue());

    // Loading
    this._loadingScreen = document.getElementById('loading-screen');
    this._loadingFill   = document.getElementById('loading-bar-fill');

    // Minimap
    this._miniCanvas   = document.getElementById('minimap-canvas');
    this._miniCtx      = this._miniCanvas.getContext('2d');
    this._minimapBuilt = false;

    this._buildActionBar();
    this._zoneTimer = 0;
  }

  // ── Loading bar ────────────────────────────────────────────────────────────
  setLoadingProgress(pct) {
    this._loadingFill.style.width = pct + '%';
  }

  hideLoading() {
    this._loadingScreen.classList.add('fade-out');
    setTimeout(() => { this._loadingScreen.style.display = 'none'; }, 1100);
  }

  // ── Zone popup ─────────────────────────────────────────────────────────────
  showZone(name, subName = 'Solna Business Park') {
    this._zoneText.textContent = name;
    this._zoneSub.textContent  = subName;
    this._zoneEl.classList.add('visible');
    clearTimeout(this._zoneTimeout);
    this._zoneTimeout = setTimeout(() => this._zoneEl.classList.remove('visible'), 4200);
  }

  // ── Player bars ───────────────────────────────────────────────────────────
  updatePlayer(hp, maxHp, mp, maxMp) {
    const hpPct = (hp / maxHp) * 100;
    const mpPct = (mp / maxMp) * 100;
    this._hpFill.style.width = hpPct + '%';
    this._mpFill.style.width = mpPct + '%';
    this._hpText.textContent = `${hp} / ${maxHp}`;
    this._mpText.textContent = `${mp} / ${maxMp}`;
  }

  // ── Target frame ──────────────────────────────────────────────────────────
  setTarget(npcDef) {
    if (!npcDef) {
      this._targetFrame.classList.add('hidden');
      return;
    }
    this._targetFrame.classList.remove('hidden');
    this._targetName.textContent    = npcDef.def.name;
    this._targetLevel.textContent   = `Lv ${npcDef.def.level}`;
    this._targetPortrait.textContent = npcDef.def.portrait;
    this._targetHpFill.style.width  = '100%';
    this._targetHpText.textContent  = `${npcDef.def.level * 25} / ${npcDef.def.level * 25}`;
  }

  // ── Interact prompt ───────────────────────────────────────────────────────
  showInteractPrompt(show) {
    if (show)  this._interactEl.classList.remove('hidden');
    else       this._interactEl.classList.add('hidden');
  }

  // ── Dialogue popup ─────────────────────────────────────────────────────────
  showDialogue(npcName, text) {
    this._dialogueName.textContent = npcName;
    this._dialogueText.textContent = text;
    this._dialogueBox.classList.remove('hidden');
  }

  closeDialogue() {
    this._dialogueBox.classList.add('hidden');
  }

  get isDialogueOpen() {
    return !this._dialogueBox.classList.contains('hidden');
  }

  // ── Chat messages ─────────────────────────────────────────────────────────
  addChat(text, type = 'normal') {
    const el = document.createElement('div');
    el.className = 'chat-line' + (type === 'sys' ? ' sys' : '');
    el.textContent = text;
    this._chatEl.appendChild(el);
    this._chatEl.scrollTop = this._chatEl.scrollHeight;
    // Auto-remove after 12s
    setTimeout(() => el.remove(), 12000);
  }

  // ── Minimap ───────────────────────────────────────────────────────────────
  drawMinimap(playerPos, npcs) {
    const ctx  = this._miniCtx;
    const W    = this._miniCanvas.width;
    const H    = this._miniCanvas.height;
    const HALF = 245; // half world size

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#1a2810';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    // World → minimap coords
    const toMM = (wx, wz) => ({
      x: (wx / HALF * 0.5 + 0.5) * W,
      y: (wz / HALF * 0.5 + 0.5) * H,
    });

    // Road (tan line)
    ctx.strokeStyle = '#7a6a48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 30; i++) {
      const wx = -64 + i * 14;
      const wz = Math.sin(i * 0.3) * 8;
      const mm = toMM(wx, wz);
      i === 0 ? ctx.moveTo(mm.x, mm.y) : ctx.lineTo(mm.x, mm.y);
    }
    ctx.stroke();

    // River (blue line)
    ctx.strokeStyle = '#2a5080';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t  = i / 20;
      const wx = 80 + Math.sin(t * Math.PI * 1.8) * 25;
      const wz = -200 + t * 400;
      const mm = toMM(wx, wz);
      i === 0 ? ctx.moveTo(mm.x, mm.y) : ctx.lineTo(mm.x, mm.y);
    }
    ctx.stroke();

    // Abbey (gold square)
    const abbeyMM = toMM(-80, -20);
    ctx.fillStyle = '#c8a020';
    ctx.fillRect(abbeyMM.x - 5, abbeyMM.y - 4, 10, 8);

    // NPCs dots
    for (const npc of npcs) {
      const nm = toMM(npc.position.x, npc.position.z);
      ctx.fillStyle = npc.hostile ? '#e04040' : '#f0e060';
      ctx.beginPath();
      ctx.arc(nm.x, nm.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player dot (white, larger)
    const pm = toMM(playerPos.x, playerPos.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pm.x, pm.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Border ring
    ctx.strokeStyle = '#7a6020';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Action bar ────────────────────────────────────────────────────────────

  static ACTIONS = [
    { id: 'deploy',  icon: '⚡', name: 'Deploy Code',    cd: 1.5, type: 'combat' },
    { id: 'review',  icon: '🔍', name: 'Code Review',   cd: 8,   type: 'combat' },
    { id: 'coffee',  icon: '☕', name: 'Coffee Break',  cd: 6,   type: 'spell'  },
    { id: 'monitor', icon: '🖥', name: 'Toggle Monitor',cd: 0.5, type: 'utility'},
  ];

  _buildActionBar() {
    const slotsEl = document.getElementById('action-slots');
    slotsEl.innerHTML = '';
    this._slotEls  = [];
    this._cooldowns = new Array(HUD3D.ACTIONS.length).fill(0);

    HUD3D.ACTIONS.forEach((action, i) => {
      const slot = document.createElement('div');
      slot.className = 'action-slot';
      slot.title = `${action.name} (${i + 1})`;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'slot-icon';
      iconSpan.textContent = action.icon;

      const cdOverlay = document.createElement('div');
      cdOverlay.className = 'slot-cooldown';

      const cdText = document.createElement('span');
      cdText.className = 'slot-cd-text';

      const keySpan = document.createElement('span');
      keySpan.className = 'slot-key';
      keySpan.textContent = i + 1;

      slot.appendChild(iconSpan);
      slot.appendChild(cdOverlay);
      slot.appendChild(cdText);
      slot.appendChild(keySpan);

      slot.addEventListener('click', () => this.triggerAction(i));
      slotsEl.appendChild(slot);
      this._slotEls.push({ slot, cdOverlay, cdText });
    });
  }

  triggerAction(slotIndex) {
    if (slotIndex < 0 || slotIndex >= HUD3D.ACTIONS.length) return null;
    if (this._cooldowns[slotIndex] > 0) return null;
    const action = HUD3D.ACTIONS[slotIndex];
    this._cooldowns[slotIndex] = action.cd;
    this._slotEls[slotIndex].slot.classList.add('action-active');
    setTimeout(() => this._slotEls[slotIndex].slot.classList.remove('action-active'), 150);
    return action;
  }

  updateCooldowns(delta) {
    for (let i = 0; i < HUD3D.ACTIONS.length; i++) {
      const el = this._slotEls[i];
      if (this._cooldowns[i] > 0) {
        this._cooldowns[i] = Math.max(0, this._cooldowns[i] - delta);
        const action = HUD3D.ACTIONS[i];
        const pct = this._cooldowns[i] / action.cd;
        el.cdOverlay.style.height = (pct * 100) + '%';
        el.cdText.textContent = this._cooldowns[i] > 0 ? this._cooldowns[i].toFixed(1) : '';
        el.slot.classList.toggle('on-cooldown', this._cooldowns[i] > 0);
      } else {
        el.cdOverlay.style.height = '0%';
        el.cdText.textContent = '';
        el.slot.classList.remove('on-cooldown');
      }
    }
  }
}
