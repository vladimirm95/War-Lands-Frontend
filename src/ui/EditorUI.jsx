import React from 'react';
import { MAP_PRESETS } from '../editor/TerrainMesh';
import { OBJECT_CATALOG } from '../editor/ObjectManager';

const TOOLS = [
    { id: 'texture',       label: 'Dodaj teksturu' },
    { id: 'erase_texture', label: 'Briši teksturu' },
    { id: 'hill',          label: 'Dodaj brdo' },
    { id: 'erase_height',  label: 'Spusti teren' },
    { id: 'place_object',  label: 'Postavi objekat' },
    { id: 'erase_object',  label: 'Briši objekat' },
];

export default function EditorUI({
                                     catalog, selectedTexture, onSelectTexture,
                                     brushSize, onBrushSize,
                                     brushStrength, onBrushStrength,
                                     texScale, onTexScale,
                                     terrainSharpness, onTerrainSharpness,
                                     waterSharpness, onWaterSharpness,
                                     waterHue, onWaterHue,
                                     foamEnabled, onFoamToggle,
                                     waveHeight, onWaveHeight,
                                     waveSpeed, onWaveSpeed,
                                     selectedObject, onSelectObject,
                                     objectScale, onObjectScale,
                                     tool, onTool,
                                     onReset, onClear,
                                     mapPresetIndex, onMapPreset,
                                 }) {
    const hueLabel = waterHue < 0.33 ? 'Plava' : waterHue < 0.66 ? 'Teal' : 'Reka';

    return (
        <div style={{
            width: 190, minWidth: 190,
            borderRight: '1px solid #ddd',
            background: '#f8f8f6',
            display: 'flex', flexDirection: 'column',
            padding: 12, gap: 16,
            overflowY: 'auto',
            fontFamily: 'sans-serif',
            userSelect: 'none',
        }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>War Lands</div>

            <Section label="Veličina mape">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {MAP_PRESETS.map((preset, i) => (
                        <button key={preset.label} onClick={() => onMapPreset(i)} style={{
                            fontSize: 11, padding: '5px 4px', cursor: 'pointer',
                            border: `1px solid ${mapPresetIndex === i ? '#333' : '#ccc'}`,
                            borderRadius: 6,
                            background: mapPresetIndex === i ? '#e8e8e8' : 'transparent',
                            color: '#333', fontWeight: mapPresetIndex === i ? 600 : 400,
                        }}>
                            {preset.label}
                            <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>
                                {preset.gridSize}x{preset.gridSize}
                            </div>
                        </button>
                    ))}
                </div>
            </Section>

            <Section label="Teksture">
                {catalog.map(({ id, label, url }) => (
                    <div key={id} onClick={() => onSelectTexture(id)} style={{
                        cursor: 'pointer', borderRadius: 6,
                        border: selectedTexture === id ? '2px solid #639922' : '2px solid transparent',
                        overflow: 'hidden', position: 'relative',
                    }}>
                        <img src={url} alt={label} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.45)', padding: '3px 6px',
                            fontSize: 12, color: '#fff',
                        }}>{label}</div>
                        {selectedTexture === id && (
                            <div style={{
                                position: 'absolute', top: 4, right: 4,
                                width: 16, height: 16, borderRadius: '50%',
                                background: '#639922', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="10" height="10" viewBox="0 0 10 10">
                                    <polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </Section>

            <Section label="Objekti">
                {OBJECT_CATALOG.map(({ id, label }) => (
                    <div
                        key={id}
                        onClick={() => { onSelectObject(id); onTool('place_object'); }}
                        style={{
                            cursor: 'pointer', padding: '6px 8px',
                            borderRadius: 6, fontSize: 12,
                            border: `1px solid ${selectedObject === id && tool === 'place_object' ? '#639922' : '#ccc'}`,
                            background: selectedObject === id && tool === 'place_object' ? '#EAF3DE' : 'transparent',
                            color: selectedObject === id && tool === 'place_object' ? '#3B6D11' : '#333',
                        }}
                    >
                        🌳 {label}
                    </div>
                ))}
                <SliderRow
                    label="Veličina objekta"
                    value={objectScale}
                    min={10} max={500}
                    onChange={onObjectScale}
                    suffix="%"
                />
            </Section>

            <Section label="Četkica">
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: '#666' }}>Veličina</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{brushSize}</span>
                    </div>
                    <input type="range" min={1} max={20} step={1} value={brushSize * 2}
                           onChange={e => onBrushSize(Number(e.target.value) / 2)} style={{ width: '100%' }} />
                </div>
                <SliderRow label="Jačina" value={Math.round(brushStrength * 100)} min={5} max={100}
                           onChange={v => onBrushStrength(v / 100)} suffix="%" />
                <SliderRow label="Gustina teksture" value={texScale} min={4} max={48} onChange={onTexScale} />
                <SliderRow label="Oštrina useka" value={terrainSharpness} min={1} max={8} onChange={onTerrainSharpness} />
            </Section>

            <Section label="Voda">
                <SliderRow label="Oštrina obale" value={waterSharpness} min={1} max={10} onChange={onWaterSharpness} />
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: '#666' }}>Boja vode</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{hueLabel}</span>
                    </div>
                    <input type="range" min={0} max={100} value={Math.round(waterHue * 100)}
                           onChange={e => onWaterHue(Number(e.target.value) / 100)} style={{ width: '100%' }} />
                    <div style={{
                        height: 6, borderRadius: 3, marginTop: 4,
                        background: 'linear-gradient(to right, #1a6bb5, #0fb89a, #7a5c1a)',
                    }} />
                </div>
                <SliderRow label="Visina talasa" value={Math.round(waveHeight * 100)} min={0} max={50}
                           onChange={v => onWaveHeight(v / 100)} />
                <SliderRow label="Brzina talasa" value={Math.round(waveSpeed * 10)} min={0} max={30}
                           onChange={v => onWaveSpeed(v / 10)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Pena na obali</span>
                    <button onClick={() => onFoamToggle(!foamEnabled)} style={{
                        fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                        border: `1px solid ${foamEnabled ? '#639922' : '#ccc'}`,
                        borderRadius: 6,
                        background: foamEnabled ? '#EAF3DE' : 'transparent',
                        color: foamEnabled ? '#3B6D11' : '#333',
                    }}>
                        {foamEnabled ? 'Uklj.' : 'Isklj.'}
                    </button>
                </div>
            </Section>

            <Section label="Alat">
                {TOOLS.map(({ id, label }) => (
                    <ToolBtn key={id} active={tool === id} onClick={() => onTool(id)}>{label}</ToolBtn>
                ))}
            </Section>

            <Section label="Kamera">
                <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7 }}>
                    <div>Rotacija: <b>Q / E</b></div>
                    <div>Zoom: <b>Scroll</b></div>
                    <div>Pan: <b>Srednji klik</b></div>
                    <div>Crtanje: <b>Levi klik</b></div>
                </div>
            </Section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                <button onClick={onReset} style={btnStyle('#333')}>Reset kamere</button>
                <button onClick={onClear} style={btnStyle('#A32D2D')}>Obriši sve</button>
            </div>
        </div>
    );
}

function Section({ label, children }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
        </div>
    );
}

function SliderRow({ label, value, min, max, onChange, suffix = '' }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{value}{suffix}</span>
            </div>
            <input type="range" min={min} max={max} value={value}
                   onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
    );
}

function ToolBtn({ active, onClick, children }) {
    return (
        <button onClick={onClick} style={{
            fontSize: 12, padding: '5px 8px', textAlign: 'left', cursor: 'pointer',
            border: `1px solid ${active ? '#333' : '#ccc'}`,
            borderRadius: 6,
            background: active ? '#e8e8e8' : 'transparent',
            color: '#333', fontWeight: active ? 600 : 400,
        }}>
            {children}
        </button>
    );
}

function btnStyle(color) {
    return {
        fontSize: 12, padding: '5px 8px', cursor: 'pointer',
        border: `1px solid ${color}`, borderRadius: 6,
        background: 'transparent', color,
    };
}