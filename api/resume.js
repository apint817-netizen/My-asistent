import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Define a minimal shim for window that pdfjs might rely on
if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        location: { href: '' },
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
    };
}
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { userAgent: 'node' };
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { text, fileContent, fileType } = req.body;

    let resumeText = text || '';

    // Parse file content if provided
    if (fileContent && fileType) {
        try {
            const buffer = Buffer.from(fileContent, 'base64');

            if (fileType === 'application/pdf') {
                const uint8Array = new Uint8Array(buffer);
                const loadingTask = getDocument({
                    data: uint8Array,
                    useWorkerFetch: false,
                    isEvalSupported: false,
                    useSystemFonts: true
                });

                const pdf = await loadingTask.promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }
                resumeText = fullText;
            } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
                const result = await mammoth.extractRawText({ buffer });
                resumeText = result.value;
            } else if (fileType === 'application/rtf' || fileType === 'text/rtf') {
                // RTF: strip RTF control sequences and extract plain text
                let rtfText = buffer.toString('utf-8');
                rtfText = rtfText.replace(/\\[a-z]+\d*\s?/gi, '').replace(/[{}]/g, '').replace(/\\\\/g, '\\');
                resumeText = rtfText.trim();
            } else if (fileType.startsWith('text/')) {
                resumeText = buffer.toString('utf-8');
            } else {
                // Fallback: try to read as text
                const asText = buffer.toString('utf-8');
                if (asText && asText.length > 20 && !asText.includes('\x00')) {
                    resumeText = asText;
                }
            }
        } catch (err) {
            console.error('File parse error:', err);
            return res.status(400).json({ error: 'Не удалось прочитать файл. Попробуйте другой формат.' });
        }
    }

    if (!resumeText.trim()) {
        return res.status(400).json({ error: 'Пустое резюме. Загрузите файл или введите текст.' });
    }

    // Truncate if too long
    const maxChars = 6000;
    if (resumeText.length > maxChars) {
        resumeText = resumeText.substring(0, maxChars) + '\n...(текст обрезан)';
    }

    return res.status(200).json({ parsedText: resumeText });
}
