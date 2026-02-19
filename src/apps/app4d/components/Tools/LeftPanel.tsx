import React from 'react';
import { Upload, Box, Circle, Cylinder, Square } from 'lucide-react';



interface AdjustmentType {
    scale: number;
    rotation: number;
    color: string;
    displacementScale: number;
    metalness: number;
    roughness: number;
    wireframe: boolean;
    alphaTest: number;
    emissiveIntensity: number;
    opacity: number;
    shape: string;
}

const LeftPanel: React.FC<{
    onUpload: (file: File) => void;
    adjustments: AdjustmentType;
    onAdjustmentChange: (adj: AdjustmentType) => void;
}> = ({ onUpload, adjustments, onAdjustmentChange }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [preview, setPreview] = React.useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setPreview(url);
            onUpload(file);
        }
    };

    const updateAdjustment = (key: keyof AdjustmentType, value: string | number | boolean) => {
        onAdjustmentChange({ ...adjustments, [key]: value });
    };

    return (
        <div className="flex flex-col h-full p-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-neonBlue to-purple-500 bg-clip-text text-transparent mb-6">
                Model Tools
            </h2>

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <div className="mb-6">
                    <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 tracking-wider">Input</h3>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-neonBlue hover:bg-white/5 transition-all group relative overflow-hidden"
                    >
                        {preview ? (
                            <img src={preview} alt="Upload preview" className="w-full h-32 object-cover rounded-lg mb-2" />
                        ) : (
                            <>
                                <Upload className="w-8 h-8 text-gray-400 group-hover:text-neonBlue mb-2 transition-colors" />
                                <span className="text-sm text-gray-400">Upload Photo</span>
                            </>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                            title="Upload Image"
                        />
                    </div>
                </div>

                <div>
                    <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 tracking-wider">Adjustments</h3>
                    <div className="bg-white/5 p-4 rounded-xl space-y-4">
                        {/* Shape Selection */}
                        <div className="space-y-3 pb-3 border-b border-white/10">
                            <label className="text-xs text-gray-400 block mb-1">Base Shape</label>
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={() => updateAdjustment('shape', 'plane')}
                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${adjustments.shape === 'plane' ? 'bg-neonBlue/20 text-neonBlue border border-neonBlue/50' : 'bg-black/20 text-gray-400 hover:bg-white/5'}`}
                                    title="Plane"
                                >
                                    <Square size={16} />
                                </button>
                                <button
                                    onClick={() => updateAdjustment('shape', 'box')}
                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${adjustments.shape === 'box' ? 'bg-neonBlue/20 text-neonBlue border border-neonBlue/50' : 'bg-black/20 text-gray-400 hover:bg-white/5'}`}
                                    title="Box"
                                >
                                    <Box size={16} />
                                </button>
                                <button
                                    onClick={() => updateAdjustment('shape', 'sphere')}
                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${adjustments.shape === 'sphere' ? 'bg-neonBlue/20 text-neonBlue border border-neonBlue/50' : 'bg-black/20 text-gray-400 hover:bg-white/5'}`}
                                    title="Sphere"
                                >
                                    <Circle size={16} />
                                </button>
                                <button
                                    onClick={() => updateAdjustment('shape', 'cylinder')}
                                    className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${adjustments.shape === 'cylinder' ? 'bg-neonBlue/20 text-neonBlue border border-neonBlue/50' : 'bg-black/20 text-gray-400 hover:bg-white/5'}`}
                                    title="Cylinder"
                                >
                                    <Cylinder size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Transform Tools */}
                        <div className="space-y-3 pb-3 border-b border-white/10">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Scale</label>
                                <input
                                    type="range" min="0.5" max="2" step="0.1"
                                    value={adjustments.scale}
                                    onChange={(e) => updateAdjustment('scale', parseFloat(e.target.value))}
                                    className="w-full accent-neonBlue"
                                    title="Adjust Scale"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Rotation (Y)</label>
                                <input
                                    type="range" min="0" max="360" step="10"
                                    value={adjustments.rotation}
                                    onChange={(e) => updateAdjustment('rotation', parseFloat(e.target.value))}
                                    className="w-full accent-neonBlue"
                                    title="Adjust Rotation"
                                />
                            </div>
                        </div>

                        {/* Material Tools (4D Qualities) */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1 flex justify-between">
                                    <span>Depth Power (4D)</span>
                                    <span className="text-neonBlue">{adjustments.displacementScale.toFixed(1)}</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={adjustments.displacementScale}
                                    onChange={(e) => updateAdjustment('displacementScale', parseFloat(e.target.value))}
                                    className="w-full accent-neonPink"
                                    title="Adjust Depth Power"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Alpha Cutout</label>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={adjustments.alphaTest}
                                    onChange={(e) => updateAdjustment('alphaTest', parseFloat(e.target.value))}
                                    className="w-full accent-green-500"
                                    title="Adjust Alpha Cutout"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1 flex justify-between">
                                    <span>Glow Power</span>
                                    <span className="text-yellow-400">{adjustments.emissiveIntensity.toFixed(1)}</span>
                                </label>
                                <input
                                    type="range" min="0" max="2" step="0.1"
                                    value={adjustments.emissiveIntensity}
                                    onChange={(e) => updateAdjustment('emissiveIntensity', parseFloat(e.target.value))}
                                    className="w-full accent-yellow-400"
                                    title="Adjust Glow Power"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Opacity</label>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={adjustments.opacity}
                                    onChange={(e) => updateAdjustment('opacity', parseFloat(e.target.value))}
                                    className="w-full accent-purple-500"
                                    title="Adjust Opacity"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Metalness</label>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={adjustments.metalness}
                                    onChange={(e) => updateAdjustment('metalness', parseFloat(e.target.value))}
                                    className="w-full accent-purple-500"
                                    title="Adjust Metalness"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Roughness</label>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={adjustments.roughness}
                                    onChange={(e) => updateAdjustment('roughness', parseFloat(e.target.value))}
                                    className="w-full accent-purple-500"
                                    title="Adjust Roughness"
                                />
                            </div>
                            <div className="pt-2 flex items-center justify-between">
                                <span className="text-xs text-gray-400">Wireframe Mode</span>
                                <input
                                    type="checkbox"
                                    checked={adjustments.wireframe}
                                    onChange={(e) => updateAdjustment('wireframe', e.target.checked)}
                                    className="w-4 h-4 accent-neonBlue"
                                    title="Toggle Wireframe"
                                />
                            </div>
                            <div className="pt-2">
                                <label className="text-xs text-gray-400 block mb-1">Color Tint</label>
                                <input
                                    type="color"
                                    value={adjustments.color}
                                    onChange={(e) => updateAdjustment('color', e.target.value)}
                                    className="w-full h-8 cursor-pointer rounded bg-transparent border border-white/20"
                                    title="Choose Color Tint"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeftPanel;
