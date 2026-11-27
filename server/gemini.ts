import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HTTPServer } from "http";

/**
 * Shared server-side Gemini client utility.
 * Always sets the 'User-Agent' header to 'aistudio-build' as required by guidelines.
 */
export const getAIClient = (overrideApiKey?: string): GoogleGenAI => {
    const apiKey = overrideApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Please use the 'Select Paid Account' pop-up or check Settings > Secrets.");
    }
    return new GoogleGenAI({
        apiKey,
        httpOptions: {
            headers: {
                'User-Agent': 'aistudio-build',
            },
            timeout: 90000,
            retryOptions: {
                attempts: 1,
            }
        }
    });
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
 * Sanitizes prompt for safe fallback retry if an initial request was blocked or produced no candidate.
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

export const formatErrorMessage = (error: any): string => {
    if (!error) return "Unknown error occurred";
    const msg = error.message || String(error);
    try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) {
            return parsed.error.message;
        }
    } catch {
        // Not JSON
    }
    return msg;
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 1000): Promise<T> {
    let lastErr: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const msg = String(err?.message || err);
            const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('429');
            if (i < maxRetries && isTransient) {
                await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

async function generateTextWithResilience(contents: any, config?: any): Promise<GenerateContentResponse> {
    const ai = getAIClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents,
            config: {
                ...config,
                abortSignal: controller.signal
            }
        });
        clearTimeout(timeoutId);
        return res;
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn("[Server Gemini] Text model error:", err?.message || err);
        throw err;
    }
}

/**
 * Generates 5 creative advertising slogans for a product using gemini-3.8-flash.
 */
export async function generateSlogans(productName: string): Promise<string[]> {
    const response = await generateTextWithResilience(
        `Generate 5 creative, short, and catchy advertising slogans for a product named "${productName}".`,
        {
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
        }
    );

    const jsonText = (response.text ?? "").trim();
    try {
        const result = JSON.parse(jsonText || '{"slogans":[]}');
        return result.slogans || [];
    } catch {
        return [];
    }
}

/**
 * Generates engaging social media ad copy using gemini-3.8-flash.
 */
export async function generateAdCopy(
    productName: string, 
    slogan: string, 
    sceneDescription: string, 
    photoNames?: string[]
): Promise<string> {
    const photosContext = (photoNames && photoNames.length > 0)
        ? `\n- Visual References Uploaded: ${photoNames.map(n => `"${n}"`).join(', ')}`
        : '';
    const prompt = `
        Generate a short, engaging paragraph of ad copy (2-3 sentences) for a product. The copy should be suitable for a social media post.
        - Product: ${productName || 'our latest product'}
        - Slogan: "${slogan}"
        - Visuals: The ad visual depicts the following scene: ${sceneDescription}${photosContext}
        Focus on creating an enticing and professional tone. Do not use hashtags.
    `.trim().replace(/\s+/g, ' ');

    const response = await generateTextWithResilience(prompt);
    return (response.text ?? "").trim();
}

/**
 * Streams ad copy generation using gemini-3.8-flash.
 */
export async function* generateAdCopyStream(
    productName: string, 
    slogan: string, 
    sceneDescription: string, 
    photoNames?: string[]
): AsyncGenerator<string> {
    const ai = getAIClient();
    const photosContext = (photoNames && photoNames.length > 0)
        ? `\n- Visual References Uploaded: ${photoNames.map(n => `"${n}"`).join(', ')}`
        : '';
    const prompt = `
        Generate a short, engaging paragraph of ad copy (2-3 sentences) for a product. The copy should be suitable for a social media post.
        - Product: ${productName || 'our latest product'}
        - Slogan: "${slogan}"
        - Visuals: The ad visual depicts the following scene: ${sceneDescription}${photosContext}
        Focus on creating an enticing and professional tone. Do not use hashtags.
    `.trim().replace(/\s+/g, ' ');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
                abortSignal: controller.signal
            }
        });

        for await (const chunk of stream) {
            clearTimeout(timeoutId);
            if (chunk.text) {
                yield chunk.text;
            }
        }
    } catch {
        clearTimeout(timeoutId);
        const fallbackStream = await ai.models.generateContentStream({
            model: "gemini-3.8-flash",
            contents: prompt,
        });

        for await (const chunk of fallbackStream) {
            if (chunk.text) {
                yield chunk.text;
            }
        }
    }
}

