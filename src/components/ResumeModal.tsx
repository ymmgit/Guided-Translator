import { Project } from '../types';
import { Clock, FileText, AlertCircle } from 'lucide-react';

interface ResumeModalProps {
    project: Project;
    onResume: () => void;
    onStartOver: () => void;
}

export default function ResumeModal({ project, onResume, onStartOver }: ResumeModalProps) {
    const lastModifiedDate = new Date(project.lastModified).toLocaleString();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6 text-amber-600">
                    <AlertCircle className="w-8 h-8" />
                    <h2 className="text-xl font-bold text-slate-900">Existing Work Found</h2>
                </div>

                <p className="text-slate-600 mb-6 leading-relaxed">
                    We found a saved translation session for <strong>{project.standardTitle}</strong>.
                    Would you like to resume where you left off?
                </p>

                <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
                    <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{project.standardTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>Last edited: {lastModifiedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-4 h-4 flex items-center justify-center text-[10px] bg-slate-200 rounded-full font-mono">P</span>
                        <span>Progress: {project.translatedChunks} / {project.totalChunks} chunks</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onStartOver}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                        Start Over
                    </button>
                    <button
                        onClick={onResume}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md shadow-blue-200"
                    >
                        Resume Session
                    </button>
                </div>

                <p className="text-xs text-center text-slate-400 mt-4">
                    Starting over will overwrite the existing saved data for this document.
                </p>
            </div>
        </div>
    );
}
