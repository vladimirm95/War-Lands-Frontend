import * as THREE from 'three';

const MIN_RADIUS = 20;
const MAX_RADIUS = 60;
const MIN_PHI = 0.4;
const MAX_PHI = 1.1;

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;
        this.spherical = { radius: 60, phi: 0.785, theta: 0.795 };
        this.orbitTarget = new THREE.Vector3(0, 0, 0);
        this._onFirstFrameCallbacks = [];
        this._firstFrameDone = false;
        this.mapHalf = 130; // default, menja se sa setMapSize
    }

    setMapSize(gridSize) {
        // MAP_HALF je malo manji od pola mape da ostavi buffer za fog
        this.mapHalf = gridSize / 2 * 0.85;
    }

    onFirstFrame(cb) {
        if (this._firstFrameDone) { cb(); return; }
        this._onFirstFrameCallbacks.push(cb);
    }

    init() {
        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initLights();
        this._startLoop();
    }

    _getSize() {
        const w = this.canvas.clientWidth
            || this.canvas.parentElement?.clientWidth
            || window.innerWidth - 190;
        const h = this.canvas.clientHeight
            || this.canvas.parentElement?.clientHeight
            || window.innerHeight;
        return { w, h };
    }

    _initRenderer() {
        const { w, h } = this._getSize();
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x4a6741);
        this.scene.fog = new THREE.Fog(0x4a6741, 60, 110);
    }

    _initCamera() {
        const { w, h } = this._getSize();
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
        this.updateCamera();
    }

    _initLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
        sun.position.set(30, 60, 20);
        sun.castShadow = true;
        this.scene.add(sun);
    }

    setWaterMesh(waterMesh) {
        this._waterMesh = waterMesh;
    }

    setTerrainMesh(terrainMesh) {
        this._terrainMesh = terrainMesh;
    }

    _startLoop() {
        const loop = () => {
            this.animationId = requestAnimationFrame(loop);

            if (!this._firstFrameDone) {
                this._firstFrameDone = true;
                this.onResize();
                this._onFirstFrameCallbacks.forEach(cb => cb());
                this._onFirstFrameCallbacks = [];
            }

            if (this._waterMesh && this._terrainMesh) {
                this._waterMesh.update(this.camera, this.renderer, this._terrainMesh);
            }

            this.renderer.render(this.scene, this.camera);
        };
        loop();
    }

    _getViewDistance() {
        const { radius, phi } = this.spherical;
        return radius * Math.sin(phi) * 1.8 + radius * 0.8;
    }

    _clampSpherical() {
        this.spherical.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.spherical.radius));
        this.spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, this.spherical.phi));
    }

    _clampOrbitTarget() {
        const viewDist = this._getViewDistance();
        const limit = Math.max(0, this.mapHalf - viewDist);
        this.orbitTarget.x = Math.max(-limit, Math.min(limit, this.orbitTarget.x));
        this.orbitTarget.z = Math.max(-limit, Math.min(limit, this.orbitTarget.z));
        this.orbitTarget.y = 0;
    }

    updateCamera() {
        this._clampSpherical();
        this._clampOrbitTarget();

        const { radius, phi, theta } = this.spherical;
        const t = this.orbitTarget;

        this.camera.position.set(
            t.x + radius * Math.sin(phi) * Math.sin(theta),
            t.y + radius * Math.cos(phi),
            t.z + radius * Math.sin(phi) * Math.cos(theta)
        );
        this.camera.lookAt(t);
    }

    rotate(direction) {
        this.spherical.theta += direction * 0.05;
        this.updateCamera();
    }

    pan(dx, dy) {
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const speed = this.spherical.radius * 0.001;
        this.orbitTarget.addScaledVector(right, -dx * speed);
        this.orbitTarget.addScaledVector(forward, dy * speed);
        this.updateCamera();
    }

    onResize() {
        const canvas = this.canvas;
        const parent = canvas.parentElement;
        if (!parent) return;

        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (w === 0 || h === 0) return;

        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    destroy() {
        cancelAnimationFrame(this.animationId);
        this.renderer.dispose();
    }
}