/**
 * Generates prompt suggestions using gemini-3.8-flash.
 */
export async function generateSuggestions(
    currentPrompt: string, 
    photoNames?: string[]
): Promise<string[]> {
    const photosContext = (photoNames && photoNames.length > 0)
        ? `\n\nAvailable Uploaded Reference Photos:\n${photoNames.map(n => `• "${n}"`).join('\n')}\nYou may craft suggestions that specifically reference incorporating details, poses, or settings from these uploaded photo filenames (e.g. 'using the pose from [photo_name]' or 'featuring the model from [photo_name]').`
        : '';
    const response = await generateTextWithResilience(
        `Based on the following ad description, provide 3 short, creative suggestions to make it more visually compelling or detailed. The suggestions should be things that can be added to the prompt.${photosContext}\n\nDescription: "${currentPrompt}"`,
        {
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
        }
    );

    const jsonText = (response.text ?? "").trim();
    try {
        const result = JSON.parse(jsonText || '{"suggestions":[]}');
        return result.suggestions || [];
    } catch {
        return [];
    }
}

export interface ServerGenerateImageItem {
    index: number;
    promptText: string;
    promptTitle: string;
    promptBoxNumber: number;
    promptBoxIndex: number;
    promptId?: string;
    fileName?: string;
    referenceImages?: string[];
    promptSnippet: string;
    itemMultimodalParts?: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
}

export interface ServerGenerateImageResult {
    variantIndex: number;
    id?: string;
    fileName?: string;
    referenceImages?: string[];
    modelUsed: string;
    base64?: string;
    mimeType?: string;
    error?: {
        message: string;
        specificReason: string;
        modelUsed: string;
        promptBoxIndex: number;
        promptBoxNumber: number;
        promptTitle: string;
        promptId?: string;
        fileName?: string;
        referenceImages?: string[];
        promptSnippet?: string;
    };
}

/**
 * Generates an individual image variation on the server with safety retry.
 */
