import { Sparkles, CheckCircle, Eye } from 'lucide-react';
import type { RefinementPattern, SimilarContext } from '../services/editAnalysisService';

interface RefinementSuggestionsProps {
    patterns: RefinementPattern[];
    appliedContexts: Map<string, SimilarContext[]>; // pattern description -> affected chunks
    onClose: () => void;
}

export default function RefinementSuggestions({
    patterns,
    appliedContexts,
    onClose,
}: RefinementSuggestionsProps) {
    const totalAffected = Array.from(appliedContexts.values()).reduce(
        (sum, contexts) => sum + contexts.length,
        0
    );

    if (patterns.length === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border border-purple-200">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">AI Analysis Complete</h3>
                        <p className="text-sm text-slate-600">
                            Detected {patterns.length} pattern{patterns.length > 1 ? 's' : ''},
                            applied to {totalAffected} chunk{totalAffected > 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Patterns List */}
            <div className="space-y-4">
                {patterns.map((pattern, index) => {
                    const contexts = appliedContexts.get(pattern.description) || [];
                    const isTerminology = pattern.type === 'terminology';

                    return (
                        <div
                            key={index}
                            className="bg-white rounded-lg p-4 border-l-4 border-purple-400 shadow-sm"
                        >
                            {/* Pattern Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                            {pattern.type.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            Confidence: {Math.round(pattern.confidence * 100)}%
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 font-medium">
                                        {pattern.description}
                                    </p>
                                </div>
                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            </div>

                            {/* Terminology Change Details */}
                            {isTerminology && pattern.oldTerm && pattern.newTerm && (
                                <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm text-slate-600 line-through">
                                        {pattern.oldTerm}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-sm text-emerald-600 font-medium">
                                        {pattern.newTerm}
                                    </span>
                                </div>
                            )}

                            {/* Applied Contexts */}
                            {contexts.length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                        <Eye className="w-3 h-3" />
                                        View {contexts.length} affected chunk{contexts.length > 1 ? 's' : ''}
                                    </summary>
                                    <div className="mt-2 space-y-2 pl-4">
                                        {contexts.slice(0, 5).map((context, i) => (
                                            <div
                                                key={i}
                                                className="text-xs p-2 bg-blue-50 rounded border border-blue-100"
                                            >
                                                <div className="text-blue-600 font-medium mb-1">
                                                    Chunk {context.chunkId} • Match: {Math.round(context.matchScore * 100)}%
                                                </div>
                                                <div className="text-slate-600 line-clamp-2">
                                                    {context.suggestedChange}
                                                </div>
                                            </div>
                                        ))}
                                        {contexts.length > 5 && (
                                            <p className="text-xs text-slate-500 italic">
                                                ...and {contexts.length - 5} more
                                            </p>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary Card */}
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-emerald-800 mb-1">
                        Changes Applied Successfully
                    </p>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                        Your terminology preferences have been learned and applied across the document.
                        They've also been added to your personal glossary for future translations.
                    </p>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={onClose}
                className="mt-4 w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md"
            >
                Continue Editing
            </button>
        </div>
    );
}
