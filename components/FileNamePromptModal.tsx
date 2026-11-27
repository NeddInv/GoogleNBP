import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, DownloadIcon, PencilIcon } from './icons';

export interface FileNamePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (confirmedName: string) => void;
    defaultName: string;
    extension?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    isBatch?: boolean;
    batchCount?: number;
}

export const FileNamePromptModal: React.FC<FileNamePromptModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    defaultName,
    extension = 'png',
    title = 'Confirm Export Filename',
    subtitle,
    description,
    isBatch = false,
    batchCount = 1
}) => {
    // Strip extension if provided in defaultName so user edits base name
    const cleanDefaultBase = React.useMemo(() => {
        let name = defaultName.trim();
        const extRegex = new RegExp(`\\.${extension}$`, 'i');
        name = name.replace(extRegex, '');
        return name;
    }, [defaultName, extension]);

    const [mode, setMode] = useState<'default' | 'custom'>('default');
    const [customName, setCustomName] = useState<string>(cleanDefaultBase);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setMode('default');
            setCustomName(cleanDefaultBase);
        }
    }, [isOpen, cleanDefaultBase]);

    useEffect(() => {
        if (isOpen && mode === 'custom') {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const normalizedExt = extension.replace(/^\./, '').toLowerCase();

    const cleanInputName = (name: string): string => {
        const clean = name.trim().replace(/[/\\:*?"<>|]/g, '_').trim();
        return clean.replace(new RegExp(`\\.${normalizedExt}$`, 'i'), '');
    };

    const finalBaseName = mode === 'default' 
        ? cleanDefaultBase 
        : (cleanInputName(customName) || cleanDefaultBase);

    const fullFinalFileName = `${finalBaseName}.${normalizedExt}`;

    const handleConfirm = () => {
        onConfirm(finalBaseName);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-brand-secondary border border-gray-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative animate-scale-in"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="flex items-start justify-between pb-3.5 border-b border-gray-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-brand-accent">
                                <DownloadIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
                                {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 rounded-lg transition-colors"
                        aria-label="Close export dialog"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="mt-4 space-y-4">
                    {description && (
                        <p className="text-xs text-gray-300 bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
                            {description}
                        </p>
                    )}

                    {/* Choose between Default or Custom */}
                    <div className="space-y-2.5">
                        <label className="block text-xs font-semibold text-gray-300">
                            Choose Filename Option:
                        </label>
                        
                        {/* Option 1: Keep Default Name */}
                        <div 
                            onClick={() => setMode('default')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                mode === 'default' 
                                    ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40' 
                                    : 'bg-brand-primary/50 border-gray-700/70 hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                    mode === 'default' 
                                        ? 'border-brand-accent bg-brand-accent' 
                                        : 'border-gray-500 bg-transparent'
                                }`}>
                                    {mode === 'default' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <span>Keep Default Name</span>
                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                            Default
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-gray-400 truncate max-w-[260px] mt-0.5" title={`${cleanDefaultBase}.${normalizedExt}`}>
                                        {cleanDefaultBase}.{normalizedExt}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Option 2: Enter Custom Name */}
                        <div 
                            onClick={() => setMode('custom')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                mode === 'custom' 
                                    ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40' 
                                    : 'bg-brand-primary/50 border-gray-700/70 hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                        mode === 'custom' 
                                            ? 'border-brand-accent bg-brand-accent' 
                                            : 'border-gray-500 bg-transparent'
                                    }`}>
                                        {mode === 'custom' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <span>Enter a New File Name</span>
                                        <PencilIcon className="w-3.5 h-3.5 text-brand-accent" />
                                    </div>
                                </div>
                            </div>

                            {mode === 'custom' && (
                                <div className="mt-2 pl-7 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <label htmlFor="custom-filename-input" className="block text-[11px] text-gray-400 mb-1">
                                        {isBatch ? 'Base name prefix for export:' : 'Custom file name:'}
                                    </label>
                                    <div className="flex items-center rounded-lg bg-black/60 border border-indigo-500/60 focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent px-2.5 py-1.5">
                                        <input
                                            id="custom-filename-input"
                                            ref={inputRef}
                                            type="text"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            placeholder="Enter file name..."
                                            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-mono"
                                        />
                                        <span className="text-xs font-mono text-gray-400 pl-1 select-none">
                                            .{normalizedExt}
                                        </span>
                                    </div>
                                    {isBatch && batchCount > 1 && (
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Export will name items as <span className="font-mono text-indigo-300">"{cleanInputName(customName) || cleanDefaultBase}_1.{normalizedExt}"</span>, etc.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview summary */}
                    <div className="bg-brand-primary/80 border border-gray-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="text-gray-400 text-[11px]">Export will be saved as:</span>
                        <span className="font-mono font-bold text-emerald-400 text-[11px] truncate max-w-[200px]" title={fullFinalFileName}>
                            {fullFinalFileName}
                        </span>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-5 pt-3.5 border-t border-gray-800 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95"
                    >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        Export Now
                    </button>
                </div>
            </div>
        </div>
    );
};
