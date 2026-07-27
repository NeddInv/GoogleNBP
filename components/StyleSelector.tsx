import React from 'react';
import { STYLE_OPTIONS } from '../constants';

interface StyleSelectorProps {
    selected: string;
    onSelect: (value: string) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ selected, onSelect }) => {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
                {STYLE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => onSelect(option.value)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                            selected === option.value
                                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                                : 'bg-brand-primary hover:bg-gray-700'
                        }`}
                        aria-pressed={selected === option.value}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
