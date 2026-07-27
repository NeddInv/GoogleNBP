
import React, { useState } from 'react';
import { SparklesIcon } from './icons';

interface SloganGeneratorProps {
    productName: string;
    onProductNameChange: (value: string) => void;
    slogan: string;
    onSloganChange: (value: string) => void;
    onGenerateSlogans: (productName: string) => Promise<string[]>;
}

export const SloganGenerator: React.FC<SloganGeneratorProps> = ({
    productName,
    onProductNameChange,
    slogan,
    onSloganChange,
    onGenerateSlogans,
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSlogans, setGeneratedSlogans] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!productName) {
            setError('Please enter a product name or description first.');
            return;
        }
        setIsGenerating(true);
        setError(null);
        setGeneratedSlogans([]);
        try {
            const slogans = await onGenerateSlogans(productName);
            setGeneratedSlogans(slogans);
        } catch (err) {
            setError('Failed to generate slogans. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={productName}
                    onChange={(e) => onProductNameChange(e.target.value)}
                    placeholder="Product name or description"
                    className="w-full p-3 bg-brand-primary border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition duration-200"
                />
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !productName}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-accent hover:bg-indigo-400 text-brand-primary font-bold rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isGenerating ? 'Generating...' : 'Get Slogans'}
                </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {generatedSlogans.length > 0 && (
                 <div className="flex flex-wrap gap-2 animate-fade-in">
                    {generatedSlogans.map((s, index) => (
                        <button key={index} onClick={() => onSloganChange(s)} className="px-3 py-1 text-sm bg-brand-primary border border-brand-accent rounded-full hover:bg-brand-accent hover:text-brand-primary transition-colors">
                            "{s}"
                        </button>
                    ))}
                </div>
            )}
            <div>
                 <input
                    type="text"
                    value={slogan}
                    onChange={(e) => onSloganChange(e.target.value)}
                    placeholder="Enter your own slogan or generate one"
                    className="w-full p-3 bg-brand-primary border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition duration-200"
                />
            </div>
        </div>
    );
};
