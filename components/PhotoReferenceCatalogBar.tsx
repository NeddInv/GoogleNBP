import React, { useState } from 'react';
import { PhotoIcon, CopyIcon, SparklesIcon, ChevronDownIcon, PencilIcon, ArrowPathIcon, UserIcon, AtSymbolIcon } from './icons';

export interface PhotoRefSummary {
    name: string;
    category: 'Product' | 'Competitor' | 'Model' | 'Pose' | 'Scene' | 'Apparel / Gear' | 'Logo';
    badgeColor: string;
    icon: string;
    preview: string;
    index: number;
}

interface PhotoReferenceCatalogBarProps {
    references: PhotoRefSummary[];
    onInsertTag: (tag: string) => void;
    onRename?: (category: 'Product' | 'Competitor' | 'Model' | 'Pose' | 'Scene' | 'Apparel / Gear' | 'Logo', index: number, currentName: string) => void;
    onOpenHistoricalSessions?: () => void;
    onOpenModelInsertion?: () => void;
    onOpenCharacterSwap?: () => void;
    currentMode: 'guided' | 'full' | 'multiple';
    activeVariationIndex?: number | null;
}

export const PhotoReferenceCatalogBar: React.FC<PhotoReferenceCatalogBarProps> = ({
    references,
    onInsertTag,
    onRename,
    onOpenHistoricalSessions,
    onOpenModelInsertion,
    onOpenCharacterSwap,
    currentMode,
    activeVariationIndex
}) => {
    const [copiedTag, setCopiedTag] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [filter, setFilter] = useState('');

    if (references.length === 0) {
        return null;
    }

    const filteredRefs = references.filter(r => 
        r.name.toLowerCase().includes(filter.toLowerCase()) || 
        r.category.toLowerCase().includes(filter.toLowerCase())
    );

    const handleCopyOnly = (e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(tag);
        setCopiedTag(tag);
        setTimeout(() => setCopiedTag(null), 2000);
    };

    const handleInsert = (tag: string) => {
        onInsertTag(tag);
        setCopiedTag(tag);
        setTimeout(() => setCopiedTag(null), 2000);
    };

    return (
        <div className="bg-brand-primary/60 border border-indigo-500/25 rounded-xl p-3.5 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30 flex-shrink-0">
                        <PhotoIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                            <span>Uploaded Reference Photos</span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                                {references.length} {references.length === 1 ? 'photo' : 'photos'} detected
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                            Type <strong className="text-cyan-300 font-mono">@</strong> in any prompt box or click any photo below to <strong className="text-cyan-300">@mention</strong> it. Supports <strong className="text-fuchsia-300">Replace person in @PhotoA with @PhotoB</strong> swap commands!
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                    {onOpenCharacterSwap && (
                        <button
                            type="button"
                            onClick={onOpenCharacterSwap}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 hover:text-white bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 hover:from-fuchsia-600/50 hover:to-purple-600/50 border border-fuchsia-400/40 rounded-lg transition-colors cursor-pointer"
                            title="Simple Character Swap: Replace a person in one photo with a person from another photo"
                        >
                            <ArrowPathIcon className="w-3 h-3 text-fuchsia-300" />
                            <span>Swap Character</span>
                        </button>
                    )}
                    {onOpenModelInsertion && (
                        <button
                            type="button"
                            onClick={onOpenModelInsertion}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-lg transition-colors cursor-pointer"
                            title="Insert a model/portrait photo into an original reference scene photo"
                        >
                            <UserIcon className="w-3 h-3 text-purple-400" />
                            <span>Insert Model into Photo</span>
                        </button>
                    )}
                    {onOpenHistoricalSessions && (
                        <button
                            type="button"
                            onClick={onOpenHistoricalSessions}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                            title="Restart program from historical session references or switch checkpoint"
                        >
                            <ArrowPathIcon className="w-3 h-3 text-emerald-400" />
                            <span>Session References</span>
                        </button>
                    )}
                    {references.length > 6 && (
                        <input 
                            type="text" 
                            placeholder="Filter photos..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="text-[11px] px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-gray-200 placeholder-gray-500 w-28 focus:w-36 transition-all focus:outline-none focus:border-indigo-400"
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        title={isExpanded ? "Collapse reference tags" : "Expand reference tags"}
                    >
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                        {filteredRefs.map((ref, idx) => {
                            const tagText = `@${ref.name}`;
                            const isCopied = copiedTag === tagText;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleInsert(tagText)}
                                    title={`Click to insert "${tagText}" into your prompt for pinpoint zero-hallucination replication`}
                                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all active:scale-95 select-none ${
                                        isCopied
                                            ? 'bg-green-500/20 border-green-500/40 text-green-300'
                                            : 'bg-black/40 hover:bg-cyan-950/40 border-white/10 hover:border-cyan-400/40 text-gray-200 hover:text-white'
                                    }`}
                                >
                                    <div className="w-5 h-5 rounded overflow-hidden bg-black/30 flex-shrink-0 border border-white/10">
                                        <img 
                                            src={ref.preview} 
                                            alt={ref.name} 
                                            className="w-full h-full object-cover" 
                                        />
                                    </div>
                                    
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${ref.badgeColor}`}>
                                        {ref.category}
                                    </span>

                                    <span className="font-mono text-[11px] max-w-[140px] truncate text-cyan-200">
                                        @{ref.name}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={(e) => handleCopyOnly(e, tagText)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-opacity"
                                        title="Copy @tag to clipboard"
                                    >
                                        <CopyIcon className="w-3 h-3" />
                                    </button>

                                    {onRename && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRename(ref.category, ref.index, ref.name);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-opacity"
                                            title="Rename this photo"
                                        >
                                            <PencilIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {copiedTag && (
                        <div className="flex items-center gap-1.5 text-[11px] text-green-400 animate-fade-in font-medium">
                            <SparklesIcon className="w-3.5 h-3.5" />
                            <span>Inserted & copied <strong>{copiedTag}</strong> to your prompt!</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
