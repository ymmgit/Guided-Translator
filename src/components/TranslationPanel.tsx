// Translation Panel Component - Side by side view
import { useRef } from 'react';
import type { TranslatedChunk, TermMatch } from '../types';

interface TranslationPanelProps {
    chunks: TranslatedChunk[];
    onScroll?: (position: number) => void;
}

export default function TranslationPanel({ chunks, onScroll }: TranslationPanelProps) {
    const originalRef = useRef<HTMLDivElement>(null);
    const translatedRef = useRef<HTMLDivElement>(null);

    // Synchronized scrolling
    const handleScroll = (source: 'original' | 'translated') => (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;

        if (source === 'original' && translatedRef.current) {
            translatedRef.current.scrollTop = scrollTop;
        } else if (source === 'translated' && originalRef.current) {
            originalRef.current.scrollTop = scrollTop;
        }

        onScroll?.(scrollTop);
    };

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

    if (chunks.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-center text-gray-500">
                    Upload a glossary and document to begin translation
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-[700px]">
            <div className="grid grid-cols-2 border-b bg-gray-50 flex-none">
                <div className="p-3 border-r">
                    <h3 className="font-semibold text-gray-700">Original (English)</h3>
                </div>
                <div className="p-3">
                    <h3 className="font-semibold text-gray-700">Translation (Chinese)</h3>
                </div>
            </div>

            <div className="grid grid-cols-2 flex-grow overflow-hidden">
                {/* Original Text */}
                <div
                    ref={originalRef}
                    onScroll={handleScroll('original')}
                    className="overflow-y-auto p-6 border-r prose prose-sm max-w-none bg-slate-50/30"
                >
                    {chunks.map((chunk, index) => (
                        <div key={chunk.id} className="mb-6 pb-4 border-b border-gray-100 last:border-0">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-mono">Chunk {index + 1}</div>
                            <div
                                className={`${chunk.type === 'heading' ? 'font-bold text-lg text-slate-900' : 'text-slate-700'}`}
                                dangerouslySetInnerHTML={{
                                    __html: highlightTerms(chunk.text, chunk.matchedTerms, false)
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Translated Text */}
                <div
                    ref={translatedRef}
                    onScroll={handleScroll('translated')}
                    className="overflow-y-auto p-6 prose prose-sm max-w-none bg-white"
                >
                    {chunks.map((chunk, index) => (
                        <div key={chunk.id} className="mb-6 pb-4 border-b border-gray-100 last:border-0">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-mono">段落 {index + 1}</div>
                            <div
                                className={`${chunk.type === 'heading' ? 'font-bold text-lg text-slate-900' : 'text-slate-700'}`}
                                dangerouslySetInnerHTML={{
                                    __html: highlightTerms(chunk.translation, chunk.matchedTerms, true)
                                }}
                            />
                        </div>
                    ))}
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
