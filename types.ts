
export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface AdVariation {
  url: string;
  variantIndex: number; // 0-based
}

export interface GenerationError {
  variantIndex: number;
  message: string;
}

export interface ImageGenerationResponse {
  images: AdVariation[];
  errors: GenerationError[];
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5' | '16:10' | '97:60' | '1:4' | '1:8' | '4:1' | '8:1' | '3:2' | '2:1' | '12:5' | '36:13' | '1.91:1' | '1.2:1' | '1:2' | '728:90' | '970:90' | '160:600' | '120:600' | '320:50' | '320:100' | '970:250';
export type ModelType = 'standard' | 'pro' | 'ultra' | 'light';
export type ImageSize = '512px' | '1K' | '2K' | '4K' | '6K' | '8K';

export interface CameraSettingsData {
  cameraType: string;
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  lightingStyle: string;
  lightingSetup: string;
  distortion: string;
  textureDetail: string;
  colorStyle: string;
  technique: string;
  cameraAngle: string;
}

export interface CameraPreset {
  id: string;
  name: string;
  settings: CameraSettingsData;
}

export type VideoModel = 'veo' | 'kling';

export interface VideoSettingsData {
  cameraType: string;
  lighting: string;
  technique: string;
  duration: string;
  aspectRatio: AspectRatio;
  resolution: '720p' | '1080p';
  model: VideoModel;
}

export interface GenerateAdParams extends Partial<CameraSettingsData> {
  productImage?: ImageData;
  productImages?: ImageData[];
  competitorImages?: ImageData[];
  subjectImages: ImageData[];
  modelImages?: ImageData[];
  poseImages?: ImageData[];
  companyLogo?: ImageData;
  productName: string;
  backgroundPrompt: string;
  slogan: string;
  placement: string;
  fullPrompt?: string | string[];
  aspectRatio?: AspectRatio;
  negativePrompt?: string;
  style?: string;
  mood?: string;
  numberOfVariations?: number;
  modelType?: ModelType;
  imageSize?: ImageSize;
  promptMode?: 'guided' | 'full' | 'multiple';
}

export type PanDirection = 'up' | 'down' | 'left' | 'right';
export type ZoomDirection = 'in' | 'out';
export type VaryStrength = 'subtle' | 'strong';
export type ZoomLevel = '1.5x' | '2x';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
