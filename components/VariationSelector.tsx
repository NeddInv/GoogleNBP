import React, { useState } from 'react';

interface VariationSelectorProps {
    selected: number;
    onSelect: (value: number) => void;
    disabled?: boolean;
    maxCount?: number;
    compact?: boolean;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({ 
    selected, 
    onSelect, 
    disabled = false, 
    maxCount = 100,
    compact = false
}) => {
    const limit = Math.max(60, maxCount, selected);
    const options = Array.from({ length: Math.min(100, limit) }, (_, i) => i + 1);
    const quickPresets = [1, 2, 4, 8, 10, 15, 20, 30, 40, 45, 50, 60, 75, 100].filter(n => n <= limit || n <= 60);

    const [customInputVal, setCustomInputVal] = useState<string>('');

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseInt(customInputVal, 10);
        if (!isNaN(val) && val >= 1) {
            onSelect(val);
            setCustomInputVal('');
        }
    };

    return (
        <div className="space-y-2.5">
            {/* Quick Presets Bar with Custom Direct Input */}
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">
                    Quick Select:
                </span>
                {quickPresets.map((preset) => {
                    const isSelected = selected === preset && !disabled;
                    return (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => onSelect(preset)}
                            disabled={disabled}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-600/40 ring-1 ring-indigo-400/50'
                                    : 'bg-black/40 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
                            } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : 'cursor-pointer active:scale-95'}`}
                            aria-pressed={isSelected}
                            aria-disabled={disabled}
                        >
                            {preset === 1 ? '1 Image' : `${preset} Vars`}
                        </button>
                    );
                })}

                {/* Direct Custom Count Input (No Upper Limit) */}
                <form onSubmit={handleCustomSubmit} className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-gray-400 font-medium">Custom:</span>
                    <input 
                        type="number"
                        min="1"
                        max="500"
                        placeholder="e.g. 60"
                        value={customInputVal}
                        onChange={(e) => setCustomInputVal(e.target.value)}
                        disabled={disabled}
                        className="w-16 px-2 py-0.5 bg-black/60 border border-white/10 rounded-md text-xs text-white text-center focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={disabled || !customInputVal}
                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                    >
                        Set
                    </button>
                </form>
            </div>

            {/* Complete Numbers Grid */}
            <div className={`p-2 bg-black/40 border border-white/10 rounded-xl ${compact ? 'max-h-36' : 'max-h-48'} overflow-y-auto scrollbar-thin`}>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                    {options.map((num) => {
                        const isSelected = selected === num && !disabled;
                        return (
                            <button
                                key={num}
                                type="button"
                                onClick={() => onSelect(num)}
                                disabled={disabled}
                                className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border ${
                                    isSelected
                                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40 font-extrabold'
                                        : 'bg-white/5 hover:bg-white/15 border-white/5 text-gray-300 hover:text-white'
                                } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-800' : 'cursor-pointer active:scale-95'}`}
                                aria-pressed={isSelected}
                                aria-disabled={disabled}
                                title={`${num} ${num === 1 ? 'variation' : 'variations'}`}
                            >
                                {num}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Currently Selected Badge */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                <span>Selected: <strong className="text-white font-bold">{selected} {selected === 1 ? 'image' : 'variations'}</strong></span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    No Limit (60+ Supported)
                </span>
            </div>

            {disabled && <p className="text-xs text-gray-400 mt-1">Variations are restricted in this specific configuration.</p>}
        </div>
    );
};
