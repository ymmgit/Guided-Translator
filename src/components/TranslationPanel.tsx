// Translation Panel Component - Side by side view
// Translation Panel Component - Side by side view
import type { TranslatedChunk, TermMatch } from '../types';

interface TranslationPanelProps {
    chunks: TranslatedChunk[];
    onScroll?: (position: number) => void;
    isTranslating?: boolean;
}

export default function TranslationPanel({ chunks, isTranslating = false }: TranslationPanelProps) {
    /**
     * Escape HTML special characters
     */
    const escapeHtml = (text: string) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Highlight terms in text
     */
    const highlightTerms = (text: string, matches: TermMatch[], isTranslation: boolean = false) => {
        if (matches.length === 0) return escapeHtml(text);

        const escapedText = escapeHtml(text);
        let result = escapedText;

        // For translation, we need to match the Chinese terms
        const termsToHighlight = isTranslation
            ? matches.map(m => ({ term: m.chinese, tooltip: m.english, type: m.source }))
            : matches.map(m => ({ term: m.english, tooltip: m.chinese, type: m.source }));

        // Sort by length descending to avoid partial matches inside longer matches
        const sortedTerms = [...new Set(termsToHighlight)].sort((a, b) => b.term.length - a.term.length);

        for (const item of sortedTerms) {
            const escapedTerm = escapeHtml(item.term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedTerm, 'g');

            const colorClass = item.type === 'glossary' ? 'term-match-glossary' : 'term-match-new';

            // Use a temporary placeholder to avoid double-highlighting
            result = result.replace(regex, `<mark class="term-match ${colorClass}" title="${escapeHtml(item.tooltip)}">${item.term}</mark>`);
        }

        return result;
    };

    if (chunks.length === 0 && !isTranslating) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-center text-gray-500">
                    Upload a glossary and document to begin translation
                </p>
            </div>
        );
    }

    // Initial Loading State (Before any chunks generated)
    if (chunks.length === 0 && isTranslating) {
        return (
            <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-[700px]">
                <div className="border-b bg-gray-50 p-4 flex-none grid grid-cols-2 gap-6">
                    <h3 className="font-semibold text-gray-700">Original (English)</h3>
                    <h3 className="font-semibold text-gray-700">Translation (Chinese)</h3>
                </div>
                <div className="flex-grow flex items-center justify-center bg-slate-50/30">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <h3 className="text-lg font-medium text-slate-800">Initializing Translation Engine</h3>
                        <p className="text-slate-500">Preparing terminology and context...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-[700px]">
            <div className="border-b bg-gray-50 p-4 flex-none grid grid-cols-2 gap-6">
                <h3 className="font-semibold text-gray-700">Original (English)</h3>
                <h3 className="font-semibold text-gray-700">Translation (Chinese)</h3>
            </div>

            <div className="flex-grow overflow-y-auto p-6 bg-slate-50/30">
                <div className="space-y-4">
                    {chunks.map((chunk, index) => (
                        <div key={chunk.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col md:grid md:grid-cols-2">
                            {/* Original Text */}
                            <div className="p-4 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-mono">Chunk {index + 1}</div>
                                <div
                                    className={`${chunk.type === 'heading' ? 'font-bold text-lg text-slate-900' : 'text-slate-700'} leading-relaxed`}
                                    dangerouslySetInnerHTML={{
                                        __html: highlightTerms(chunk.text, chunk.matchedTerms, false)
                                    }}
                                />
                            </div>

                            {/* Translated Text */}
                            <div className="p-4 bg-white">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-mono md:text-right">段落 {index + 1}</div>
                                <div
                                    className={`${chunk.type === 'heading' ? 'font-bold text-lg text-slate-900' : 'text-slate-700'} leading-relaxed`}
                                    dangerouslySetInnerHTML={{
                                        __html: highlightTerms(chunk.translation, chunk.matchedTerms, true)
                                    }}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Skeleton Loader - Appears at bottom when translating */}
                    {isTranslating && (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col md:grid md:grid-cols-2 animate-pulse">
                            <div className="p-4 border-r border-slate-100 bg-slate-50/50">
                                <div className="h-3 w-16 bg-slate-200 rounded mb-4"></div>
                                <div className="h-4 w-full bg-slate-200 rounded mb-2"></div>
                                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2"></div>
                                <div className="h-4 w-5/6 bg-slate-200 rounded"></div>
                            </div>
                            <div className="p-4 bg-white">
                                <div className="flex justify-end mb-4">
                                    <div className="h-3 w-16 bg-slate-200 rounded"></div>
                                </div>
                                <div className="h-4 w-full bg-slate-200 rounded mb-2"></div>
                                <div className="h-4 w-5/6 bg-slate-200 rounded mb-2"></div>
                                <div className="h-4 w-4/6 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="border-t bg-gray-50 p-4 flex gap-6 text-sm flex-none">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-400"></span>
                    <span className="text-slate-600 font-medium">Glossary Matched</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-sky-400"></span>
                    <span className="text-slate-600 font-medium">Auto-Translated</span>
                </div>
                <div className="ml-auto text-xs text-slate-400 italic">
                    Hover over highlighted terms to see the source/translation
                </div>
            </div>
        </div>
    );
}
