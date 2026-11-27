import * as storage from './storageService';
import type { HistoricalSessionReferenceSnapshot, HistoricalSessionSummary, ImageData, AspectRatio, ModelType, ImageSize, CameraSettingsData, CameraPreset, ImageGenerationResponse } from '../types';

const LATEST_SESSION_KEY = 'adgen-latest-session-reference';
const ALL_SESSIONS_KEY = 'adgen-session-checkpoints';
const SESSION_META_KEY = 'adgen-session-checkpoints-meta';
const MAX_SAVED_SESSIONS = 15;

export interface SessionMetaSummary {
  id: string;
  timestamp: number;
  label: string;
  photoCount: number;
  promptMode: 'guided' | 'full' | 'multiple';
  productName: string;
  hasLogo: boolean;
}

/**
 * Saves a historical session reference snapshot into IndexedDB and updates metadata in localStorage.
 */
export const saveHistoricalSessionSnapshot = async (
  snapshot: HistoricalSessionReferenceSnapshot
): Promise<void> => {
  try {
    // 1. Save as latest reference
    await storage.setItem(LATEST_SESSION_KEY, snapshot);

    // 2. Fetch existing session list and update
    const existingSessions = (await storage.getItem<HistoricalSessionReferenceSnapshot[]>(ALL_SESSIONS_KEY)) || [];
    
    // Filter out if duplicate ID exists
    const filtered = existingSessions.filter(s => s.id !== snapshot.id);
    
    // Insert new snapshot at beginning (newest first)
    const updated = [snapshot, ...filtered].slice(0, MAX_SAVED_SESSIONS);
    await storage.setItem(ALL_SESSIONS_KEY, updated);

    // 3. Save lightweight meta in localStorage for instant access without awaiting IDB
    const metaList: SessionMetaSummary[] = updated.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      label: s.label,
      photoCount: s.summary.photoCount,
      promptMode: s.summary.promptMode,
      productName: s.summary.productName,
      hasLogo: s.summary.hasLogo,
    }));
    try {
      localStorage.setItem(SESSION_META_KEY, JSON.stringify(metaList));
    } catch {
      // localStorage may fail if storage quota is tight; safe to ignore
    }
  } catch (err) {
    console.error('[historicalSessionService] Failed to save session snapshot:', err);
  }
 };

/**
 * Retrieves the latest saved historical session snapshot from storage.
 */
export const getLatestHistoricalSession = async (): Promise<HistoricalSessionReferenceSnapshot | null> => {
  try {
    const latest = await storage.getItem<HistoricalSessionReferenceSnapshot>(LATEST_SESSION_KEY);
    if (latest) return latest;

    const all = await storage.getItem<HistoricalSessionReferenceSnapshot[]>(ALL_SESSIONS_KEY);
    if (all && all.length > 0) return all[0];

    return null;
  } catch (err) {
    console.error('[historicalSessionService] Failed to fetch latest session:', err);
    return null;
  }
};

/**
 * Retrieves all saved historical session snapshots.
 */
export const getAllHistoricalSessions = async (): Promise<HistoricalSessionReferenceSnapshot[]> => {
  try {
    const all = await storage.getItem<HistoricalSessionReferenceSnapshot[]>(ALL_SESSIONS_KEY);
    return all || [];
  } catch (err) {
    console.error('[historicalSessionService] Failed to fetch all sessions:', err);
    return [];
  }
};

/**
 * Synchronously retrieves lightweight metadata of saved session checkpoints from localStorage.
 */
export const getSessionCheckpointsMetaSync = (): SessionMetaSummary[] => {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

/**
 * Deletes a specific historical session checkpoint by id.
 */
export const deleteHistoricalSession = async (id: string): Promise<HistoricalSessionReferenceSnapshot[]> => {
  try {
    const existing = (await storage.getItem<HistoricalSessionReferenceSnapshot[]>(ALL_SESSIONS_KEY)) || [];
    const updated = existing.filter(s => s.id !== id);
    await storage.setItem(ALL_SESSIONS_KEY, updated);

    // If deleted was latest, update latest
    const latest = await storage.getItem<HistoricalSessionReferenceSnapshot>(LATEST_SESSION_KEY);
    if (latest && latest.id === id) {
      if (updated.length > 0) {
        await storage.setItem(LATEST_SESSION_KEY, updated[0]);
      } else {
        await storage.removeItem(LATEST_SESSION_KEY);
      }
    }

    // Update meta
    const metaList: SessionMetaSummary[] = updated.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      label: s.label,
      photoCount: s.summary.photoCount,
      promptMode: s.summary.promptMode,
      productName: s.summary.productName,
      hasLogo: s.summary.hasLogo,
    }));
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(metaList));

    return updated;
  } catch (err) {
    console.error('[historicalSessionService] Failed to delete session:', err);
    return [];
  }
};

/**
 * Clears all historical session snapshots.
 */
