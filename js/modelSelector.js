import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';
import { KTX2Loader } from './lib/KTX2Loader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';

export class ModelSelector {
    constructor(game) {
        this.game = game;
        this.panel = document.getElementById('model-selector-panel');
        this.grid = document.getElementById('model-grid');
        this.btn = document.getElementById('model-selector-btn');
        this.closeBtn = document.getElementById('close-panel-btn');
        this.saveBtn = document.getElementById('save-config-btn');
        
        this.models = [];
        this.filteredModels = [];
        this.selectedModelIndex = null;
        this.currentModel = null;
        this.currentModelName = null;
        this.isOpen = false;
        this.categoryFilter = 'all';
        this.searchTerm = '';
        this.loadedModels = new Map();
        
        this.categorySelect = document.getElementById('model-category');
        
        this.config = { playerModel: null, enemyModels: [] };
        this.configLoaded = false;
        this.views = []; // Active previews

        // Shared Renderer for all cards
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.pointerEvents = 'none';
        this.renderer.domElement.style.zIndex = '10';
        this.panel.appendChild(this.renderer.domElement);

        this.loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/js/lib/draco/');
        this.loader.setDRACOLoader(dracoLoader);
        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath('/js/lib/basis/');
        ktx2Loader.detectSupport(this.renderer);
        this.loader.setKTX2Loader(ktx2Loader);
        if (THREE.ColorManagement && !THREE.ColorManagement.ColorSpaces) {
            import('/js/lib/math/ColorSpaces.js').then(module => {
                THREE.ColorManagement.ColorSpaces = module.ColorSpaces;
            });
        }
        this.loader.setMeshoptDecoder(MeshoptDecoder);
        this.init();
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (!this.isOpen) return;

        // Resize renderer to match panel
        const width = this.panel.clientWidth;
        const height = this.panel.clientHeight;
        
        if (this.renderer.domElement.width !== width * window.devicePixelRatio ||
            this.renderer.domElement.height !== height * window.devicePixelRatio) {
            this.renderer.setSize(width, height, false);
        }

        this.renderer.setScissorTest(true);
        this.renderer.clear();

        const panelRect = this.panel.getBoundingClientRect();

        this.views.forEach(view => {
            if (!view.model) return;

            view.model.rotation.y += 0.01;

            const rect = view.element.getBoundingClientRect();

            // Check visibility
            if (rect.bottom < panelRect.top || rect.top > panelRect.bottom ||
                rect.right < panelRect.left || rect.left > panelRect.right) {
                return;
            }

            const left = rect.left - panelRect.left;
            const top = rect.top - panelRect.top;
            const width = rect.width;
            const height = rect.height;

            const scissorY = panelRect.height - (top + height);
            
            this.renderer.setViewport(left, scissorY, width, height);
            this.renderer.setScissor(left, scissorY, width, height);
            
            view.camera.aspect = width / height;
            view.camera.updateProjectionMatrix();
            
            this.renderer.render(view.scene, view.camera);
        });
        
        this.renderer.setScissorTest(false);
    }

