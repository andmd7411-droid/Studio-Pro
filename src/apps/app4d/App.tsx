import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float, MeshReflectorMaterial, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Upload, Settings, Download, Zap, Layers, Maximize, Sliders, Box, Circle, Database, Package, Sun, Moon, Cloud, Star } from 'lucide-react';
import './index.css';
import './App.css';

// --- Types ---
interface AppSettings {
  depth: number;
  contrast: number;
  invert: boolean;
  shape: 'plane' | 'box' | 'sphere' | 'cylinder' | 'torus' | 'icosa' | 'cone' | 'volume';
  metalness: number;
  roughness: number;
  opacity: number;
  glow: number;
  glowColor: string;
  smoothing: number;
  resolution: number;
  materialColor: string;
  wireframe: boolean;
  autoRotate: boolean;
  exposure: number;
  environment: 'studio' | 'city' | 'sunset' | 'warehouse';
  bloom: number;
  ssao: boolean;
}

// --- 3D Model Component ---
const Model4D = ({ image, settings, meshRef }: { image: string | null, settings: AppSettings, meshRef: React.RefObject<THREE.Mesh> }) => {
  // use meshRef passed from parent
  const texture = useMemo(() => {
    if (!image) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(image);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [image]);

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!image) return;

    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;

    img.onload = () => {
      // --- PRO ENGINE CONFIG ---
      const GRID = Math.min(192, settings.resolution); // Higher resolution for professional look
      const w = GRID;
      const h = Math.round((img.height / img.width) * w);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      if (settings.shape === 'volume') {
        // --- SOLID 4D VOXEL EXTRUSION ---
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        let vi = 0;

        const cellW = 5 / w;
        const cellH = (5 * (h / w)) / h;
        const depth = settings.depth;

        // 1. Calculate Alpha Mask and SDF (Distance to Edge) for Inflation
        const mask = new Uint8Array(w * h);
        for (let i = 0; i < h * w; i++) mask[i] = data[i * 4 + 3] > 60 ? 1 : 0;

        // BFS-based SDF for inflation
        const dists = new Float32Array(w * h).fill(999);
        const queue: number[] = [];
        for (let i = 0; i < w * h; i++) {
          if (mask[i] === 0) {
            dists[i] = 0;
            const x = i % w, y = Math.floor(i / w);
            if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) queue.push(i);
          }
        }

        let head = 0;
        while (head < queue.length) {
          const idx = queue[head++];
          const x = idx % w, y = Math.floor(idx / w);
          const d = dists[idx];
          [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = ny * w + nx;
              if (dists[nIdx] > d + 1) {
                dists[nIdx] = d + 1;
                queue.push(nIdx);
              }
            }
          });
        }

        const isFG = (gx: number, gy: number) => gx >= 0 && gx < w && gy >= 0 && gy < h && mask[gy * w + gx];

        const addQuad = (p0: number[], p1: number[], p2: number[], p3: number[], n: number[], u0: number, v0: number, u1: number, v1: number) => {
          positions.push(...p0, ...p1, ...p2, ...p3);
          normals.push(...n, ...n, ...n, ...n);
          uvs.push(u0, 1 - v0, u1, 1 - v0, u1, 1 - v1, u0, 1 - v1);
          indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          vi += 4;
        };

        for (let gy = 0; gy < h; gy++) {
          for (let gx = 0; gx < w; gx++) {
            if (!isFG(gx, gy)) continue;

            const idx = gy * w + gx;
            const x0 = -2.5 + gx * cellW;
            const x1 = x0 + cellW;
            const y0 = (2.5 * (h / w)) - gy * cellH;
            const y1 = y0 - cellH;

            // Organic Inflation Formula
            const edgeDist = dists[idx];
            const inflation = Math.sin(Math.min(1, edgeDist / (w * 0.12)) * Math.PI / 2);

            let brightness = (data[idx * 4] * 0.299 + data[idx * 4 + 1] * 0.587 + data[idx * 4 + 2] * 0.114) / 255;
            brightness = Math.pow(brightness, 1 / settings.contrast);
            if (settings.invert) brightness = 1 - brightness;

            const zFront = (brightness * 0.3 + inflation * 0.7) * depth;
            const zBack = -inflation * 0.2 * depth; // Slight back inflation

            const u0 = gx / w, u1 = (gx + 1) / w;
            const v0 = gy / h, v1 = (gy + 1) / h;

            // Front
            addQuad([x0, y1, zFront], [x1, y1, zFront], [x1, y0, zFront], [x0, y0, zFront], [0, 0, 1], u0, v1, u1, v0);
            // Back
            addQuad([x0, y0, zBack], [x1, y0, zBack], [x1, y1, zBack], [x0, y1, zBack], [0, 0, -1], u0, v0, u1, v1);

            // Sides
            if (!isFG(gx, gy - 1)) addQuad([x0, y0, zBack], [x1, y0, zBack], [x1, y0, zFront], [x0, y0, zFront], [0, 1, 0], u0, v0, u1, v0);
            if (!isFG(gx, gy + 1)) addQuad([x0, y1, zFront], [x1, y1, zFront], [x1, y1, zBack], [x0, y1, zBack], [0, -1, 0], u0, v1, u1, v1);
            if (!isFG(gx - 1, gy)) addQuad([x0, y0, zFront], [x0, y0, zBack], [x0, y1, zBack], [x0, y1, zFront], [-1, 0, 0], u0, v0, u0, v1);
            if (!isFG(gx + 1, gy)) addQuad([x1, y0, zBack], [x1, y0, zFront], [x1, y1, zFront], [x1, y1, zBack], [1, 0, 0], u1, v0, u1, v1);
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        setGeometry(geo);
      } else {
        // --- STANDARD SHAPE RIGGING ---
        let newGeo: THREE.BufferGeometry;
        switch (settings.shape) {
          case 'box': newGeo = new THREE.BoxGeometry(5, 5, 5, w - 1, w - 1, w - 1); break;
          case 'sphere': newGeo = new THREE.SphereGeometry(3, w, w); break;
          case 'cylinder': newGeo = new THREE.CylinderGeometry(2, 2, 5, w); break;
          case 'torus': newGeo = new THREE.TorusGeometry(3, 1, 32, w); break;
          case 'icosa': newGeo = new THREE.IcosahedronGeometry(3, Math.min(settings.resolution / 32, 5)); break;
          case 'cone': newGeo = new THREE.ConeGeometry(3, 5, w); break;
          default: newGeo = new THREE.PlaneGeometry(5, 5 * (h / w), w - 1, h - 1);
        }

        const vertices = newGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
          const xIdx = Math.round(((x + 2.5) / 5) * (w - 1));
          const yIdx = Math.round(((2.5 - y) / 5) * (h - 1));
          const dataIdx = (Math.max(0, Math.min(h - 1, yIdx)) * w + Math.max(0, Math.min(w - 1, xIdx))) * 4;

          if (dataIdx >= 0 && dataIdx < data.length) {
            let brightness = (data[dataIdx] * 0.299 + data[dataIdx + 1] * 0.587 + data[dataIdx + 2] * 0.114) / 255;
            brightness = Math.pow(brightness, 1 / settings.contrast);
            if (settings.invert) brightness = 1 - brightness;
            const alpha = data[dataIdx + 3] / 255;
            const displacement = brightness * alpha * settings.depth;

            if (settings.shape === 'plane') {
              vertices[i + 2] = displacement;
            } else {
              const vector = new THREE.Vector3(x, y, z).normalize();
              vertices[i] += vector.x * displacement;
              vertices[i + 1] += vector.y * displacement;
              vertices[i + 2] += vector.z * displacement;
            }
          }
        }
        newGeo.computeVertexNormals();
        setGeometry(newGeo);
      }
    };
  }, [image, settings.depth, settings.resolution, settings.shape, settings.contrast, settings.invert]);

  if (!image || !geometry) return null;

  return (
    <group rotation={[0, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          map={texture}
          wireframe={settings.wireframe}
          color={settings.materialColor}
          roughness={0.2}
          metalness={settings.metalness}
          opacity={settings.opacity}
          transparent={true}
          alphaTest={0.05}
          emissive={new THREE.Color(settings.glowColor)}
          emissiveIntensity={settings.glow}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

// --- Viewport Component ---
const Viewport = ({ image, settings, meshRef }: { image: string | null, settings: AppSettings, meshRef: React.RefObject<THREE.Mesh> }) => {
  return (
    <div className="viewport-container" style={{ position: 'relative' }}>
      {!image && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-dim)', textAlign: 'center', pointerEvents: 'none' }}>
          <Upload size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>Așteptare Imagine...</p>
          <p style={{ fontSize: '0.8rem' }}>Încarcă un PNG pentru a genera modelul 4D</p>
        </div>
      )}
      <Canvas shadows camera={{ position: [0, 0, 10], fov: 45 }}>
        <color attach="background" args={['#080808']} />

        <ambientLight intensity={settings.exposure * 0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <spotLight position={[0, 10, 0]} angle={0.15} penumbra={1} intensity={2} castShadow />

        <React.Suspense fallback={null}>
          <Model4D image={image} settings={settings} meshRef={meshRef} />
          <Environment preset={settings.environment} />
          <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={15} blur={2.5} far={4} color="#000000" />
        </React.Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate={settings.autoRotate}
          autoRotateSpeed={0.5}
          makeDefault
        />
      </Canvas>
      <div className="status-badge">
        <div className="pulse"></div>
        <span>ORGANIC 4D ENGINE ACTIVE</span>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [settings, setSettings] = useState<AppSettings>({
    depth: 1.5,
    contrast: 1.0,
    invert: false,
    shape: 'volume',
    smoothing: 0.5,
    resolution: 256,
    materialColor: '#ffffff',
    metalness: 0.4,
    roughness: 0.5,
    opacity: 1.0,
    glow: 0.0,
    glowColor: '#ffffff',
    wireframe: false,
    autoRotate: true,
    exposure: 1.0,
    environment: 'studio',
    bloom: 1.0,
    ssao: true
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    if (!meshRef.current) {
      alert("Niciun model încărcat!");
      return;
    }

    const exporter = new STLExporter();
    const result = exporter.parse(meshRef.current, { binary: true });

    // cast to any to resolve BlobPart type conflict
    const blob = new Blob([result as any], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);

    link.href = URL.createObjectURL(blob);
    link.download = `model_4d_${Date.now()}.stl`;
    link.click();

    document.body.removeChild(link);
  };

  const handleExportGLB = () => {
    if (!meshRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      meshRef.current,
      (result: any) => {
        const output = result instanceof ArrayBuffer ? result : JSON.stringify(result);
        const blob = new Blob([output], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `model_4d_${Date.now()}.glb`;
        link.click();
      },
      (error: any) => console.error(error),
      { binary: true }
    );
  };

  return (
    <div className="studio-container">
      {/* --- Left Sidebar --- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Project Assets</h2>
        </div>

        <div className="tool-group">
          <div className="preview-box" onClick={() => fileInputRef.current?.click()}>
            {image ? <img src={image} alt="Source" /> : <Upload className="text-muted" />}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            Import PNG
          </button>
        </div>

        <div className="tool-group">
          <div className="sidebar-header">
            <h2>Presets</h2>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <button className="btn-primary" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }} onClick={() => { updateSetting('depth', 2.5); updateSetting('contrast', 1.5); }}>
              <Zap size={16} /> Organic Hyper
            </button>
            <button className="btn-primary" style={{ background: 'var(--purple)', gridColumn: 'span 2' }} onClick={() => {
              updateSetting('shape', 'volume');
              updateSetting('depth', 1.8);
              updateSetting('contrast', 1.2);
              updateSetting('resolution', 192);
              updateSetting('materialColor', '#ffffff');
            }}>
              <Zap size={16} /> Studio Pro (High Fidelity)
            </button>
            <button className="btn-primary" style={{ background: 'var(--glass)' }} onClick={() => { updateSetting('shape', 'volume'); updateSetting('depth', 1.5); updateSetting('contrast', 1.0); }}>
              <Layers size={16} /> 4D Process
            </button>
          </div>
        </div>

        <div className="tool-group">
          <div className="sidebar-header">
            <h2>Base Shape</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'plane' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'plane')}
            >
              Plane
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'box' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'box')}
            >
              Box
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'sphere' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'sphere')}
            >
              Sphere
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'cylinder' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'cylinder')}
            >
              Cyl
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'torus' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'torus')}
            >
              Torus
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'icosa' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'icosa')}
            >
              Poly
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'cone' ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem' }}
              onClick={() => updateSetting('shape', 'cone')}
            >
              Cone
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.shape === 'volume' ? 'var(--emerald)' : 'var(--glass)', fontSize: '0.75rem', gridColumn: 'span 2' }}
              onClick={() => updateSetting('shape', 'volume')}
            >
              <Database size={14} /> Real 4D Volume
            </button>
          </div>
        </div>
      </aside>

      {/* --- Main Viewport --- */}
      <main>
        <Viewport image={image} settings={settings} meshRef={meshRef as React.RefObject<THREE.Mesh>} />
      </main>

      {/* --- Right Sidebar --- */}
      <aside className="sidebar sidebar-right">
        <div className="tool-group">
          <div className="sidebar-header">
            <h2>Actions</h2>
          </div>
          <button className="btn-primary" style={{ background: 'var(--emerald)', marginBottom: '0.5rem' }} onClick={handleExport}>
            <Download size={18} />
            Export 3D Model (STL)
          </button>
          <button className="btn-primary" style={{ background: 'var(--purple)', marginBottom: '1.5rem' }} onClick={handleExportGLB}>
            <Package size={18} />
            Export 4D Model (.glb)
          </button>
        </div>

        <div className="sidebar-header">
          <h2>4D Parameters</h2>
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Model Depth</span>
            <span>{settings.depth.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0" max="5" step="0.1"
            value={settings.depth}
            onChange={(e) => updateSetting('depth', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Contrast</span>
            <span>{settings.contrast.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0.1" max="3" step="0.1"
            value={settings.contrast}
            onChange={(e) => updateSetting('contrast', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <label className="tool-label" style={{ cursor: 'pointer' }}>
            <span>Invert Depth</span>
            <input
              type="checkbox"
              checked={settings.invert}
              onChange={(e) => updateSetting('invert', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
          </label>
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Model Base Color</span>
            <input
              type="color"
              value={settings.materialColor}
              onChange={(e) => updateSetting('materialColor', e.target.value)}
              style={{ padding: 0, border: 'none', background: 'none', width: '30px', height: '24px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Glow Color</span>
            <input
              type="color"
              value={settings.glowColor}
              onChange={(e) => updateSetting('glowColor', e.target.value)}
              style={{ padding: 0, border: 'none', background: 'none', width: '30px', height: '24px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Smoothing Level</span>
            <span>{settings.smoothing.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0" max="1" step="0.01"
            value={settings.smoothing}
            onChange={(e) => updateSetting('smoothing', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Metalness</span>
            <span>{settings.metalness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0" max="1" step="0.05"
            value={settings.metalness}
            onChange={(e) => updateSetting('metalness', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Roughness</span>
            <span>{settings.roughness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0" max="1" step="0.05"
            value={settings.roughness}
            onChange={(e) => updateSetting('roughness', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Glow Intensity</span>
            <span>{settings.glow.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0" max="5" step="0.1"
            value={settings.glow}
            onChange={(e) => updateSetting('glow', parseFloat(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Mesh Resolution</span>
            <span>{settings.resolution}px</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="64" max="512" step="64"
            value={settings.resolution}
            onChange={(e) => updateSetting('resolution', parseInt(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <div className="tool-label">
            <span>Exposure</span>
            <span>{settings.exposure.toFixed(2)}</span>
          </div>
          <input
            type="range"
            className="control-input"
            min="0.1" max="2" step="0.1"
            value={settings.exposure}
            onChange={(e) => updateSetting('exposure', parseFloat(e.target.value))}
          />
        </div>


        <div className="tool-group">
          <div className="sidebar-header" style={{ marginBottom: '1rem' }}>
            <h2>Environment</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {(['studio', 'city', 'sunset', 'warehouse'] as const).map((env) => (
              <button
                key={env}
                className="btn-primary"
                style={{ background: settings.environment === env ? 'var(--accent)' : 'var(--glass)', fontSize: '0.75rem', textTransform: 'capitalize' }}
                onClick={() => updateSetting('environment', env)}
              >
                {env === 'studio' && <Sun size={14} />}
                {env === 'city' && <Star size={14} />}
                {env === 'sunset' && <Cloud size={14} />}
                {env === 'warehouse' && <Box size={14} />}
                {env}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group" style={{ marginTop: 'auto' }}>
          <div className="sidebar-header">
            <h2>View Settings</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className="btn-primary"
              style={{ background: settings.wireframe ? 'var(--accent)' : 'var(--glass)', border: '1px solid var(--border)' }}
              onClick={() => updateSetting('wireframe', !settings.wireframe)}
            >
              <Box size={16} /> Wireframe
            </button>
            <button
              className="btn-primary"
              style={{ background: settings.autoRotate ? 'var(--accent)' : 'var(--glass)', border: '1px solid var(--border)' }}
              onClick={() => updateSetting('autoRotate', !settings.autoRotate)}
            >
              <Maximize size={16} /> Rotation
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
