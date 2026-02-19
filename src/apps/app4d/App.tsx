import React, { useRef } from 'react';
import MainLayout from './components/Layout/MainLayout';
import LeftPanel from './components/Tools/LeftPanel';
import RightPanel from './components/Tools/RightPanel';
import AnimeScene from './components/Viewer/AnimeScene';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';

function App() {
  const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
  const [animation, setAnimation] = React.useState<string>('idle');
  const [adjustments, setAdjustments] = React.useState({
    scale: 1,
    rotation: 0,
    color: '#ffffff',
    displacementScale: 0.2,
    metalness: 0.5,
    roughness: 0.2,
    wireframe: false,
    alphaTest: 0.5,
    emissiveIntensity: 0.2, // Default glow
    opacity: 1, // Default solid
    shape: 'plane', // Default shape
  });

  const exportRef = useRef<THREE.Group>(null);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setUploadedImage(url);
  };

  const handleExport = () => {
    if (!exportRef.current) return;

    // Safety check to ensure content is loaded
    if (exportRef.current.children.length === 0) {
      alert("Model not ready or empty.");
      return;
    }

    const exporter = new GLTFExporter();
    exporter.parse(
      exportRef.current,
      (result) => {
        let blob;
        if (result instanceof ArrayBuffer) {
          blob = new Blob([result], { type: 'application/octet-stream' });
        } else {
          const output = JSON.stringify(result, null, 2);
          blob = new Blob([output], { type: 'text/plain' });
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'custom-model.glb';
        link.click();
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error('An error happened during export:', error);
        alert("Export failed. See console for details.");
      },
      {
        binary: true // Export as GLB
      }
    );
  };

  const handleStyleSelect = (style: 'anime' | 'cyber') => {
    if (style === 'anime') {
      // Flat, clean look
      setAdjustments(prev => ({
        ...prev,
        metalness: 0,
        roughness: 1,
        displacementScale: 0.05, // Subtle depth
        color: '#ffffff',
        wireframe: false,
        emissiveIntensity: 0.1,
        opacity: 1
      }));
    } else if (style === 'cyber') {
      // Metallic, 4D look
      setAdjustments(prev => ({
        ...prev,
        metalness: 0.9,
        roughness: 0.2,
        displacementScale: 0.4, // Deep relief
        color: '#b3e0ff', // Blue tint
        wireframe: false,
        emissiveIntensity: 1.5, // High glow
        opacity: 0.9 // Slight transparent glass look
      }));
    }
  };

  return (
    <MainLayout
      leftPanel={
        <LeftPanel
          onUpload={handleUpload}
          adjustments={adjustments}
          onAdjustmentChange={setAdjustments}
        />
      }
      centerPanel={
        <AnimeScene
          textureUrl={uploadedImage}
          currentAnimation={animation}
          adjustments={adjustments}
          exportRef={exportRef}
        />
      }
      rightPanel={<RightPanel onAnimate={setAnimation} onExport={handleExport} onStyleSelect={handleStyleSelect} />}
    />
  );
}

export default App;
