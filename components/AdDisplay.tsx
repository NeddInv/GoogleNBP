
import React, { useState, useEffect } from 'react';
import { SparklesIcon } from './icons';
import { ExportControls } from './ExportControls';
import type { PanDirection, ZoomDirection, ImageGenerationResponse } from '../types';

interface AdDisplayProps {
    generatedAds: ImageGenerationResponse | null;
    generatedVideo: string | null;
    isLoading: boolean;
    isEditing: boolean;
    error: string | null;
    generationType: 'image' | 'video' | null;
    videoLoadingMessage: string;
    imageLoadingMessage?: string;
    activeIndex: number;
    onSelectVariation: (index: number) => void;
    onImageClick?: (url: string) => void;
}

type PreviewMode = 'default' | 'story' | 'post';

const LoadingSpinner: React.FC<{text?: string}> = ({text}) => (
    <div className="flex flex-col items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {text && <p className="mt-4 text-xl font-semibold text-white">{text}</p>}
    </div>
);

const SocialPreviewWrapper: React.FC<{ mode: PreviewMode; children: React.ReactNode }> = ({ mode, children }) => {
    if (mode === 'story') {
        return (
            <div className="w-[280px] h-[500px] bg-black border-4 border-gray-700 rounded-3xl p-2 flex flex-col shadow-2xl">
                <div className="flex-grow bg-gray-900 rounded-2xl overflow-hidden relative">
                    {children}
                    <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
                         <div className="w-8 h-8 bg-gray-500 rounded-full border-2 border-white"></div>
                         <div className="w-20 h-3 bg-gray-500 rounded-full"></div>
                    </div>
                </div>
            </div>
        );
    }
    if (mode === 'post') {
        return (
             <div className="w-full max-w-md bg-[#050505] border border-gray-700 rounded-xl p-3 flex flex-col gap-3 shadow-2xl">
                 <div className="flex items-center gap-2 pointer-events-none">
                     <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
                     <div className="w-24 h-4 bg-gray-600 rounded-full"></div>
                 </div>
                <div className="w-full bg-gray-900 rounded-lg overflow-hidden aspect-square relative">{children}</div>
                 <div className="w-full h-4 bg-gray-600 rounded-full pointer-events-none"></div>
                 <div className="w-3/4 h-4 bg-gray-600 rounded-full pointer-events-none"></div>
            </div>
        )
    }
    return <>{children}</>;
};


