import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, Sparkles } from 'lucide-react';

// ─── App 3D ───
import { AppProvider as App3DProvider } from './apps/app3d/store/AppContext';
import { MainLayout as MainLayout3D } from './apps/app3d/layout/MainLayout';

// ─── App 4D ───
import Layout4D from './apps/app4d/components/Layout/MainLayout';
import AnimeScene from './apps/app4d/components/Viewer/AnimeScene';
import ToolsLeft4D from './apps/app4d/components/Tools/LeftPanel';
import ToolsRight4D from './apps/app4d/components/Tools/RightPanel';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';

// ─── App DFX ───
import AppDFX from './apps/appdfx/App';

// ─── App Multi ───
import AppMulti from './apps/appmulti/App';

// ─── Types ───
type Tab = '3d' | '4d' | 'dfx' | 'multi' | null;
type Lang = 'en' | 'fr';

// ─── i18n ───
const i18n = {
    en: {
        welcomePrefix: 'Welcome to',
        appName: 'Studio Pro',
        subtitle: 'The ultimate creative suite for professionals.',
        selectTool: 'Select a Workspace',
        back: 'Back to Home',
        tabs: {
            '3d': { label: '3D Lithophane', desc: 'Convert photos to 3D models for printing.' },
            '4d': { label: '4D Anime', desc: 'Transform images into animated 3D scenes.' },
            'dfx': { label: 'Vector / Laser', desc: 'High-precision SVG, DXF & BMP tools.' },
            'multi': { label: 'Universal Converter', desc: 'Process images, audio, video & docs.' },
        },
    },
    fr: {
        welcomePrefix: 'Bienvenue sur',
        appName: 'Studio Pro',
        subtitle: 'La suite créative ultime pour les professionnels.',
        selectTool: 'Sélectionnez un Espace',
        back: 'Retour à l\'accueil',
        tabs: {
            '3d': { label: 'Lithophane 3D', desc: 'Convertissez des photos en modèles 3D.' },
            '4d': { label: 'Anime 4D', desc: 'Transformez des images en scènes 3D animées.' },
            'dfx': { label: 'Vecteur / Laser', desc: 'Outils SVG, DXF et BMP haute précision.' },
            'multi': { label: 'Convertisseur Universel', desc: 'Traitez images, audio, vidéo et docs.' },
        },
    },
};

// ─── Visual Config ───
const compartments = [
    {
        id: '3d' as const,
        emoji: '🧊',
        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)', // Sky to Blue
        accent: '#38bdf8',
        shadow: 'rgba(14, 165, 233, 0.4)',
    },
    {
        id: '4d' as const,
        emoji: '✨',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // Violet to Fuchsia
        accent: '#a78bfa',
        shadow: 'rgba(139, 92, 246, 0.4)',
    },
    {
        id: 'dfx' as const,
        emoji: '⚡',
        gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', // Emerald to Teal
        accent: '#34d399',
        shadow: 'rgba(16, 185, 129, 0.4)',
    },
    {
        id: 'multi' as const,
        emoji: '🔄',
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // Indigo to Violet
        accent: '#818cf8',
        shadow: 'rgba(99, 102, 241, 0.4)',
    },
];

// ─── Background Animation ───
const AnimatedBackground: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#050511]">
        {/* Deep nebulas */}
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-indigo-900/10 blur-[100px]" />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute rounded-full bg-white mixed-blend-overlay"
                initial={{
                    x: Math.random() * 100 + 'vw',
                    y: Math.random() * 100 + 'vh',
                    scale: Math.random() * 0.5 + 0.5,
                    opacity: Math.random() * 0.3 + 0.1
                }}
                animate={{
                    y: [null, Math.random() * 100 + 'vh'],
                    x: [null, Math.random() * 100 + 'vw']
                }}
                transition={{
                    duration: Math.random() * 20 + 20,
                    repeat: Infinity,
                    ease: "linear",
                    repeatType: "reverse"
                }}
                style={{
                    width: Math.random() * 300 + 50 + 'px',
                    height: Math.random() * 300 + 50 + 'px',
                    filter: 'blur(60px)',
                    background: i % 2 === 0 ? 'rgba(56,189,248,0.08)' : 'rgba(167,139,250,0.08)'
                }}
            />
        ))}

        {/* Grid overlay for tech feel */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
    </div>
);

