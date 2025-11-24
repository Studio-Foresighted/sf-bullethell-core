import * as THREE from '../lib/three.module.js';

export class ProjectileManager {
    constructor(scene, pool) {
        this.scene = scene;
        this.pool = pool;
        this.activeProjectiles = [];
        this.projectileRadius = 0.2; // Collision radius for projectile
        
        // Shared Geometry/Material for performance
        this.geometry = new THREE.SphereGeometry(0.2, 8, 8);
        this.material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    }

    spawn(position, direction) {
        const proj = this.pool.get();
        
        // Reset State
        proj.position.copy(position);
        proj.userData.velocity = direction.clone().normalize().multiplyScalar(40); // Speed 40
        proj.userData.life = 2.0; // 2 seconds life
        proj.userData.collisionRadius = this.projectileRadius;
        
        // Ensure it's in the scene (if pool created a new one)
        if (!proj.parent) {
            this.scene.add(proj);
        }
        
        this.activeProjectiles.push(proj);
    }

    update(dt) {
        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const proj = this.activeProjectiles[i];
            
            // Move
            proj.position.addScaledVector(proj.userData.velocity, dt);
            
            // Life Check
            proj.userData.life -= dt;
            if (proj.userData.life <= 0) {
                this.despawn(proj, i);
            }
        }
    }

    despawn(proj, index) {
        this.pool.release(proj);
        this.activeProjectiles.splice(index, 1);
    }
}