export const AdDisplay: React.FC<AdDisplayProps> = ({ 
    generatedAds, ...props
}) => {
    const { 
        generatedVideo, isLoading, isEditing, error, generationType, videoLoadingMessage, imageLoadingMessage,
        activeIndex, onSelectVariation, onImageClick
    } = props;
    const [previewMode, setPreviewMode] = useState<PreviewMode>('default');

    useEffect(() => {
        onSelectVariation(0);
        setPreviewMode('default');
    }, [generatedAds, generatedVideo]);

    const activeAd = (generatedAds && generatedAds.images && generatedAds.images[activeIndex]) ? generatedAds.images[activeIndex] : null;

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full text-center">
                    <LoadingSpinner text={generationType === 'video' ? videoLoadingMessage : (imageLoadingMessage || 'Generating your ad...')} />
                    <p className="mt-2 text-sm text-gray-400">
                      {generationType === 'video' ? 'Video generation can take a few minutes.' : 'This might take a moment.'}
                    </p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full text-center p-4">
                    <div className="bg-red-900/50 border border-red-700 rounded-lg p-6 max-w-md">
                        <h3 className="text-xl font-bold text-red-300 mb-2">Operation Failed</h3>
                        <p className="text-red-300">{error}</p>
                    </div>
                </div>
            );
        }
        
        if (activeAd) {
            return (
                 <div className="w-full h-full flex flex-col gap-6">
                     <div className="w-full flex flex-col lg:flex-row gap-6">
                        {/* Variations Column (Left on Desktop, Bottom on Mobile) */}
                        {generatedAds && generatedAds.images && generatedAds.images.length > 1 && (
                             <div className="flex-shrink-0 lg:w-20 order-2 lg:order-1">
                                 <h4 className="text-xs font-bold mb-3 text-brand-accent uppercase tracking-wider lg:text-center">Variants</h4>
                                 <div className="flex lg:flex-col justify-start lg:justify-center gap-3 overflow-x-auto lg:overflow-y-visible pb-2 lg:pb-0 scrollbar-hide">
                                     {generatedAds.images.map((img, index) => (
                                         <button 
                                            key={index} 
                                            onClick={() => onSelectVariation(index)} 
                                            className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 transform hover:scale-105 active:scale-95 ${activeIndex === index ? 'border-brand-accent shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/20' : 'border-gray-700 hover:border-gray-500'} relative`}
                                            title={`Variant ${img.variantIndex + 1}`}
                                         >
                                             <img src={img.url} alt={`Thumbnail Variant ${img.variantIndex + 1}`} className="w-full h-full object-cover" />
                                             <div className="absolute bottom-0 right-0 bg-black/80 text-[9px] font-bold px-1 rounded-tl text-brand-accent">
                                                 V{img.variantIndex + 1}
                                             </div>
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        )}

                        <div className="relative flex-grow flex flex-col items-center justify-center animate-fade-in group order-1 lg:order-2 overflow-hidden">
                             <div className="text-center mb-3 text-xs text-gray-400 font-semibold tracking-wider bg-brand-secondary px-3 py-1 rounded-full border border-gray-800">
                                 Active Display: <span className="text-brand-accent">Variant {activeAd.variantIndex + 1}</span>
                             </div>
                             <SocialPreviewWrapper mode={previewMode}>
                                <img 
                                    src={activeAd.url} 
                                    alt={`Generated ad variation ${activeAd.variantIndex + 1}`} 
                                    className="object-contain w-full h-full max-h-[70vh] cursor-zoom-in" 
                                    onClick={() => onImageClick?.(activeAd.url)}
                                />
                            </SocialPreviewWrapper>
                            <ExportControls generatedAd={activeAd.url} generatedVideo={null} />
                            {isEditing && (
                                <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg z-20">
                                    <LoadingSpinner text="Editing image..." />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prompts/Generations Failures Report */}
                    {generatedAds && generatedAds.errors && generatedAds.errors.length > 0 && (
                        <div className="mt-4 bg-red-950/40 border border-red-900/60 rounded-xl p-4 text-left animate-fade-in">
                            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                Prompt Execution Report ({generatedAds.errors.length} failed)
                            </div>
                            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {generatedAds.errors.map((err, i) => (
                                    <div key={i} className="text-xs bg-red-950/65 border border-red-900/40 px-3 py-2 rounded-lg flex items-start gap-2 text-red-200">
                                        <span className="font-bold text-red-400 flex-shrink-0">Variant {err.variantIndex + 1}:</span>
                                        <span className="break-words font-mono text-[11px] leading-relaxed">{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (generatedVideo) {
            return (
                <div className="w-full h-full flex flex-col gap-4">
                    <div className="relative w-full flex-grow animate-fade-in flex items-center justify-center">
                        <SocialPreviewWrapper mode={previewMode}>
                            <video src={generatedVideo} controls autoPlay loop className="object-contain w-full h-full max-h-[70vh]" />
                        </SocialPreviewWrapper>
                        <ExportControls generatedAd={null} generatedVideo={generatedVideo} />
                    </div>
                </div>
            )
        }

        return (
            <div className="flex flex-col items-center justify-center h-full w-full text-center text-gray-400 py-20">
                <SparklesIcon className="w-16 h-16 mb-4 animate-pulse text-brand-accent" />
                <h3 className="text-2xl font-bold text-white mb-2">Your Ad Will Appear Here</h3>
                <p className="max-w-xs mx-auto">Fill out the details on the left and click "Generate" to see the magic happen!</p>
            </div>
        );
    };

    const hasContent = (generatedAds && generatedAds.images && generatedAds.images.length > 0) || generatedVideo;

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="w-full min-h-[50vh] bg-brand-primary rounded-2xl flex items-center justify-center p-6 relative overflow-hidden border border-gray-800">
                {renderContent()}
            </div>
            {hasContent && (
                <div className="flex-shrink-0 bg-brand-primary rounded-xl p-3 flex items-center justify-center gap-2 border border-gray-800">
                    <span className="text-xs font-bold text-brand-accent uppercase tracking-widest mr-2">Preview Mode</span>
                    <div className="flex bg-brand-secondary rounded-lg p-1">
                        <button onClick={() => setPreviewMode('default')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${previewMode === 'default' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>Default</button>
                        <button onClick={() => setPreviewMode('story')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${previewMode === 'story' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>Story</button>
                        <button onClick={() => setPreviewMode('post')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${previewMode === 'post' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>Post</button>
                    </div>
                </div>
            )}
        </div>
    );
};
