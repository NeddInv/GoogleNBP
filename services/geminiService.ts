
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { GenerateAdParams, ImageData, PanDirection, ZoomDirection, VaryStrength, ZoomLevel, AspectRatio, ImageSize, VideoSettingsData, VideoModel, AdVariation, GenerationError, ImageGenerationResponse } from '../types';

// Create a new instance for every call to ensure we use the latest API key (e.g. after user selection)
const getAIClient = () => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key is not set. Please select an API key if using Pro/Ultra models.");
    }
    return new GoogleGenAI({ apiKey });
};

const createAbortPromise = <T>(signal: AbortSignal): Promise<T> => {
    return new Promise<T>((_, reject) => {
        signal.addEventListener('abort', () => {
            const error = new Error("Generation cancelled by user.");
            error.name = "AbortError";
            reject(error);
        });
    });
};

const dataUrlToImageData = (dataUrl: string): ImageData => {
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return { base64, mimeType };
};

/**
 * Resizes a base64 image to a maximum dimension while maintaining aspect ratio.
 * This ensures we don't exceed Gemini API payload limits (approx 20MB total).
 */
const resizeImage = async (imageData: ImageData, maxDimension: number = 1536): Promise<ImageData> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:${imageData.mimeType};base64,${imageData.base64}`;
        img.onload = () => {
            const { width, height } = img;
            if (width <= maxDimension && height <= maxDimension && imageData.mimeType === 'image/webp') {
                resolve(imageData);
                return;
            }

            let newWidth, newHeight;
            if (width > height) {
                newWidth = maxDimension;
                newHeight = (height * maxDimension) / width;
            } else {
                newHeight = maxDimension;
                newWidth = (width * maxDimension) / height;
            }

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageData);
                return;
            }

            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const resizedDataUrl = canvas.toDataURL('image/webp', 0.85);
            resolve(dataUrlToImageData(resizedDataUrl));
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
 * Maps our extended AspectRatio type to the strict set supported by the Gemini API imageConfig.
 */
const mapToApiAspectRatio = (ratio: AspectRatio | undefined): "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "1:4" | "1:8" | "4:1" | "8:1" => {
    if (!ratio) return "1:1";
    // For 3.1 Flash Image, try to use the closest standard ratio
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
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const currentRatio = img.width / img.height;
            
            // If we have forced dimensions, we always use them
            const targetWidth = forceWidth || (currentRatio > targetAspectRatio ? img.height * targetAspectRatio : img.width);
            const targetHeight = forceHeight || (currentRatio > targetAspectRatio ? img.height : img.width / targetAspectRatio);

            const canvas = document.createElement('canvas');
            let sourceWidth, sourceHeight, offsetX, offsetY;

            if (currentRatio > targetAspectRatio) {
                // Image is wider than target ratio - crop from sides
                sourceHeight = img.height;
                sourceWidth = img.height * targetAspectRatio;
                offsetX = (img.width - sourceWidth) / 2;
                offsetY = 0;
            } else {
                // Image is taller than target ratio - crop from top/bottom
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
 * Maps our extended ImageSize type to the strict set supported by the Gemini API imageConfig.
 * Capped at 4K for API stability, using prompt engineering to handle 6K/8K requests.
 */
const mapToApiImageSize = (size: ImageSize | undefined): "512px" | "1K" | "2K" | "4K" => {
    if (!size) return "1K";
    if (size === '6K' || size === '8K') return "4K";
    return size as any;
};

export const generateSlogans = async (productName: string): Promise<string[]> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate 5 creative, short, and catchy advertising slogans for a product named "${productName}".`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        slogans: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                            },
                        },
                    },
                },
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.slogans || [];

    } catch (error) {
        console.error("Error generating slogans:", error);
        throw new Error("Failed to communicate with the AI for slogan generation.");
    }
};

export const generateAdCopy = async (productName: string, slogan: string, sceneDescription: string): Promise<string> => {
     try {
        const ai = getAIClient();
        const prompt = `
            Generate a short, engaging paragraph of ad copy (2-3 sentences) for a product. The copy should be suitable for a social media post.
            - Product: ${productName || 'our latest product'}
            - Slogan: "${slogan}"
            - Visuals: The ad visual depicts the following scene: ${sceneDescription}
            Focus on creating an enticing and professional tone. Do not use hashtags.
        `.trim().replace(/\s+/g, ' ');

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        return response.text.trim();

    } catch (error) {
        console.error("Error generating ad copy:", error);
        throw new Error("Failed to communicate with the AI for ad copy generation.");
    }
};

