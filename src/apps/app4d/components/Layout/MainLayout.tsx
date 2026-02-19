import React from 'react';
import { motion } from 'framer-motion';

interface MainLayoutProps {
    leftPanel: React.ReactNode;
    centerPanel: React.ReactNode;
    rightPanel: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ leftPanel, centerPanel, rightPanel }) => {
    return (
        <div className="flex h-full w-full bg-[#050505] text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10 pointer-events-none" />

            {/* Left Panel - Tools/Settings */}
            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-64 h-full z-10 p-2"
            >
                <div className="h-full w-full rounded-xl bg-glass border border-glassBorder backdrop-blur-md shadow-2xl overflow-y-auto flex flex-col">
                    {leftPanel}
                </div>
            </motion.aside>

            {/* Center Panel - 3D Viewer */}
            <main className="flex-1 h-full relative z-0">
                {centerPanel}
            </main>

            {/* Right Panel - Animation/Details */}
            <motion.aside
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                className="w-64 h-full z-10 p-2"
            >
                <div className="h-full w-full rounded-xl bg-glass border border-glassBorder backdrop-blur-md shadow-2xl overflow-y-auto flex flex-col">
                    {rightPanel}
                </div>
            </motion.aside>
        </div>
    );
};

export default MainLayout;