    async init() {
        this.btn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        this.saveBtn.addEventListener('click', () => this.saveConfig());

        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterModels();
                this.renderGrid();
            });
        }
        if (this.categorySelect) {
            this.categorySelect.addEventListener('change', (e) => {
                this.categoryFilter = e.target.value;
                this.filterModels();
                this.renderGrid();
            });
        };

        await this.loadModelList();
        await this.loadConfig();
        this.filterModels();
        this.renderGrid();
    }

    async loadModelList() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) throw new Error('Failed to load model list');
            const filenames = await response.json();
            this.models = filenames.map(name => ({
                name: name,
                file: name,
                category: 'external'
            }));
        } catch (err) {
            console.error('Error loading model list:', err);
            this.models = [];
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Failed to load config');
            const config = await response.json();
            if (config.playerModel) this.config.playerModel = config.playerModel;
            if (config.enemyModels) this.config.enemyModels = config.enemyModels;
            this.configLoaded = true;
            console.log('Config loaded:', this.config);
        } catch (err) {
            console.warn('No saved config found, using defaults');
            this.configLoaded = true;
        }
    }

    filterModels() {
        this.filteredModels = this.models.filter(model => {
            const matchesCategory = this.categoryFilter === 'all' || model.category === this.categoryFilter;
            const matchesSearch = !this.searchTerm || model.name.toLowerCase().includes(this.searchTerm) ||
                (model.tags && model.tags.some(tag => tag.toLowerCase().includes(this.searchTerm)));
            return matchesCategory && matchesSearch;
        });
    }

    renderGrid() {
        this.grid.innerHTML = '';

        this.filteredModels.forEach((model, index) => {
            const item = document.createElement('div');
            item.className = 'model-item';
            // Removed selection highlighting logic as we use radios now

            const preview = document.createElement('div');
            preview.className = 'model-preview';
            preview.dataset.filename = model.file;
            // Placeholder icon
            preview.innerHTML = '<div class="preview-hint" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#666;cursor:pointer;flex-direction:column;"><span>[Click to Load]</span></div>';

            const name = document.createElement('div');
            name.className = 'model-name';
            name.textContent = model.name;

            const controls = document.createElement('div');
            controls.className = 'model-controls';
            controls.style.marginTop = '10px';
            
            // Player Radio
            const playerLabel = document.createElement('label');
            playerLabel.style.display = 'block';
            playerLabel.style.marginBottom = '5px';
            const playerRadio = document.createElement('input');
            playerRadio.type = 'radio';
            playerRadio.name = 'player_select';
            playerRadio.value = model.file;
            if (this.config.playerModel === model.file) playerRadio.checked = true;
            playerRadio.addEventListener('change', () => {
                this.config.playerModel = model.file;
                // If this becomes player, remove from enemies
                const enemyIdx = this.config.enemyModels.indexOf(model.file);
                if (enemyIdx > -1) {
                    this.config.enemyModels.splice(enemyIdx, 1);
                    const enemyCheck = controls.querySelector('input[type="checkbox"]');
                    if (enemyCheck) enemyCheck.checked = false;
                }
            });
            playerLabel.appendChild(playerRadio);
            playerLabel.appendChild(document.createTextNode(' Player'));

            // Enemy Checkbox
            const enemyLabel = document.createElement('label');
            enemyLabel.style.display = 'block';
            const enemyCheck = document.createElement('input');
            enemyCheck.type = 'checkbox';
            enemyCheck.value = model.file;
            if (this.config.enemyModels.includes(model.file)) enemyCheck.checked = true;
            enemyCheck.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!this.config.enemyModels.includes(model.file)) {
                        this.config.enemyModels.push(model.file);
                    }
                    // If this becomes enemy, remove from player
                    if (this.config.playerModel === model.file) {
                        this.config.playerModel = null;
                        const pRadio = document.querySelector(`input[name="player_select"][value="${model.file}"]`);
                        if (pRadio) pRadio.checked = false;
                    }
                } else {
                    const idx = this.config.enemyModels.indexOf(model.file);
                    if (idx > -1) this.config.enemyModels.splice(idx, 1);
                }
            });
            enemyLabel.appendChild(enemyCheck);
            enemyLabel.appendChild(document.createTextNode(' Enemy'));

            const buttonsRow = document.createElement('div');
            buttonsRow.style.marginTop = '8px';
            buttonsRow.style.display = 'flex';
            buttonsRow.style.gap = '5px';

            const fsBtn = document.createElement('button');
            fsBtn.textContent = '⛶';
            fsBtn.style.flex = '1';
            fsBtn.style.padding = '5px';
            fsBtn.style.cursor = 'pointer';
            fsBtn.style.background = 'rgba(0, 255, 255, 0.2)';
            fsBtn.style.border = '1px solid #0ff';
            fsBtn.style.color = '#0ff';
            fsBtn.style.fontFamily = 'Orbitron';
            fsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFullscreen(model);
            });
            buttonsRow.appendChild(fsBtn);

            controls.appendChild(playerLabel);
            controls.appendChild(enemyLabel);
            controls.appendChild(buttonsRow);

            item.appendChild(preview);
            item.appendChild(name);
            item.appendChild(controls);

            // Click on preview to load
            preview.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadView(model, preview);
            });

            this.grid.appendChild(item);
        });
    }

    loadView(modelData, element) {
        if (this.views.find(v => v.element === element)) return;

        const scene = new THREE.Scene();
        // No background color, so it's transparent (shows card background)
        
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        camera.position.set(0, 1, 2.5);
        camera.lookAt(0, 0.5, 0);
        
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(1, 2, 3);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0x404040));

        const view = { scene, camera, element, model: null, autoSpin: true };
        this.views.push(view);

        const hint = element.querySelector('.preview-hint');
        if (hint) hint.innerHTML = '<span>Loading...</span>';

        this.loadModel(modelData.file, (loadedModel) => {
            if (!loadedModel) {
                if (hint) hint.innerHTML = '<span style="color:red">Error</span>';
                return;
            }
            if (hint) hint.remove();
            
            view.model = loadedModel;
            scene.add(loadedModel);
        });
    }

    openFullscreen(modelData) {
        const fsContainer = document.createElement('div');
        fsContainer.id = 'model-fullscreen';
        fsContainer.style.position = 'fixed';
        fsContainer.style.top = '0';
        fsContainer.style.left = '0';
        fsContainer.style.width = '100%';
        fsContainer.style.height = '100%';
        fsContainer.style.background = '#1a1a1a';
        fsContainer.style.zIndex = '9999';
        fsContainer.style.display = 'flex';
        fsContainer.style.flexDirection = 'column';

        const canvas = document.createElement('canvas');
        canvas.style.flex = '1';
        fsContainer.appendChild(canvas);

        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.background = '#111';
        header.style.color = '#0ff';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.fontFamily = 'Orbitron';

        const title = document.createElement('span');
        title.textContent = modelData.name;
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'ESC';
        closeBtn.style.padding = '5px 15px';
        closeBtn.style.background = '#0ff';
        closeBtn.style.color = '#000';
        closeBtn.style.border = 'none';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontFamily = 'Orbitron';
        
        let animId = null;
        const cleanup = () => {
            if (animId) cancelAnimationFrame(animId);
            if (document.body.contains(fsContainer)) {
                document.body.removeChild(fsContainer);
            }
            fsRenderer.dispose();
            window.removeEventListener('keydown', escHandler);
        };
        
        closeBtn.addEventListener('click', cleanup);
        header.appendChild(closeBtn);

        fsContainer.insertBefore(header, canvas);
        document.body.appendChild(fsContainer);

        // Setup WebGL Renderer
        const fsRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        const canvasHeight = window.innerHeight - 50;
        fsRenderer.setSize(window.innerWidth, canvasHeight);
        fsRenderer.setClearColor(0x1a1a1a);

        // Setup Scene
        const fsScene = new THREE.Scene();
        const fsCamera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / canvasHeight,
            0.1,
            1000
        );
        fsCamera.position.set(0, 1, 4);
        fsCamera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        fsScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        fsScene.add(directionalLight);

        // Load model
        const fsView = { model: null, autoSpin: true, isDragging: false };
        this.loadModel(modelData.file, (loadedModel) => {
            if (!loadedModel) {
                console.error('Failed to load model in fullscreen');
                return;
            }
            
            fsView.model = loadedModel;
            
            // Center and scale model properly
            const box = new THREE.Box3().setFromObject(loadedModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3 / maxDim;
            loadedModel.scale.multiplyScalar(scale);
            
            // Re-center after scaling
            const box2 = new THREE.Box3().setFromObject(loadedModel);
            const center = box2.getCenter(new THREE.Vector3());
            loadedModel.position.sub(center);
            
            fsScene.add(loadedModel);
            
            console.log('Model loaded in fullscreen');
        });

        // Mouse Controls
        let prevX = 0, prevY = 0;
        canvas.addEventListener('mousedown', (e) => {
            fsView.isDragging = true;
            fsView.autoSpin = false;
            prevX = e.clientX;
            prevY = e.clientY;
        });
        canvas.addEventListener('mousemove', (e) => {
            if (!fsView.isDragging || !fsView.model) return;
            const deltaX = e.clientX - prevX;
            const deltaY = e.clientY - prevY;
            fsView.model.rotation.y += deltaX * 0.01;
            fsView.model.rotation.x += deltaY * 0.01;
            prevX = e.clientX;
            prevY = e.clientY;
        });
        canvas.addEventListener('mouseup', () => {
            fsView.isDragging = false;
            fsView.autoSpin = true;
        });
        canvas.addEventListener('mouseleave', () => {
            fsView.isDragging = false;
            fsView.autoSpin = true;
        });

        // Wheel Zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            fsCamera.position.z += e.deltaY > 0 ? 0.3 : -0.3;
            fsCamera.position.z = Math.max(1, Math.min(15, fsCamera.position.z));
        });

        // Animation loop
        const animate = () => {
            animId = requestAnimationFrame(animate);
            if (fsView.model && fsView.autoSpin) {
                fsView.model.rotation.y += 0.01;
            }
            fsRenderer.render(fsScene, fsCamera);
        };
        animate();

        // Handle ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape' && document.getElementById('model-fullscreen')) {
                cleanup();
            }
        };
        window.addEventListener('keydown', escHandler);
    }

    async open() {
        this.panel.classList.remove('hidden');
        this.isOpen = true;
    }

    close() {
        this.panel.classList.add('hidden');
        this.isOpen = false;
    }

    selectModel(index) {
        // Deprecated: Selection is now handled by radio buttons
    }

    updateSelectedState() {
        // Deprecated
    }

    saveConfig() {
        const configToSave = {
            playerModel: this.config.playerModel,
            enemyModels: this.config.enemyModels
        };

        // Hide model panel immediately
        this.close();

        // Show loading screen
        const reloadLoadingScreen = document.getElementById('reload-loading-screen');
        if (reloadLoadingScreen) {
            reloadLoadingScreen.style.display = 'flex';
            const loadingBar = reloadLoadingScreen.querySelector('.loading-bar-fill');
            const loadingText = reloadLoadingScreen.querySelector('.loading-text');
            
            // Animate loading bar
            let progress = 0;
            const loadingInterval = setInterval(() => {
                if (progress < 90) {
                    progress += Math.random() * 30;
                    if (progress > 90) progress = 90;
                    loadingBar.style.width = progress + '%';
                    loadingText.textContent = Math.floor(progress) + '%';
                }
            }, 150);
            
            // Save to server
            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configToSave)
            }).then(response => {
                if (response.ok) {
                    console.log('Config saved to server');
                    // Notify game and wait for assets to reload
                    this.game.setCurrentModelConfig(configToSave).then(() => {
                        // Complete loading bar
                        clearInterval(loadingInterval);
                        loadingBar.style.width = '100%';
                        loadingText.textContent = '100%';
                        
                        // Hide loading screen after brief delay
                        setTimeout(() => {
                            reloadLoadingScreen.style.display = 'none';
                        }, 500);
                    });
                } else {
                    console.error('Failed to save config to server');
                    clearInterval(loadingInterval);
                    reloadLoadingScreen.style.display = 'none';
                }
            }).catch(err => {
                console.error('Error saving config:', err);
                clearInterval(loadingInterval);
                reloadLoadingScreen.style.display = 'none';
            });
        } else {
            // Fallback if loading screen not found
            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configToSave)
            }).then(response => {
                if (response.ok) {
                    console.log('Config saved to server');
                    this.game.setCurrentModelConfig(configToSave);
                } else {
                    console.error('Failed to save config to server');
                }
            }).catch(err => console.error('Error saving config:', err));
        }
    }

    loadModel(filename, cb) {
        if (this.loadedModels.has(filename)) {
            // Return cached model (already normalized)
            if (cb) cb(this.loadedModels.get(filename).clone(true));
            return;
        }
        const path = `/external_models/${filename}`;
        this.loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) {
                    model.scale.multiplyScalar(1.5 / maxDim);
                }
                const center = new THREE.Vector3();
                box.getCenter(center);
                model.position.sub(center.multiplyScalar(1.5 / maxDim));
                model.position.y = 0;
                this.loadedModels.set(filename, model);
                if (cb) cb(model.clone(true));
            },
            undefined,
            (err) => {
                console.error(`Failed to load model ${filename}`, err);
                if (cb) cb(null);
            }
        );
    }

    loadPreviewModel(container, filename) {
        // Deprecated
    }
}
