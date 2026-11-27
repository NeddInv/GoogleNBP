
import type { CameraPreset, CameraSettingsData, ModelType, ImageSize } from './types';

export const INITIAL_CAMERA_SETTINGS: CameraSettingsData = {
    cameraType: '',
    focalLength: '',
    aperture: '',
    shutterSpeed: '',
    lightingStyle: '',
    lightingSetup: '',
    distortion: '',
    textureDetail: '',
    colorStyle: '',
    technique: '',
    cameraAngle: '',
};

export const DEFAULT_AESTHETIC_STYLE = 'photorealistic, authentic textures, commercial quality';
export const DEFAULT_NEGATIVE_PROMPT = 'blurry, low quality, distorted, text watermark, signature, oversaturated, noisy artifacts, plastic skin, waxy skin, artificial airbrushed skin, unnatural skin texture, rubber skin, doll-like face, mannequin';
export const DEFAULT_MODEL_TYPE: ModelType = 'pro';
export const DEFAULT_IMAGE_SIZE: ImageSize = '2K';
export const USER_DEFAULTS_STORAGE_KEY = 'adgen-user-defaults';

export const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
    {
        id: 'preset-minidv-camcorder',
        name: 'Early 2000s MiniDV',
        settings: {
            cameraType: 'Early 2000s MiniDV camcorder (Sony DCR-VX1000/Canon GL2 style, 480i digital video tape aesthetic, CCD sensor colors, authentic nostalgic handheld camcorder footage)',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using a 24mm wide-angle lens',
            aperture: 'shot at f/4, for a balanced and sharp image',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with soft, natural window light',
            lightingSetup: '',
            distortion: 'early 2000s MiniDV tape artifacts, subtle interlaced scan lines, tape noise, digital compression grain, glowing highlights',
            textureDetail: '',
            colorStyle: 'with natural, true-to-life color rendering',
            technique: 'filmed with early 2000s MiniDV camcorder handheld tracking movement, subtle natural jitter, authentic digital tape recording texture',
        }
    },
    {
        id: 'preset-cinematic-film',
        name: 'Cinematic Film',
        settings: {
            cameraType: 'High-end cinematic film camera',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using an 85mm portrait lens',
            aperture: 'shot at f/1.8, creating a very shallow depth of field with beautiful bokeh',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with dramatic, cinematic lighting, using techniques like motivated light sources and color grading',
            lightingSetup: '',
            distortion: 'with subtle, cinematic lens flare',
            textureDetail: '',
            colorStyle: 'with high-contrast colors, deep blacks, and bright whites',
            technique: 'shot with a strong bokeh effect, creating a beautifully blurred background',
        }
    },
    {
        id: 'preset-commercial-studio',
        name: 'Commercial Studio (3-Point)',
        settings: {
            cameraType: 'Professional DSLR camera',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using an 85mm portrait lens',
            aperture: 'shot at f/4, for a balanced and sharp image',
            shutterSpeed: 'with a fast 1/1000s shutter speed to freeze motion completely',
            lightingStyle: 'lit with cool-toned, crisp light for a modern and clean feel',
            lightingSetup: 'using a professional studio setup with three-point lighting',
            distortion: 'captured with a modern, pristine lens with no distortion',
            textureDetail: 'Smooth, clean product textures with a polished, commercial finish.',
            colorStyle: 'with natural, true-to-life color rendering',
            technique: '',
        }
    },
    {
        id: 'preset-vintage-polaroid',
        name: 'Vintage Polaroid',
        settings: {
            cameraType: 'Vintage Polaroid camera with classic film stock',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using a 35mm classic lens',
            aperture: 'shot at f/4, for a balanced and sharp image',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with soft, diffused light for a gentle and flattering look',
            lightingSetup: '',
            distortion: 'with vintage lens characteristics, including barrel distortion and chromatic aberration',
            textureDetail: '',
            colorStyle: 'with a low-contrast, muted color palette for a soft, dreamy look',
            technique: '',
        }
    },
    {
        id: 'preset-hero-low-angle',
        name: 'Golden Hour Hero Shot',
        settings: {
            cameraType: 'Modern mirrorless camera',
            cameraAngle: 'shot from a low-angle, making the subject appear powerful and dominant',
            focalLength: 'using a 50mm standard prime lens',
            aperture: 'shot at f/1.8, creating a very shallow depth of field with beautiful bokeh',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with warm, soft golden hour sunlight',
            lightingSetup: 'using dramatic rim lighting to outline the subject',
            distortion: 'with subtle, cinematic lens flare',
            textureDetail: '',
            colorStyle: 'with high-contrast colors, deep blacks, and bright whites',
            technique: 'shot with a strong bokeh effect, creating a beautifully blurred background',
        }
    },
    {
        id: 'preset-rembrandt-portrait',
        name: 'Dramatic Rembrandt',
        settings: {
            cameraType: 'High-end cinematic film camera',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using an 85mm portrait lens',
            aperture: 'shot at f/1.8, creating a very shallow depth of field with beautiful bokeh',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with moody, atmospheric lighting with deep shadows',
            lightingSetup: 'using Rembrandt lighting for a dramatic, moody portrait feel',
            distortion: 'captured with a modern, pristine lens with no distortion',
            textureDetail: 'Hyper-detailed macro textures, emphasizing every surface imperfection, pore, and grain.',
            colorStyle: 'with high-contrast colors, deep blacks, and bright whites',
            technique: '',
        }
    },
    {
        id: 'preset-smartphone-ugc',
        name: 'Smartphone UGC Handheld',
        settings: {
            cameraType: 'Smartphone camera, user-generated content (UGC) style, handheld, raw and authentic',
            cameraAngle: 'shot from a point-of-view (POV) perspective, as if seen through the subject\'s eyes',
            focalLength: 'using a 24mm wide-angle lens',
            aperture: 'shot at f/1.8, creating a very shallow depth of field with beautiful bokeh',
            shutterSpeed: 'with a 1/60s shutter speed for a natural look',
            lightingStyle: 'lit with soft, natural window light',
            lightingSetup: '',
            distortion: 'captured with a modern, pristine lens with no distortion',
            textureDetail: '',
            colorStyle: 'with natural, true-to-life color rendering',
            technique: '',
        }
    },
    {
        id: 'preset-macro-precision',
        name: 'Macro Precision (100mm)',
        settings: {
            cameraType: 'Large format camera for extreme detail',
            cameraAngle: 'shot from an eye-level angle, creating a direct and relatable connection',
            focalLength: 'using a 100mm macro lens for close-ups',
            aperture: 'shot at f/11, creating a deep depth of field where everything is in focus',
            shutterSpeed: 'with a fast 1/1000s shutter speed to freeze motion completely',
            lightingStyle: 'lit with soft, diffused light for a gentle and flattering look',
            lightingSetup: 'using high-key lighting for a bright, airy, and shadowless look',
            distortion: 'captured with a modern, pristine lens with no distortion',
            textureDetail: 'Hyper-detailed macro textures, emphasizing every surface imperfection, pore, and grain.',
            colorStyle: 'with natural, true-to-life color rendering',
            technique: '',
        }
    }
];

