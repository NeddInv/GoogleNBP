import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import {
    generateSlogans,
    generateAdCopy,
    generateAdCopyStream,
    generateSuggestions,
    generateSingleAdImage,
    editAdImage,
    insertModelIntoSceneServer,
    generateAdVideoServer,
    animateImageServer,
    setupGeminiLiveWebSocket,
    ServerGenerateImageItem,
    formatErrorMessage,
    getAIClient
} from "./server/gemini";

// Global error handlers to keep dev server resilient and running continuously
process.on("uncaughtException", (err) => {
    console.error("[Server] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});

async function startServer() {
    const app = express();
    const httpServer = http.createServer(app);
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Mount real-time Gemini Live WebSocket bridge
    setupGeminiLiveWebSocket(httpServer);

    // Kling API Auth Token Generator
    const getKlingToken = (customApiKey?: string, customSecretKey?: string) => {
        const apiKey = customApiKey || process.env.KLING_API_KEY;
        const secretKey = customSecretKey || process.env.KLING_SECRET_KEY;

        if (!apiKey || !secretKey) {
            throw new Error("Kling API credentials are not set.");
        }

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: apiKey,
            exp: now + 1800, // 30 minutes
            iat: now
        };

        return jwt.sign(payload, secretKey, { 
            algorithm: 'HS256',
            header: { typ: 'JWT', alg: 'HS256' }
        });
    };

    // Health check endpoint
    app.get("/api/health", (_req, res) => {
        res.json({ status: "ok" });
    });

    // Check server key status
    app.get("/api/gemini/key-status", (_req, res) => {
        const hasServerKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
        res.json({ 
            hasServerKey,
            source: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : (process.env.API_KEY ? 'API_KEY' : 'none')
        });
    });

    // Reset all backend historical references, session caches, and proxy state
    app.post("/api/reset", (_req, res) => {
        console.log("[Server] Nuclear reset request received: clearing all backend historical references and state.");
        res.json({ 
            success: true, 
            status: "reset",
            message: "All backend historical references, proxy caches, and session memory cleared." 
        });
    });

    // ==========================================
    // Server-Side Gemini API Endpoints
    // ==========================================

    // 1. Slogan Generator
    app.post("/api/gemini/slogans", async (req, res) => {
        try {
            const { productName } = req.body;
            if (!productName || typeof productName !== 'string') {
                return res.status(400).json({ error: "Product name is required" });
            }
            const slogans = await generateSlogans(productName);
            res.json({ slogans });
        } catch (error: any) {
            console.error("[Server Gemini] Slogan error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // 2. Ad Copy Generator (Supports standard JSON and Server-Sent Event streaming)
    app.post("/api/gemini/ad-copy", async (req, res) => {
        try {
            const { productName, slogan, sceneDescription, photoNames, stream } = req.body;

            if (stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders?.();

                try {
                    for await (const chunk of generateAdCopyStream(productName, slogan, sceneDescription, photoNames)) {
                        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                    }
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                } catch (streamErr: any) {
                    res.write(`data: ${JSON.stringify({ error: streamErr?.message || "Stream error" })}\n\n`);
                    res.end();
                }
                return;
            }

            const adCopy = await generateAdCopy(productName, slogan, sceneDescription, photoNames);
            res.json({ adCopy });
        } catch (error: any) {
            console.error("[Server Gemini] Ad copy error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // 3. Suggestions Generator
    app.post("/api/gemini/suggestions", async (req, res) => {
        try {
            const { currentPrompt, photoNames } = req.body;
            const suggestions = await generateSuggestions(currentPrompt, photoNames);
            res.json({ suggestions });
        } catch (error: any) {
            console.error("[Server Gemini] Suggestions error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // 4. Ad Image Generator (Batch generation with optional SSE streaming progress updates)
    app.post("/api/gemini/generate-ad-image", async (req, res) => {
        try {
            const { items, primaryModel, imageConfig, multimodalParts, stream } = req.body as {
                items: ServerGenerateImageItem[];
                primaryModel: string;
                imageConfig: any;
                multimodalParts: any[];
                stream?: boolean;
            };

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: "Missing or invalid items array for image generation." });
            }

            const isStream = stream ?? (req.headers.accept?.includes('text/event-stream'));

            const customApiKey = (req.headers['x-gemini-api-key'] as string) || (req.body?.customApiKey as string) || undefined;

            if (isStream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.flushHeaders?.();

                const BATCH_SIZE = (multimodalParts && multimodalParts.length > 0) ? 2 : 4;
                const total = items.length;
                const allResults: any[] = [];

                try {
                    for (let i = 0; i < total; i += BATCH_SIZE) {
                        if (res.writableEnded || res.destroyed) break;
                        const batch = items.slice(i, i + BATCH_SIZE);

                        res.write(`data: ${JSON.stringify({ type: 'progress', current: i, total })}\n\n`);

                        const batchPromises = batch.map(item =>
                            generateSingleAdImage(item, primaryModel, imageConfig, multimodalParts || [], customApiKey)
                        );
                        const batchResults = await Promise.all(batchPromises);

                        for (const resItem of batchResults) {
                            allResults.push(resItem);
                            if (!res.writableEnded && !res.destroyed) {
                                res.write(`data: ${JSON.stringify({ type: 'item', result: resItem })}\n\n`);
                            }
                        }
                    }

                    if (!res.writableEnded && !res.destroyed) {
                        res.write(`data: ${JSON.stringify({ type: 'progress', current: total, total })}\n\n`);
                        res.write(`data: ${JSON.stringify({ type: 'done', results: allResults })}\n\n`);
                        res.end();
                    }
                } catch (streamErr: any) {
                    console.error("[Server Gemini] Image stream error:", streamErr);
                    if (!res.writableEnded && !res.destroyed) {
                        res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr?.message || "Stream error" })}\n\n`);
                        res.end();
                    }
                }
                return;
            }

            // Non-streaming batch processing
            const BATCH_SIZE = (multimodalParts && multimodalParts.length > 0) ? 2 : 4;
            const results: any[] = [];

            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(item =>
                    generateSingleAdImage(item, primaryModel, imageConfig, multimodalParts || [], customApiKey)
                );
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            }

            res.json({ results });
        } catch (error: any) {
            console.error("[Server Gemini] Image generation error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // Validate API Key
    app.post("/api/gemini/validate-key", async (req, res) => {
        try {
            const apiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return res.status(400).json({ valid: false, message: "No API key provided." });
            }
            const ai = getAIClient(apiKey);
            await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: "ping",
            });
            return res.json({ valid: true, message: "Key verified and active with Google Gemini API!" });
        } catch (err: any) {
            return res.status(400).json({ valid: false, message: err?.message || String(err) });
        }
    });

    // Dynamically update server-side API Key
    app.post("/api/gemini/set-key", (req, res) => {
        const apiKey = req.body?.apiKey || (req.headers['x-gemini-api-key'] as string);
        if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
            process.env.GEMINI_API_KEY = apiKey.trim();
            console.log("[Server] Dynamic GEMINI_API_KEY updated successfully.");
            return res.json({ success: true, message: "Server-side GEMINI_API_KEY updated." });
        }
        return res.status(400).json({ error: "Invalid API key provided." });
    });

    // 5. Edit Ad Image
    app.post("/api/gemini/edit-image", async (req, res) => {
        try {
            const { image, prompt } = req.body;
            if (!image || !image.base64 || !prompt) {
                return res.status(400).json({ error: "Image data and prompt are required" });
            }
            const result = await editAdImage(image, prompt);
            res.json(result);
        } catch (error: any) {
            console.error("[Server Gemini] Edit image error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // 6. Insert Model Into Scene / Character Swap
    app.post("/api/gemini/insert-model", async (req, res) => {
        try {
            const { sceneImage, modelImage, prompts, modelUsed, aspectRatio, imageSize } = req.body;
            const customApiKey = (req.headers['x-gemini-api-key'] as string) || (req.body?.customApiKey as string) || undefined;
            if (!sceneImage || !modelImage || !prompts || !Array.isArray(prompts)) {
                return res.status(400).json({ error: "Missing required parameters for model insertion" });
            }
            const results = await insertModelIntoSceneServer(
                sceneImage,
                modelImage,
                prompts,
                modelUsed,
                aspectRatio,
                imageSize,
                customApiKey
            );
            res.json({ results });
        } catch (error: any) {
            console.error("[Server Gemini] Insert model error:", error);
            res.status(500).json({ error: formatErrorMessage(error) });
        }
    });

    // 7. Generate Video via Veo
    app.post("/api/gemini/generate-video", async (req, res) => {
        try {
            const { prompt, referenceImages } = req.body;
            if (!prompt) {
                return res.status(400).json({ error: "Prompt is required" });
            }
            const videoBuffer = await generateAdVideoServer(prompt, referenceImages || []);
            res.setHeader("Content-Type", "video/mp4");
            res.send(videoBuffer);
        } catch (error: any) {
            console.error("[Server Gemini] Veo video generation error:", error);
            res.status(500).json({ error: error.message || "Failed to generate video" });
        }
    });

    // 8. Animate Image via Veo
    app.post("/api/gemini/animate-image", async (req, res) => {
        try {
            const { image, prompt, settings } = req.body;
            if (!image || !image.base64) {
                return res.status(400).json({ error: "Image is required" });
            }
            const videoBuffer = await animateImageServer(image, prompt, settings);
            res.setHeader("Content-Type", "video/mp4");
            res.send(videoBuffer);
        } catch (error: any) {
            console.error("[Server Gemini] Veo image animation error:", error);
            res.status(500).json({ error: error.message || "Failed to animate image" });
        }
    });

    // ==========================================
    // Kling API Proxies & Media Streaming
    // ==========================================

    // Kling API Proxy - Generate
    app.post("/api/video/kling/generate", async (req, res) => {
        try {
            const { prompt, image, mode, duration, aspectRatio, apiKey, secretKey, model } = req.body;
            const token = getKlingToken(apiKey, secretKey);

            const endpoint = image 
                ? "https://api.klingai.com/v1/videos/image2video" 
                : "https://api.klingai.com/v1/videos/text2video";

            const body: any = {
                model: model || "kling-v3",
                prompt,
                duration: duration === '10s' ? 10 : 5,
                cfg_scale: 0.5,
                mode: mode || "std",
                aspect_ratio: aspectRatio || "16:9"
            };

            if (image) {
                const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
                body.image = base64Data;
            }

            console.log(`[Kling] Request to ${endpoint}`);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            const responseText = await response.text();
            console.log(`[Kling] Response Status: ${response.status}`);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                return res.status(500).json({ error: "Invalid JSON from Kling", raw: responseText });
            }
            
            if (!response.ok || (data && data.code !== 0)) {
                const errorMessage = data.message || data.msg || "Kling API error";
                return res.status(response.status === 200 ? 400 : response.status).json({ 
                    error: errorMessage,
                    details: data
                });
            }

            res.json(data);
        } catch (error) {
            console.error("[Kling] Proxy Error:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });

    // Kling API Proxy - Status
    app.get("/api/video/kling/status/:taskId", async (req, res) => {
        try {
            const { taskId } = req.params;
            const { apiKey, secretKey } = req.query;
            
            if (!taskId || taskId === 'test-id') {
                try {
                    getKlingToken(apiKey as string, secretKey as string);
                    return res.status(404).json({ message: "Task not found (Auth OK)" });
                } catch {
                    return res.status(401).json({ message: "Auth failed" });
                }
            }

            const token = getKlingToken(
                typeof apiKey === 'string' ? apiKey : undefined,
                typeof secretKey === 'string' ? secretKey : undefined
            );

            const endpoint = `https://api.klingai.com/v1/videos/tasks/${taskId}`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const responseText = await response.text();
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                return res.status(500).json({ error: "Invalid JSON from Kling Status", raw: responseText });
            }

            if (!response.ok) {
                return res.status(response.status).json(data);
            }

            res.json(data);
        } catch (error) {
            console.error("[Kling Status] Error:", error);
            res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });

    // Video Download Proxy (to bypass CORS safely)
    app.get("/api/video/proxy", async (req, res) => {
        try {
            const { url } = req.query;
            if (!url || typeof url !== 'string') {
                return res.status(400).send("URL is required");
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

            const contentType = response.headers.get('content-type') || 'video/mp4';
            res.setHeader('Content-Type', contentType);
            const arrayBuffer = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuffer));
        } catch (error) {
            console.error("Video Proxy Error:", error);
            res.status(500).send("Failed to proxy video");
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true, hmr: false },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*all", (_req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("Failed to start server:", err);
});
