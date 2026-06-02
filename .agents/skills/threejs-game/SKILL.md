---
name: threejs-game
description: Guidelines for maintaining, debugging, and extending the Three.js 3D game engine, modular OOP scripts, heightmap calculations, glTF animations, and the WoW-style HTML/CSS HUD overlay.
---

# Skill: Three.js Game Client Maintenance & Development

This skill governs the development and maintenance of the custom WoW-style 3D campus web game located under `/world/` and driven by client scripts in `assets/js/game3d/`.

## Architecture Overview

The game uses modular vanilla ES6 JavaScript to drive a Three.js-based 3D environment, separating concerns into individual classes:
*   **Game Loop & Orchestration (`main.js`)**: Initializes the renderer, camera, lighting, environment, player, NPCs, and handles the `requestAnimationFrame` update loop.
*   **Player Mechanics (`player.js`)**: Manages the local player's movement, bounding box updates, mouse-based camera controls (look-at angles and scroll zoom), and collision resolution.
*   **NPC Behaviors (`npcs.js`)**: Defines all non-player characters (e.g., Head of Engineering, The Barista, Legacy Bug), their patrol pathing coordinates, dialogue structures, levels, and hostile/friendly designations.
*   **Heightmap & Terrain (`world.js`)**: Exports `getHeightAt(x, z)` to position players and NPCs correctly on the terrain, detecting hills, slopes, and water surfaces.
*   **Asset Loading (`model-loader.js`)**: Asynchronously downloads `.glb` models, handles auto-scaling of assets based on bounding boxes, clones templates, and sets up `AnimationMixer` keyframes (`Idle`, `Walking`).
*   **WoW-Style HUD & Interface (`hud.js`)**: Connects the 3D world states to HTML/CSS overlays, presenting character nameplates, dynamic HP/MP bars, level metrics, action bar slots, chat boxes, and dialogue typing animations.

## Key Development Rules

1.  **Strict Decoupling**: Keep UI and DOM logic inside `hud.js` and 3D simulation logic inside the corresponding JS modules. Do not inject hardcoded HTML templates into rendering loops.
2.  **Heightmap Alignment**: Always check terrain height using `getHeightAt(x, z)` when spawning or moving any entity (Player, NPCs, projectiles) to prevent models floating or clipping below the ground.
3.  **glTF Asset Integration**:
    *   Models are loaded asynchronously. Ensure a fallback simple primitive mesh is rendered first (e.g., Cylinder/Cone structure) and seamlessly hidden once the GLTF model is fully loaded.
    *   Scale the model dynamically using its computed bounding box (`THREE.Box3().setFromObject(model)`) so that it conforms to normal humanoid proportions (~1.7 units tall).
4.  **Performance Optimization**:
    *   Use lightweight materials like `MeshLambertMaterial` or `MeshBasicMaterial` where possible to keep draw call costs low.
    *   Perform collision checks locally against bounding shapes (spheres/boxes) rather than running expensive raycasts against complex model meshes on every tick.
5.  **HUD Rendering**: Use canvas-based floating label textures or HTML elements positioned relative to camera perspective projection matrices for names and healthbars to ensure crisp readability.
