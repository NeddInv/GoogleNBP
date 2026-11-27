import type { 
    GenerateAdParams, 
    ImageData, 
    PanDirection, 
    ZoomDirection, 
    VaryStrength, 
    ZoomLevel, 
    AspectRatio, 
    ImageSize, 
    VideoSettingsData, 
    VideoModel, 
    AdVariation, 
    GenerationError, 
    ImageGenerationResponse, 
    InsertModelParams, 
    ModelType,
    CharacterProfile
} from '../types';
import {
    loadCharacterProfiles,
    detectActiveCharacters,
    generateCharacterDirectives,
    generateCharacterNegativeTerms,
    parseCharacterSwapPrompt,
    type ParsedSwapIntent
} from './characterService';

const dataUrlToImageData = (dataUrl: string, name?: string): ImageData => {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return { base64, mimeType, name };
};

/**
 * Resizes a base64 image to a maximum dimension while maintaining aspect ratio.
 * This ensures we don't exceed API payload limits while retaining crisp resolution.
 */
const resizeImage = async (imageData: ImageData, maxDimension: number = 1536, preserveCrispQuality: boolean = false): Promise<ImageData> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
        img.onload = () => {
            const { width, height } = img;
            // Preserve original crisp image (PNG/WebP/JPEG) without lossy re-compression when already within bounds
            if (width <= maxDimension && height <= maxDimension && (preserveCrispQuality || imageData.mimeType === 'image/webp' || imageData.mimeType === 'image/png')) {
                resolve(imageData);
                return;
            }

            let newWidth: number;
            let newHeight: number;
            if (width > height) {
                newWidth = Math.min(width, maxDimension);
                newHeight = (height * newWidth) / width;
            } else {
                newHeight = Math.min(height, maxDimension);
                newWidth = (width * newHeight) / height;
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(newWidth));
            canvas.height = Math.max(1, Math.round(newHeight));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageData);
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const targetMime = preserveCrispQuality && imageData.mimeType === 'image/png' ? 'image/png' : 'image/webp';
            const quality = preserveCrispQuality ? 0.95 : 0.9;
            const resizedDataUrl = canvas.toDataURL(targetMime, quality);
            resolve(dataUrlToImageData(resizedDataUrl, imageData.name));
        };
        img.onerror = () => resolve(imageData);
    });
};

/**
 * Converts a data URL to WebP format if it isn't already.
 */
const convertToWebP = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        if (dataUrl.startsWith('data:image/webp')) {
            resolve(dataUrl);
            return;
        }
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/webp', 0.9));
        };
        img.onerror = () => resolve(dataUrl);
    });
};

/**
 * Maps extended AspectRatio type to standard ratio values for API compatibility.
 */
const mapToApiAspectRatio = (ratio: AspectRatio | undefined): "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "1:4" | "1:8" | "4:1" | "8:1" => {
    if (!ratio) return "1:1";
    if (ratio === '97:60' || ratio === '16:10' || ratio === '2:1' || ratio === '12:5' || ratio === '36:13' || ratio === '1.91:1') return "16:9";
    if (ratio === '3:2' || ratio === '1.2:1') return "4:3";
    if (ratio === '4:5' || ratio === '1:2') return "3:4";
    if (ratio === '728:90' || ratio === '970:90' || ratio === '320:50') return "8:1";
    if (ratio === '320:100' || ratio === '970:250') return "4:1";
    if (ratio === '160:600' || ratio === '120:600') return "1:4";
    return ratio as any;
};

const ASPECT_RATIO_VALUES: Record<AspectRatio, number> = {
    '1:1': 1,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '4:5': 4 / 5,
    '16:10': 1.6,
    '97:60': 97 / 60,
    '1:4': 0.25,
    '1:8': 0.125,
    '4:1': 4,
    '8:1': 8,
    '3:2': 1.5,
    '2:1': 2,
    '12:5': 2.4,
    '36:13': 36 / 13,
    '1.91:1': 1.91,
    '1.2:1': 1.2,
    '1:2': 0.5,
    '728:90': 728 / 90,
    '970:90': 970 / 90,
    '160:600': 160 / 600,
    '120:600': 120 / 600,
    '320:50': 320 / 50,
    '320:100': 320 / 100,
    '970:250': 970 / 250
};

const cropImageToAspectRatio = (base64Image: string, targetAspectRatio: number, forceWidth?: number, forceHeight?: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const currentRatio = img.width / img.height;
            
            const targetWidth = forceWidth || (currentRatio > targetAspectRatio ? img.height * targetAspectRatio : img.width);
            const targetHeight = forceHeight || (currentRatio > targetAspectRatio ? img.height : img.width / targetAspectRatio);

            const canvas = document.createElement('canvas');
            let sourceWidth: number;
            let sourceHeight: number;
            let offsetX: number;
            let offsetY: number;

            if (currentRatio > targetAspectRatio) {
                sourceHeight = img.height;
                sourceWidth = img.height * targetAspectRatio;
                offsetX = (img.width - sourceWidth) / 2;
                offsetY = 0;
            } else {
                sourceWidth = img.width;
                sourceHeight = img.width / targetAspectRatio;
                offsetX = 0;
                offsetY = (img.height - sourceHeight) / 2;
            }

            canvas.width = forceWidth || sourceWidth;
            canvas.height = forceHeight || sourceHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Image);
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, offsetX, offsetY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/webp', 0.95));
        };
        img.onerror = () => resolve(base64Image);
    });
};

/**
 * Maps ImageSize to API supported values.
 */
const mapToApiImageSize = (size: ImageSize | undefined, model?: string): "512px" | "1K" | "2K" | "4K" => {
    if (!size) return "2K";
    if (size === '512px') {
        if (model === 'gemini-3-pro-image' || !model) return "1K";
        return "512px";
    }
    if (size === '6K' || size === '8K') return "4K";
    return size as any;
};

/**
 * Strips terms that trigger Gemini safety classifiers.
 */
export const sanitizeNegativePrompt = (text: string): string => {
    if (!text) return '';
    const sensitiveTokens = /\b(extra limbs|bad anatomy|deformed|mutilated|disfigured|amputated|gross|ugly|grotesque|severed|bloody)\b/gi;
    return text.replace(sensitiveTokens, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
};

/**
 * Sanitizes prompt for safe fallback retry.
 */
export const sanitizePromptForSafety = (text: string): string => {
    if (!text) return '';
    return sanitizeNegativePrompt(text)
        .replace(/Strict Exclusion:[^\n]*/gi, '')
        .replace(/Important Exclusion:[^\n]*/gi, '')
        .replace(/MODEL PROP EXCLUSION:[^\n]*/gi, '')
        .replace(/MODEL STYLING NOTE:[^\n]*/gi, '')
        .replace(/Transfer ONLY [^\n]*/gi, '')
        .replace(/extract ONLY [^\n]*/gi, '')
        .trim();
};

/**
 * Resolves the official Gemini image generation model identifier for a given ModelType.
 * Defaults to 'gemini-3-pro-image' to provide PRO levels of quality at all times.
 */
export const resolveImageModelName = (modelType?: ModelType | string): string => {
    switch (modelType) {
        case 'nano-banana-2.1':
        case 'banana21':
        case 'gemini-3.6-flash-image':
        case 'gemini-nano-banana-2.1':
            return 'gemini-nano-banana-2.1';
        case 'ultra':
        case 'light':
        case 'standard':
            return 'gemini-3.1-flash-lite-image';
        case 'pro':
        default:
            return 'gemini-3-pro-image';
    }
};

export const getCustomApiKey = (): string | null => {
    try {
        return localStorage.getItem('gemini_custom_api_key');
    } catch {
        return null;
    }
};

export const setCustomApiKey = (key: string): void => {
    try {
        if (!key || !key.trim()) {
            localStorage.removeItem('gemini_custom_api_key');
        } else {
            localStorage.setItem('gemini_custom_api_key', key.trim());
        }
    } catch {
        // ignore storage errors
    }
};

export const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = getCustomApiKey();
    if (key) {
        headers["x-gemini-api-key"] = key;
    }
    return headers;
};

/**
 * Streams ad copy generation via server-side Server-Sent Events.
 */
export async function* generateAdCopyStream(
    productName: string, 
    slogan: string, 
    sceneDescription: string, 
    photoNames?: string[]
): AsyncGenerator<string> {
    const response = await fetch("/api/gemini/ad-copy", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ productName, slogan, sceneDescription, photoNames, stream: true }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
    }

    if (!response.body) {
        throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                    throw new Error(parsed.error);
                }
                if (parsed.chunk) {
                    yield parsed.chunk;
                }
                if (parsed.done) {
                    return;
                }
            } catch (e: any) {
                if (e.message && e.message !== 'Unexpected end of JSON input') {
                    throw e;
                }
            }
        }
    }
}

/**
 * Generates slogans via server-side Gemini API.
 */
export const generateSlogans = async (productName: string): Promise<string[]> => {
    try {
        const response = await fetch("/api/gemini/slogans", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ productName }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();
        return data.slogans || [];
    } catch (error) {
        console.error("Error generating slogans via server:", error);
        throw new Error("Failed to communicate with the server for slogan generation.");
    }
};

/**
 * Generates ad copy via server-side Gemini API.
 */
