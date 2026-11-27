import React, { useState, useEffect, useMemo } from 'react';
import { SparklesIcon, Squares2X2Icon, PhotoIcon, ZoomInIcon, DownloadIcon, KeyIcon } from './icons';
import { ExportControls } from './ExportControls';
import type { ImageGenerationResponse, GenerationError } from '../types';

interface AdDisplayProps {
    generatedAds: ImageGenerationResponse | null;
    generatedVideo: string | null;
    isLoading: boolean;
    isEditing: boolean;
    error: string | null;
    generationType: 'image' | 'video' | null;
    videoLoadingMessage: string;
    imageLoadingMessage?: string;
    activeIndex: number;
    onSelectVariation: (index: number) => void;
    onImageClick?: (url: string) => void;
}

export type PreviewMode = 'default' | 'story' | 'post' | 'bulk';

const LoadingSpinner: React.FC<{text?: string}> = ({text}) => (
    <div className="flex flex-col items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {text && <p className="mt-4 text-xl font-semibold text-white">{text}</p>}
    </div>
);

const SocialPreviewWrapper: React.FC<{ mode: PreviewMode; children: React.ReactNode }> = ({ mode, children }) => {
    if (mode === 'story') {
        return (
            <div className="w-[280px] h-[500px] bg-black border-4 border-gray-700 rounded-3xl p-2 flex flex-col shadow-2xl">
                <div className="flex-grow bg-gray-900 rounded-2xl overflow-hidden relative">
                    {children}
                    <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
                         <div className="w-8 h-8 bg-gray-500 rounded-full border-2 border-white"></div>
                         <div className="w-20 h-3 bg-gray-500 rounded-full"></div>
                    </div>
                </div>
            </div>
        );
    }
    if (mode === 'post') {
        return (
             <div className="w-full max-w-md bg-[#050505] border border-gray-700 rounded-xl p-3 flex flex-col gap-3 shadow-2xl">
                 <div className="flex items-center gap-2 pointer-events-none">
                     <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
                     <div className="w-24 h-4 bg-gray-600 rounded-full"></div>
                 </div>
                <div className="w-full bg-gray-900 rounded-lg overflow-hidden aspect-square relative">{children}</div>
                 <div className="w-full h-4 bg-gray-600 rounded-full pointer-events-none"></div>
                 <div className="w-3/4 h-4 bg-gray-600 rounded-full pointer-events-none"></div>
            </div>
        );
    }
    return <>{children}</>;
};

