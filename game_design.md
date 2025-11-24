# Project: "Void Crawler" (Working Title)
**Genre:** Action RPG / Twin-Stick Shooter / Bullet Hell
**Tech Stack:** Three.js, HTML5, CSS3 (No Physics Engine - Custom Vector Math)

## 1. Game Overview
A high-paced, fluid action game where the player fights through hordes of enemies using magical projectiles. The focus is on "Game Feel" — snappy movement, satisfying impacts, and massive enemy density.

# Project: "Void Crawler" (Working Title)
**Genre:** Action RPG / Twin-Stick Shooter / Bullet Hell
**Tech Stack:** Three.js, HTML5, CSS3 (No Physics Engine - Custom Vector Math)
**Visual Style:** Dark Sci-Fi / Cyberpunk with Retro CRT Aesthetics.

## 1. Game Overview
A high-paced, fluid action game where the player fights through hordes of enemies using magical projectiles. The focus is on "Game Feel" — snappy movement, satisfying impacts, and massive enemy density (Diablo/Path of Exile density).

## 2. Core Mechanics (Phase 1 - The Foundation)
### A. Controls & Movement
- **Movement:** WASD for character movement.
    - *Implementation:* Direct Velocity modification (no inertia/acceleration) for tight, responsive dodging.
- **Aiming:** Mouse cursor determines facing direction.
    - *Implementation:* Raycasting against a ground plane to get precise world coordinates. 1:1 rotation lock.
- **Camera:** Isometric / Top-Down.
    - *Implementation:* Smooth `lerp` following with a fixed offset. No rotation to prevent disorientation.

### B. Combat System
- **Primary Fire (Left Click):** Rapid-fire energy projectile.
    - *Tech:* `ObjectPool` system to pre-allocate 200+ projectiles. Zero garbage collection during combat.
- **Enemies:** "Chaser" archetype.
    - *Behavior:* Swarm logic. They seek the player but use **Separation Steering** (Boids) to avoid stacking on top of each other.
    - *Tech:* `InstancedMesh` to render 100-500 units in a single draw call.
- **Collision:**
    - *Projectile vs Enemy:* Simple distance check. One hit = One kill (for now).
    - *Enemy vs Player:* Soft collision/repulsion. Enemies push the player slightly and stop at a "biting range" (2.0 units).

### C. User Interface (HUD)
- **Aesthetic:** Retro-futuristic, high contrast, CRT scanlines.
- **Top Bar:**
    - **Health Bar:** Red fill, displays current/max HP.
    - **Mana Bar:** Blue fill, resource for special abilities.
- **Bottom Bar:**
    - **Skill Slots:** Visual indicators for LMB (Basic), RMB (Heavy/AOE), and Space (Dash/Utility).
- **Overlays:**
    - **Start Screen:** Glitch text title, control hints.
    - **Pause Screen:** Blur effect, stops game loop but keeps rendering scene.

## 3. Current Features (Living List)
- [x] **Project Structure:** Modular ES6 classes (`Game`, `Input`, `EnemyManager`, `ProjectileManager`, `VFXManager`).
- [x] **Three.js Setup:** Scene, Lights, Shadows, Resizing.
- [x] **Input System:** Decoupled `InputManager` handling Keyboard & Mouse Raycasting.
- [x] **Camera:** Smooth follow logic tuned for "tight" feel.
- [x] **Projectile System:** High-performance Object Pooling.
- [x] **Enemy Horde:** `InstancedMesh` rendering with Matrix updates.
- [x] **Enemy AI:**
    - Chase Logic (Vector subtraction).
    - Separation Logic (Neighbor repulsion).
    - Player Avoidance (Soft body collision).
- [x] **Combat Logic:** 
    - Projectiles deal damage (Base 25, Crit 50).
    - Enemies have HP (50).
    - Player takes damage (10).
- [x] **Game Loop:** Pause functionality (`ESC` key) with delta time capping.
- [x] **Player Stats:** Health (HP) and Damage taking logic.
- [x] **UI Integration:** Connecting the HTML HUD to the JS Game State.
- [x] **Game Over:** Death state and restart capability.
- [x] **Juice (Phase 2):**
    - Floating Damage Numbers (DOM-based).
    - Screen Shake on Player Damage.

## 4. Future Roadmap

### Phase 2: "The Juice" (Continued)
- **Visual Feedback:**
    - Particle Explosions (Gibs) when enemies die.
    - Muzzle flash lighting.
- **Audio:** SFX for shooting, hits, and death.

### Phase 3: Progression & Loot
- **RPG Elements:**
    - XP Orbs dropping from enemies.
    - Level Up system (Stats increase).
    - Skill Tree (Simple choice: Multishot vs Damage vs Speed).
- **Loot:**
    - Simple inventory or pickup system (Health potions, weapon upgrades).

### Phase 4: Content & Polish
- **Map Generation:** Infinite or large procedural arena.
- **Enemy Types:**
    - *Ranged Enemy:* Shoots back.
    - *Tank Enemy:* Slow, high HP, requires kiting.
    - *Boss:* Multi-stage fight.
- **Post-Processing:** Bloom, Color Correction.

## 5. "The Foresighted Way" Implementation Notes
- **Input:** Decoupled Input Manager (reads state, doesn't handle logic).
- **Loop:** Fixed timestep for physics, unlocked FPS for rendering.
- **Visuals:** High contrast, emissive materials, retro UI overlays.
- **Performance:** Always prefer `InstancedMesh` and `ObjectPool` over `new` keyword.


## 5. "The Foresighted Way" Implementation Notes
- **Input:** Decoupled Input Manager (reads state, doesn't handle logic).
- **Loop:** Fixed timestep for physics, unlocked FPS for rendering.
- **Visuals:** High contrast, emissive materials, retro UI overlays.
