
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface ImageData {
  base64: string;
  mimeType: string;
  name?: string;
  id?: string;
}

export interface AdVariation {
  url: string;
  variantIndex: number; // 0-based
  id?: string; // The schema ID associated with this variation/prompt
  fileName?: string; // The detected or assigned file/file_name for this variation
  referenceImages?: string[]; // Extra references detected from reference_images in JSON
  modelUsed?: string;
}

export interface GenerationError {
  variantIndex: number;
  message: string;
  promptBoxIndex?: number; // 0-indexed slot
  promptBoxNumber?: number; // 1-indexed number for user-facing prompt box (#1, #2, etc.)
  promptTitle?: string;
  promptId?: string;
  fileName?: string; // Attached file/file_name for this variation
  referenceImages?: string[]; // Extra references for this variation
  promptSnippet?: string;
  specificReason?: string;
  modelUsed?: string;
}

export interface ImageGenerationResponse {
  images: AdVariation[];
  errors: GenerationError[];
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5' | '16:10' | '97:60' | '1:4' | '1:8' | '4:1' | '8:1' | '3:2' | '2:1' | '12:5' | '36:13' | '1.91:1' | '1.2:1' | '1:2' | '728:90' | '970:90' | '160:600' | '120:600' | '320:50' | '320:100' | '970:250';
export type ModelType = 'standard' | 'pro' | 'ultra' | 'light' | 'nano-banana-2.1';
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

export interface CharacterProfile {
  id: string;
  name: string;
  ethnicity: string;
  genderAge?: string;
  skinTone?: string;
  distinguishingFeatures?: string;
  wardrobeNotes?: string;
  isLocked: boolean;
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
  promptIds?: string[];
  promptFileNames?: string[];
  promptReferenceImages?: (string[] | undefined)[];
  globalReferenceImages?: string[];
  promptBoxIndices?: number[];
  soloPromptIndex?: number | null;
  characters?: CharacterProfile[];
}

export interface InsertModelParams {
  sceneImage: ImageData;
  modelImage: ImageData;
  mode?: 'swap' | 'insert';
  targetSubject?: string;
  outfitMode?: 'keep-scene-outfit' | 'keep-model-outfit' | 'harmonize';
  placement?: string;
  actionOrPose?: string;
  clothingStyle?: string;
  blendingMode?: 'seamless-blend' | 'replace-subject' | 'subtle-background' | 'hero-foreground';
  customNotes?: string;
  aspectRatio?: AspectRatio;
  modelType?: ModelType;
  imageSize?: ImageSize;
  numberOfVariations?: number;
  excludeHandheldProps?: boolean;
}

export interface HistoricalSessionSummary {

  photoCount: number;
  productCount: number;
  competitorCount: number;
  modelCount: number;
  poseCount: number;
  sceneCount: number;
  hasLogo: boolean;
  promptMode: 'guided' | 'full' | 'multiple';
  productName: string;
  slogan?: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  variationCount?: number;
  historyImagesCount: number;
}

export interface HistoricalSessionReferenceSnapshot {
  id: string;
  timestamp: number;
  label: string;
  summary: HistoricalSessionSummary;
  references: {
    productImages: ImageData[];
    competitorImages: ImageData[];
    companyLogo: ImageData | null;
    subjectImages: ImageData[];
    modelImages: ImageData[];
    poseImages: ImageData[];
  };
  prompts: {
    promptMode: 'guided' | 'full' | 'multiple';
    productName: string;
    selectedBackground: string;
    customBackground: string;
    slogan: string;
    placement: string;
    fullPrompt: string;
    multiplePrompts: string[];
    disabledPrompts: boolean[];
    promptIds: string[];
    promptFileNames?: string[];
    promptReferenceImages?: string[][];
    soloPromptIndex: number | null;
    negativePrompt: string;
    selectedStyle: string;
    selectedMood: string;
  };
  settings: {
    aspectRatio: AspectRatio;
    modelType: ModelType;
    imageSize: ImageSize;
    numberOfVariations: number;
    cameraSettings: CameraSettingsData;
    cameraPresets: CameraPreset[];
  };
  history?: { thumbnail: string; fullRes: string; id?: string; fileName?: string; referenceImages?: string[] }[];
  currentAds?: ImageGenerationResponse | null;
}

export type PanDirection = 'up' | 'down' | 'left' | 'right';
export type ZoomDirection = 'in' | 'out';
export type VaryStrength = 'subtle' | 'strong';
export type ZoomLevel = '1.5x' | '2x';
