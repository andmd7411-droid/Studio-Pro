import React from 'react';
import { Play, Sparkles, Wand2, Download } from 'lucide-react';

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; primary?: boolean; onClick?: () => void }> = ({ icon, label, primary, onClick }) => (
    <button
        onClick={onClick}
        className={`
    flex items-center justify-center gap-2 w-full p-3 rounded-xl transition-all duration-300 font-medium
    ${primary
                ? 'bg-gradient-to-r from-neonBlue to-blue-600 text-black shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:shadow-[0_0_25px_rgba(0,243,255,0.5)]'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'}
  `}>
        {icon}
        <span>{label}</span>
    </button>
);

const RightPanel: React.FC<{
    onAnimate: (anim: string) => void;
    onExport: () => void;
    onStyleSelect: (style: 'anime' | 'cyber') => void;
}> = ({ onAnimate, onExport, onStyleSelect }) => {
    return (
        <div className="flex flex-col h-full p-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-neonPink to-red-500 bg-clip-text text-transparent mb-6">
                Studio Controls
            </h2>

            <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div>
                    <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 tracking-wider">Animations</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <ActionButton icon={<Play size={16} />} label="Idle" onClick={() => onAnimate('idle')} />
                        <ActionButton icon={<Play size={16} />} label="Walk" onClick={() => onAnimate('dance')} />
                        <ActionButton icon={<Play size={16} />} label="Dance" onClick={() => onAnimate('dance')} />
                        <ActionButton icon={<Play size={16} />} label="Wave" onClick={() => onAnimate('wave')} />
                    </div>
                </div>

                <div>
                    <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 tracking-wider">Style Transfer</h3>
                    <div className="space-y-3">
                        <button
                            onClick={() => onStyleSelect('anime')}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-black/20 hover:bg-neonPink/20 border border-transparent hover:border-neonPink/50 transition-all cursor-pointer group"
                        >
                            <span className="text-sm text-gray-300 group-hover:text-white">Anime Flat</span>
                            <Wand2 size={16} className="text-neonPink" />
                        </button>
                        <button
                            onClick={() => onStyleSelect('cyber')}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-black/20 hover:bg-neonBlue/20 border border-transparent hover:border-neonBlue/50 transition-all cursor-pointer group"
                        >
                            <span className="text-sm text-gray-300 group-hover:text-white">Cyber 4D</span>
                            <Sparkles size={16} className="text-yellow-400" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-white/10">
                <ActionButton icon={<Download size={20} />} label="Export Model" primary onClick={onExport} />
            </div>
        </div>
    );
};

export default RightPanel;
