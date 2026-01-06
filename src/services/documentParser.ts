// Document Parser Service
// Extract text from PDF documents using PDF.js

import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentStructure } from '../types';

// Set up PDF.js worker using unpkg for better reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Layout analysis thresholds
 */
interface LayoutThresholds {
    sameLine: number;
    newLine: number;
    paragraphBreak: number;
}

/**
 * Analyze document page to determine dynamic thresholds
 */
function analyzeDocumentLayout(textContent: any): LayoutThresholds {
    const verticalGaps: number[] = [];
    let lastY = -1;

    const items = textContent.items as any[];

    // Collect all vertical gaps
    for (const item of items) {
        // Skip empty strings
        if (!item.str.trim()) continue;

        const y = item.transform[5];
        if (lastY !== -1) {
            const gap = Math.abs(y - lastY);
            // Filter out 0 gaps (same visual line parts) and huge gaps
            if (gap > 0.1 && gap < 500) {
                verticalGaps.push(gap);
            }
        }
        lastY = y;
    }

    // Default fallbacks if page is empty or too simple
    if (verticalGaps.length < 5) {
        return { sameLine: 3, newLine: 15, paragraphBreak: 30 };
    }

    // Sort to find clustering
    verticalGaps.sort((a, b) => a - b);

    // Simple verification of distribution
    // Usually clusters around line-height (e.g. 12-14) and paragraph gap (e.g. 20-30)

    // We take percentiles to estimate
    const p20 = verticalGaps[Math.floor(verticalGaps.length * 0.2)];
    const p50 = verticalGaps[Math.floor(verticalGaps.length * 0.5)];
    const p80 = verticalGaps[Math.floor(verticalGaps.length * 0.8)];

    return {
        // Gap < sameLine = join words
        // Gap > sameLine && < paragraphBreak = new line in same paragraph (or list item)
        // Gap > paragraphBreak = new paragraph

        // p20 is likely line noise or same-line parts. p50 is likely the standard line height.
        sameLine: Math.max(p20 * 0.8, 2),
        newLine: Math.max(p50 * 1.5, 10),
        paragraphBreak: Math.max(p80 * 1.2, 25)
    };
}

/**
 * Calculate the dominant left margin to detect indentation
 */
function calculateLeftMargin(textContent: any): number {
    const items = textContent.items as any[];
    const xPositions: number[] = [];

    for (const item of items) {
        if (!item.str.trim()) continue;
        xPositions.push(item.transform[4]);
    }

    if (xPositions.length === 0) return 0;

    // Find the most frequent X position (allowing small variance)
    // Round to nearest 5 to group slightly misaligned items
    const counts = new Map<number, number>();
    let maxCount = 0;
    let dominantX = xPositions[0];

    for (const x of xPositions) {
        const bin = Math.round(x / 5) * 5;
        const count = (counts.get(bin) || 0) + 1;
        counts.set(bin, count);

        if (count > maxCount) {
            maxCount = count;
            dominantX = bin; // Use the bin representative
        } else if (count === maxCount && bin < dominantX) {
            // Prefer leftmost if counts are tied (standard margin)
            dominantX = bin;
        }
    }

    return dominantX;
}

/**
 * Extract standard title/code from text
 * Looks for patterns like "EN 13001-3-1", "ISO 9001", etc.
 */
export function extractStandardTitle(text: string, filename: string): string {
    // Look for common standard patterns in the first 1000 chars
    const headerText = text.substring(0, 1000);

    // Pattern for EN/ISO standards (e.g., EN 13001-3-1, ISO 9001:2015)
    // Matches: Word(2-4 chars) + space + Number + optional separators and numbers
    // e.g. "EN 12345", "ISO 9001", "IEC 60000-1-2"
    const standardRegex = /\b([A-Z]{2,4})\s+(\d{3,6}(?:[-:]\d+)*)/;
    const match = headerText.match(standardRegex);

    if (match) {
        return `${match[1]} ${match[2]}`;
    }

    // Fallback: use filename without extension
    return filename.replace(/\.[^/.]+$/, "");
}

/**
 * Extract full text from PDF file
 */
export async function extractText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');

        fullText += pageText + '\n\n';
    }

    return fullText;
}

/**
 * Extract structured content from PDF
 */

/**
 * Extract structured content from Markdown file
 */
export async function extractMarkdown(file: File): Promise<DocumentStructure> {
    const text = await file.text();
    const language = detectLanguage(text);
    // Simple word count for markdown (split by whitespace)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
        text: text.trim(),
        pages: Math.ceil(wordCount / 500) || 1, // Estimate pages based on word count (approx 500 words/page)
        wordCount,
        language
    };
}

/**
 * Extract structured content from File (PDF or Markdown)
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Convert PDF page to base64 image
 */
async function convertPageToImage(page: any): Promise<string> {
    const viewport = page.getViewport({ scale: 1.5 }); // Scale 1.5 for good balance of quality/size
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Convert to base64 (JPEG 0.8 quality)
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    return base64.split(',')[1]; // Remove prefix
}

/**
 * Extract text from image using Gemini API
 */
