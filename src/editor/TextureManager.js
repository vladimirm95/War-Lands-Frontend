import * as THREE from 'three';
import grass1Url from '../assets/textures/grass1.png';

export class TextureManager {
    constructor() {
        this.loader = new THREE.TextureLoader();
        this.textures = {};
        this.catalog = [
            { id: 'grass1', label: 'Grass 1', url: grass1Url },
        ];
    }

    async loadAll() {
        const promises = this.catalog.map(({ id, url }) =>
            new Promise((resolve, reject) => {
                this.loader.load(
                    url,
                    (tex) => {
                        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                        tex.repeat.set(4, 4);  // bilo 8,8 - smanjujemo
                        tex.anisotropy = 16;   // oštrina teksture pod uglom
                        tex.generateMipmaps = true;
                        this.textures[id] = tex;
                        resolve();
                    },
                    undefined,
                    reject
                );
            })
        );
        await Promise.all(promises);
    }

    get(id) {
        return this.textures[id] || null;
    }

    getCatalog() {
        return this.catalog;
    }

    getPreviewUrl(id) {
        const entry = this.catalog.find(t => t.id === id);
        return entry?.url || null;
    }
}