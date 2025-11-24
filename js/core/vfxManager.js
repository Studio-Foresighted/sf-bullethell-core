import * as THREE from '../lib/three.module.js';

export class VFXManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Screen Shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.originalCamPos = new THREE.Vector3();

        // Floating Text (DOM based for crisp text)
        this.textContainer = document.createElement('div');
        this.textContainer.id = 'vfx-text-layer';
        Object.assign(this.textContainer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '5',
            overflow: 'hidden'
        });
        document.body.appendChild(this.textContainer);
        this.activeTexts = [];

        // Particles (Simple pooled mesh particles)
        this.particles = [];
        this.particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        this.particleMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    }

    update(dt) {
        this.updateShake(dt);
        this.updateTexts(dt);
        this.updateParticles(dt);
    }

    // --- Particles (Gibs) ---
    spawnExplosion(position, color = 0xff0000, count = 8) {
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.particleGeo, this.particleMat.clone());
            mesh.material.color.setHex(color);
            mesh.position.copy(position);
            
            // Random spread
            mesh.position.x += (Math.random() - 0.5) * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.5;

            this.scene.add(mesh);

            this.particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    Math.random() * 10 + 5, // Upward burst
                    (Math.random() - 0.5) * 10
                ),
                life: 1.0 // 1 second life
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life -= dt;
            
            // Physics
            p.velocity.y -= 20 * dt; // Gravity
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.rotation.x += p.velocity.z * dt;
            p.mesh.rotation.y += p.velocity.x * dt;

            // Scale down
            const scale = p.life;
            p.mesh.scale.setScalar(scale);

            if (p.life <= 0 || p.mesh.position.y < 0) {
                this.scene.remove(p.mesh);
                // Dispose material to prevent leak since we cloned it
                p.mesh.material.dispose(); 
                this.particles.splice(i, 1);
            }
        }
    }

    // --- Screen Shake ---
    shake(intensity = 0.5, duration = 0.2) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    updateShake(dt) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            const rx = (Math.random() - 0.5) * this.shakeIntensity;
            const ry = (Math.random() - 0.5) * this.shakeIntensity;
            const rz = (Math.random() - 0.5) * this.shakeIntensity;
            
            // We apply this on top of the camera's current position
            // Note: The Game class lerps the camera, so we might need to handle this carefully.
            // Ideally, the camera has a parent "shaker" object, or we offset the camera after the game updates it.
            this.camera.position.add(new THREE.Vector3(rx, ry, rz));
        }
    }

    // --- Floating Text ---
    showDamage(position, amount, isCrit = false) {
        const el = document.createElement('div');
        el.textContent = Math.floor(amount);
        Object.assign(el.style, {
            position: 'absolute',
            color: isCrit ? '#ffaa00' : '#ffffff',
            fontSize: isCrit ? '2rem' : '1.2rem',
            fontWeight: 'bold',
            fontFamily: "'Courier New', monospace",
            textShadow: '2px 2px 0 #000',
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.5s',
            opacity: '1'
        });

        this.textContainer.appendChild(el);

        this.activeTexts.push({
            element: el,
            worldPos: position.clone(),
            life: 1.0, // 1 second
            velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2)
        });
    }

    updateTexts(dt) {
        // Project world positions to screen
        const widthHalf = window.innerWidth / 2;
        const heightHalf = window.innerHeight / 2;

        for (let i = this.activeTexts.length - 1; i >= 0; i--) {
            const text = this.activeTexts[i];
            
            // Update Physics
            text.life -= dt;
            text.worldPos.addScaledVector(text.velocity, dt);
            text.velocity.y -= 5 * dt; // Gravity

            if (text.life <= 0) {
                text.element.remove();
                this.activeTexts.splice(i, 1);
                continue;
            }

            // Fade out
            if (text.life < 0.5) {
                text.element.style.opacity = text.life * 2;
            }

            // Project to Screen
            const screenPos = text.worldPos.clone().project(this.camera);
            const x = (screenPos.x * widthHalf) + widthHalf;
            const y = -(screenPos.y * heightHalf) + heightHalf;

            // Check if visible
            if (screenPos.z < 1 && x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight) {
                text.element.style.display = 'block';
                text.element.style.left = `${x}px`;
                text.element.style.top = `${y}px`;
            } else {
                text.element.style.display = 'none';
            }
        }
    }
}
