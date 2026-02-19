import type { ImageSettings } from '../types';

export const PROCESSOR_CONSTANTS = {
    MAX_WIDTH: 4096, // Limit processing resolution for performance
    MAX_HEIGHT: 4096,
};

export class ImageProcessor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.createElement('canvas');
        const context = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Could not get canvas context');
        this.ctx = context;
    }

    /**
     * Loads an image from a File object
     */
    public async loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };

            img.src = url;
        });
    }

    /**
     * Processes the image with the given settings and returns ImageData
     */
    public processImage(img: HTMLImageElement, settings: ImageSettings, maxResolution: number = 2048): ImageData {
        // Resize logic to keep performance up or match quality setting
        let { width, height } = img;

        if (width > maxResolution || height > maxResolution) {
            const ratio = Math.min(maxResolution / width, maxResolution / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }

        this.canvas.width = width;
        this.canvas.height = height;

        // Draw original image
        this.ctx.filter = 'none';
        this.ctx.drawImage(img, 0, 0, width, height);

        // Get pixel data
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Manual processing for better control than CSS filters
        this.applyFilters(data, settings, width, height);

        // Put back to canvas to apply blur if needed (easier with context filter)
        this.ctx.putImageData(imageData, 0, 0);

        if (settings.blur > 0) {
            this.ctx.filter = `blur(${settings.blur}px)`;
            this.ctx.drawImage(this.canvas, 0, 0);
            return this.ctx.getImageData(0, 0, width, height);
        }

        return imageData;
    }

    private applyFilters(data: Uint8ClampedArray, settings: ImageSettings, width: number, height: number) {
        const { invert, contrast, brightness, grayscale, sharpen, gamma, noiseReduction } = settings;

        // Contrast factor
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        // 1. Point operations (Brightness, Contrast, Invert, Grayscale, Gamma)
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            // a = data[i + 3]

            // Grayscale (Luminance)
            if (grayscale) {
                const avg = 0.299 * r + 0.587 * g + 0.114 * b;
                r = g = b = avg;
            }

            // Brightness
            r += brightness;
            g += brightness;
            b += brightness;

            // Contrast
            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;

            // Invert
            if (invert) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            // Gamma Correction
            if (gamma !== 1.0 && gamma > 0) {
                r = 255 * Math.pow(r / 255, 1 / gamma);
                g = 255 * Math.pow(g / 255, 1 / gamma);
                b = 255 * Math.pow(b / 255, 1 / gamma);
            }

            // Clamp
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        // 2. Noise Reduction (Median Filter) - if noiseReduction > 0
        if (noiseReduction > 0) {
            // Amount determines radius or strength?
            // Let's use it as radius/strength mix.
            // For simplicity/performance in JS, let's stick to 3x3 median.
            // If noiseReduction is high, maybe repeat it?

            const iterations = Math.ceil(noiseReduction / 3);

            for (let iter = 0; iter < iterations; iter++) {
                const copy = new Uint8ClampedArray(data);
                const w = width;
                const h = height;

                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const idx = (y * w + x) * 4;

                        // Collect 3x3 neighborhood for each channel
                        const rVals = [];
                        const gVals = [];
                        const bVals = [];

                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const nIdx = ((y + ky) * w + (x + kx)) * 4;
                                rVals.push(copy[nIdx]);
                                gVals.push(copy[nIdx + 1]);
                                bVals.push(copy[nIdx + 2]);
                            }
                        }

                        rVals.sort((a, b) => a - b);
                        gVals.sort((a, b) => a - b);
                        bVals.sort((a, b) => a - b);

                        data[idx] = rVals[4]; // Median
                        data[idx + 1] = gVals[4];
                        data[idx + 2] = bVals[4];
                    }
                }
            }
        }

        // 3. Convolution (Sharpen) - Only if sharpen > 0
        // We do this after point ops. It's expensive (O(N)).
        if (sharpen > 0) {
            // Simple sharpen kernel
            //  0 -1  0
            // -1  5 -1
            //  0 -1  0
            // adjusted by amount.

            // Amount 0-10. 
            // mix original with sharpened.

            const w = width;
            const h = height;
            const copy = new Uint8ClampedArray(data); // Need copy of source

            const amount = sharpen / 10.0; // 0 to 1 scaling roughly

            // Weights
            // Center = 1 + 4*amount
            // Neighbor = -amount

            const wCenter = 1 + 4 * amount;
            const wNeighbor = -amount;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;

                    // Skip edges for simplicity
                    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;

                    const idxTop = ((y - 1) * w + x) * 4;
                    const idxBottom = ((y + 1) * w + x) * 4;
                    const idxLeft = (y * w + (x - 1)) * 4;
                    const idxRight = (y * w + (x + 1)) * 4;

                    for (let c = 0; c < 3; c++) { // R, G, B
                        const val =
                            copy[idx + c] * wCenter +
                            (copy[idxTop + c] + copy[idxBottom + c] + copy[idxLeft + c] + copy[idxRight + c]) * wNeighbor;

                        data[idx + c] = Math.min(255, Math.max(0, val));
                    }
                }
            }
        }
    }

    /**
     * Generates a heightmap (array of Z values) from ImageData
     * Returns a Float32Array where values are 0-1 (normalized height)
     */
    public generateHeightmap(imageData: ImageData): Float32Array {
        const { width, height, data } = imageData;
        const heightmap = new Float32Array(width * height);

        for (let i = 0; i < heightmap.length; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const a = data[i * 4 + 3];

            // Calculate luminance
            // If transparent, height is 0? Or should we treat it as white/black?
            // Let's assume transparency means 0 height (base).
            if (a < 10) {
                heightmap[i] = 0;
                continue;
            }

            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            heightmap[i] = luminance / 255.0; // Normalize 0-1
        }

        return heightmap;
    }
}

export const imageProcessor = new ImageProcessor();
