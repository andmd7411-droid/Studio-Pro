import * as THREE from 'three';
import type { ModelSettings } from '../types';

export class GeometryGenerator {

    public generateMesh(
        heightmap: Float32Array,
        widthPx: number,
        heightPx: number,
        settings: ModelSettings
    ): THREE.BufferGeometry {

        const {
            width, height, depth, baseHeight,
            frameWidth, frameDepth, curveAngle
        } = settings;

        // 1. Calculate dimensions
        // The "Image" area is width x height.
        // The "Frame" adds to this.
        const totalWidth = width + (frameWidth * 2);
        const totalHeight = height + (frameWidth * 2);

        // We need resolution for the frame too.
        // Let's deduce pixels per mm from the image area?
        // px/mm = widthPx / width
        const pxPerMmX = widthPx / width;
        const pxPerMmY = heightPx / height;

        // Frame segments
        const frameSegsX = Math.round(frameWidth * pxPerMmX) || 1;
        const frameSegsY = Math.round(frameWidth * pxPerMmY) || 1;

        // Total segments
        // Top/Bottom frame + Image
        const totalSegsX = widthPx + (frameSegsX * 2);
        const totalSegsY = heightPx + (frameSegsY * 2);

        // --- SMOOTHING ---
        let finalHeightmap = heightmap;
        if (settings.smoothing && settings.smoothingIterations > 0) {
            finalHeightmap = new Float32Array(heightmap); // Copy
            const w = widthPx;
            const h = heightPx;

            for (let iter = 0; iter < settings.smoothingIterations; iter++) {
                const source = new Float32Array(finalHeightmap); // Snapshot of previous pass

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        let sum = 0;
                        let count = 0;

                        // 3x3 Box Blur
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                const nx = x + kx;
                                const ny = y + ky;

                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    sum += source[ny * w + nx];
                                    count++;
                                }
                            }
                        }

