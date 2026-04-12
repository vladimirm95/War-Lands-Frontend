
# War Lands - Map Editor

<img width="2232" height="1146" alt="Screenshot 2026-04-12 124800" src="https://github.com/user-attachments/assets/44212fb7-e676-428a-b349-8a0795f57f29" />

A 3D isometric terrain editor built with React and Three.js, 
designed as the foundation for a browser-based strategy game.

## Features

### Terrain
- 3D terrain with real-time height deformation (raise/lower)
- GPU-accelerated texture painting with WebGL render targets (ping-pong buffer)
- Custom GLSL shaders with multi-scale sampling (no tiling artifacts)
- Multiple map sizes: 150x150 to 600x600
- Dynamic paint map resolution per map size (1024px to 4096px)

### Textures
- Multi-layer texture splatting (grass, dirt, desert)
- Textures blend seamlessly - paint over each other
- Adjustable texture density slider

### Water System
- Dynamic depth-based water shader
- Shallow water = transparent, deep water = dark blue
- Animated vertex displacement waves
- Procedural normal map for realistic light reflections
- Foam on shorelines
- Adjustable: wave height, wave speed, shoreline sharpness, water color (blue/teal/river)

### Brush Tools
- Circular brush with adjustable size and strength
- Add texture / Erase texture
- Add hill / Lower terrain
- Terrain sharpness control (smooth valleys vs steep canyons)
- Water sharpness control (soft vs hard shorelines)

### Camera
- Q/E keyboard rotation
- Scroll zoom
- Middle-click pan
- Camera boundary system - never shows outside the map
- Reset camera button

## Tech Stack
- React + Vite
- Three.js (r128)
- WebGL / GLSL shaders
- Custom ping-pong render targets for GPU texture painting

## Getting Started
```bash
git clone https://github.com/vladimirm95/War-Lands-Frontend
cd War-Lands-Frontend
npm install
npm run dev
```
