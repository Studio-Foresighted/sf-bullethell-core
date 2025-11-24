import * as THREE from '../lib/three.module.js';

export class EnemyManager {
    constructor(scene, maxEnemies = 100, modelTemplates = []) {
        this.scene = scene;
        this.maxEnemies = maxEnemies;
        this.activeCount = 0;
        this.modelTemplates = (modelTemplates || []).filter(Boolean);

        this.fallbackGeometry = new THREE.BoxGeometry(1, 2, 1);
        this.fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });

        this.enemies = [];
        for (let i = 0; i < maxEnemies; i++) {
            this.enemies.push({
                id: i,
                active: false,
                position: new THREE.Vector3(),
                speed: 0,
                hp: 50,
                maxHp: 50,
                attackCooldown: 0,
                mesh: null
            });
        }
    }

    updateTemplates(newTemplates) {
        this.modelTemplates = (newTemplates || []).filter(Boolean);
        
        // Refresh all active enemies with new models
        this.enemies.forEach(enemy => {
            if (enemy.active && enemy.mesh) {
                // Remove old mesh
                this.scene.remove(enemy.mesh);
                
                // Create new mesh
                const newMesh = this.createVisualMesh();
                if (newMesh) {
                    newMesh.position.copy(enemy.position);
                    newMesh.visible = true;
                    this.scene.add(newMesh);
                    enemy.mesh = newMesh;
                    
                    // Reset cached dimensions
                    enemy.radius = null;
                    enemy.height = null;
                }
            }
        });
    }

    spawn(position) {
        const enemy = this.enemies.find(e => !e.active);
        if (!enemy) return;

        enemy.active = true;
        enemy.position.copy(position);
        enemy.speed = 5 + Math.random() * 3;
        enemy.hp = enemy.maxHp;
        enemy.attackCooldown = 0;
        enemy.radius = null; // Reset cached radius for new mesh

        if (enemy.mesh) {
            this.scene.remove(enemy.mesh);
            enemy.mesh = null;
        }

        const mesh = this.createVisualMesh();
        if (mesh) {
            mesh.position.copy(position);
            mesh.visible = true;
            this.scene.add(mesh);
            
            // Debug: Log which enemy model was spawned
            const modelName = mesh.userData?.modelName || 'fallback';
            console.log(`[ENEMY ${enemy.id}] Spawned with model: ${modelName}`);
        }

        enemy.mesh = mesh;
        this.activeCount++;
    }

    checkCollisions(projectileManager, vfxManager) {
        const projectiles = projectileManager.activeProjectiles;
        const baseDamage = 25;

        for (let i = 0; i < this.maxEnemies; i++) {
            const enemy = this.enemies[i];
            if (!enemy.active) continue;

            let radius = 1.0;
            let height = 2.0;
            
            if (enemy.mesh) {
                // Cache dimensions if not already cached
                if (!enemy.radius || !enemy.height) {
                    const box = new THREE.Box3().setFromObject(enemy.mesh);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    
                    // Use average of x and z for radius
                    enemy.radius = (Math.max(size.x, size.z) / 2);
                    enemy.height = size.y;
                }
                radius = enemy.radius;
                height = enemy.height;
            }
            
            // Hitbox padding to make it "easier"
            const hitPadding = 0.5; 
            const effectiveRadius = radius + hitPadding;

            for (let j = projectiles.length - 1; j >= 0; j--) {
                const proj = projectiles[j];
                const projRadius = proj.userData.collisionRadius || 0.2;
                
                // CYLINDER COLLISION CHECK
                // 1. Check horizontal distance (X/Z plane)
                const dx = enemy.position.x - proj.position.x;
                const dz = enemy.position.z - proj.position.z;
                const distSqXZ = dx*dx + dz*dz;
                const combinedRadius = effectiveRadius + projRadius;
                
                if (distSqXZ < combinedRadius * combinedRadius) {
                    // 2. Check vertical range (Y axis)
                    // Projectile must be within enemy's vertical bounds (with some leeway)
                    const projY = proj.position.y;
                    const enemyBottom = enemy.position.y - 0.5; // Slight downward buffer
                    const enemyTop = enemy.position.y + height + 0.5; // Slight upward buffer
                    
                    if (projY >= enemyBottom && projY <= enemyTop) {
                        // HIT CONFIRMED
                        const isCrit = Math.random() < 0.2;
                        const finalDamage = isCrit ? baseDamage * 2 : baseDamage;
                        enemy.hp -= finalDamage;

                        if (vfxManager) {
                            vfxManager.showDamage(enemy.position, finalDamage, isCrit);
                        }

                        projectileManager.despawn(proj, j);

                        if (enemy.hp <= 0) {
                            enemy.active = false;
                            this.activeCount--;

                            if (vfxManager) {
                                vfxManager.spawnExplosion(enemy.position, 0xff0000, 8);
                            }

                            if (enemy.mesh) {
                                this.scene.remove(enemy.mesh);
                                enemy.mesh = null;
                            }
                        }

                        break; // Projectile destroyed, move to next projectile
                    }
                }
            }
        }
    }

    update(dt, playerPosition, onAttack) {
        if (this.activeCount === 0) return;

        const separationRadius = 2.5;
        const separationForce = 2.0;
        const attackRange = 2.2;
        const attackDamage = 10;
        const attackRate = 1.0;

        for (let i = 0; i < this.maxEnemies; i++) {
            const enemy = this.enemies[i];
            if (!enemy.active) continue;

            if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

            const distToPlayer = enemy.position.distanceTo(playerPosition);
            const minPlayerDist = 2.0;

            if (distToPlayer < attackRange && enemy.attackCooldown <= 0) {
                if (onAttack) onAttack(attackDamage);
                enemy.attackCooldown = attackRate;
            }

            const dir = new THREE.Vector3()
                .subVectors(playerPosition, enemy.position)
                .normalize();

            if (distToPlayer < minPlayerDist) {
                const repulsionFactor = (minPlayerDist - distToPlayer) * 2.0;
                const pushBack = new THREE.Vector3()
                    .subVectors(enemy.position, playerPosition)
                    .normalize()
                    .multiplyScalar(repulsionFactor);
                dir.add(pushBack);
            }

            const separation = new THREE.Vector3();
            let count = 0;

            for (let j = 0; j < this.maxEnemies; j++) {
                if (i === j) continue;
                const other = this.enemies[j];
                if (!other.active) continue;

                const distSq = enemy.position.distanceToSquared(other.position);
                if (distSq < separationRadius * separationRadius) {
                    const push = new THREE.Vector3()
                        .subVectors(enemy.position, other.position);

                    const length = push.length();
                    if (length > 0.001) {
                        push.divideScalar(length);
                        push.divideScalar(length);
                        separation.add(push);
                        count++;
                    }
                }
            }

            if (count > 0) {
                separation.divideScalar(count);
                separation.multiplyScalar(separationForce);
                dir.add(separation).normalize();
            }

            enemy.position.addScaledVector(dir, enemy.speed * dt);
            this.updateEnemyVisual(enemy, playerPosition);
        }
    }

    createVisualMesh() {
        const template = this.chooseTemplate();
        if (template) {
            const clone = template.clone(true);
            this.configureMeshForShadows(clone);
            
            // Enforce consistent size (Height = 2.0) to ensure all enemies are "same size"
            // This overrides any previous scaling to guarantee uniformity
            clone.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(clone);
            const height = box.max.y - box.min.y;
            
            if (height > 0.001) {
                const targetHeight = 2.0;
                const scale = targetHeight / height;
                clone.scale.multiplyScalar(scale);
                clone.updateMatrixWorld(true);
            }
            
            // Ensure model sits exactly on ground (Y=0)
            const adjustedBox = new THREE.Box3().setFromObject(clone);
            if (adjustedBox.min.y !== 0) {
                clone.position.y -= adjustedBox.min.y;
            }
            
            // Debug: Track which model this enemy is using
            let modelName = 'unknown';
            if (template.userData && template.userData.modelName) {
                modelName = template.userData.modelName;
            }
            clone.userData = { ...template.userData, spawned: true, modelName: modelName };
            
            return clone;
        }

        const mesh = new THREE.Mesh(this.fallbackGeometry, this.fallbackMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    chooseTemplate() {
        if (this.modelTemplates.length === 0) return null;
        const index = Math.floor(Math.random() * this.modelTemplates.length);
        return this.modelTemplates[index];
    }

    configureMeshForShadows(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    updateEnemyVisual(enemy, lookAtTarget) {
        if (!enemy.mesh) return;
        enemy.mesh.position.copy(enemy.position);
        if (lookAtTarget) {
            enemy.mesh.lookAt(lookAtTarget.x, enemy.position.y, lookAtTarget.z);
        }
    }
}
