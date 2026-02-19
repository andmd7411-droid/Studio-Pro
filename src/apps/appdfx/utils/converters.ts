/**
 * Utility functions for exporting images to different formats
 */

import ImageTracer from 'imagetracerjs';
import makerjs from 'makerjs';

export const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Writes a proper 24-bit BMP file from canvas pixel data.
 * Supports both full-color (24-bit) and grayscale (8-bit) modes.
 */
export const exportToBMP = (
    canvas: HTMLCanvasElement,
    bmpMode: 'color' | 'grayscale' | 'highcontrast' = 'color',
    bmpDPI: number = 96
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    if (bmpMode === 'grayscale' || bmpMode === 'highcontrast') {
        // 8-bit grayscale BMP with 256-color palette
        const rowSize = Math.ceil(width / 4) * 4; // rows padded to 4 bytes
        const pixelDataSize = rowSize * height;
        const paletteSize = 256 * 4; // 256 RGBQUAD entries
        const headerSize = 54 + paletteSize;
        const fileSize = headerSize + pixelDataSize;
        const ppm = Math.round(bmpDPI * 39.3701); // pixels per meter

        const buffer = new ArrayBuffer(fileSize);
        const view = new DataView(buffer);

        // BMP File Header (14 bytes)
        view.setUint8(0, 0x42); view.setUint8(1, 0x4D); // 'BM'
        view.setUint32(2, fileSize, true);
        view.setUint32(6, 0, true); // reserved
        view.setUint32(10, headerSize, true); // pixel data offset

        // DIB Header - BITMAPINFOHEADER (40 bytes)
        view.setUint32(14, 40, true); // header size
        view.setInt32(18, width, true);
        view.setInt32(22, -height, true); // negative = top-down
        view.setUint16(26, 1, true); // color planes
        view.setUint16(28, 8, true); // bits per pixel (8-bit grayscale)
        view.setUint32(30, 0, true); // no compression
        view.setUint32(34, pixelDataSize, true);
        view.setUint32(38, ppm, true); // X pixels per meter
        view.setUint32(42, ppm, true); // Y pixels per meter
        view.setUint32(46, 256, true); // colors in table
        view.setUint32(50, 0, true); // important colors

        // Write 256-entry grayscale palette
        for (let i = 0; i < 256; i++) {
            const offset = 54 + i * 4;
            view.setUint8(offset, i);     // B
            view.setUint8(offset + 1, i); // G
            view.setUint8(offset + 2, i); // R
            view.setUint8(offset + 3, 0); // reserved
        }

        // Write pixel data
        const pixelStart = headerSize;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcIdx = (y * width + x) * 4;
                let gray = Math.round(0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]);
                if (bmpMode === 'highcontrast') {
                    gray = gray > 128 ? 255 : 0; // hard threshold for laser/CNC
                }
                view.setUint8(pixelStart + y * rowSize + x, gray);
            }
        }

        const blob = new Blob([buffer], { type: 'image/bmp' });
        downloadBlob(blob, 'converted_image.bmp');

    } else {
        // 24-bit color BMP
        const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4 bytes
        const pixelDataSize = rowSize * height;
        const fileSize = 54 + pixelDataSize;
        const ppm = Math.round(bmpDPI * 39.3701);

        const buffer = new ArrayBuffer(fileSize);
        const view = new DataView(buffer);

        // BMP File Header (14 bytes)
        view.setUint8(0, 0x42); view.setUint8(1, 0x4D); // 'BM'
        view.setUint32(2, fileSize, true);
        view.setUint32(6, 0, true);
        view.setUint32(10, 54, true); // pixel data offset

        // DIB Header - BITMAPINFOHEADER (40 bytes)
        view.setUint32(14, 40, true);
        view.setInt32(18, width, true);
        view.setInt32(22, -height, true); // negative = top-down
        view.setUint16(26, 1, true);
        view.setUint16(28, 24, true); // 24-bit color
        view.setUint32(30, 0, true);
        view.setUint32(34, pixelDataSize, true);
        view.setUint32(38, ppm, true);
        view.setUint32(42, ppm, true);
        view.setUint32(46, 0, true);
        view.setUint32(50, 0, true);

        // Write pixel data (BMP stores BGR, not RGB)
        const pixelStart = 54;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcIdx = (y * width + x) * 4;
                const dstIdx = pixelStart + y * rowSize + x * 3;
                view.setUint8(dstIdx, data[srcIdx + 2]);     // B
                view.setUint8(dstIdx + 1, data[srcIdx + 1]); // G
                view.setUint8(dstIdx + 2, data[srcIdx]);     // R
            }
        }

        const blob = new Blob([buffer], { type: 'image/bmp' });
        downloadBlob(blob, 'converted_image.bmp');
    }
};

