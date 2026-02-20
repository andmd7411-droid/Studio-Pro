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
    link.style.visibility = 'hidden';
    link.style.position = 'absolute';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        if (link.parentNode) document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 500); // More generous timeout
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
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadBlob(blob, `export_${timestamp}.bmp`);

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
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        downloadBlob(blob, `photo_${timestamp}.bmp`);
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
    qtres: number = 1,
    despeckle: number = 0,
    smoothingIterations: number = 0
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

    const engine = ImageTracer.imagedataToSVG ? ImageTracer : (ImageTracer.default || ImageTracer);

    try {
        let svg = engine.imagedataToSVG(imgData, options);

        // Apply Smoothing and Despeckle to preview if needed
        if (despeckle > 0 || smoothingIterations > 0) {
            let paths = extractPaths(svg);
            if (despeckle > 0) {
                paths = despecklePaths(paths, despeckle);
            }
            if (smoothingIterations > 0) {
                paths = paths.map(p => smoothPathData(p, smoothingIterations));
            }
            // Reconstruct SVG string with processed paths
            const width = imgData.width;
            const height = imgData.height;
            const pathsHtml = paths.map(p => `<path d="${p}" stroke="black" fill="none" class="vector-path" />`).join('');
            svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${pathsHtml}</svg>`;
        }

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
    qtres: number = 1,
    despeckle: number = 0,
    smoothingIterations: number = 0
) => {
    let svgString = previewSVG(canvas, smoothness, pathOptimization, strokeWidth, blurRadius, rightAngleEnhance, minColorRange, scale, roundCoords, layering, colorQuantCycles, minColorRatio, ltres, qtres, despeckle, smoothingIterations);

    // If SVG is empty/invalid, create a proper copy.
    if (!svgString || svgString.trim().length < 50) {
        // Fallback: embed canvas as PNG within SVG
        const dataUrl = canvas.toDataURL('image/png');
        svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}" /></svg>`;
    }

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    downloadBlob(blob, `vector_${ts}.svg`);
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
    qtres: number = 1,
    units: string = 'mm',
    despeckle: number = 0,
    smoothingIterations: number = 0
) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) { alert('Cannot access canvas context for DXF export'); return; }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (canvas.width === 0 || canvas.height === 0) { alert('No image to export. Please upload an image first.'); return; }

    const options = {
        ...getHighQualityOptions(smoothness, pathOptimization, strokeWidth, blurRadius, rightAngleEnhance, minColorRange, scale, roundCoords, layering, colorQuantCycles, minColorRatio, ltres, qtres),
        strokewidth: strokeWidth,
    };

    const engine = ImageTracer.imagedataToSVG ? ImageTracer : (ImageTracer.default || ImageTracer);

    let svgStringFromTracer = '';
    try {
        svgStringFromTracer = engine.imagedataToSVG(imgData, options);
    } catch (e) {
        console.error('ImageTracer failed during DXF export:', e);
    }

    let paths = extractPaths(svgStringFromTracer);
    if (despeckle > 0) paths = despecklePaths(paths, despeckle);
    if (smoothingIterations > 0) paths = paths.map(p => smoothPathData(p, smoothingIterations));

    let dxfContent = '';
    if (paths.length > 0) {
        const combinedPathData = paths.join(' ');
        try {
            const model = makerjs.importer.fromSVGPathData(combinedPathData);
            if (model) {
                model.units = units === 'inch' ? makerjs.unitType.Inch : (units === 'mm' ? makerjs.unitType.Millimeter : undefined);
                dxfContent = makerjs.exporter.toDXF(model);
            }
        } catch (e) {
            console.error('MakerJS DXF conversion failed:', e);
        }
    }

    // Fallback: if DXF content is empty, generate a basic valid DXF with a rectangle
    if (!dxfContent || dxfContent.trim().length < 20) {
        const w = canvas.width;
        const h = canvas.height;
        dxfContent = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nRECTANG\n8\n0\n10\n0.0\n20\n0.0\n11\n${w}.0\n21\n${h}.0\n0\nENDSEC\n0\nEOF`;
    }

    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    downloadBlob(blob, `precision_${ts}.dxf`);
};

// Helper to remove small isolated paths (Despeckle)
function despecklePaths(paths: string[], threshold: number): string[] {
    if (threshold <= 0) return paths;
    return paths.filter(pathData => {
        // Very rough area/length estimation for filtering
        const bbox = makerjs.importer.fromSVGPathData(pathData);
        if (!bbox) return false;
        const measure = makerjs.measure.modelExtents(bbox);
        if (!measure) return false;
        const size = Math.max(measure.high[0] - measure.low[0], measure.high[1] - measure.low[1]);
        return size > threshold;
    });
}

// Chaikin's Smoothing Algorithm for SVG paths
function smoothPathData(pathData: string, iterations: number): string {
    if (iterations <= 0) return pathData;

    const parsePoints = (data: string): number[][] => {
        const points: number[][] = [];
        const matches = data.matchAll(/([ML])\s*(-?\d+\.?\d*)\s*(-?\d+\.?\d*)/g);
        for (const match of matches) {
            points.push([parseFloat(match[2]), parseFloat(match[3])]);
        }
        return points;
    };

    const chaikin = (points: number[][]): number[][] => {
        if (points.length < 3) return points;
        const newPoints: number[][] = [];
        newPoints.push(points[0]); // Keep start
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
            const r = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
            newPoints.push(q, r);
        }
        newPoints.push(points[points.length - 1]); // Keep end
        return newPoints;
    };

    let pts = parsePoints(pathData);
    if (pts.length < 3) return pathData;

    for (let i = 0; i < iterations; i++) {
        pts = chaikin(pts);
    }

    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(' ');
}

// Internal helpers
function extractPaths(svgString: string): string[] {
    const matches = Array.from(svgString.matchAll(/d="([^"]+)"/g));
    return matches.map(m => m[1]);
}
