import * as THREE from 'three';
import grass1Url from '../assets/textures/grass1.png';
import dirt1Url from '../assets/textures/dirt1.png';
import desert1Url from '../assets/textures/desert1.png';

export class TextureManager {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.textures = {};
    this.catalog = [
      { id: 'grass1',  label: 'Grass 1',  url: grass1Url  },
      { id: 'dirt1',   label: 'Dirt 1',   url: dirt1Url   },
      { id: 'desert1', label: 'Desert 1', url: desert1Url },
    ];
  }

  async loadAll() {
    const promises = this.catalog.map(({ id, url }) =>
      new Promise((resolve, reject) => {
        this.loader.load(
          url,
          (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 4);
            tex.anisotropy = 16;
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

  get(id) { return this.textures[id] || null; }
  getCatalog() { return this.catalog; }
  getPreviewUrl(id) {
    return this.catalog.find(t => t.id === id)?.url || null;
  }
}