// ImageTracer options for "Highest" quality
const getHighQualityOptions = (
    smoothness: number,
    pathomit: number = 0,
    strokeWidth: number = 1,
    blurRadius: number = 0,
    rightAngleEnhance: boolean = true,
    minColorRange: number = 0,
    scale: number = 1,
    roundCoords: number = 2,
    layering: number = 0,
    colorQuantCycles: number = 3,
    minColorRatio: number = 0,
    ltres: number = 1,
    qtres: number = 1
) => ({
    // Path precision - ULTRA QUALITY
    // We now use ltres and qtres from the state if provided, otherwise scale with smoothness
    ltres: ltres * 0.1,
    qtres: qtres * 0.1,
    pathomit: pathomit,
    rightangleenhance: rightAngleEnhance,

    // Preprocessing
    blurradius: blurRadius,
    blurdelta: blurRadius * 5,

    // Quality & filtering
    linefilter: true,
    colorsampling: 0,
    mincolorrange: minColorRange,

    // Color quantization
    colorquantcycles: colorQuantCycles,
    mincolorratio: minColorRatio,

    // SVG output
    strokewidth: strokeWidth,
    scale: scale,
    roundcoords: roundCoords,
    layering: layering,

    // Palette
    pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }]
});

export const previewSVG = (
    canvas: HTMLCanvasElement,
    smoothness: number,
    pathOptimization: number,
    strokeWidth: number,
    blurRadius: number = 0,
    rightAngleEnhance: boolean = true,
    minColorRange: number = 0,
    scale: number = 1,
    roundCoords: number = 2,
    layering: number = 0,
    colorQuantCycles: number = 3,
    minColorRatio: number = 0,
    ltres: number = 1,
    qtres: number = 1
): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('No canvas context found for preview');
        return '';
    }
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const options = getHighQualityOptions(
        smoothness,
        pathOptimization,
        strokeWidth,
        blurRadius,
        rightAngleEnhance,
        minColorRange,
        scale,
        roundCoords,
        layering,
        colorQuantCycles,
        minColorRatio,
        ltres,
        qtres
    );

    // @ts-ignore
    const engine = ImageTracer.imagedataToSVG ? ImageTracer : (ImageTracer.default || ImageTracer);

    try {
        let svg = engine.imagedataToSVG(imgData, options);

        // Force SVG to be responsive and fit container exactly
        const width = imgData.width;
        const height = imgData.height;
        svg = svg.replace(/width="[^"]+"/, 'width="100%"');
        svg = svg.replace(/height="[^"]+"/, 'height="100%"');
        svg = svg.replace(/<svg /, `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" `);

        return svg;
    } catch (err) {
        console.error('ImageTracer failed:', err);
        return '';
    }
};

export const exportToSVG = (
    canvas: HTMLCanvasElement,
    smoothness: number,
    pathOptimization: number,
    strokeWidth: number,
    blurRadius: number = 0,
    rightAngleEnhance: boolean = true,
    minColorRange: number = 0,
    scale: number = 1,
    roundCoords: number = 2,
    layering: number = 0,
    colorQuantCycles: number = 3,
    minColorRatio: number = 0,
    ltres: number = 1,
    qtres: number = 1
) => {
    const svgString = previewSVG(canvas, smoothness, pathOptimization, strokeWidth, blurRadius, rightAngleEnhance, minColorRange, scale, roundCoords, layering, colorQuantCycles, minColorRatio, ltres, qtres);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    downloadBlob(blob, 'converted_image.svg');
};

export const exportToDXF = (
    canvas: HTMLCanvasElement,
    smoothness: number,
    pathOptimization: number,
    strokeWidth: number,
    blurRadius: number = 0,
    rightAngleEnhance: boolean = true,
    minColorRange: number = 0,
    scale: number = 1,
    roundCoords: number = 2,
    layering: number = 0,
    colorQuantCycles: number = 3,
    minColorRatio: number = 0,
    ltres: number = 1,
    qtres: number = 1
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const options = {
        ...getHighQualityOptions(smoothness, pathOptimization, strokeWidth, blurRadius, rightAngleEnhance, minColorRange, scale, roundCoords, layering, colorQuantCycles, minColorRatio, ltres, qtres),
        strokewidth: strokeWidth,
    };

    // @ts-ignore
    const engine = ImageTracer.imagedataToSVG ? ImageTracer : (ImageTracer.default || ImageTracer);

    console.log(`Exporting DXF with high quality, smoothness: ${smoothness}`);
    const svgString = engine.imagedataToSVG(imgData, options);

    // 2. Convert SVG path to MakerJS model
    const model = makerjs.importer.fromSVGPathData(extractPathData(svgString));

    // 3. Export to DXF
    const dxf = makerjs.exporter.toDXF(model);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    downloadBlob(blob, 'converted_image.dxf');
};

// Helper to extract all path data from SVG string for MakerJS
function extractPathData(svgString: string): string {
    const matches = Array.from(svgString.matchAll(/d="([^"]+)"/g));
    return matches.map(m => m[1]).join(' ');
}