export const generateAdCopy = async (
    productName: string, 
    slogan: string, 
    sceneDescription: string, 
    photoNames?: string[]
): Promise<string> => {
    try {
        const response = await fetch("/api/gemini/ad-copy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName, slogan, sceneDescription, photoNames }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();
        return data.adCopy || '';
    } catch (error) {
        console.error("Error generating ad copy via server:", error);
        throw new Error("Failed to communicate with the server for ad copy generation.");
    }
};

/**
 * Generates suggestions via server-side Gemini API.
 */
export const generateSuggestions = async (
    currentPrompt: string, 
    photoNames?: string[]
): Promise<string[]> => {
    try {
        const response = await fetch("/api/gemini/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPrompt, photoNames }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const data = await response.json();
        return data.suggestions || [];
    } catch (error) {
        console.error("Error generating suggestions via server:", error);
        throw new Error("Failed to communicate with the server for suggestions.");
    }
};

export interface ReferencePhotoEntry {
    partIndex: number;
    category: 'Product Design' | 'Competitor Comparison' | 'Model & Character' | 'Pose & Action' | 'Context & Scene' | 'Apparel & Gear' | 'Brand Logo';
    name: string;
    description: string;
    imageData: ImageData;
}

/**
 * Builds a structured reference catalog linking each uploaded image's exact file/photo name.
 */
export const buildPhotoReferenceCatalog = (params: {
    productImage?: ImageData | null;
    productImages?: ImageData[];
    competitorImages?: ImageData[];
    subjectImages?: ImageData[];
    modelImages?: ImageData[];
    poseImages?: ImageData[];
    companyLogo?: ImageData | null;
    productName?: string;
}): { 
    referenceEntries: ReferencePhotoEntry[]; 
    catalogText: string; 
    multimodalParts: { text?: string; inlineData?: { data: string; mimeType: string } }[];
    productFileNames: string[];
} => {
    const entries: ReferencePhotoEntry[] = [];
    let idx = 1;

    // 1. Product Images
    if (params.productImages && params.productImages.length > 0) {
        params.productImages.slice(0, 10).forEach((img, i) => {
            const fileName = img.name || `product_photo_${i + 1}.png`;
            entries.push({
                partIndex: idx++,
                category: 'Product Design',
                name: fileName,
                description: `PRIMARY HERO PRODUCT REFERENCE #${i + 1} ("${fileName}"). Exact real product to advertise, showing physical form, container shape, label artwork, branding typography, materials, and colors.`,
                imageData: img
            });
        });
    } else if (params.productImage) {
        const fileName = params.productImage.name || 'primary_product.png';
        entries.push({
            partIndex: idx++,
            category: 'Product Design',
            name: fileName,
            description: `PRIMARY HERO PRODUCT REFERENCE ("${fileName}"). Exact real product to advertise, showing physical form, container shape, label artwork, branding typography, materials, and colors.`,
            imageData: params.productImage
        });
    }

    // 2. Competitor / Comparison Images
    if (params.competitorImages && params.competitorImages.length > 0) {
        params.competitorImages.slice(0, 12).forEach((img, i) => {
            const fileName = img.name || `competitor_ref_${i + 1}.png`;
            entries.push({
                partIndex: idx++,
                category: 'Competitor Comparison',
                name: fileName,
                description: `Competitor or benchmark product reference #${i + 1} ("${fileName}") for versus or comparative layouts.`,
                imageData: img
            });
        });
    }

    // 3. Subject / Context Images (intelligently categorized: Apparel & Gear vs Character & Person vs Environment Scene)
    const knownProfiles = loadCharacterProfiles();
    if (params.subjectImages && params.subjectImages.length > 0) {
        params.subjectImages.slice(0, 30).forEach((img, i) => {
            const fileName = img.name || `context_scene_${i + 1}.png`;
            const isApparelOrGear = /sleeve|knee|brace|apparel|gear|shoe|sneaker|wearable|strap|glove|shirt|pant|short|sock|jacket|hoodie|hat|cap|belt|vest|guard|accessory|prop|item|product/i.test(fileName);
            const matchedProfile = knownProfiles.find(p => new RegExp(`\\b${p.name}\\b`, 'i').test(fileName));
            const isCharacterOrPerson = !!matchedProfile || /joyce|rosa|marcus|model|character|person|woman|girl|man|boy|face|portrait|talent|actor|subject/i.test(fileName);

            if (isCharacterOrPerson) {
                const charIdentityDesc = matchedProfile
                    ? `for character "${matchedProfile.name}" (${matchedProfile.ethnicity}${matchedProfile.genderAge ? `, ${matchedProfile.genderAge}` : ''} with ${matchedProfile.skinTone || 'authentic dark skin tone'})`
                    : 'for real person/character ground truth';
                entries.push({
                    partIndex: idx++,
                    category: 'Model & Character',
                    name: fileName,
                    description: `CHARACTER & MODEL REFERENCE PHOTO #${i + 1} ("${fileName}"). Real person/character ground truth ${charIdentityDesc}. CRITICAL DEMOGRAPHIC & ETHNICITY FIDELITY MANDATE: You MUST faithfully duplicate this exact character's ethnicity, racial identity (${matchedProfile?.ethnicity || 'authentic ethnic heritage'}), skin tone (${matchedProfile?.skinTone || 'melanin complexion, true-to-life skin tone'}), facial structure, eye shape, smile, and natural hair texture. Under NO circumstances whitewash, lighten, or alter this character's race.`,
                    imageData: img
                });
            } else if (isApparelOrGear) {
                entries.push({
                    partIndex: idx++,
                    category: 'Apparel & Gear',
                    name: fileName,
                    description: `EXACT PHYSICAL ITEM / APPAREL / GEAR REFERENCE #${i + 1} ("${fileName}"). Real physical wearable item, gear, or equipment. When this item is worn or depicted in the image, faithfully duplicate its exact physical structure, compression seams, elasticity bands, logo, typography, and fabric colorway with ZERO hallucination.`,
                    imageData: img
                });
            } else {
                entries.push({
                    partIndex: idx++,
                    category: 'Context & Scene',
                    name: fileName,
                    description: `Scene setting, environment background, surface material, or lifestyle context reference #${i + 1} ("${fileName}").`,
                    imageData: img
                });
            }
        });
    }

    // 4. Model / Character Images
    if (params.modelImages && params.modelImages.length > 0) {
        params.modelImages.slice(0, 20).forEach((img, i) => {
            const fileName = img.name || `model_character_${i + 1}.png`;
            const matchedProfile = knownProfiles.find(p => new RegExp(`\\b${p.name}\\b`, 'i').test(fileName));
            const charIdentityDesc = matchedProfile
                ? `for character "${matchedProfile.name}" (${matchedProfile.ethnicity}${matchedProfile.genderAge ? `, ${matchedProfile.genderAge}` : ''} with ${matchedProfile.skinTone || 'authentic dark skin tone'})`
                : 'for real person/character ground truth';
            entries.push({
                partIndex: idx++,
                category: 'Model & Character',
                name: fileName,
                description: `CHARACTER & MODEL REFERENCE #${i + 1} ("${fileName}"). Real person/model reference ${charIdentityDesc}. CRITICAL DEMOGRAPHIC & ETHNICITY FIDELITY MANDATE: You MUST faithfully duplicate this person's exact ethnicity, racial identity (${matchedProfile?.ethnicity || 'authentic ethnic heritage'}), skin tone (${matchedProfile?.skinTone || 'melanin complexion, true-to-life skin tone'}), facial structure, eye shape, smile, and natural hair texture. Under NO circumstances whitewash, lighten, or alter this character's race.`,
                imageData: img
            });
        });
    }


    // 5. Pose Images
    if (params.poseImages && params.poseImages.length > 0) {
        params.poseImages.slice(0, 15).forEach((img, i) => {
            const fileName = img.name || `pose_action_${i + 1}.png`;
            entries.push({
                partIndex: idx++,
                category: 'Pose & Action',
                name: fileName,
                description: `Pose reference #${i + 1} ("${fileName}") showing body posture, hand positioning, and camera composition.`,
                imageData: img
            });
        });
    }

    // 6. Company Logo
    if (params.companyLogo) {
        const fileName = params.companyLogo.name || 'brand_logo.png';
        entries.push({
            partIndex: idx++,
            category: 'Brand Logo',
            name: fileName,
            description: `OFFICIAL BRAND LOGO REFERENCE ("${fileName}"). Replicate this authentic brand logo cleanly onto product packaging or clean overlay.`,
            imageData: params.companyLogo
        });
    }

    const productFileNames = entries
        .filter(e => e.category === 'Product Design')
        .map(e => e.name);

    if (entries.length === 0) {
        return {
            referenceEntries: [],
            catalogText: '',
            multimodalParts: [],
            productFileNames: []
        };
    }

    const catalogHeader = [
        '=== VISUAL REFERENCE PHOTO CATALOG & ZERO-HALLUCINATION DIRECTIVES ===',
        'You have been provided with real uploaded photographic references corresponding to numbered image parts below.',
        'MANDATORY RULES:',
        '1. ZERO HALLUCINATION: For the advertised product, gear, apparel, and character references, faithfully duplicate the physical product form, geometry, branding typography, and colors from the designated product reference photos.',
        '2. USE ALL REFERENCES: Every uploaded reference image in this catalog provides real visual ground truth for products, models, gear, props, and scenes. You MUST integrate and faithfully honor all provided references with zero hallucination.',
        '3. PHOTO MAPPING: When a prompt mentions a photo by name (e.g., "[Attached File: ...]", "@photo.png", or "[Extra References: ...]"), locate that exact reference photo in this catalog and faithfully replicate it.',
        '========================================================================'
    ].join('\n');

    const entryLines = entries.map(e => 
        `• [Image Part ${e.partIndex}: "${e.name}" (${e.category})]: ${e.description}`
    ).join('\n');

    const catalogText = `${catalogHeader}\n\n${entryLines}\n========================================================================`;

    const multimodalParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
    entries.forEach(e => {
        multimodalParts.push({
            text: `[REFERENCE IMAGE PART #${e.partIndex}: "${e.name}" (${e.category})]\nRole & Instructions: ${e.description}`
        });
        multimodalParts.push({
            inlineData: {
                data: e.imageData.base64,
                mimeType: e.imageData.mimeType
            }
        });
    });

    return {
        referenceEntries: entries,
        catalogText,
        multimodalParts,
        productFileNames
    };
};

/**
 * Exact-first photo matcher so similar filenames (e.g. product_1.png vs product_10.png or frame.png vs frame-03.png)
 * NEVER hijack each other.
 */
const findBestPhotoEntry = (
    rawToken: string,
    entries: ReferencePhotoEntry[],
    excludeNames?: Set<string>
): ReferencePhotoEntry | undefined => {
    const clean = rawToken.trim().replace(/^@/, '').replace(/^["'\[\]]+|["'\[\]]+$/g, '').trim();
    if (!clean || !entries || entries.length === 0) return undefined;
    const cleanLower = clean.toLowerCase();
    const cleanBase = cleanLower.replace(/\.[^/.]+$/, '');
    const pool = excludeNames
        ? entries.filter(e => !excludeNames.has(e.name.toLowerCase()))
        : entries;

    // 1. Exact full filename match
    const exactFull = pool.find(e => e.name.toLowerCase() === cleanLower);
    if (exactFull) return exactFull;

    // 2. Exact basename match (without extension)
    const exactBase = pool.find(e => e.name.toLowerCase().replace(/\.[^/.]+$/, '') === cleanBase);
    if (exactBase) return exactBase;

    // 3. Entry name contains token (prefer closest/shortest match, require >= 4 chars)
    if (cleanBase.length >= 4) {
        const contains = pool
            .filter(e => e.name.toLowerCase().includes(cleanBase))
            .sort((a, b) => a.name.length - b.name.length);
        if (contains.length > 0) return contains[0];
    }

    // 4. Token contains entry basename (prefer longest/most specific entry basename, require >= 4 chars)
    const reverse = pool
        .filter(e => {
            const eb = e.name.toLowerCase().replace(/\.[^/.]+$/, '');
            return eb.length >= 4 && cleanBase.includes(eb);
        })
        .sort((a, b) => b.name.length - a.name.length);
    return reverse[0];
};

/**
 * Extracts any reference photos explicitly @mentioned or tagged in the prompt text.
 * Supports filenames with spaces, @filename.png, @filename, [Photo: filename], and exact filename occurrences.
 */
export const extractMentionedPhotoEntries = (
    promptText: string,
    entries: ReferencePhotoEntry[]
): ReferencePhotoEntry[] => {
    if (!promptText || !entries || entries.length === 0) return [];
    const matched: ReferencePhotoEntry[] = [];
    const seen = new Set<string>();
    const promptLower = promptText.toLowerCase();

    // 0. Longest-first direct @<exact name> match (supports filenames containing spaces!)
    const sortedByNameLen = [...entries].sort((a, b) => b.name.length - a.name.length);
    for (const e of sortedByNameLen) {
        const eLower = e.name.toLowerCase();
        const eBase = eLower.replace(/\.[^/.]+$/, '');
        if (seen.has(eLower)) continue;
        if (promptLower.includes(`@${eLower}`)) {
            seen.add(eLower);
            matched.push(e);
        } else if (eBase.length >= 3 && new RegExp(`@${eBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,.;:!?)'"\\]])`, 'i').test(promptText)) {
            seen.add(eLower);
            matched.push(e);
        }
    }

    // 1. Matches for @filename or @name tokens
    const atMatches = Array.from(promptText.matchAll(/@([a-zA-Z0-9_\-\.]+)/g));
    for (const m of atMatches) {
        const found = findBestPhotoEntry(m[1], entries, seen);
        if (found) {
            seen.add(found.name.toLowerCase());
            matched.push(found);
        }
    }

    // 2. Matches for [Photo: filename]
    const photoTagMatches = Array.from(promptText.matchAll(/\[Photo:\s*([^\]]+)\]/gi));
    for (const m of photoTagMatches) {
        const found = findBestPhotoEntry(m[1], entries, seen);
        if (found) {
            seen.add(found.name.toLowerCase());
            matched.push(found);
        }
    }

    // 3. Exact full filename matches inside the prompt text (longest-first so product_10 matches before product_1)
    for (const e of sortedByNameLen) {
        const eLower = e.name.toLowerCase();
        if (seen.has(eLower)) continue;
        const eBase = eLower.replace(/\.[^/.]+$/, '');
        if (eBase.length >= 3 && promptLower.includes(eLower)) {
            seen.add(eLower);
            matched.push(e);
        }
    }

    return matched;
};

/**
 * Executes a single image generation directly through the client-side Google AI Studio bridge.
 * When running inside Google AI Studio, window.fetch to generativelanguage.googleapis.com is
 * intercepted by the AI Studio iframe script (_aistudio-iframe.js) and forwarded with the user's
 * linked paid API key (Nedd's Apps • ...SqTs).
 */
export const generateSingleImageViaAiStudioBridge = async (
    item: {
        index: number;
        promptText: string;
        promptTitle: string;
        promptBoxIndex: number;
        promptBoxNumber: number;
        promptId: string;
        fileName?: string;
        referenceImages?: string[];
        promptSnippet?: string;
        itemMultimodalParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
    },
    primaryModel: string,
    imageConfig: any,
    fallbackMultimodalParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    signal?: AbortSignal
): Promise<{
    variantIndex: number;
    id: string;
    fileName?: string;
    referenceImages?: string[];
    modelUsed: string;
    base64?: string;
    mimeType?: string;
    error?: any;
}> => {
    const modelUsed = primaryModel || 'gemini-3-pro-image';
    const effectiveParts = (item.itemMultimodalParts && item.itemMultimodalParts.length > 0)
        ? item.itemMultimodalParts
        : fallbackMultimodalParts;

    const buildPayload = (promptStr: string) => {
        const parts: any[] = [];
        for (const p of effectiveParts) {
            if (p.inlineData && p.inlineData.data) {
                parts.push({
                    inlineData: {
                        mimeType: p.inlineData.mimeType || 'image/jpeg',
                        data: p.inlineData.data
                    }
                });
            } else if (p.text) {
                parts.push({ text: p.text });
            }
        }
        parts.push({ text: promptStr });

        const body: any = {
            contents: [
                {
                    role: 'user',
                    parts
                }
            ]
        };

        if (imageConfig && typeof imageConfig === 'object') {
            body.generationConfig = {
                imageConfig: {
                    aspectRatio: imageConfig.aspectRatio || '1:1',
                    ...(imageConfig.imageSize ? { imageSize: imageConfig.imageSize } : {})
                }
            };
        }
        return body;
    };

    const isFatalQuotaOrAuth = (errText: string): boolean => {
        const lower = errText.toLowerCase();
        return lower.includes('429') || 
               lower.includes('quota') || 
               lower.includes('resource_exhausted') || 
               lower.includes('free tier') ||
               lower.includes('limit: 0') ||
               lower.includes('401') || 
               lower.includes('403') || 
               lower.includes('permission_denied') ||
               lower.includes('unauthenticated');
    };

    const callApi = async (body: any): Promise<any> => {
        const customKey = getCustomApiKey();
        const keyParam = customKey ? `?key=${encodeURIComponent(customKey)}` : '';
        const cleanModel = modelUsed.replace(/^models\//, '');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent${keyParam}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'aistudio-build'
        };
        if (customKey) {
            headers['x-goog-api-key'] = customKey;
        }

        const resp = await window.fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            const errMessage = errData?.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
            throw new Error(errMessage);
        }

        return await resp.json();
    };

    let responseData: any = null;
    let lastError = '';

    try {
        responseData = await callApi(buildPayload(item.promptText));
    } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[AI Studio Bridge Variation ${item.index + 1}] Primary call failed:`, err);
    }

    let candidate = responseData?.candidates?.[0];
    let imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);

    // Safe Retry if blocked by safety review and not quota/auth
    if (!imagePart && !isFatalQuotaOrAuth(lastError)) {
        try {
            const safePrompt = sanitizePromptForSafety(item.promptText);
            const retryData = await callApi(buildPayload(safePrompt));
            const retryCandidate = retryData?.candidates?.[0];
            const retryImage = retryCandidate?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
            if (retryImage) {
                responseData = retryData;
                candidate = retryCandidate;
                imagePart = retryImage;
                lastError = '';
            }
        } catch (retryErr: any) {
            console.warn(`[AI Studio Bridge Variation ${item.index + 1}] Safe retry failed:`, retryErr);
            if (!lastError) lastError = retryErr?.message || String(retryErr);
        }
    }

    if (imagePart && imagePart.inlineData?.data) {
        return {
            variantIndex: item.index,
            id: item.promptId,
            fileName: item.fileName,
            referenceImages: item.referenceImages,
            modelUsed,
            base64: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType || 'image/png'
        };
    }

    const parseDetailedReason = (rawError?: string): string => {
        if (!rawError) return `Unknown error occurred while generating ${item.promptTitle}.`;
        const lower = rawError.toLowerCase();
        if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
            return `Invalid API Key: Google did not recognize the provided API key. Check for missing characters or whitespace in your key.`;
        }
        if (lower.includes('permission_denied') || lower.includes('403')) {
            return `Permission Denied (403): Ensure 'Generative Language API' is enabled in Google Cloud Console for this key's project, and that the key has no restrictive IP/referrer filters.`;
        }
        if (lower.includes('limit: 0') || lower.includes('free tier') || lower.includes('free_tier')) {
            return `Free Tier Limit (0 Quota): This key belongs to a project without Billing enabled. Gemini image models require a paid billing project (Pay-As-You-Go).`;
        }
        if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
            return `Rate Limit Exceeded (429): Quota exhausted for ${modelUsed}. Wait 30 seconds or verify your quotas in Google Cloud Console.`;
        }
        if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('aborted')) {
            return `Generation timed out on ${item.promptTitle}. The model took too long to complete.`;
        }
        if (lower.includes('safety') || lower.includes('blocked') || lower.includes('harm')) {
            return `Generation blocked by Gemini safety review on ${item.promptTitle}: "${rawError}". Adjust sensitive terms, exposure, or referenced imagery.`;
        }
        if (lower.includes('400') || lower.includes('invalid') || lower.includes('bad request')) {
            return `Invalid request parameter or conflicting prompt settings (400 Bad Request) on ${item.promptTitle}: ${rawError}.`;
        }
        if (lower.includes('500') || lower.includes('503') || lower.includes('internal') || lower.includes('unavailable')) {
            return `Gemini service temporarily unavailable (500/503) on ${item.promptTitle}. Please retry in a few moments.`;
        }
        return `Request failed on ${item.promptTitle}: ${rawError}`;
    };

    const blockReason = responseData?.promptFeedback?.blockReason;
    const specificReason = blockReason 
        ? `Generation blocked by Gemini safety review (${blockReason}) on ${item.promptTitle}.`
        : parseDetailedReason(lastError);

    return {
        variantIndex: item.index,
        id: item.promptId,
        fileName: item.fileName,
        referenceImages: item.referenceImages,
        modelUsed,
        error: {
            message: `${item.promptTitle} failed: ${lastError || specificReason}`,
            specificReason,
            modelUsed,
            promptBoxIndex: item.promptBoxIndex,
            promptBoxNumber: item.promptBoxNumber,
            promptTitle: item.promptTitle,
            promptId: item.promptId,
            fileName: item.fileName,
            referenceImages: item.referenceImages,
            promptSnippet: item.promptSnippet
        }
    };
};

