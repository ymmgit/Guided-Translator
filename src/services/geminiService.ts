// Gemini Service
// Handle all Gemini API interactions for translation

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { GlossaryEntry, TermMatch, TranslatedChunk, Chunk } from '../types';

const API_KEY = import.meta.env.VITE_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Find relevant glossary terms that appear in the text
 */
function findRelevantTerms(text: string, glossary: GlossaryEntry[]): GlossaryEntry[] {
    const textLower = text.toLowerCase();
    return glossary.filter(entry => {
        const termLower = entry.english.toLowerCase();
        // Use word boundary check for better accuracy
        const regex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(textLower);
    });
}

/**
 * Translate a chunk with glossary constraints
 */
export async function translateChunk(
    chunk: Chunk,
    glossary: GlossaryEntry[]
): Promise<TranslatedChunk> {
    const relevantTerms = findRelevantTerms(chunk.text, glossary);
    const prompt = generatePrompt(chunk.text, relevantTerms);

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
            temperature: 0.1, // Fixed low temperature for consistency
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    });

    try {
        const result = await model.generateContent(prompt);
        const translation = result.response.text().trim();

        // Identify matched terms in the source text
        const matchedTerms = identifyTermsInText(chunk.text, glossary);

        // TODO: Detect deviations where LLM failed to use glossary
        // (This would require checking the translation against the glossary)

        return {
            ...chunk,
            translation,
            matchedTerms,
            newTerms: [] // New terms discovery would happen in a separate pass or LLM request
        };
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error(`Failed to translate chunk ${chunk.id}: ${error}`);
    }
}

/**
 * Generate translation prompt with glossary
 */
function generatePrompt(text: string, relevantTerms: GlossaryEntry[]): string {
    const glossaryText = relevantTerms.length > 0
        ? relevantTerms.map(entry => `| ${entry.english} | ${entry.chinese} |`).join('\n')
        : "None applicable for this chunk.";

    return `You are a professional technical translator specializing in technical standards. 
Your task is to translate the following English text to Chinese.

CONTEXT:
This text is a segment from a technical standard. A glossary from a related standard is provided below to ensure consistency.

GLOSSARY OF TERMS TO BE USED:
| English Term | Mandated Chinese Translation |
| :--- | :--- |
${glossaryText}

TRANSLATION RULES:
1. MANDATORY: Use the exact Chinese translations provided in the GLOSSARY for all matching English terms.
2. For terms NOT in the glossary, translate naturally using standard technical Chinese terminology.
3. PRESERVE STRUCTURE: Maintain all headings, list formats, numbering, and special characters.
4. TONALITY: Use formal, objective, and precise technical language.
5. NO COMMENTARY: Provide ONLY the translation. Do not include any notes, explanations, or "Here is the translation".

TEXT TO TRANSLATE:
${text}

FINAL CHINESE TRANSLATION:`;
}

/**
 * Identify glossary terms in text using word boundaries
 */
export function identifyTermsInText(
    text: string,
    glossary: GlossaryEntry[]
): TermMatch[] {
    const matches: TermMatch[] = [];
    const textLower = text.toLowerCase();

    // Sort glossary by length descending to match longest terms first
    const sortedGlossary = [...glossary].sort((a, b) => b.english.length - a.english.length);

    for (const entry of sortedGlossary) {
        const termLower = entry.english.toLowerCase();
        const escapedTerm = termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');

        let match;
        const positions: number[] = [];

        while ((match = regex.exec(textLower)) !== null) {
            positions.push(match.index);
        }

        if (positions.length > 0) {
            matches.push({
                english: entry.english,
                chinese: entry.chinese,
                positions,
                source: 'glossary'
            });
        }
    }

    return matches;
}

/**
 * Batch translate multiple chunks with progress tracking
 */
export async function translateChunks(
    chunks: Chunk[],
    glossary: GlossaryEntry[],
    onProgress?: (current: number, total: number) => void
): Promise<TranslatedChunk[]> {
    const translatedChunks: TranslatedChunk[] = [];

    // Parallel processing with limited concurrency (optional, for now serial with rate limit)
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
            const translatedChunk = await translateChunk(chunk, glossary);
            translatedChunks.push(translatedChunk);

            if (onProgress) {
                onProgress(i + 1, chunks.length);
            }

            // Rate limiting for free tier Gemini API
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay slightly
            }
        } catch (error) {
            console.error(`Failed to translate chunk ${i}:`, error);
            translatedChunks.push({
                ...chunk,
                translation: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
                matchedTerms: [],
                newTerms: []
            });
        }
    }

    return translatedChunks;
}

/**
 * Calculate glossary coverage statistics
 */
export function calculateCoverage(
    translatedChunks: TranslatedChunk[],
    glossary: GlossaryEntry[]
): { matched: number; total: number; percentage: number } {
    const matchedTermSet = new Set<string>();

    for (const chunk of translatedChunks) {
        for (const match of chunk.matchedTerms) {
            matchedTermSet.add(match.english.toLowerCase());
        }
    }

    const matched = matchedTermSet.size;
    const total = glossary.length;
    const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { matched, total, percentage };
}
