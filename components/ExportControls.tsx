import React, { useState, useRef, useEffect } from 'react';
import { DownloadIcon } from './icons';

interface ExportControlsProps {
    generatedAd: string | null;
    generatedVideo: string | null;
}

export const ExportControls: React.FC<ExportControlsProps> = ({ generatedAd, generatedVideo }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('webp');
    const [quality, setQuality] = useState(0.92);
    const popoverRef = useRef<HTMLDivElement>(null);

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

    const handleImageDownload = () => {
        if (!generatedAd) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = generatedAd;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("Could not get canvas context");
                return;
            }
            ctx.drawImage(img, 0, 0);

            const dataUrl = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? quality : undefined);
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `generated-ad.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsOpen(false);
        };
        img.onerror = () => {
            console.error("Failed to load image for canvas conversion.");
        }
    };
    
    const handleVideoDownload = () => {
        if (!generatedVideo) return;
        const link = document.createElement('a');
        link.href = generatedVideo;
        link.download = 'generated-ad.mp4';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    if (!generatedAd && !generatedVideo) {
        return null;
    }

    return (
        <div className="absolute top-4 right-4" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg z-20 relative"
                aria-label="Export options"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <DownloadIcon className="w-5 h-5" />
                Export
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-brand-secondary rounded-lg shadow-2xl border border-gray-600 p-4 z-10 animate-fade-in">
                    {generatedAd && (
                        <div className="space-y-4">
                            <h4 className="font-semibold text-white">Image Export Options</h4>
                            <div>
                                <label className="block text-sm font-medium text-brand-light mb-2">Format</label>
                                <div className="flex bg-brand-primary rounded-md p-1">
                                    <button onClick={() => setFormat('webp')} className={`w-full text-sm py-1 rounded-md transition-colors ${format === 'webp' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>WebP</button>
                                    <button onClick={() => setFormat('png')} className={`w-full text-sm py-1 rounded-md transition-colors ${format === 'png' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>PNG</button>
                                    <button onClick={() => setFormat('jpeg')} className={`w-full text-sm py-1 rounded-md transition-colors ${format === 'jpeg' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>JPEG</button>
                                </div>
                            </div>
                            {(format === 'jpeg' || format === 'webp') && (
                                <div className="animate-fade-in">
                                    <label htmlFor="quality" className="block text-sm font-medium text-brand-light mb-1">Quality: {Math.round(quality * 100)}%</label>
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
                             <button
                                onClick={handleImageDownload}
                                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Download as .{format}
                            </button>
                        </div>
                    )}
                    {generatedVideo && (
                         <div className="space-y-2">
                            <h4 className="font-semibold text-white">Video Export</h4>
                            <p className="text-sm text-gray-400">Videos will be downloaded as MP4.</p>
                             <button
                                onClick={handleVideoDownload}
                                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Download MP4
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
