import fs from "fs";
import path from "path";

// Polyfill Promise.withResolvers for Node < 22
if (typeof Promise.withResolvers === 'undefined') {
    // @ts-expect-error - Polyfill
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

// Minimal DOMMatrix Polyfill for pdfjs-dist in Node.js
if (typeof global.DOMMatrix === 'undefined') {
    // @ts-expect-error - Polyfill
    global.DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        constructor() { }
    };
}

// pdfjs-dist types are tricky with legacy build import
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure worker for Node environment
if (typeof window === 'undefined') {
    const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
    if (fs.existsSync(workerPath)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs.GlobalWorkerOptions as any).workerSrc = workerPath;
    } else {
        console.warn(`[PDFService] Worker not found at ${workerPath}`);
    }
}

export class PDFService {
    /**
     * Extracts text from a PDF file located in the public/uploads directory.
     * 
     * @param relativePath The relative path to the file (e.g. "/uploads/file.pdf")
     * @returns The extracted text content
     * @throws Error if file not found or parsing fails
     */
    static async extractText(relativePath: string): Promise<string> {
        // Security: Ensure path is within public/uploads and prevent traversal
        const uploadDir = path.join(process.cwd(), "public", "uploads");

        // Handle both /uploads/filename and /api/files/filename
        let filename = relativePath.split('/').pop() || "";
        // Remove query params if any
        filename = filename.split('?')[0];

        const fullPath = path.join(uploadDir, filename);

        // Validate that fullPath starts with uploadDir (basic traversal check)
        if (!fullPath.startsWith(uploadDir)) {
            throw new Error("Invalid file path: Access denied.");
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${relativePath}`);
        }

        try {
            const dataBuffer = fs.readFileSync(fullPath);
            // Convert Buffer to Uint8Array for pdfjs
            const uint8Array = new Uint8Array(dataBuffer);

            // Load the document
            const loadingTask = pdfjs.getDocument({
                data: uint8Array,
                useSystemFonts: true // Sometimes helps with font rendering
            });

            const doc = await loadingTask.promise;
            let fullText = "";

            // Iterate over all pages
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const textContent = await page.getTextContent();

                const pageText = textContent.items
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((item: any) => 'str' in item)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((item: any) => item.str)
                    .join(" ");
                fullText += pageText + "\n";
            }

            // Clean up text (remove excessive newlines, etc.)
            const cleanText = fullText.replace(/\n\s*\n/g, '\n').trim();

            return cleanText;
        } catch (error) {
            console.error("[PDF_SERVICE_ERROR]", error);
            throw new Error("Failed to parse PDF file.");
        }
    }
}
