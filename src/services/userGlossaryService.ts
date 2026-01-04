// User Glossary Service
// Manage user-specific terminology preferences learned from edits

import type { GlossaryEntry } from '../types';

export interface UserGlossaryEntry {
    english: string;
    originalChinese: string;  // From base glossary or LLM
    preferredChinese: string; // User's correction
    frequency: number;         // How many times this preference was applied
    firstSeenChunk: number;    // Where it was first corrected
    confidence: 'high' | 'medium' | 'low';
    contexts: string[];        // Sample contexts where it appears
}

const USER_GLOSSARY_KEY = 'guided_translator_user_glossary';

/**
 * Add or update a user preference in the glossary
 */
export function addUserPreference(
    english: string,
    oldChinese: string,
    newChinese: string,
    chunkPosition: number,
    context: string
): void {
    const glossary = getUserGlossary();

    const existingIndex = glossary.findIndex(
        entry => entry.english.toLowerCase() === english.toLowerCase()
    );

    if (existingIndex !== -1) {
        // Update existing entry
        glossary[existingIndex].preferredChinese = newChinese;
        glossary[existingIndex].frequency += 1;
        glossary[existingIndex].confidence = calculateConfidence(glossary[existingIndex].frequency);
        if (!glossary[existingIndex].contexts.includes(context)) {
            glossary[existingIndex].contexts.push(context);
        }
    } else {
        // Add new entry
        glossary.push({
            english,
            originalChinese: oldChinese,
            preferredChinese: newChinese,
            frequency: 1,
            firstSeenChunk: chunkPosition,
            confidence: 'low',
            contexts: [context],
        });
    }

    saveUserGlossary(glossary);
}

/**
 * Get the current user glossary from localStorage
 */
export function getUserGlossary(): UserGlossaryEntry[] {
    try {
        const stored = localStorage.getItem(USER_GLOSSARY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading user glossary:', error);
        return [];
    }
}

/**
 * Save user glossary to localStorage
 */
function saveUserGlossary(glossary: UserGlossaryEntry[]): void {
    try {
        localStorage.setItem(USER_GLOSSARY_KEY, JSON.stringify(glossary));
    } catch (error) {
        console.error('Error saving user glossary:', error);
    }
}

/**
 * Export user glossary as CSV (Standard Linguist format)
 */
export function exportUserGlossary(): string {
    const glossary = getUserGlossary();
    const csvLines = ['English,Chinese,Source,Frequency,Confidence'];

    for (const entry of glossary) {
        csvLines.push(
            `"${entry.english}","${entry.preferredChinese}","User Edit",${entry.frequency},${entry.confidence}`
        );
    }

    return csvLines.join('\n');
}

/**
 * Merge base glossary with user preferences
 * User preferences override base glossary
 */
export function mergeWithBaseGlossary(
    baseGlossary: GlossaryEntry[],
    userGlossary: UserGlossaryEntry[]
): GlossaryEntry[] {
    const merged = [...baseGlossary];
    const userMap = new Map(
        userGlossary.map(entry => [entry.english.toLowerCase(), entry.preferredChinese])
    );

    // Override base glossary with user preferences
    for (let i = 0; i < merged.length; i++) {
        const userPreference = userMap.get(merged[i].english.toLowerCase());
        if (userPreference) {
            merged[i] = {
                ...merged[i],
                chinese: userPreference,
                source: merged[i].source ? `${merged[i].source} (User Modified)` : 'User Modified',
            };
        }
    }

    // Add new user terms not in base glossary
    for (const userEntry of userGlossary) {
        const existsInBase = merged.some(
            entry => entry.english.toLowerCase() === userEntry.english.toLowerCase()
        );
        if (!existsInBase) {
            merged.push({
                english: userEntry.english,
                chinese: userEntry.preferredChinese,
                source: 'User Added',
            });
        }
    }

    return merged;
}

/**
 * Clear user glossary (for new document/session)
 */
export function clearUserGlossary(): void {
    localStorage.removeItem(USER_GLOSSARY_KEY);
}

/**
 * Calculate confidence based on frequency
 */
function calculateConfidence(frequency: number): 'high' | 'medium' | 'low' {
    if (frequency >= 5) return 'high';
    if (frequency >= 2) return 'medium';
    return 'low';
}

/**
 * Download user glossary as CSV file
 */
export function downloadUserGlossary(): void {
    const csv = exportUserGlossary();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_glossary_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

