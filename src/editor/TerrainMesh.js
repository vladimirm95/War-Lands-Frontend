import * as THREE from 'three';

function makeVertexShader(gridSize) {
    const half = gridSize / 2;
    return `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vUv = vec2(
        (worldPos.x + ${half}.0) / ${gridSize}.0,
        (worldPos.z + ${half}.0) / ${gridSize}.0
      );
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
}

const fragmentShader = `
  uniform sampler2D uGrassTex;
  uniform sampler2D uPaintMap;
  uniform vec3 uDirtColor;
  uniform float uTexRepeat;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec4 c1 = texture2D(uGrassTex, vUv * uTexRepeat);
    vec4 c2 = texture2D(uGrassTex, vUv * uTexRepeat * 0.37 + vec2(0.15, 0.73));
    vec4 c3 = texture2D(uGrassTex, vUv * uTexRepeat * 2.71 + vec2(0.54, 0.21));
    vec4 grassColor = c1 * 0.5 + c2 * 0.35 + c3 * 0.15;

    float paintAlpha = texture2D(uPaintMap, vUv).r;

    vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
    float light = clamp(dot(vNormal, lightDir), 0.0, 1.0) * 0.5 + 0.5;

    vec3 finalColor = mix(uDirtColor, grassColor.rgb, paintAlpha);
    gl_FragColor = vec4(finalColor * light, 1.0);
  }
`;

const brushVertShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const brushFragShader = `
  uniform sampler2D uPrevPaint;
  uniform vec2 uBrushPos;
  uniform float uBrushRadius;
  uniform float uBrushStrength;
  uniform float uErasing;
  varying vec2 vUv;

  void main() {
    float prev = texture2D(uPrevPaint, vUv).r;
    float dist = distance(vUv, uBrushPos);
    float inner = uBrushRadius * 0.2;
    float falloff = 1.0 - smoothstep(inner, uBrushRadius, dist);
    falloff = pow(falloff, 2.0);
    float target = uErasing < 0.5 ? 1.0 : 0.0;
    float painted = mix(prev, target, falloff * uBrushStrength * 0.12);
    gl_FragColor = vec4(painted, 0.0, 0.0, 1.0);
  }
