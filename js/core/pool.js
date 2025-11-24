import * as THREE from '../lib/three.module.js';

export class ObjectPool {
    constructor(createFn, initialSize = 100) {
        this.createFn = createFn;
        this.pool = [];
        this.active = [];

        // Pre-warm
        for (let i = 0; i < initialSize; i++) {
            const obj = this.createFn();
            obj.visible = false; // Hide initially
            this.pool.push(obj);
        }
    }

    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            // Expand pool if empty
            console.warn("Pool exhausted, creating new object (Performance Warning)");
            obj = this.createFn();
        }
        
        obj.visible = true;
        this.active.push(obj);
        return obj;
    }

    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            obj.visible = false;
            this.pool.push(obj);
        }
    }
}