// ─── App4D Wrapper ───
const App4DWrapper: React.FC = () => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [animation, setAnimation] = useState<string>('idle');
    const [adjustments, setAdjustments] = useState({
        scale: 1,
        rotation: 0,
        metalness: 0,
        roughness: 1,
        displacementScale: 0.05,
        color: '#ffffff',
        wireframe: false,
        emissiveIntensity: 0.1,
        opacity: 1,
        alphaTest: 0.5,
        shape: 'plane'
    });
    const exportRef = useRef<THREE.Group | null>(null);

    const handleUpload = (file: File) => {
        const url = URL.createObjectURL(file);
        setUploadedImage(url);
    };

    const handleExport = () => {
        if (!exportRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(
            exportRef.current,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'model.glb';
                link.click();
            },
            (_err: ErrorEvent) => console.error('GLB Export error'),
            { binary: true }
        );
    };

    const handleStyleSelect = (style: 'anime' | 'cyber') => {
        if (style === 'anime') {
            setAdjustments(p => ({
                ...p,
                metalness: 0, roughness: 1, displacementScale: 0.05,
                color: '#ffffff', wireframe: false, emissiveIntensity: 0.1, opacity: 1
            }));
        } else {
            setAdjustments(p => ({
                ...p,
                metalness: 0.9, roughness: 0.2, displacementScale: 0.4,
                color: '#b3e0ff', wireframe: false, emissiveIntensity: 1.5, opacity: 0.9
            }));
        }
    };

    return (
        <Layout4D
            leftPanel={<ToolsLeft4D onUpload={handleUpload} adjustments={adjustments} onAdjustmentChange={setAdjustments} />}
            centerPanel={<AnimeScene textureUrl={uploadedImage} currentAnimation={animation} adjustments={adjustments} exportRef={exportRef} />}
            rightPanel={<ToolsRight4D onAnimate={setAnimation} onExport={handleExport} onStyleSelect={handleStyleSelect} />}
        />
    );
};

