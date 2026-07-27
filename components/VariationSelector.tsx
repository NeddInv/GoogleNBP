
import React from 'react';

const VARIATION_OPTIONS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 
    31, 32, 33, 34, 35, 36, 37, 38, 39, 40
];

interface VariationSelectorProps {
    selected: number;
    onSelect: (value: number) => void;
    disabled?: boolean;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({ selected, onSelect, disabled = false }) => {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {VARIATION_OPTIONS.map((num) => (
                    <button
                        key={num}
                        onClick={() => onSelect(num)}
                        disabled={disabled}
                        className={`w-10 h-10 sm:w-12 sm:h-12 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center ${
                            selected === num && !disabled
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                : 'bg-brand-primary hover:bg-gray-700'
                        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-700' : ''}`}
                        aria-pressed={selected === num}
                        aria-disabled={disabled}
                    >
                        {num}
                    </button>
                ))}
            </div>
            {disabled && <p className="text-xs text-gray-400 mt-2">Variations are restricted in this specific configuration.</p>}
        </div>
    );
};
