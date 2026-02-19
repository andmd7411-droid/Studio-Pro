import JSZip from 'jszip';

export class ArchiveEngine {
    /**
     * Bundles multiple files into a high-quality ZIP archive.
     */
    static async createZIP(files: File[], _archiveName: string = 'archive.zip'): Promise<Blob> {
        const zip = new JSZip();

        // Add each file to the zip
        files.forEach(file => {
            zip.file(file.name, file);
        });

        // Generate blob with high-quality compression
        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9 // Professional/Ultimate quality compression
            }
        });
    }

    /**
     * Optional: Extract ZIP contents (if needed in future)
     */
    static async extractZIP(zipBlob: Blob): Promise<{ [key: string]: JSZip.JSZipObject }> {
        const zip = await JSZip.loadAsync(zipBlob);
        return zip.files;
    }
}
