import React, { useState } from 'react';
import type { ImageData } from '../types';
import { CloseIcon, DownloadIcon, ArchiveIcon, CheckIcon, CheckSquareIcon } from './icons';
import { downloadImagesAsZip } from '../services/zipService';
import { downloadImagesSequentially, generateUniqueFilename, formatFilenameWithId, formatFilenameWithFileOrId, sanitizeIdForFilename } from '../utils/downloadUtils';

interface BulkDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    images: ImageData[];
    defaultPrefix?: string;
}

export const BulkDownloadModal: React.FC<BulkDownloadModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    images,
    defaultPrefix = 'Product_Image'
}) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
        () => new Set(images.map((_, i) => i))
    );
    const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
    const [quality, setQuality] = useState<number>(0.95);
    const [prefix, setPrefix] = useState<string>(defaultPrefix);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadMode, setDownloadMode] = useState<'zip' | 'individual' | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    // Reset selection if images count changes
    React.useEffect(() => {
        setSelectedIndices(new Set(images.map((_, i) => i)));
        setPrefix(defaultPrefix);
    }, [images, defaultPrefix, isOpen]);

    if (!isOpen || images.length === 0) return null;

    const allSelected = selectedIndices.size === images.length;

    const handleToggleAll = () => {
        if (allSelected) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(images.map((_, i) => i)));
        }
    };

    const handleToggleIndex = (index: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const cleanPrefix = (prefix.trim() || 'Product_Image').replace(/[^a-zA-Z0-9_-]/g, '_');

    const handleDownloadZip = async () => {
        const selectedList = images
            .map((img, idx) => ({ img, idx }))
            .filter(({ idx }) => selectedIndices.has(idx));

        if (selectedList.length === 0) {
            alert('Please select at least one image to download.');
            return;
        }

        setIsDownloading(true);
        setDownloadMode('zip');
        setProgress({ current: 0, total: selectedList.length });

        try {
            const zipFilename = generateUniqueFilename(`${cleanPrefix}_Collection`, 'zip');
            const items = selectedList.map(({ img, idx }) => ({
                url: `data:${img.mimeType};base64,${img.base64}`,
                name: img.name 
                    ? sanitizeIdForFilename(img.name.replace(/\.[^/.]+$/, ''))
                    : (img.id ? sanitizeIdForFilename(img.id) : `${cleanPrefix}_${idx + 1}`)
            }));

            await downloadImagesAsZip(
                items,
                zipFilename,
                format,
                (processed, total) => {
                    setProgress({ current: processed, total });
                }
            );
            onClose();
        } catch (err) {
            console.error('Error generating bulk ZIP:', err);
            alert('An error occurred during ZIP creation. Please try again.');
        } finally {
            setIsDownloading(false);
            setDownloadMode(null);
            setProgress(null);
        }
    };

    const handleDownloadIndividual = async () => {
        const selectedList = images
            .map((img, idx) => ({ img, idx }))
            .filter(({ idx }) => selectedIndices.has(idx));

        if (selectedList.length === 0) {
            alert('Please select at least one image to download.');
            return;
        }

        setIsDownloading(true);
        setDownloadMode('individual');
        setProgress({ current: 0, total: selectedList.length });

        try {
            const items = selectedList.map(({ img, idx }) => ({
                url: `data:${img.mimeType};base64,${img.base64}`,
                name: img.name 
                    ? formatFilenameWithFileOrId(img.name, img.id, format)
                    : (img.id ? formatFilenameWithId(img.id, format) : `${cleanPrefix}_${idx + 1}.${format}`)
            }));

            for (let i = 0; i < items.length; i++) {
                setProgress({ current: i + 1, total: items.length });
                await downloadImagesSequentially([items[i]], format, quality, 200);
            }
            onClose();
        } catch (err) {
            console.error('Error downloading individual images:', err);
            alert('An error occurred during image download.');
        } finally {
            setIsDownloading(false);
            setDownloadMode(null);
            setProgress(null);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="relative bg-brand-secondary border border-gray-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-gray-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <ArchiveIcon className="w-6 h-6 text-brand-accent" />
                            <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {description || `Bulk export ${images.length} images as a single ZIP archive or individual files.`}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700 rounded-lg transition-colors"
                        aria-label="Close bulk download modal"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="mt-5 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                    {/* Prefix & Format Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-brand-light mb-1.5">
                                Filename Prefix
                            </label>
                            <input
                                type="text"
                                value={prefix}
                                onChange={(e) => setPrefix(e.target.value)}
                                placeholder="e.g. Product_Image"
                                className="w-full bg-brand-primary border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-brand-light mb-1.5">
                                Export Format
                            </label>
                            <div className="flex bg-brand-primary rounded-lg p-1 border border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setFormat('png')}
                                    className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${
                                        format === 'png' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    PNG (Lossless)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormat('jpeg')}
                                    className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${
                                        format === 'jpeg' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    JPEG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormat('webp')}
                                    className={`w-full text-xs py-1.5 rounded-md font-bold transition-all ${
                                        format === 'webp' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    WebP
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quality slider if JPEG or WebP */}
                    {format !== 'png' && (
                        <div className="bg-brand-primary/60 border border-gray-800 p-3 rounded-xl animate-fade-in">
                            <div className="flex items-center justify-between text-xs text-brand-light mb-1">
                                <span>Compression Quality</span>
                                <span className="font-bold text-brand-accent">{Math.round(quality * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="1"
                                step="0.05"
                                value={quality}
                                onChange={(e) => setQuality(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                            />
                        </div>
                    )}

                    {/* Selection Controls & Image Preview Grid */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-brand-light">
                                Select Images ({selectedIndices.size} of {images.length} selected)
                            </span>
                            <button
                                type="button"
                                onClick={handleToggleAll}
                                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                                <CheckSquareIcon className="w-3.5 h-3.5" />
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-3 bg-brand-primary rounded-xl border border-gray-800 max-h-48 overflow-y-auto">
                            {images.map((image, index) => {
                                const isSelected = selectedIndices.has(index);
                                return (
                                    <div
                                        key={index}
                                        onClick={() => handleToggleIndex(index)}
                                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
                                            isSelected
                                                ? 'border-brand-accent ring-2 ring-indigo-500/30'
                                                : 'border-gray-800 opacity-40 hover:opacity-80'
                                        }`}
                                    >
                                        <img
                                            src={`data:${image.mimeType};base64,${image.base64}`}
                                            alt={`Thumbnail ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div
                                            className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-indigo-600 text-white' : 'bg-black/60 text-transparent'
                                            }`}
                                        >
                                            <CheckIcon className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                        <div className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] text-center text-gray-200 py-0.5 font-mono truncate px-1" title={image.id ? `ID: ${image.id}` : `Image #${index + 1}`}>
                                            {image.id ? `${image.id}` : `#${index + 1}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Progress Indicator */}
                    {isDownloading && progress && (
                        <div className="p-3 bg-indigo-950/50 border border-indigo-700/50 rounded-xl space-y-2 animate-fade-in">
                            <div className="flex items-center justify-between text-xs text-indigo-200">
                                <span className="font-semibold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                                    {downloadMode === 'zip' ? 'Packaging ZIP Archive...' : 'Downloading Files...'}
                                </span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="mt-6 pt-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleDownloadIndividual}
                        disabled={isDownloading || selectedIndices.size === 0}
                        className="w-full sm:w-auto px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl transition-all border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download as Individual Files ({selectedIndices.size})
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadZip}
                        disabled={isDownloading || selectedIndices.size === 0}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wider"
                    >
                        <ArchiveIcon className="w-4 h-4" />
                        {isDownloading && downloadMode === 'zip'
                            ? `Generating ZIP (${progress?.current || 0}/${progress?.total || 0})...`
                            : `Download All as ZIP (${selectedIndices.size}) .${format.toUpperCase()}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
