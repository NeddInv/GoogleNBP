
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

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
            console.log(`[Kling] Model: ${body.model}, Mode: ${body.mode}`);

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
            console.log(`[Kling] Response Body: ${responseText}`);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
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
                // For test-id, we just check if we can generate a token
                try {
                    getKlingToken(apiKey as string, secretKey as string);
                    return res.status(404).json({ message: "Task not found (Auth OK)" });
                } catch (e) {
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
            console.log(`[Kling Status] Task: ${taskId}, Status: ${response.status}`);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
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

    // Video Download Proxy (to bypass CORS)
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
            response.body.pipe(res);
        } catch (error) {
            console.error("Video Proxy Error:", error);
            res.status(500).send("Failed to proxy video");
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true, hmr: false },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static("dist"));
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