/**
 * Generates ad images using the server-side Gemini endpoint.
 * Supports streaming progress updates and resilient retries.
 */
export const generateAdImage = async (
    params: GenerateAdParams, 
    signal: AbortSignal,
    onProgress?: (current: number, total: number) => void
): Promise<ImageGenerationResponse> => {
    const { 
        productImage, productImages, competitorImages, subjectImages, modelImages, poseImages, companyLogo, productName, backgroundPrompt, slogan, 
        placement, fullPrompt, aspectRatio, negativePrompt, style, mood, numberOfVariations,
        cameraType, focalLength, aperture, shutterSpeed, lightingStyle, lightingSetup, distortion, textureDetail, colorStyle, technique, cameraAngle,
        modelType = 'pro', imageSize = '2K', promptMode, promptBoxIndices, soloPromptIndex,
        promptIds, promptFileNames, promptReferenceImages, globalReferenceImages, characters
    } = params;

    const hasLogo = !!companyLogo;
    const multiplePrompts = Array.isArray(fullPrompt) ? fullPrompt : null;
    const variationsCount = multiplePrompts ? multiplePrompts.length : (numberOfVariations || 1);

    const cameraDetails = [
        cameraType,
        cameraAngle,
        focalLength,
        aperture,
        shutterSpeed,
        lightingStyle,
        lightingSetup,
        distortion,
        textureDetail,
        colorStyle,
        technique,
    ].filter(Boolean).join(', ');

    if (signal.aborted) {
        const error = new Error("Generation cancelled by user.");
        error.name = "AbortError";
        throw error;
    }

    const totalImageCount = subjectImages.length + (productImages?.length || 0) + (competitorImages?.length || 0) + (modelImages?.length || 0) + (poseImages?.length || 0);
    const secondaryDimension = totalImageCount > 15 ? 1024 : 1280;

    const resizedProductImage = productImage ? await resizeImage(productImage, 1536, true) : null;
    const resizedProductImages = productImages ? await Promise.all(productImages.map(img => resizeImage(img, 1536, true))) : [];
    const resizedLogo = companyLogo ? await resizeImage(companyLogo, 1536, true) : null;
    const resizedModelImages = modelImages ? await Promise.all(modelImages.map(img => resizeImage(img, 1280, true))) : [];
    const resizedPoseImages = poseImages ? await Promise.all(poseImages.map(img => resizeImage(img, 1024, false))) : [];
    const resizedCompetitorImages = competitorImages ? await Promise.all(competitorImages.map(img => resizeImage(img, 1280, true))) : [];
    const resizedSubjectImages = await Promise.all(subjectImages.map(img => resizeImage(img, secondaryDimension, true)));

    const { multimodalParts, referenceEntries } = buildPhotoReferenceCatalog({
        productImage: resizedProductImage,
        productImages: resizedProductImages,
        competitorImages: resizedCompetitorImages,
        subjectImages: resizedSubjectImages,
        modelImages: resizedModelImages,
        poseImages: resizedPoseImages,
        companyLogo: resizedLogo,
        productName
    });

    const primaryModel = resolveImageModelName(modelType);
    const projectCharacters = (characters && characters.length > 0) ? characters : loadCharacterProfiles();

    const buildTargetedItem = (index: number) => {
        const targetFileName = promptFileNames?.[index]?.trim() || '';
        const promptRefs = promptReferenceImages?.[index] || [];
        const allExtraRefs = Array.from(new Set([...promptRefs, ...(globalReferenceImages || [])].map(r => r.trim()).filter(Boolean)));

        let rawPrompt = '';
        if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
            rawPrompt = fullPrompt[index]?.trim() || `A professional commercial photograph of ${productName || 'the product'}.`;
        } else if (promptMode === 'full' && typeof fullPrompt === 'string') {
            rawPrompt = fullPrompt.trim() || `A professional commercial photograph of ${productName || 'the product'}.`;
        } else {
            const rawPlacement = placement?.trim() || `A high-end commercial shot of ${productName || 'the product'}`;
            const placementMentions = extractMentionedPhotoEntries(rawPlacement, referenceEntries);
            const mentionsScenePhoto = placementMentions.some(m => m.category === 'Context & Scene');
            const swapInPlacement = parseCharacterSwapPrompt(rawPlacement, referenceEntries);
            const includeGuidedBg = !swapInPlacement && !mentionsScenePhoto && Boolean(backgroundPrompt);
            const baseDescription = includeGuidedBg
                ? `${rawPlacement}. The background is ${backgroundPrompt}.`
                : rawPlacement;
            const guidedParts = [
                baseDescription,
                aspectRatio === '97:60' ? 'Layout: Amazon Product Infographic (970x600).' : '',
                style && style !== 'None' ? `Style: ${style}.` : '',
                mood && mood !== 'None' ? `Mood: ${mood}.` : '',
                cameraDetails ? `Camera & Lighting: ${cameraDetails}.` : '',
                hasLogo ? 'Branding: Include the company logo cleanly.' : '',
                slogan ? `Text Overlay: Include "${slogan}".` : '',
            ].filter(Boolean);
            rawPrompt = guidedParts.join('\n');
        }

        const swapIntent = parseCharacterSwapPrompt(rawPrompt, referenceEntries);
        const mentionedPhotos = extractMentionedPhotoEntries(rawPrompt, referenceEntries);
        const attachedEntry = targetFileName ? findBestPhotoEntry(targetFileName, referenceEntries) : undefined;
        const extraEntries = allExtraRefs
            .map(refName => ({ refName, entry: findBestPhotoEntry(refName, referenceEntries) }));

        // Determine whether this specific prompt explicitly targets specific reference photo(s)
        const hasExplicitTargets = Boolean(swapIntent) || mentionedPhotos.length > 0 || Boolean(attachedEntry) || extraEntries.some(x => Boolean(x.entry));

        // Build the EXACT, ordered list of images that will be attached to THIS prompt (1-based sequential numbering)
        const itemMultimodalParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
        const includedEntries: Array<{ seq: number; entry: ReferencePhotoEntry; roleLabel: string }> = [];
        const usedNames = new Set<string>();
        let seq = 1;

        const pushImagePart = (entry: ReferencePhotoEntry, roleLabel: string, instructionText: string) => {
            if (usedNames.has(entry.name.toLowerCase())) return;
            usedNames.add(entry.name.toLowerCase());
            const currentSeq = seq++;
            includedEntries.push({ seq: currentSeq, entry, roleLabel });
            itemMultimodalParts.push({
                text: `[IMAGE #${currentSeq} — ${roleLabel}: "@${entry.name}"]\n${instructionText}`
            });
            itemMultimodalParts.push({
                inlineData: {
                    data: entry.imageData.base64,
                    mimeType: entry.imageData.mimeType
                }
            });
        };

        const getRoleAndInstructionForEntry = (entry: ReferencePhotoEntry, isHeroTarget: boolean): { roleLabel: string; instruction: string } => {
            const matchedChar = projectCharacters.find(c => new RegExp(`\\b${c.name}\\b`, 'i').test(entry.name));
            const isCharacter = entry.category === 'Model & Character' || !!matchedChar;
            const isProduct = entry.category === 'Product Design' || entry.category === 'Apparel & Gear';
            const isCompetitor = entry.category === 'Competitor Comparison';
            const isLogo = entry.category === 'Brand Logo';
            const isPose = entry.category === 'Pose & Action';

            if (isProduct) {
                return {
                    roleLabel: isHeroTarget ? 'PRIMARY TARGET PRODUCT (EXACT GROUND TRUTH)' : 'PRODUCT / ITEM REFERENCE (EXACT GROUND TRUTH)',
                    instruction: `EXACT PRODUCT REPLICATION MANDATE: Faithfully duplicate the EXACT physical product pictured in "@${entry.name}" with ZERO hallucination. Preserve its exact shape, proportions, packaging/container geometry, seams, materials, surface finish, colors, brand logo, and every visible word/letter of label typography identically. Do NOT invent a generic substitute or alter any packaging detail.`
                };
            }
            if (isCompetitor) {
                return {
                    roleLabel: 'COMPARISON / BENCHMARK PRODUCT REFERENCE',
                    instruction: `Faithfully replicate this exact comparison item from "@${entry.name}" only where requested for side-by-side or versus comparison.`
                };
            }
            if (isCharacter) {
                return {
                    roleLabel: 'CHARACTER / MODEL REFERENCE',
                    instruction: `Faithfully replicate this exact person's facial structure, ethnicity${matchedChar ? ` (${matchedChar.ethnicity})` : ''}, skin tone, hair texture, and likeness from "@${entry.name}" with zero whitewashing or race alteration.`
                };
            }
            if (isPose) {
                return {
                    roleLabel: 'POSE & COMPOSITION REFERENCE',
                    instruction: `Match the body posture, hand placement, and framing from "@${entry.name}" without copying unrelated products or backgrounds.`
                };
            }
            if (isLogo) {
                return {
                    roleLabel: 'OFFICIAL BRAND LOGO',
                    instruction: `Replicate this authentic brand logo cleanly onto the product or layout without distorting its letterforms or emblem.`
                };
            }
            return {
                roleLabel: isHeroTarget ? 'TARGET SCENE / PHOTO REFERENCE' : 'CONTEXT & SCENE REFERENCE',
                instruction: `Use "@${entry.name}" as exact visual ground truth for the referenced scene, product, layout, environment, lighting, or subject exactly as described in the prompt.`
            };
        };

        if (swapIntent) {
            const { swapKind, targetSceneEntry, sourceSubjectEntry, targetSubjectDesc, sourceSubjectDesc } = swapIntent;
            if (swapKind === 'object') {
                pushImagePart(
                    targetSceneEntry,
                    'TARGET BASE SCENE PHOTO',
                    `THIS IS THE BASE PHOTO TO EDIT. Keep 100% of the background, environment, lighting, shadows, framing, camera angle, and all other objects/people intact — ONLY remove "${targetSubjectDesc}" and place the exact product/item from IMAGE #2 in that position.`
                );
                pushImagePart(
                    sourceSubjectEntry,
                    'REPLACEMENT PRODUCT / OBJECT SOURCE (EXACT GROUND TRUTH)',
                    `THIS IS THE EXACT PRODUCT ("${sourceSubjectDesc}") TO PLACE INTO IMAGE #1. Faithfully clone its exact physical geometry, proportions, label typography, brand logo, colors, seams, and surface texture with ZERO hallucination. STRICTLY DISCARD the background of "@${sourceSubjectEntry.name}".`
                );
            } else {
                pushImagePart(
                    targetSceneEntry,
                    'TARGET BASE SCENE PHOTO',
                    `THIS IS THE BASE PHOTO TO EDIT. Preserve 100% of its background, setting, camera angle, framing, lighting, shadows, props, and other people — ONLY remove "${targetSubjectDesc}" and replace them with the person from IMAGE #2.`
                );
                pushImagePart(
                    sourceSubjectEntry,
                    'REPLACEMENT CHARACTER SOURCE',
                    `THIS IS THE NEW PERSON ("${sourceSubjectDesc}") TO INSERT INTO IMAGE #1. Copy their exact face, ethnicity, skin tone, hair texture, and likeness to replace "${targetSubjectDesc}" in IMAGE #1. STRICTLY DISCARD the background of "@${sourceSubjectEntry.name}".`
                );
            }

            // Include any additional explicitly @mentioned photos (e.g., a 3rd product or prop)
            mentionedPhotos.forEach(entry => {
                const { roleLabel, instruction } = getRoleAndInstructionForEntry(entry, false);
                pushImagePart(entry, roleLabel, instruction);
            });
            extraEntries.forEach(({ entry }) => {
                if (entry) {
                    const { roleLabel, instruction } = getRoleAndInstructionForEntry(entry, false);
                    pushImagePart(entry, roleLabel, instruction);
                }
            });
        } else if (hasExplicitTargets) {
            // STRICT TARGET ISOLATION: Include ONLY the photos this prompt actually targets!
            // This prevents unrelated uploaded products, competitors, or scenes from contaminating/hallucinating the target.

            // 1. Explicitly @mentioned photos in the prompt text (highest priority!)
            mentionedPhotos.forEach((entry, idx) => {
                const { roleLabel, instruction } = getRoleAndInstructionForEntry(entry, idx === 0 && !attachedEntry);
                pushImagePart(entry, roleLabel, instruction);
            });

            // 2. Explicitly attached Hero/File reference for this prompt
            if (attachedEntry) {
                const { roleLabel, instruction } = getRoleAndInstructionForEntry(attachedEntry, true);
                pushImagePart(attachedEntry, roleLabel, instruction);
            }

            // 3. Explicitly selected Extra References for this prompt
            extraEntries.forEach(({ entry }) => {
                if (entry) {
                    const { roleLabel, instruction } = getRoleAndInstructionForEntry(entry, false);
                    pushImagePart(entry, roleLabel, instruction);
                }
            });

            // 4. Company logo if uploaded and prompt didn't exclude branding
            const logoEntry = referenceEntries.find(e => e.category === 'Brand Logo');
            if (logoEntry && hasLogo) {
                const { roleLabel, instruction } = getRoleAndInstructionForEntry(logoEntry, false);
                pushImagePart(logoEntry, roleLabel, instruction);
            }
        } else {
            // No specific @mention or per-prompt file selected -> include all uploaded workspace references
            referenceEntries.forEach((entry, idx) => {
                const { roleLabel, instruction } = getRoleAndInstructionForEntry(entry, idx === 0 && entry.category === 'Product Design');
                pushImagePart(entry, roleLabel, instruction);
            });
        }

        // Detect character demographics ONLY for THIS prompt (never bleed characters from other prompt boxes!)
        const corpusForCharDetection = [
            rawPrompt,
            targetFileName,
            ...allExtraRefs
        ];
        const activeCharacters = detectActiveCharacters(corpusForCharDetection, projectCharacters);
        const characterDemographicDirectives = generateCharacterDirectives(activeCharacters);

        // Build clean, exact 1-to-1 reference index matching the EXACT images sent in itemMultimodalParts
        let referenceBindingBlock = '';
        if (includedEntries.length > 0 && !swapIntent) {
            const lines = includedEntries.map(({ seq: imgNum, entry, roleLabel }) => {
                const isProd = entry.category === 'Product Design' || entry.category === 'Apparel & Gear';
                if (isProd) {
                    return `• IMAGE #${imgNum} = "@${entry.name}" (${roleLabel}): STRICT ZERO-HALLUCINATION PRODUCT CLONE. Replicate the exact product shape, color, material, seams, logo, and label text from IMAGE #${imgNum}. Do NOT invent, simplify, or substitute any part of this product.`;
                }
                return `• IMAGE #${imgNum} = "@${entry.name}" (${roleLabel}): Use IMAGE #${imgNum} strictly as authentic visual ground truth for "@${entry.name}" wherever referenced in the prompt.`;
            });
            referenceBindingBlock = [
                `=== TARGET REFERENCE PHOTO MAP (${includedEntries.length} ${includedEntries.length === 1 ? 'Photo' : 'Photos'} Attached) ===`,
                'Every @mention and reference photo below corresponds 1-to-1 to the exact attached IMAGE # above:',
                ...lines,
                'MANDATORY FIDELITY RULE: Do NOT hallucinate, redesign, recolor, or alter the target product/subject shown in the referenced IMAGE #(s). Keep every physical contour, texture, logo, and label faithful to the source photograph.'
            ].join('\n');
        }

        let swapDirectiveBlock = '';
        if (swapIntent) {
            if (swapIntent.swapKind === 'object') {
                swapDirectiveBlock = [
                    '=== CRITICAL PRODUCT / OBJECT SWAP EXECUTION MANDATE (HIGHEST PRIORITY) ===',
                    `The user explicitly requested a DIRECT PRODUCT / OBJECT REPLACEMENT between IMAGE #1 and IMAGE #2:`,
                    `1. IMAGE #1 ("@${swapIntent.targetSceneEntry.name}") = TARGET BASE SCENE PHOTO:`,
                    `   - PRESERVE THIS SCENE 100%: Keep the exact background, lighting, surface, camera angle, framing, shadows, depth of field, and all surrounding elements intact.`,
                    `   - REMOVE & REPLACE ONLY "${swapIntent.targetSubjectDesc}": Completely remove the existing "${swapIntent.targetSubjectDesc}" in IMAGE #1 and place the exact product/item from IMAGE #2 in its exact spot and perspective.`,
                    `2. IMAGE #2 ("@${swapIntent.sourceSubjectEntry.name}") = REPLACEMENT PRODUCT / OBJECT (EXACT GROUND TRUTH):`,
                    `   - EXACT PHYSICAL CLONE: Faithfully reproduce the exact product silhouette, proportions, packaging/material finish, seams, colors, brand logo, and label typography from IMAGE #2 with ZERO hallucination.`,
                    `   - STRICTLY DISCARD SOURCE BACKGROUND: Do NOT copy or blend any background from IMAGE #2. Extract ONLY the product/item and composite it naturally with realistic contact shadows and reflections matching IMAGE #1.`
                ].join('\n');
            } else {
                const outfitInstruction = swapIntent.outfitDirective === 'keep-scene-outfit'
                    ? `OUTFIT RULE: Keep the exact clothing/outfit worn by "${swapIntent.targetSubjectDesc}" in IMAGE #1 ("@${swapIntent.targetSceneEntry.name}"), transferring ONLY the replacement person's head, face, hair, ethnicity, skin tone, and body features.`
                    : swapIntent.outfitDirective === 'keep-source-outfit'
                        ? `OUTFIT RULE: Keep the clothing/outfit worn by "${swapIntent.sourceSubjectDesc}" in IMAGE #2 ("@${swapIntent.sourceSubjectEntry.name}") along with their face, hair, ethnicity, and skin tone.`
                        : `OUTFIT RULE: Keep "${swapIntent.sourceSubjectDesc}"'s exact face, skin tone, ethnicity, hair, and likeness, dressed naturally to fit the scene in IMAGE #1.`;

                swapDirectiveBlock = [
                    '=== CRITICAL CHARACTER / SUBJECT SWAP EXECUTION MANDATE (HIGHEST PRIORITY) ===',
                    `The user explicitly requested a DIRECT CHARACTER SWAP between IMAGE #1 and IMAGE #2:`,
                    `1. IMAGE #1 ("@${swapIntent.targetSceneEntry.name}") = TARGET BASE SCENE PHOTO:`,
                    `   - PRESERVE THIS SCENE 100%: Keep the exact environment, background, camera angle, framing, color grading, lighting, props, and all other people completely intact.`,
                    `   - REMOVE & REPLACE ONLY "${swapIntent.targetSubjectDesc}": Completely remove the existing "${swapIntent.targetSubjectDesc}" and place the person from IMAGE #2 in that exact position.`,
                    `2. IMAGE #2 ("@${swapIntent.sourceSubjectEntry.name}") = REPLACEMENT CHARACTER SOURCE:`,
                    `   - TRANSFER THIS EXACT PERSON: Faithfully clone the exact facial structure, skin tone, ethnic heritage, melanin complexion, age, and hair texture from IMAGE #2.`,
                    `   - STRICTLY DISCARD SOURCE BACKGROUND: Do NOT copy or blend any background from IMAGE #2.`,
                    `3. ${outfitInstruction}`,
                    `4. SEAMLESS COMPOSITING: Match lighting direction, shadow softness, ambient color bounce, and focal blur of IMAGE #1.`
                ].join('\n');
            }
        }

        const resolutionQualityNote = (imageSize === '6K' || imageSize === '8K') 
            ? `IMPORTANT: High-resolution ${imageSize} render. Capture fine micro-textures, crisp focus, and authentic surface detail.` 
            : '';

        let effectiveNegative = sanitizeNegativePrompt(negativePrompt || '');
        const characterNegatives = generateCharacterNegativeTerms(activeCharacters);
        if (characterNegatives) {
            effectiveNegative = effectiveNegative ? `${effectiveNegative}, ${characterNegatives}` : characterNegatives;
        }
        if (swapIntent) {
            const swapNegatives = swapIntent.swapKind === 'object'
                ? `original replaced ${swapIntent.targetSubjectDesc} from ${swapIntent.targetSceneEntry.name}, wrong background from ${swapIntent.sourceSubjectEntry.name}, altered logo, garbled label text, generic substitute product, mismatched perspective`
                : `original face of replaced ${swapIntent.targetSubjectDesc} from ${swapIntent.targetSceneEntry.name}, wrong background from ${swapIntent.sourceSubjectEntry.name}, blended background, cut-and-paste seams, altered skin tone, whitewashed face`;
            effectiveNegative = effectiveNegative ? `${effectiveNegative}, ${swapNegatives}` : swapNegatives;
        }

        // Only inject human skin / character realism rules when the prompt or references actually involve people!
        const hasPeopleInPrompt =
            activeCharacters.length > 0 ||
            includedEntries.some(x => x.entry.category === 'Model & Character') ||
            (swapIntent?.swapKind === 'character') ||
            /\b(person|people|woman|man|model|athlete|hand|hands|holding|wearing|portrait|face|skin|girl|boy|customer|runner|body)\b/i.test(rawPrompt);

        const skinRealismDirective = hasPeopleInPrompt
            ? 'HUMAN & SKIN REALISM DIRECTIVE: For any person, face, or hands in the image, render natural realistic skin texture, authentic complexion, and true-to-life lighting without plastic or airbrushed artifacts.'
            : '';

        const promptInstructions = [
            swapDirectiveBlock,
            referenceBindingBlock,
            `USER PROMPT (FOLLOW EXACTLY):\n${rawPrompt}`,
            characterDemographicDirectives,
            skinRealismDirective,
            resolutionQualityNote,
            effectiveNegative ? `Strict Exclusion: Do not include ${effectiveNegative}.` : '',
        ].filter(Boolean);

        return {
            promptText: promptInstructions.join('\n\n'),
            rawPrompt,
            swapIntent,
            itemMultimodalParts
        };
    };

    const imageConfig: any = {
        aspectRatio: mapToApiAspectRatio(aspectRatio),
    };
    if (primaryModel === 'gemini-3-pro-image' || primaryModel === 'gemini-3.1-flash-image' || primaryModel === 'gemini-nano-banana-2.1') {
        imageConfig.imageSize = mapToApiImageSize(imageSize, primaryModel);
    }

    let activeIndices: number[] = [];
    if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
        activeIndices = fullPrompt
            .map((p, idx) => (p && p.trim() !== '') ? idx : -1)
            .filter(idx => idx !== -1);
        if (activeIndices.length === 0) {
            activeIndices = [0];
        }
    } else {
        activeIndices = Array.from({ length: variationsCount }).map((_, idx) => idx);
    }

    const items = activeIndices.map(variantIndex => {
        const promptBoxIndex = promptBoxIndices?.[variantIndex] !== undefined
            ? promptBoxIndices[variantIndex]
            : (soloPromptIndex !== undefined && soloPromptIndex !== null
                ? soloPromptIndex
                : variantIndex);
        const promptBoxNumber = promptBoxIndex + 1;
        const promptId = params.promptIds?.[variantIndex] || String(promptBoxNumber);
        const isSolo = soloPromptIndex !== undefined && soloPromptIndex !== null;
        const promptTitle = promptMode === 'multiple' 
            ? (isSolo 
                ? `Prompt Box #${soloPromptIndex + 1} (Solo Mode • Variation ${variantIndex + 1})`
                : `Prompt Box #${promptBoxNumber}${params.promptIds?.[variantIndex] ? ` (ID: ${params.promptIds[variantIndex]})` : ''}`)
            : promptMode === 'full' 
                ? 'Full Custom Prompt Box' 
                : 'Guided Mode Prompt';

        let promptSnippet = '';
        if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
            promptSnippet = fullPrompt[variantIndex]?.trim().slice(0, 100) || '';
        } else if (typeof fullPrompt === 'string') {
            promptSnippet = fullPrompt.trim().slice(0, 100);
        }

        const { promptText, itemMultimodalParts } = buildTargetedItem(variantIndex);
        const targetFileName = params.promptFileNames?.[variantIndex]?.trim();
        const promptRefs = params.promptReferenceImages?.[variantIndex];

        return {
            index: variantIndex,
            promptText,
            promptTitle,
            promptBoxNumber,
            promptBoxIndex,
            promptId,
            fileName: targetFileName || undefined,
            referenceImages: promptRefs,
            promptSnippet,
            itemMultimodalParts
        };
    });


    // Execution routing:
    // If running inside Google AI Studio without a custom override key, use the direct AI Studio
    // in-browser bridge so window.fetch is intercepted by _aistudio-iframe.js with the user's linked
    // paid key (e.g., Nedd's Apps • ...SqTs). Otherwise, use the full-stack server-side endpoint.
    const inAiStudio = typeof window !== 'undefined' && Boolean((window as any).aistudio);
    const hasCustomKey = Boolean(getCustomApiKey());

    const isProOrBanana = primaryModel === 'gemini-3-pro-image' || primaryModel === 'gemini-nano-banana-2.1';
    const cfg: any = {
        aspectRatio: mapToApiAspectRatio(aspectRatio),
        ...(isProOrBanana ? { imageSize: mapToApiImageSize(imageSize, primaryModel) } : {})
    };

    let results: any[] = [];
    let completedCount = 0;

    if (inAiStudio && !hasCustomKey) {
        console.log(`[generateAdImage] Executing via Google AI Studio native paid key bridge (${items.length} items)...`);
        const BATCH_SIZE = 2;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            if (signal.aborted) {
                const abortErr = new Error("Generation cancelled by user.");
                abortErr.name = "AbortError";
                throw abortErr;
            }
            const batch = items.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(item => generateSingleImageViaAiStudioBridge(
                    item, primaryModel, cfg, multimodalParts, signal
                ))
            );
            for (const r of batchResults) {
                results.push(r);
                completedCount++;
                onProgress?.(completedCount, items.length);
            }
        }
    } else {
        // Execute via server-side endpoint with SSE streaming progress
        const response = await fetch("/api/gemini/generate-ad-image", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                items,
                primaryModel,
                imageConfig: cfg,
                multimodalParts,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let completed = 0;

            while (true) {
                if (signal?.aborted) {
                    reader.cancel();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr) continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.type === 'progress') {
                            onProgress?.(parsed.current, parsed.total);
                        } else if (parsed.type === 'item' && parsed.result) {
                            completed++;
                            onProgress?.(completed, items.length);
                            results.push(parsed.result);
                        } else if (parsed.type === 'done' && Array.isArray(parsed.results)) {
                            results = parsed.results;
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.error);
                        }
                    } catch (e: any) {
                        if (e.message && e.message !== 'Unexpected end of JSON input') {
                            console.warn('[Client Stream] Parse notice:', e);
                        }
                    }
                }
            }
        } else {
            const data = await response.json();
            results = data.results || [];
        }

        // Automatic Recovery: If any server item failed due to Free Tier Limit / 0 Quota,
        // and we are in AI Studio, automatically rescue it via the in-browser AI Studio bridge!
        if (inAiStudio) {
            for (let i = 0; i < results.length; i++) {
                const res = results[i];
                if (res?.error) {
                    const errLower = (res.error.specificReason || res.error.message || '').toLowerCase();
                    if (errLower.includes('free tier') || errLower.includes('limit: 0') || errLower.includes('quota') || errLower.includes('resource_exhausted')) {
                        const originalItem = items.find(it => it.index === res.variantIndex);
                        if (originalItem) {
                            console.log(`[generateAdImage] Rescuing failed item ${originalItem.index + 1} with AI Studio native paid key bridge...`);
                            const recovered = await generateSingleImageViaAiStudioBridge(
                                originalItem, primaryModel, cfg, multimodalParts, signal
                            );
                            if (!recovered.error && recovered.base64) {
                                results[i] = recovered;
                            }
                        }
                    }
                }
            }
        }
    }

    const images: AdVariation[] = [];
    const errors: GenerationError[] = [];

    for (const res of results) {
        if (res.error) {
            errors.push(res.error);
        } else if (res.base64) {
            const mime = res.mimeType || 'image/png';
            images.push({
                url: `data:${mime};base64,${res.base64}`,
                variantIndex: res.variantIndex,
                id: res.id,
                fileName: res.fileName,
                referenceImages: res.referenceImages,
                modelUsed: res.modelUsed || primaryModel
            });
        }
    }

    if (images.length === 0) {
        return {
            images: [],
            errors: errors.sort((a, b) => a.variantIndex - b.variantIndex)
        };
    }

    const convertedImages = await Promise.all(
        images.map(async (img) => {
            let webpUrl = await convertToWebP(img.url);
            if (aspectRatio && ASPECT_RATIO_VALUES[aspectRatio]) {
                const forceWidth = aspectRatio === '36:13' ? 1920 : undefined;
                const forceHeight = aspectRatio === '36:13' ? 693 : undefined;
                webpUrl = await cropImageToAspectRatio(webpUrl, ASPECT_RATIO_VALUES[aspectRatio], forceWidth, forceHeight);
            }
            return {
                url: webpUrl,
                variantIndex: img.variantIndex,
                id: img.id,
                fileName: img.fileName,
                referenceImages: img.referenceImages,
                modelUsed: img.modelUsed
            };
        })
    );

    convertedImages.sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));

    return {
        images: convertedImages,
        errors
    };
};

