export interface DocumentSection {
  title: string;
  subsections?: {
    subtitle?: string;
    paragraphs: string[];
    bulletPoints?: string[];
  }[];
}

export const BASIC_ACCOUNT_PDF_DOCUMENT = {
  title: "AI PRODUCT AD GENERATOR & STUDIO",
  subtitle: "Basic Account Level Application Overview & User Specification Guide",
  version: "v2.5 Pro (Basic Account Specification)",
  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  author: "AdCraft Studio Technical Team",
  recipient: "Basic Account Application Review",
  
  executiveSummary: "The AI Product Ad Generator & Studio is an advanced full-stack web application designed to empower product creators, digital marketers, e-commerce vendors, and creative agencies to generate high-converting, professional commercial advertisements, studio product photography, tagline marketing copy, and motion video ads from raw product assets. Operating under the Basic Account Level tier, users gain access to standard HD AI generation tools, professional camera emulation controls, aesthetic mood presets, and batch output management.",

  sections: [
    {
      title: "1. Basic Account Tier Capabilities & Scope",
      subsections: [
        {
          subtitle: "1.1 Core Visual Ad Generation",
          paragraphs: [
            "The Basic Account Tier provides essential toolsets required to transform standard product photos into studio-grade commercial visual assets using Google Gemini Imagen 3 models."
          ],
          bulletPoints: [
            "Single & Multi-Product Asset Upload: Support for primary product shots, competitor references, brand logos, subject masks, model posing guides, and camera references.",
            "Guided & Custom Background Engineering: Choice of preset studio environments (Minimalist Studio, Modern Kitchen, Nature Outdoor, Luxury Marble, Neon Cyberpunk, Architectural) or custom prompt input.",
            "Supported Aspect Ratios: 1:1 (Square - Instagram/E-commerce), 16:9 (Landscape - YouTube/Web Banner), 9:16 (Vertical - TikTok/Reels/Stories), 4:3 (Classic Banner), and 3:4 (Portrait Feed).",
            "Resolution Controls: Standard HD output optimized for fast rendering and high-density mobile displays."
          ]
        },
        {
          subtitle: "1.2 Professional Camera Emulation Settings",
          paragraphs: [
            "Basic Account users can configure physical optical parameters to simulate high-end DSLR and cinema camera setups:"
          ],
          bulletPoints: [
            "Camera Types: Full Frame Mirrorless, Medium Format Digital, 35mm Vintage Film, and Cinema Rig.",
            "Focal Lengths: 24mm (Wide Angle), 35mm (Environmental), 50mm (Natural Sight), 85mm (Commercial Portrait), and 105mm (Macro Detail).",
            "Aperture Simulation: f/1.2 & f/1.8 (Ultra-shallow depth of field with creamy bokeh), f/2.8, f/5.6, f/8, and f/11 (Deep sharp focus).",
            "Camera Angles: Eye-Level, Low Angle Hero, High Angle Overhead, Top-Down Flatlay, and 45° Isometric.",
            "Lighting Controls: Softbox Studio, Dramatic Rim Light, Golden Hour Natural, High-Key White, Volumetric Sunbeams, and Dark Moody Shadows."
          ]
        },
        {
          subtitle: "1.3 Slogan & Marketing Copy Generator",
          paragraphs: [
            "Includes automated brand messaging powered by Gemini AI to generate compelling taglines, headlines, and call-to-action copy tailored to the target product category and tone."
          ]
        },
        {
          subtitle: "1.4 Motion Video Synthesis (Kling AI)",
          paragraphs: [
            "Basic Account users can transform generated static ad visuals into dynamic 5-second MP4 video advertisements with customized camera movements (Pan Left/Right, Zoom In/Out, Tilt Up/Down)."
          ]
        }
      ]
    },
    {
      title: "2. Technical Architecture & Security Specifications",
      subsections: [
        {
          subtitle: "2.1 Full-Stack Hybrid Architecture",
          paragraphs: [
            "Built on a robust React 18 + Vite client-side Single Page Application (SPA) backed by an Express.js server engine running on Node.js."
          ]
        },
        {
          subtitle: "2.2 Server-Side API Security & Secret Protection",
          paragraphs: [
            "All API keys—including Google Gemini API keys and Kling Video API JWT credentials—are strictly restricted to server-side memory (`/api/*` routes) and never exposed to client-side browser runtime environments."
          ]
        },
        {
          subtitle: "2.3 CORS Proxying & Video Streaming",
          paragraphs: [
            "Dedicated Express endpoints safely proxy media assets and binary video arrays to bypass browser CORS restrictions and deliver smooth video preview playback."
          ]
        },
        {
          subtitle: "2.4 Client-Side Persistence Engine",
          paragraphs: [
            "User generation history, batch outputs, thumbnail caches, and active configurations are securely persisted locally via IndexedDB/localStorage with quick zero-latency workspace clear controls."
          ]
        }
      ]
    },
    {
      title: "3. User Operation Workflow Guide",
      subsections: [
        {
          subtitle: "Step-by-Step Execution Sequence",
          paragraphs: [
            "Follow these standard operating steps to produce optimal commercial ad outputs:"
          ],
          bulletPoints: [
            "Step 1 - Upload Assets: Drop primary product photo (PNG/JPEG). Optionally attach company brand logo.",
            "Step 2 - Define Product Info: Enter product name, brand category, or target market keywords.",
            "Step 3 - Configure Optical Settings: Select camera type, lens focal length, aperture setting, and lighting setup.",
            "Step 4 - Choose Mood & Background: Select background environment preset or type custom scenario.",
            "Step 5 - Generate & Review: Click 'Generate AI Ad Creatives' to create a batch of 4 variations.",
            "Step 6 - Generate Copy & Animate: Click 'Generate Slogans' for marketing copy, or 'Animate Video' for motion ads.",
            "Step 7 - Export & Save: Download full-resolution image/video assets directly to local disk."
          ]
        }
      ]
    },
    {
      title: "4. Account Tier Limits & Recommended Best Practices",
      subsections: [
        {
          subtitle: "4.1 Basic Tier Parameters",
          paragraphs: [
            "Batch Size: Up to 4 image variations per prompt execution.",
            "Prompt Input Modes: Guided Form Mode, Full Prompt Mode, and Batch Prompt Array Mode.",
            "History Storage: Local browser session buffer (clearable via 'Clear History' control).",
            "Recommended File Formats: High contrast PNG or JPEG images under 10MB per upload."
          ]
        }
      ]
    }
  ]
};
