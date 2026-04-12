import * as THREE from 'three';

const waterVertexShader = `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveSpeed;

  varying vec2 vWorldXZ;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;

    // vise talasa u razlicitim smerovima - reka stil
    float w1 = sin(worldPos.x * 0.3 + uTime * uWaveSpeed * 1.0) * uWaveHeight;
    float w2 = sin(worldPos.z * 0.2 + uTime * uWaveSpeed * 0.7) * uWaveHeight * 0.5;
    float w3 = sin((worldPos.x * 0.15 + worldPos.z * 0.1) + uTime * uWaveSpeed * 1.3) * uWaveHeight * 0.3;

    float waveY = w1 + w2 + w3;

    // normala iz talasa (derivacija)
    float dx = cos(worldPos.x * 0.3 + uTime * uWaveSpeed) * 0.3 * uWaveHeight
             + cos((worldPos.x * 0.15 + worldPos.z * 0.1) + uTime * uWaveSpeed * 1.3) * 0.15 * uWaveHeight * 0.3;
    float dz = cos(worldPos.z * 0.2 + uTime * uWaveSpeed * 0.7) * 0.2 * uWaveHeight * 0.5
             + cos((worldPos.x * 0.15 + worldPos.z * 0.1) + uTime * uWaveSpeed * 1.3) * 0.1 * uWaveHeight * 0.3;

    vNormal = normalize(vec3(-dx, 1.0, -dz));

    vec3 pos = position;
    pos.y += waveY;

    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const waterFragmentShader = `
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform sampler2D uHeightMap;
  uniform float uGridHalf;
  uniform float uSharpness;
  uniform float uFoamEnabled;
  uniform float uColorHue;

  varying vec2 vWorldXZ;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // normal map iz noise - sitni talasi na površini
  vec3 getNormalFromNoise(vec2 uv, float time, float speed) {
    float eps = 0.05;
    vec2 uv1 = uv + vec2(time * speed * 0.02, time * speed * 0.015);
    vec2 uv2 = uv + vec2(-time * speed * 0.015, time * speed * 0.02);

    float n  = noise(uv1 * 5.0) * 0.6 + noise(uv2 * 9.0) * 0.4;
    float nx = noise((uv1 + vec2(eps, 0.0)) * 5.0) * 0.6 + noise((uv2 + vec2(eps, 0.0)) * 9.0) * 0.4;
    float nz = noise((uv1 + vec2(0.0, eps)) * 5.0) * 0.6 + noise((uv2 + vec2(0.0, eps)) * 9.0) * 0.4;

    return normalize(vec3(
      (nx - n) / eps * 0.8,
      1.0,
      (nz - n) / eps * 0.8
    ));
  }

  vec3 getWaterColor(float depth, float hue) {
    vec3 shallowBlue = vec3(0.25, 0.70, 0.80);
    vec3 deepBlue    = vec3(0.02, 0.10, 0.28);
    vec3 shallowTeal = vec3(0.10, 0.72, 0.62);
    vec3 deepTeal    = vec3(0.01, 0.20, 0.18);
    vec3 shallowMud  = vec3(0.45, 0.38, 0.18);
    vec3 deepMud     = vec3(0.18, 0.14, 0.06);

    vec3 shallow, deep;
    if (hue < 0.5) {
      float t = hue * 2.0;
      shallow = mix(shallowBlue, shallowTeal, t);
      deep    = mix(deepBlue,    deepTeal,    t);
    } else {
      float t = (hue - 0.5) * 2.0;
      shallow = mix(shallowTeal, shallowMud, t);
      deep    = mix(deepTeal,    deepMud,    t);
    }
    return mix(shallow, deep, depth);
  }

  void main() {
    vec2 uv = vec2(
      (vWorldXZ.x + uGridHalf) / (uGridHalf * 2.0),
      (vWorldXZ.y + uGridHalf) / (uGridHalf * 2.0)
    );

    float encodedHeight = texture2D(uHeightMap, uv).r;
    float terrainY = (encodedHeight - 0.5) * 20.0;
    float waterY = -1.0;
    float depth = waterY - terrainY;

    if (depth <= 0.0) discard;

    float t = (uSharpness - 1.0) / 9.0;
    float edgeWidth = mix(0.8, 0.02, t);
    float foamWidth = mix(1.2, 0.15, t);
    float hardEdge = smoothstep(0.0, edgeWidth, depth);
    float normalizedDepth = clamp(depth / 4.0, 0.0, 1.0);

    vec3 foamColor = vec3(0.92, 0.97, 1.00);
    vec3 waterColor = getWaterColor(normalizedDepth, uColorHue);

    // kombinuj vertex normalnu sa noise normal mapom
    vec3 noiseNormal = getNormalFromNoise(vWorldXZ * 0.08, uTime, uWaveSpeed);
    vec3 finalNormal = normalize(vNormal * 0.6 + noiseNormal * 0.4);

    vec3 viewDir = normalize(uCameraPos - vWorldPos);

    // fresnel sa animiranom normalom
    float fresnel = pow(1.0 - max(dot(finalNormal, viewDir), 0.0), 3.0);
    waterColor = mix(waterColor, vec3(0.7, 0.90, 0.98), fresnel * 0.25);

    // specular sa animiranom normalom - kljuc za realizam
    vec3 sunDir = normalize(vec3(1.0, 2.0, 1.0));
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(dot(finalNormal, halfDir), 0.0), 80.0) * 0.4;
    waterColor += vec3(1.0, 0.98, 0.95) * spec;

    

    // foam
    float foamEdge = 1.0 - smoothstep(0.0, foamWidth, depth);
    vec2 foamUv = vWorldXZ * 0.1 + vec2(uTime * uWaveSpeed * 0.02, 0.0);
    float foamNoise = noise(foamUv * 8.0);
    float foam = foamEdge * foamNoise * step(0.4, foamNoise) * uFoamEnabled;
    waterColor = mix(waterColor, foamColor, foam * 0.85);

    float alpha = mix(0.55, 0.93, normalizedDepth) * hardEdge;
    alpha = max(alpha, foam * 0.9);

    gl_FragColor = vec4(waterColor, alpha);
  }
