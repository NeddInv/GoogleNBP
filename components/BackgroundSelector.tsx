
import React from 'react';
import { BACKGROUND_OPTIONS } from '../constants';

interface BackgroundSelectorProps {
    selected: string;
    onSelect: (value: string) => void;
    custom: string;
    onCustomChange: (value: string) => void;
}

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({ selected, onSelect, custom, onCustomChange }) => {
    const isCustom = selected === 'custom';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BACKGROUND_OPTIONS.map((option) => (
                    <button
                        key={option.prompt}
                        onClick={() => onSelect(option.prompt)}
                        className={`p-3 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                            selected === option.prompt ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-brand-primary hover:bg-gray-700'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
                 <button
                    onClick={() => onSelect('custom')}
                    className={`p-3 text-sm font-medium rounded-lg transition-all duration-200 text-center ${
                        isCustom ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-brand-primary hover:bg-gray-700'
                    }`}
                >
                    Custom...
                </button>
            </div>
           
            {isCustom && (
                <div className="animate-fade-in">
                    <textarea
                        value={custom}
                        onChange={(e) => onCustomChange(e.target.value)}
                        placeholder="e.g., On the moon, next to an astronaut."
                        className="w-full p-3 bg-brand-primary border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition duration-200"
                    />
                </div>
            )}
        </div>
    );
};
