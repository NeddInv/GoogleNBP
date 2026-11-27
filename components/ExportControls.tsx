import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DownloadIcon, ArchiveIcon, PencilIcon } from './icons';
import { downloadImagesAsZip } from '../services/zipService';
import { downloadImageAsPng, formatFilenameWithId, formatFilenameWithFileOrId, sanitizeIdForFilename, downloadImagesSequentially, generateUniqueFilename } from '../utils/downloadUtils';
import { FileNamePromptModal } from './FileNamePromptModal';

export interface BatchAdItem {
    url: string;
    id?: string;
    fileName?: string;
    variantIndex?: number;
}

export interface ExportControlsProps {
    generatedAd: string | null;
    activeAdId?: string;
    activeAdFileName?: string;
    activeVariantIndex?: number;
    generatedVideo: string | null;
    allBatchImages?: (string | BatchAdItem)[];
    className?: string;
}

export const ExportControls: React.FC<ExportControlsProps> = ({ 
    generatedAd, 
    activeAdId,
    activeAdFileName,
    activeVariantIndex,
    generatedVideo, 
    allBatchImages = [],
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
    const [quality, setQuality] = useState(0.95);
    const [isZippingBatch, setIsZippingBatch] = useState(false);
    const [isDownloadingSeparate, setIsDownloadingSeparate] = useState(false);
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
    const popoverRef = useRef<HTMLDivElement>(null);

    const targetId = activeAdId || (activeVariantIndex !== undefined ? String(activeVariantIndex + 1) : '1');

    const defaultImageBaseName = useMemo(() => {
        if (activeAdFileName && activeAdFileName.trim()) {
            return activeAdFileName.trim().replace(/\.[^/.]+$/, '');
        }
        return sanitizeIdForFilename(targetId);
    }, [activeAdFileName, targetId]);

    const defaultBatchBaseName = useMemo(() => {
        return `ads_batch_${new Date().toISOString().slice(0, 10)}`;
    }, []);

    const normalizedBatch = useMemo(() => {
        return (allBatchImages || []).map((item, idx) => {
            if (typeof item === 'string') {
                return {
                    url: item,
                    id: String(idx + 1),
                    fileName: undefined,
                    variantIndex: idx
                };
            }
            return {
                url: item.url,
                id: item.id || (item.variantIndex !== undefined ? String(item.variantIndex + 1) : String(idx + 1)),
                fileName: (item as BatchAdItem).fileName,
                variantIndex: item.variantIndex !== undefined ? item.variantIndex : idx
            };
        });
    }, [allBatchImages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Perform actual PNG single download
    const executeQuickPngDownload = async (customBaseName?: string) => {
        if (!generatedAd) return;
        const baseName = customBaseName || defaultImageBaseName;
        const filename = `${baseName}.png`;
        await downloadImageAsPng(generatedAd, filename);
        setIsOpen(false);
    };

    // Prompt user with option to keep default or enter new name before PNG export
    const handleQuickPngDownload = () => {
        if (!generatedAd) return;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export Ad Image (PNG)',
            subtitle: `Active ID: ${targetId}`,
            description: 'Choose whether to keep the default file name or specify a custom name for this image.',
            defaultName: defaultImageBaseName,
            extension: 'png',
            onConfirm: (confirmedName) => {
                executeQuickPngDownload(confirmedName);
            }
        });
    };

    // Perform actual format image download
    const executeImageDownload = (customBaseName?: string) => {
        if (!generatedAd) return;

        if (format === 'png') {
            executeQuickPngDownload(customBaseName);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = generatedAd;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width || 1024;
            canvas.height = img.height || 1024;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("Could not get canvas context");
                return;
            }
            ctx.drawImage(img, 0, 0);

            const dataUrl = canvas.toDataURL(`image/${format}`, quality);
            const baseName = customBaseName || defaultImageBaseName;
            const filename = `${baseName}.${format}`;
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsOpen(false);
        };
        img.onerror = () => {
            console.error("Failed to load image for canvas conversion.");
        };
    };

    // Prompt user before single format export
    const handleImageDownload = () => {
        if (!generatedAd) return;
        setNamePromptConfig({
            isOpen: true,
            title: `Export Ad Image (${format.toUpperCase()})`,
            subtitle: `Active ID: ${targetId}`,
            description: 'Choose whether to keep the default file name or specify a custom name before downloading.',
            defaultName: defaultImageBaseName,
            extension: format,
            onConfirm: (confirmedName) => {
                executeImageDownload(confirmedName);
            }
        });
    };

    // Perform actual ZIP download
    const executeBatchZipDownload = async (customZipBaseName?: string) => {
        if (normalizedBatch.length === 0) return;
        setIsZippingBatch(true);
        try {
            const baseName = customZipBaseName || defaultBatchBaseName;
            const zipFilename = `${baseName}.zip`;
            await downloadImagesAsZip(
                normalizedBatch.map((item) => ({
                    url: item.url,
                    name: item.fileName 
                        ? sanitizeIdForFilename(item.fileName.replace(/\.[^/.]+$/, ''))
                        : sanitizeIdForFilename(item.id)
                })),
                zipFilename,
                format
            );
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to zip batch images:", err);
            alert("Could not download batch ZIP. Please try again.");
        } finally {
            setIsZippingBatch(false);
        }
    };

    // Prompt user before ZIP export
    const handleBatchZipDownload = () => {
        if (normalizedBatch.length === 0) return;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export Batch Archive (ZIP)',
            subtitle: `${normalizedBatch.length} ads in .${format.toUpperCase()} format`,
            description: 'Choose whether to keep the default archive name or enter a new ZIP file name before export.',
            defaultName: defaultBatchBaseName,
            extension: 'zip',
            isBatch: true,
            batchCount: normalizedBatch.length,
            onConfirm: (confirmedName) => {
                executeBatchZipDownload(confirmedName);
            }
        });
    };

    // Perform actual sequential separate download
    const executeBatchSeparateDownload = async (customPrefix?: string) => {
        if (normalizedBatch.length === 0) return;
        setIsDownloadingSeparate(true);
        try {
            const items = normalizedBatch.map((item, idx) => {
                if (customPrefix && customPrefix !== defaultBatchBaseName) {
                    const itemName = `${customPrefix}_${idx + 1}.${format}`;
                    return {
                        url: item.url,
                        name: itemName
                    };
                }
                return {
                    url: item.url,
                    name: formatFilenameWithFileOrId(item.fileName, item.id, format)
                };
            });
            await downloadImagesSequentially(items, format, quality, 250);
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to download individual batch images:", err);
            alert("Could not download individual images. Please try again.");
        } finally {
            setIsDownloadingSeparate(false);
        }
    };

    // Prompt user before separate files export
    const handleBatchSeparateDownload = () => {
        if (normalizedBatch.length === 0) return;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export Batch Files Separately',
            subtitle: `${normalizedBatch.length} ad files directly to Downloads`,
            description: 'Choose whether to keep default individual names (from schema IDs / uploaded files) or enter a new custom prefix for all files before export.',
            defaultName: defaultBatchBaseName,
            extension: format,
            isBatch: true,
            batchCount: normalizedBatch.length,
            onConfirm: (confirmedName) => {
                executeBatchSeparateDownload(confirmedName);
            }
        });
    };
    
    // Perform actual Video download
    const executeVideoDownload = (customBaseName?: string) => {
        if (!generatedVideo) return;
        const baseName = customBaseName || 'AdCraft_Motion_Video_Ad';
        const filename = `${baseName}.mp4`;
        const link = document.createElement('a');
        link.href = generatedVideo;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    // Prompt user before video export
    const handleVideoDownload = () => {
        if (!generatedVideo) return;
        setNamePromptConfig({
            isOpen: true,
            title: 'Export Video Ad (MP4)',
            subtitle: 'Generated Motion Ad',
            description: 'Choose whether to keep the default video file name or specify a new name before downloading.',
            defaultName: 'AdCraft_Motion_Video_Ad',
            extension: 'mp4',
            onConfirm: (confirmedName) => {
                executeVideoDownload(confirmedName);
            }
        });
    };

    if (!generatedAd && !generatedVideo) {
        return null;
    }

    return (
        <div className={className || "relative"} ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg z-20 relative text-xs uppercase tracking-wider"
                aria-label="Export options"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <DownloadIcon className="w-4 h-4" />
                Export / Download
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-84 bg-brand-secondary rounded-xl shadow-2xl border border-gray-600 p-4 z-30 animate-fade-in">
                    {generatedAd && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-700">
                                <div>
                                    <h4 className="font-bold text-white text-sm">Image Export</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[11px] text-gray-400">Default:</span>
                                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30 truncate max-w-[140px]" title={`${defaultImageBaseName}.png`}>
                                            {defaultImageBaseName}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded border border-emerald-500/30">
                                    Ready
                                </span>
                            </div>

                            {/* Direct Primary PNG Button with Filename Option */}
                            <button
                                onClick={handleQuickPngDownload}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-lg transition-all shadow-md active:scale-95 text-xs uppercase tracking-wider"
                                title={`Download PNG (option to keep "${defaultImageBaseName}.png" or enter a new name)`}
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Download PNG (Export)
                            </button>

                            <div>
                                <label className="block text-xs font-semibold text-brand-light mb-1.5">Select Format</label>
                                <div className="flex bg-brand-primary rounded-lg p-1 border border-gray-700">
                                    <button onClick={() => setFormat('png')} className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${format === 'png' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>PNG</button>
                                    <button onClick={() => setFormat('webp')} className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${format === 'webp' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>WebP</button>
                                    <button onClick={() => setFormat('jpeg')} className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${format === 'jpeg' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>JPEG</button>
                                </div>
                            </div>

                            {(format === 'jpeg' || format === 'webp') && (
                                <div className="animate-fade-in">
                                    <label htmlFor="quality" className="block text-xs font-medium text-brand-light mb-1">Quality: {Math.round(quality * 100)}%</label>
                                    <input
                                        id="quality"
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.01"
                                        value={quality}
                                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                                    />
                                </div>
                            )}

                            {format !== 'png' && (
                                <button
                                    onClick={handleImageDownload}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Download Single .{format.toUpperCase()}
                                </button>
                            )}

                            {normalizedBatch.length > 1 && (
                                <div className="pt-3 border-t border-gray-700 space-y-2">
                                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                        Bulk Batch Downloads ({normalizedBatch.length} ads)
                                    </div>
                                    <button
                                        onClick={handleBatchZipDownload}
                                        disabled={isZippingBatch || isDownloadingSeparate}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider shadow-md"
                                        title="Download ZIP archive with filename confirmation"
                                    >
                                        <ArchiveIcon className="w-4 h-4" />
                                        {isZippingBatch ? 'Creating ZIP...' : `Download All (ZIP .${format.toUpperCase()})`}
                                    </button>

                                    <button
                                        onClick={handleBatchSeparateDownload}
                                        disabled={isZippingBatch || isDownloadingSeparate}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider"
                                        title="Download each ad file with filename confirmation"
                                    >
                                        <DownloadIcon className="w-4 h-4 text-emerald-400" />
                                        {isDownloadingSeparate ? 'Downloading...' : `Download All Separately (.${format.toUpperCase()})`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {generatedVideo && (
                         <div className="space-y-2">
                            <h4 className="font-semibold text-white text-sm">Video Export</h4>
                            <p className="text-xs text-gray-400">Videos will be downloaded as MP4.</p>
                             <button
                                onClick={handleVideoDownload}
                                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-wider"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                Download MP4
                            </button>
                        </div>
                    )}
                </div>
            )}

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
        </div>
    );
};