/**
 * Kling video proxy.
 */
export const generateKlingVideo = async (
    params: { prompt: string, image?: ImageData, duration?: string, aspectRatio?: string, apiKey?: string, secretKey?: string, model?: string }, 
    signal: AbortSignal
): Promise<Blob> => {
    try {
        const response = await fetch('/api/video/kling/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: params.prompt,
                image: params.image ? `data:${params.image.mimeType};base64,${params.image.base64}` : undefined,
                duration: params.duration,
                aspectRatio: params.aspectRatio,
                apiKey: params.apiKey,
                secretKey: params.secretKey,
                model: params.model
            })
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error || data.message || data.msg || "Kling generation failed";
            throw new Error(errorMsg);
        }

        if (!data.data || !data.data.task_id) {
            throw new Error(data.message || data.msg || "Kling API returned an invalid response (missing task_id)");
        }

        const taskId = data.data.task_id;
        
        while (true) {
            if (signal.aborted) throw new Error("Generation cancelled");
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const queryParams = new URLSearchParams();
            if (params.apiKey) queryParams.append('apiKey', params.apiKey);
            if (params.secretKey) queryParams.append('secretKey', params.secretKey);
            
            const statusRes = await fetch(`/api/video/kling/status/${taskId}?${queryParams.toString()}`);
            const statusData = await statusRes.json();
            
            if (!statusRes.ok) throw new Error(statusData.error || "Failed to check Kling status");
            
            const task = statusData.data;
            if (task.task_status === 'succeed') {
                const videoUrl = task.task_result.videos[0].url;
                const videoRes = await fetch(`/api/video/proxy?url=${encodeURIComponent(videoUrl)}`);
                if (!videoRes.ok) throw new Error("Failed to download video through proxy");
                return await videoRes.blob();
            } else if (task.task_status === 'failed') {
                throw new Error(task.task_status_msg || "Kling generation failed");
            }
        }
    } catch (error: any) {
        if (signal.aborted || error.name === 'AbortError') {
            const e = new Error("Generation cancelled by user.");
            e.name = "AbortError";
            throw e;
        }
        throw error;
    }
};

