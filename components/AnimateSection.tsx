
import React, { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { FilmIcon, SparklesIcon, ChevronDownIcon, SettingsIcon } from './icons';
import { KlingConfig } from './KlingConfig';
import type { ImageData, VideoSettingsData, AspectRatio, VideoModel } from '../types';

interface AnimateSectionProps {
    currentImage: string | null;
    subjectImages: ImageData[];
    onAnimate: (image: ImageData, prompt: string, settings: VideoSettingsData, klingKeys: { apiKey: string, secretKey: string, model: string }) => void;
    isLoading: boolean;
    disabled: boolean;
}

const CAMERA_TYPES = ['Arri Alexa', 'Red V-Raptor', 'Sony Venice 2', 'Panavision Millennium XL2', 'GoPro Hero 12', 'DJI Mavic 3 Pro', 'iPhone 15 Pro', 'Smartphone/UGC', 'Vintage 16mm Camera', 'Super 8mm'];
const TECHNIQUES = ['Slow Motion', 'Time-lapse', 'Hyper-lapse', 'Dolly Zoom', 'Handheld', 'Steadicam', 'Crane Shot', 'Drone Shot', 'POV', 'Macro'];
const LIGHTING = ['Cinematic', 'Golden Hour', 'Blue Hour', 'High Key', 'Low Key', 'Neon', 'Softbox', 'Natural Light', 'Studio Lighting', 'Volumetric Lighting'];
const DURATIONS = ['5s', '10s'];
const RESOLUTIONS: ('720p' | '1080p')[] = ['720p', '1080p'];
const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const MODELS: { id: VideoModel, name: string }[] = [
    { id: 'veo', name: 'Google Veo 3.1' },
    { id: 'kling', name: 'Kling AI V3' }
];

export const AnimateSection: React.FC<AnimateSectionProps> = ({ 
    currentImage, subjectImages, onAnimate, isLoading, disabled 
}) => {
    const [source, setSource] = useState<'current' | 'upload' | 'assets'>('current');
    const [uploadedImage, setUploadedImage] = useState<ImageData | null>(null);
    const [animationPrompt, setAnimationPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [klingKeys, setKlingKeys] = useState({ apiKey: '', secretKey: '' });
    const [klingModel, setKlingModel] = useState('kling-v3');
    
    const [settings, setSettings] = useState<VideoSettingsData>({
        cameraType: '',
        lighting: '',
        technique: '',
        duration: '5s',
        aspectRatio: '16:9',
        resolution: '1080p',
        model: 'veo'
    });

    const handleSourceChange = (newSource: 'current' | 'upload' | 'assets') => {
        setSource(newSource);
        if (newSource === 'assets' && subjectImages.length > 0 && !uploadedImage) {
            setUploadedImage(subjectImages[0]);
        }
    };

    const handleAnimate = () => {
        let targetImage: ImageData | null = null;

        if (source === 'current' && currentImage) {
            // Convert data URL to ImageData
            const parts = currentImage.split(',');
            const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
            const base64 = parts[1];
            targetImage = { base64, mimeType };
        } else if (source === 'upload' && uploadedImage) {
            targetImage = uploadedImage;
        } else if (source === 'assets' && uploadedImage) {
            targetImage = uploadedImage;
        }

        if (targetImage) {
            onAnimate(targetImage, animationPrompt, { ...settings }, { ...klingKeys, model: klingModel });
        }
    };

    const canAnimate = (source === 'current' && !!currentImage) || ((source === 'upload' || source === 'assets') && !!uploadedImage);

    return (
        <div className="bg-brand-secondary p-6 rounded-2xl shadow-lg animate-fade-in flex flex-col gap-6 border border-gray-800">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-brand-accent flex items-center gap-2">
                    <FilmIcon className="w-6 h-6" />
                    Animate Creative
                </h3>
            </div>

            <div className="flex bg-brand-primary rounded-lg p-1 w-full sm:w-fit">
                <button 
                    onClick={() => handleSourceChange('current')} 
                    className={`flex-grow sm:flex-none px-6 py-2 text-sm font-semibold rounded-md transition-all ${source === 'current' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    Current Result
                </button>
                <button 
                    onClick={() => handleSourceChange('upload')} 
                    className={`flex-grow sm:flex-none px-6 py-2 text-sm font-semibold rounded-md transition-all ${source === 'upload' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    Upload New
                </button>
                <button 
                    onClick={() => handleSourceChange('assets')} 
                    className={`flex-grow sm:flex-none px-6 py-2 text-sm font-semibold rounded-md transition-all ${source === 'assets' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                    From Assets
                </button>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Video Engine</label>
                    <KlingConfig onKeysChange={setKlingKeys} />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex bg-brand-primary rounded-lg p-1 w-full sm:w-fit border border-gray-700">
                        {MODELS.map(m => (
                            <button 
                                key={m.id}
                                onClick={() => setSettings({...settings, model: m.id})}
                                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${settings.model === m.id ? 'bg-brand-accent text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            >
                                {m.name}
                            </button>
                        ))}
                    </div>

                    {settings.model === 'kling' && (
                        <div className="flex-1">
                            <select 
                                value={klingModel}
                                onChange={(e) => setKlingModel(e.target.value)}
                                className="w-full bg-brand-primary border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none"
                            >
                                <option value="kling-v3">Kling V3 (Standard)</option>
                                <option value="kling-v3-omni">Kling V3 Omni (High Fidelity)</option>
                                <option value="kling-v1-5">Kling V1.5 (Legacy Pro)</option>
                                <option value="kling-v1">Kling V1 (Legacy Standard)</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    {source === 'current' ? (
                        <div className="relative aspect-video bg-brand-primary rounded-xl overflow-hidden border-2 border-gray-700 flex items-center justify-center">
                            {currentImage ? (
                                <img src={currentImage} alt="Current result" className="object-contain w-full h-full" />
                            ) : (
                                <div className="text-gray-500 text-sm p-4 text-center">
                                    Generate an image first to animate it here.
                                </div>
                            )}
                        </div>
                    ) : source === 'upload' ? (
                        <div className="aspect-video">
                            <ImageUploader 
                                id="animate-upload" 
                                label="Upload image to animate" 
                                onImageUpload={setUploadedImage} 
                                initialImage={uploadedImage}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 h-full">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Select from uploaded assets</label>
                            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[180px] p-2 bg-brand-primary rounded-lg border border-gray-700">
                                {subjectImages.length === 0 && (
                                    <div className="col-span-3 py-8 text-center text-gray-500 text-xs">
                                        No assets uploaded yet.
                                    </div>
                                )}
                                {subjectImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setUploadedImage(img)}
                                        className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${uploadedImage === img ? 'border-brand-accent scale-95' : 'border-transparent hover:border-gray-500'}`}
                                    >
                                        <img src={`data:${img.mimeType};base64,${img.base64}`} alt={`Asset ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                            {uploadedImage && source === 'assets' && (
                                <div className="mt-auto p-2 bg-brand-primary rounded-lg border border-gray-700 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                                        <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`} alt="Selected" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold">Selected Asset</p>
                                        <p className="text-xs text-white truncate">Ready to animate</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-light mb-2">Animation Prompt (Optional)</label>
                        <textarea 
                            value={animationPrompt}
                            onChange={(e) => setAnimationPrompt(e.target.value)}
                            placeholder="e.g., The product slowly rotates while golden particles float around it..."
                            className="w-full p-3 bg-brand-primary border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition duration-200 h-32 resize-none text-sm"
                        />
                    </div>
                    
                    <button 
                        onClick={handleAnimate} 
                        disabled={isLoading || disabled || !canAnimate}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-purple-500/50 mt-auto"
                    >
                        <FilmIcon className="w-6 h-6" />
                        {isLoading ? 'Animating...' : 'Animate Image'}
                    </button>
                </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
                <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-brand-light hover:text-white transition-colors group"
                >
                    <span className="flex items-center gap-2 font-semibold">
                        <SettingsIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                        Advanced Video Settings
                    </span>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Camera Type</label>
                            <select 
                                value={settings.cameraType}
                                onChange={(e) => setSettings({...settings, cameraType: e.target.value})}
                                className="w-full p-2.5 bg-brand-primary border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                            >
                                <option value="">Auto Detect</option>
                                {CAMERA_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Technique</label>
                            <select 
                                value={settings.technique}
                                onChange={(e) => setSettings({...settings, technique: e.target.value})}
                                className="w-full p-2.5 bg-brand-primary border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                            >
                                <option value="">Cinematic Default</option>
                                {TECHNIQUES.map(tech => <option key={tech} value={tech}>{tech}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Lighting</label>
                            <select 
                                value={settings.lighting}
                                onChange={(e) => setSettings({...settings, lighting: e.target.value})}
                                className="w-full p-2.5 bg-brand-primary border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                            >
                                <option value="">Match Image</option>
                                {LIGHTING.map(light => <option key={light} value={light}>{light}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Duration</label>
                            <div className="flex bg-brand-primary rounded-lg p-1 border border-gray-600">
                                {DURATIONS.map(d => (
                                    <button 
                                        key={d}
                                        onClick={() => setSettings({...settings, duration: d})}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${settings.duration === d ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Aspect Ratio</label>
                            <select 
                                value={settings.aspectRatio}
                                onChange={(e) => setSettings({...settings, aspectRatio: e.target.value as AspectRatio})}
                                className="w-full p-2.5 bg-brand-primary border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                            >
                                {ASPECT_RATIOS.map(ar => <option key={ar} value={ar}>{ar}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Resolution</label>
                            <div className="flex bg-brand-primary rounded-lg p-1 border border-gray-600">
                                {RESOLUTIONS.map(r => (
                                    <button 
                                        key={r}
                                        onClick={() => setSettings({...settings, resolution: r})}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${settings.resolution === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-indigo-900/20 border border-indigo-800/50 rounded-xl">
                <SparklesIcon className="w-5 h-5 text-indigo-400 mt-0.5" />
                <p className="text-xs text-indigo-200 leading-relaxed">
                    <strong>Pro Tip:</strong> Describe the motion clearly. Use words like "slowly pan", "gentle zoom", "rotate", or "particles floating" for best results with Veo.
                </p>
            </div>
        </div>
    );
};
