import { jsPDF } from 'jspdf';

export class DocumentEngine {
    /**
     * Converts a text-based file to PDF with high fidelity.
     */
    static async toPDF(content: string, _title: string = 'Document'): Promise<Blob> {
        const doc = new jsPDF();

        // Split text to fit page width
        const splitText = doc.splitTextToSize(content, 180);
        doc.setFontSize(11);
        doc.text(splitText, 15, 20);

        return doc.output('blob');
    }

    /**
     * Converts an image file to PDF properly.
     */
    static async imageToPDF(file: File): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const imgData = e.target?.result as string;
                    const doc = new jsPDF();

                    const img = new Image();
                    img.src = imgData;

                    img.onload = () => {
                        const pageWidth = doc.internal.pageSize.getWidth();
                        const pageHeight = doc.internal.pageSize.getHeight();

                        // Calculate aspect ratio to fit within page margins
                        const maxW = pageWidth - 20;
                        const maxH = pageHeight - 20;
                        const ratio = Math.min(maxW / img.width, maxH / img.height);
                        const imgWidth = img.width * ratio;
                        const imgHeight = img.height * ratio;

                        // Center image on page
                        const x = (pageWidth - imgWidth) / 2;
                        const y = (pageHeight - imgHeight) / 2;

                        // Detect actual image format from MIME type
                        const mime = file.type || 'image/jpeg';
                        const fmt = mime.includes('png') ? 'PNG'
                            : mime.includes('jpg') || mime.includes('jpeg') ? 'JPEG'
                                : mime.includes('webp') ? 'WEBP'
                                    : 'JPEG'; // fallback

                        try {
                            doc.addImage(imgData, fmt, x, y, imgWidth, imgHeight);
                        } catch {
                            // Fallback: try JPEG
                            doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
                        }
                        resolve(doc.output('blob'));
                    };

                    img.onerror = () => reject(new Error('Failed to load image for PDF conversion'));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Converts text content between TXT, MD, HTML formats.
     */
    static async convertText(content: string, targetFormat: string): Promise<Blob> {
        const fmt = targetFormat.toUpperCase();

        if (fmt === 'HTML') {
            // Convert plain text / markdown to basic HTML
            const escaped = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // Very lightweight MD-like conversion for headers, bold, italic, links
            const html = escaped
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
                .replace(/\n/g, '<br>\n');

            const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Converted Document</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
  h1,h2,h3 { color: #111; }
  a { color: #4f46e5; }
</style>
</head>
<body>
${html}
</body>
</html>`;
            return new Blob([fullHTML], { type: 'text/html' });
        }

        if (fmt === 'MD') {
            // Strip basic HTML tags, convert to markdown-ish text
            const md = content
                .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
                .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
                .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ');
            return new Blob([md], { type: 'text/markdown' });
        }

        // TXT: strip all HTML tags
        const txt = content
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ');
        return new Blob([txt], { type: 'text/plain' });
    }
}
