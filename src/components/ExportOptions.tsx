// Export Options Component
import { useState } from 'react';
import { Download, FileText, File, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import type { TranslatedChunk } from '../types';
import { reassembleChunks } from '../services/chunkManager';

interface ExportOptionsProps {
    translatedChunks: TranslatedChunk[];
}

export default function ExportOptions({ translatedChunks }: ExportOptionsProps) {
    if (translatedChunks.length === 0) {
        return null;
    }

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const handleExportPDF = async () => {
        setIsExporting(true);
        setExportProgress(0);

        try {
            // Dynamically import html2canvas to avoid SSR issues if any
            const html2canvas = (await import('html2canvas')).default;

            // Create a temporary container for rendering
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '210mm'; // A4 width
            container.style.backgroundColor = '#ffffff';
            container.style.padding = '20mm';
            container.style.fontFamily = 'Arial, sans-serif'; // Use system fonts that support unicode
            container.id = 'pdf-render-container';
            document.body.appendChild(container);

            // Render content into container
            const title = document.createElement('h1');
            title.textContent = 'Technical Translation';
            title.style.fontSize = '24px';
            title.style.marginBottom = '20px';
            title.style.color = '#1e293b';
            container.appendChild(title);

            const meta = document.createElement('p');
            meta.textContent = `Generated on ${new Date().toLocaleString()}`;
            meta.style.fontSize = '12px';
            meta.style.color = '#64748b';
            meta.style.marginBottom = '30px';
            container.appendChild(meta);

            const chunkContainer = document.createElement('div');
            chunkContainer.style.display = 'flex';
            chunkContainer.style.flexDirection = 'column';
            chunkContainer.style.gap = '20px';
            container.appendChild(chunkContainer);

            // Populate chunks
            for (let i = 0; i < translatedChunks.length; i++) {
                const chunk = translatedChunks[i];
                const chunkEl = document.createElement('div');
                chunkEl.style.marginBottom = '15px';

                // Chunk Header
                const header = document.createElement('div');
                header.textContent = `Chunk ${chunk.position + 1}`;
                header.style.fontSize = '10px';
                header.style.color = '#94a3b8'; // slate-400
                header.style.marginBottom = '5px';
                chunkEl.appendChild(header);

                // Translations
                const content = document.createElement('div');
                content.textContent = chunk.translation;
                content.style.lineHeight = '1.6';
                content.style.whiteSpace = 'pre-wrap';

                if (chunk.type === 'heading') {
                    content.style.fontSize = '18px';
                    content.style.fontWeight = 'bold';
                    content.style.color = '#000000';
                } else {
                    content.style.fontSize = '14px';
                    content.style.color = '#334155'; // slate-700
                }

                chunkEl.appendChild(content);
                chunkContainer.appendChild(chunkEl);

                // Update progress occasionally
                if (i % 20 === 0) {
                    setExportProgress(Math.round((i / translatedChunks.length) * 50));
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            // Wait for DOM
            await new Promise(resolve => setTimeout(resolve, 500));

            setExportProgress(60);

            // Capture Canvas
            const canvas = await html2canvas(container, {
                scale: 2, // Retain quality
                useCORS: true,
                logging: false
            });

            setExportProgress(80);

            // Generate PDF
            const contentWidth = canvas.width;
            const contentHeight = canvas.height;

            // A4 Dimensions in PDF units (mm)
            const pdfUserInfo = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;

            // Calculate image dimensions in PDF
            const imgWidth = pageWidth;
            const imgHeight = (contentHeight * pageWidth) / contentWidth;

            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            pdfUserInfo.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add subsequent pages
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdfUserInfo.addPage();
                pdfUserInfo.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Cleanup
            document.body.removeChild(container);

            setExportProgress(90);

            // Use FileSaver.js for reliable download
            const blob = pdfUserInfo.output('blob');
            const filename = `translation_${Date.now()}.pdf`;
            saveAs(blob, filename);
            console.log('✅ PDF download triggered:', filename);

        } catch (error) {
            console.error("PDF Export failed:", error);
            alert("Failed to export PDF. Please try again.");
        } finally {
            setIsExporting(false);
            setExportProgress(0);
        }
    };

    const handleExportText = (format: 'translation' | 'bilingual') => {
        console.log('🔍 Export initiated - Format:', format);

        let content = '';
        let filename = '';

        if (format === 'translation') {
            content = reassembleChunks(
                translatedChunks.map(chunk => ({ text: chunk.translation, type: chunk.type }))
            );
            filename = `translation_${Date.now()}.txt`;
        } else {
            content = translatedChunks
                .map((chunk) => {
                    return `[Original]\n${chunk.text}\n\n[Translation]\n${chunk.translation}\n\n${'='.repeat(80)}\n`;
                })
                .join('\n');
            filename = `translation_bilingual_${Date.now()}.txt`;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, filename);
        console.log('✅ Download triggered:', filename);
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
        const filename = `new_terms_${Date.now()}.csv`;
        saveAs(blob, filename);
        console.log('✅ CSV download triggered:', filename);
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
                    disabled={isExporting}
                    className="flex items-center justify-between p-4 border border-blue-200 bg-blue-50/50 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-70 disabled:cursor-wait"
                >
                    <div className="flex items-center gap-3">
                        {isExporting ? (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        ) : (
                            <File className="w-5 h-5 text-blue-600" />
                        )}
                        <div className="text-left">
                            <p className="font-medium text-slate-800">
                                {isExporting ? `Generating PDF (${exportProgress}%)` : 'Export as PDF'}
                            </p>
                            <p className="text-xs text-slate-500">
                                {isExporting ? 'Please wait...' : 'Formatted Chinese document'}
                            </p>
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

                {/* Markdown Export (MinerU style) */}
                <button
                    onClick={() => {
                        import('../services/exportToMarkdown').then(mod => {
                            mod.downloadAsMarkdown(translatedChunks, `translation_${Date.now()}`);
                        });
                    }}
                    className="flex items-center justify-between p-4 border border-purple-200 bg-purple-50/50 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <File className="w-5 h-5 text-purple-600" />
                        <div className="text-left">
                            <p className="font-medium text-slate-800">Markdown (MD)</p>
                            <p className="text-xs text-slate-500">Structured format</p>
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
