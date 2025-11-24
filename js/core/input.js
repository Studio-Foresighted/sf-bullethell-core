import * as THREE from '../lib/three.module.js';

export class InputManager {
    constructor() {
        this.keys = {
            w: false, a: false, s: false, d: false
        };
        this.isMouseDown = false;
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();

        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => { if(e.button === 0) this.isMouseDown = true; });
        window.addEventListener('mouseup', (e) => { if(e.button === 0) this.isMouseDown = false; });
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Block right-click menu
    }

    onKey(e, isDown) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = isDown;
        }
    }

    onMouseMove(e) {
        // Normalized Device Coordinates (-1 to +1)
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    getMoveDirection() {
        const dir = new THREE.Vector2(0, 0);
        if (this.keys.w) dir.y -= 1;
        if (this.keys.s) dir.y += 1;
        if (this.keys.a) dir.x -= 1;
        if (this.keys.d) dir.x += 1;
        
        if (dir.lengthSq() > 0) dir.normalize();
        return dir;
    }

    getMouseGroundPosition(camera, groundPlane) {
        this.raycaster.setFromCamera(this.mouse, camera);
        const intersects = this.raycaster.intersectObject(groundPlane);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }
}
