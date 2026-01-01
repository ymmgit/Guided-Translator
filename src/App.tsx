import { useState } from 'react';
import { BookOpen, Languages, Edit3 } from 'lucide-react';
import GlossaryUpload from './components/GlossaryUpload';
import DocumentUpload from './components/DocumentUpload';
import TranslationPanel from './components/TranslationPanel';
import ProgressTracker from './components/ProgressTracker';
import ExportOptions from './components/ExportOptions';
import EditingInterface from './components/EditingInterface';
import RefinementSuggestions from './components/RefinementSuggestions';
import UserGlossaryPanel from './components/UserGlossaryPanel';
import type { GlossaryEntry, DocumentStructure, Chunk, TranslatedChunk, AppStatus, TranslationProgress } from './types';
import { splitIntoChunks } from './services/chunkManager';
import { translateChunks, calculateCoverage } from './services/geminiService';
import { analyzeEdit, findSimilarContexts, applyRefinementPattern, type RefinementPattern, type SimilarContext, type EditDiff } from './services/editAnalysisService';
import { addUserPreference } from './services/userGlossaryService';

import './App.css';

function App() {
    const [glossary, setGlossary] = useState<GlossaryEntry[] | null>(null);
    const [document, setDocument] = useState<DocumentStructure | null>(null);
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [translatedChunks, setTranslatedChunks] = useState<TranslatedChunk[]>([]);
    const [status, setStatus] = useState<AppStatus>('idle');
    const [progress, setProgress] = useState<TranslationProgress>({
        current: 0,
        total: 0,
        percentage: 0,
        estimatedTimeRemaining: 0,
        glossaryCoverage: { matched: 0, total: 0 }
    });

    // Edit & Refine state
    const [editMode, setEditMode] = useState(false);
    const [currentEditPage, setCurrentEditPage] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [refinementPatterns, setRefinementPatterns] = useState<RefinementPattern[]>([]);
    const [appliedContexts, setAppliedContexts] = useState<Map<string, SimilarContext[]>>(new Map());
    const [showRefinementSummary, setShowRefinementSummary] = useState(false);

    const handleGlossaryLoaded = (entries: GlossaryEntry[]) => {
        setGlossary(entries);
    };

    const handleDocumentLoaded = (doc: DocumentStructure) => {
        setDocument(doc);

        // Automatically chunk the document
        const documentChunks = splitIntoChunks(doc.text);
        setChunks(documentChunks);
    };

    const handleStartTranslation = async () => {
        if (!glossary || !document || chunks.length === 0) {
            alert('Please upload both a glossary and a document first');
            return;
        }

        setStatus('translating');
        setTranslatedChunks([]);

        const startTime = Date.now();

        try {
            const translated = await translateChunks(
                chunks,
                glossary,
                (current, total) => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const rate = current / elapsed;
                    const remaining = Math.max(0, Math.round((total - current) / rate));

                    setProgress({
                        current,
                        total,
                        percentage: Math.round((current / total) * 100),
                        estimatedTimeRemaining: remaining,
                        glossaryCoverage: {
                            matched: 0,
                            total: glossary.length
                        }
                    });
                }
            );

            setTranslatedChunks(translated);

            // Calculate final coverage
            const coverage = calculateCoverage(translated, glossary);
            setProgress(prev => ({
                ...prev,
                glossaryCoverage: coverage
            }));

            setStatus('complete');
        } catch (error) {
            console.error('Translation failed:', error);
            setStatus('error');
            alert('Translation failed. Please check your API key and try again.');
        }
    };

    const CHUNKS_PER_PAGE = 4;
    const totalEditPages = Math.ceil(translatedChunks.length / CHUNKS_PER_PAGE);

    const getEditingChunks = (page: number): TranslatedChunk[] => {
        const start = page * CHUNKS_PER_PAGE;
        const end = start + CHUNKS_PER_PAGE;
        return translatedChunks.slice(start, end);
    };

    const handleEditSubmit = async (editedChunks: TranslatedChunk[]) => {
        setIsAnalyzing(true);
        const patterns: RefinementPattern[] = [];
        const contextsMap = new Map<string, SimilarContext[]>();

        try {
            // Analyze each edited chunk
            for (let i = 0; i < editedChunks.length; i++) {
                const originalChunk = getEditingChunks(currentEditPage)[i];
                const editedChunk = editedChunks[i];

                if (originalChunk.translation !== editedChunk.translation) {
                    const diff: EditDiff = {
                        chunkId: editedChunk.id,
                        originalTranslation: originalChunk.translation,
                        editedTranslation: editedChunk.translation,
                        englishContext: editedChunk.text,
                    };

                    const detectedPatterns = await analyzeEdit(diff);
                    patterns.push(...detectedPatterns);

                    // Find and apply patterns
                    for (const pattern of detectedPatterns) {
                        if (pattern.type === 'terminology' && pattern.oldTerm && pattern.newTerm) {
                            const similarContexts = findSimilarContexts(
                                pattern,
                                translatedChunks,
                                editedChunk.id
                            );

                            contextsMap.set(pattern.description, similarContexts);

                            // Add to user glossary
                            addUserPreference(
                                '', // English term would be inferred from context
                                pattern.oldTerm,
                                pattern.newTerm,
                                editedChunk.position,
                                editedChunk.text.substring(0, 100)
                            );
                        }
                    }
                }
            }

            // Apply all patterns to translated chunks
            let updatedChunks = [...translatedChunks];
            for (const pattern of patterns) {
                const contexts = contextsMap.get(pattern.description) || [];
                updatedChunks = applyRefinementPattern(pattern, contexts, updatedChunks);
            }

            // Update the current page chunks with edits
            const start = currentEditPage * CHUNKS_PER_PAGE;
            for (let i = 0; i < editedChunks.length; i++) {
                updatedChunks[start + i] = editedChunks[i];
            }

            setTranslatedChunks(updatedChunks);
            setRefinementPatterns(patterns);
            setAppliedContexts(contextsMap);
            setShowRefinementSummary(patterns.length > 0);
        } catch (error) {
            console.error('Error analyzing edits:', error);
            alert('Failed to analyze edits. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const canTranslate = glossary && glossary.length > 0 && document && chunks.length > 0;
    const isTranslating = status === 'translating';
    const isComplete = status === 'complete';

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Languages className="w-8 h-8 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Guided Translator</h1>
                            <p className="text-sm text-gray-600">Glossary-aware technical translation</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Setup Section */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <GlossaryUpload
                        onGlossaryLoaded={handleGlossaryLoaded}
                        currentGlossary={glossary}
                    />
                    <DocumentUpload
                        onDocumentLoaded={handleDocumentLoaded}
                        currentDocument={document}
                    />
                </div>

                {/* Translation Control */}
                {canTranslate && !isComplete && (
                    <div className="mb-8">
                        <button
                            onClick={handleStartTranslation}
                            disabled={isTranslating}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <BookOpen className="w-5 h-5" />
                            {isTranslating ? 'Translating...' : `Start Translation (${chunks.length} chunks)`}
                        </button>
                        {chunks.length > 0 && (
                            <p className="text-center text-sm text-gray-600 mt-2">
                                Estimated time: ~{Math.ceil(chunks.length / 60)} minute{chunks.length > 60 ? 's' : ''}
                            </p>
                        )}
                    </div>
                )}

                {/* Progress Tracker */}
                {(isTranslating || isComplete) && (
                    <div className="mb-8">
                        <ProgressTracker progress={progress} isTranslating={isTranslating} />
                    </div>
                )}

                {/* Translation Panel */}
                {translatedChunks.length > 0 && (
                    <div className="mb-8">
                        <TranslationPanel chunks={translatedChunks} />
                    </div>
                )}

                {/* Edit & Refine Button */}
                {isComplete && translatedChunks.length > 0 && !editMode && (
                    <div className="mb-8">
                        <button
                            onClick={() => setEditMode(true)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit3 className="w-5 h-5" />
                            Enter Edit & Refine Mode
                        </button>
                    </div>
                )}

                {/* Edit Mode Interface */}
                {editMode && (
                    <>
                        <div className="mb-8">
                            <EditingInterface
                                chunks={getEditingChunks(currentEditPage)}
                                allChunks={translatedChunks}
                                currentPage={currentEditPage}
                                totalPages={totalEditPages}
                                onSubmit={handleEditSubmit}
                                onNavigate={setCurrentEditPage}
                                isAnalyzing={isAnalyzing}
                            />
                        </div>

                        {showRefinementSummary && (
                            <div className="mb-8">
                                <RefinementSuggestions
                                    patterns={refinementPatterns}
                                    appliedContexts={appliedContexts}
                                    onClose={() => setShowRefinementSummary(false)}
                                />
                            </div>
                        )}

                        <div className="mb-8">
                            <UserGlossaryPanel />
                        </div>

                        <div className="mb-8">
                            <button
                                onClick={() => setEditMode(false)}
                                className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
                            >
                                Exit Edit Mode
                            </button>
                        </div>
                    </>
                )}

                {/* Export Options */}
                {isComplete && translatedChunks.length > 0 && !editMode && (
                    <ExportOptions
                        translatedChunks={translatedChunks}
                    />
                )}

                {/* Instructions */}
                {!canTranslate && (
                    <div className="bg-white rounded-lg shadow-md p-8 text-center">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">Getting Started</h2>
                        <ol className="text-left max-w-md mx-auto space-y-2 text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-blue-600">1.</span>
                                <span>Upload a glossary CSV file (from Standard Linguist or similar)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-blue-600">2.</span>
                                <span>Upload an English PDF document to translate</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-blue-600">3.</span>
                                <span>Click "Start Translation" to begin</span>
                            </li>
                        </ol>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t mt-16">
                <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-500">
                    Powered by Gemini 2.0 • Built with React + TypeScript
                </div>
            </footer>
        </div>
    );
}

export default App;
