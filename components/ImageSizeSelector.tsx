
import React from 'react';
import type { ImageSize } from '../types';

interface ImageSizeSelectorProps {
    selected: ImageSize;
    onSelect: (value: ImageSize) => void;
    disabled: boolean;
}

export const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({ selected, onSelect, disabled }) => {
    const sizes: ImageSize[] = ['512px', '1K', '2K', '4K', '6K', '8K'];
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {sizes.map((size) => (
                    <button
                        key={size}
                        onClick={() => onSelect(size)}
                        disabled={disabled}
                        className={`px-2 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-200 text-center flex items-center justify-center ${
                            selected === size && !disabled
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                : 'bg-brand-primary hover:bg-gray-700'
                        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-700' : ''}`}
                        aria-pressed={selected === size}
                        aria-disabled={disabled}
                    >
                        {size}
                    </button>
                ))}
            </div>
            {disabled && <p className="text-xs text-gray-400 mt-2">Resolution selection is only available for Advanced models.</p>}
        </div>
    );
};