/**
 * Animates a static image into a video via server-side Veo or Kling.
 */
export const animateImage = async (
    params: { image: ImageData, prompt: string, settings?: VideoSettingsData, klingKeys?: { apiKey: string, secretKey: string, model: string } }, 
    signal: AbortSignal
): Promise<Blob> => {
    const { image, prompt, settings, klingKeys } = params;

    if (settings?.model === 'kling') {
        return generateKlingVideo({
            prompt: prompt || 'Animate this image in a cinematic way.',
            image,
            duration: settings.duration,
            aspectRatio: settings.aspectRatio,
            apiKey: klingKeys?.apiKey,
            secretKey: klingKeys?.secretKey,
            model: klingKeys?.model
        }, signal);
    }

    if (signal.aborted) {
        const error = new Error("Generation cancelled by user.");
        error.name = "AbortError";
        throw error;
    }

    const resizedImage = await resizeImage(image);
    const videoPrompt = [
        prompt || 'Animate this image in a cinematic way.',
        settings?.cameraType ? `Camera: ${settings.cameraType}.` : '',
        settings?.technique ? `Technique: ${settings.technique}.` : '',
        settings?.lighting ? `Lighting: ${settings.lighting}.` : '',
        settings?.duration ? `Duration: ${settings.duration}.` : '',
    ].filter(Boolean).join(' ');

    const response = await fetch("/api/gemini/animate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            image: {
                base64: resizedImage.base64,
                mimeType: resizedImage.mimeType
            },
            prompt: videoPrompt,
            settings
        }),
        signal
    });

    if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server responded with ${response.status}`);
    }

    return await response.blob();
};

/**
 * Generates an advertising video via server-side Veo or Kling.
 */
export const generateAdVideo = async (
    params: GenerateAdParams & { videoModel?: VideoModel, klingKeys?: { apiKey: string, secretKey: string, model: string } }, 
    signal: AbortSignal
): Promise<Blob> => {
    const { 
        productImage, productImages, subjectImages, productName, backgroundPrompt, slogan, placement, fullPrompt, videoModel, klingKeys, promptMode
    } = params;

    let sceneDescription = '';
    if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
        sceneDescription = (fullPrompt[0] && typeof fullPrompt[0] === 'string' && fullPrompt[0].trim().length > 0) 
            ? fullPrompt[0] 
            : `A professional commercial video of ${productName || 'the product'}.`;
    } else if (promptMode === 'full' && typeof fullPrompt === 'string' && fullPrompt.trim().length > 0) {
        sceneDescription = fullPrompt.trim();
    } else {
        sceneDescription = `A cinematic product ad for "${productName || 'the product'}". The scene: ${backgroundPrompt}. ${placement}. Slogan: ${slogan}.`;
    }

    const prompt = `Create a high-quality advertising video. ${sceneDescription}`;

    if (videoModel === 'kling') {
        return generateKlingVideo({
            prompt,
            image: productImage || (productImages && productImages[0]) || undefined,
            duration: '5s',
            aspectRatio: '16:9',
            apiKey: klingKeys?.apiKey,
            secretKey: klingKeys?.secretKey,
            model: klingKeys?.model
        }, signal);
    }

    if (signal.aborted) {
        const error = new Error("Generation cancelled by user.");
        error.name = "AbortError";
        throw error;
    }

    const mainProductImage = productImage || (productImages && productImages[0]) || null;
    const resizedProductImage = mainProductImage ? await resizeImage(mainProductImage) : null;
    const resizedSubjectImages = subjectImages ? await Promise.all(subjectImages.map(img => resizeImage(img))) : [];

    const referenceImages: any[] = [];
    if (resizedProductImage) {
        referenceImages.push({
            imageBytes: resizedProductImage.base64,
            mimeType: resizedProductImage.mimeType,
            referenceType: 'ASSET'
        });
    }

    if (resizedSubjectImages && resizedSubjectImages.length > 0) {
        resizedSubjectImages.slice(0, 2).forEach(img => {
            referenceImages.push({
                imageBytes: img.base64,
                mimeType: img.mimeType,
                referenceType: 'ASSET'
            });
        });
    }

    const response = await fetch("/api/gemini/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt,
            referenceImages
        }),
        signal
    });

    if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server responded with ${response.status}`);
    }

    return await response.blob();
};

