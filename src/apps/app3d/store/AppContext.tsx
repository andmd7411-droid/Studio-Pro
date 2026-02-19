import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import type { ImageSettings, ModelSettings, GCodeSettings } from '../types';

interface AppState {
    originalImage: HTMLImageElement | null;
    processedImage: string | null; // URL
    imageDimensions: { width: number; height: number };
    heightmap: Float32Array | null;
    imageSettings: ImageSettings;
    modelSettings: ModelSettings;
    gcodeSettings: GCodeSettings;
    isProcessing: boolean;

    // Actions
    setOriginalImage: (img: HTMLImageElement) => void;
    setProcessedImage: (url: string) => void;
    setImageDimensions: (dim: { width: number; height: number }) => void;
    setHeightmap: (map: Float32Array) => void;
    updateImageSettings: (settings: Partial<ImageSettings>) => void;
    updateModelSettings: (settings: Partial<ModelSettings>) => void;
    updateGCodeSettings: (settings: Partial<GCodeSettings>) => void;
    setIsProcessing: (loading: boolean) => void;
}

const defaultImageSettings: ImageSettings = {
    invert: false,
    sharpen: 0,
    blur: 0,
    contrast: 0,
    brightness: 0,
    gamma: 1.0,
    noiseReduction: 0,
    grayscale: true,
};

const defaultModelSettings: ModelSettings = {
    width: 100,
    height: 100, // will be adjusted by aspect ratio
    depth: 5,
    segmentation: 150, // Res of the grid
    baseHeight: 2,
    smoothing: false,
    smoothingIterations: 2,
    frameWidth: 0,
    frameDepth: 5,
    curveAngle: 0,
    showWireframe: false,
    materialColor: '#e2e8f0',
    resolution: 1024, // Default Medium
};

const defaultGCodeSettings: GCodeSettings = {
    toolDiameter: 3.175, // 1/8 inch
    feedRate: 1000,
    plungeRate: 300,
    safeHeight: 5,
    spindleSpeed: 12000,
    stepOver: 0.5, // 50%
    oversize: 0,
    passDepth: 0, // 0 = single pass (full depth)
};

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [heightmap, setHeightmap] = useState<Float32Array | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [imageSettings, setImageSettings] = useState<ImageSettings>(defaultImageSettings);
    const [modelSettings, setModelSettings] = useState<ModelSettings>(defaultModelSettings);
    const [gcodeSettings, setGCodeSettings] = useState<GCodeSettings>(defaultGCodeSettings);

    const updateImageSettings = (settings: Partial<ImageSettings>) => {
        setImageSettings(prev => ({ ...prev, ...settings }));
    };

    const updateModelSettings = (settings: Partial<ModelSettings>) => {
        setModelSettings(prev => ({ ...prev, ...settings }));
    };

    const updateGCodeSettings = (settings: Partial<GCodeSettings>) => {
        setGCodeSettings(prev => ({ ...prev, ...settings }));
    };

    return (
        <AppContext.Provider value={{
            originalImage,
            processedImage,
            imageDimensions,
            heightmap,
            imageSettings,
            modelSettings,
            gcodeSettings,
            isProcessing,
            setOriginalImage,
            setProcessedImage,
            setImageDimensions,
            setHeightmap,
            updateImageSettings,
            updateModelSettings,
            updateGCodeSettings,
            setIsProcessing,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppStore = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppStore must be used within an AppProvider');
    }
    return context;
};
