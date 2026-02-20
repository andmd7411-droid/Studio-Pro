import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Layers,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToBMP, exportToSVG, exportToDXF, previewSVG } from './utils/converters';

// Types
type ExportFormat = 'BMP' | 'SVG' | 'DXF';
type DitheringMode = 'Grayscale' | 'Threshold (B&W)' | 'Edge Detection' | 'Floyd-Steinberg' | 'Atkinson (Sharper)' | 'Sierra-Lite' | 'Stucki';

interface AppState {
  originalImage: HTMLImageElement | null;
  brightness: number;
  contrast: number;
  gamma: number;
  surfaceSmoothing: number;
  denoise: number;
  lineStrength: number;
  sharpen: number;
  invertColors: boolean;
  resizeWidth: string;
  ditheringMode: DitheringMode;
  smoothness: number;
  isProcessing: boolean;
  exportFormat: ExportFormat;
  showVector: boolean;
  vectorSVG: string;
  pathOptimization: number;
  strokeWidth: number;
  // Ultra Quality Parameters
  blurRadius: number;
  rightAngleEnhance: boolean;
  minColorRange: number;
  // Professional Parameters
  scale: number;
  roundCoords: number;
  layering: number;
  colorQuantCycles: number;
  minColorRatio: number;
  // Laser-specific
  laserMode: boolean;
  // Advanced preprocessing
  morphology: number; // 0=none, 1=erode, 2=dilate, 3=open, 4=close
  bilateralFilter: number; // 0-10 strength
  unsharpMask: number; // 0-100 strength
  medianFilter: boolean;
  // BMP-specific
  bmpMode: 'color' | 'grayscale' | 'highcontrast';
  bmpDPI: number;
  // Expert Precision
  ltres: number;
  qtres: number;
  expertMode: boolean;
  // Thinning
  thinningIntensity: number; // 0-20 iterations
  // DXF & Vector Quality
  dxfUnits: 'mm' | 'inch' | 'px';
  vectorSmoothing: number;
  despeckleThreshold: number;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    originalImage: null,
    brightness: 0,
    contrast: 0,
    gamma: 1.0,
    surfaceSmoothing: 0,
    denoise: 0,
    lineStrength: 0,
    sharpen: 0,
    invertColors: false,
    resizeWidth: 'Original',
    ditheringMode: 'Grayscale',
    smoothness: 1.0,
    isProcessing: false,
    exportFormat: 'BMP',
    showVector: false,
    vectorSVG: '',
    pathOptimization: 0,
    strokeWidth: 1.5,
    blurRadius: 0,
    rightAngleEnhance: true,
    minColorRange: 0,
    scale: 1,
    roundCoords: 2,
    layering: 0,
    colorQuantCycles: 3,
    minColorRatio: 0,
    laserMode: false,
    morphology: 0,
    bilateralFilter: 0,
    unsharpMask: 0,
    medianFilter: false,
    bmpMode: 'color',
    bmpDPI: 300,
    ltres: 1,
    qtres: 1,
    expertMode: false,
    thinningIntensity: 0,
    dxfUnits: 'mm',
    vectorSmoothing: 0,
    despeckleThreshold: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setState(prev => ({ ...prev, isProcessing: true }));
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            await img.decode();
            setState(prev => ({
              ...prev,
              originalImage: img,
              isProcessing: false
            }));
          } catch (err) {
            console.error("Image decode failed", err);
            setState(prev => ({
              ...prev,
              originalImage: img,
              isProcessing: false
            }));
          }
        };
        img.onerror = () => {
          console.error("Failed to load image");
          setState(prev => ({ ...prev, isProcessing: false }));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        console.error("Failed to read file");
        setState(prev => ({ ...prev, isProcessing: false }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Dithering Algorithms
  const applyDithering = (data: Uint8ClampedArray, width: number, height: number, mode: DitheringMode) => {
    const threshold = 128;

    if (mode === 'Threshold (B&W)') {
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const v = gray > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
      return;
    }

    // Error diffusion dithering
    const getPixel = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      const i = (y * width + x) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    const setPixel = (x: number, y: number, v: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.min(255, Math.max(0, v));
    };

    const kernels: Record<string, number[][]> = {
      'Floyd-Steinberg': [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
      'Atkinson (Sharper)': [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
      'Stucki': [[1, 0, 8 / 42], [2, 0, 4 / 42], [-2, 1, 2 / 42], [-1, 1, 4 / 42], [0, 1, 8 / 42], [1, 1, 4 / 42], [2, 1, 2 / 42], [-2, 2, 1 / 42], [-1, 2, 2 / 42], [0, 2, 4 / 42], [1, 2, 2 / 42], [2, 2, 1 / 42]],
      'Sierra-Lite': [[1, 0, 2 / 4], [-1, 1, 1 / 4], [0, 1, 1 / 4]]
    };

    const kernel = kernels[mode] || kernels['Floyd-Steinberg'];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const oldV = getPixel(x, y);
        const newV = oldV > threshold ? 255 : 0;
        setPixel(x, y, newV);
        const error = oldV - newV;

        for (const [dx, dy, factor] of kernel) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const current = getPixel(nx, ny);
            setPixel(nx, ny, current + error * factor);
          }
        }
      }
    }
  };

  // Apply filters to canvas
  useEffect(() => {
    if (!state.originalImage || !canvasRef.current) return;

    const processImage = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Handle Resize
      let w = state.originalImage!.width;
      let h = state.originalImage!.height;
      if (w === 0 || h === 0) return;

      if (state.resizeWidth !== 'Original') {
        const targetWidth = parseInt(state.resizeWidth);
        const ratio = targetWidth / w;
        w = targetWidth;
        h = h * ratio;
      }
      canvas.width = w;
      canvas.height = h;

      // Use async drawing to ensure image is ready
      try {
        const bitmap = await createImageBitmap(state.originalImage!);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      } catch (err) {
        console.error("createImageBitmap failed, falling back to drawImage", err);
        ctx.drawImage(state.originalImage!, 0, 0, canvas.width, canvas.height);
      }

      // Advanced Processing - Manual pixel manipulation
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Pre-calculating factors for speed
      const c = state.contrast / 100;
      const contrastFactor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
      const gammaCorrection = 1 / state.gamma;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b_pix = data[i + 2];

        // 1. Brightness
        if (state.brightness !== 0) {
          r += state.brightness * 2.55;
          g += state.brightness * 2.55;
          b_pix += state.brightness * 2.55;
        }

        // 2. Contrast
        if (state.contrast !== 0) {
          r = contrastFactor * (r - 128) + 128;
          g = contrastFactor * (g - 128) + 128;
          b_pix = contrastFactor * (b_pix - 128) + 128;
        }

        // 3. Gamma
        if (state.gamma !== 1.0) {
          r = 255 * Math.pow(Math.max(0, r) / 255, gammaCorrection);
          g = 255 * Math.pow(Math.max(0, g) / 255, gammaCorrection);
          b_pix = 255 * Math.pow(Math.max(0, b_pix) / 255, gammaCorrection);
        }

        // 4. Invert
        if (state.invertColors) {
          r = 255 - r;
          g = 255 - g;
          b_pix = 255 - b_pix;
        }

        const gray = 0.299 * r + 0.587 * g + 0.114 * b_pix;
        data[i] = data[i + 1] = data[i + 2] = Math.min(255, Math.max(0, gray));
        data[i + 3] = 255;
      }

      // ADVANCED PREPROCESSING for Ultimate Quality
      const advData = data;
      const width_adv = canvas.width;
      const height_adv = canvas.height;

      // 1. REAL DENOISE (Modified Median + Gaussian hybrid)
      if (state.denoise > 0) {
        const temp = new Uint8ClampedArray(advData);
        const radius = Math.max(1, Math.floor(state.denoise / 30));
        for (let y = radius; y < height_adv - radius; y++) {
          for (let x = radius; x < width_adv - radius; x++) {
            const idx = (y * width_adv + x) * 4;
            let sum = 0;
            let count = 0;
            const neighbors = [];

            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nidx = ((y + dy) * width_adv + (x + dx)) * 4;
                neighbors.push(advData[nidx]);
                sum += advData[nidx];
                count++;
              }
            }
            // Hybrid: 70% Median (noise removal) + 30% Average (smoothing)
            neighbors.sort((a, b) => a - b);
            const median = neighbors[Math.floor(neighbors.length / 2)];
            const avg = sum / count;
            const factor = state.denoise / 100;
            temp[idx] = temp[idx + 1] = temp[idx + 2] = median * factor + avg * (1 - factor);
          }
        }
        advData.set(temp);
      }

      // 2. SURFACE SMOOTHING (High-performance Bilateral Filter approximation)
      if (state.surfaceSmoothing > 0) {
        const temp = new Uint8ClampedArray(advData);
        const sigma = state.surfaceSmoothing / 10;
        const radius = Math.max(1, Math.ceil(sigma));

        for (let y = radius; y < height_adv - radius; y++) {
          for (let x = radius; x < width_adv - radius; x++) {
            const idx = (y * width_adv + x) * 4;
            const centerVal = advData[idx];
            let sumWeight = 0;
            let sumVal = 0;

            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nidx = ((y + dy) * width_adv + (x + dx)) * 4;
                const val = advData[nidx];

                // Spatial weight (Gaussian)
                const spatialDist = (dx * dx + dy * dy);
                const sWeight = Math.exp(-spatialDist / (2 * sigma * sigma));

                // Intensity weight (Edge preservation)
                const colorDist = (centerVal - val) * (centerVal - val);
                const cWeight = Math.exp(-colorDist / (2 * 50 * 50)); // Fixed 50 range for consistency

                const weight = sWeight * cWeight;
                sumWeight += weight;
                sumVal += val * weight;
              }
            }
            temp[idx] = temp[idx + 1] = temp[idx + 2] = sumVal / sumWeight;
          }
        }
        advData.set(temp);
      }

      // 3. Bilateral Filter tool (Already in UI, mapped to state.bilateralFilter)
      if (state.bilateralFilter > 0) {
        const filtered = new Uint8ClampedArray(advData);
        const sigmaSpace = state.bilateralFilter;
        const sigmaColor = state.bilateralFilter * 25;
        const radius = Math.ceil(sigmaSpace * 2);

        for (let y = 0; y < height_adv; y++) {
          for (let x = 0; x < width_adv; x++) {
            const idx = (y * width_adv + x) * 4;
            const centerColor = advData[idx];
            let sumWeight = 0;
            let sumColor = 0;

            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < height_adv && nx >= 0 && nx < width_adv) {
                  const nidx = (ny * width_adv + nx) * 4;
                  const nColor = advData[nidx];
                  const spatialDist = dx * dx + dy * dy;
                  const colorDist = (centerColor - nColor) * (centerColor - nColor);
                  const weight = Math.exp(-spatialDist / (2 * sigmaSpace * sigmaSpace) - colorDist / (2 * sigmaColor * sigmaColor));
                  sumWeight += weight;
                  sumColor += weight * nColor;
                }
              }
            }
            filtered[idx] = filtered[idx + 1] = filtered[idx + 2] = sumColor / sumWeight;
          }
        }
        advData.set(filtered);
      }

      // 4. Median Filter tool
      if (state.medianFilter) {
        const filtered = new Uint8ClampedArray(advData);
        for (let y = 1; y < height_adv - 1; y++) {
          for (let x = 1; x < width_adv - 1; x++) {
            const idx = (y * width_adv + x) * 4;
            const neighbors = [];
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                neighbors.push(advData[((y + dy) * width_adv + (x + dx)) * 4]);
              }
            }
            neighbors.sort((a, b) => a - b);
            filtered[idx] = filtered[idx + 1] = filtered[idx + 2] = neighbors[4];
          }
        }
        advData.set(filtered);
      }

      // 5. Unsharp Masking (edge enhancement)
      if (state.unsharpMask > 0) {
        const blurred = new Uint8ClampedArray(advData);
        const r_blur = 2;

        for (let y = r_blur; y < height_adv - r_blur; y++) {
          for (let x = r_blur; x < width_adv - r_blur; x++) {
            const idx = (y * width_adv + x) * 4;
            let sum = 0;
            let weightSum = 0;
            for (let dy = -r_blur; dy <= r_blur; dy++) {
              for (let dx = -r_blur; dx <= r_blur; dx++) {
                const nidx = ((y + dy) * width_adv + (x + dx)) * 4;
                const weight = Math.exp(-(dx * dx + dy * dy) / (2 * r_blur * r_blur));
                sum += advData[nidx] * weight;
                weightSum += weight;
              }
            }
            blurred[idx] = sum / weightSum;
          }
        }

        const amount = state.unsharpMask / 50;
        for (let i = 0; i < advData.length; i += 4) {
          const original = advData[i];
          const blur = blurred[i];
          const sharp = original + amount * (original - blur);
          advData[i] = advData[i + 1] = advData[i + 2] = Math.min(255, Math.max(0, sharp));
        }
      }

      // 6. Morphological Operations
      if (state.morphology > 0) {
        const morphed = new Uint8ClampedArray(advData);
        const applyMorph = (operation: 'erode' | 'dilate') => {
          const current = new Uint8ClampedArray(advData);
          for (let y = 1; y < height_adv - 1; y++) {
            for (let x = 1; x < width_adv - 1; x++) {
              const idx = (y * width_adv + x) * 4;
              let value = operation === 'erode' ? 255 : 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const nidx = ((y + dy) * width_adv + (x + dx)) * 4;
                  if (operation === 'erode') value = Math.min(value, current[nidx]);
                  else value = Math.max(value, current[nidx]);
                }
              }
              morphed[idx] = morphed[idx + 1] = morphed[idx + 2] = value;
            }
          }
          advData.set(morphed);
        };

        switch (state.morphology) {
          case 1: applyMorph('erode'); break;
          case 2: applyMorph('dilate'); break;
          case 3: applyMorph('erode'); applyMorph('dilate'); break; // Opening
          case 4: applyMorph('dilate'); applyMorph('erode'); break; // Closing
        }
      }

      // Apply Dithering if needed
      if (state.ditheringMode !== 'Grayscale' && state.ditheringMode !== 'Edge Detection') {
        applyDithering(advData, canvas.width, canvas.height, state.ditheringMode);
      }

      ctx.putImageData(imageData, 0, 0);

      // LASER MODE: Single-Path Skeletonization
      if (state.laserMode || state.thinningIntensity > 0) {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dataLaser = imageData.data;
        const wL = canvas.width;
        const hL = canvas.height;

        const binary = new Uint8Array(wL * hL);
        for (let i = 0; i < dataLaser.length; i += 4) {
          binary[i / 4] = dataLaser[i] < 128 ? 1 : 0;
        }

        const iterations = state.laserMode ? 20 : state.thinningIntensity;
        if (iterations > 0) {
          const thinning = (pass: number) => {
            const toRemove = [];
            for (let y = 1; y < hL - 1; y++) {
              for (let x = 1; x < wL - 1; x++) {
                const p1 = binary[y * wL + x];
                if (p1 === 0) continue;

                const p2 = binary[(y - 1) * wL + x];
                const p3 = binary[(y - 1) * wL + (x + 1)];
                const p4 = binary[y * wL + (x + 1)];
                const p5 = binary[(y + 1) * wL + (x + 1)];
                const p6 = binary[(y + 1) * wL + x];
                const p7 = binary[(y + 1) * wL + (x - 1)];
                const p8 = binary[y * wL + (x - 1)];
                const p9 = binary[(y - 1) * wL + (x - 1)];

                const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                const a = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) +
                  (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
                  (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) +
                  (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);

                if (b >= 2 && b <= 6 && a === 1) {
                  if (pass === 0) {
                    if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) toRemove.push(y * wL + x);
                  } else {
                    if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) toRemove.push(y * wL + x);
                  }
                }
              }
            }
            for (const idx of toRemove) binary[idx] = 0;
            return toRemove.length > 0;
          };

          for (let i = 0; i < iterations; i++) {
            const changed1 = thinning(0);
            const changed2 = thinning(1);
            if (!changed1 && !changed2) break;
          }
        }

        for (let i = 0; i < binary.length; i++) {
          const v = binary[i] === 1 ? 0 : 255;
          dataLaser[i * 4] = dataLaser[i * 4 + 1] = dataLaser[i * 4 + 2] = v;
          dataLaser[i * 4 + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
      }

      // Update Vector Preview if enabled
      if (state.showVector) {
        const svg = previewSVG(
          canvas,
          state.smoothness,
          state.laserMode ? 0 : state.pathOptimization,
          state.strokeWidth,
          state.blurRadius,
          state.rightAngleEnhance,
          state.minColorRange,
          state.scale,
          state.roundCoords,
          state.layering,
          state.colorQuantCycles,
          state.minColorRatio,
          state.ltres,
          state.qtres,
          state.despeckleThreshold,
          state.vectorSmoothing
        );
        setState(prev => ({ ...prev, vectorSVG: svg }));
      }
    };

    const timeoutId = setTimeout(processImage, 250);
    return () => clearTimeout(timeoutId);
  }, [state.originalImage, state.brightness, state.contrast, state.gamma, state.invertColors, state.resizeWidth, state.ditheringMode, state.showVector, state.smoothness, state.pathOptimization, state.strokeWidth, state.blurRadius, state.rightAngleEnhance, state.minColorRange, state.scale, state.roundCoords, state.layering, state.colorQuantCycles, state.minColorRatio, state.laserMode, state.morphology, state.bilateralFilter, state.unsharpMask, state.medianFilter, state.ltres, state.qtres, state.thinningIntensity, state.denoise, state.surfaceSmoothing, state.despeckleThreshold, state.vectorSmoothing]);


  const handleExport = (format: ExportFormat) => {
    if (!canvasRef.current) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    setTimeout(() => {
      try {
        switch (format) {
          case 'BMP': exportToBMP(canvasRef.current!, state.bmpMode, state.bmpDPI); break;
          case 'SVG':
            exportToSVG(
              canvasRef.current!,
              state.smoothness,
              state.laserMode ? 0 : state.pathOptimization,
              state.strokeWidth,
              state.blurRadius,
              state.rightAngleEnhance,
              state.minColorRange,
              state.scale,
              state.roundCoords,
              state.layering,
              state.colorQuantCycles,
              state.minColorRatio,
              state.ltres,
              state.qtres,
              state.despeckleThreshold,
              state.vectorSmoothing
            );
            break;
          case 'DXF':
            exportToDXF(
              canvasRef.current!,
              state.smoothness,
              state.laserMode ? 0 : state.pathOptimization,
              state.strokeWidth,
              state.blurRadius,
              state.rightAngleEnhance,
              state.minColorRange,
              state.scale,
              state.roundCoords,
              state.layering,
              state.colorQuantCycles,
              state.minColorRatio,
              state.ltres,
              state.qtres,
              state.dxfUnits,
              state.despeckleThreshold,
              state.vectorSmoothing
            );
            break;
        }
      } catch (error) {
        console.error('Export failed:', error);
      }
      setState(prev => ({ ...prev, isProcessing: false }));
    }, 100);
  };

  return (
    <div className="app-container">
      {/* Left Sidebar: Processing Tools */}
      <aside className="sidebar">
        <div className="app-title">
          <Layers size={24} />
          <h1>Photo Converter</h1>
        </div>

        <div className="tool-group">
          <span className="tool-label" style={{ color: '#00cc99' }}>Smart Presets</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <button className="btn btn-secondary preset-btn">
              <span role="img" aria-label="photo">📸</span> Photo
            </button>
            <button className="btn btn-secondary preset-btn">
              <span role="img" aria-label="logo">🖼️</span> Logo
            </button>
          </div>
          <button className="btn btn-secondary preset-btn" style={{ width: '100%' }}>
            <span role="img" aria-label="cut" style={{ color: 'red' }}>✂️</span> Cut
          </button>
        </div>

        {/* LASER MODE TOGGLE - Prominent placement */}
        <div style={{
          background: state.laserMode ? 'linear-gradient(135deg, #ff6b00 0%, #ff0000 100%)' : 'rgba(255,255,255,0.05)',
          border: state.laserMode ? '2px solid #ff6b00' : '2px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
          onClick={() => setState(prev => ({ ...prev, laserMode: !prev.laserMode }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: state.laserMode ? '#fff' : '#00cc99', marginBottom: '0.25rem' }}>
                🔥 LASER MODE {state.laserMode ? 'ON' : 'OFF'}
              </div>
              <div style={{ fontSize: '0.75rem', color: state.laserMode ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)' }}>
                {state.laserMode ? 'SINGLE LINE PATHS • Skeletonized • Precise' : 'Click to enable single-line center paths (Skeletonization)'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.laserMode}
              onChange={() => { }}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="glass-panel">
          <span className="tool-label" style={{ color: '#00cc99' }}>Preprocessing</span>

          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Brightness: {state.brightness}</label>
            <input type="range" min="-100" max="100" value={state.brightness} onChange={(e) => setState(prev => ({ ...prev, brightness: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Contrast: {state.contrast}</label>
            <input type="range" min="-100" max="100" value={state.contrast} onChange={(e) => setState(prev => ({ ...prev, contrast: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Gamma: {state.gamma}</label>
            <input type="range" min="0.1" max="3.0" step="0.1" value={state.gamma} onChange={(e) => setState(prev => ({ ...prev, gamma: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Surface Smoothing: {state.surfaceSmoothing}</label>
            <input type="range" min="0" max="100" value={state.surfaceSmoothing} onChange={(e) => setState(prev => ({ ...prev, surfaceSmoothing: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Denoise: {state.denoise}</label>
            <input type="range" min="0" max="100" value={state.denoise} onChange={(e) => setState(prev => ({ ...prev, denoise: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Line Strength: {state.lineStrength}</label>
            <input type="range" min="0" max="100" value={state.lineStrength} onChange={(e) => setState(prev => ({ ...prev, lineStrength: Number(e.target.value) }))} />
          </div>
          <div className="control-item">
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Sharpen: {state.sharpen}</label>
            <input type="range" min="0" max="100" value={state.sharpen} onChange={(e) => setState({ ...state, sharpen: Number(e.target.value) })} />
          </div>

          <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            ✨ Auto-Enhance
          </button>
        </div>

        {/* ULTIMATE QUALITY SECTION */}
        <div className="glass-panel" style={{ borderColor: '#ff6b00', marginTop: '1rem' }}>
          <span className="tool-label" style={{ color: '#ff6b00', fontSize: '0.9rem' }}>⚡ Ultimate Quality Tools</span>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Edge-preserving noise reduction">Bilateral Filter: {state.bilateralFilter}</label>
            </div>
            <input
              type="range" min="0" max="5" step="1"
              value={state.bilateralFilter}
              onChange={(e) => setState(prev => ({ ...prev, bilateralFilter: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Edge sharpening enhancement">Unsharp Mask: {state.unsharpMask}</label>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={state.unsharpMask}
              onChange={(e) => setState(prev => ({ ...prev, unsharpMask: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Morphological line operations">Morphology: {['None', 'Erode', 'Dilate', 'Open', 'Close'][state.morphology]}</label>
            </div>
            <select
              value={state.morphology}
              onChange={(e) => setState(prev => ({ ...prev, morphology: Number(e.target.value) }))}
              className="custom-select"
              style={{ marginBottom: '0.5rem' }}
            >
              <option value="0">None</option>
              <option value="1">Erode (Thin lines)</option>
              <option value="2">Dilate (Thicken lines)</option>
              <option value="3">Open (Remove noise)</option>
              <option value="4">Close (Fill gaps)</option>
            </select>
          </div>

          <div className="control-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem' }} title="3x3 median noise filter">Median Filter</label>
            <input
              type="checkbox"
              checked={state.medianFilter}
              onChange={() => setState(prev => ({ ...prev, medianFilter: !prev.medianFilter }))}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          <div className="control-item" style={{ marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }} title="Reduces shapes to single center-lines (Zhang-Suen)">Line Thinning (Skeleton): {state.thinningIntensity}</label>
            <input
              type="range" min="0" max="20" step="1"
              value={state.thinningIntensity}
              onChange={(e) => setState(prev => ({ ...prev, thinningIntensity: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="glass-panel">

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.25rem' }}>
            <input
              type="checkbox"
              id="invertColors"
              checked={state.invertColors}
              onChange={(e) => setState({ ...state, invertColors: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="invertColors" style={{ cursor: 'pointer' }}>Invert Colors</label>
          </div>

          <div className="control-item" style={{ marginTop: '1.25rem' }}>
            <label className="tool-label" style={{ marginBottom: '0.5rem', textTransform: 'none', color: 'var(--text-main)' }}>Resize Width</label>
            <select
              value={state.resizeWidth}
              onChange={(e) => setState({ ...state, resizeWidth: e.target.value })}
              className="custom-select"
            >
              <option>Original</option>
              <option>1024</option>
              <option>2048</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Center: Main Viewport */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {!state.originalImage ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} strokeWidth={1.5} />
              <p>Drop your photo here or click to browse</p>
              <span style={{ fontSize: '0.75rem' }}>Supports PNG, JPG, WEBP</span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept="image/*"
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="canvas-container"
            >
              <div className="preview-wrapper" style={{
                aspectRatio: state.originalImage ? `${state.originalImage.width} / ${state.originalImage.height}` : 'auto',
                width: '100%',
                maxWidth: state.originalImage ? `${state.originalImage.width}px` : 'none'
              }}>
                <div
                  className="vector-preview"
                  dangerouslySetInnerHTML={{ __html: state.vectorSVG }}
                  style={{
                    display: state.showVector && state.vectorSVG ? 'flex' : 'none',
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    ['--svg-stroke-width' as any]: `${state.strokeWidth}px`
                  }}
                />

                <canvas
                  ref={canvasRef}
                  className="preview-canvas"
                  style={{
                    display: state.showVector && state.vectorSVG ? 'none' : 'block',
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>

              {state.isProcessing && (
                <div className="glass-panel" style={{ position: 'absolute', display: 'flex', gap: '1rem', alignItems: 'center', zIndex: 20 }}>
                  <Activity className="animate-pulse" size={20} />
                  <span>Processing...</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Right Sidebar: Export Configuration */}
      <aside className="sidebar sidebar-right">
        <div className="tool-group glass-panel">
          <span className="tool-label" style={{ color: '#00cc99' }}>Dithering / Mode</span>
          <select
            value={state.ditheringMode}
            onChange={(e) => setState({ ...state, ditheringMode: e.target.value as DitheringMode })}
            className="custom-select"
            style={{ marginBottom: '1rem' }}
          >
            <option>Grayscale</option>
            <option>Threshold (B&W)</option>
            <option>Edge Detection</option>
            <option>Floyd-Steinberg</option>
            <option>Atkinson (Sharper)</option>
            <option>Sierra-Lite</option>
            <option>Stucki</option>
          </select>

          {/* BMP ULTRA QUALITY CONTROLS */}
          <div style={{
            background: 'rgba(0, 204, 153, 0.08)',
            border: '1px solid rgba(0, 204, 153, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#00cc99', display: 'block', marginBottom: '0.5rem' }}>
              🖼️ BMP Quality Settings
            </span>

            <div className="control-item" style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>BMP Mode</label>
              <select
                value={state.bmpMode}
                onChange={(e) => setState(prev => ({ ...prev, bmpMode: e.target.value as 'color' | 'grayscale' | 'highcontrast' }))}
                className="custom-select"
              >
                <option value="color">24-bit Color (Full Quality)</option>
                <option value="grayscale">8-bit Grayscale</option>
                <option value="highcontrast">High Contrast B&W (Laser)</option>
              </select>
            </div>

            <div className="control-item">
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>
                DPI: {state.bmpDPI} {state.bmpDPI >= 300 ? '(Print Quality)' : state.bmpDPI >= 150 ? '(Screen)' : '(Draft)'}
              </label>
              <input
                type="range" min="72" max="600" step="1"
                value={state.bmpDPI}
                onChange={(e) => setState(prev => ({ ...prev, bmpDPI: Number(e.target.value) }))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                <span>72 (Web)</span><span>300 (Print)</span><span>600 (Ultra)</span>
              </div>
            </div>
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontWeight: 'bold', color: '#00cc99' }}>Live Vector Preview</label>
              <input
                type="checkbox"
                checked={state.showVector}
                onChange={(e) => setState(prev => ({ ...prev, showVector: e.target.checked }))}
                style={{ width: '20px', height: '20px' }}
              />
            </div>
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontWeight: 'bold' }}>Precision / Detail: {(20.1 - state.smoothness).toFixed(1)}</label>
            </div>
            <input
              type="range" min="0.1" max="20.0" step="0.1"
              value={state.smoothness}
              onChange={(e) => setState(prev => ({ ...prev, smoothness: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontWeight: 'bold' }}>Path Optimization: {state.pathOptimization}</label>
            </div>
            <input
              type="range" min="0" max="500" step="1"
              value={state.pathOptimization}
              onChange={(e) => setState(prev => ({ ...prev, pathOptimization: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontWeight: 'bold' }}>Line Thickness: {state.strokeWidth.toFixed(1)}</label>
            </div>
            <input
              type="range" min="0.1" max="10.0" step="0.1"
              value={state.strokeWidth}
              onChange={(e) => setState(prev => ({ ...prev, strokeWidth: Number(e.target.value) }))}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }}>
            <span className="tool-label" style={{ color: '#00cc99', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Advanced Ultra Quality</span>
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Trace Smoothing: {state.blurRadius}</label>
            </div>
            <input
              type="range" min="0" max="25" step="1"
              value={state.blurRadius}
              onChange={(e) => setState(prev => ({ ...prev, blurRadius: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Detail Filtering: {state.minColorRange}</label>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              value={state.minColorRange}
              onChange={(e) => setState(prev => ({ ...prev, minColorRange: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem' }} title="Sharpens geometric corners and right angles">Corner Sharpness</label>
            <input
              type="checkbox"
              checked={state.rightAngleEnhance}
              onChange={() => setState(prev => ({ ...prev, rightAngleEnhance: !prev.rightAngleEnhance }))}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }}>
            <span className="tool-label" style={{ color: '#00cc99', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Professional Controls</span>
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Scales the entire SVG output">SVG Scale: {state.scale.toFixed(1)}x</label>
            </div>
            <input
              type="range" min="0.1" max="5.0" step="0.1"
              value={state.scale}
              onChange={(e) => setState(prev => ({ ...prev, scale: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Coordinate decimal precision">Precision: {state.roundCoords} decimals</label>
            </div>
            <input
              type="range" min="0" max="4" step="1"
              value={state.roundCoords}
              onChange={(e) => setState(prev => ({ ...prev, roundCoords: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Color quantization quality">Quant Cycles: {state.colorQuantCycles}</label>
            </div>
            <input
              type="range" min="1" max="10" step="1"
              value={state.colorQuantCycles}
              onChange={(e) => setState(prev => ({ ...prev, colorQuantCycles: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.85rem' }} title="Minimum color ratio threshold">Min Color Ratio: {state.minColorRatio.toFixed(2)}</label>
            </div>
            <input
              type="range" min="0" max="0.5" step="0.01"
              value={state.minColorRatio}
              onChange={(e) => setState(prev => ({ ...prev, minColorRatio: Number(e.target.value) }))}
            />
          </div>

          <div className="control-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem' }} title="Sequential (0) or Parallel (1) layering">Layering Method</label>
            <input
              type="checkbox"
              checked={state.layering === 1}
              onChange={() => setState(prev => ({ ...prev, layering: prev.layering === 0 ? 1 : 0 }))}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          {/* EXPERT MODE UI */}
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span className="tool-label" style={{ color: '#ff6b00', fontSize: '0.8rem' }}>🛠️ Expert Precision Controls</span>
              <input
                type="checkbox"
                checked={state.expertMode}
                onChange={() => setState(prev => ({ ...prev, expertMode: !prev.expertMode }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </div>
            {state.expertMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <div className="control-item">
                  <label style={{ fontSize: '0.8rem' }}>Line Precision (ltres): {state.ltres.toFixed(1)}</label>
                  <input type="range" min="0.1" max="5.0" step="0.1" value={state.ltres} onChange={(e) => setState(prev => ({ ...prev, ltres: Number(e.target.value) }))} />
                </div>
                <div className="control-item">
                  <label style={{ fontSize: '0.8rem' }}>Curve Precision (qtres): {state.qtres.toFixed(1)}</label>
                  <input type="range" min="0.1" max="5.0" step="0.1" value={state.qtres} onChange={(e) => setState(prev => ({ ...prev, qtres: Number(e.target.value) }))} />
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#ff6b00', display: 'block', marginBottom: '0.5rem' }}>Vector Quality & Refinement</span>

                  <div className="control-item">
                    <label style={{ fontSize: '0.8rem' }}>Despeckle (Noise): {state.despeckleThreshold}px</label>
                    <input type="range" min="0" max="100" step="1" value={state.despeckleThreshold} onChange={(e) => setState(prev => ({ ...prev, despeckleThreshold: Number(e.target.value) }))} />
                  </div>

                  <div className="control-item">
                    <label style={{ fontSize: '0.8rem' }}>Path Smoothing: {state.vectorSmoothing} iter</label>
                    <input type="range" min="0" max="10" step="1" value={state.vectorSmoothing} onChange={(e) => setState(prev => ({ ...prev, vectorSmoothing: Number(e.target.value) }))} />
                  </div>

                  <div className="control-item">
                    <label style={{ fontSize: '0.8rem' }}>DXF Units</label>
                    <select
                      value={state.dxfUnits}
                      onChange={(e) => setState(prev => ({ ...prev, dxfUnits: e.target.value as 'mm' | 'inch' | 'px' }))}
                      className="custom-select"
                      style={{ padding: '4px', fontSize: '0.8rem' }}
                    >
                      <option value="mm">Millimeters (mm)</option>
                      <option value="inch">Inches (in)</option>
                      <option value="px">Pixels (px)</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '1rem' }}>
            <button className="btn" style={{ background: '#0078d4' }} onClick={() => handleExport('BMP')}>Save BMP</button>
            <button className="btn" style={{ background: '#00cc99' }} onClick={() => handleExport('DXF')}>Save DXF</button>
          </div>
          <button className="btn" style={{ background: '#7e22ce', width: '100%', marginTop: '10px' }} onClick={() => handleExport('SVG')}>Save SVG</button>
        </div>
      </aside>
    </div>
  );
};

export default App;
