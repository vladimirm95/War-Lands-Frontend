import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import oak1Url from '../assets/models/oak1.glb?url';

export const OBJECT_CATALOG = [
    { id: 'oak1', label: 'Oak 1', url: oak1Url },
];

export class ObjectManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.models = {};      // ucitani template modeli
        this.instances = [];   // postavljeni objekti na mapi
        this.selectedId = null;
    }

    async loadAll() {
        const promises = OBJECT_CATALOG.map(({ id, url }) =>
            new Promise((resolve, reject) => {
                this.loader.load(
                    url,
                    (gltf) => {
                        this.models[id] = gltf.scene;
                        resolve();
                    },
                    undefined,
                    reject
                );
            })
        );
        await Promise.all(promises);
    }

    placeObject(id, worldPoint, scale = 1.0) {
        const template = this.models[id];
        if (!template) return null;

        const obj = template.clone(true);
        obj.position.set(worldPoint.x, worldPoint.y, worldPoint.z);
        obj.scale.setScalar(scale);

        // podesi Y offset da drvo stoji NA terenu a ne u njemu
        // racunamo bounding box da znamo visinu modela
        const box = new THREE.Box3().setFromObject(obj);
        const bottomY = box.min.y;
        obj.position.y = worldPoint.y - bottomY;

        obj.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.objectId = this.instances.length;
                child.userData.isPlacedObject = true;
            }
        });

        obj.userData.instanceId = this.instances.length;
        obj.userData.objectType = id;
        obj.userData.scale = scale;

        this.scene.add(obj);
        this.instances.push(obj);
        return obj;
    }

    removeObject(instanceId) {
        const obj = this.instances[instanceId];
        if (!obj) return;
        this.scene.remove(obj);
        this.instances[instanceId] = null;
    }

    removeAll() {
        this.instances.forEach(obj => {
            if (obj) this.scene.remove(obj);
        });
        this.instances = [];
    }

    getInstances() {
        return this.instances.filter(Boolean);
    }

    // raycasting za selekciju/brisanje postavljenih objekata
    getClickedObject(mouseNDC, camera) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseNDC, camera);

        const meshes = [];
        this.instances.forEach(obj => {
            if (!obj) return;
            obj.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
        });

        const hits = raycaster.intersectObjects(meshes);
        if (hits.length === 0) return null;

        const hit = hits[0];
        return hit.object.userData.objectId ?? null;
    }
}