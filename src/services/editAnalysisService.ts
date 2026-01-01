// Edit Analysis Service
// Analyze user edits and detect refinement patterns using LLM

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranslatedChunk } from '../types';

const API_KEY = import.meta.env.VITE_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface EditDiff {
    chunkId: string;
    originalTranslation: string;
    editedTranslation: string;
    englishContext: string;
}

export interface RefinementPattern {
    type: 'terminology' | 'style' | 'structure';
    description: string;
    oldTerm?: string;
    newTerm?: string;
    contextKeywords?: string[];
    confidence: number;
}

export interface SimilarContext {
    chunkId: string;
    text: string;
    matchScore: number;
    suggestedChange: string;
}

/**
 * Analyze a user edit to extract refinement patterns
 */
export async function analyzeEdit(diff: EditDiff): Promise<RefinementPattern[]> {
    const prompt = `You are analyzing a translation edit made by a professional translator.

ORIGINAL TRANSLATION:
${diff.originalTranslation}

EDITED TRANSLATION:
${diff.editedTranslation}

ENGLISH SOURCE (for context):
${diff.englishContext}

Analyze the changes and identify refinement patterns. Focus on:
1. TERMINOLOGY changes (e.g., "设备" → "装置")
2. STYLISTIC improvements (e.g., formal tone adjustments)
3. STRUCTURAL changes (e.g., sentence reordering)

For each pattern found, output in this JSON format:
{
  "patterns": [
    {
      "type": "terminology",
      "description": "Changed '设备' to '装置' for equipment",
      "oldTerm": "设备",
      "newTerm": "装置",
      "contextKeywords": ["technical", "machinery"],
      "confidence": 0.95
    }
  ]
}

Return ONLY the JSON, no other text.`;

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);
        return parsed.patterns || [];
    } catch (error) {
        console.error('Error analyzing edit:', error);
        return [];
    }
}

/**
 * Find chunks with similar contexts where a pattern might apply
 */
export function findSimilarContexts(
    pattern: RefinementPattern,
    targetChunks: TranslatedChunk[],
    sourceChunkId: string
): SimilarContext[] {
    if (pattern.type !== 'terminology' || !pattern.oldTerm || !pattern.newTerm) {
        return [];
    }

    const results: SimilarContext[] = [];
    const oldTerm = pattern.oldTerm;
    const newTerm = pattern.newTerm;

    for (const chunk of targetChunks) {
        // Skip the source chunk
        if (chunk.id === sourceChunkId) continue;

        // Check if the old term appears in the translation
        if (chunk.translation.includes(oldTerm)) {
            const suggestedChange = chunk.translation.replace(
                new RegExp(oldTerm, 'g'),
                newTerm
            );

            // Calculate a simple match score based on context keywords
            let matchScore = 0.7; // Base score
            if (pattern.contextKeywords) {
                const contextText = chunk.text.toLowerCase();
                const keywordMatches = pattern.contextKeywords.filter(kw =>
                    contextText.includes(kw.toLowerCase())
                ).length;
                matchScore += (keywordMatches / pattern.contextKeywords.length) * 0.3;
            }

            results.push({
                chunkId: chunk.id,
                text: chunk.translation,
                matchScore,
                suggestedChange,
            });
        }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Apply refinement pattern to target chunks
 */
export function applyRefinementPattern(
    _pattern: RefinementPattern,
    similarContexts: SimilarContext[],
    chunks: TranslatedChunk[]
): TranslatedChunk[] {
    const updatedChunks = [...chunks];

    for (const context of similarContexts) {
        const chunkIndex = updatedChunks.findIndex(c => c.id === context.chunkId);
        if (chunkIndex !== -1) {
            updatedChunks[chunkIndex] = {
                ...updatedChunks[chunkIndex],
                translation: context.suggestedChange,
            };
        }
    }

    return updatedChunks;
}

/**
 * Extract terminology changes from patterns for glossary update
 */
export function extractTerminologyChanges(patterns: RefinementPattern[]): Array<{
    english: string;
    oldChinese: string;
    newChinese: string;
}> {
    return patterns
        .filter(_p => _p.type === 'terminology' && _p.oldTerm && _p.newTerm)
        .map(_p => ({
            english: '', // Will be inferred from context in the calling code
            oldChinese: _p.oldTerm!,
            newChinese: _p.newTerm!,
        }));
}
