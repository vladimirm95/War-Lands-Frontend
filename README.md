# War Lands - Map Editor

A 3D isometric terrain editor built with React and Three.js, 
designed as the foundation for a browser-based strategy game.

## Features
- 3D terrain with real-time height deformation
- GPU-accelerated texture painting (WebGL render targets)
- Custom GLSL shaders with multi-scale sampling (no tiling artifacts)
- Circular brush with adjustable size and strength
- Camera system with dynamic boundary clamping
- Multiple map sizes (150x150 to 600x600)
- Q/E keyboard rotation

## Tech Stack
- React + Vite
- Three.js (r128)
- WebGL / GLSL shaders

## Getting Started
git clone https://github.com/vladimirm95/War-Lands-Frontend
cd War-Lands-Frontend
npm install
npm run dev
