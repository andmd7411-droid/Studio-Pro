import React, { useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid, ContactShadows, Html, useProgress } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

interface AnimeSceneProps {
    textureUrl: string | null;
    currentAnimation: string;
    adjustments: { scale: number; rotation: number; color: string; displacementScale: number; metalness: number; roughness: number; wireframe: boolean; alphaTest: number; emissiveIntensity: number; opacity: number; shape: string };
    exportRef: React.RefObject<THREE.Group | null>;
}

function Loader() {
    const { progress } = useProgress()
    return <Html center><div className="text-white text-xl font-bold">{progress.toFixed(0)}% loaded</div></Html>
}

const PlaceholderModel: React.FC<{
    textureUrl: string | null;
    animation: string;
    adjustments: { scale: number; rotation: number; color: string; displacementScale: number; metalness: number; roughness: number; wireframe: boolean; alphaTest: number; emissiveIntensity: number; opacity: number; shape: string }
}> = ({ textureUrl, animation, adjustments }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const textureRaw = useLoader(THREE.TextureLoader, textureUrl || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3');

    // Clone and configure texture to avoid modifying hook return value directly
    const texture = React.useMemo(() => {
        const t = textureRaw.clone();
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }, [textureRaw]);

    useFrame((state) => {
        if (meshRef.current) {
            const baseRotation = adjustments.rotation * (Math.PI / 180);

            if (animation === 'idle') {
                meshRef.current.rotation.y = baseRotation + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
                meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1 + 1;
            }
            else if (animation === 'dance') {
                meshRef.current.rotation.y = baseRotation + Math.sin(state.clock.elapsedTime * 2) * 0.2;
                meshRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.3 + 0.8;
                meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1;
            }
            else if (animation === 'wave') {
                meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 6) * 0.1;
                meshRef.current.position.y = 1;
                meshRef.current.rotation.y = baseRotation;
            } else {
                meshRef.current.rotation.y = baseRotation;
                meshRef.current.position.y = 1;
            }
        }
    });

    const materialProps = {
        map: texture,
        transparent: true,
        opacity: adjustments.opacity,
        alphaTest: adjustments.alphaTest,
        side: THREE.DoubleSide,
        displacementMap: texture,
        displacementScale: adjustments.displacementScale,
        color: adjustments.color,
        emissive: adjustments.color,
        emissiveIntensity: adjustments.emissiveIntensity,
        roughness: adjustments.roughness,
        metalness: adjustments.metalness,
        wireframe: adjustments.wireframe,
    };

    const getGeometry = () => {
        switch (adjustments.shape) {
            case 'box':
                return <boxGeometry args={[1.5, 1.5, 1.5, 64, 64, 64]} />;
            case 'sphere':
                return <sphereGeometry args={[1, 64, 64]} />;
            case 'cylinder':
                return <cylinderGeometry args={[1, 1, 2, 64, 64]} />;
            case 'plane':
            default:
                return <planeGeometry args={[2, 2, 64, 64]} />;
        }
    };

    return (
        <mesh
            ref={meshRef}
            position={[0, 0, 0]}
            scale={[adjustments.scale, adjustments.scale, adjustments.scale]}
        >
            {getGeometry()}
            <meshStandardMaterial {...materialProps} />
        </mesh>
    );
};

const AnimeScene: React.FC<AnimeSceneProps> = ({ textureUrl, currentAnimation, adjustments, exportRef }) => {
    return (
        <div className="w-full h-full bg-[#0a0a0e] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none z-10" />

            <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
                <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={50} />
                <OrbitControls
                    enablePan={false}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 1.8}
                    minDistance={2}
                    maxDistance={8}
                />

                <Environment preset="city" />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <pointLight position={[-10, 10, -10]} intensity={0.5} color="#00f3ff" />

                <group position={[0, -1, 0]}>
                    <group ref={exportRef}> {/* Isolate model for export */}
                        <React.Suspense fallback={<Loader />}>
                            <PlaceholderModel textureUrl={textureUrl} animation={currentAnimation} adjustments={adjustments} />
                        </React.Suspense>
                    </group>

                    <Grid
                        infiniteGrid
                        fadeDistance={30}
                        sectionColor="#4a4a4a"
                        cellColor="#2a2a2a"
                        position={[0, -0.01, 0]}
                    />
                    <ContactShadows resolution={512} scale={10} blur={2} opacity={0.5} far={1} color="#000000" />
                </group>

                <EffectComposer>
                    <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.2} radius={0.4} />
                </EffectComposer>
            </Canvas>
        </div>
    );
};

export default AnimeScene;