export const AdDisplay: React.FC<AdDisplayProps> = ({ 
    generatedAds, ...props
}) => {
    const { 
        generatedVideo, isLoading, isEditing, error, generationType, videoLoadingMessage, imageLoadingMessage,
        activeIndex, onSelectVariation, onImageClick
    } = props;
    const [previewMode, setPreviewMode] = useState<PreviewMode>('default');
    const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');
    const [bulkChunkPage, setBulkChunkPage] = useState<number>(0);
    const [thumbnailChunkPage, setThumbnailChunkPage] = useState<number>(0);

    const images = generatedAds?.images || [];
    const totalCount = images.length;

    useEffect(() => {
        onSelectVariation(0);
        // Default to 'default' mode on fresh generation unless bulk was selected
        if (previewMode !== 'bulk') {
            setPreviewMode('default');
        }
        setBulkSearchQuery('');
        setBulkChunkPage(0);
        setThumbnailChunkPage(0);
    }, [generatedAds, generatedVideo]);

    const activeAd = (images && images.length > 0)
        ? (images[activeIndex] || images[0])
        : null;

    // Filter images for bulk gallery
    const filteredBulkImages = useMemo(() => {
        if (!bulkSearchQuery.trim()) return images;
        const q = bulkSearchQuery.toLowerCase().trim();
        return images.filter((img, idx) => {
            const vIndex = String(img.variantIndex !== undefined ? img.variantIndex + 1 : idx + 1);
            const id = (img.id || '').toLowerCase();
            const fn = (img.fileName || '').toLowerCase();
            const model = (img.modelUsed || '').toLowerCase();
            return vIndex.includes(q) || id.includes(q) || fn.includes(q) || model.includes(q);
        });
    }, [images, bulkSearchQuery]);

    // Chunk size for bulk gallery pagination (e.g. 24 items per chunk)
    const CHUNK_SIZE = 24;
    const totalChunkPages = Math.ceil(filteredBulkImages.length / CHUNK_SIZE);
    const displayedBulkImages = useMemo(() => {
        if (bulkChunkPage === -1) return filteredBulkImages; // -1 means Show All
        const start = bulkChunkPage * CHUNK_SIZE;
        return filteredBulkImages.slice(start, start + CHUNK_SIZE);
    }, [filteredBulkImages, bulkChunkPage]);

    // Thumbnail batch for Single View (chunks of 20)
    const THUMB_CHUNK_SIZE = 20;
    const totalThumbPages = Math.ceil(images.length / THUMB_CHUNK_SIZE);
    const displayedThumbnails = useMemo(() => {
        if (images.length <= 20 || thumbnailChunkPage === -1) return images;
        const start = thumbnailChunkPage * THUMB_CHUNK_SIZE;
        return images.slice(start, start + THUMB_CHUNK_SIZE);
    }, [images, thumbnailChunkPage]);

    const renderErrorReport = (errList: GenerationError[], generalError?: string | null) => (
        <div className="w-full max-w-2xl mx-auto bg-red-950/40 border border-red-500/30 rounded-2xl p-5 text-left animate-fade-in shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-3 mb-4">
                <div className="flex items-center gap-2.5 text-red-300 font-bold text-sm">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span>Distinct Prompt Error Report</span>
                    {errList.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                            {errList.length} {errList.length === 1 ? 'box failed' : 'boxes failed'}
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-gray-400">
                    Check flagged prompt boxes on the left
                </span>
            </div>

            {generalError && (
                <div className="mb-3.5 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200">
                    <div className="font-bold text-red-300 mb-0.5">Execution Summary:</div>
                    <div className="font-mono text-[11px] text-red-200/90 break-words">{generalError}</div>
                </div>
            )}

            {errList.length > 0 && (
                <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {errList.map((err, i) => (
                        <div key={i} className="text-xs bg-black/60 border border-red-500/30 p-3.5 rounded-xl flex flex-col gap-2 text-red-200 shadow-sm">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-bold text-red-400 flex items-center gap-2 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                                    {err.promptTitle || `Prompt Box #${err.promptBoxNumber || (err.variantIndex + 1)}`}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {err.promptId && (
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                                            ID: {err.promptId}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                        Model: {err.modelUsed || 'gemini-3-pro-image'}
                                    </span>
                                </div>
                            </div>
                            {err.promptSnippet && (
                                <div className="text-[11px] text-gray-300 italic bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 line-clamp-2">
                                    "{err.promptSnippet}"
                                </div>
                            )}
                            <div className="text-[11px] text-red-200 leading-relaxed pl-2 border-l-2 border-red-500/70">
                                <span className="font-bold text-red-300">Specifically Why: </span>
                                <span className="font-mono text-[11px] text-red-200/90 break-words">{err.specificReason || err.message}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Action to Trigger the Paid Account Pop-Up */}
            <div className="mt-4 pt-3.5 border-t border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/60 p-3.5 rounded-xl border border-red-500/30">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                        <KeyIcon className="w-4 h-4" />
                    </span>
                    <div>
                        <div className="text-xs font-bold text-amber-300">
                            Billing / Paid Account Required for Image Models
                        </div>
                        <div className="text-[11px] text-gray-400">
                            Free tier has 0 quota for image generation. Open the pop-up to select your paid account.
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-api-key-modal'));
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <KeyIcon className="w-4 h-4 text-black" />
                    <span>Configure API Key</span>
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full text-center py-16">
                    <LoadingSpinner text={generationType === 'video' ? videoLoadingMessage : (imageLoadingMessage || 'Generating your ad...')} />
                    <p className="mt-2 text-sm text-gray-400">
                      {generationType === 'video' ? 'Video generation can take a few minutes.' : 'Generating high-resolution ad variations...'}
                    </p>
                </div>
            );
        }

        if (error || (generatedAds?.errors && generatedAds.errors.length > 0 && !activeAd)) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full p-4">
                    {renderErrorReport(generatedAds?.errors || [], error)}
                </div>
            );
        }
        
        // --- BULK GALLERY TAB VIEW ---
        if (previewMode === 'bulk' && totalCount > 0) {
            return (
                <div className="w-full flex flex-col gap-4 animate-fade-in">
                    {/* Bulk Gallery Header Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/40 border border-white/10 p-3.5 rounded-xl">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                                <Squares2X2Icon className="w-4 h-4" />
                            </span>
                            <div>
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    Bulk Batch Gallery
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-extrabold">
                                        {totalCount} Total Ads
                                    </span>
                                </h3>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    All generated variations shown with no restrictions. Click any card to inspect or export.
                                </p>
                            </div>
                        </div>

                        {/* Search & Bulk Export */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search ID, file, or #"
                                value={bulkSearchQuery}
                                onChange={(e) => {
                                    setBulkSearchQuery(e.target.value);
                                    setBulkChunkPage(0);
                                }}
                                className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 w-full sm:w-44"
                            />
                            {activeAd && (
                                <ExportControls 
                                    generatedAd={activeAd.url} 
                                    generatedVideo={null} 
                                    allBatchImages={images}
                                    activeAdId={activeAd.id}
                                    activeAdFileName={activeAd.fileName}
                                    activeVariantIndex={activeAd.variantIndex}
                                    className="relative shrink-0"
                                />
                            )}
                        </div>
                    </div>

                    {/* Pagination / Batch Selector for Smooth Rendering of 60+ images */}
                    {totalChunkPages > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap bg-brand-primary/40 p-2 rounded-xl border border-white/5 text-xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2">Batch Page:</span>
                            <button
                                onClick={() => setBulkChunkPage(-1)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    bulkChunkPage === -1
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                Show All ({filteredBulkImages.length})
                            </button>
                            {Array.from({ length: totalChunkPages }).map((_, pIdx) => {
                                const start = pIdx * CHUNK_SIZE + 1;
                                const end = Math.min((pIdx + 1) * CHUNK_SIZE, filteredBulkImages.length);
                                const isCur = bulkChunkPage === pIdx;
                                return (
                                    <button
                                        key={pIdx}
                                        onClick={() => setBulkChunkPage(pIdx)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            isCur
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        Ads {start} - {end}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Bulk Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3.5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                        {displayedBulkImages.map((img, idx) => {
                            const globalIndex = images.indexOf(img);
                            const targetIndex = globalIndex !== -1 ? globalIndex : idx;
                            const isSelected = activeIndex === targetIndex;
                            const displayNum = img.variantIndex !== undefined ? img.variantIndex + 1 : targetIndex + 1;
                            return (
                                <div 
                                    key={targetIndex}
                                    className={`group relative bg-black/40 border-2 rounded-xl overflow-hidden transition-all duration-200 flex flex-col hover:border-brand-accent ${
                                        isSelected 
                                            ? 'border-brand-accent ring-2 ring-brand-accent/30 shadow-lg shadow-indigo-600/20' 
                                            : 'border-white/10 hover:shadow-md'
                                    }`}
                                >
                                    {/* Card Header info */}
                                    <div className="p-2 bg-black/60 flex items-center justify-between border-b border-white/5 text-[10px]">
                                        <span className="font-extrabold text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">
                                            #{displayNum}
                                        </span>
                                        {img.id && (
                                            <span className="font-mono text-brand-accent truncate max-w-[80px]" title={`ID: ${img.id}`}>
                                                ID: {img.id}
                                            </span>
                                        )}
                                        {img.fileName && (
                                            <span className="font-mono text-emerald-400 truncate max-w-[90px]" title={`File: ${img.fileName}`}>
                                                {img.fileName}
                                            </span>
                                        )}
                                    </div>

                                    {/* Image Container with Hover Actions */}
                                    <div className="relative aspect-square w-full bg-gray-950 overflow-hidden">
                                        <img 
                                            src={img.url} 
                                            alt={`Variation ${displayNum}`}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                            decoding="async"
                                        />

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 backdrop-blur-[2px]">
                                            <button
                                                onClick={() => {
                                                    onSelectVariation(targetIndex);
                                                    setPreviewMode('default');
                                                }}
                                                className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                                            >
                                                Inspect in Focus
                                            </button>
                                            <button
                                                onClick={() => onImageClick?.(img.url)}
                                                className="w-full py-1 px-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                            >
                                                <ZoomInIcon className="w-3.5 h-3.5" />
                                                Zoom Lightbox
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="p-2 bg-black/50 border-t border-white/5 flex items-center justify-between text-[10px]">
                                        <span className="text-gray-400 font-mono truncate max-w-[120px]">
                                            {img.modelUsed ? img.modelUsed.replace('gemini-', '') : 'pro'}
                                        </span>
                                        <button
                                            onClick={() => {
                                                onSelectVariation(targetIndex);
                                                setPreviewMode('default');
                                            }}
                                            className="text-brand-accent hover:underline font-bold text-[10px] cursor-pointer"
                                        >
                                            Select
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // --- SINGLE AD FOCUS VIEW ---
        if (activeAd) {
            return (
                 <div className="w-full h-full flex flex-col gap-5 animate-fade-in">
                     <div className="w-full flex flex-col lg:flex-row gap-5 items-start">
                        {/* Variations Column (Left on Desktop, Bottom on Mobile) - Fully Scrollable with No Limit */}
                        {images.length > 1 && (
                             <div className="flex-shrink-0 w-full lg:w-28 order-2 lg:order-1 bg-black/30 border border-white/5 p-2 rounded-xl flex flex-col gap-2">
                                 <div className="flex items-center justify-between lg:flex-col lg:items-center gap-1 pb-1 border-b border-white/5">
                                     <h4 className="text-[10px] font-extrabold text-brand-accent uppercase tracking-wider">
                                         Variants ({images.length})
                                     </h4>
                                     <button
                                         onClick={() => setPreviewMode('bulk')}
                                         className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold transition-all flex items-center gap-1"
                                         title="Switch to Bulk Gallery Tab to see all ads together"
                                     >
                                         <Squares2X2Icon className="w-3 h-3" />
                                         Bulk Tab
                                     </button>
                                 </div>

                                 {/* Batch switch pills for >20 thumbnails */}
                                 {totalThumbPages > 1 && (
                                     <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 text-[9px]">
                                         <button
                                             onClick={() => setThumbnailChunkPage(-1)}
                                             className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                 thumbnailChunkPage === -1 ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                                             }`}
                                         >
                                             All ({images.length})
                                         </button>
                                         {Array.from({ length: totalThumbPages }).map((_, p) => {
                                             const s = p * THUMB_CHUNK_SIZE + 1;
                                             const e = Math.min((p + 1) * THUMB_CHUNK_SIZE, images.length);
                                             return (
                                                 <button
                                                     key={p}
                                                     onClick={() => setThumbnailChunkPage(p)}
                                                     className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${
                                                         thumbnailChunkPage === p ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                                                     }`}
                                                 >
                                                     {s}-{e}
                                                 </button>
                                             );
                                         })}
                                     </div>
                                 )}

                                 {/* Scrollable Thumbnails List (No restriction, scrolls cleanly up to 100+) */}
                                 <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[64vh] pr-1 pb-1 custom-scrollbar">
                                     {displayedThumbnails.map((img, index) => {
                                         const globalIndex = images.indexOf(img);
                                         const targetIndex = globalIndex !== -1 ? globalIndex : index;
                                         const isSelected = activeIndex === targetIndex;
                                         const displayNum = img.variantIndex !== undefined ? img.variantIndex + 1 : targetIndex + 1;
                                         return (
                                             <button 
                                                key={targetIndex} 
                                                onClick={() => onSelectVariation(targetIndex)} 
                                                className={`flex-shrink-0 w-14 h-14 lg:w-full lg:h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-95 cursor-pointer ${
                                                    isSelected 
                                                        ? 'border-brand-accent shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/30' 
                                                        : 'border-gray-700/80 hover:border-gray-500 bg-gray-900'
                                                } relative group`}
                                                 title={img.fileName ? `File: "${img.fileName}" • ID: ${img.id || displayNum} (Variant ${displayNum}) • Model: ${img.modelUsed || 'gemini-3-pro-image'}` : `Variant ${displayNum}`}
                                             >
                                                 <img src={img.url} alt={`Thumbnail Variant ${displayNum}`} className="w-full h-full object-cover" loading="lazy" />
                                                 <div className="absolute top-0 left-0 bg-black/80 px-1 py-0.2 rounded-br text-[8px] font-bold text-white font-mono">
                                                     #{displayNum}
                                                 </div>
                                                 <div className="absolute bottom-0 inset-x-0 bg-black/90 text-[8px] font-mono font-bold text-center truncate px-0.5 text-brand-accent">
                                                     {img.fileName ? img.fileName : (img.id ? img.id : `V${displayNum}`)}
                                                 </div>
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                        )}

                        <div className="relative flex-grow flex flex-col items-center justify-center animate-fade-in group order-1 lg:order-2 overflow-visible w-full min-w-0">
                             {/* Top Toolbar: Active Ad Info & Export Controls cleanly positioned */}
                             <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 z-20 px-1">
                                  <div className="text-center sm:text-left text-xs text-gray-400 font-semibold tracking-wider bg-brand-secondary px-3.5 py-1.5 rounded-full border border-gray-800 flex items-center gap-2.5 flex-wrap shadow-sm">
                                       <span>Active Display: <span className="text-brand-accent font-bold">{activeAd.fileName ? `${activeAd.fileName} (V${activeAd.variantIndex !== undefined ? activeAd.variantIndex + 1 : activeIndex + 1})` : (activeAd.id ? `ID: ${activeAd.id} (V${activeAd.variantIndex !== undefined ? activeAd.variantIndex + 1 : activeIndex + 1})` : `Variant ${activeAd.variantIndex !== undefined ? activeAd.variantIndex + 1 : activeIndex + 1}`)}</span></span>
                                       {activeAd.fileName && (
                                           <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm" title={`Attached Image File Name: "${activeAd.fileName}"`}>
                                               <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                               File: {activeAd.fileName}
                                           </span>
                                       )}
                                       <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                                           <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                           Model: {activeAd.modelUsed || 'gemini-3-pro-image'}
                                       </span>
                                  </div>
                                  <div className="flex-shrink-0">
                                      <ExportControls 
                                          generatedAd={activeAd.url} 
                                          generatedVideo={null} 
                                          allBatchImages={images}
                                          activeAdId={activeAd.id}
                                          activeAdFileName={activeAd.fileName}
                                          activeVariantIndex={activeAd.variantIndex !== undefined ? activeAd.variantIndex : activeIndex}
                                          className="relative"
                                      />
                                  </div>
                             </div>

                             <SocialPreviewWrapper mode={previewMode}>
                                <img 
                                    src={activeAd.url} 
                                    alt={`Generated ad variation ${activeAd.variantIndex !== undefined ? activeAd.variantIndex + 1 : activeIndex + 1}`} 
                                    className="object-contain w-full h-full max-h-[70vh] cursor-zoom-in rounded-lg shadow-2xl" 
                                    onClick={() => onImageClick?.(activeAd.url)}
                                />
                            </SocialPreviewWrapper>
                            {isEditing && (
                                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg z-20">
                                    <LoadingSpinner text="Editing image..." />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prompts/Generations Failures Report */}
                    {generatedAds && generatedAds.errors && generatedAds.errors.length > 0 && (
                        <div className="mt-4">
                            {renderErrorReport(generatedAds.errors)}
                        </div>
                    )}
                </div>
            );
        }

        if (generatedVideo) {
            return (
                <div className="w-full h-full flex flex-col gap-4">
                    <div className="w-full flex items-center justify-end z-20 px-1">
                        <ExportControls generatedAd={null} generatedVideo={generatedVideo} className="relative" />
                    </div>
                    <div className="relative w-full flex-grow animate-fade-in flex items-center justify-center">
                        <SocialPreviewWrapper mode={previewMode}>
                            <video src={generatedVideo} controls autoPlay loop className="object-contain w-full h-full max-h-[70vh]" />
                        </SocialPreviewWrapper>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-full w-full text-center text-gray-400 py-20">
                <SparklesIcon className="w-16 h-16 mb-4 animate-pulse text-brand-accent" />
                <h3 className="text-2xl font-bold text-white mb-2">Your Ad Will Appear Here</h3>
                <p className="max-w-xs mx-auto">Fill out the details on the left and click "Generate" to see the magic happen!</p>
            </div>
        );
    };

    const hasContent = totalCount > 0 || !!generatedVideo;

    return (
        <div className="w-full h-full flex flex-col gap-4">
            {/* Top View Selector Tabs: Focus View vs Bulk Gallery Tab */}
            {totalCount > 1 && (
                <div className="flex items-center justify-between bg-black/40 border border-white/10 p-1.5 rounded-xl">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPreviewMode(prev => prev === 'bulk' ? 'default' : prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                previewMode !== 'bulk'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <PhotoIcon className="w-4 h-4" />
                            <span>Single Focus View</span>
                        </button>
                        <button
                            onClick={() => setPreviewMode('bulk')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                previewMode === 'bulk'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Squares2X2Icon className="w-4 h-4" />
                            <span>Bulk Gallery Tab</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono font-extrabold">
                                {totalCount}
                            </span>
                        </button>
                    </div>

                    <span className="text-[11px] text-gray-400 font-medium px-2 hidden sm:inline">
                        {previewMode === 'bulk' ? 'Viewing all batch variations in full grid' : `Viewing ad ${activeIndex + 1} of ${totalCount}`}
                    </span>
                </div>
            )}

            {/* Main Stage Display */}
            <div className="w-full min-h-[50vh] bg-brand-primary rounded-2xl flex items-center justify-center p-4 sm:p-6 relative overflow-hidden border border-gray-800">
                {renderContent()}
            </div>

            {/* Bottom Preview Mode Switcher (Default, Story, Post, and Bulk Gallery) */}
            {hasContent && (
                <div className="flex-shrink-0 bg-brand-primary rounded-xl p-3 flex flex-wrap items-center justify-center gap-2.5 border border-gray-800">
                    <span className="text-xs font-bold text-brand-accent uppercase tracking-widest mr-1">Preview Mode</span>
                    <div className="flex bg-brand-secondary rounded-lg p-1 flex-wrap gap-1">
                        <button 
                            onClick={() => setPreviewMode('default')} 
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                previewMode === 'default' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            Default
                        </button>
                        <button 
                            onClick={() => setPreviewMode('story')} 
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                previewMode === 'story' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            Story Mockup
                        </button>
                        <button 
                            onClick={() => setPreviewMode('post')} 
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                previewMode === 'post' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            Post Mockup
                        </button>
                        {totalCount > 1 && (
                            <button 
                                onClick={() => setPreviewMode('bulk')} 
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    previewMode === 'bulk' 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                                        : 'text-indigo-300 hover:text-white hover:bg-indigo-950/40 border border-indigo-500/20'
                                }`}
                            >
                                <Squares2X2Icon className="w-3.5 h-3.5" />
                                <span>Bulk Gallery ({totalCount})</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