`;

export class WaterMesh {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.material = null;
        this.gridSize = 300;
        this.waterLevel = -1.0;
        this._startTime = performance.now();

        this.heightTexture = null;
        this.heightCanvas = document.createElement('canvas');
        this.heightCanvas.width = 512;
        this.heightCanvas.height = 512;
        this.heightCtx = this.heightCanvas.getContext('2d');
    }

    init(renderer, gridSize, terrainMesh) {
        this.renderer = renderer;
        this.gridSize = gridSize;
        this.terrainMesh = terrainMesh;

        this.heightTexture = new THREE.CanvasTexture(this.heightCanvas);
        this.heightTexture.minFilter = THREE.LinearFilter;
        this.heightTexture.magFilter = THREE.LinearFilter;

        this._buildMesh();
    }

    _buildMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material?.dispose();
            this.mesh = null;
        }

        // vise segmenata za lepe vertex talase
        const geo = new THREE.PlaneGeometry(this.gridSize, this.gridSize, 64, 64);
        geo.rotateX(-Math.PI / 2);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uCameraPos:   { value: new THREE.Vector3() },
                uTime:        { value: 0 },
                uWaveHeight:  { value: 0.12 },  // default reka
                uWaveSpeed:   { value: 1.0 },   // default reka
                uHeightMap:   { value: this.heightTexture },
                uGridHalf:    { value: this.gridSize / 2 },
                uSharpness:   { value: 5.0 },
                uFoamEnabled: { value: 1.0 },
                uColorHue:    { value: 0.0 },
            },
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,
        });

        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.y = this.waterLevel;
        this.mesh.renderOrder = 2;
        this.scene.add(this.mesh);
    }

    _updateHeightMap(terrainMesh) {
        const terrainMeshObj = terrainMesh?.getMesh();
        if (!terrainMeshObj) return;

        const pos = terrainMeshObj.geometry.attributes.position;
        const size = this.heightCanvas.width;

        const imageData = this.heightCtx.createImageData(size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = 128; data[i+1] = 128;
            data[i+2] = 128; data[i+3] = 255;
        }

        const gridRes = Math.round(Math.sqrt(pos.count));
        const heights = new Float32Array(gridRes * gridRes);
        for (let i = 0; i < pos.count; i++) heights[i] = pos.getY(i);

        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                const u = px / (size - 1);
                const v = py / (size - 1);

                const gx = u * (gridRes - 1);
                const gz = (1.0 - v) * (gridRes - 1);

                const gxi = Math.floor(gx);
                const gzi = Math.floor(gz);
                const gxf = gx - gxi;
                const gzf = gz - gzi;

                const x0 = Math.min(gxi, gridRes - 1);
                const x1 = Math.min(gxi + 1, gridRes - 1);
                const z0 = Math.min(gzi, gridRes - 1);
                const z1 = Math.min(gzi + 1, gridRes - 1);

                const h00 = heights[z0 * gridRes + x0];
                const h10 = heights[z0 * gridRes + x1];
                const h01 = heights[z1 * gridRes + x0];
                const h11 = heights[z1 * gridRes + x1];

                const h = h00*(1-gxf)*(1-gzf) + h10*gxf*(1-gzf)
                    + h01*(1-gxf)*gzf     + h11*gxf*gzf;

                const encoded = Math.floor(((h + 10.0) / 20.0) * 255);
                const clamped = Math.max(0, Math.min(255, encoded));

                const idx = (py * size + px) * 4;
                data[idx] = data[idx+1] = data[idx+2] = clamped;
                data[idx+3] = 255;
            }
        }

        this.heightCtx.putImageData(imageData, 0, 0);
        this.heightTexture.needsUpdate = true;
    }

    setSharpness(v) {
        if (this.material) this.material.uniforms.uSharpness.value = v;
    }

    setFoam(enabled) {
        if (this.material) this.material.uniforms.uFoamEnabled.value = enabled ? 1.0 : 0.0;
    }

    setColorHue(v) {
        if (this.material) this.material.uniforms.uColorHue.value = v;
    }

    setWaveHeight(v) {
        if (this.material) this.material.uniforms.uWaveHeight.value = v;
    }

    setWaveSpeed(v) {
        if (this.material) this.material.uniforms.uWaveSpeed.value = v;
    }

    update(camera, renderer, terrainMesh) {
        if (!this.material) return;
        this.material.uniforms.uTime.value = (performance.now() - this._startTime) / 1000;
        this.material.uniforms.uCameraPos.value.copy(camera.position);
        this._updateHeightMap(terrainMesh);
    }

    resize(gridSize, renderer, terrainMesh) {
        this.gridSize = gridSize;
        this.renderer = renderer;
        this.terrainMesh = terrainMesh;
        if (this.material) this.material.uniforms.uGridHalf.value = gridSize / 2;
        this._buildMesh();
    }

    clear() {}

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material?.dispose();
        }
        this.heightTexture?.dispose();
    }
}