import React, { useState } from 'react';
import type { CameraSettingsData, CameraPreset } from '../types';
import { SparklesIcon, CloseIcon } from './icons';

interface CameraSettingsProps {
    settings: CameraSettingsData;
    onSettingsChange: (settings: CameraSettingsData) => void;
    presets: CameraPreset[];
    onSavePreset: (name: string) => void;
    onDeletePreset: (id: string) => void;
    onApplyPreset: (preset: CameraPreset) => void;
}

const SelectInput: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
    <div>
        <label className="block text-sm font-medium text-brand-light mb-2">{label}</label>
        <select
            value={value}
            onChange={onChange}
            className="w-full p-3 bg-brand-primary border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition duration-200"
        >
            {children}
        </select>
    </div>
);


export const CameraSettings: React.FC<CameraSettingsProps> = ({ 
    settings, 
    onSettingsChange,
    presets,
    onSavePreset,
    onDeletePreset,
    onApplyPreset
}) => {
    const [presetName, setPresetName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    
    const handleChange = (field: keyof CameraSettingsData) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSettingsChange({ ...settings, [field]: e.target.value });
    };

    const handleSave = () => {
        if (presetName.trim()) {
            onSavePreset(presetName.trim());
            setPresetName('');
            setShowSaveInput(false);
        }
    };

    return (
        <div className="space-y-6 p-4 bg-brand-primary rounded-lg">
            {/* Presets Section */}
            <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-brand-accent uppercase tracking-wider">Presets</h3>
                    {!showSaveInput ? (
                        <button 
                            onClick={() => setShowSaveInput(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-md transition-colors"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                            Save Current as Preset
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input 
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Preset name..."
                                className="px-3 py-1.5 bg-brand-secondary border border-gray-600 rounded-md text-xs focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                            <button 
                                onClick={handleSave}
                                disabled={!presetName.trim()}
                                className="px-3 py-1.5 bg-brand-accent text-brand-primary text-xs font-bold rounded-md hover:bg-indigo-400 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                            >
                                Save
                            </button>
                            <button 
                                onClick={() => setShowSaveInput(false)}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {presets.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {presets.map((preset) => (
                            <div key={preset.id} className="group relative flex items-center">
                                <button
                                    onClick={() => onApplyPreset(preset)}
                                    className="px-3 py-1.5 bg-brand-secondary border border-gray-600 rounded-md text-xs hover:border-brand-accent hover:text-brand-accent transition-all"
                                >
                                    {preset.name}
                                </button>
                                <button
                                    onClick={() => onDeletePreset(preset.id)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    aria-label={`Delete ${preset.name} preset`}
                                >
                                    <CloseIcon className="w-2.5 h-2.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 italic">No presets saved yet.</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectInput label="Camera Type" value={settings.cameraType} onChange={handleChange('cameraType')}>
                    <option value="">Default</option>
                    <option value="Professional DSLR camera">DSLR</option>
                    <option value="High-end cinematic film camera">Cinematic Film</option>
                    <option value="Vintage Polaroid camera with classic film stock">Vintage Polaroid</option>
                    <option value="Modern mirrorless camera">Mirrorless</option>
                    <option value="Large format camera for extreme detail">Large Format</option>
                    <option value="Smartphone camera, user-generated content (UGC) style, handheld, raw and authentic">Smartphone/UGC</option>
                </SelectInput>
                 <SelectInput label="Camera Angle" value={settings.cameraAngle} onChange={handleChange('cameraAngle')}>
                    <option value="">Default</option>
                    <option value="shot from an eye-level angle, creating a direct and relatable connection">Eye-Level</option>
                    <option value="shot from a low-angle, making the subject appear powerful and dominant">Low-Angle (Hero Shot)</option>
                    <option value="shot from a high-angle, making the subject appear smaller or more vulnerable">High-Angle</option>
                    <option value="shot directly from above, like a bird's-eye view, for a flat-lay or top-down perspective">Bird's-Eye View</option>
                    <option value="shot from a very low angle, looking straight up, creating an extreme sense of scale">Worm's-Eye View</option>
                    <option value="shot with a Dutch angle, tilting the camera for a dynamic and unsettling effect">Dutch Angle</option>
                    <option value="shot from a point-of-view (POV) perspective, as if seen through the subject's eyes">Point-of-View (POV)</option>
                    <option value="shot from over-the-shoulder of a person, focusing on the product">Over-the-Shoulder</option>
                </SelectInput>
                 <SelectInput label="Focal Length" value={settings.focalLength} onChange={handleChange('focalLength')}>
                    <option value="">Default</option>
                    <option value="using a 24mm wide-angle lens">24mm (Wide)</option>
                    <option value="using a 35mm classic lens">35mm (Classic)</option>
                    <option value="using a 50mm standard prime lens">50mm (Standard)</option>
                    <option value="using an 85mm portrait lens">85mm (Portrait)</option>
                    <option value="using a 100mm macro lens for close-ups">100mm (Macro)</option>
                    <option value="using a 200mm telephoto lens">200mm (Telephoto)</option>
                </SelectInput>
                 <SelectInput label="Aperture (Depth of Field)" value={settings.aperture} onChange={handleChange('aperture')}>
                    <option value="">Default</option>
                    <option value="shot at f/1.8, creating a very shallow depth of field with beautiful bokeh">f/1.8 (Shallow Focus)</option>
                    <option value="shot at f/4, for a balanced and sharp image">f/4 (Balanced)</option>
                    <option value="shot at f/11, creating a deep depth of field where everything is in focus">f/11 (Deep Focus)</option>
                    <option value="shot at f/16, providing maximum depth of field for extreme sharpness throughout the scene">f/16 (Extreme Focus)</option>
                </SelectInput>
                <SelectInput label="Shutter Speed (Motion)" value={settings.shutterSpeed} onChange={handleChange('shutterSpeed')}>
                    <option value="">Default</option>
                    <option value="with a fast 1/1000s shutter speed to freeze motion completely">1/1000s (Freeze Motion)</option>
                    <option value="with a 1/60s shutter speed for a natural look">1/60s (Natural)</option>
                    <option value="with a slow 1s shutter speed, creating intentional motion blur">1s (Motion Blur)</option>
                </SelectInput>
                <SelectInput label="Lighting Style (Mood)" value={settings.lightingStyle} onChange={handleChange('lightingStyle')}>
                    <option value="">Default</option>
                    <option value="lit with warm, soft golden hour sunlight">Golden Hour</option>
                    <option value="lit with cool, moody blue hour light">Blue Hour</option>
                    <option value="lit with soft, natural window light">Soft Natural Light</option>
                    <option value="lit with dramatic, hard light and strong shadows">Hard Light</option>
                    <option value="lit with soft, diffused light for a gentle and flattering look">Soft Light</option>
                    <option value="lit with cool-toned, crisp light for a modern and clean feel">Cool Light</option>
                    <option value="lit with moody, atmospheric lighting with deep shadows">Moody</option>
                    <option value="lit with dramatic, cinematic lighting, using techniques like motivated light sources and color grading">Cinematic</option>
                </SelectInput>
                <SelectInput label="Lighting Setup (Studio)" value={settings.lightingSetup} onChange={handleChange('lightingSetup')}>
                    <option value="">Default</option>
                    <option value="using a professional studio setup with three-point lighting">Studio (3-Point)</option>
                    <option value="using Rembrandt lighting for a dramatic, moody portrait feel">Rembrandt</option>
                    <option value="using high-key lighting for a bright, airy, and shadowless look">High-Key</option>
                    <option value="using low-key lighting for a dark, dramatic scene with high contrast">Low-Key</option>
                    <option value="using dramatic rim lighting to outline the subject">Dramatic Rim Light</option>
                </SelectInput>
                 <SelectInput label="Color" value={settings.colorStyle} onChange={handleChange('colorStyle')}>
                    <option value="">Default</option>
                    <option value="with high-contrast colors, deep blacks, and bright whites">High-Contrast</option>
                    <option value="with a low-contrast, muted color palette for a soft, dreamy look">Low-Contrast</option>
                    <option value="with natural, true-to-life color rendering">Natural</option>
                </SelectInput>
                 <SelectInput label="Techniques" value={settings.technique} onChange={handleChange('technique')}>
                    <option value="">Default</option>
                    <option value="shot with a strong bokeh effect, creating a beautifully blurred background">Bokeh Effect</option>
                    <option value="using a long exposure technique to capture light trails or smooth water">Long Exposure</option>
                    <option value="using intentional motion blur to convey speed and movement">Motion Blur</option>
                    <option value="using a tilt-shift lens to create a miniature-world effect">Tilt-Shift</option>
                    <option value="shot with a fisheye lens for a distorted, ultra-wide perspective">Fisheye</option>
                </SelectInput>
                <SelectInput label="Lens Effects / Distortion" value={settings.distortion} onChange={handleChange('distortion')}>
                    <option value="">Default</option>
                    <option value="captured with a modern, pristine lens with no distortion">Pristine (No Distortion)</option>
                    <option value="with subtle, cinematic lens flare">Subtle Lens Flare</option>
                    <option value="with vintage lens characteristics, including barrel distortion and chromatic aberration">Vintage Distortion</option>
                </SelectInput>
            </div>
        </div>
    );
};
