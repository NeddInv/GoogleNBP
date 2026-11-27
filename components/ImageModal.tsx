
import React, { useState } from 'react';
import { CloseIcon, DownloadIcon } from './icons';
import { downloadImageAsPng, generateUniqueFilename } from '../utils/downloadUtils';
import { FileNamePromptModal } from './FileNamePromptModal';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    alt: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageSrc, alt }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPromptOpen, setIsPromptOpen] = useState(false);

    if (!isOpen) return null;

    const cleanAlt = alt ? alt.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) : 'AdCraft_Preview';
    const defaultBaseName = cleanAlt || 'AdCraft_Preview';

    const executeDownload = async (customBaseName?: string) => {
        setIsDownloading(true);
        try {
            const finalBase = customBaseName || defaultBaseName;
            const filename = `${finalBase}.png`;
            await downloadImageAsPng(imageSrc, filename);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPromptOpen(true);
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div className="absolute top-6 right-6 flex items-center gap-3 z-[110]">
                <button
                    onClick={handleDownloadClick}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xl transition-all border border-emerald-400/30 active:scale-95"
                    title="Export as PNG (keep default name or enter a new one)"
                >
                    <DownloadIcon className="w-4 h-4" />
                    {isDownloading ? 'Downloading...' : 'Export PNG'}
                </button>

                <button 
                    onClick={onClose}
                    className="p-2 text-white hover:text-brand-accent hover:bg-white/10 rounded-xl transition-colors"
                    aria-label="Close lightbox"
                >
                    <CloseIcon className="w-8 h-8" />
                </button>
            </div>

            <div 
                className="relative max-w-5xl w-full max-h-[85vh] flex items-center justify-center p-2"
                onClick={(e) => e.stopPropagation()}
            >
                <img 
                    src={imageSrc} 
                    alt={alt} 
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                />
            </div>

            {/* Filename prompt modal */}
            <FileNamePromptModal
                isOpen={isPromptOpen}
                onClose={() => setIsPromptOpen(false)}
                onConfirm={(name) => executeDownload(name)}
                title="Export Image Preview"
                description="Choose whether to keep the default file name or specify a custom name before downloading."
                defaultName={defaultBaseName}
                extension="png"
            />
        </div>
    );
};