// ─── Main App Component ───
const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>(null);
    const [lang, setLang] = useState<Lang>('en');
    const [isHovering, setIsHovering] = useState<string | null>(null);

    const t = i18n[lang];
    const activeComp = compartments.find(c => c.id === activeTab);

    // Welcome title letters for stagger animation
    const titleLetters = t.appName.split('');

    return (
        <div className="min-h-screen text-white font-sans selection:bg-indigo-500/30">
            <AnimatedBackground />

            {/* ── Top Navigation Bar (Always Visible) ── */}
            <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
                <AnimatePresence mode="wait">
                    {activeTab ? (
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onClick={() => setActiveTab(null)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all group"
                        >
                            <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                            <span className="text-sm font-medium text-gray-300 group-hover:text-white">{t.back}</span>
                        </motion.button>
                    ) : (
                        <div className="w-10" /> // Spacer
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                    {(['en', 'fr'] as Lang[]).map((l) => (
                        <button
                            key={l}
                            onClick={() => setLang(l)}
                            className={`
                                px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider
                                transition-all duration-300
                                ${lang === l ? 'bg-indigo-500/30 text-indigo-300' : 'text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </nav>

            {/* ── Main Content Area ── */}
            <main className="relative z-10 w-full h-screen overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                    {activeTab === null ? (
                        // ─── Welcome Screen ───
                        <motion.div
                            key="welcome"
                            className="flex-1 flex flex-col items-center justify-center p-6 mt-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            transition={{ duration: 0.5 }}
                        >
                            {/* Hero Section */}
                            <div className="text-center mb-16 relative">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex items-center justify-center gap-2 mb-4"
                                >
                                    <Sparkles className="w-5 h-5 text-indigo-400" />
                                    <span className="text-indigo-400/80 uppercase tracking-[0.3em] text-xs font-bold">
                                        {t.welcomePrefix}
                                    </span>
                                </motion.div>

                                <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6">
                                    <span className="inline-block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
                                        {t.appName}
                                    </span>
                                </h1>

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="text-lg text-gray-400 max-w-lg mx-auto leading-relaxed"
                                >
                                    {t.subtitle}
                                </motion.p>
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl px-4">
                                {compartments.map((comp, i) => {
                                    const info = t.tabs[comp.id];
                                    const isHovered = isHovering === comp.id;

                                    return (
                                        <motion.div
                                            key={comp.id}
                                            initial={{ opacity: 0, y: 50 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.8 + i * 0.1, type: "spring", stiffness: 100 }}
                                            onMouseEnter={() => setIsHovering(comp.id)}
                                            onMouseLeave={() => setIsHovering(null)}
                                            onClick={() => setActiveTab(comp.id)}
                                            className="group relative cursor-pointer"
                                        >
                                            <div
                                                className={`
                                                    relative h-full p-8 rounded-3xl border border-white/5 
                                                    bg-[#12122a]/40 backdrop-blur-xl 
                                                    transition-all duration-500 ease-out
                                                    ${isHovered ? 'scale-105 -translate-y-2 shadow-2xl border-white/10' : 'hover:bg-[#12122a]/60'}
                                                `}
                                                style={{
                                                    boxShadow: isHovered ? `0 20px 40px -10px ${comp.shadow}` : 'none'
                                                }}
                                            >
                                                {/* Card Header (Title Above) */}
                                                <div className="mb-6 flex flex-col items-center">
                                                    <span className={`
                                                        text-xs font-bold uppercase tracking-widest mb-2 transition-colors duration-300
                                                        ${isHovered ? 'text-white' : 'text-gray-500'}
                                                    `}>
                                                        0{i + 1}
                                                    </span>
                                                    <h3 className="text-xl font-bold text-center text-white/90 group-hover:text-white transition-colors">
                                                        {info.label}
                                                    </h3>
                                                </div>

                                                {/* Icon Container */}
                                                <div
                                                    className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl shadow-inner transition-transform duration-500"
                                                    style={{
                                                        background: comp.gradient,
                                                        transform: isHovered ? 'rotate(10deg) scale(1.1)' : 'rotate(0deg)'
                                                    }}
                                                >
                                                    {comp.emoji}
                                                </div>

                                                {/* Description */}
                                                <p className="text-sm text-center text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                                                    {info.desc}
                                                </p>

                                                {/* Action Hint */}
                                                <div className={`
                                                    absolute bottom-6 left-0 right-0 text-center text-xs font-bold uppercase tracking-wider
                                                    transition-all duration-300
                                                    ${isHovered ? 'opacity-100 translate-y-0 text-white' : 'opacity-0 translate-y-2 text-gray-500'}
                                                `}>
                                                    Click to Open
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ) : (
                        // ─── Active Application Module ───
                        <motion.div
                            key="active-app"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.4 }}
                            className="w-full h-full"
                        >
                            {/* Header for Active Module (optional context) */}
                            {activeComp && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-50 mix-blend-plus-lighter">
                                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                                        {t.tabs[activeTab].label}
                                    </h2>
                                </div>
                            )}

                            {activeTab === '3d' && <App3DProvider><MainLayout3D /></App3DProvider>}
                            {activeTab === '4d' && <App4DWrapper />}
                            {activeTab === 'dfx' && <AppDFX />}
                            {activeTab === 'multi' && <AppMulti />}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default App;
