import React, { useState } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  Archive,
  Zap,
  Settings,
  Github,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Converter from './components/Converter';
import type { FileFormat } from './types';

type Category = 'image' | 'document' | 'audio' | 'video' | 'archive' | 'dashboard';

const App: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('dashboard');

  const categories = [
    {
      id: 'image',
      name: 'Images',
      icon: <ImageIcon size={24} />,
      description: 'JPG, PNG, WEBP, BMP, ICO',
      color: 'from-blue-500 to-cyan-500',
      formats: ['JPG', 'PNG', 'WEBP', 'BMP', 'ICO'] as FileFormat[]
    },
    {
      id: 'document',
      name: 'Documents',
      icon: <FileText size={24} />,
      description: 'PDF, TXT, MD, HTML',
      color: 'from-emerald-500 to-teal-500',
      formats: ['PDF', 'TXT', 'MD', 'HTML'] as FileFormat[]
    },
    {
      id: 'audio',
      name: 'Audio',
      icon: <Music size={24} />,
      description: 'MP3, WAV, OGG, AAC',
      color: 'from-purple-500 to-pink-500',
      formats: ['MP3', 'WAV', 'OGG', 'AAC', 'FLAC'] as FileFormat[]
    },
    {
      id: 'video',
      name: 'Video',
      icon: <Video size={24} />,
      description: 'MP4, WEBM, GIF, AVI, MOV',
      color: 'from-orange-500 to-red-500',
      formats: ['MP4', 'WEBM', 'GIF', 'AVI', 'MOV'] as FileFormat[]
    },
    {
      id: 'archive',
      name: 'Archives',
      icon: <Archive size={24} />,
      description: 'ZIP Compression',
      color: 'from-indigo-500 to-blue-500',
      formats: ['ZIP'] as FileFormat[]
    },
  ];

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Main Content */}
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeCategory === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div className="md:col-span-2 lg:col-span-3 p-8 glass-card bg-gradient-to-br from-indigo-900/40 via-slate-900/40 to-black/40 border-indigo-500/20">
                <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Multi-Format Converter <br /><span className="gradient-text">All formats. Local. Fast.</span></h2>
                <p className="text-text-secondary text-lg max-w-2xl mb-6 leading-relaxed">
                  No server uploads — your files never leave your machine. Images, Documents, Audio, Video, Archives.
                </p>
                <div className="flex gap-4">
                  <button className="btn-primary py-3 px-8 text-lg" onClick={() => setActiveCategory('image')}>
                    Get Started
                  </button>
                </div>
              </div>

              {categories.map((cat, idx) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02, translateY: -5 }}
                  onClick={() => setActiveCategory(cat.id as Category)}
                  className="glass-card p-6 cursor-pointer group relative overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${cat.color} opacity-5 blur-3xl group-hover:opacity-15 transition-opacity`} />
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${cat.color} text-white inline-block mb-4 shadow-lg`}>
                    {cat.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="text-text-secondary text-sm mb-4 leading-relaxed">{cat.description}</p>
                  <div className="flex items-center text-primary-color font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Open {cat.name} <ChevronRight size={16} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="tool"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-6 flex flex-col"
              style={{ minHeight: 'calc(100vh - 120px)' }}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveCategory('dashboard')}
                    className="p-3 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
                  >
                    <ChevronRight size={24} className="rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold">{categories.find(c => c.id === activeCategory)?.name} Studio</h2>
                    <p className="text-text-secondary text-sm">Professional file processing</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-bold tracking-widest uppercase border border-indigo-500/30">ULTRA HQ ENGINE</span>
              </div>

              <div className="flex-1">
                <Converter
                  category={activeCategory}
                  allowedFormats={categories.find(c => c.id === activeCategory)?.formats || []}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
