import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, X, Check, Eye, EyeOff } from 'lucide-react';

interface ApiKeyManagerProps {
    onKeysUpdated: (keys: string[]) => void;
    initialKeys?: string[];
}

export default function ApiKeyManager({ onKeysUpdated, initialKeys = [] }: ApiKeyManagerProps) {
    const [keys, setKeys] = useState<string[]>(initialKeys);
    const [newKey, setNewKey] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        setKeys(initialKeys);
    }, [initialKeys]);

    const handleAddKey = () => {
        if (newKey.trim() && !keys.includes(newKey.trim())) {
            const updatedKeys = [...keys, newKey.trim()];
            setKeys(updatedKeys);
            onKeysUpdated(updatedKeys);
            setNewKey('');
        }
    };

    const handleRemoveKey = (index: number) => {
        const updatedKeys = keys.filter((_, i) => i !== index);
        setKeys(updatedKeys);
        onKeysUpdated(updatedKeys);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddKey();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Manage API Keys"
            >
                <Key className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 text-slate-800">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Key className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold">API Key Manager</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 border border-slate-100">
                        <p>Add multiple Gemini API keys here. If one key hits the rate limit, the app will automatically switch to the next one to keep your translation running smoothly.</p>
                    </div>

                    <div className="space-y-2">
                        {keys.map((key, index) => (
                            <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 p-3 rounded-lg group">
                                <div className="bg-emerald-100 p-1.5 rounded-md">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                </div>
                                <code className="flex-1 text-sm font-mono text-slate-600">
                                    {key.slice(0, 4)}...{key.slice(-4)}
                                </code>
                                <button
                                    onClick={() => handleRemoveKey(index)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove Key"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showKey ? "text" : "password"}
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter Gemini API Key..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <button
                            onClick={handleAddKey}
                            disabled={!newKey.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
