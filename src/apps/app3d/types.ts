export interface ImageSettings {
    invert: boolean;
    sharpen: number; // 0-20?
    blur: number; // 0 to 20
    contrast: number; // -100 to 100
    brightness: number; // -100 to 100
    gamma: number; // 0.1 to 3.0
    noiseReduction: number; // 0 to 10
    grayscale: boolean;
}

export interface ModelSettings {
    width: number; // mm
    height: number; // mm
    depth: number; // mm (Z-height)
    segmentation: number; // Detail level (resolution)
    baseHeight: number; // mm (thickness of base)
    smoothing: boolean;
    smoothingIterations: number; // 0 to 10
    frameWidth: number; // mm
    frameDepth: number; // mm
    curveAngle: number; // degrees
    showWireframe: boolean;
    materialColor: string;
    resolution: number; // Max width/height px
}

export interface GCodeSettings {
    toolDiameter: number; // mm
    feedRate: number; // mm/min
    plungeRate: number; // mm/min
    safeHeight: number; // mm (retract height)
    spindleSpeed: number; // RPM
    stepOver: number; // 0-1 (percentage)
    oversize: number; // mm (extra border)
    passDepth: number; // mm (max depth per pass) - optional advanced
}