export interface UserDefaultsPreferences {
    cameraPresets: CameraPreset[];
    cameraSettings: CameraSettingsData;
    selectedStyle: string;
    negativePrompt: string;
    modelType: ModelType;
    imageSize: ImageSize;
    updatedAt: number;
}

export const getEffectiveDefaults = (): UserDefaultsPreferences => {
    try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(USER_DEFAULTS_STORAGE_KEY) : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                cameraPresets: Array.isArray(parsed.cameraPresets) && parsed.cameraPresets.length > 0 ? parsed.cameraPresets : DEFAULT_CAMERA_PRESETS,
                cameraSettings: parsed.cameraSettings || INITIAL_CAMERA_SETTINGS,
                selectedStyle: typeof parsed.selectedStyle === 'string' ? parsed.selectedStyle : DEFAULT_AESTHETIC_STYLE,
                negativePrompt: typeof parsed.negativePrompt === 'string' ? parsed.negativePrompt : DEFAULT_NEGATIVE_PROMPT,
                modelType: (parsed.modelType as ModelType) || DEFAULT_MODEL_TYPE,
                imageSize: (parsed.imageSize as ImageSize) || DEFAULT_IMAGE_SIZE,
                updatedAt: parsed.updatedAt || Date.now(),
            };
        }
    } catch (e) {
        console.warn('Failed to load user defaults:', e);
    }

    return {
        cameraPresets: DEFAULT_CAMERA_PRESETS,
        cameraSettings: INITIAL_CAMERA_SETTINGS,
        selectedStyle: DEFAULT_AESTHETIC_STYLE,
        negativePrompt: DEFAULT_NEGATIVE_PROMPT,
        modelType: DEFAULT_MODEL_TYPE,
        imageSize: DEFAULT_IMAGE_SIZE,
        updatedAt: Date.now(),
    };
};

