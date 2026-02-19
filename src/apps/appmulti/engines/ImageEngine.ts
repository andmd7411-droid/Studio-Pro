import type { FileFormat, ConversionOptions } from '../types';

export class ImageEngine {
    /**
     * Converts an image file to the target format with quality and resizing options.
     */
    static async convert(
        file: File,
        targetFormat: FileFormat,
        options: ConversionOptions = { quality: 1.0 }
    ): Promise<Blob> {
        // SVG: just return the raw file as-is (canvas can't produce real SVG)
        if (targetFormat === 'SVG') {
            return new Blob([await file.arrayBuffer()], { type: 'image/svg+xml' });
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { alpha: true });

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Set dimensions (resizing if requested)
                let { width, height } = img;
                if (options.width && options.height) {
                    width = options.width;
                    height = options.height;
                } else if (options.width) {
                    const ratio = img.height / img.width;
                    width = options.width;
                    height = width * ratio;
                } else if (options.height) {
                    const ratio = img.width / img.height;
                    height = options.height;
                    width = height * ratio;
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);

                // For formats that don't support transparency, fill background white
                if (targetFormat === 'JPG' || targetFormat === 'BMP') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // Draw image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // ICO: resize to 256x256 max and export as PNG (browser ICO support is limited)
                if (targetFormat === 'ICO') {
                    const icoSize = Math.min(256, canvas.width, canvas.height);
                    const icoCanvas = document.createElement('canvas');
                    icoCanvas.width = icoSize;
                    icoCanvas.height = icoSize;
                    const icoCtx = icoCanvas.getContext('2d')!;
                    icoCtx.drawImage(canvas, 0, 0, icoSize, icoSize);
                    icoCanvas.toBlob(
                        (blob) => {
                            if (blob) resolve(new Blob([blob], { type: 'image/x-icon' }));
                            else reject(new Error('ICO conversion failed'));
                        },
                        'image/png',
                        1.0
                    );
                    return;
                }

                // Map internal format to mime type
                const mimeType = this.getMimeType(targetFormat);

                // Quality factor (0 to 1 for JPEG/WEBP/AVIF)
                const quality = options.quality ?? 0.95;

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error(`Conversion to ${targetFormat} failed — format may not be supported by this browser`));
                        }
                    },
                    mimeType,
                    quality
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    }

    private static getMimeType(format: FileFormat): string {
        switch (format) {
            case 'JPG': return 'image/jpeg';
            case 'PNG': return 'image/png';
            case 'WEBP': return 'image/webp';
            case 'BMP': return 'image/bmp';
            case 'ICO': return 'image/x-icon';
            case 'GIF': return 'image/gif';
            case 'TIFF': return 'image/tiff';
            case 'AVIF': return 'image/avif';
            case 'SVG': return 'image/svg+xml';
            default: return 'image/png';
        }
    }
}
