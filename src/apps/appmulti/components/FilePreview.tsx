import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Download, FileText, Music, Video, Image as ImageIcon, Archive } from 'lucide-react';
import { motion } from 'framer-motion';

interface FilePreviewProps {
    file: File | Blob;
    fileName: string;
    onClose: () => void;
}

/**
 * Infer MIME type from file name extension when the Blob type is empty.
 */
function inferType(blob: File | Blob, fileName: string): string {
    if (blob.type && blob.type !== 'application/octet-stream') return blob.type;

    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
        ico: 'image/x-icon', svg: 'image/svg+xml', tiff: 'image/tiff',
        avif: 'image/avif',
        pdf: 'application/pdf',
        txt: 'text/plain', md: 'text/markdown', html: 'text/html',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        aac: 'audio/aac', flac: 'audio/flac',
        mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
        mov: 'video/quicktime', mkv: 'video/x-matroska',
        zip: 'application/zip',
    };
    return map[ext] ?? 'application/octet-stream';
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, fileName, onClose }) => {
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [fileType, setFileType] = useState<string>('');
    const [textContent, setTextContent] = useState<string | null>(null);

    useEffect(() => {
        const type = inferType(file, fileName);
        setFileType(type);

        // Re-wrap blob with correct type so object URL serves correct MIME
        const typedBlob = file.type === type
            ? file
            : new Blob([file], { type });

        const url = URL.createObjectURL(typedBlob);
        setPreviewUrl(url);
        setTextContent(null);

        if (
            type.startsWith('text/') ||
            type === 'text/markdown' ||
            fileName.endsWith('.md') ||
            fileName.endsWith('.txt') ||
            fileName.endsWith('.html')
        ) {
            typedBlob.slice(0, 50000).text().then(setTextContent).catch(console.error);
        }

        return () => URL.revokeObjectURL(url);
    }, [file, fileName]);

    const renderPreview = () => {
        if (fileType.startsWith('image/')) {
            // SVG: use object tag for proper rendering
            if (fileType === 'image/svg+xml') {
                return (
                    <div className="flex items-center justify-center p-4 h-full">
                        <object
                            data={previewUrl}
                            type="image/svg+xml"
                            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                            aria-label={fileName}
                        />
                    </div>
                );
            }
            return (
                <div className="flex items-center justify-center p-4 h-full">
                    <img
                        src={previewUrl}
                        alt={fileName}
                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                    />
                </div>
            );
        }

        if (fileType.startsWith('video/')) {
            return (
                <div className="flex items-center justify-center p-4 h-full">
                    <video
                        src={previewUrl}
                        controls
                        className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        }

        if (fileType.startsWith('audio/')) {
            return (
                <div className="flex flex-col items-center justify-center p-12 h-full gap-8">
                    <div className="p-8 bg-indigo-500/10 rounded-full text-indigo-400">
                        <Music size={64} />
                    </div>
                    <p className="text-text-secondary font-medium">{fileName}</p>
                    <audio src={previewUrl} controls className="w-full max-w-md" />
                </div>
            );
        }

        if (fileType === 'application/pdf') {
            return (
                <div className="h-full w-full p-4">
                    <iframe
                        src={previewUrl}
                        className="w-full h-[70vh] rounded-lg border border-white/10"
                        title={fileName}
                    />
                </div>
            );
        }

        if (fileType === 'application/zip') {
            return (
                <div className="flex flex-col items-center justify-center p-12 h-full gap-4 text-text-secondary">
                    <Archive size={56} className="text-indigo-400" />
                    <p className="font-semibold">{fileName}</p>
                    <p className="text-sm">ZIP archive — download to extract contents.</p>
                </div>
            );
        }

        if (textContent !== null) {
            const isHTML = fileType === 'text/html' || fileName.endsWith('.html');
            if (isHTML) {
                return (
                    <iframe
                        srcDoc={textContent}
                        className="w-full h-[70vh] rounded-lg border border-white/10 bg-white"
                        title={fileName}
                        sandbox="allow-same-origin"
                    />
                );
            }
            return (
                <div className="p-6 h-full overflow-auto text-sm font-mono text-text-secondary bg-black/20 rounded-lg border border-white/5">
                    <pre className="whitespace-pre-wrap">{textContent}</pre>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-12 h-full gap-4 text-text-secondary">
                <FileText size={48} />
                <p>Preview not available for this file type.</p>
                <p className="text-xs">{fileType || 'Unknown Type'}</p>
            </div>
        );
    };

    const getIcon = () => {
        if (fileType.startsWith('image/')) return <ImageIcon size={20} />;
        if (fileType.startsWith('video/')) return <Video size={20} />;
        if (fileType.startsWith('audio/')) return <Music size={20} />;
        if (fileType === 'application/zip') return <Archive size={20} />;
        return <FileText size={20} />;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            {getIcon()}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg truncate max-w-md">{fileName}</h3>
                            <p className="text-xs text-text-secondary font-mono tracking-wider uppercase">{fileType || 'Unknown'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-white/10 rounded-lg text-text-secondary transition-colors"
                            title="Open in new tab"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-text-secondary transition-colors hover:text-red-400"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-900/40">
                    {renderPreview()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
                    >
                        Close
                    </button>
                    <a
                        href={previewUrl}
                        download={fileName}
                        className="btn-primary py-2 px-6 text-sm"
                    >
                        <Download size={18} /> Download
                    </a>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FilePreview;
