import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PhotoRefSummary } from './PhotoReferenceCatalogBar';
import type { CharacterProfile } from '../types';
import { detectActiveCharacters, loadCharacterProfiles, parseCharacterSwapPrompt } from '../services/characterService';
import { AtSymbolIcon, SparklesIcon, PhotoIcon, ArrowPathIcon } from './icons';

export interface PromptMentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    rows?: number;
    disabled?: boolean;
    allPhotoReferences?: PhotoRefSummary[];
    onInsertTag?: (tag: string) => void;
    onOpenSwapStudio?: (targetSceneName: string, sourceSubjectName: string, targetDesc: string) => void;
    label?: string;
    showQuickChips?: boolean;
    id?: string;
    characters?: CharacterProfile[];
}

export const PromptMentionTextarea: React.FC<PromptMentionTextareaProps> = ({
    value,
    onChange,
    placeholder,
    className,
    rows = 4,
    disabled = false,
    allPhotoReferences = [],
    onInsertTag,
    onOpenSwapStudio,
    label,
    showQuickChips = true,
    id,
    characters
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorCoords, setCursorCoords] = useState<{ top: number; left: number } | null>(null);

    // Filter reference photos by query
    const filteredRefs = (allPhotoReferences || []).filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });

    // Detect active @mentions or [Photo: ...] tags in current prompt text (exact-first, longest-first)
    const detectedMentions = React.useMemo(() => {
        if (!value || !allPhotoReferences || allPhotoReferences.length === 0) return [];
        const mentions: PhotoRefSummary[] = [];
        const seen = new Set<string>();
        const valueLower = value.toLowerCase();

        const findBestRef = (token: string): PhotoRefSummary | undefined => {
            const raw = token.trim().replace(/^@/, '').toLowerCase();
            if (!raw) return undefined;
            const rawBase = raw.replace(/\.[^/.]+$/, '');
            const pool = allPhotoReferences.filter(r => !seen.has(r.name.toLowerCase()));
            const exactFull = pool.find(r => r.name.toLowerCase() === raw);
            if (exactFull) return exactFull;
            const exactBase = pool.find(r => r.name.toLowerCase().replace(/\.[^/.]+$/, '') === rawBase);
            if (exactBase) return exactBase;
            if (rawBase.length >= 4) {
                const contains = pool.filter(r => r.name.toLowerCase().includes(rawBase)).sort((a, b) => a.name.length - b.name.length);
                if (contains.length > 0) return contains[0];
            }
            const reverse = pool
                .filter(r => {
                    const rb = r.name.toLowerCase().replace(/\.[^/.]+$/, '');
                    return rb.length >= 4 && rawBase.includes(rb);
                })
                .sort((a, b) => b.name.length - a.name.length);
            return reverse[0];
        };

        // 0. Direct longest-first @<exact filename> match (supports spaces in filenames)
        const sortedByLen = [...allPhotoReferences].sort((a, b) => b.name.length - a.name.length);
        for (const r of sortedByLen) {
            const rLower = r.name.toLowerCase();
            if (seen.has(rLower)) continue;
            if (valueLower.includes(`@${rLower}`)) {
                seen.add(rLower);
                mentions.push(r);
            }
        }

        // 1. Matches for @filename or @name
        const atMatches = Array.from(value.matchAll(/@([a-zA-Z0-9_\-\.]+)/g));
        for (const m of atMatches) {
            const found = findBestRef(m[1]);
            if (found) {
                seen.add(found.name.toLowerCase());
                mentions.push(found);
            }
        }

        // 2. Matches for [Photo: filename]
        const photoTagMatches = Array.from(value.matchAll(/\[Photo:\s*([^\]]+)\]/gi));
        for (const m of photoTagMatches) {
            const found = findBestRef(m[1]);
            if (found) {
                seen.add(found.name.toLowerCase());
                mentions.push(found);
            }
        }

        return mentions;
    }, [value, allPhotoReferences]);

    // Check cursor position for @ typing
    const checkMentionTrigger = useCallback(() => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.slice(0, cursorPos);

        // Find last @ token in text before cursor that has no space after the @
        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/);

        if (match && allPhotoReferences && allPhotoReferences.length > 0) {
            const query = match[1];
            setSearchQuery(query);
            setIsOpen(true);
            setSelectedIndex(0);

            // Calculate rough relative position for dropdown
            const lines = textBeforeCursor.split('\n');
            const lineCount = lines.length;
            const topPos = Math.min(220, Math.max(36, lineCount * 22));
            setCursorCoords({ top: topPos, left: 12 });
        } else {
            setIsOpen(false);
            setSearchQuery('');
        }
    }, [allPhotoReferences]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setTimeout(checkMentionTrigger, 0);
    };

    const insertMention = (photo: PhotoRefSummary) => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const textAfterCursor = value.slice(cursorPos);

        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/);
        let newValue = '';
        let newCursorPos = 0;

        if (match) {
            const matchStart = match.index! + (match[0].startsWith(' ') ? 1 : 0);
            const prefix = value.slice(0, matchStart);
            const tag = `@${photo.name} `;
            newValue = prefix + tag + textAfterCursor;
            newCursorPos = prefix.length + tag.length;
        } else {
            // Direct insertion (from quick chip)
            const tag = `@${photo.name} `;
            const needsSpace = textBeforeCursor.length > 0 && !textBeforeCursor.endsWith(' ') && !textBeforeCursor.endsWith('\n');
            const spacer = needsSpace ? ' ' : '';
            newValue = textBeforeCursor + spacer + tag + textAfterCursor;
            newCursorPos = (textBeforeCursor + spacer + tag).length;
        }

        onChange(newValue);
        setIsOpen(false);
        setSearchQuery('');

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 10);

        onInsertTag?.(`@${photo.name}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!isOpen || filteredRefs.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredRefs.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredRefs.length) % filteredRefs.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const selected = filteredRefs[selectedIndex];
            if (selected) {
                insertMention(selected);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
        }
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (ev: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(ev.target as Node) &&
                textareaRef.current &&
                !textareaRef.current.contains(ev.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeCharacters = React.useMemo(() => {
        return detectActiveCharacters([value], characters);
    }, [value, characters]);

    const detectedSwap = React.useMemo(() => {
        if (!value || !allPhotoReferences || allPhotoReferences.length < 2) return null;
        return parseCharacterSwapPrompt(value, allPhotoReferences);
    }, [value, allPhotoReferences]);

    return (
        <div className="relative w-full min-w-0 space-y-1.5">
            {/* Quick @mention chips row if photos are available */}
            {showQuickChips && allPhotoReferences && allPhotoReferences.length > 0 && (
                <div 
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    className="flex flex-wrap items-center gap-1.5 pb-1 select-none min-w-0"
                >
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <AtSymbolIcon className="w-3 h-3 text-cyan-400" />
                        <span>Tag:</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1 min-w-0">
                        {allPhotoReferences.map((ref, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => insertMention(ref)}
                                title={`Insert @${ref.name} into prompt for exact zero-hallucination replication`}
                                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-cyan-200 text-[10px] font-mono transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 max-w-[180px]"
                            >
                                <span className="w-3 h-3 rounded-full overflow-hidden shrink-0 border border-cyan-400/40 bg-black/40 inline-flex items-center justify-center">
                                    <img src={ref.preview} alt={ref.name} className="w-full h-full object-cover" />
                                </span>
                                <span className="font-bold text-cyan-300 truncate">@{ref.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}


            {/* The Textarea */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    id={id}
                    value={value}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onKeyUp={checkMentionTrigger}
                    onClick={checkMentionTrigger}
                    rows={rows}
                    disabled={disabled}
                    placeholder={placeholder || "Describe the scene. Type @ to mention and ground any uploaded photo reference..."}
                    className={className || "w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-brand-accent focus:border-brand-accent/80 transition-all resize-none text-xs text-gray-300 placeholder-gray-500"}
                />

                {/* Dropdown Menu for @ Autocomplete */}
                {isOpen && filteredRefs.length > 0 && (
                    <div 
                        ref={dropdownRef}
                        style={{
                            top: `${cursorCoords?.top || 45}px`,
                            left: `${cursorCoords?.left || 10}px`
                        }}
                        className="absolute z-50 w-72 max-w-[90vw] bg-[#121028] border border-cyan-500/40 rounded-xl shadow-2xl shadow-cyan-950/50 overflow-hidden animate-fade-in backdrop-blur-md"
                    >
                        <div className="p-2 border-b border-white/10 bg-black/40 flex items-center justify-between text-[10px] text-gray-300">
                            <span className="font-bold text-cyan-300 flex items-center gap-1">
                                <AtSymbolIcon className="w-3.5 h-3.5 text-cyan-400" />
                                Select Photo Reference to @Ground
                            </span>
                            <span className="text-gray-400 font-mono">Use ↑↓ &amp; Enter</span>
                        </div>

                        <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                            {filteredRefs.map((ref, i) => {
                                const isSelected = i === selectedIndex;
                                return (
                                    <div
                                        key={i}
                                        onClick={() => insertMention(ref)}
                                        onMouseEnter={() => setSelectedIndex(i)}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                            isSelected 
                                                ? 'bg-cyan-500/20 text-white border border-cyan-500/40' 
                                                : 'hover:bg-white/5 text-gray-300 border border-transparent'
                                        }`}
                                    >
                                        <div className="w-7 h-7 rounded overflow-hidden bg-black/60 shrink-0 border border-white/15">
                                            <img src={ref.preview} alt={ref.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs font-bold text-cyan-200 truncate">
                                                    @{ref.name}
                                                </span>
                                                <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${ref.badgeColor}`}>
                                                    {ref.category}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 truncate">
                                                Ground physical details &amp; zero-hallucination
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Universal Character Grounding Indicator */}
            {activeCharacters.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-200 animate-fade-in shadow-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        <span>Character Grounding:</span>
                    </span>
                    {activeCharacters.map((char) => (
                        <span key={char.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-400/30 text-[9px] text-amber-200">
                            <span className="font-mono text-amber-100 font-bold">{char.name}</span>
                            <span className="text-amber-300/90 font-medium">({char.ethnicity})</span>
                        </span>
                    ))}
                    <span className="text-[9px] text-amber-300/80 italic ml-auto hidden sm:inline">
                        Demographics & anti-whitewashing locked
                    </span>
                </div>
            )}

            {/* Live Product or Character Swap Command Indicator */}
            {detectedSwap && (
                <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-lg bg-fuchsia-950/50 border border-fuchsia-500/40 text-[11px] text-fuchsia-200 animate-fade-in shadow-xs">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <ArrowPathIcon className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                        <span className="font-extrabold text-fuchsia-300">
                            {detectedSwap.swapKind === 'object' ? 'Product / Object Swap Active:' : 'Character Swap Active:'}
                        </span>
                        <span>
                            Replacing <strong className="text-white">"{detectedSwap.targetSubjectDesc}"</strong> in{' '}
                            <span className="font-mono text-cyan-300">@{detectedSwap.targetSceneEntry.name}</span>
                            {' → '}with {detectedSwap.swapKind === 'object' ? 'exact product in ' : 'person in '}
                            <span className="font-mono text-purple-300">@{detectedSwap.sourceSubjectEntry.name}</span>
                        </span>
                    </div>
                    {onOpenSwapStudio && detectedSwap.swapKind === 'character' && (
                        <button
                            type="button"
                            onClick={() =>
                                onOpenSwapStudio(
                                    detectedSwap.targetSceneEntry.name,
                                    detectedSwap.sourceSubjectEntry.name,
                                    detectedSwap.targetSubjectDesc
                                )
                            }
                            className="px-2 py-0.5 rounded-md bg-fuchsia-600/40 hover:bg-fuchsia-500/60 border border-fuchsia-400/50 text-[10px] font-bold text-white transition cursor-pointer shrink-0"
                        >
                            Open in Swap Studio
                        </button>
                    )}
                </div>
            )}

            {/* Active Grounding Indicators Strip */}
            {detectedMentions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 animate-fade-in shadow-xs">
                    <span className="font-extrabold text-emerald-400 flex items-center gap-1 shrink-0">
                        <SparklesIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Zero-Hallucination Grounding Active:</span>
                    </span>
                    {detectedMentions.map((m, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-400/40 font-mono text-[10px] text-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>@{m.name}</span>
                            <span className="text-[8px] text-emerald-400/80 uppercase">({m.category})</span>
                        </span>
                    ))}
                    <span className="text-[10px] text-emerald-400/80 italic ml-auto hidden sm:inline">
                        100% exact physical object replication bound
                    </span>
                </div>
            )}

        </div>
    );
};
