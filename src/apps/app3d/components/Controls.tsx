import React from 'react';
import { useAppStore } from '../store/AppContext';
import { imageProcessor } from '../core/imageProcessor';
import { geometryGenerator } from '../core/geometryGenerator';
import { stlExporter } from '../core/exporter';
import { Upload, Download, Layers, Settings, Image as ImageIcon } from 'lucide-react';

export const Controls = () => {
    const {
        setOriginalImage,
        setProcessedImage,
        setHeightmap,
        setImageDimensions,
        setIsProcessing,
        isProcessing,
        imageSettings,
        modelSettings,
        updateImageSettings,
        updateModelSettings,
        processedImage,
        heightmap,
        imageDimensions
    } = useAppStore();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const img = await imageProcessor.loadImage(file);
            setOriginalImage(img);

            // Process initial
            updatePreview(img, imageSettings);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const updatePreview = (img: HTMLImageElement, settings: typeof imageSettings) => {
        // Pass modelSettings.resolution to processImage
        const imageData = imageProcessor.processImage(img, settings, modelSettings.resolution);

        // Create preview URL
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx?.putImageData(imageData, 0, 0);

        setProcessedImage(canvas.toDataURL());
        setImageDimensions({ width: imageData.width, height: imageData.height });

        // Generate heightmap asynchronous to not block UI too much? 
        // For now synchronous, but in real app use worker.
        const map = imageProcessor.generateHeightmap(imageData);
        setHeightmap(map);
    };

    const handleImageSettingChange = (key: keyof typeof imageSettings, value: number | boolean) => {
        updateImageSettings({ [key]: value });
        // Define a debounced update or manual "Apply" if slow. 
        // For now, let's assume immediate update is okay for small images.
        // Ideally we re-process.
        // We need access to originalImage here. 
    };

    // We need a way to trigger re-processing when settings change.
    // Using useEffect in a separate hook or just passing processing logic.
    // Let's create a dedicated effect or function here.

    const { originalImage } = useAppStore();

    // Effect to re-process when settings change
    React.useEffect(() => {
        if (originalImage) {
            const timeout = setTimeout(() => {
                updatePreview(originalImage, imageSettings);
            }, 300); // 300ms debounce
            return () => clearTimeout(timeout);
        }
    }, [imageSettings, modelSettings.resolution, originalImage]);


    return (
        <div className="w-80 h-full bg-dark-lighter border-l border-gray-700 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Controls
                </h2>
            </div>

            <div className="p-4 space-y-6">
                {/* Upload Section */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Image Source</h3>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-gray-800 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-primary" />
                            <p className="text-sm text-gray-400 group-hover:text-white">Click to upload image</p>
                            <p className="text-xs text-gray-500">JPG, PNG, BMP</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                </div>

                {/* Processed Preview */}
                {processedImage && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Preview
                        </h3>
                        <div className="w-full aspect-video bg-black rounded overflow-hidden border border-gray-700 relative">
                            <img src={processedImage} alt="Processed" className="w-full h-full object-contain" />
                        </div>
                    </div>
                )}

                {/* Image Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Image Settings
                    </h3>

                    {/* Quality / Resolution */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Quality (Resolution)</span>
                            <span className={
                                modelSettings.resolution <= 512 ? 'text-red-400' :
                                    modelSettings.resolution <= 1024 ? 'text-yellow-400' :
                                        'text-green-400'
                            }>
                                {modelSettings.resolution <= 512 ? 'Draft' :
                                    modelSettings.resolution <= 1024 ? 'Medium' :
                                        modelSettings.resolution <= 1500 ? 'High' :
                                            modelSettings.resolution <= 2048 ? 'Ultra' : 'Maximum'}
                            </span>
                        </div>
                        <select
                            value={modelSettings.resolution}
                            onChange={(e) => updateModelSettings({ resolution: parseInt(e.target.value) })}
                            className="w-full bg-gray-700 text-white text-xs rounded-lg p-2 border border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="512">Draft (512px) - Fast</option>
                            <option value="1024">Medium (1024px) - Balanced</option>
                            <option value="1500">High (1500px) - Good Detail</option>
                            <option value="2048">Ultra (2048px) - High Detail</option>
                            <option value="3072">Maximum (3072px) - Very Slow</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Sharpen (Details)</span>
                            <span>{imageSettings.sharpen}</span>
                        </div>
                        <input
                            type="range" min="0" max="10"
                            value={imageSettings.sharpen}
                            onChange={(e) => handleImageSettingChange('sharpen', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Contrast</span>
                            <span>{imageSettings.contrast}</span>
                        </div>
                        <input
                            type="range" min="-100" max="100"
                            value={imageSettings.contrast}
                            onChange={(e) => handleImageSettingChange('contrast', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Brightness</span>
                            <span>{imageSettings.brightness}</span>
                        </div>
                        <input
                            type="range" min="-100" max="100"
                            value={imageSettings.brightness}
                            onChange={(e) => handleImageSettingChange('brightness', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Blur (Smoothing)</span>
                            <span>{imageSettings.blur}px</span>
                        </div>
                        <input
                            type="range" min="0" max="20"
                            value={imageSettings.blur}
                            onChange={(e) => handleImageSettingChange('blur', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Gamma</span>
                            <span>{imageSettings.gamma}</span>
                        </div>
                        <input
                            type="range" min="0.1" max="3" step="0.1"
                            value={imageSettings.gamma}
                            onChange={(e) => handleImageSettingChange('gamma', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Noise Reduction</span>
                            <span>{imageSettings.noiseReduction}</span>
                        </div>
                        <input
                            type="range" min="0" max="10" step="1"
                            value={imageSettings.noiseReduction}
                            onChange={(e) => handleImageSettingChange('noiseReduction', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={imageSettings.invert}
                            onChange={(e) => handleImageSettingChange('invert', e.target.checked)}
                            className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary ring-offset-gray-800"
                        />
                        <span className="text-sm text-gray-300">Invert Colors (Dark = High)</span>
                    </label>
                </div>

                {/* Model Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Model Settings
                    </h3>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Width (mm)</span>
                            <span>{modelSettings.width}</span>
                        </div>
                        <input
                            type="range" min="10" max="200"
                            value={modelSettings.width}
                            onChange={(e) => updateModelSettings({ width: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Depth/Height (mm)</span>
                            <span>{modelSettings.depth}</span>
                        </div>
                        <input
                            type="range" min="1" max="50"
                            value={modelSettings.depth}
                            onChange={(e) => updateModelSettings({ depth: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Base Height (mm)</span>
                            <span>{modelSettings.baseHeight}</span>
                        </div>
                        <input
                            type="range" min="0" max="10" step="0.5"
                            value={modelSettings.baseHeight}
                            onChange={(e) => updateModelSettings({ baseHeight: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={modelSettings.smoothing}
                                onChange={(e) => updateModelSettings({ smoothing: e.target.checked })}
                                className="w-4 h-4 text-secondary bg-gray-700 border-gray-600 rounded focus:ring-secondary ring-offset-gray-800"
                            />
                            <span className="text-sm text-gray-300">Enable Smoothing</span>
                        </label>
                    </div>

                    {modelSettings.smoothing && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between text-xs text-gray-300">
                                <span>Smoothing Iterations</span>
                                <span>{modelSettings.smoothingIterations}</span>
                            </div>
                            <input
                                type="range" min="1" max="10" step="1"
                                value={modelSettings.smoothingIterations}
                                onChange={(e) => updateModelSettings({ smoothingIterations: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                            />
                        </div>
                    )}
                </div>

                {/* Frame Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-4 h-4 border border-gray-500 rounded-sm block"></span> Frame Settings
                    </h3>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Frame Width (mm)</span>
                            <span>{modelSettings.frameWidth}</span>
                        </div>
                        <input
                            type="range" min="0" max="50" step="1"
                            value={modelSettings.frameWidth}
                            onChange={(e) => updateModelSettings({ frameWidth: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                    </div>
                </div>

                {/* Shape Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-lg leading-none">↺</span> Shape Settings
                    </h3>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Curve Angle (°)</span>
                            <span>{modelSettings.curveAngle}°</span>
                        </div>
                        <input
                            type="range" min="0" max="360" step="10"
                            value={modelSettings.curveAngle}
                            onChange={(e) => updateModelSettings({ curveAngle: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                        <p className="text-[10px] text-gray-500">0 = Flat, 360 = Full Cylinder</p>
                    </div>
                </div>

                {/* View Options */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span>👁</span> View Options
                    </h3>

                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={modelSettings.showWireframe}
                            onChange={(e) => updateModelSettings({ showWireframe: e.target.checked })}
                            className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary ring-offset-gray-800"
                        />
                        <span className="text-sm text-gray-300">Show Wireframe</span>
                    </label>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Material Color</span>
                        </div>
                        <div className="flex gap-2">
                            {['#e2e8f0', '#ffedd5', '#fb7185', '#60a5fa', '#4ade80'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateModelSettings({ materialColor: color })}
                                    className={`w-6 h-6 rounded-full border-2 ${modelSettings.materialColor === color ? 'border-primary' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4">
                    <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-sky-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!processedImage || isProcessing}
                        onClick={() => {
                            if (!heightmap) return;
                            setIsProcessing(true);

                            // Small delay to allow UI to update
                            setTimeout(() => {
                                try {
                                    // Re-generate geometry for export
                                    // We could potentially generate a HIGHER resolution one here if we wanted
                                    const geo = geometryGenerator.generateMesh(
                                        heightmap,
                                        imageDimensions.width,
                                        imageDimensions.height,
                                        modelSettings
                                    );

                                    const buffer = stlExporter.parse(geo);
                                    const blob = new Blob([buffer], { type: 'application/octet-stream' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = 'lithophane_model.stl';
                                    link.click();
                                    URL.revokeObjectURL(link.href);
                                } catch (e) {
                                    console.error("Export failed", e);
                                    alert("Export failed: " + e);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }, 100);
                        }}
                    >
                        <Download className="w-5 h-5" />
                        Export STL
                    </button>
                </div>

            </div>
        </div>
    );
};