async function extractTextWithGemini(imageBase64: string, apiKey: string): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use flash model for speed and cost effectiveness
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Transcribe this technical document page into clean Markdown. Preserve all headers, tables, lists, and structure. Do not summarize. Return only the markdown content.";

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Vision Extraction Failed:", error);
        throw new Error("AI Visual Extraction failed. Please check your API key or try again.");
    }
}

/**
 * Extract structured content from File (PDF or Markdown)
 */
export async function extractStructuredContent(
    file: File,
    apiKey?: string | ((current: number, total: number) => void),
    onProgress?: (current: number, total: number) => void
): Promise<DocumentStructure> {

    // Handle overload signature compatibility
    let key: string | undefined = undefined;
    let progressCallback = onProgress;

    if (typeof apiKey === 'function') {
        progressCallback = apiKey;
    } else if (typeof apiKey === 'string') {
        key = apiKey;
    }

    // Handle Markdown files
    if (file.name.endsWith('.md') || file.type === 'text/markdown') {
        if (progressCallback) progressCallback(1, 1);
        return extractMarkdown(file);
    }

    // Handle PDF files
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    // If API key is present, use Visual AI Parsing
    if (key) {
        console.log("Using Gemini Visual Parsing...");
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);

            // Render page to image
            const imageBase64 = await convertPageToImage(page);

            // Extract text with Gemini
            const pageMarkdown = await extractTextWithGemini(imageBase64, key);

            fullText += pageMarkdown + '\n\n';

            if (progressCallback) {
                progressCallback(i, pdf.numPages);
            }

            // Rate limiting safety: wait a bit between standard requests if needed, 
            // though 1.5-flash has high RPB. 
            // Simple delay to be safe.
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } else {
        // Fallback to Rule-Based Extraction (Legacy)
        console.log("Using Legacy PDF.js Parsing (No API Key provided to parser)...");
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Calculate adaptive thresholds for this page
            const thresholds = analyzeDocumentLayout(textContent);
            const leftMargin = calculateLeftMargin(textContent);

            // Smart text extraction with position-based line merging
            let lastY = -1;
            let lastX = 0;
            let lastWidth = 0;
            let currentLine = '';
            let currentIndent = 0;
            const lines: string[] = [];
            const rawItems = textContent.items as any[];

            for (let j = 0; j < rawItems.length; j++) {
                const item = rawItems[j];
                const text = item.str;

                if (!text.trim()) continue;

                const y = item.transform[5];
                const x = item.transform[4];
                const height = item.height || 12;
                const isHeading = height > 12;
                const relativeX = Math.max(0, x - leftMargin);
                const indentLevel = Math.floor(relativeX / 20);

                if (lastY === -1) {
                    currentLine = text;
                    currentIndent = indentLevel;
                    lastY = y;
                    lastX = x;
                    lastWidth = height > 0 ? (item.width || text.length * 6) : 0;
                } else {
                    const verticalGap = Math.abs(y - lastY);

                    if (verticalGap < thresholds.sameLine) {
                        const textWidth = item.width || (text.length * 6);
                        const currentX = item.transform[4];
                        const gapX = currentX - (lastX + lastWidth);

                        if (currentLine && !currentLine.endsWith('-') && !text.startsWith(' ')) {
                            if (gapX > 30) {
                                currentLine += ' | ' + text;
                            } else {
                                currentLine += ' ' + text;
                            }
                        } else if (currentLine.endsWith('-')) {
                            if (text[0] && text[0] === text[0].toLowerCase()) {
                                currentLine = currentLine.slice(0, -1) + text;
                            } else {
                                currentLine += text;
                            }
                        } else {
                            currentLine += text;
                        }

                        lastX = currentX;
                        lastWidth = textWidth;
                    } else {
                        if (currentLine.trim()) {
                            const indentString = currentIndent > 0 ? '  '.repeat(currentIndent) : '';
                            const formattedLine = isHeading ? `## ${currentLine}` : `${indentString}${currentLine}`;
                            lines.push(formattedLine);
                        }
                        if (verticalGap > thresholds.paragraphBreak) {
                            lines.push('');
                        }
                        currentLine = text;
                        currentIndent = indentLevel;
                        lastY = y;
                        lastX = x;
                        lastWidth = item.width || (text.length * 6);
                    }
                }
            }

            if (currentLine.trim()) {
                const indentString = currentIndent > 0 ? '  '.repeat(currentIndent) : '';
                lines.push(indentString + currentLine);
            }

            fullText += lines.join('\n') + '\n\n';

            if (progressCallback) {
                progressCallback(i, pdf.numPages);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    const language = detectLanguage(fullText);
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

    return {
        text: fullText.trim(),
        pages: pdf.numPages,
        wordCount,
        language
    };
}

/**
 * Detect document language
 */
export function detectLanguage(text: string): 'en' | 'zh' | 'unknown' {
    const sample = text.slice(0, 1000);

    // Count Chinese characters
    const chineseChars = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;

    // Count English words
    const englishWords = (sample.match(/[a-zA-Z]+/g) || []).length;

    if (chineseChars > englishWords) {
        return 'zh';
    } else if (englishWords > chineseChars * 2) {
        return 'en';
    }

    return 'unknown';
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(wordCount: number): number {
    const wordsPerMinute = 200;
    return Math.ceil(wordCount / wordsPerMinute);
}
