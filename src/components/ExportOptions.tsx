// Export Options Component
import { Download, FileText, File } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { TranslatedChunk } from '../types';
import { reassembleChunks } from '../services/chunkManager';

interface ExportOptionsProps {
    translatedChunks: TranslatedChunk[];
}

export default function ExportOptions({ translatedChunks }: ExportOptionsProps) {
    if (translatedChunks.length === 0) {
        return null;
    }

    const handleExportPDF = async () => {
        const doc = new jsPDF();
        const margin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        let y = 20;

        // Add title
        doc.setFontSize(18);
        doc.text('Technical Translation', margin, y);
        y += 10;

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y);
        y += 15;

        for (const chunk of translatedChunks) {
            // Check for page overflow
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            // Set chunk title
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Chunk ${chunk.position + 1}`, margin, y);
            y += 5;

            // Chunk type styling
            if (chunk.type === 'heading') {
                doc.setFontSize(14);
                doc.setTextColor(0);
                const lines = doc.splitTextToSize(chunk.translation, contentWidth);
                doc.text(lines, margin, y);
                y += (lines.length * 7) + 5;
            } else {
                doc.setFontSize(11);
                doc.setTextColor(50);
                const lines = doc.splitTextToSize(chunk.translation, contentWidth);
                doc.text(lines, margin, y);
                y += (lines.length * 6) + 8;
            }
        }

        doc.save(`translation_${Date.now()}.pdf`);
    };

    const handleExportText = (format: 'translation' | 'bilingual') => {
        let content = '';

        if (format === 'translation') {
            content = reassembleChunks(
                translatedChunks.map(chunk => ({ text: chunk.translation, type: chunk.type }))
            );
        } else {
            content = translatedChunks
                .map((chunk) => {
                    return `[Original]\n${chunk.text}\n\n[Translation]\n${chunk.translation}\n\n${'='.repeat(80)}\n`;
                })
                .join('\n');
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translation_${format}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportNewTerms = () => {
        // Collect all new terms
        const newTermsMap = new Map<string, { chinese: string; frequency: number; chunks: string[] }>();

        for (const chunk of translatedChunks) {
            for (const term of chunk.newTerms || []) {
                const existing = newTermsMap.get(term.english);
                if (existing) {
                    existing.frequency += term.frequency;
                    existing.chunks.push(...term.chunks);
                } else {
                    newTermsMap.set(term.english, {
                        chinese: term.chinese,
                        frequency: term.frequency,
                        chunks: [...term.chunks]
                    });
                }
            }
        }

        // Convert to CSV
        const csvLines = ['English,Chinese,Frequency,Chunks'];
        for (const [english, data] of newTermsMap.entries()) {
            csvLines.push(`"${english}","${data.chinese}",${data.frequency},"${data.chunks.join(';')}"`);
        }

        const csv = csvLines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `new_terms_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Options
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
                {/* PDF Export */}
                <button
                    onClick={handleExportPDF}
                    className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50/50 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-blue-600" />
                        <div className="text-left">
                            <p className="font-medium text-slate-800">Export as PDF</p>
                            <p className="text-xs text-slate-500">Formatted Chinese document</p>
                        </div>
                    </div>
                </button>

                {/* New Terms */}
                <button
                    onClick={handleExportNewTerms}
                    className="flex items-center justify-between p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <div className="text-left">
                            <p className="font-medium text-slate-800">New Terms (CSV)</p>
                            <p className="text-xs text-slate-500">Export discovered terminology</p>
                        </div>
                    </div>
                </button>

                {/* Translation Only */}
                <button
                    onClick={() => handleExportText('translation')}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-600" />
                        <div className="text-left">
                            <p className="font-medium text-slate-800">Plain Text (ZH)</p>
                            <p className="text-xs text-slate-500">Unformatted translation</p>
                        </div>
                    </div>
                </button>

                {/* Bilingual */}
                <button
                    onClick={() => handleExportText('bilingual')}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-600" />
                        <div className="text-left">
                            <p className="font-medium text-slate-800">Bilingual Text (EN/ZH)</p>
                            <p className="text-xs text-slate-500">Comparative side-by-side</p>
                        </div>
                    </div>
                </button>
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <span className="text-lg">💡</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Pro Tip:</strong> Re-import the "New Terms" CSV back into Standard Linguist later to refine your domain glossary.
                    This creates a virtuous cycle of terminology improvement!
                </p>
            </div>
        </div>
    );
}
