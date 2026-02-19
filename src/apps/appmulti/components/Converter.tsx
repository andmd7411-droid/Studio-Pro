import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Upload,
    File,
    CheckCircle,
    Loader2,
    Download,
    Play,
    Settings as SettingsIcon,
    Trash2,
    Eye,
    RefreshCw,
    Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FileData, FileFormat, ConversionOptions } from '../types';
import { ImageEngine } from '../engines/ImageEngine';
import { MediaEngine } from '../engines/MediaEngine';
import { DocumentEngine } from '../engines/DocumentEngine';
import { ArchiveEngine } from '../engines/ArchiveEngine';
import FilePreview from './FilePreview';

interface ConverterProps {
    category: string;
    allowedFormats: FileFormat[];
}

const Converter: React.FC<ConverterProps> = ({ category, allowedFormats }) => {
    const [files, setFiles] = useState<FileData[]>([]);
    const [targetFormat, setTargetFormat] = useState<FileFormat>(allowedFormats[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [engineStatus, setEngineStatus] = useState<string | null>(null);
    const [options] = useState<ConversionOptions>({
        quality: 0.95,
        bitrate: '192k',
    });

    const [previewFile, setPreviewFile] = useState<{ file: File | Blob, name: string } | null>(null);

    // Reset format and file list when category changes
    useEffect(() => {
        setTargetFormat(allowedFormats[0]);
        setFiles([]);
    }, [category, allowedFormats]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles: FileData[] = acceptedFiles.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            status: 'pending',
            progress: 0
        }));
        setFiles(prev => [...prev, ...newFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const retryFile = (id: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined, outputBlob: undefined, outputName: undefined } : f
        ));
    };

    const processFiles = async () => {
        setIsProcessing(true);

        const updatedFiles = [...files];

        for (let i = 0; i < updatedFiles.length; i++) {
            if (updatedFiles[i].status === 'completed') continue;

            try {
                updatedFiles[i] = { ...updatedFiles[i], status: 'processing', progress: 0, error: undefined };
                setFiles([...updatedFiles]);

                let result: Blob;

                if (category === 'image') {
                    if (targetFormat === 'PDF') {
                        result = await DocumentEngine.imageToPDF(updatedFiles[i].file);
                    } else {
                        result = await ImageEngine.convert(updatedFiles[i].file, targetFormat, options);
                    }
                } else if (category === 'audio' || category === 'video') {
                    result = await MediaEngine.convert(
                        updatedFiles[i].file,
                        targetFormat,
                        options,
                        (progress) => {
                            updatedFiles[i] = { ...updatedFiles[i], progress };
                            setFiles([...updatedFiles]);
                        },
                        (status) => setEngineStatus(status)
                    );
                } else if (category === 'archive') {
                    result = await ArchiveEngine.createZIP([updatedFiles[i].file]);
                } else {
                    // Documents
                    if (targetFormat === 'PDF') {
                        if (updatedFiles[i].file.type.startsWith('image/')) {
                            result = await DocumentEngine.imageToPDF(updatedFiles[i].file);
                        } else {
                            const content = await updatedFiles[i].file.text();
                            result = await DocumentEngine.toPDF(content);
                        }
                    } else {
                        const content = await updatedFiles[i].file.text();
                        result = await DocumentEngine.convertText(content, targetFormat);
                    }
                }

                const outExt = targetFormat.toLowerCase();
                updatedFiles[i] = {
                    ...updatedFiles[i],
                    status: 'completed',
                    outputBlob: result,
                    outputName: updatedFiles[i].file.name.replace(/\.[^.]+$/, '') + '.' + outExt,
                    progress: 100
                };
            } catch (err) {
                console.error(err);
                const msg = err instanceof Error ? err.message : 'Conversion failed';
                updatedFiles[i] = { ...updatedFiles[i], status: 'error', error: msg };
            }
            setFiles([...updatedFiles]);
        }

        setIsProcessing(false);
        setEngineStatus(null);
    };

    const downloadFile = (file: FileData) => {
        if (!file.outputBlob || !file.outputName) return;
        const url = URL.createObjectURL(file.outputBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.outputName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadAll = () => {
        files.filter(f => f.status === 'completed').forEach(downloadFile);
    };

    const completedCount = files.filter(f => f.status === 'completed').length;
    const allDone = files.length > 0 && completedCount === files.length;

    return (
        <div className="space-y-6">
            {/* Target Format Selector */}
            <div className="flex flex-wrap items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <span className="text-sm font-semibold text-text-secondary">Convert to:</span>
                <div className="flex flex-wrap gap-2">
                    {allowedFormats.map(fmt => (
                        <button
                            key={fmt}
                            onClick={() => setTargetFormat(fmt)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${targetFormat === fmt
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-white/5 text-text-secondary hover:bg-white/10'
                                }`}
                        >
                            {fmt}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-lg text-text-secondary" title="Advanced Settings">
                        <SettingsIcon size={20} />
                    </button>
                </div>
            </div>

            {/* FFmpeg Engine Loading Banner */}
            <AnimatePresence>
                {engineStatus && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300"
                    >
                        <Cpu size={20} className="animate-pulse shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold">{engineStatus}</p>
                            {engineStatus.includes('Loading') && (
                                <p className="text-xs text-indigo-400/70 mt-0.5">
                                    Se descarcă motorul FFmpeg (~30 MB) — doar la prima utilizare. Nu închide pagina.
                                </p>
                            )}
                        </div>
                        <Loader2 size={18} className="animate-spin shrink-0" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer text-center ${isDragActive ? 'border-indigo-500 bg-indigo-500/5 scale-[0.99]' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center">
                    <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 mb-4">
                        <Upload size={32} />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Select or drag files</h3>
                    <p className="text-text-secondary text-sm">Processing locally for ultimate privacy</p>
                </div>
            </div>

            {/* File List */}
            <div className="space-y-3">
                {files.map(file => (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={file.id}
                        className="flex items-center gap-4 p-4 glass-card bg-white/5 group"
                    >
                        <div className={`p-2 rounded-lg ${file.status === 'error' ? 'text-red-400 bg-red-400/10' : 'text-indigo-400 bg-indigo-400/10'}`}>
                            <File size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file.name}</p>
                            <p className="text-xs text-text-secondary">
                                {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                                {file.status === 'error' && (
                                    <span className="ml-2 text-red-400" title={file.error}>⚠ {file.error}</span>
                                )}
                            </p>
                        </div>

                        <div className="flex-1 max-w-[150px]">
                            {file.status === 'processing' && (
                                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${file.progress}%` }}
                                        className="bg-indigo-500 h-full"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1 sm:gap-3">
                            {/* Preview Source Button */}
                            <button
                                onClick={() => setPreviewFile({ file: file.file, name: file.file.name })}
                                className="p-1.5 hover:bg-white/10 text-text-secondary hover:text-indigo-400 transition-colors"
                                title="Preview Source"
                            >
                                <Eye size={18} />
                            </button>

                            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

                            {file.status === 'pending' && <span className="text-[10px] text-text-secondary px-2 py-1 bg-white/5 rounded uppercase font-bold tracking-wider">Pending</span>}
                            {file.status === 'processing' && <Loader2 size={18} className="animate-spin text-indigo-400" />}
                            {file.status === 'completed' && <CheckCircle size={18} className="text-emerald-400" />}
                            {file.status === 'error' && (
                                <button
                                    onClick={() => retryFile(file.id)}
                                    className="p-1.5 hover:bg-red-400/10 text-red-400 rounded transition-colors"
                                    title="Retry"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            )}

                            {file.status === 'completed' && file.outputBlob && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPreviewFile({ file: file.outputBlob!, name: file.outputName! })}
                                        className="p-1.5 hover:bg-emerald-400/10 text-emerald-400 rounded transition-colors"
                                        title="Preview Converted"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={() => downloadFile(file)}
                                        className="p-1.5 hover:bg-emerald-400/10 text-emerald-400 rounded transition-colors"
                                        title="Download"
                                    >
                                        <Download size={18} />
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => removeFile(file.id)}
                                className="p-1.5 hover:bg-white/10 text-text-secondary hover:text-red-400 transition-colors"
                                title="Remove"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Actions */}
            {files.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-6 bg-indigo-500/5 rounded-xl border border-indigo-500/20 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-text-primary">{completedCount} of {files.length} Done</p>
                            <p className="text-xs text-text-secondary uppercase tracking-widest font-bold">Local Processing Active</p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setFiles([])}
                            className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors hover:bg-white/5 rounded-lg"
                        >
                            Clear All
                        </button>
                        {allDone && (
                            <button
                                onClick={downloadAll}
                                className="flex-1 sm:flex-none px-6 py-2 text-sm font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Download size={16} /> Download All
                            </button>
                        )}
                        <button
                            disabled={isProcessing || allDone}
                            onClick={processFiles}
                            className="flex-1 sm:flex-none btn-primary shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                            {isProcessing ? 'Processing...' : 'Run Conversion'}
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <FilePreview
                        file={previewFile.file}
                        fileName={previewFile.name}
                        onClose={() => setPreviewFile(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Converter;