export async function generateSingleAdImage(
    item: ServerGenerateImageItem,
    primaryModel: string,
    imageConfig: any,
    multimodalParts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    customApiKey?: string
): Promise<ServerGenerateImageResult> {
    const ai = getAIClient(customApiKey);
    const modelUsed = primaryModel || 'gemini-3-pro-image';
    const textPrompt = item.promptText;
    let response: GenerateContentResponse | null = null;
    let lastError = '';

    // Prioritize targeted reference images selected specifically for this variation
    const effectiveParts = (item.itemMultimodalParts && item.itemMultimodalParts.length > 0)
        ? item.itemMultimodalParts
        : multimodalParts;

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const buildGenConfig = (signal: AbortSignal) => {
        const cfg: any = { abortSignal: signal };
        if (imageConfig && typeof imageConfig === 'object') {
            cfg.imageConfig = {
                aspectRatio: imageConfig.aspectRatio || '1:1',
                ...(imageConfig.imageSize ? { imageSize: imageConfig.imageSize } : {})
            };
        }
        return cfg;
    };

    // 1. Primary call with targeted reference images
    try {
        const rawResponse = await ai.models.generateContent({
            model: modelUsed,
            contents: { parts: [...effectiveParts, { text: textPrompt }] },
            config: buildGenConfig(controller.signal),
        });
        clearTimeout(timeoutId);
        response = rawResponse as GenerateContentResponse;
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn(`[Server Variation ${item.index + 1}] Primary call failed:`, err);
        lastError = err?.message || String(err);
    }

    // Check if primary call returned an image candidate
    const primaryCandidate = response?.candidates?.[0];
    const hasImageCandidate = !!primaryCandidate && primaryCandidate.content?.parts?.some((p: any) => p.inlineData && p.inlineData.data);

    // 2. Safe Retry ONLY if not a quota/auth error and safety blocked
    if (!hasImageCandidate && !isFatalQuotaOrAuth(lastError)) {
        const safePrompt = sanitizePromptForSafety(textPrompt);
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 60000);
        try {
            const rawRetry = await ai.models.generateContent({
                model: modelUsed,
                contents: { parts: [...effectiveParts, { text: safePrompt }] },
                config: buildGenConfig(retryController.signal),
            });
            clearTimeout(retryTimeoutId);
            const retryCandidate = (rawRetry as any)?.candidates?.[0];
            if (retryCandidate?.content?.parts?.some((p: any) => p.inlineData && p.inlineData.data)) {
                response = rawRetry as GenerateContentResponse;
            } else if (!response) {
                response = rawRetry as GenerateContentResponse;
            }
        } catch (retryErr: any) {
            clearTimeout(retryTimeoutId);
            console.warn(`[Server Variation ${item.index + 1}] Safe retry failed:`, retryErr);
            if (!lastError) lastError = retryErr?.message || String(retryErr);
        }
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

    if (!response) {
        const specificReason = parseDetailedReason(lastError);
        return {
            variantIndex: item.index,
            id: item.promptId,
            fileName: item.fileName,
            referenceImages: item.referenceImages,
            modelUsed,
            error: {
                message: `${item.promptTitle} failed: ${lastError}`,
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
    }

    const candidate = response.candidates?.[0];
    if (!candidate) {
        const blockReason = response.promptFeedback?.blockReason;
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
                message: specificReason,
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
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        const finishReason = candidate.finishReason;
        const specificReason = `Generation was halted with finish status: ${finishReason} on ${item.promptTitle}.`;
        return {
            variantIndex: item.index,
            id: item.promptId,
            fileName: item.fileName,
            referenceImages: item.referenceImages,
            modelUsed,
            error: {
                message: specificReason,
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
    }

    if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return {
                    variantIndex: item.index,
                    id: item.promptId,
                    fileName: item.fileName,
                    referenceImages: item.referenceImages,
                    modelUsed,
                    base64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'image/png'
                };
            }
        }
    }

    const specificReason = `AI model did not return image data for ${item.promptTitle}.`;
    return {
        variantIndex: item.index,
        id: item.promptId,
        fileName: item.fileName,
        referenceImages: item.referenceImages,
        modelUsed,
        error: {
            message: specificReason,
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
}

/**
 * Edits an ad image on the server using gemini-3-pro-image.
 */
export async function editAdImage(
    imageData: { base64: string; mimeType: string },
    prompt: string
): Promise<{ data: string; mimeType: string }> {
    const ai = getAIClient();
    let response: GenerateContentResponse | null = null;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: {
                parts: [
                    { inlineData: { data: imageData.base64, mimeType: imageData.mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                    imageSize: '2K'
                }
            }
        });
    } catch {
        // Fallback retry at 1K
        response = await ai.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: {
                parts: [
                    { inlineData: { data: imageData.base64, mimeType: imageData.mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: '1:1',
                    imageSize: '1K'
                }
            }
        });
    }

    for (const part of response?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
            return {
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/png'
            };
        }
    }
    throw new Error("No image data returned from image edit operation.");
}

/**
 * Inserts a model portrait into a scene using gemini-3-pro-image.
 */
export async function insertModelIntoSceneServer(
    sceneImage: { base64: string; mimeType: string; name?: string },
    modelImage: { base64: string; mimeType: string; name?: string },
    prompts: string[],
    modelUsed: string,
    aspectRatio: string,
    imageSize: string,
    customApiKey?: string
): Promise<Array<{ data?: string; mimeType?: string; variantIndex: number; error?: string }>> {
    const ai = getAIClient(customApiKey);
    const selectedModel = modelUsed || 'gemini-3-pro-image';

    const imageParts = [
        { text: `[IMAGE ROLE 1 — TARGET BASE SCENE PHOTO: "${sceneImage.name || 'target_scene'}"]` },
        { inlineData: { data: sceneImage.base64, mimeType: sceneImage.mimeType } },
        { text: `[IMAGE ROLE 2 — REPLACEMENT CHARACTER / MODEL SOURCE PHOTO: "${modelImage.name || 'model_source'}"]` },
        { inlineData: { data: modelImage.base64, mimeType: modelImage.mimeType } }
    ];

    const generateSingle = async (index: number): Promise<{ data?: string; mimeType?: string; variantIndex: number; error?: string }> => {
        try {
            const promptText = prompts[index];
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: { parts: [...imageParts, { text: promptText }] },
                config: {
                    imageConfig: {
                        aspectRatio: (aspectRatio as any) || '1:1',
                        imageSize: (imageSize as any) || '2K'
                    }
                }
            });

            const candidate = response?.candidates?.[0];
            if (!candidate) {
                return { variantIndex: index, error: "AI model returned no candidate." };
            }

            for (const part of candidate.content?.parts || []) {
                if (part.inlineData && part.inlineData.data) {
                    return {
                        variantIndex: index,
                        data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'image/png'
                    };
                }
            }
            return { variantIndex: index, error: "No image bytes returned in response." };
        } catch (err: any) {
            return { variantIndex: index, error: err.message || "Failed to generate variation" };
        }
    };

    return Promise.all(prompts.map((_, idx) => generateSingle(idx)));
}

