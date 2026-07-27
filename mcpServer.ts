import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

const server = new Server(
  {
    name: "adcraft-studio-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_ad_copy",
        description: "Generate high-converting creative ad copy (headlines, hooks, slogans, and full body copy) for any product or campaign using the state-of-the-art Gemini engine.",
        inputSchema: {
          type: "object",
          properties: {
            productName: {
              type: "string",
              description: "The name of the product or service.",
            },
            productDescription: {
              type: "string",
              description: "A description of the product, its key benefits, and features.",
            },
            targetAudience: {
              type: "string",
              description: "The audience you want to target (e.g., 'Busy professionals', 'Coffee enthusiasts').",
            },
            toneOfVoice: {
              type: "string",
              description: "The tone of voice for the ad copy (e.g., 'Witty', 'Professional', 'Bold', 'Inspirational').",
            },
            sloganPreference: {
              type: "string",
              description: "Any particular theme or slogan preference you want to guide the writing.",
            },
          },
          required: ["productName", "productDescription"],
        },
      },
      {
        name: "generate_ad_image",
        description: "Generate a gorgeous, photorealistic or artistic advertisement image for a product. Saves the output locally and returns the file path.",
        inputSchema: {
          type: "object",
          properties: {
            productName: {
              type: "string",
              description: "The name of the product.",
            },
            sceneDescription: {
              type: "string",
              description: "The scene where the product is placed (e.g., 'sitting on a rustic dark wood table with cinematic morning light filtering through a window').",
            },
            style: {
              type: "string",
              description: "The aesthetic style. E.g., 'Cinematic', 'Studio/Product Pop', 'Warm Retro', 'Hyperrealistic Macro', 'Bold Cyberpunk', 'Minimalist Elegance'.",
            },
            mood: {
              type: "string",
              description: "The light mood. E.g., 'Soft Warm', 'Deep Cool', 'Dramatic High-Contrast', 'Golden Hour', 'Cyberpunk Neon'.",
            },
            slogan: {
              type: "string",
              description: "Optional slogan text to blend or overlay creatively.",
            },
            negativePrompt: {
              type: "string",
              description: "Items, elements, or qualities to strictly exclude from the image.",
            },
            aspectRatio: {
              type: "string",
              enum: ["1:1", "16:9", "9:16", "4:3", "3:4"],
              description: "The layout aspect ratio. Default: '1:1'.",
            },
            imageSize: {
              type: "string",
              enum: ["512px", "1K", "2K"],
              description: "The quality resolution to generate. Default: '1K'.",
            },
            outputFileName: {
              type: "string",
              description: "A custom filename (e.g., 'sparkling_water_ad.png') to save in the workspace root.",
            },
          },
          required: ["productName", "sceneDescription"],
        },
      },
    ],
  };
});

// Implement tool execution handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!apiKey) {
    return {
      content: [
        {
          type: "text",
          text: "Error: GEMINI_API_KEY is not set in your environment variables. Please set the environment variable GEMINI_API_KEY before running this MCP server.",
        },
      ],
      isError: true,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  if (name === "generate_ad_copy") {
    try {
      const { productName, productDescription, targetAudience, toneOfVoice, sloganPreference } = args as any;

      const systemPrompt = `You are an elite, award-winning copywriter and conversion rate optimization specialist.
Your mission is to generate copy that commands attention, provokes desire, and drives instant action.

Generate copy for the following product:
- Product Name: ${productName}
- Product Description: ${productDescription}
${targetAudience ? `- Target Audience: ${targetAudience}` : ""}
${toneOfVoice ? `- Tone of Voice: ${toneOfVoice}` : ""}
${sloganPreference ? `- Slogan Guideline/Preference: ${sloganPreference}` : ""}

Please structure your response into the following clear sections:
1. **HOOKS & ATTENTION-GRABBERS** (3 variations)
2. **HIGH-CONVERTING SLOGANS & TAGLINES** (4 variations)
3. **SHORT AD COPY** (Perfect for social media, 2 variations)
4. **LONG-FORM PERSUASIVE COPY** (A robust storytelling narrative utilizing copywriting frameworks like AIDA or PAS)`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
      });

      return {
        content: [
          {
            type: "text",
            text: response.text || "No copy could be generated.",
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating ad copy: ${error.message || error}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "generate_ad_image") {
    try {
      const {
        productName,
        sceneDescription,
        style,
        mood,
        slogan,
        negativePrompt,
        aspectRatio = "1:1",
        imageSize = "1K",
        outputFileName,
      } = args as any;

      // Map imageSize
      let mappedSize = "1024x1024";
      if (imageSize === "512px") {
        mappedSize = "512x512";
      } else if (imageSize === "2K") {
        mappedSize = "2048x2048";
      }

      // Build the rich prompt mimicking our app's logic
      const promptInstructions = [
        "Task: Create a single, photorealistic advertisement image.",
        `Product Focus: The image must clearly show the product "${productName}" as the hero of the image, sharply rendered.`,
        `Scene Description: ${sceneDescription}`,
      ];

      if (style && style !== "None") promptInstructions.push(`Artistic Style: ${style}.`);
      if (mood && mood !== "None") promptInstructions.push(`Overall Mood: ${mood}.`);
      if (negativePrompt) promptInstructions.push(`Important Exclusion: The image must NOT contain ${negativePrompt}.`);
      if (slogan) {
        promptInstructions.push(`Slogan Text Overlay: Subtly blend or creatively represent the text "${slogan}" in the scene layout.`);
      }
      promptInstructions.push("Final Output: The final image must be a single, photorealistic photograph with professional, studio-grade commercial lighting.");

      const fullPromptText = promptInstructions.filter(Boolean).join("\n");

      // We call the high-fidelity Imagen model using generateContent
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: fullPromptText,
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: {
            imageSize: mappedSize,
            aspectRatio: aspectRatio,
          },
        },
      });

      const candidate = response?.candidates?.[0];
      let base64Data: string | null = null;
      let mimeType = "image/png";

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Data = part.inlineData.data;
            mimeType = part.inlineData.mimeType || "image/png";
            break;
          }
        }
      }

      if (!base64Data) {
        return {
          content: [
            {
              type: "text",
              text: "The model did not return any image data. This can sometimes occur if safety filters triggered or the prompt instructions were conflicting.",
            },
          ],
          isError: true,
        };
      }

      // Save to file
      const ext = mimeType.split("/")[1] || "png";
      const actualFileName = outputFileName || `adcraft_${Date.now()}.${ext}`;
      const outputDir = process.cwd();
      const fullPath = path.join(outputDir, actualFileName);

      fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));

      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\n\n- **Saved to**: ${fullPath}\n- **Filename**: ${actualFileName}\n- **Aspect Ratio**: ${aspectRatio}\n- **Image Size**: ${imageSize}\n- **Model Used**: gemini-3.1-flash-image-preview`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating ad image: ${error.message || error}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Run server using Stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AdCraft Studio MCP Server running on stdio!");
}

main().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
});
