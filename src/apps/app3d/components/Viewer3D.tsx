import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store/AppContext';
import { geometryGenerator } from '../core/geometryGenerator';

const Model = () => {
    const { heightmap, modelSettings, imageDimensions } = useAppStore();
    const meshRef = useRef<THREE.Mesh>(null);

    const geometry = useMemo(() => {
        if (!heightmap || imageDimensions.width === 0) return null;

        // Dispose old geometry if needed? React-three-fiber handles it usually.
        const geo = geometryGenerator.generateMesh(
            heightmap,
            imageDimensions.width,
            imageDimensions.height,
            modelSettings
        );
        geo.computeBoundingBox();

        return geo;
    }, [heightmap, imageDimensions, modelSettings]);

    if (!geometry) return null;

    return (
        <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial
                color={modelSettings.materialColor}
                roughness={0.4}
                metalness={0.1}
                side={THREE.DoubleSide}
                flatShading={!modelSettings.smoothing}
                wireframe={modelSettings.showWireframe}
            />
        </mesh>
    );
}

export const Viewer3D = () => {
    return (
        <div className="w-full h-full relative bg-dark">
            <Canvas shadows camera={{ position: [0, 50, 100], fov: 45 }}>
                <color attach="background" args={['#0f172a']} />

                <ambientLight intensity={0.4} />
                <directionalLight
                    position={[50, 50, 25]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />

                <Center>
                    <Model />
                </Center>

                <OrbitControls makeDefault minDistance={10} maxDistance={500} />
                <Environment preset="city" blur={0.5} />
            </Canvas>
        </div>
    );
};