export const saveUserDefaults = (prefs: {
    cameraPresets: CameraPreset[];
    cameraSettings: CameraSettingsData;
    selectedStyle: string;
    negativePrompt: string;
    modelType?: ModelType;
    imageSize?: ImageSize;
}): UserDefaultsPreferences => {
    const data: UserDefaultsPreferences = {
        cameraPresets: prefs.cameraPresets.length > 0 ? prefs.cameraPresets : DEFAULT_CAMERA_PRESETS,
        cameraSettings: prefs.cameraSettings,
        selectedStyle: prefs.selectedStyle,
        negativePrompt: prefs.negativePrompt,
        modelType: prefs.modelType || DEFAULT_MODEL_TYPE,
        imageSize: prefs.imageSize || DEFAULT_IMAGE_SIZE,
        updatedAt: Date.now(),
    };
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(USER_DEFAULTS_STORAGE_KEY, JSON.stringify(data));
        }
    } catch (e) {
        console.error('Failed to save user defaults to localStorage:', e);
    }
    return data;
};

export const resetUserDefaultsToFactory = (): UserDefaultsPreferences => {
    try {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_DEFAULTS_STORAGE_KEY);
        }
    } catch (e) {
        console.error('Failed to clear user defaults:', e);
    }
    return {
        cameraPresets: DEFAULT_CAMERA_PRESETS,
        cameraSettings: INITIAL_CAMERA_SETTINGS,
        selectedStyle: DEFAULT_AESTHETIC_STYLE,
        negativePrompt: DEFAULT_NEGATIVE_PROMPT,
        modelType: DEFAULT_MODEL_TYPE,
        imageSize: DEFAULT_IMAGE_SIZE,
        updatedAt: Date.now(),
    };
};

export const BACKGROUND_OPTIONS = [
    { label: 'Urban Mural', prompt: 'on a vibrant, artistic urban mural wall' },
    { label: 'City Billboard', prompt: 'on a massive digital billboard in a bustling city square at night, like Times Square' },
    { label: 'Train Station', prompt: 'on an ad panel inside a modern, busy train station' },
    { label: 'Subway Interior', prompt: 'as an advertisement inside a clean, modern subway car' },
    { label: 'Rainy Bus Stop', prompt: 'on an illuminated ad panel at a bus stop on a rainy night' },
    { label: 'Luxury Magazine', prompt: 'as a full-page spread in a high-fashion, luxury magazine' },
    { label: 'Classic Newspaper', prompt: 'in a classic black and white newspaper advertisement' },
    { label: 'Social Media Ad', prompt: 'in a styled, trendy social media post on a smartphone screen' },
    { label: 'Coworking Space', prompt: 'naturally placed on a desk in a bright, modern coworking space' },
    { label: 'Cinema Pre-show', prompt: 'on a giant cinema screen before a movie starts' },
    { label: 'Cafe Placement', prompt: 'subtly placed on a table in a cozy, rustic cafe' },
    { label: 'Dermatologist Office', prompt: 'professionally displayed on a clean, white table in a dermatologist\'s office' },
];

export const STYLE_OPTIONS = [
    { label: 'Default', value: '' },
    { label: 'Photorealistic', value: 'photorealistic, ultra-detailed, 8k' },
    { label: 'Early 2000s MiniDV Footage', value: 'early 2000s MiniDV camcorder video footage still, authentic standard definition 480i digital tape aesthetic, 3-CCD sensor color rendition, subtle horizontal interlacing scan line artifacts, blooming bright highlights, soft digital sharpness, natural chroma noise, nostalgic Y2K home video and skate video camcorder look' },
    { label: 'Minimalist', value: 'minimalist, clean background, simple, elegant' },
    { label: 'Vintage', value: 'vintage style, retro, old-fashioned, film grain, sepia tones' },
    { label: 'Luxury', value: 'luxurious, opulent, high-end, elegant, rich colors' },
    { label: 'Futuristic', value: 'futuristic, sci-fi, neon lights, chrome, sleek' },
    { label: 'Earthy/Natural', value: 'natural lighting, earthy tones, organic, rustic' },
    { label: 'Classic Mobile (2012-2015)', value: 'authentic 2012-2015 smartphone photo, early iPhone/Galaxy photographic style, slight lens flare, natural digital noise, nostalgic mobile clarity' },
    { label: 'Modern Mobile (2016-2022)', value: 'commercial smartphone photography style 2018-2022, high dynamic range, computationally sharp, vibrant natural colors, handheld look' },
];