/**
 * Generates an advertising video using Veo (gemini-omni-1.1-flash / veo-3.1-fast-generate-preview).
 */
export async function generateAdVideoServer(
    prompt: string,
    referenceImages: Array<{ imageBytes: string; mimeType: string; referenceType: string }>
): Promise<Buffer> {
    const ai = getAIClient();
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    let operation = await ai.models.generateVideos({
        model: referenceImages.length > 1 ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: referenceImages.length > 1 ? '720p' : '1080p',
            aspectRatio: '16:9',
            referenceImages: referenceImages.length > 0 ? referenceImages as any : undefined
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("No video URI returned from video generation.");
    }

    const response = await fetch(`${videoUri}&key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download generated video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Animates a static image into a video using Veo.
 */
export async function animateImageServer(
    image: { base64: string; mimeType: string },
    prompt: string,
    settings?: any
): Promise<Buffer> {
    const ai = getAIClient();
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || 'Animate this image in a cinematic way.',
        image: {
            imageBytes: image.base64,
            mimeType: image.mimeType
        },
        config: {
            numberOfVideos: 1,
            resolution: settings?.resolution || '1080p',
            aspectRatio: settings?.aspectRatio || '16:9',
        }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("The AI did not return a video.");
    }

    const response = await fetch(`${videoUri}&key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download animated video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Sets up WebSocket bridge for real-time Live API voice/audio streaming.
 */
export function setupGeminiLiveWebSocket(server: HTTPServer): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
        const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
        if (pathname === "/api/gemini/live" || pathname === "/live") {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
        }
    });

    wss.on("connection", async (clientWs) => {
        console.log("[Live API] Client connected to Gemini Live session");
        try {
            const ai = getAIClient();
            const session = await ai.live.connect({
                model: "gemini-3.8-live",
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
                    },
                    systemInstruction: "You are a helpful creative advertising assistant assisting with ad concept creation and brainstorming in real-time.",
                },
                callbacks: {
                    onmessage: (message: any) => {
                        for (const part of message.serverContent?.modelTurn?.parts ?? []) {
                            if (part.inlineData?.data) {
                                if (clientWs.readyState === WebSocket.OPEN) {
                                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                                }
                            }
                        }
                        if (message.serverContent?.interrupted) {
                            if (clientWs.readyState === WebSocket.OPEN) {
                                clientWs.send(JSON.stringify({ interrupted: true }));
                            }
                        }
                    },
                    onclose: () => {
                        console.log("[Live API] Gemini session closed");
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.close();
                        }
                    },
                    onerror: (err: any) => {
                        console.error("[Live API] Gemini error:", err);
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(JSON.stringify({ error: err?.message || String(err) }));
                        }
                    }
                },
            });

            clientWs.on("message", (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    if (parsed.audio) {
                        session.sendRealtimeInput({
                            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
                        });
                    } else if (parsed.text) {
                        session.sendClientContent({
                            turns: [{ role: "user", parts: [{ text: parsed.text }] }],
                            turnComplete: true,
                        });
                    }
                } catch (e) {
                    console.error("[Live API] Message parsing error:", e);
                }
            });

            clientWs.on("close", () => {
                console.log("[Live API] Client disconnected from Gemini Live");
                try {
                    session.close();
                } catch {
                    // Ignore close errors
                }
            });
        } catch (error) {
            console.error("[Live API] Initialization error:", error);
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ error: "Failed to connect to Gemini Live on server" }));
                clientWs.close();
            }
        }
    });
}
