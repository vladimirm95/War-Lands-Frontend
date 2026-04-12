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
  uniform sampler2D uTex0;
  uniform sampler2D uTex1;
  uniform sampler2D uTex2;
  uniform sampler2D uPaintMap0;
  uniform sampler2D uPaintMap1;
  uniform sampler2D uPaintMap2;
  uniform vec3 uDirtColor;
  uniform float uTexRepeat;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec4 c0a = texture2D(uTex0, vUv * uTexRepeat);
    vec4 c0b = texture2D(uTex0, vUv * uTexRepeat * 0.37 + vec2(0.15, 0.73));
    vec4 c0c = texture2D(uTex0, vUv * uTexRepeat * 2.71 + vec2(0.54, 0.21));
    vec4 tex0Color = c0a * 0.5 + c0b * 0.35 + c0c * 0.15;

    vec4 c1a = texture2D(uTex1, vUv * uTexRepeat);
    vec4 c1b = texture2D(uTex1, vUv * uTexRepeat * 0.37 + vec2(0.15, 0.73));
    vec4 c1c = texture2D(uTex1, vUv * uTexRepeat * 2.71 + vec2(0.54, 0.21));
    vec4 tex1Color = c1a * 0.5 + c1b * 0.35 + c1c * 0.15;

    vec4 c2a = texture2D(uTex2, vUv * uTexRepeat);
    vec4 c2b = texture2D(uTex2, vUv * uTexRepeat * 0.37 + vec2(0.15, 0.73));
    vec4 c2c = texture2D(uTex2, vUv * uTexRepeat * 2.71 + vec2(0.54, 0.21));
    vec4 tex2Color = c2a * 0.5 + c2b * 0.35 + c2c * 0.15;

    float alpha0 = texture2D(uPaintMap0, vUv).r;
    float alpha1 = texture2D(uPaintMap1, vUv).r;
    float alpha2 = texture2D(uPaintMap2, vUv).r;

    vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
    float light = clamp(dot(vNormal, lightDir), 0.0, 1.0) * 0.5 + 0.5;

    vec3 color = uDirtColor;
    color = mix(color, tex0Color.rgb, alpha0);
    color = mix(color, tex1Color.rgb, alpha1);
    color = mix(color, tex2Color.rgb, alpha2);

    gl_FragColor = vec4(color * light, 1.0);
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

const MAX_LAYERS = 3;

export class TerrainMesh {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.material = null;
        this.gridSize = 300;
        this.segments = 180;
        this.paintMapSize = 2048;
        this.renderer = null;
        this.textures = [];
        this.texScaleBase = 20.0; // default, vise sitnija tekstura

        this.paintTargetsA = [];
        this.paintTargetsB = [];
        this.currentPaints = [];
        this.previousPaints = [];

