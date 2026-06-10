---
name: threejs-game
description: Guidelines for maintaining, debugging, and extending the Three.js 3D game engine, modular OOP scripts, heightmap calculations, glTF animations, and the WoW-style HTML/CSS HUD overlay.
---

# Skill: Three.js Game Client Maintenance & Development

This skill governs the development, maintenance, and optimization of the custom WoW-style 3D campus web game located under `/world/` and driven by client scripts in `assets/js/game3d/`.

---

## 🚨 Critical Agent Decisions Checklist (Quick Reference)

Before making any changes to the 3D client, review this checklist to prevent common bugs, memory leaks, and performance regressions:

- [ ] **No Input Focus Guards on `keyup`**: Never block `keyup` events from resetting input state (e.g., clearing `input.forward = false`), even if the user has focused on an `<input>` element. Blocking key release causes stuck-walking.
- [ ] **WebGL Garbage Collection**: When removing temporary visual effects, meshes, or groups (e.g., level-up cylinders, rings, particles), always traverse and explicitly call `.geometry.dispose()` and `.material.dispose()`. Removing from the scene does *not* free GPU memory.
- [ ] **Web Audio API over Media Files**: Synthesize audio effects (like level-up chimes or combat ticks) dynamically using `OscillatorNode` and `GainNode`. This bypasses CORS issues, slow loading, and external dependencies.
- [ ] **Boundary Shadow Optimization**: Do *not* enable shadow-casting or shadow-receiving on boundary/forest meshes. Restrict shadows to active gameplay areas (height <= 4.0) to save thousands of depth rendering draws.
- [ ] **Vertical HUD Budgeting**: Keep interactive and dialogue overlays positioned above the action bar and experience bar (e.g., `#interact-prompt` at `bottom: 95px`, `#dialogue-box` at `bottom: 120px`). Always check for vertical overlaps when styling new UI elements.
- [ ] **Distance Pre-checks for Physics**: In physics loops, use squared distance pre-checks (`dx * dx + dz * dz < minDist * minDist`) before calculating square roots (`Math.sqrt()`). This avoids wasting CPU cycles.
- [ ] **Enforce MAX_LEVEL = 10 Cap**: Clamp player leveling and experience at Level 10. Once reached, show 'Level Cap Reached' on the XP bar, append the `(Elite)` suffix to the player level text, add the `.elite-frame` class, and do not print or award further experience points.
- [ ] **Energy Costs & Passive Recovery**: Ensure attacks (`deploy` costs 25 Energy, `review` costs 40 Energy) check the player's energy pool, abort with 'Not enough energy!' if insufficient, and recover energy passively at 20 Energy/second. Coffee is free of energy cost (cooldown-only).
- [ ] **Mobile Touch Steer & Drag Safety**: Prevent page scrolling/bouncing when dragging the virtual joystick or camera viewport on mobile by calling `e.preventDefault()` inside touch handlers with `{ passive: false }`. Always stop touch propagation on buttons/controls to prevent unintended raycast targeting.

---

## Architecture Overview

The game uses modular vanilla ES6 JavaScript to drive a Three.js-based 3D environment, separating concerns into individual classes:

*   **Game Loop & Orchestration ([main.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/main.js))**: Initializes the renderer, camera, lighting, environment, player, NPCs, and handles the `requestAnimationFrame` update loop.
*   **Player Mechanics ([player.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/player.js))**: Manages the local player's movement, jump physics (gravity, falling snapping), mouse-based camera controls (look-at angles and scroll zoom), and collision resolution.
*   **Physics Engine ([physics.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/physics.js))**: Runs a 2D top-down collision system on the X-Z plane, resolving bounding shapes (circles and AABB boxes) to push characters out of static obstacles.
*   **NPC Behaviors ([npcs.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/npcs.js))**: Defines all non-player characters (e.g., Smiths, Innkeepers, Kobolds), their patrol pathing coordinates, combat states (aggro leashing, melee attacks), respawn cycles, and dialogues.
*   **Heightmap & Terrain ([world.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/world.js))**: Exports `getHeightAt(x, z)` to position players and NPCs correctly on the terrain, detecting hills, slopes, and water surfaces.
*   **Asset Loading ([model-loader.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/model-loader.js))**: Asynchronously downloads `.glb` models, handles auto-scaling of assets based on bounding boxes, clones templates, and sets up `AnimationMixer` keyframes (`Idle`, `Walking`, `Death`).
*   **WoW-Style HUD & Interface ([hud.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/hud.js))**: Connects the 3D world states to HTML/CSS overlays, presenting character nameplates, dynamic HP/MP bars, level metrics, action bar slots, chat boxes, and dialogue typing animations.

