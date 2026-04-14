import * as THREE from 'three';

export class BrushTool {
    constructor(camera, terrainMesh, waterMesh = null) {
        this.camera = camera;
        this.terrainMesh = terrainMesh;
        this.waterMesh = waterMesh;
        this.raycaster = new THREE.Raycaster();

        this.size = 3;
        this.strength = 1.0;
        this.tool = 'texture';
        this.activeLayerIndex = 0;
        this.terrainSharpness = 1.0;
        this._normalUpdateCounter = 0;

        this._initCursor();
    }

    setWaterMesh(waterMesh) { this.waterMesh = waterMesh; }

    _initCursor() {
        const geo = new THREE.RingGeometry(0.95, 1.05, 96);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff2222,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            fog: false,
        });
        this.cursorMesh = new THREE.Mesh(geo, mat);
        this.cursorMesh.rotation.x = -Math.PI / 2;
        this.cursorMesh.visible = false;
        this.cursorMesh.renderOrder = 999;
    }

    getCursorMesh() { return this.cursorMesh; }
    setSize(v) { this.size = Number(v); }
    setStrength(v) { this.strength = Number(v); }
    setTool(t) {
        this.tool = t;
        // promeni izgled kursora za place_object alat
        if (this.cursorMesh) {
            this.cursorMesh.material.color.set(
                t === 'place_object' ? 0x22ff88 : 0xff2222
            );
        }
    }
    setActiveLayer(index) { this.activeLayerIndex = index; }
    setTerrainSharpness(v) { this.terrainSharpness = v; }
    _getRadius() { return this.size * 0.6; }

    _raycastHit(mouseNDC) {
        this.raycaster.setFromCamera(mouseNDC, this.camera);
        const mesh = this.terrainMesh.getMesh();
        if (!mesh) return null;
        const hits = this.raycaster.intersectObject(mesh);
        return hits.length > 0 ? hits[0] : null;
    }

    updateCursor(mouseNDC) {
        const hit = this._raycastHit(mouseNDC);
        if (hit) {
            this.cursorMesh.visible = true;
            this.cursorMesh.position.copy(hit.point);
            this.cursorMesh.position.y += 0.05;
            // za place_object manji kursor
            const r = this.tool === 'place_object' ? 1.5 : this._getRadius();
            this.cursorMesh.scale.setScalar(r);
        } else {
            this.cursorMesh.visible = false;
        }
        return hit || null;
    }

    applyHill(hit) {
        if (!hit) return;
        const mesh = this.terrainMesh.getMesh();
        if (!mesh) return;
        const point = hit.point;
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const radius = this._getRadius();

        for (let i = 0; i < pos.count; i++) {
            const dx = pos.getX(i) - point.x;
            const dz = pos.getZ(i) - point.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= radius) {
                const t = dist / radius;
                const falloff = Math.pow(1.0 - t, this.terrainSharpness);
                pos.setY(i, pos.getY(i) + falloff * this.strength * 0.04);
            }
        }
        pos.needsUpdate = true;
        this._normalUpdateCounter++;
        if (this._normalUpdateCounter % 3 === 0) geo.computeVertexNormals();
    }

    applyEraseHeight(hit) {
        if (!hit) return;
        const mesh = this.terrainMesh.getMesh();
        if (!mesh) return;
        const point = hit.point;
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const radius = this._getRadius();
        const falloffRadius = Math.max(radius, 15.0);

        for (let i = 0; i < pos.count; i++) {
            const dx = pos.getX(i) - point.x;
            const dz = pos.getZ(i) - point.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= radius) {
                const t = dist / falloffRadius;
                const falloff = Math.pow(1.0 - Math.min(t, 1.0), this.terrainSharpness);
                pos.setY(i, pos.getY(i) - falloff * this.strength * 0.06);
            }
        }
        pos.needsUpdate = true;
        this._normalUpdateCounter++;
        if (this._normalUpdateCounter % 3 === 0) geo.computeVertexNormals();
    }

    applyTexture(hit, renderer) {
        if (!hit) return;
        const uv = this.terrainMesh.worldPointToUV(hit.point);
        const radius = this._getRadius() / this.terrainMesh.gridSize;
        this.terrainMesh.paintAtExclusive(
            this.activeLayerIndex, uv, radius, this.strength, false, renderer
        );
    }

    applyEraseTexture(hit, renderer) {
        if (!hit) return;
        const uv = this.terrainMesh.worldPointToUV(hit.point);
        const radius = this._getRadius() / this.terrainMesh.gridSize;
        this.terrainMesh.paintAt(
            this.activeLayerIndex, uv, radius, this.strength, true, renderer
        );
    }

    apply(hit, renderer) {
        if (!hit) return;
        if (this.tool === 'hill')           this.applyHill(hit);
        if (this.tool === 'erase_height')   this.applyEraseHeight(hit);
        if (this.tool === 'texture')        this.applyTexture(hit, renderer);
        if (this.tool === 'erase_texture')  this.applyEraseTexture(hit, renderer);
        // place_object se hendluje u MapEditor direktno
    }
}