        this.paintScene = new THREE.Scene();
        this.paintCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
        this.brushPaintMat = null;
    }

    _createRenderTargets(size) {
        this.paintTargetsA.forEach(t => t.dispose());
        this.paintTargetsB.forEach(t => t.dispose());
        this.paintTargetsA = [];
        this.paintTargetsB = [];
        this.currentPaints = [];
        this.previousPaints = [];

        for (let i = 0; i < MAX_LAYERS; i++) {
            const a = new THREE.WebGLRenderTarget(size, size, {
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            });
            const b = new THREE.WebGLRenderTarget(size, size, {
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            });
            this.paintTargetsA.push(a);
            this.paintTargetsB.push(b);
            this.currentPaints.push(a);
            this.previousPaints.push(b);
        }
    }

    init(textures, renderer, paintRes = 2048) {
        this.renderer = renderer;
        this.textures = textures;
        this.paintMapSize = paintRes;
        this._createRenderTargets(paintRes);
        this._initPaintScene();
        this._buildMesh();
    }

    _getTexRepeat() {
        return (this.gridSize / 150) * this.texScaleBase;
    }

    setTexScale(scaleBase) {
        this.texScaleBase = scaleBase;
        if (this.material) {
            this.material.uniforms.uTexRepeat.value = this._getTexRepeat();
        }
    }

    _buildMesh() {
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
                uTex0:      { value: this.textures[0] || null },
                uTex1:      { value: this.textures[1] || null },
                uTex2:      { value: this.textures[2] || null },
                uPaintMap0: { value: this.currentPaints[0].texture },
                uPaintMap1: { value: this.currentPaints[1].texture },
                uPaintMap2: { value: this.currentPaints[2].texture },
                uDirtColor: { value: new THREE.Color(0x3d2b1f) },
                uTexRepeat: { value: this._getTexRepeat() },
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
        this._clearAllTargets();
        this._updatePaintUniforms();
    }

    initPaintMap() {
        this._clearAllTargets();
    }

    _initPaintScene() {
        this.brushPaintMat = new THREE.ShaderMaterial({
            uniforms: {
                uPrevPaint:     { value: null },
                uBrushPos:      { value: new THREE.Vector2(0.5, 0.5) },
                uBrushRadius:   { value: 0.05 },
                uBrushStrength: { value: 1.0 },
                uErasing:       { value: 0.0 },
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

    _clearTarget(target) {
        const clearMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const clearGeo = new THREE.PlaneGeometry(1, 1);
        const clearQuad = new THREE.Mesh(clearGeo, clearMat);
        clearQuad.position.set(0.5, 0.5, 0);
        const s = new THREE.Scene();
        s.add(clearQuad);
        const c = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
        const prev = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(target);
        this.renderer.render(s, c);
        this.renderer.setRenderTarget(prev);
        clearMat.dispose();
        clearGeo.dispose();
    }

    _clearAllTargets() {
        if (!this.renderer) return;
        for (let i = 0; i < MAX_LAYERS; i++) {
            this._clearTarget(this.paintTargetsA[i]);
            this._clearTarget(this.paintTargetsB[i]);
        }
        this._updatePaintUniforms();
    }

    _updatePaintUniforms() {
        if (!this.material) return;
        this.material.uniforms.uPaintMap0.value = this.currentPaints[0].texture;
        this.material.uniforms.uPaintMap1.value = this.currentPaints[1].texture;
        this.material.uniforms.uPaintMap2.value = this.currentPaints[2].texture;
    }

    worldPointToUV(worldPoint) {
        const half = this.gridSize / 2;
        return new THREE.Vector2(
            (worldPoint.x + half) / this.gridSize,
            (worldPoint.z + half) / this.gridSize
        );
    }

    paintAt(layerIndex, uv, brushRadius, brushStrength, erasing, renderer) {
        const tmp = this.currentPaints[layerIndex];
        this.currentPaints[layerIndex] = this.previousPaints[layerIndex];
        this.previousPaints[layerIndex] = tmp;

        this.brushPaintMat.uniforms.uPrevPaint.value = this.previousPaints[layerIndex].texture;
        this.brushPaintMat.uniforms.uBrushPos.value.set(uv.x, uv.y);
        this.brushPaintMat.uniforms.uBrushRadius.value = brushRadius;
        this.brushPaintMat.uniforms.uBrushStrength.value = brushStrength;
        this.brushPaintMat.uniforms.uErasing.value = erasing ? 1.0 : 0.0;

        renderer.setRenderTarget(this.currentPaints[layerIndex]);
        renderer.render(this.paintScene, this.paintCamera);
        renderer.setRenderTarget(null);

        this._updatePaintUniforms();
    }

    paintAtExclusive(layerIndex, uv, brushRadius, brushStrength, erasing, renderer) {
        this.paintAt(layerIndex, uv, brushRadius, brushStrength, erasing, renderer);
        if (!erasing) {
            for (let i = 0; i < MAX_LAYERS; i++) {
                if (i !== layerIndex) {
                    this.paintAt(i, uv, brushRadius, brushStrength, true, renderer);
                }
            }
        }
    }

    getMesh() { return this.mesh; }
    getGeometry() { return this.mesh?.geometry || null; }

    clear(renderer) {
        if (!this.mesh) return;
        const pos = this.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, 0);
        pos.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        this._clearAllTargets();
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.paintTargetsA.forEach(t => t.dispose());
        this.paintTargetsB.forEach(t => t.dispose());
    }
}