/**
 * Edits an ad image via server-side Gemini.
 */
export const editAdImage = async (
    image: string,
    action: 'upscale' | 'pan' | 'zoom' | 'vary',
    options: {
        direction?: PanDirection | ZoomDirection;
        strength?: VaryStrength;
        level?: ZoomLevel;
    }
): Promise<string> => {
    try {
        const imageData = dataUrlToImageData(image);
        const resizedImageData = await resizeImage(imageData);
        let prompt = '';

        switch (action) {
            case 'upscale':
                prompt = 'Upscale this image to a higher resolution. Enhance details and textures while preserving the original composition and subject matter. The output should be a more detailed and crisp version of the input image.';
                break;
            case 'pan':
                prompt = `This is a frame of a larger scene. Extend the image ${options.direction}, generating new content that logically and seamlessly continues the scene. The original image content should occupy the opposite side of the new, larger image.`;
                break;
            case 'zoom':
                if (options.direction === 'in') {
                    prompt = `Zoom in on the center of the image. The zoom level should be approximately ${options.level}. Preserve high resolution and detail.`;
                } else {
                    prompt = `Zoom out from this image. This image is the center crop of a larger scene. Generate the surrounding context seamlessly.`;
                }
                break;
            case 'vary':
                prompt = `Generate a variation of this image with ${options.strength} changes. Keep the main subject and composition similar but vary the details, lighting, or background slightly.`;
                break;
        }

        const inAiStudio = typeof window !== 'undefined' && Boolean((window as any).aistudio);
        const hasCustomKey = Boolean(getCustomApiKey());

        if (inAiStudio && !hasCustomKey) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent`;
                const editResp = await window.fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'aistudio-build' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [
                                { inlineData: { mimeType: resizedImageData.mimeType, data: resizedImageData.base64 } },
                                { text: prompt }
                            ]
                        }]
                    })
                });
                if (editResp.ok) {
                    const editData = await editResp.json();
                    const editPart = editData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
                    if (editPart) {
                        const originalDataUrl = `data:${editPart.inlineData.mimeType || 'image/png'};base64,${editPart.inlineData.data}`;
                        return convertToWebP(originalDataUrl);
                    }
                }
            } catch (bridgeErr) {
                console.warn('[editAdImage] AI Studio bridge failed, attempting server fallback:', bridgeErr);
            }
        }

        const response = await fetch("/api/gemini/edit-image", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                image: {
                    base64: resizedImageData.base64,
                    mimeType: resizedImageData.mimeType
                },
                prompt
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        if (data.data) {
            const originalDataUrl = `data:${data.mimeType || 'image/png'};base64,${data.data}`;
            return convertToWebP(originalDataUrl);
        }
        throw new Error("No image data returned from server edit operation.");
    } catch (error) {
        console.error("Error editing image via server:", error);
        throw new Error("Failed to edit image.");
    }
};

/**
 * Inserts a portrait or model photo into an original reference scene photo via server.
 */
export const insertModelIntoScene = async (
    params: InsertModelParams,
    signal?: AbortSignal,
    _onProgress?: (current: number, total: number) => void
): Promise<ImageGenerationResponse> => {
    const {
        sceneImage,
        modelImage,
        mode = params.blendingMode === 'replace-subject' ? 'swap' : 'insert',
        targetSubject = 'the existing person',
        outfitMode = 'harmonize',
        placement = 'Center foreground',
        actionOrPose = 'Relaxed and natural posture looking towards camera with a warm expression',
        clothingStyle = 'Aesthetic outfit naturally harmonizing with the environment',
        blendingMode = mode === 'swap' ? 'replace-subject' : 'seamless-blend',
        customNotes = '',
        aspectRatio = '1:1',
        modelType = 'pro',
        imageSize = '2K',
        numberOfVariations = 1,
        excludeHandheldProps = true
    } = params;

    const count = Math.max(1, Math.min(numberOfVariations || 1, 4));

    if (signal?.aborted) {
        const error = new Error("Generation cancelled by user.");
        error.name = "AbortError";
        throw error;
    }

    const [resizedScene, resizedModel] = await Promise.all([
        resizeImage(sceneImage, 1536),
        resizeImage(modelImage, 1536)
    ]);

    const propExclusionInstruction = excludeHandheldProps !== false
        ? 'HANDS & POSTURE: Hands must be natural and clean without adding stray handheld tools, hair wands, or devices from the reference portrait.'
        : '';

    const isSwapMode = mode === 'swap' || blendingMode === 'replace-subject';

    const outfitInstruction = isSwapMode
        ? (outfitMode === 'keep-scene-outfit'
            ? `WARDROBE & OUTFIT RULE: Keep the exact outfit/clothing currently worn by ${targetSubject} in the TARGET BASE SCENE PHOTO ("${sceneImage.name || 'scene photo'}"). Transfer ONLY the replacement person's face, ethnicity, skin tone, hair, and likeness into that exact outfit and pose.`
            : outfitMode === 'keep-model-outfit'
                ? `WARDROBE & OUTFIT RULE: Dress the replacement person in their own outfit/clothing from the REPLACEMENT PERSON PHOTO ("${modelImage.name || 'replacement photo'}"), while matching lighting and shadows of the target scene.`
                : `WARDROBE & OUTFIT RULE: ${clothingStyle || 'Harmonize attire naturally with the target scene aesthetic while preserving replacement character authenticity.'}`)
        : `WARDROBE & ATTIRE: ${clothingStyle}`;

    const blendInstruction = isSwapMode
        ? `DIRECT CHARACTER SWAP: Completely remove "${targetSubject}" from the TARGET BASE SCENE PHOTO and replace them in that exact position/role with the person from the REPLACEMENT PERSON PHOTO.`
        : blendingMode === 'subtle-background'
            ? 'SUBTLE BACKGROUND PLACEMENT: Place the model naturally into the mid-ground/background of the scene as a natural element of the environment.'
            : blendingMode === 'hero-foreground'
                ? 'HERO FOREGROUND PLACEMENT: The model is the primary hero focal point in the immediate foreground, commanding attention while naturally inhabiting the environment.'
                : 'SEAMLESS COMPOSITING: Insert the model into the scene naturally as an integral part of the original photographic moment.';

    const variationModifiers = isSwapMode
        ? [
            'Faithfully preserve exact scene lighting, pose, camera perspective, and natural facial expression.',
            'Subtle natural expression adjustment matching the target scene mood and ambient shadow falloff.',
            'Crisp photorealistic skin pores, natural lighting integration, and exact depth of field match.',
            'Seamless organic contact shadows and true-to-life environmental color bounce.'
        ]
        : [
            'Direct gaze with natural warm confidence and subtle cinematic rim lighting.',
            'Candid relaxed expression, looking slightly off-camera with soft natural ambient lighting.',
            'Engaging warm smile with crisp authentic depth of field matching the background.',
            'Polished editorial pose with natural organic shadows cast upon the floor/surroundings.'
        ];

    const prompts = Array.from({ length: count }).map((_, idx) => {
        const variationNote = count > 1 ? `VARIATION ${idx + 1} NUANCE: ${variationModifiers[idx % variationModifiers.length]}` : '';
        if (isSwapMode) {
            return [
                'You are an expert commercial photographic compositor and master AI character replacement specialist.',
                '',
                'ATTACHED IMAGES & STRICT ROLES:',
                `• [IMAGE ROLE 1 — TARGET BASE SCENE PHOTO: "${sceneImage.name || 'target_scene'}"] (First attached image): Keep 100% of this scene\'s background, environment, camera angle, framing, depth of field, props, lighting, and any other people intact. ONLY "${targetSubject}" in this scene is to be replaced.`,
                `• [IMAGE ROLE 2 — REPLACEMENT CHARACTER SOURCE PHOTO: "${modelImage.name || 'replacement_person'}"] (Second attached image): Extract ONLY this person\'s exact face, facial structure, ethnicity, skin tone, melanin complexion, age, and hair texture. STRICTLY DISCARD and ignore the background/room of this second image.`,
                '',
                'MANDATORY CHARACTER SWAP DIRECTIVES:',
                `1. COMPLETE REPLACEMENT: Completely remove "${targetSubject}" from IMAGE ROLE 1 and replace them seamlessly with the exact person from IMAGE ROLE 2 in the same spot/scene role.`,
                '2. 100% IDENTITY, ETHNICITY & RACIAL FIDELITY: Faithfully preserve the exact ethnicity, skin tone, melanin richness, eye shape, facial morphology, and natural hair texture of the person in IMAGE ROLE 2. Under NO circumstances whitewash, lighten, or blend facial features with the removed person.',
                `3. ${outfitInstruction}`,
                `4. POSE & EXPRESSION: ${actionOrPose}.`,
                propExclusionInstruction ? `5. ${propExclusionInstruction}` : '',
                '6. ZERO BACKGROUND BLEED: Do NOT copy any walls, furniture, floor, or background elements from IMAGE ROLE 2 into IMAGE ROLE 1.',
                '7. PHOTOGRAPHIC LIGHTING & SHADOWS: Match the exact light direction, ambient color cast, exposure, shadows, and focal blur of IMAGE ROLE 1.',
                customNotes ? `ADDITIONAL USER DIRECTION: ${customNotes}` : '',
                variationNote,
                '',
                `STRICT EXCLUSION: Original face of removed ${targetSubject}, background from ${modelImage.name || 'replacement photo'}, whitewashed skin, altered race, lightened skin tone, floating figure, cut-and-paste seams, lighting mismatch, bad hands, extra fingers, cartoon, distorted face.`
            ].filter(Boolean).join('\n');
        }

        return [
            'You are an expert commercial photographic compositor and master AI visual retoucher.',
            '',
            'ATTACHED IMAGES AND ROLES:',
            `• [IMAGE ROLE 1 — ORIGINAL BASE SCENE PHOTO: "${sceneImage.name || 'scene'}"]: Establishes the exact location, background, lighting atmosphere, perspective, room architecture, color temperature, and photographic style.`,
            `• [IMAGE ROLE 2 — PORTRAIT / MODEL REFERENCE PHOTO: "${modelImage.name || 'model'}"]: Provides the precise facial features, smile, eye shape, ethnicity, skin tone, facial structure, and hair texture of the person to insert.`,
            '',
            'TASK:',
            'Seamlessly composite and insert the person from IMAGE ROLE 2 directly into the original scene from IMAGE ROLE 1.',
            '',
            'MANDATORY COMPOSITING INSTRUCTIONS:',
            '1. MODEL IDENTITY, ETHNICITY & RACIAL FIDELITY: Faithfully portray the person from IMAGE ROLE 2 with matching ethnicity, skin tone, melanin complexion, eye color, smile, and hair texture. Under NO circumstances lighten, whitewash, or alter their ethnic background or skin complexion. The person\'s racial identity must be 100% authentically preserved.',
            `2. ${propExclusionInstruction}`,
            `3. PLACEMENT & POSITION: ${placement}.`,
            `4. POSE & EXPRESSION: ${actionOrPose}.`,
            `5. ${outfitInstruction}`,
            `6. BLENDING MODE: ${blendInstruction}`,
            '7. PHOTOGRAPHIC LIGHTING & SHADOWS: The lighting on the model must 100% match the direction, softness, ambient bounced color, and shadow angles of IMAGE ROLE 1. Realistic contact shadows must be cast on any ground, floor, furniture, or background surfaces.',
            '8. PERSPECTIVE & CAMERA MATCH: Match the focal length, depth of field blur, and lens perspective of IMAGE ROLE 1. The result must look like an authentic, unedited single photograph taken on location.',
            customNotes ? `ADDITIONAL USER DIRECTION: ${customNotes}` : '',
            variationNote,
            '',
            'STRICT EXCLUSION: Whitewashed skin, altered race, lightened skin tone, curling iron, hair styling wand, handheld tools, floating person, cut-and-paste seams, lighting mismatch, bad hands, extra fingers, cartoon, distorted face.'
        ].filter(Boolean).join('\n');
    });

    const primaryModel = resolveImageModelName(modelType);
    const apiAspectRatio = mapToApiAspectRatio(aspectRatio);
    const apiImageSize = mapToApiImageSize(imageSize, primaryModel);

    const interleavedParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [
        { text: `[IMAGE ROLE 1 — TARGET BASE SCENE PHOTO: "${sceneImage.name || 'target_scene'}"]` },
        { inlineData: { data: resizedScene.base64, mimeType: resizedScene.mimeType } },
        { text: `[IMAGE ROLE 2 — ${isSwapMode ? 'REPLACEMENT CHARACTER SOURCE' : 'MODEL TO INSERT'}: "${modelImage.name || 'model_photo'}"]` },
        { inlineData: { data: resizedModel.base64, mimeType: resizedModel.mimeType } }
    ];

    const inAiStudio = typeof window !== 'undefined' && Boolean((window as any).aistudio);
    const hasCustomKey = Boolean(getCustomApiKey());

    let rawResults: Array<{ data?: string; mimeType?: string; variantIndex: number; error?: string }> = [];

    if (inAiStudio && !hasCustomKey) {
        const bridgePromises = prompts.map(async (promptText, idx) => {
            const bridgeItem = {
                index: idx,
                promptText,
                promptTitle: isSwapMode ? `Character Swap #${idx + 1}` : `Model Composite #${idx + 1}`,
                promptBoxIndex: idx,
                promptBoxNumber: idx + 1,
                promptId: String(idx + 1),
                itemMultimodalParts: interleavedParts
            };
            const res = await generateSingleImageViaAiStudioBridge(
                bridgeItem,
                primaryModel,
                { aspectRatio: apiAspectRatio, imageSize: apiImageSize },
                interleavedParts,
                signal
            );
            return {
                variantIndex: idx,
                data: res.base64,
                mimeType: res.mimeType,
                error: res.error?.specificReason || res.error?.message
            };
        });
        rawResults = await Promise.all(bridgePromises);
    } else {
        const response = await fetch("/api/gemini/insert-model", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                sceneImage: {
                    base64: resizedScene.base64,
                    mimeType: resizedScene.mimeType,
                    name: sceneImage.name
                },
                modelImage: {
                    base64: resizedModel.base64,
                    mimeType: resizedModel.mimeType,
                    name: modelImage.name
                },
                prompts,
                modelUsed: primaryModel,
                aspectRatio: apiAspectRatio,
                imageSize: apiImageSize
            }),
            signal
        });

        if (!response.ok) {
            const errorJson = await response.json().catch(() => ({}));
            throw new Error(errorJson.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        rawResults = data.results || [];

        // Auto-rescue with AI Studio bridge if server hit free-tier/quota limits
        if (inAiStudio) {
            for (let i = 0; i < rawResults.length; i++) {
                const res = rawResults[i];
                if (res?.error) {
                    const errLower = String(res.error).toLowerCase();
                    if (errLower.includes('free tier') || errLower.includes('limit: 0') || errLower.includes('quota') || errLower.includes('resource_exhausted')) {
                        const bridgeItem = {
                            index: res.variantIndex,
                            promptText: prompts[res.variantIndex] || prompts[0],
                            promptTitle: isSwapMode ? `Character Swap #${res.variantIndex + 1}` : `Model Composite #${res.variantIndex + 1}`,
                            promptBoxIndex: res.variantIndex,
                            promptBoxNumber: res.variantIndex + 1,
                            promptId: String(res.variantIndex + 1),
                            itemMultimodalParts: interleavedParts
                        };
                        const rescued = await generateSingleImageViaAiStudioBridge(
                            bridgeItem,
                            primaryModel,
                            { aspectRatio: apiAspectRatio, imageSize: apiImageSize },
                            interleavedParts,
                            signal
                        );
                        if (!rescued.error && rescued.base64) {
                            rawResults[i] = {
                                variantIndex: res.variantIndex,
                                data: rescued.base64,
                                mimeType: rescued.mimeType
                            };
                        }
                    }
                }
            }
        }
    }

    const convertedImages: AdVariation[] = [];
    const errors: GenerationError[] = [];

    for (const res of rawResults) {
        if (res.error) {
            errors.push({ variantIndex: res.variantIndex, message: res.error });
            continue;
        }

        if (res.data) {
            const rawUrl = `data:${res.mimeType || 'image/png'};base64,${res.data}`;
            let webpUrl = await convertToWebP(rawUrl);
            if (aspectRatio && ASPECT_RATIO_VALUES[aspectRatio]) {
                webpUrl = await cropImageToAspectRatio(webpUrl, ASPECT_RATIO_VALUES[aspectRatio]);
            }
            convertedImages.push({ url: webpUrl, variantIndex: res.variantIndex, modelUsed: primaryModel });
        }
    }

    if (convertedImages.length === 0 && errors.length > 0) {
        throw new Error(errors[0].message || 'Failed to composite or swap character');
    }

    return {
        images: convertedImages,
        errors
    };
};

/**
 * Real-time Gemini Live WebSocket helper for interactive streaming voice/audio.
 */
export function connectToGeminiLive(callbacks: {
    onAudioChunk?: (base64Audio: string) => void;
    onInterrupted?: () => void;
    onError?: (err: any) => void;
    onClose?: () => void;
}): { sendAudio: (base64Audio: string) => void; sendText: (text: string) => void; close: () => void } {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/gemini/live`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.audio && callbacks.onAudioChunk) {
                callbacks.onAudioChunk(msg.audio);
            }
            if (msg.interrupted && callbacks.onInterrupted) {
                callbacks.onInterrupted();
            }
            if (msg.error && callbacks.onError) {
                callbacks.onError(msg.error);
            }
        } catch (e) {
            console.error("Failed to parse Live API message", e);
        }
    };

    ws.onerror = (e) => {
        callbacks.onError?.(e);
    };

    ws.onclose = () => {
        callbacks.onClose?.();
    };

    return {
        sendAudio: (base64Audio: string) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ audio: base64Audio }));
            }
        },
        sendText: (text: string) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ text }));
            }
        },
        close: () => {
            ws.close();
        }
    };
}
