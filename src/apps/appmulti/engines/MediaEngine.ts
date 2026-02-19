import type { FileFormat, ConversionOptions } from '../types';

// ─── WAV encoder (pure browser, zero dependencies) ────────────────────────
function encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = audioBuffer.length;
    const blockAlign = numChannels * 2;
    const dataSize = numSamples * blockAlign;
    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);

    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
    ws(8, 'WAVE'); ws(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
    ws(36, 'data'); view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
    }
    return new Blob([buf], { type: 'audio/wav' });
}

// ─── Best supported MIME types ────────────────────────────────────────────
function bestMime(candidates: string[]): string | null {
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

const BEST_VIDEO_MIME = () => bestMime([
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
]);

const BEST_AUDIO_MIME = () => bestMime([
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
]);

// ─── MediaEngine ───────────────────────────────────────────────────────────
export class MediaEngine {
    static isLoaded(): boolean { return true; }
    static async load() { return; }

    static async convert(
        file: File,
        targetFormat: FileFormat,
        _options: ConversionOptions = {}, // eslint-disable-line @typescript-eslint/no-unused-vars
        onProgress?: (p: number) => void,
        onStatus?: (s: string) => void
    ): Promise<Blob> {
        const audioFormats: FileFormat[] = ['MP3', 'WAV', 'OGG', 'AAC', 'FLAC'];
        if (audioFormats.includes(targetFormat)) {
            return this.convertAudio(file, targetFormat, onProgress, onStatus);
        }
        return this.convertVideo(file, targetFormat, onProgress, onStatus);
    }

    // ── AUDIO ────────────────────────────────────────────────────────────
    private static async convertAudio(
        file: File,
        targetFormat: FileFormat,
        onProgress?: (p: number) => void,
        onStatus?: (s: string) => void
    ): Promise<Blob> {
        onStatus?.('Decodific audio…');
        onProgress?.(10);

        const arrayBuffer = await file.arrayBuffer();
        onProgress?.(30);

        const audioCtx = new AudioContext();
        let audioBuffer: AudioBuffer;
        try {
            audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch {
            await audioCtx.close();
            throw new Error('Browserul nu poate decoda acest fișier. Încearcă un format diferit.');
        }
        onProgress?.(60);
        onStatus?.('Encodez…');

        // WAV: always works
        if (targetFormat === 'WAV') {
            await audioCtx.close();
            onProgress?.(100);
            return encodeWAV(audioBuffer);
        }

        // Other formats via MediaRecorder
        const mime = BEST_AUDIO_MIME();
        if (mime) {
            const blob = await this.recordAudioBuffer(audioBuffer, mime, onProgress);
            await audioCtx.close();
            return new Blob([blob], { type: this.audioMime(targetFormat) ?? mime });
        }

        // Fallback to WAV
        onStatus?.('Encodez ca WAV (MP3/AAC nu sunt suportate nativ)…');
        await audioCtx.close();
        onProgress?.(100);
        return encodeWAV(audioBuffer);
    }

    private static recordAudioBuffer(
        audioBuffer: AudioBuffer,
        mimeType: string,
        onProgress?: (p: number) => void
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const ctx = new AudioContext({ sampleRate: audioBuffer.sampleRate });
            const dest = ctx.createMediaStreamDestination();
            const src = ctx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(dest);
            src.connect(ctx.destination);

            const recorder = new MediaRecorder(dest.stream, { mimeType });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                ctx.close();
                resolve(new Blob(chunks, { type: mimeType }));
            };
            recorder.onerror = (e) => { ctx.close(); reject(e); };

            const duration = audioBuffer.duration * 1000;
            const started = Date.now();
            const timer = setInterval(() => {
                const pct = Math.min(99, Math.round(60 + ((Date.now() - started) / duration) * 39));
                onProgress?.(pct);
            }, 250);

            src.onended = () => {
                clearInterval(timer);
                onProgress?.(99);
                setTimeout(() => recorder.stop(), 150);
            };

            recorder.start(250);
            src.start();
        });
    }

    // ── VIDEO ────────────────────────────────────────────────────────────
    private static convertVideo(
        file: File,
        targetFormat: FileFormat,
        onProgress?: (p: number) => void,
        onStatus?: (s: string) => void
    ): Promise<Blob> {
        const mimeType = BEST_VIDEO_MIME();
        if (!mimeType) {
            return Promise.reject(new Error('Browserul tău nu suportă înregistrarea video. Folosește Chrome sau Edge.'));
        }

        onStatus?.('Convertesc video…');

        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);

            // ── 1. Video element (hidden) ──────────────────────────────
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';

            // ── 2. Canvas — canvas.captureStream() always yields data ──
            const canvas = document.createElement('canvas');
            // Keep canvas in a visible rendering context (tiny, bottom-right)
            canvas.style.cssText = 'position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.01;z-index:-1;pointer-events:none';
            document.body.appendChild(canvas);

            const cleanup = () => {
                try { document.body.removeChild(canvas); } catch { /**/ }
                URL.revokeObjectURL(url);
            };

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                const ctx = canvas.getContext('2d')!;

                // ── 3. Capture from canvas (always active surface) ─────
                const stream = canvas.captureStream(30);
                const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
                const chunks: BlobPart[] = [];

                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    cleanup();
                    if (chunks.length === 0) {
                        reject(new Error('Nu s-au capturat date video. Încearcă un alt browser (Chrome/Edge).'));
                        return;
                    }
                    const outputMime = this.videoMime(targetFormat) ?? mimeType;
                    resolve(new Blob(chunks, { type: outputMime }));
                };
                recorder.onerror = () => { cleanup(); reject(new Error('Eroare MediaRecorder.')); };

                // ── 4. rAF loop — draw each frame to canvas ───────────
                let rafId = 0;
                const drawLoop = () => {
                    if (video.readyState >= 2) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    }
                    if (!video.ended && !video.paused) {
                        rafId = requestAnimationFrame(drawLoop);
                    }
                    if (video.duration > 0) {
                        onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
                    }
                };

                video.onended = () => {
                    cancelAnimationFrame(rafId);
                    // Draw last frame
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    onProgress?.(100);
                    onStatus?.('Finalizez…');
                    setTimeout(() => recorder.stop(), 400);
                };

                // ── 5. Start recording then play ──────────────────────
                recorder.start(100);          // 100ms chunks — frequent, ensures data
                video.play()
                    .then(() => requestAnimationFrame(drawLoop))
                    .catch(err => {
                        cleanup();
                        reject(new Error('Nu s-a putut reda videoclipul: ' + err.message));
                    });
            };

            video.onerror = () => {
                cleanup();
                reject(new Error('Nu s-a putut încărca fișierul video.'));
            };
        });
    }

    private static audioMime(format: FileFormat): string | null {
        const map: Partial<Record<FileFormat, string>> = {
            MP3: 'audio/mpeg', WAV: 'audio/wav', OGG: 'audio/ogg',
            AAC: 'audio/aac', FLAC: 'audio/flac',
        };
        return map[format] ?? null;
    }

    private static videoMime(format: FileFormat): string | null {
        const map: Partial<Record<FileFormat, string>> = {
            MP4: 'video/mp4', WEBM: 'video/webm',
            AVI: 'video/x-msvideo', MOV: 'video/quicktime',
            MKV: 'video/x-matroska', GIF: 'image/gif',
        };
        return map[format] ?? null;
    }
}