---

## Detailed Best Practices & Optimization Guidelines

### 1. WebGL Memory Management & Garbage Collection

> [!IMPORTANT]
> Merely calling `scene.remove(mesh)` does NOT free GPU VRAM. The geometry and materials remain allocated in WebGL memory, causing severe leaks over time.

When cleaning up transient 3D entities (e.g., level-up particle systems, custom indicators, projectiles):
*   Iterate through all child meshes of a group or object.
*   Call `.geometry.dispose()` on the geometry.
*   Call `.material.dispose()` on the materials (or traverse them if it's an array).
*   Call `parent.remove(child)` to clean up the hierarchy.

*Example Code:*
```javascript
// Clean up an effect group
this.group.remove(fx.group);
fx.beam.geometry.dispose();
fx.beam.material.dispose();
fx.sparks.forEach(s => {
  s.geometry.dispose();
  s.material.dispose();
});
```

### 2. Self-Contained Sound Synthesis (Web Audio API)

To keep the client lightweight, offline-capable, and immune to CORS or network load failures, implement audio effects using the Web Audio API instead of loading external `.mp3` or `.wav` files.

*Guidelines:*
*   Always instantiate the `AudioContext` inside a user-gesture handler or defer it to run lazily.
*   Use `OscillatorNode` for pitch generation (sine/triangle/sawtooth/square) and `GainNode` for envelopes (attack, sustain, decay, release).
*   Ramp frequencies exponentially (`exponentialRampToValueAtTime`) to synthesize dynamic slide sounds.

*Example Code:*
```javascript
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const now = audioCtx.currentTime;

const osc = audioCtx.createOscillator();
const gainNode = audioCtx.createGain();

osc.type = 'triangle';
osc.frequency.setValueAtTime(587.33, now); // D5
osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // Chord swell to D6

gainNode.gain.setValueAtTime(0.35, now);
gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // Smooth decay

osc.connect(gainNode);
gainNode.connect(audioCtx.destination);

osc.start(now);
osc.stop(now + 1.3);
```

### 3. Input Control & Focus Safety

To prevent the character from getting stuck walking in a direction when chat input is opened, follow these rules:

*   **Keydown Listeners**: Check if the user is typing in a text field before updating inputs.
    ```javascript
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      return;
    }
    ```
*   **Keyup Listeners**: **Never** check if the user is focused on an input element. Key releases must *always* clear movement flags to prevent movement states from being locked on focus change.
*   **State Reset on Toggle**: When toggling chat (e.g., on the `Enter` key), explicitly set all input flags (`forward`, `back`, `left`, `right`, `jump`, `running`) to `false`.

### 4. GPU Shadow Tuning & Boundary Optimization

Shadow mapping is one of the most expensive operations in Three.js, multiplying the draw call count by the number of shadow-casting lights.

*   **Boundary Meshes**: The 2,500+ boundary trees and rocks on mountains are inaccessible to players. Set `castShadow = false` and `receiveShadow = false` on them.
*   **Active Valley Play Zone**: Only enable shadows (`castShadow = true`, `receiveShadow = true`) for meshes in the playable valley floor (e.g., where terrain height `getHeightAt(x, z) <= 4.0`).
*   **Geometry Merging**: For procedural boundary objects (like fallback cylinders or cones), merge their geometries into a single mesh via `BufferGeometryUtils.mergeGeometries()` to reduce thousands of draw calls to a single call.

### 5. Vertical HUD Budgeting & Overlay Offsets

The screen-space HUD overlay at the bottom center can lead to element overlap when multiple panels are active. Maintain standard vertical positions relative to the screen bottom:

*   **Experience Bar**: Positioned at the very bottom center, right above the action bar (`margin-bottom: 5px`).
*   **Action Bar**: Sits at the bottom center, anchoring slot boxes.
*   **Interact Prompt**: Anchored at `bottom: 95px` (above the action bar).
*   **Dialogue Box**: Anchored at `bottom: 120px` (above the interact prompt and action bar).

Always ensure new elements added to the bottom center maintain this layout hierarchy.

### 6. Physics Collision Pre-checks

When running frame-update checks against colliders:
*   Avoid performing square root operations (`Math.sqrt()`) directly for distant colliders.
*   Perform a fast squared distance pre-check first:
    ```javascript
    const dx = position.x - c.x;
    const dz = position.z - c.z;
    const minDist = radius + c.radius;
    // Fast bounding box overlap check
    if (Math.abs(dx) < minDist && Math.abs(dz) < minDist) {
      const distSq = dx * dx + dz * dz;
      const minDistSq = minDist * minDist;
      if (distSq < minDistSq) {
        // Only run Math.sqrt inside here if collision is confirmed
        const dist = Math.sqrt(distSq);
        // ... resolve overlap
      }
    }
    ```

### 7. GDPR-Compliant Local Save States

To keep the game progress saved across page reloads without requiring complex user authentication or legal cookie banners:
*   Store player progression (level, current XP, discovered zones, met NPC IDs) inside a local browser cookie (`game_progress`).
*   Configure the cookie with `SameSite=Strict; path=/; max-age=31536000` to prevent cross-site request forgery.
*   Do *not* record any identifying information, session hashes, or track user IP addresses/behavior, making it strictly a functional cookie exempt from GDPR/CCPA consent banners.

### 8. Strict UI/Logic Decoupling

Do not bundle raw DOM manipulation inside rendering loops or physics updates.
*   **3D Engine**: Mutates world state variables (health, experience, level, coords) inside player/NPC/physics classes.
*   **HUD Manager**: Provides modular update functions (e.g. `updatePlayer(hp, maxHp, mp, maxMp)`, `updateXpBar(xp, maxXp)`) called only when those states change.
*   Use floating projected UI overlays (`speech-bubbles-container`) by converting 3D coordinates to NDC and mapping to CSS absolute top/left coordinates.

### 9. Heightmap Terrain Alignment

*   Always position entities relative to the heightmap.
*   Compute terrain height via `getHeightAt(x, z)` in [world.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/world.js).
*   For complex models, fetch the bottom of the bounding box via `new THREE.Box3().setFromObject(model)` and subtract `bbox.min.y` from the positioning vector so the model sits perfectly on the ground rather than clipping through it.

### 10. glTF Asset Integration & Scaling

*   Models are downloaded asynchronously. Keep a basic primitive fallback (e.g. a cylinder/cone structure) visible on load, and swap it with the glTF model when the promise resolves.
*   Standardize sizes dynamically using the model's computed bounding box height to match expected human height (~1.75 units).

### 11. NPC Pathing, Aggro, & Respawns

*   Patrol points should be relative to coordinates on the terrain.
*   Track hostile state transitions: `Patrol` -> `Chase` (when player is within aggro range) -> `Combat` -> `Leash/Return` (if player moves beyond maximum leash distance, or dies).
*   When a hostile NPC is killed, set a timer to trigger its respawn, reset its health, and restore it to its home spawn point.

### 12. Exploration & Interaction Progression

*   Award experience points for discovering new regions or interacting with NPCs.
*   Ensure that experience is awarded only on the *first* visit or interaction. Store the list of completed zones and NPCs in the progression cookie to prevent exploits.
*   **Level 10 Cap**: Once the player reaches `MAX_LEVEL = 10`, no further experience can be earned. Check `this.level < MAX_LEVEL` before displaying XP gain messages or calling `gainXp` during combat, discovery, or dialogue interactions. Update the XP bar to read "Level Cap Reached" and stay fully filled. Apply the `.elite-frame` class to the player frame and append the `(Elite)` suffix to their level text.
*   **Damage & Healing Scaling**: Player action abilities (`deploy`, `review`, and `coffee`) scale dynamically with the player's level. Apply a `levelMult = 1 + (this.level - 1) * 0.15` multiplier (a 15% boost per level) to the base damage and healing values.

### 13. HUD Chat Commands & Slash Cheat Codes

The HUD system includes a chat console input activated by the `Enter` key. Custom slash commands are processed inside the `_processChatCommand(text)` method of [hud.js](file:///home/aronh/projects/strandberg.dev/assets/js/game3d/hud.js).

*   **Supported Commands**:
    *   `/help`: Prints the list of available commands in the chat console.
    *   `/roll`: Roll a random number between 1 and 100.
    *   `/dance`: Output a funny dance message.
    *   `/who`: Lists simulated online users.
    *   `/levelup` (Cheat): Awards the player the exact amount of experience required to level up once.
    *   `/maxlevel` or `/poweroverwhelming` (Cheat): Instantly levels the player up to the Level 10 cap (elite frame state).
*   **Best Practices**:
    *   When implementing cheat codes or admin commands, leverage the player's core state-mutation methods (like `gainXp`) instead of manually mutating properties. This ensures all visual cues (particle overlays, portrait flashes) and audio effects are triggered synchronously.

### 14. Energy System: Costs, Validation, & Regeneration

To align with traditional WoW rogue-like mechanics, the game enforces resource costs (Energy) for player attack actions, keeping the healing action cooldown-based:

*   **Energy Costs**:
    *   **Deploy Code (`deploy`)**: 25 Energy.
    *   **Code Review (`review`)**: 40 Energy.
    *   **Coffee Break (`coffee`)**: 0 Energy (free, limited only by its 6s cooldown).
*   **Validation**:
    *   Check player energy *before* starting the action cooldown.
    *   If energy is insufficient, call `hud.addChat('Not enough energy!', 'err')` and return `null` in `triggerAction()`, cancelling the action execution.
*   **Regeneration**:
    *   Regenerate energy passively at a rapid rate of **20 Energy per second** during the update loop: `this.mp = Math.min(this.maxMp, this.mp + 20.0 * delta)`.
    *   Update the HUD using `hud.updatePlayer()` to reflect the new energy bar fill.

### 15. Mobile Responsiveness & Touch Controls

When maintaining or extending touch support and mobile HUD layouts:
*   **Virtual Joystick Positioning**: Keep the virtual joystick positioned to the left of the centered action bar inside the centered wrapper `#action-bar-wrapper`. Use absolute offsets (`right: calc(100% + 15px)`) so that it does not push the centered action bar off-center.
*   **Dynamic maxRadius**: Always calculate the joystick's maximum displacement (`maxRadius`) dynamically based on its rendered base size (e.g., `rect.width * 0.4`), and cache it inside the touchstart state to avoid layout thrashing during touchmove updates.
*   **Camera Touch & Pinch Zoom**: Track single-touch moves to update camera `yaw` and `pitch` using `e.preventDefault()` to block browser bounce. Track two-touch coordinates to calculate distances for pinch-to-zoom updates.
*   **Tap-to-Target & Empty Space Clearing**: Differentiate between drag looks and clicks by using a tap-threshold (moved < 10px and duration < 300ms). Tap-to-target should trigger NPC raycasting, whereas tapping on empty ground/sky should clear the current target.
*   **Soft Keyboard Integration**: Enable chat overlay clicks on mobile to programmatically focus and show the text input field, triggering the device's native software keyboard.