export const clearAllHistoricalSessions = async (): Promise<void> => {
  try {
    await storage.removeItem(LATEST_SESSION_KEY);
    await storage.removeItem(ALL_SESSIONS_KEY);
    localStorage.removeItem(SESSION_META_KEY);
  } catch (err) {
    console.error('[historicalSessionService] Failed to clear all sessions:', err);
  }
};

/**
 * Nuclear wipe of all historical references, cached images, session checkpoints, and state.
 */
export const purgeAllHistoricalData = async (): Promise<void> => {
  try {
    // 1. Wipe IndexedDB
    await storage.clearEntireDatabase();

    // 2. Wipe all session & app keys in localStorage
    const keysToRemove = [
      LATEST_SESSION_KEY,
      ALL_SESSIONS_KEY,
      SESSION_META_KEY,
      'adgen-form-state',
      'adgen-history',
      'adgen-current-ads',
      'adgen-active-index',
      'adgen-product-image',
      'adgen-product-images',
      'adgen-competitor-images',
      'adgen-company-logo',
      'adgen-subject-images',
      'adgen-model-images',
      'adgen-pose-images'
    ];
    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('[historicalSessionService] Failed to purge all data:', err);
  }
};


export interface BuildSnapshotParams {
  customLabel?: string;
  productImages: ImageData[];
  competitorImages: ImageData[];
  companyLogo: ImageData | null;
  subjectImages: ImageData[];
  modelImages: ImageData[];
  poseImages: ImageData[];
  productName: string;
  selectedBackground: string;
  customBackground: string;
  slogan: string;
  placement: string;
  promptMode: 'guided' | 'full' | 'multiple';
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
  aspectRatio: AspectRatio;
  modelType: ModelType;
  imageSize: ImageSize;
  numberOfVariations: number;
  cameraSettings: CameraSettingsData;
  cameraPresets: CameraPreset[];
  history?: { thumbnail: string; fullRes: string; id?: string; fileName?: string; referenceImages?: string[] }[];
  currentAds?: ImageGenerationResponse | null;
}

/**
 * Helper to construct a validated, tagged HistoricalSessionReferenceSnapshot
 */
export const buildSessionSnapshot = (params: BuildSnapshotParams): HistoricalSessionReferenceSnapshot => {
  const timestamp = Date.now();
  const id = `session_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
  
  const totalPhotos = 
    params.productImages.length + 
    params.competitorImages.length + 
    (params.companyLogo ? 1 : 0) + 
    params.subjectImages.length + 
    params.modelImages.length + 
    params.poseImages.length;

  const dateStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const photoText = totalPhotos === 1 ? '1 Photo Reference' : `${totalPhotos} Photo References`;
  const nameText = params.productName ? `"${params.productName.slice(0, 20)}"` : `${params.promptMode.toUpperCase()} Mode`;
  
  const label = params.customLabel || `Session at ${dateStr} • ${photoText} • ${nameText}`;

  const summary: HistoricalSessionSummary = {
    photoCount: totalPhotos,
    productCount: params.productImages.length,
    competitorCount: params.competitorImages.length,
    modelCount: params.modelImages.length,
    poseCount: params.poseImages.length,
    sceneCount: params.subjectImages.length,
    hasLogo: !!params.companyLogo,
    promptMode: params.promptMode,
    productName: params.productName,
    slogan: params.slogan,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
    variationCount: params.numberOfVariations,
    historyImagesCount: params.history?.length || 0,
  };

  return {
    id,
    timestamp,
    label,
    summary,
    references: {
      productImages: [...params.productImages],
      competitorImages: [...params.competitorImages],
      companyLogo: params.companyLogo ? { ...params.companyLogo } : null,
      subjectImages: [...params.subjectImages],
      modelImages: [...params.modelImages],
      poseImages: [...params.poseImages],
    },
    prompts: {
      promptMode: params.promptMode,
      productName: params.productName,
      selectedBackground: params.selectedBackground,
      customBackground: params.customBackground,
      slogan: params.slogan,
      placement: params.placement,
      fullPrompt: params.fullPrompt,
      multiplePrompts: [...params.multiplePrompts],
      disabledPrompts: [...params.disabledPrompts],
      promptIds: [...params.promptIds],
      promptFileNames: params.promptFileNames ? [...params.promptFileNames] : undefined,
      promptReferenceImages: params.promptReferenceImages ? [...params.promptReferenceImages] : undefined,
      soloPromptIndex: params.soloPromptIndex,
      negativePrompt: params.negativePrompt,
      selectedStyle: params.selectedStyle,
      selectedMood: params.selectedMood,
    },
    settings: {
      aspectRatio: params.aspectRatio,
      modelType: params.modelType,
      imageSize: params.imageSize,
      numberOfVariations: params.numberOfVariations,
      cameraSettings: { ...params.cameraSettings },
      cameraPresets: [...params.cameraPresets],
    },
    history: params.history ? [...params.history] : [],
    currentAds: params.currentAds ? { ...params.currentAds } : null,
  };
};