`;

export const MAP_PRESETS = [
    { label: 'Mala',    gridSize: 150, segments: 100, paintRes: 1024 },
    { label: 'Srednja', gridSize: 300, segments: 180, paintRes: 2048 },
    { label: 'Velika',  gridSize: 450, segments: 220, paintRes: 2048 },
    { label: 'Max',     gridSize: 600, segments: 250, paintRes: 4096 },
];

export class TerrainMesh {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.material = null;
        this.gridSize = 300;
        this.segments = 180;
        this.paintMapSize = 2048; // default za Srednju
        this.renderer = null;
        this.grassTexture = null;

        // kreiramo targete sa ispravnom default rezolucijom
        this.paintTargetA = null;
        this.paintTargetB = null;
        this.currentPaint = null;
        this.previousPaint = null;

        this.paintScene = new THREE.Scene();
        this.paintCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
        this.brushPaintMat = null;
    }

    _createRenderTargets(size) {
        if (this.paintTargetA) this.paintTargetA.dispose();
        if (this.paintTargetB) this.paintTargetB.dispose();

        this.paintTargetA = new THREE.WebGLRenderTarget(size, size, {
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });
        this.paintTargetB = new THREE.WebGLRenderTarget(size, size, {
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
        });
        this.currentPaint = this.paintTargetA;
        this.previousPaint = this.paintTargetB;
    }

    init(grassTexture, renderer, paintRes = 2048) {
        this.renderer = renderer;
        this.grassTexture = grassTexture;
        this.paintMapSize = paintRes;

        // kreiraj targete sa ispravnom rezolucijom od pocetka
        this._createRenderTargets(paintRes);
        this._initPaintScene();
        this._buildMesh();
    }

    _buildMesh() {

        const texRepeat = (this.gridSize / 150) * 8.0;

        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }

        const geo = new THREE.PlaneGeometry(
            this.gridSize, this.gridSize,
            this.segments, this.segments
        );
        geo.rotateX(-Math.PI / 2);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uGrassTex: { value: this.grassTexture },
                uPaintMap: { value: this.currentPaint.texture },
                uDirtColor: { value: new THREE.Color(0x3d2b1f) },
                uTexRepeat: { value: texRepeat },
            },
            vertexShader: makeVertexShader(this.gridSize),
            fragmentShader,
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.receiveShadow = true;
        this.mesh.userData.paintable = true;
        this.scene.add(this.mesh);
    }

    resize(gridSize, segments, paintRes, renderer) {
        this.gridSize = gridSize;
        this.segments = segments;

        if (paintRes !== this.paintMapSize) {
            this.paintMapSize = paintRes;
            this._createRenderTargets(paintRes);
        }

        this._buildMesh();
        this._clearBothTargets();
        this.material.uniforms.uPaintMap.value = this.currentPaint.texture;
    }

    initPaintMap() {
        this._clearBothTargets();
    }

    _initPaintScene() {
        this.brushPaintMat = new THREE.ShaderMaterial({
            uniforms: {
                uPrevPaint: { value: null },
                uBrushPos: { value: new THREE.Vector2(0.5, 0.5) },
                uBrushRadius: { value: 0.05 },
                uBrushStrength: { value: 1.0 },
                uErasing: { value: 0.0 },
            },
            vertexShader: brushVertShader,
            fragmentShader: brushFragShader,
            depthTest: false,
            depthWrite: false,
        });

        const quad = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.brushPaintMat
        );
        quad.position.set(0.5, 0.5, 0);
        this.paintScene.add(quad);
    }

    _clearBothTargets() {
        if (!this.renderer) return;
        const clearMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const clearGeo = new THREE.PlaneGeometry(1, 1);
        const clearQuad = new THREE.Mesh(clearGeo, clearMat);
        clearQuad.position.set(0.5, 0.5, 0);
        const s = new THREE.Scene();
        s.add(clearQuad);
        const c = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
        const prev = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(this.paintTargetA);
        this.renderer.render(s, c);
        this.renderer.setRenderTarget(this.paintTargetB);
        this.renderer.render(s, c);
        this.renderer.setRenderTarget(prev);
        clearMat.dispose();
        clearGeo.dispose();
    }

    worldPointToUV(worldPoint) {
        const half = this.gridSize / 2;
        return new THREE.Vector2(
            (worldPoint.x + half) / this.gridSize,
            (worldPoint.z + half) / this.gridSize
        );
    }

    paintAt(uv, brushRadius, brushStrength, erasing, renderer) {
        const tmp = this.currentPaint;
        this.currentPaint = this.previousPaint;
        this.previousPaint = tmp;

        this.brushPaintMat.uniforms.uPrevPaint.value = this.previousPaint.texture;
        this.brushPaintMat.uniforms.uBrushPos.value.set(uv.x, uv.y);
        this.brushPaintMat.uniforms.uBrushRadius.value = brushRadius;
        this.brushPaintMat.uniforms.uBrushStrength.value = brushStrength;
        this.brushPaintMat.uniforms.uErasing.value = erasing ? 1.0 : 0.0;

        renderer.setRenderTarget(this.currentPaint);
        renderer.render(this.paintScene, this.paintCamera);
        renderer.setRenderTarget(null);

        this.material.uniforms.uPaintMap.value = this.currentPaint.texture;
    }

    getMesh() { return this.mesh; }
    getGeometry() { return this.mesh?.geometry || null; }

    clear(renderer) {
        if (!this.mesh) return;
        const pos = this.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, 0);
        pos.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        this._clearBothTargets();
        this.material.uniforms.uPaintMap.value = this.currentPaint.texture;
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.paintTargetA?.dispose();
        this.paintTargetB?.dispose();
    }
}