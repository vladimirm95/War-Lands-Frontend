import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './SceneManager';
import { TerrainMesh, MAP_PRESETS } from './TerrainMesh';
import { BrushTool } from './BrushTool';
import { TextureManager } from './TextureManager';
import EditorUI from '../ui/EditorUI';

const DEFAULT_SPHERICAL = { radius: 60, phi: 0.785, theta: 0.795 };
const DEFAULT_PRESET_INDEX = 1;

export default function MapEditor() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const terrainRef = useRef(null);
  const brushRef = useRef(null);
  const textureManagerRef = useRef(null);

  const isDrawing = useRef(false);
  const isMidDrag = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const lastApply = useRef(0);
  const keysPressed = useRef({});

  const [selectedTexture, setSelectedTexture] = useState('grass1');
  const [brushSize, setBrushSize] = useState(3);
  const [brushStrength, setBrushStrength] = useState(1.0);
  const [tool, setTool] = useState('texture');
  const [catalog, setCatalog] = useState([]);
  const [ready, setReady] = useState(false);
  const [mapPresetIndex, setMapPresetIndex] = useState(DEFAULT_PRESET_INDEX);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sm = new SceneManager(canvas);
    const tm = new TextureManager();
    sceneRef.current = sm;
    textureManagerRef.current = tm;

    sm.init();
    sm.setMapSize(MAP_PRESETS[DEFAULT_PRESET_INDEX].gridSize);

    tm.loadAll().then(() => {
      const terrain = new TerrainMesh(sm.scene);
      const defaultPreset = MAP_PRESETS[DEFAULT_PRESET_INDEX];

      // prosledjujemo niz tekstura [grass1, dirt1]
      terrain.init(
  [tm.get('grass1'), tm.get('dirt1'), tm.get('desert1')],
  sm.renderer,
  defaultPreset.paintRes
);
      terrainRef.current = terrain;

      const brush = new BrushTool(sm.camera, terrain);
      sm.scene.add(brush.getCursorMesh());
      brushRef.current = brush;

      setCatalog(tm.getCatalog());

      sm.onFirstFrame(() => {
        terrain.initPaintMap();
        setReady(true);
      });
    });

    const onResize = () => sceneRef.current?.onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      sm.destroy();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const sm = sceneRef.current;
      if (!sm) return;
      sm.spherical.radius = Math.max(20, Math.min(60, sm.spherical.radius + e.deltaY * 0.1));
      sm.updateCamera();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => { keysPressed.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e) => { keysPressed.current[e.key.toLowerCase()] = false; };
    let rafId;
    const rotationLoop = () => {
      const sm = sceneRef.current;
      if (sm) {
        if (keysPressed.current['q']) sm.rotate(-1);
        if (keysPressed.current['e']) sm.rotate(1);
      }
      rafId = requestAnimationFrame(rotationLoop);
    };
    rafId = requestAnimationFrame(rotationLoop);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => { if (brushRef.current) brushRef.current.setSize(brushSize); }, [brushSize]);
  useEffect(() => { if (brushRef.current) brushRef.current.setStrength(brushStrength); }, [brushStrength]);
  useEffect(() => { if (brushRef.current) brushRef.current.setTool(tool); }, [tool]);

  // kad se selektuje tekstura, setuj aktivni layer
  useEffect(() => {
    if (!brushRef.current || !textureManagerRef.current) return;
    const catalog = textureManagerRef.current.getCatalog();
    const index = catalog.findIndex(t => t.id === selectedTexture);
    brushRef.current.setActiveLayer(index >= 0 ? index : 0);
  }, [selectedTexture]);

  function getNDC(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      isDrawing.current = true;
      const hit = brushRef.current?.updateCursor(getNDC(e));
      if (hit) {
        lastApply.current = performance.now();
        brushRef.current.apply(hit, sceneRef.current.renderer);
      }
    }
    if (e.button === 1) { isMidDrag.current = true; e.preventDefault(); }
    prevMouse.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e) {
    const now = performance.now();
    const dx = e.clientX - prevMouse.current.x;
    const dy = e.clientY - prevMouse.current.y;
    const sm = sceneRef.current;
    if (!sm) return;

    const hit = brushRef.current?.updateCursor(getNDC(e));
    if (isMidDrag.current) sm.pan(dx, dy);

    if (isDrawing.current && hit && now - lastApply.current > 16) {
      lastApply.current = now;
      brushRef.current.apply(hit, sm.renderer);
    }
    prevMouse.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseUp(e) {
    if (e.button === 0) isDrawing.current = false;
    if (e.button === 1) isMidDrag.current = false;
  }

  function handleReset() {
    const sm = sceneRef.current;
    if (!sm) return;
    sm.spherical = { ...DEFAULT_SPHERICAL };
    sm.orbitTarget.set(0, 0, 0);
    sm.updateCamera();
  }

  function handleClear() {
    terrainRef.current?.clear(sceneRef.current?.renderer);
  }

  function handleSelectTexture(id) {
    setSelectedTexture(id);
  }

  function handleMapPreset(index) {
    const preset = MAP_PRESETS[index];
    const terrain = terrainRef.current;
    const sm = sceneRef.current;
    if (!terrain || !sm) return;

    setMapPresetIndex(index);
    sm.setMapSize(preset.gridSize);
    terrain.resize(preset.gridSize, preset.segments, preset.paintRes, sm.renderer);
    sm.spherical = { ...DEFAULT_SPHERICAL };
    sm.orbitTarget.set(0, 0, 0);
    sm.updateCamera();
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <EditorUI
        catalog={catalog}
        selectedTexture={selectedTexture}
        onSelectTexture={handleSelectTexture}
        brushSize={brushSize}
        onBrushSize={setBrushSize}
        brushStrength={brushStrength}
        onBrushStrength={setBrushStrength}
        tool={tool}
        onTool={setTool}
        onReset={handleReset}
        onClear={handleClear}
        mapPresetIndex={mapPresetIndex}
        onMapPreset={handleMapPreset}
      />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#4a6741', fontSize: 16, color: '#fff', zIndex: 10,
          }}>
            Učitavanje...
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onContextMenu={e => e.preventDefault()}
        />
      </div>
    </div>
  );
}