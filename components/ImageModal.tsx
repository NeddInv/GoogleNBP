
import React from 'react';
import { CloseIcon } from './icons';

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    alt: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageSrc, alt }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-fade-in"
            onClick={onClose}
        >
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 text-white hover:text-brand-accent transition-colors z-[110]"
            >
                <CloseIcon className="w-8 h-8" />
            </button>
            <div 
                className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <img 
                    src={imageSrc} 
                    alt={alt} 
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
            </div>
        </div>
    );
};
