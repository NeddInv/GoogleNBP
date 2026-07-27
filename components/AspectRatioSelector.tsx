import React, { useState, useEffect } from 'react';
import type { AspectRatio } from '../types';

interface RatioOption {
    label: string;
    ratio: string;
    value: AspectRatio;
    category: 'standard' | 'gdn' | 'other';
}

const RATIO_OPTIONS: RatioOption[] = [
    // Standard / Social
    { label: 'Square', ratio: '1:1', value: '1:1', category: 'standard' },
    { label: 'Portrait', ratio: '9:16', value: '9:16', category: 'standard' },
    { label: 'Landscape', ratio: '16:9', value: '16:9', category: 'standard' },
    { label: 'Widescreen', ratio: '16:10', value: '16:10', category: 'standard' },
    { label: 'Portrait / Book', ratio: '3:4', value: '3:4', category: 'standard' },
    { label: 'Instagram / Social', ratio: '4:5', value: '4:5', category: 'standard' },
    { label: 'Standard Landscape', ratio: '4:3', value: '4:3', category: 'standard' },
    { label: 'Classic Photo', ratio: '3:2', value: '3:2', category: 'standard' },
    { label: 'Panoramic', ratio: '2:1', value: '2:1', category: 'standard' },
    { label: 'Amazon Product', ratio: '97:60', value: '97:60', category: 'standard' },

    // Google Display Ads Ratios
    { label: 'GDN Responsive', ratio: '1.91:1', value: '1.91:1', category: 'gdn' },
    { label: 'Medium Rectangle (300x250)', ratio: '1.2:1', value: '1.2:1', category: 'gdn' },
    { label: 'Half-Page (300x600)', ratio: '1:2', value: '1:2', category: 'gdn' },
    { label: 'Leaderboard (728x90)', ratio: '728:90', value: '728:90', category: 'gdn' },
    { label: 'Large Leaderboard (970x90)', ratio: '970:90', value: '970:90', category: 'gdn' },
    { label: 'Wide Skyscraper (160x600)', ratio: '160:600', value: '160:600', category: 'gdn' },
    { label: 'Skyscraper (120x600)', ratio: '120:600', value: '120:600', category: 'gdn' },
    { label: 'Mobile Leaderboard (320x50)', ratio: '320:50', value: '320:50', category: 'gdn' },
    { label: 'Large Mobile (320x100)', ratio: '320:100', value: '320:100', category: 'gdn' },
    { label: 'Billboard (970x250)', ratio: '970:250', value: '970:250', category: 'gdn' },

    // Other/Specialty
    { label: 'Business Banner', ratio: '12:5', value: '12:5', category: 'other' },
    { label: 'Cinema XL', ratio: '36:13', value: '36:13', category: 'other' },
    { label: 'Cinematic Portrait', ratio: '1:4', value: '1:4', category: 'other' },
    { label: 'Ultra-Wide Portrait', ratio: '1:8', value: '1:8', category: 'other' },
    { label: 'Banner / Header', ratio: '4:1', value: '4:1', category: 'other' },
    { label: 'Ultra-Tall Banner', ratio: '8:1', value: '8:1', category: 'other' },
];

interface AspectRatioSelectorProps {
    selected: AspectRatio;
    onSelect: (value: AspectRatio) => void;
    disabled: boolean;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({ selected, onSelect, disabled }) => {
    // Determine initial active tab based on selected value
    const initialTab = RATIO_OPTIONS.find(opt => opt.value === selected)?.category || 'standard';
    const [activeTab, setActiveTab] = useState<'standard' | 'gdn' | 'other'>(initialTab);

    // Sync active tab if selected ratio changes from outside (e.g. preset or loaded state)
    useEffect(() => {
        const option = RATIO_OPTIONS.find(opt => opt.value === selected);
        if (option) {
            setActiveTab(option.category);
        }
    }, [selected]);

    const filteredOptions = RATIO_OPTIONS.filter(option => option.category === activeTab);

    return (
        <div className="space-y-4">
            {/* Category Tabs */}
            <div className="flex border-b border-gray-800 p-0.5 bg-black/40 rounded-xl">
                <button
                    type="button"
                    onClick={() => setActiveTab('standard')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                        activeTab === 'standard'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Standard & Social
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('gdn')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                        activeTab === 'gdn'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Google Display
                    <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/30 font-bold uppercase tracking-wider">GDN</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('other')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                        activeTab === 'other'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    Other Banners
                </button>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredOptions.map((option) => (
                    <button
                        type="button"
                        key={option.value}
                        onClick={() => onSelect(option.value)}
                        disabled={disabled}
                        title={`${option.label} (${option.ratio})`}
                        className={`relative group p-3 flex flex-col items-center justify-center rounded-xl transition-all duration-200 border text-center min-h-[70px] ${
                            selected === option.value && !disabled
                                ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/30'
                                : 'bg-black/25 hover:bg-black/40 border-gray-800'
                        } ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-900/30 border-gray-900' : 'cursor-pointer'}`}
                        aria-pressed={selected === option.value}
                        aria-disabled={disabled}
                    >
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-150 bg-gray-900 border border-gray-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-md shadow-2xl pointer-events-none z-30 whitespace-nowrap">
                            {option.label}
                        </div>

                        <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-400 truncate w-full px-1">
                            {option.category === 'gdn' && option.value !== '1.91:1' ? 'Google Ad Size' : option.label}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white mt-1">
                            {option.ratio}
                        </span>
                    </button>
                ))}
            </div>
            {disabled && <p className="text-xs text-gray-400 mt-2">Aspect ratio can only be selected when no images are uploaded.</p>}
        </div>
    );
};
