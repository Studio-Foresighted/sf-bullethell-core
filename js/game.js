import * as THREE from './lib/three.module.js';
import { InputManager } from './core/input.js';
import { ObjectPool } from './core/pool.js';
import { ProjectileManager } from './core/projectileManager.js';
import { EnemyManager } from './core/enemyManager.js';
import { VFXManager } from './core/vfxManager.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';
import { KTX2Loader } from './lib/KTX2Loader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { ModelSelector } from './modelSelector.js';

export class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.isRunning = false;
        this.paused = false;
        this.isGameOver = false;
        this.isVictory = false;
        this.isStarting = false;

        this.modelSelector = new ModelSelector(this); // Initialize Selector
        this.input = new InputManager();
        
        // Entities
        this.player = null;
        this.playerStats = {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50
        };
        this.enemyManager = null;
        this.gltfLoader = null;
        this.playerTemplate = null;
        this.enemyTemplates = [];
        this.playerModels = {};
        this.defaultPlayerKey = 'soldier';
        this.assetsReady = false;
        this.assetPromise = null;
        
        // Systems
        this.projectilePool = null;
        this.projectileManager = null;
        this.vfxManager = null;
        this.fireCooldown = 0;

        // Setup
        this.initThreeJS();
        this.initSystems();
        this.createLevel();
        
        // Start asset loading after ModelSelector initializes
        this.waitForModelSelectorAndLoadAssets();
    }

    async waitForModelSelectorAndLoadAssets() {
        // Wait for ModelSelector config to be loaded
        await new Promise(resolve => {
            const checkReady = () => {
                // Check if config has been loaded
                if (this.modelSelector.configLoaded) {
                    console.log('ModelSelector config loaded:', this.modelSelector.config);
                    resolve();
                } else {
                    setTimeout(checkReady, 50);
                }
            };
            checkReady();
        });
        
        console.log('Starting asset preload with final config:', this.modelSelector.config);
        this.assetPromise = this.preloadAssets();
    }

    initSystems() {
        // VFX
        this.vfxManager = new VFXManager(this.scene, this.camera);

        // Create Pool
        this.projectilePool = new ObjectPool(() => {
            const geo = new THREE.SphereGeometry(0.2, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { type: 'projectile', velocity: new THREE.Vector3(), life: 0 };
            return mesh;
        }, 200); // Pre-allocate 200 bullets

        this.projectileManager = new ProjectileManager(this.scene, this.projectilePool);

        // Pause Listener
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isGameOver || this.isVictory) return; // Disable pause on end screens
                this.togglePause();
            }
        });
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) {
            pauseScreen.style.display = this.paused ? 'flex' : 'none';
        }
        console.log(this.paused ? "Game Paused" : "Game Resumed");
    }

    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        // Removed fog for better visibility at distance

        // Camera (Top-Down / Isometric)
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 20, 10); // High angle
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // Disable physically correct lights for arcade-style (uniform visibility at distance)
        this.renderer.physicallyCorrectLights = false;
        this.container.appendChild(this.renderer.domElement);

        // Lights - Arcade Style (constant visibility from all angles and distances)
        
        // Strong ambient fill light - ensures visibility from all angles
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);

        // Directional light with infinite range (no distance falloff)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.distance = 0; // Infinite range (no falloff)
        dirLight.decay = 0;    // No distance decay
        this.scene.add(dirLight);

        // Optional hemisphere light for additional fill from below
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        this.scene.add(hemiLight);

        // Resize Handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateUI() {
        const hpPercent = (this.playerStats.hp / this.playerStats.maxHp) * 100;
        const mpPercent = (this.playerStats.mp / this.playerStats.maxMp) * 100;

        const hpFill = document.getElementById('hp-fill');
        const mpFill = document.getElementById('mp-fill');
        const hpText = document.querySelector('.health-bar .bar-text');
        const mpText = document.querySelector('.mana-bar .bar-text');

        if (hpFill) hpFill.style.width = `${hpPercent}%`;
        if (mpFill) mpFill.style.width = `${mpPercent}%`;
        if (hpText) hpText.textContent = `HP ${Math.ceil(this.playerStats.hp)}/${this.playerStats.maxHp}`;
        if (mpText) mpText.textContent = `MP ${Math.ceil(this.playerStats.mp)}/${this.playerStats.maxMp}`;
    }

    takeDamage(amount) {
        if (this.playerStats.hp <= 0) return;

        this.playerStats.hp -= amount;
        if (this.playerStats.hp < 0) this.playerStats.hp = 0;

        // VFX: Screen Shake on damage
        if (this.vfxManager) {
            this.vfxManager.shake(0.5, 0.2);
        }

        this.updateUI();

        if (this.playerStats.hp <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        // Only trigger once
        if (this.isGameOver) return;
        this.isGameOver = true;
        // Don't pause immediately, let VFX run

        // Player particle explosion
        if (this.vfxManager && this.player) {
            this.vfxManager.spawnExplosion(this.player.position, 0x3498db, 16);
        }

        // Hide player mesh
        if (this.player) {
            this.player.visible = false;
        }

        // Actually pause and show overlay after 2s
        setTimeout(() => {
            this.paused = true;
            const goScreen = document.getElementById('game-over-screen');
            if (goScreen) {
                goScreen.style.display = 'flex';
                const btn = document.getElementById('restart-btn');
                btn.onclick = () => location.reload();
            }
        }, 2000);
    }

    victory() {
        // Only trigger once
        if (this.isVictory) return;
        this.isVictory = true;
        
        // Wait 2 seconds before showing victory screen
        setTimeout(() => {
            const vicScreen = document.getElementById('victory-screen');
            if (vicScreen) {
                vicScreen.style.display = 'flex';
                
                const btn = document.getElementById('next-btn');
                btn.onclick = () => location.reload();
            }
            this.paused = true; // Pause after the victory screen appears
        }, 2000);
    }

    createLevel() {
        // Ground Plane
        const geo = new THREE.PlaneGeometry(100, 100);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            roughness: 0.8,
            metalness: 0.2
        });
        this.plane = new THREE.Mesh(geo, mat);
        this.plane.rotation.x = -Math.PI / 2;
        this.plane.receiveShadow = true;
        this.scene.add(this.plane);

        // Grid Helper (Visual Aid)
        const grid = new THREE.GridHelper(100, 20, 0x444444, 0x111111);
        this.scene.add(grid);

        this.createPlaceholderPlayer();
    }

    createPlaceholderPlayer() {
        if (!this.player) {
            this.player = new THREE.Object3D();
            this.scene.add(this.player);
        } else {
            while (this.player.children.length > 0) {
                this.player.remove(this.player.children[0]);
            }
        }

        this.player.position.set(0, 0, 0);
        this.player.quaternion.identity();

        const pGeo = new THREE.BoxGeometry(1, 2, 1);
        const pMat = new THREE.MeshStandardMaterial({ color: 0x3498db, emissive: 0x111111 });
        const placeholder = new THREE.Mesh(pGeo, pMat);
        placeholder.position.y = 1;
        placeholder.castShadow = true;

        const visorGeo = new THREE.BoxGeometry(0.8, 0.4, 0.2);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.5, 0.5);
        placeholder.add(visor);

        this.player.add(placeholder);
    }

    configureModelForScene(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    replacePlayerModel(template) {
        if (!template) return;
        if (!this.player) {
            this.player = new THREE.Object3D();
            this.scene.add(this.player);
        }

        const prevPos = this.player.position.clone();
        const prevQuat = this.player.quaternion.clone();

        while (this.player.children.length > 0) {
            this.player.remove(this.player.children[0]);
        }

        // Use template directly to avoid SkinnedMesh cloning issues (requires SkeletonUtils otherwise)
        const newPlayer = template; 
        this.configureModelForScene(newPlayer);
        newPlayer.position.set(0, 0, 0);
        this.player.add(newPlayer);

        this.player.position.copy(prevPos);
        this.player.quaternion.copy(prevQuat);
    }

    getSelectedPlayerKey() {
        return this.modelSelector.config.playerModel || this.defaultPlayerKey;
    }

    applySelectedPlayerModel() {
        const key = this.getSelectedPlayerKey();
        const template = this.playerModels[key] || this.playerModels[this.defaultPlayerKey] || this.playerTemplate;
        if (template) {
            this.replacePlayerModel(template);
        }
    }

    normalizeModelScale(model, targetHeight) {
        if (!model || !targetHeight) return;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y;

        if (height > 0.001) {
            const scale = targetHeight / height;
            model.scale.multiplyScalar(scale);
            model.updateMatrixWorld(true);
        }

        const adjustedBox = new THREE.Box3().setFromObject(model);
        const minY = adjustedBox.min.y;
        if (Math.abs(minY) > 1e-4) {
            model.position.y -= minY;
            model.updateMatrixWorld(true);
        }
    }

    extractSceneFromGltf(gltf) {
        return (gltf && (gltf.scene || (gltf.scenes && gltf.scenes[0]))) || null;
    }

    preloadAssets() {
        this.gltfLoader = new GLTFLoader();
        
        // Setup DRACO Decoder for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/js/lib/draco/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        // Setup KTX2 Loader for textures
        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath('/js/lib/basis/');
        ktx2Loader.detectSupport(this.renderer);
        this.gltfLoader.setKTX2Loader(ktx2Loader);
        
        // Setup Meshopt Decoder
        this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        
        // Default assets
        let assets = [
            { key: 'soldier', path: 'assets/models/Soldier.glb', targetHeight: 2.0 },
            { key: 'readyplayer', path: 'assets/models/readyplayer.me.glb', targetHeight: 1.8 },
            { key: 'dragon', path: 'assets/models/DragonAttenuation.glb', targetHeight: 3.5 },
            { key: 'ship', path: 'assets/models/space_ship_hallway.glb', targetHeight: 2.5 }
        ];

        // Merge with Config
        if (this.modelSelector.config) {
            const config = this.modelSelector.config;
            
            console.log('Config in preloadAssets:', config);
            
            // Add Player Model
            if (config.playerModel && !assets.find(a => a.key === config.playerModel)) {
                console.log('Adding player model:', config.playerModel);
                const isKnownLocal = ['Soldier.glb', 'readyplayer.me.glb', 'DragonAttenuation.glb', 'space_ship_hallway.glb'].includes(config.playerModel);
                const path = isKnownLocal ? `assets/models/${config.playerModel}` : `/external_models/${config.playerModel}`;
                
                assets.push({ 
                    key: config.playerModel, 
                    path: path, 
                    targetHeight: 2.0,
                    isExternal: true
                });
            }
            
            // Add Enemy Models
            if (config.enemyModels && config.enemyModels.length > 0) {
                config.enemyModels.forEach(m => {
                    if (!assets.find(a => a.key === m)) {
                        console.log('Adding enemy model:', m);
                        const isKnownLocal = ['Soldier.glb', 'readyplayer.me.glb', 'DragonAttenuation.glb', 'space_ship_hallway.glb'].includes(m);
                        const path = isKnownLocal ? `assets/models/${m}` : `/external_models/${m}`;

                        assets.push({
                            key: m,
                            path: path,
                            targetHeight: 2.0,
                            isExternal: true
                        });
                    }
                });
            }
        }

        console.log('Assets to load:', assets.map(a => ({ key: a.key, path: a.path })));

        const requests = assets.map((asset) =>
            this.gltfLoader.loadAsync(asset.path)
                .then((gltf) => {
                    const scene = this.extractSceneFromGltf(gltf);
                    console.log(`Loaded asset ${asset.key} from ${asset.path}`);
                    return { ...asset, scene };
                })
                .catch((err) => {
                    console.warn(`Failed to load ${asset.path}`, err);
                    return null;
                })
        );

        return Promise.all(requests)
            .then((results) => {
                const loaded = results.filter(Boolean);
                console.log('Loaded results:', loaded.map(l => l.key));

                // Process ALL models
                loaded.forEach((entry) => {
                    if (entry.scene) {
                        this.normalizeModelScale(entry.scene, entry.targetHeight);
                        // Mark the model with its key for debugging
                        if (!entry.scene.userData) entry.scene.userData = {};
                        entry.scene.userData.modelName = entry.key;
                        this.playerModels[entry.key] = entry.scene;
                    }
                });

                // Set Player Template
                const configPlayer = this.modelSelector.config.playerModel;
                if (configPlayer && this.playerModels[configPlayer]) {
                    this.playerTemplate = this.playerModels[configPlayer];
                    this.defaultPlayerKey = configPlayer;
                } else {
                    if (this.playerModels['soldier']) {
                        this.playerTemplate = this.playerModels['soldier'];
                    }
                }

                // Process Enemy Models
                const configEnemies = this.modelSelector.config.enemyModels;
                if (configEnemies && configEnemies.length > 0) {
                    // Create multiple instances of each enemy model for better variety
                    this.enemyTemplates = [];
                    configEnemies.forEach(key => {
                        const model = this.playerModels[key];
                        if (model) {
                            // Add multiple instances (at least 2 per model)
                            for (let i = 0; i < 2; i++) {
                                this.enemyTemplates.push(model);
                            }
                        }
                    });
                    console.log('[MODELS] Enemy templates ready:', configEnemies.join(', '), '| Total instances:', this.enemyTemplates.length);
                }
                
                // Fallback if no enemies selected
                if (this.enemyTemplates.length === 0) {
                    const enemyAssets = loaded.filter((entry) => entry.key === 'dragon' || entry.key === 'ship');
                    this.enemyTemplates = enemyAssets.map((entry) => entry.scene);
                }

                this.enemyManager = new EnemyManager(this.scene, 100, this.enemyTemplates);
                this.assetsReady = true;
            })
            .catch((err) => {
                console.error('Unexpected error while loading glTF models', err);
                this.enemyManager = new EnemyManager(this.scene, 100, []);
                this.assetsReady = true;
            });
    }

    async start() {
        if (this.isRunning || this.isStarting) return;
        this.isStarting = true;

        try {
            if (this.assetPromise) {
                await this.assetPromise;
            }

            // Recreate enemy manager with loaded templates
            if (!this.enemyManager || this.enemyTemplates.length > 0) {
                this.enemyManager = new EnemyManager(this.scene, 100, this.enemyTemplates);
            } else {
                this.enemyManager = new EnemyManager(this.scene, 100, []);
            }

            this.isRunning = true;
            this.updateUI(); // Initialize UI
            this.applySelectedPlayerModel();

            if (this.enemyManager) {
                for(let i=0; i<20; i++) {
                    const x = (Math.random() - 0.5) * 40;
                    const z = (Math.random() - 0.5) * 40;
                    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
                    this.enemyManager.spawn(new THREE.Vector3(x, 1, z));
                }
            }

            this.animate();
            console.log("Void Crawler Engine Started.");
        } finally {
            this.isStarting = false;
        }
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());

        const dt = Math.min(this.clock.getDelta(), 0.1); // Cap dt

        if (!this.paused) {
            this.update(dt);
        }
        this.renderer.render(this.scene, this.camera);
    }

    update(dt) {
        // 1. Input Handling
        const moveDir = this.input.getMoveDirection(); // Vector2
        const mousePos = this.input.getMouseGroundPosition(this.camera, this.plane); // Raycast to plane
        const isFiring = this.input.isMouseDown; // We need to add this to InputManager

        // Victory Check
        if (this.enemyManager.activeCount === 0 && !this.isVictory) {
            this.victory();
        }

        // 2. Player Movement (Direct Velocity)
        const speed = 20; // Faster than enemies!
        if (this.player) {
            // Move
            this.player.position.x += moveDir.x * speed * dt;
            this.player.position.z += moveDir.y * speed * dt;

            // Aim (Look at mouse)
            if (window.innerWidth < 900 && (moveDir.x !== 0 || moveDir.y !== 0)) {
                // On mobile, face movement direction
                const targetX = this.player.position.x + moveDir.x;
                const targetZ = this.player.position.z + moveDir.y;
                this.player.lookAt(targetX, this.player.position.y, targetZ);
            } else if (mousePos) {
                this.player.lookAt(mousePos.x, this.player.position.y, mousePos.z);
                if (this.player.children.length > 0) {
                    this.player.children[0].quaternion.copy(this.player.quaternion);
                }
            }

            // Fire Logic
            if (this.fireCooldown > 0) this.fireCooldown -= dt;
            if (isFiring && this.fireCooldown <= 0) {
                // Calculate direction
                const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.quaternion);
                const spawnPos = this.player.position.clone().add(direction.multiplyScalar(1.0)); // Spawn in front
                spawnPos.y = 1; // Waist height

                this.projectileManager.spawn(spawnPos, direction);
                this.fireCooldown = 0.1; // 10 shots per second
            }

            // Camera Follow (Smooth Lerp - Fixed Angle)
            const targetCamPos = new THREE.Vector3(
                this.player.position.x, 
                this.player.position.y + 20, 
                this.player.position.z + 10
            );
            // Increased lerp speed for tighter tracking (was 5 * dt)
            this.camera.position.lerp(targetCamPos, 25 * dt);
            // Removed lookAt to prevent angle wobble/shifting
        }

        // 3. Update Projectiles
        if (this.projectileManager) {
            this.projectileManager.update(dt);
        }

        // 4. Update Enemies
        if (this.enemyManager && this.player) {
            this.enemyManager.update(dt, this.player.position, (damage) => {
                this.takeDamage(damage);
            });
            this.enemyManager.checkCollisions(this.projectileManager, this.vfxManager);
        }

        // 5. Update VFX
        if (this.vfxManager) {
            this.vfxManager.update(dt);
        }
    }

    setCurrentModelConfig(config) {
        if (config.playerModel) {
            this.modelSelector.config.playerModel = config.playerModel;
            console.log('Player model updated to:', config.playerModel);
            
            const display = document.getElementById('selected-model-display');
            if (display) {
                display.textContent = `Selected Model: ${config.playerModel}`;
            }
        }
        if (config.enemyModels) {
            this.modelSelector.config.enemyModels = config.enemyModels;
            console.log('Enemy models updated:', config.enemyModels);
        }
        
        // Always reload assets when config changes
        console.log('Config changed, reloading assets...');
        this.assetPromise = this.preloadAssets().then(() => {
            console.log('Assets reloaded.');
            
            // Only update active entities if game is running
            if (this.isRunning) {
                console.log('Game is running, updating active entities...');
                
                // Update Player
                this.applySelectedPlayerModel();
                
                // Update Enemies
                if (this.enemyManager) {
                    this.enemyManager.updateTemplates(this.enemyTemplates);
                }
            }
        });
        
        // Return the promise so saveConfig can wait for it
        return this.assetPromise;
    }
}

