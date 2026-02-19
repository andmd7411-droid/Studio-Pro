import * as THREE from 'three';

export class STLExporter {

    public parse(geometry: THREE.BufferGeometry): ArrayBuffer {
        const normal = new THREE.Vector3();

        // Non-indexed geometry is easier
        let tempGeo = geometry.clone();
        if (tempGeo.index) {
            tempGeo = tempGeo.toNonIndexed();
        }

        const positions = tempGeo.attributes.position;
        const count = positions.count; // Number of vertices
        const triangleCount = count / 3;

        // Binary STL Header: 80 bytes (header) + 4 bytes (tri count) + 50 bytes per triangle
        const bufferLength = 84 + (triangleCount * 50);
        const buffer = new ArrayBuffer(bufferLength);
        const view = new DataView(buffer);

        // Header (empty)

        // Number of triangles
        view.setUint32(80, triangleCount, true); // Little-endian

        let offset = 84;

        for (let i = 0; i < count; i += 3) {
            // Get vertices
            const vA = new THREE.Vector3().fromBufferAttribute(positions, i);
            const vB = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
            const vC = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

            // Calculate normal
            const cb = new THREE.Vector3().subVectors(vC, vB);
            const ab = new THREE.Vector3().subVectors(vA, vB);
            cb.cross(ab).normalize();

            normal.copy(cb);

            // Write Normal (3 floats)
            view.setFloat32(offset, normal.x, true); offset += 4;
            view.setFloat32(offset, normal.y, true); offset += 4;
            view.setFloat32(offset, normal.z, true); offset += 4;

            // Write Vertex 1
            view.setFloat32(offset, vA.x, true); offset += 4;
            view.setFloat32(offset, vA.y, true); offset += 4;
            view.setFloat32(offset, vA.z, true); offset += 4;

            // Write Vertex 2
            view.setFloat32(offset, vB.x, true); offset += 4;
            view.setFloat32(offset, vB.y, true); offset += 4;
            view.setFloat32(offset, vB.z, true); offset += 4;

            // Write Vertex 3
            view.setFloat32(offset, vC.x, true); offset += 4;
            view.setFloat32(offset, vC.y, true); offset += 4;
            view.setFloat32(offset, vC.z, true); offset += 4;

            // Attribute byte count (2 bytes)
            view.setUint16(offset, 0, true); offset += 2;
        }

        return buffer;
    }
}

export const stlExporter = new STLExporter();
