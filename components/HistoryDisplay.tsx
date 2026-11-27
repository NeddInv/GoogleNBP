import React, { useState, useMemo } from 'react';
import { CloseIcon, DownloadIcon, CheckIcon, ArchiveIcon, CheckSquareIcon, ArrowPathIcon } from './icons';
import { downloadImagesAsZip } from '../services/zipService';
import { downloadImageAsPng, formatFilenameWithId, formatFilenameWithFileOrId, sanitizeIdForFilename, downloadImagesSequentially } from '../utils/downloadUtils';
import { FileNamePromptModal } from './FileNamePromptModal';

interface HistoryItem {
    thumbnail: string;
    fullRes: string;
    id?: string;
    fileName?: string;
}

interface HistoryDisplayProps {
    history: HistoryItem[];
    currentBatch?: { url: string; variantIndex: number; id?: string; fileName?: string }[];
    onImageSelect: (imageUrl: string) => void;
    onClearHistory: () => void;
    onOpenHistoricalSessions?: () => void;
}

export const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ 
    history, 
    currentBatch = [], 
    onImageSelect, 
    onClearHistory,
    onOpenHistoricalSessions 
}) => {
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [zipFormat, setZipFormat] = useState<'png' | 'webp'>('png');
    const [isZipping, setIsZipping] = useState(false);
    const [isDownloadingSeparate, setIsDownloadingSeparate] = useState(false);
    const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
    const [namePromptConfig, setNamePromptConfig] = useState<{
        isOpen: boolean;
        title: string;
        subtitle?: string;
        description?: string;
        defaultName: string;
        extension: string;
        isBatch?: boolean;
        batchCount?: number;
        onConfirm: (confirmedName: string) => void;
    }>({
        isOpen: false,
        title: 'Confirm Export Filename',
        defaultName: '',
        extension: 'png',
        onConfirm: () => {}
    });

    // Combine all available finished images (current batch + history)
    const allFinishedImages = useMemo(() => {
        const list: { url: string; thumbnail: string; id: string; name: string; fileName?: string; source: 'batch' | 'history' }[] = [];
        
        // Add current batch
        currentBatch.forEach((item) => {
            if (item.url) {
                const schemaId = item.id || String(item.variantIndex + 1);
                list.push({
                    url: item.url,
                    thumbnail: item.url,
                    id: schemaId,
                    name: item.fileName || schemaId,
                    fileName: item.fileName,
                    source: 'batch'
                });
            }
        });

        // Add history items
        history.forEach((item, index) => {
            if (item.fullRes && !list.some(existing => existing.url === item.fullRes)) {
                const schemaId = item.id || String(index + 1);
                list.push({
                    url: item.fullRes,
                    thumbnail: item.thumbnail || item.fullRes,
                    id: schemaId,
                    name: item.fileName || schemaId,
                    fileName: item.fileName,
                    source: 'history'
                });
            }
        });

        return list;
    }, [history, currentBatch]);

    if (allFinishedImages.length === 0) {
        return null;
    }

    const allSelected = allFinishedImages.length > 0 && selectedUrls.size === allFinishedImages.length;

    const handleToggleSelectAll = () => {
        if (allSelected) {
            setSelectedUrls(new Set());
        } else {
            const newSet = new Set<string>();
            allFinishedImages.forEach(img => newSet.add(img.url));
            setSelectedUrls(newSet);
        }
    };

    const handleToggleImage = (url: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedUrls(prev => {
            const next = new Set(prev);
            if (next.has(url)) {
                next.delete(url);
            } else {
                next.add(url);
            }
            return next;
        });
    };

    const executeSinglePngDownload = async (url: string, id: string, fileName?: string, customBaseName?: string) => {
        const defaultBase = fileName ? fileName.replace(/\.[^/.]+$/, '') : sanitizeIdForFilename(id);
        const finalBase = customBaseName || defaultBase;
        const filename = `${finalBase}.png`;
        await downloadImageAsPng(url, filename);
    };

    const handleSinglePngDownload = (url: string, id: string, fileName?: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const defaultBase = fileName ? fileName.replace(/\.[^/.]+$/, '') : sanitizeIdForFilename(id);
        setNamePromptConfig({
            isOpen: true,
            title: 'Export History Image (PNG)',
            subtitle: fileName ? `Source: ${fileName}` : `ID: ${id}`,
            description: 'Choose whether to keep the default file name or specify a custom name before downloading.',
            defaultName: defaultBase,
            extension: 'png',
            onConfirm: (confirmedName) => {
                executeSinglePngDownload(url, id, fileName, confirmedName);
            }
        });
    };

    const executeBulkDownloadZip = async (customZipBaseName?: string) => {
        const imagesToDownload = allFinishedImages.filter(img => selectedUrls.has(img.url));
        if (imagesToDownload.length === 0) return;

        setIsZipping(true);
        setZipProgress({ current: 0, total: imagesToDownload.length });

        try {
            const defaultZipBase = `finished_ads_${new Date().toISOString().slice(0, 10)}`;
            const zipFilename = `${customZipBaseName || defaultZipBase}.zip`;
            await downloadImagesAsZip(
                imagesToDownload.map((img) => ({
                    url: img.url,
                    name: img.fileName ? sanitizeIdForFilename(img.fileName.replace(/\.[^/.]+$/, '')) : sanitizeIdForFilename(img.id)
                })),
                zipFilename,
                zipFormat,
                (processed, total) => {
                    setZipProgress({ current: processed, total });
                }
            );
        } catch (err) {
            console.error("Bulk ZIP download failed:", err);
            alert(`An error occurred while creating the ${zipFormat.toUpperCase()} ZIP archive. Please try again.`);
        } finally {
            setIsZipping(false);
            setZipProgress(null);
        }
    };

    const handleBulkDownloadZip = () => {
        const imagesToDownload = allFinishedImages.filter(img => selectedUrls.has(img.url));
        if (imagesToDownload.length === 0) return;

        const defaultZipBase = `finished_ads_${new Date().toISOString().slice(0, 10)}`;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export History Batch (ZIP)',
            subtitle: `${imagesToDownload.length} images in .${zipFormat.toUpperCase()} archive`,
            description: 'Choose whether to keep the default ZIP archive name or enter a new file name before export.',
            defaultName: defaultZipBase,
            extension: 'zip',
            isBatch: true,
            batchCount: imagesToDownload.length,
            onConfirm: (confirmedName) => {
                executeBulkDownloadZip(confirmedName);
            }
        });
    };

    const executeBulkDownloadSeparate = async (customPrefix?: string) => {
        const imagesToDownload = allFinishedImages.filter(img => selectedUrls.has(img.url));
        if (imagesToDownload.length === 0) return;

        setIsDownloadingSeparate(true);
        try {
            const items = imagesToDownload.map((img, idx) => {
                if (customPrefix) {
                    return {
                        url: img.url,
                        name: `${customPrefix}_${idx + 1}.${zipFormat}`
                    };
                }
                return {
                    url: img.url,
                    name: formatFilenameWithFileOrId(img.fileName, img.id, zipFormat)
                };
            });
            await downloadImagesSequentially(items, zipFormat, 0.95, 250);
        } catch (err) {
            console.error("Individual downloads failed:", err);
            alert("An error occurred while downloading files.");
        } finally {
            setIsDownloadingSeparate(false);
        }
    };

    const handleBulkDownloadSeparate = () => {
        const imagesToDownload = allFinishedImages.filter(img => selectedUrls.has(img.url));
        if (imagesToDownload.length === 0) return;

        const defaultPrefix = `finished_ads_${new Date().toISOString().slice(0, 10)}`;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export History Items Separately',
            subtitle: `${imagesToDownload.length} individual images directly to Downloads`,
            description: 'Choose whether to keep default item names or enter a custom prefix for all files before export.',
            defaultName: defaultPrefix,
            extension: zipFormat,
            isBatch: true,
            batchCount: imagesToDownload.length,
            onConfirm: (confirmedName) => {
                const prefixToUse = confirmedName !== defaultPrefix ? confirmedName : undefined;
                executeBulkDownloadSeparate(prefixToUse);
            }
        });
    };

    return (
        <section className="mt-8 bg-brand-secondary p-6 rounded-2xl shadow-lg border border-gray-800 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-800">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ArchiveIcon className="w-6 h-6 text-brand-accent" />
                        Finished Images & History
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        Select finished images to bulk download as a PNG or WebP ZIP archive, or click any thumbnail to download as PNG directly.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Format Toggle */}
                    <div className="flex bg-brand-primary p-0.5 rounded-xl border border-gray-700 text-xs font-bold">
                        <button
                            onClick={() => setZipFormat('png')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${zipFormat === 'png' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            PNG ZIP
                        </button>
                        <button
                            onClick={() => setZipFormat('webp')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${zipFormat === 'webp' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            WebP ZIP
                        </button>
                    </div>

                    {/* Quick Select All Button */}
                    <button
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-all border border-gray-700 active:scale-95"
                        title={allSelected ? "Deselect All Images" : "Quick Select All Finished Images"}
                    >
                        <CheckSquareIcon className={`w-4 h-4 ${allSelected ? 'text-green-400' : 'text-gray-400'}`} />
                        {allSelected ? 'Deselect All' : `Quick Select All (${allFinishedImages.length})`}
                    </button>

                    {/* Bulk ZIP Download Button */}
                    <button
                        onClick={handleBulkDownloadZip}
                        disabled={selectedUrls.size === 0 || isZipping || isDownloadingSeparate}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-md active:scale-95 ${
                            selectedUrls.size > 0 && !isZipping && !isDownloadingSeparate
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        }`}
                        title="Download ZIP archive with all files named after their schema ID"
                    >
                        <DownloadIcon className={`w-4 h-4 ${isZipping ? 'animate-bounce' : ''}`} />
                        {isZipping
                            ? `Creating ZIP... (${zipProgress?.current || 0}/${zipProgress?.total || 0})`
                            : `Download ZIP (${selectedUrls.size}) .${zipFormat}`}
                    </button>

                    {/* Bulk Separate Download Button */}
                    <button
                        onClick={handleBulkDownloadSeparate}
                        disabled={selectedUrls.size === 0 || isZipping || isDownloadingSeparate}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all border border-white/10 active:scale-95 ${
                            selectedUrls.size > 0 && !isZipping && !isDownloadingSeparate
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        title="Download separate image files directly named after their schema ID"
                    >
                        <DownloadIcon className="w-4 h-4 text-emerald-400" />
                        {isDownloadingSeparate ? 'Downloading...' : 'Download Separately'}
                    </button>

                    {/* Restart from Historical References Button */}
                    {onOpenHistoricalSessions && (
                        <button
                            type="button"
                            onClick={onOpenHistoricalSessions}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-300 text-xs font-bold rounded-xl transition-colors border border-emerald-700/40 ml-auto md:ml-0 active:scale-95 cursor-pointer"
                            title="Restart program from historical session references or switch checkpoint"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5 text-emerald-400" />
                            Restart from References
                        </button>
                    )}

                    {/* Clear History Button */}
                    {(history.length > 0 || currentBatch.length > 0) && (
                        <button 
                            onClick={() => {
                                setSelectedUrls(new Set());
                                onClearHistory();
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 text-xs font-bold rounded-xl transition-colors border border-red-800/50 active:scale-95"
                            aria-label="Clear all items from history"
                        >
                            <CloseIcon className="w-4 h-4" />
                            Clear History
                        </button>
                    )}
                </div>
            </div>

            {/* Selection status bar */}
            {selectedUrls.size > 0 && (
                <div className="mb-4 bg-indigo-950/60 border border-indigo-800/50 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-indigo-200 animate-fade-in">
                    <div className="flex items-center gap-2 font-semibold">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span>{selectedUrls.size} of {allFinishedImages.length} images selected</span>
                    </div>
                    <button
                        onClick={() => setSelectedUrls(new Set())}
                        className="text-indigo-400 hover:text-white underline font-semibold text-[11px]"
                    >
                        Clear Selection
                    </button>
                </div>
            )}

            {/* Images Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {allFinishedImages.map((item, index) => {
                    const isSelected = selectedUrls.has(item.url);
                    return (
                        <div 
                            key={`${item.url}_${index}`} 
                            className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                                isSelected 
                                    ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/20' 
                                    : 'border-gray-800 hover:border-gray-600'
                            }`}
                            onClick={() => onImageSelect(item.url)}
                        >
                            <div className="w-full h-36 bg-gray-950 relative">
                                <img
                                    src={item.thumbnail}
                                    alt={`Finished ad image ${item.id}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                />

                                {/* Checkbox Toggle Button */}
                                <button
                                    type="button"
                                    onClick={(e) => handleToggleImage(item.url, e)}
                                    className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-10 ${
                                        isSelected 
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40' 
                                            : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-white border border-white/20'
                                    }`}
                                    title={isSelected ? "Deselect Image" : "Select Image"}
                                >
                                    <CheckIcon className={`w-4 h-4 ${isSelected ? 'opacity-100 stroke-[3]' : 'opacity-0 group-hover:opacity-100'}`} />
                                </button>

                                {/* Quick Direct Download PNG Button on top right */}
                                <button
                                    type="button"
                                    onClick={(e) => handleSinglePngDownload(item.url, item.id, item.fileName, e)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-emerald-600 text-white rounded-lg transition-all border border-white/20 z-10 opacity-0 group-hover:opacity-100 shadow-md"
                                    title={item.fileName ? `Download "${item.fileName}"` : `Download "${item.id}.png"`}
                                >
                                    <DownloadIcon className="w-3.5 h-3.5" />
                                </button>

                                {/* Schema ID / Attached File Badge */}
                                <div className="absolute bottom-2 left-2 bg-black/85 backdrop-blur-md text-[10px] font-mono font-bold px-2 py-0.5 rounded text-brand-accent border border-brand-accent/30 shadow-md max-w-[70%] truncate" title={item.fileName ? `File: "${item.fileName}" (ID: ${item.id})` : `ID: ${item.id}`}>
                                    {item.fileName ? item.fileName : `ID: ${item.id}`}
                                </div>

                                {/* Source Badge */}
                                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-[9px] font-bold px-1.5 py-0.5 rounded text-gray-400 border border-white/10">
                                    {item.source === 'batch' ? 'Batch' : 'Saved'}
                                </div>

                                {/* Hover View Label */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <span className="text-white text-xs font-bold bg-black/70 px-2.5 py-1 rounded-full border border-white/20">
                                        Click to View
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filename confirmation prompt modal */}
            <FileNamePromptModal
                isOpen={namePromptConfig.isOpen}
                onClose={() => setNamePromptConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={namePromptConfig.onConfirm}
                title={namePromptConfig.title}
                subtitle={namePromptConfig.subtitle}
                description={namePromptConfig.description}
                defaultName={namePromptConfig.defaultName}
                extension={namePromptConfig.extension}
                isBatch={namePromptConfig.isBatch}
                batchCount={namePromptConfig.batchCount}
            />
        </section>
    );
};
