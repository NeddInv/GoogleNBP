import React from 'react';
import { CloseIcon } from './icons';

interface HistoryItem {
    thumbnail: string;
    fullRes: string;
}

interface HistoryDisplayProps {
    history: HistoryItem[];
    onImageSelect: (imageUrl: string) => void;
    onClearHistory: () => void;
}

export const HistoryDisplay: React.FC<HistoryDisplayProps> = ({ history, onImageSelect, onClearHistory }) => {
    if (history.length === 0) {
        return null;
    }

    return (
        <section className="mt-8 bg-brand-secondary p-6 rounded-2xl shadow-lg animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-white">Generation History</h2>
                <button 
                    onClick={onClearHistory}
                    className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
                    aria-label="Clear all items from history"
                >
                    <CloseIcon className="w-4 h-4" />
                    Clear History
                </button>
            </div>
            <div className="flex overflow-x-auto space-x-4 pb-4 -mx-6 px-6">
                {history.map((item, index) => (
                    <div key={index} className="flex-shrink-0 w-32 h-32 group relative" role="button" tabIndex={0} onClick={() => onImageSelect(item.fullRes)} onKeyDown={(e) => e.key === 'Enter' && onImageSelect(item.fullRes)}>
                        <img
                            src={item.thumbnail}
                            alt={`Generated ad ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg cursor-pointer border-2 border-transparent group-hover:border-brand-accent transition-all"
                        />
                         <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center pointer-events-none">
                            <p className="text-white opacity-0 group-hover:opacity-100 font-bold text-sm">View</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
