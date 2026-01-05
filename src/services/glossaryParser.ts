import Papa from 'papaparse';
import type { GlossaryEntry, TermIndex, ValidationResult } from '../types';

/**
 * Parse CSV file and extract glossary entries
 */
export async function parseCSV(file: File): Promise<GlossaryEntry[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                const entries: GlossaryEntry[] = results.data.map((row: any) => {
                    // Try to find English and Chinese columns regardless of exact naming
                    const englishKey = Object.keys(row).find(k =>
                        k.toLowerCase().includes('english') || k.toLowerCase().includes('term') || k.toLowerCase() === 'en'
                    ) || Object.keys(row)[0];

                    const chineseKey = Object.keys(row).find(k =>
                        k.toLowerCase().includes('chinese') || k.toLowerCase().includes('translation') || k.toLowerCase() === 'zh'
                    ) || Object.keys(row)[1];

                    return {
                        english: row[englishKey]?.trim() || '',
                        chinese: row[chineseKey]?.trim() || '',
                        source: row['source']?.trim() || file.name
                    };
                }).filter((e: GlossaryEntry) => e.english && e.chinese);

                resolve(entries);
            },
            error: (error: any) => {
                reject(new Error(`CSV parsing failed: ${error.message}`));
            }
        });
    });
}

/**
 * Validate glossary entries
 */
export function validateGlossary(entries: GlossaryEntry[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (entries.length === 0) {
        errors.push('No glossary entries found');
    }

    // Check for empty entries
    const emptyEntries = entries.filter(e => !e.english || !e.chinese);
    if (emptyEntries.length > 0) {
        warnings.push(`${emptyEntries.length} entries have missing English or Chinese translations`);
    }

    // Check for duplicates
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of entries) {
        const key = entry.english.toLowerCase();
        if (seen.has(key)) {
            duplicates.push(entry.english);
        }
        seen.add(key);
    }

    if (duplicates.length > 0) {
        warnings.push(`${duplicates.length} duplicate entries found: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Build fast lookup index for term matching
 */
export function buildTermIndex(entries: GlossaryEntry[]): TermIndex {
    const index: TermIndex = {};

    for (const entry of entries) {
        // Store both exact and lowercase versions
        index[entry.english] = entry;
        index[entry.english.toLowerCase()] = entry;
    }

    return index;
}

/**
 * Find matching glossary term (case-insensitive)
 */
export function findTerm(term: string, index: TermIndex): GlossaryEntry | undefined {
    return index[term] || index[term.toLowerCase()];
}

/**
 * Extract glossary statistics
 */
export function getGlossaryStats(entries: GlossaryEntry[]) {
    return {
        totalTerms: entries.length,
        uniqueTerms: new Set(entries.map(e => e.english.toLowerCase())).size,
        averageTermLength: Math.round(
            entries.reduce((sum, e) => sum + e.english.length, 0) / entries.length
        )
    };
}