                        finalHeightmap[y * w + x] = sum / count;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];

        // --- VERTICES ---
        // We generate a flat grid first, then curve it if needed.

        // Center point for flat plane
        const xOffset = -totalWidth / 2;
        const yOffset = -totalHeight / 2;

        const dx = totalWidth / totalSegsX;
        const dy = totalHeight / totalSegsY;

        // Curvature calculation
        const isCurved = curveAngle > 0;
        const thetaTotal = (curveAngle * Math.PI) / 180;
        // Radius R = ArcLength / Theta
        // ArcLength is totalWidth
        const radius = isCurved ? totalWidth / thetaTotal : 0;

        // Generate Top and Bottom Surface
        // We need both because we are making a solid.

        // Arrays to store vertex indices for faces
        // topGrid[y][x] = index
        const topGrid: number[] = new Array((totalSegsY + 1) * (totalSegsX + 1));
        const botGrid: number[] = new Array((totalSegsY + 1) * (totalSegsX + 1));

        let vIndex = 0;

        for (let y = 0; y <= totalSegsY; y++) {
            for (let x = 0; x <= totalSegsX; x++) {
                // Flat coords
                const xFlat = xOffset + (x * dx);
                const yFlat = yOffset + (totalSegsY - y) * dy; // Flip Y

                // Calculate Heights

                // Note: getReliefZ uses cell coords (0..totalSegs-1), vertex coords are (0..totalSegs).
                // We should sample somewhat carefully or just nearest.
                // Actually, for vertex (x,y), we should probably blend or just pick. 
                // Let's pick the cell (x,y) but clamp max.

                // Better: Vertices are corners. 
                // If we are in frame, height is known.
                // If in image, sample image. 
                // Ideally we interpolate image filter. But 'nearest' is okay for now.
                // Correction: grid points x=0..totalSegsX. 
                // Image samples 0..widthPx. x corresponds to frameSegsX ... frameSegsX+widthPx

                let zVal = baseHeight + frameDepth; // Default frame

                const imgX = x - frameSegsX;
                const imgY = y - frameSegsY;

                if (imgX >= 0 && imgX <= widthPx && imgY >= 0 && imgY <= heightPx) {
                    // Inside image area (or edge)
                    // Boundary check
                    const sx = Math.min(imgX, widthPx - 1);
                    const sy = Math.min(imgY, heightPx - 1);
                    const val = finalHeightmap[sy * widthPx + sx];

                    // If it's strictly inside, use val.
                    // If it's on the border of image/frame, what do we do?
                    // Logic: Image area z is base + val*depth.
                    // Frame area z is base + frameDepth.
                    // We want a sharp transition or smooth? Sharp is expected for frames.
                    // But vertices are shared.

                    // Simple logic: If inside image bounds, use image height.
                    // If on explicit frame area, use frame height.

                    // Let's treat the transition carefully.
                    // If x is exactly frameSegsX, it's the edge.
                    if (frameWidth > 0 && (imgX < 0 || imgX > widthPx || imgY < 0 || imgY > heightPx)) {
                        // Should be covered by outer if, but for safety
                        zVal = baseHeight + frameDepth;
                    } else {
                        zVal = baseHeight + (val * depth);
                    }
                } else {
                    // Frame
                    zVal = baseHeight + frameDepth;
                }

                // Apply Curvature
                let px, py, pz, bx, by, bz;

                if (isCurved) {
                    // Wrap around Y axis
                    // xFlat maps to angle
                    // center xFlat=0 -> angle=0
                    // range -totalWidth/2 .. +totalWidth/2

                    const angle = (xFlat / totalWidth) * thetaTotal;

                    // Radius differs for Top and Bottom to keep thickness?
                    // Visual thickness = zVal.
                    // So radius_top = radius + zVal
                    // radius_bot = radius (or radius + 0)

                    // Standard lithophane curve: "Cylinder" is the base.
                    // Relief sticks out.

                    const rTop = radius + zVal;
                    const rBot = radius; // Base level 0

                    // Z is forward (towards viewer). 
                    // In 3D: x = r sin(theta), z = r cos(theta)

                    px = rTop * Math.sin(angle);
                    py = yFlat;
                    pz = rTop * Math.cos(angle);

                    // Center curve? 
                    // z will be around radius. We might want to offset it back by radius so center is at 0,0,0
                    pz -= radius;

                    bx = rBot * Math.sin(angle);
                    by = yFlat;
                    bz = rBot * Math.cos(angle);
                    bz -= radius;

                } else {
                    px = xFlat;
                    py = yFlat;
                    pz = zVal;

                    bx = xFlat;
                    by = yFlat;
                    bz = 0;
                }

                // Push Top Vertex
                vertices.push(px, py, pz);
                topGrid[y * (totalSegsX + 1) + x] = vIndex++;

                // Push Bottom Vertex
                vertices.push(bx, by, bz);
                botGrid[y * (totalSegsX + 1) + x] = vIndex++;
            }
        }

        // --- FACES ---
        // Generate quads/tris
        for (let y = 0; y < totalSegsY; y++) {
            for (let x = 0; x < totalSegsX; x++) {
                const width1 = totalSegsX + 1;

                // Top Surface
                const t1 = topGrid[y * width1 + x];
                const t2 = topGrid[y * width1 + (x + 1)];
                const t3 = topGrid[(y + 1) * width1 + x];
                const t4 = topGrid[(y + 1) * width1 + (x + 1)];

                // t3 - t4
                // |  / |
                // t1 - t2

                indices.push(t1, t2, t4);
                indices.push(t1, t4, t3);

                // Bottom Surface (reverse winding)
                const b1 = botGrid[y * width1 + x];
                const b2 = botGrid[y * width1 + (x + 1)];
                const b3 = botGrid[(y + 1) * width1 + x];
                const b4 = botGrid[(y + 1) * width1 + (x + 1)];

                indices.push(b1, b4, b2);
                indices.push(b1, b3, b4);

                // Sides
                // Left (x=0)
                if (x === 0) {
                    indices.push(b1, t1, t3); // b1-t1-t3
                    indices.push(b1, t3, b3);
                }

                // Right (x=totalSegsX-1) next loop
                // Careful, we iterate segments.
                // Right edge of this segment is x+1
                if (x === totalSegsX - 1) {
                    indices.push(b2, t4, t2); // b2-t4-t2
                    indices.push(b2, b4, t4);
                }

                // Top Edge (y=0)
                if (y === 0) {
                    // b1, b2, t1, t2
                    indices.push(b1, t2, t1);
                    indices.push(b1, b2, t2);
                }

                // Bottom Edge (y=totalSegsY-1)
                if (y === totalSegsY - 1) {
                    // b3, b4, t3, t4
                    indices.push(b3, t3, t4);
                    indices.push(b3, t4, b4);
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }
}

export const geometryGenerator = new GeometryGenerator();
