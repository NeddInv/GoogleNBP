import React, { useState, useEffect } from 'react';
import { PencilIcon, CloseIcon, CheckIcon } from './icons';

interface RenamePhotoModalProps {
    isOpen: boolean;
    currentName: string;
    category: string;
    onClose: () => void;
    onSave: (newName: string) => void;
}

export const RenamePhotoModal: React.FC<RenamePhotoModalProps> = ({
    isOpen,
    currentName,
    category,
    onClose,
    onSave
}) => {
    const [name, setName] = useState(currentName);

    useEffect(() => {
        if (isOpen) {
            setName(currentName);
        }
    }, [isOpen, currentName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) {
            onSave(trimmed);
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-brand-secondary border border-gray-700 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                            <PencilIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Rename Photo File</h3>
                            <p className="text-[11px] text-gray-400">Set the exact filename to match in prompts and AI catalogs.</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                            Filename ({category})
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Matte_Black_Bottle_45Deg.png"
                            autoFocus
                            className="w-full bg-black/50 border border-gray-600 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30 disabled:opacity-40"
                        >
                            <CheckIcon className="w-3.5 h-3.5" />
                            Save Filename
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