export const generateSuggestions = async (currentPrompt: string): Promise<string[]> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following ad description, provide 3 short, creative suggestions to make it more visually compelling or detailed. The suggestions should be things that can be added to the prompt.\n\nDescription: "${currentPrompt}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                description: "A short suggestion to enhance the ad prompt."
                            },
                        },
                    },
                },
            },
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.suggestions || [];

    } catch (error) {
        console.error("Error generating suggestions:", error);
        throw new Error("Failed to communicate with the AI for suggestions.");
    }
};


/**
 * Detects if a prompt is comprehensive enough to bypass guided presets (Style, Mood, Slogan, etc.)
 */
const checkIsComprehensive = (text: string): boolean => {
    if (!text) return false;
    const comprehensiveKeywords = [
        'SHOT TYPE', 'LIGHTING', 'PRODUCT', 'SKIN', 'PHOTOGRAPHY', 
        'ENVIRONMENT', 'CLOTHING', 'CAMERA', 'TONE', 'SCENE DEFINITION'
    ];
    const hasKeywords = comprehensiveKeywords.some(keyword => text.toUpperCase().includes(keyword));
    return text.length > 250 || hasKeywords;
};

export const generateAdImage = async (
    params: GenerateAdParams, 
    signal: AbortSignal,
    onProgress?: (current: number, total: number) => void
): Promise<ImageGenerationResponse> => {
    const { 
        productImage, productImages, competitorImages, subjectImages, modelImages, poseImages, companyLogo, productName, backgroundPrompt, slogan, 
        placement, fullPrompt, aspectRatio, negativePrompt, style, mood, numberOfVariations,
        cameraType, focalLength, aperture, shutterSpeed, lightingStyle, lightingSetup, distortion, textureDetail, colorStyle, technique, cameraAngle,
        modelType, imageSize, promptMode
    } = params;

    const ai = getAIClient();
    const hasLogo = !!companyLogo;
    const hasAnyImage = !!productImage || (productImages && productImages.length > 0) || (competitorImages && competitorImages.length > 0) || subjectImages.length > 0 || (modelImages && modelImages.length > 0) || (poseImages && poseImages.length > 0) || hasLogo;
    const isPro = modelType === 'pro';
    const isUltra = modelType === 'ultra';
    const isLight = modelType === 'light';
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


    try {
        if (signal.aborted) {
             const error = new Error("Generation cancelled by user.");
             error.name = "AbortError";
             throw error;
        }
        const abortPromise = createAbortPromise<never>(signal);

        // Resize images: if there is a massive batch of files, use a smaller dimension to remain efficient & prevent payload blocks
        const count = subjectImages.length + (productImages?.length || 0) + (competitorImages?.length || 0) + (modelImages?.length || 0) + (poseImages?.length || 0);
        const dimension = count > 12 ? 512 : (count > 5 ? 768 : 1536);

        const resizedProductImage = productImage ? await resizeImage(productImage, dimension) : null;
        const resizedProductImages = productImages ? await Promise.all(productImages.map(img => resizeImage(img, dimension))) : [];
        const resizedCompetitorImages = competitorImages ? await Promise.all(competitorImages.map(img => resizeImage(img, dimension))) : [];
        const resizedSubjectImages = await Promise.all(subjectImages.map(img => resizeImage(img, dimension)));
        const resizedModelImages = modelImages ? await Promise.all(modelImages.map(img => resizeImage(img, dimension))) : [];
        const resizedPoseImages = poseImages ? await Promise.all(poseImages.map(img => resizeImage(img, dimension))) : [];
        const resizedLogo = companyLogo ? await resizeImage(companyLogo, dimension) : null;

        if (isPro || isUltra || isLight) {
             const imageParts: { inlineData: { data: string, mimeType: string } }[] = [];
             const imageDescriptions: string[] = [];
 
             if (resizedProductImages && resizedProductImages.length > 0) {
                 resizedProductImages.slice(0, 10).forEach((img, i) => {
                     imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                     imageDescriptions.push(`Product design reference image #${i + 1} showing details, shape, and angles.`);
                 });
             } else if (resizedProductImage) {
                 imageParts.push({ inlineData: { data: resizedProductImage.base64, mimeType: resizedProductImage.mimeType } });
                 imageDescriptions.push('The primary product image.');
             }
             if (resizedCompetitorImages && resizedCompetitorImages.length > 0) {
                 resizedCompetitorImages.slice(0, 12).forEach((img, i) => {
                     imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                     imageDescriptions.push(`Competitor/Comparison product image #${i + 1} for side-by-side or versus comparison.`);
                 });
             }
             resizedSubjectImages.slice(0, 30).forEach((img, i) => {
                 imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                 imageDescriptions.push(`A reference image for the subject, scene context, or environment to feature (#${i + 1}).`);
             });
             if (resizedModelImages && resizedModelImages.length > 0) {
                 resizedModelImages.slice(0, 20).forEach((img, i) => {
                     imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                     imageDescriptions.push(`Apparel/character/model reference image #${i + 1} for specific looks, expressions, fashion style, skin tone, or models.`);
                 });
             }
             if (resizedPoseImages && resizedPoseImages.length > 0) {
                 resizedPoseImages.slice(0, 15).forEach((img, i) => {
                     imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                     imageDescriptions.push(`Pose & how-to-use reference image #${i + 1} showing exactly how the model should pose or interact with/use the product.`);
                 });
             }
             if (resizedLogo) {
                 imageParts.push({ inlineData: { data: resizedLogo.base64, mimeType: resizedLogo.mimeType } });
                 imageDescriptions.push('The company logo.');
             }

             const getPromptForIndex = (index: number) => {
                 let sceneDescription = '';
                 
                 // Strict mode separation
                 if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
                     sceneDescription = fullPrompt[index]?.trim() || `A professional commercial photograph of ${productName || 'the product'}. Variation ${index + 1}.`;
                 } else if (promptMode === 'full' && typeof fullPrompt === 'string') {
                     sceneDescription = fullPrompt.trim() || `A professional commercial photograph of ${productName || 'the product'}.`;
                 } else {
                     // Default to Guided Mode
                     sceneDescription = `${placement || `A high-end shot of ${productName || 'the product'}`}. The background is ${backgroundPrompt}.`;
                 }

                 const resolutionQualityNote = (imageSize === '6K' || imageSize === '8K') 
                     ? `IMPORTANT: This is a high-resolution ${imageSize} render. Capture every micro-detail, skin texture, and fabric fiber. Ensure crisp focus.` 
                     : '';

                 // Detect if the user's prompt is comprehensive
                 const isComprehensive = checkIsComprehensive(sceneDescription);

                 const promptInstructions = [
                     isComprehensive ? 'CRITICAL: FOLLOW THE DETAILED SCENE DEFINITION BELOW EXACTLY. IGNORE ALL OTHER UI PRESETS.' : 'TASK: Create a single, high-quality photorealistic advertisement image.',
                     resolutionQualityNote,
                     hasAnyImage ? `REFERENCE PRODUCT: Use the attached image for the PRODUCT DESIGN, TEXTURE, and SHAPE of the ${productName || 'product'}. IGNORE its background, lighting, and placement. Use ONLY the product itself.` : '',
                     isComprehensive 
                        ? `SCENE DEFINITION:\n${sceneDescription}`
                        : `GOAL: Integrate the product into the following scene.\nSCENE DESCRIPTION: ${sceneDescription}`,
                     !isComprehensive && aspectRatio === '97:60' ? 'LAYOUT: Amazon Product Infographic (970x600).' : '',
                     !isComprehensive && style && style !== 'None' ? `STYLE: ${style}.` : '',
                     !isComprehensive && mood && mood !== 'None' ? `MOOD: ${mood}.` : '',
                     !isComprehensive && cameraDetails ? `CAMERA & LIGHTING: ${cameraDetails}.` : '',
                     negativePrompt ? `STRICT EXCLUSION: ${negativePrompt}.` : '',
                     !isComprehensive && hasLogo ? 'BRANDING: Place logo naturally.' : '',
                     !isComprehensive && slogan ? `TEXT OVERLAY: Include "${slogan}" in a modern font.` : '',
                     `VARIATION ID: ${index + 1}`
                 ].filter(Boolean);

                 const finalPromptArr = promptInstructions.join('\n');
                 console.log(`[Variation ${index + 1} System Prompt]:`, finalPromptArr);
                 return finalPromptArr;
             };
             
             // Gemini 3 Pro / 3.1 Flash Request (Parallel for variations, with individual try-catch)
             const singleCall = async (index: number): Promise<{ response?: GenerateContentResponse; error?: string }> => {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("Request timed out after 90 seconds.")), 90000);
                });
                const textPrompt = getPromptForIndex(index);
                try {
                    const response = await Promise.race([
                        ai.models.generateContent({
                            model: isUltra 
                                ? 'gemini-3.1-flash-image-preview' 
                                : isLight 
                                    ? 'gemini-3.1-flash-lite-image-preview' 
                                    : 'gemini-3-pro-image-preview',
                            contents: { parts: [...imageParts, { text: textPrompt }] },
                            config: {
                                responseModalities: [Modality.IMAGE, Modality.TEXT],
                                imageConfig: {
                                    imageSize: mapToApiImageSize(imageSize),
                                    aspectRatio: mapToApiAspectRatio(aspectRatio),
                                }
                            },
                        }),
                        timeoutPromise
                    ]);
                    return { response: response as GenerateContentResponse };
                } catch (err: any) {
                    console.error(`Error generating variation ${index + 1}:`, err);
                    return { error: err?.message || `Failed to generate variation ${index + 1}` };
                }
             };

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

             const results: { index: number; response?: GenerateContentResponse; error?: string }[] = [];
             // Dynamic batch size: 2 if reference images are present (to avoid huge concurrent upload payloads), 4 if text-only
             const BATCH_SIZE = hasAnyImage ? 2 : 4;
             
             const totalToGenerate = activeIndices.length;
             for (let i = 0; i < totalToGenerate; i += BATCH_SIZE) {
                 if (signal.aborted) {
                      const error = new Error("Generation cancelled by user.");
                      error.name = "AbortError";
                      throw error;
                 }
                 const batchIndices = activeIndices.slice(i, i + BATCH_SIZE);
                 
                 if (onProgress) {
                     onProgress(i, totalToGenerate);
                 }

                 const batchTasks = batchIndices.map(idx => 
                     Promise.race([
                         singleCall(idx).then(res => ({ index: idx, ...res })), 
                         abortPromise
                     ])
                 );
                 const batchResults = await Promise.all(batchTasks);
                 results.push(...batchResults);
             }
             if (onProgress) {
                 onProgress(totalToGenerate, totalToGenerate);
             }

             const images: AdVariation[] = [];
             const errors: GenerationError[] = [];

             results.forEach((result) => {
                 const variantIndex = result.index; // Use the exact original prompt index
                 if (result.error) {
                     errors.push({ variantIndex, message: result.error });
                     return;
                 }

                 const castedResponse = result.response as GenerateContentResponse;
                 const candidate = castedResponse?.candidates?.[0];
                 
                 if (!candidate) {
                     errors.push({ variantIndex, message: "No candidate in response." });
                     return;
                 }

                 if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                     const finishMessage = `Stopped: ${candidate.finishReason}. ${candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || ''}`;
                     errors.push({ variantIndex, message: finishMessage });
                 }
                 
                 let gotImage = false;
                 if (candidate.content?.parts) {
                     for (const part of candidate.content.parts) {
                         if (part.inlineData) {
                             images.push({
                                 url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                                 variantIndex
                             });
                             gotImage = true;
                             break; // Take the first image part for this variation
                         } else if (part.text) {
                             console.log(`Model response text for variation ${variantIndex}:`, part.text);
                         }
                     }
                 }
                 if (!gotImage && !result.error) {
                     errors.push({ variantIndex, message: "Model response was missing image data." });
                 }
             });

             if (images.length === 0) {
                 const firstError = errors[0]?.message || "The model did not return any images. This may be due to safety filters or a complex prompt.";
                 throw new Error(firstError);
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
                         variantIndex: img.variantIndex
                     };
                 })
             );
             
             return {
                 images: convertedImages,
                 errors
             };

        } else {
            // Standard Model: Gemini 2.5 Flash Image (Nano Banana)
            // Supports both text-to-image and image-to-image
            const imageParts: { inlineData: { data: string, mimeType: string } }[] = [];
            const imageDescriptions: string[] = [];

            if (resizedProductImages && resizedProductImages.length > 0) {
                resizedProductImages.slice(0, 10).forEach((img, i) => {
                    imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                    imageDescriptions.push(`Product design reference image #${i + 1} showing details and shape.`);
                });
            } else if (resizedProductImage) {
                imageParts.push({ inlineData: { data: resizedProductImage.base64, mimeType: resizedProductImage.mimeType } });
                imageDescriptions.push('The primary product image.');
            }
            if (resizedCompetitorImages && resizedCompetitorImages.length > 0) {
                resizedCompetitorImages.slice(0, 12).forEach((img, i) => {
                    imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                    imageDescriptions.push(`Competitor/Comparison product image #${i + 1} for comparison/benchmark ads.`);
                });
            }
            resizedSubjectImages.slice(0, 30).forEach((img, i) => {
                imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                imageDescriptions.push(`A reference image for the subject (#${i + 1}).`);
            });
            if (resizedModelImages && resizedModelImages.length > 0) {
                resizedModelImages.slice(0, 20).forEach((img, i) => {
                    imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                    imageDescriptions.push(`Character/model reference photo #${i + 1} for specific looks.`);
                });
            }
            if (resizedPoseImages && resizedPoseImages.length > 0) {
                resizedPoseImages.slice(0, 15).forEach((img, i) => {
                    imageParts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
                    imageDescriptions.push(`Pose/how-to-use reference image #${i + 1} showing model pose and interaction with/use of the product.`);
                });
            }
            if (resizedLogo) {
                imageParts.push({ inlineData: { data: resizedLogo.base64, mimeType: resizedLogo.mimeType } });
                imageDescriptions.push('The company logo.');
            }
            
             const getPromptForIndex = (index: number) => {
                 let sceneDescription = '';
                 
                 if (promptMode === 'multiple' && Array.isArray(fullPrompt)) {
                     sceneDescription = fullPrompt[index]?.trim() || `A high-end advertisement for ${productName || 'the product'}. Variation ${index + 1}.`;
                 } else if (promptMode === 'full' && typeof fullPrompt === 'string') {
                     sceneDescription = fullPrompt.trim() || `A high-end advertisement for ${productName || 'the product'}.`;
                 } else {
                     sceneDescription = `${placement || 'An advertisement'}. Setting: ${backgroundPrompt}.`;
                 }
                 
                 const isComprehensive = checkIsComprehensive(sceneDescription);

                const promptInstructions = [
                    isComprehensive ? 'CRITICAL: FOLLOW THE SCENE DESCRIPTION BELOW EXACTLY. IGNORE ALL OTHER UI PRESETS.' : 'Task: Create a single, photorealistic advertisement image.',
                    hasAnyImage ? (isComprehensive ? 'Use the provided image strictly for product reference.' : 'Combine all provided images into one cohesive scene based on the description.') : '',
                    !isComprehensive && aspectRatio === '97:60' ? 'Layout: Format as an Amazon Product Infographic (970x600). Ensure the product is central and sharp.' : '',
                    isComprehensive ? `Scene Description:\n${sceneDescription}` : `Scene Description: ${sceneDescription}`,
                    !isComprehensive && hasAnyImage ? 'Image Roles: ' + imageDescriptions.join(' ') : '',
                ];
                
                if (!isComprehensive && style && style !== 'None') promptInstructions.push(`Artistic Style: ${style}.`);
                if (!isComprehensive && mood && mood !== 'None') promptInstructions.push(`Overall Mood: ${mood}.`);
                if (!isComprehensive && cameraDetails) promptInstructions.push(`Camera & Lighting Style: ${cameraDetails}.`);
                if (negativePrompt) promptInstructions.push(`Important Exclusion: The image must NOT contain ${negativePrompt}.`);
                if (!isComprehensive && hasLogo) promptInstructions.push('Logo Integration: Place the company logo tastefully.');
                if (!isComprehensive && slogan) {
                    promptInstructions.push(`Slogan: Add the text "${slogan}" to the image.`);
                }

                promptInstructions.push(isComprehensive ? 'Final Output: Follow the description exactly to create a realistic photograph.' : 'Final Output: The final image must be a single, photorealistic photograph.');

                return promptInstructions.filter(Boolean).join('\n');
            };
            
            const singleCall = async (index: number): Promise<{ response?: GenerateContentResponse; error?: string }> => {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("Request timed out after 60 seconds.")), 60000);
                });
                const textPrompt = getPromptForIndex(index) + `\nVariation ID: ${index + 1}`;
                
                try {
                    const response = await Promise.race([
                        ai.models.generateContent({
                            model: 'gemini-2.5-flash-image',
                            contents: { parts: [...imageParts, { text: textPrompt }] },
                            config: { 
                                responseModalities: [Modality.IMAGE, Modality.TEXT],
                                imageConfig: {
                                    aspectRatio: mapToApiAspectRatio(aspectRatio),
                                }
                            },
                        }),
                        timeoutPromise
                    ]);
                    return { response: response as GenerateContentResponse };
                } catch (err: any) {
                    console.error(`Error generating variation ${index + 1}:`, err);
                    return { error: err?.message || `Failed to generate variation ${index + 1}` };
                }
            };

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

            const results: { index: number; response?: GenerateContentResponse; error?: string }[] = [];
            // Dynamic batch size: 2 if reference images are present (to avoid huge concurrent upload payloads), 4 if text-only
            const BATCH_SIZE = hasAnyImage ? 2 : 4;
            
            const totalToGenerate = activeIndices.length;
            for (let i = 0; i < totalToGenerate; i += BATCH_SIZE) {
                if (signal.aborted) {
                     const error = new Error("Generation cancelled by user.");
                     error.name = "AbortError";
                     throw error;
                }
                const batchIndices = activeIndices.slice(i, i + BATCH_SIZE);
                
                if (onProgress) {
                    onProgress(i, totalToGenerate);
                }

                const batchTasks = batchIndices.map(idx => 
                    Promise.race([
                        singleCall(idx).then(res => ({ index: idx, ...res })), 
                        abortPromise
                    ])
                );
                const batchResults = await Promise.all(batchTasks);
                results.push(...batchResults);
            }
            if (onProgress) {
                onProgress(totalToGenerate, totalToGenerate);
            }

            const images: AdVariation[] = [];
            const errors: GenerationError[] = [];

            results.forEach((result) => {
                const variantIndex = result.index; // Use the exact original prompt index
                if (result.error) {
                    errors.push({ variantIndex, message: result.error });
                    return;
                }

                const castedResponse = result.response as GenerateContentResponse;
                const candidate = castedResponse?.candidates?.[0];
                if (candidate?.content?.parts) {
                    let gotImage = false;
                    for (const part of candidate.content.parts) {
                        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                             images.push({
                                 url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                                 variantIndex
                             });
                             gotImage = true;
                             break;
                        }
                    }
                    if (!gotImage) {
                        errors.push({ variantIndex, message: "Response was missing image data." });
                    }
                } else {
                    errors.push({ variantIndex, message: "No candidate or content parts returned." });
                }
            });
            
            if (images.length === 0) {
                const firstError = errors[0]?.message || "The model did not return any images. Try refining your prompts or image inputs.";
                throw new Error(firstError);
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
                        variantIndex: img.variantIndex
                    };
                })
            );

            return {
                images: convertedImages,
                errors
            };
        }

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw error;
        }
        console.error("Error generating ad image:", error);
        if (error instanceof Error) {
            if (error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('429')) {
                throw new Error("API Quota Exceeded. If you are using Pro/Ultra models, try switching to the 'Standard' model or wait a few minutes before trying again.");
            }
            try {
                const nestedError = JSON.parse(error.message);
                if (nestedError?.error?.message) {
                    throw new Error(`Failed to generate the ad image: ${nestedError.error.message}`);
                }
            } catch (e) {
                // Not a JSON error
            }
            throw new Error(`Failed to generate the ad image: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the ad image.");
    }
};

export const generateKlingVideo = async (params: { prompt: string, image?: ImageData, duration?: string, aspectRatio?: string, apiKey?: string, secretKey?: string, model?: string }, signal: AbortSignal): Promise<Blob> => {
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
        
        // Polling for status
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
                // Use proxy to bypass CORS
                const videoRes = await fetch(`/api/video/proxy?url=${encodeURIComponent(videoUrl)}`);
                if (!videoRes.ok) throw new Error("Failed to download video through proxy");
                return await videoRes.blob();
            } else if (task.task_status === 'failed') {
                throw new Error(task.task_status_msg || "Kling generation failed");
            }
            // Continue polling if 'submitted' or 'processing'
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

export const animateImage = async (params: { image: ImageData, prompt: string, settings?: VideoSettingsData, klingKeys?: { apiKey: string, secretKey: string, model: string } }, signal: AbortSignal): Promise<Blob> => {
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

    const ai = getAIClient();

    try {
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

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: videoPrompt,
            image: {
                imageBytes: resizedImage.base64,
                mimeType: resizedImage.mimeType
            },
            config: {
                numberOfVideos: 1,
                resolution: settings?.resolution || '1080p',
                aspectRatio: settings?.aspectRatio || '16:9',
            }
        });

        while (!operation.done) {
            if (signal.aborted) throw new Error("Generation cancelled");
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation });
        }

        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
            const videoUri = operation.response.generatedVideos[0].video.uri;
            const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
            const response = await fetch(`${videoUri}&key=${apiKey}`);
            if (!response.ok) throw new Error("Failed to download video");
            return await response.blob();
        }
        throw new Error("The AI did not return a video.");
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw error;
        }
        console.error("Error animating image:", error);
        throw error;
    }
};
export const generateAdVideo = async (params: GenerateAdParams & { videoModel?: VideoModel, klingKeys?: { apiKey: string, secretKey: string, model: string } }, signal: AbortSignal): Promise<Blob> => {
     const { 
        productImage, productImages, subjectImages, modelImages, poseImages, productName, backgroundPrompt, slogan, placement, fullPrompt, videoModel, klingKeys, promptMode
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
        // For Kling, we use the productImage or the first productImages as the main reference
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

     const ai = getAIClient();

     try {
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
                image: {
                    imageBytes: resizedProductImage.base64,
                    mimeType: resizedProductImage.mimeType
                },
                referenceType: 'ASSET'
            });
        }

        if (resizedSubjectImages && resizedSubjectImages.length > 0) {
            resizedSubjectImages.slice(0, 2).forEach(img => {
                referenceImages.push({
                    image: {
                        imageBytes: img.base64,
                        mimeType: img.mimeType
                    },
                    referenceType: 'ASSET'
                });
            });
        }

        let operation = await ai.models.generateVideos({
            model: referenceImages.length > 1 ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: referenceImages.length > 1 ? '720p' : '1080p', // 720p required for multi-ref
                aspectRatio: '16:9',
                referenceImages: referenceImages.length > 0 ? referenceImages : undefined
            }
        });

        while (!operation.done) {
             if (signal.aborted) throw new Error("Generation cancelled");
             await new Promise(resolve => setTimeout(resolve, 5000));
             operation = await ai.operations.getVideosOperation({operation});
        }

        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
             const videoUri = operation.response.generatedVideos[0].video.uri;
             // Must append API key for Veo downloads
             const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
             if (!response.ok) throw new Error("Failed to download video");
             return await response.blob();
        }
        
        throw new Error("No video generated");

    } catch (error: any) {
        if (signal.aborted || error.name === 'AbortError') {
             const e = new Error("Generation cancelled by user.");
             e.name = "AbortError";
             throw e;
        }
        console.error("Error generating video:", error);
        throw new Error(error.message || "Video generation failed");
    }
};

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
        const ai = getAIClient();
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

        const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash-image',
             contents: {
                parts: [
                    { inlineData: { data: resizedImageData.base64, mimeType: resizedImageData.mimeType } },
                    { text: prompt }
                ]
             },
             config: { responseModalities: [Modality.IMAGE] }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 const originalDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                 return convertToWebP(originalDataUrl);
             }
        }
        throw new Error("No image returned from edit operation.");

    } catch (error) {
         console.error("Error editing image:", error);
         throw new Error("Failed to edit image.");
    }
};
