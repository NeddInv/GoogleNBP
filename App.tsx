
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { BackgroundSelector } from './components/BackgroundSelector';
import { SloganGenerator } from './components/SloganGenerator';
import { AdDisplay } from './components/AdDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { generateSlogans, generateAdImage, generateSuggestions, generateAdVideo, generateAdCopy, editAdImage, animateImage, resolveImageModelName, getCustomApiKey, setCustomApiKey } from './services/geminiService';
import { 
    BACKGROUND_OPTIONS, 
    STYLE_OPTIONS,
    DEFAULT_CAMERA_PRESETS, 
    DEFAULT_AESTHETIC_STYLE, 
    DEFAULT_NEGATIVE_PROMPT, 
    INITIAL_CAMERA_SETTINGS, 
    getEffectiveDefaults, 
    saveUserDefaults, 
    resetUserDefaultsToFactory 
} from './constants';
import * as storage from './services/storageService';
import { CameraIcon, CloseIcon, SparklesIcon, PhotoIcon, FilmIcon, CopyIcon, SettingsIcon, ChevronDownIcon, StopIcon, ArrowPathIcon, DownloadIcon, ArchiveIcon, BoltIcon, EyeIcon, EyeSlashIcon, PencilIcon, CheckIcon, TrashIcon, UserIcon, LayersIcon, KeyIcon, AtSymbolIcon, Squares2X2Icon, ListBulletIcon } from './components/icons';
import type { ImageData, AspectRatio, CameraSettingsData, PanDirection, ZoomDirection, VaryStrength, ZoomLevel, ModelType, ImageSize, VideoSettingsData, VideoModel, CameraPreset, ImageGenerationResponse, HistoricalSessionReferenceSnapshot, CharacterProfile } from './types';
import { CharacterCastModal } from './components/CharacterCastModal';
import { loadCharacterProfiles, saveCharacterProfiles } from './services/characterService';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { StyleSelector } from './components/StyleSelector';
import { MoodSelector } from './components/MoodSelector';
import { VariationSelector } from './components/VariationSelector';
import { CameraSettings } from './components/CameraSettings';
import { CreationActions } from './components/CreationActions';
import { ImageSizeSelector } from './components/ImageSizeSelector';
import { AnimateSection } from './components/AnimateSection';
import { KlingConfig } from './components/KlingConfig';
import { ImageModal } from './components/ImageModal';
import { BulkDownloadModal } from './components/BulkDownloadModal';
import { JsonPromptUploader } from './components/JsonPromptUploader';
import { PdfApplicationGuideModal } from './components/PdfApplicationGuideModal';
import { PhotoReferenceCatalogBar, type PhotoRefSummary } from './components/PhotoReferenceCatalogBar';
import { RenamePhotoModal } from './components/RenamePhotoModal';
import { RestartHistoricalSessionModal } from './components/RestartHistoricalSessionModal';
import { ModelInsertionStudioModal } from './components/ModelInsertionStudioModal';
import { PromptMentionTextarea } from './components/PromptMentionTextarea';
import { buildSessionSnapshot, saveHistoricalSessionSnapshot, getLatestHistoricalSession, getAllHistoricalSessions, deleteHistoricalSession, clearAllHistoricalSessions, purgeAllHistoricalData } from './services/historicalSessionService';
import { downloadBasicAccountPdfDocument } from './utils/pdfGenerator';
import { downloadSingleImage, generateUniqueFilename } from './utils/downloadUtils';

const createThumbnail = (base64Image: string, maxWidth: number = 256, maxHeight: number = 256): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.src = base64Image;
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (!width || !height) {
                        resolve(base64Image);
                        return;
                    }

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = Math.max(1, Math.floor(width));
                    canvas.height = Math.max(1, Math.floor(height));
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(base64Image);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch {
                    resolve(base64Image);
                }
            };
            img.onerror = () => resolve(base64Image);
        } catch {
            resolve(base64Image);
        }
    });
};

const App: React.FC = () => {
    const [productImages, setProductImages] = useState<ImageData[]>([]);
    const [competitorImages, setCompetitorImages] = useState<ImageData[]>([]);
    const [companyLogo, setCompanyLogo] = useState<ImageData | null>(null);
    const [subjectImages, setSubjectImages] = useState<ImageData[]>([]);
    const [modelImages, setModelImages] = useState<ImageData[]>([]);
    const [poseImages, setPoseImages] = useState<ImageData[]>([]);

    const productImage = productImages[0] || null;
    const [productName, setProductName] = useState<string>('');
    const [selectedBackground, setSelectedBackground] = useState<string>(BACKGROUND_OPTIONS[0].prompt);
    const [customBackground, setCustomBackground] = useState<string>('');
    const [slogan, setSlogan] = useState<string>('');
    const [placement, setPlacement] = useState<string>('');
    const [generatedAds, setGeneratedAds] = useState<ImageGenerationResponse | null>(null);
    const [activeAdIndex, setActiveAdIndex] = useState<number>(0);
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [promptMode, setPromptMode] = useState<'guided' | 'full' | 'multiple'>('guided');
    const [multipromptOrientation, setMultipromptOrientation] = useState<'grid' | 'stack'>(() => {
        try {
            return (localStorage.getItem('multiprompt_orientation') as 'grid' | 'stack') || 'grid';
        } catch {
            return 'grid';
        }
    });
    const [characters, setCharacters] = useState<CharacterProfile[]>(() => loadCharacterProfiles());
    const [isCharacterModalOpen, setIsCharacterModalOpen] = useState<boolean>(false);

    useEffect(() => {
        saveCharacterProfiles(characters);
    }, [characters]);

    const [fullPrompt, setFullPrompt] = useState<string>('');
    const [multiplePrompts, setMultiplePrompts] = useState<string[]>(new Array(60).fill(''));
    const [disabledPrompts, setDisabledPrompts] = useState<boolean[]>(new Array(60).fill(false));
    const [soloPromptIndex, setSoloPromptIndex] = useState<number | null>(null);
    const [suggestionTargetIndex, setSuggestionTargetIndex] = useState<number | null>(null);
    const [promptIds, setPromptIds] = useState<string[]>(Array.from({ length: 60 }, (_, i) => String(i + 1)));
    const [promptFileNames, setPromptFileNames] = useState<string[]>(new Array(60).fill(''));
    const [promptReferenceImages, setPromptReferenceImages] = useState<string[][]>(new Array(60).fill([]));
    const [singlePromptFileName, setSinglePromptFileName] = useState<string>('');
    const [singlePromptReferenceImages, setSinglePromptReferenceImages] = useState<string[]>([]);
    const [history, setHistory] = useState<{ thumbnail: string, fullRes: string, id?: string, fileName?: string, referenceImages?: string[] }[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [generationType, setGenerationType] = useState<'image' | 'video' | null>(null);
    const [videoLoadingMessage, setVideoLoadingMessage] = useState<string>('');
    const [imageLoadingMessage, setImageLoadingMessage] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [negativePrompt, setNegativePrompt] = useState<string>(() => getEffectiveDefaults().negativePrompt);
    const [selectedStyle, setSelectedStyle] = useState<string>(() => getEffectiveDefaults().selectedStyle);
    const [selectedMood, setSelectedMood] = useState<string>('');
    const [numberOfVariations, setNumberOfVariations] = useState<number>(1);
    const [adCopy, setAdCopy] = useState<string>('');
    const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [showCameraSettings, setShowCameraSettings] = useState<boolean>(false);
    const [modelType, setModelType] = useState<ModelType>(() => getEffectiveDefaults().modelType || 'pro');
    const [imageSize, setImageSize] = useState<ImageSize>(() => getEffectiveDefaults().imageSize || '2K');
    const [videoModel, setVideoModel] = useState<VideoModel>('veo');
    const [klingKeys, setKlingKeys] = useState({ apiKey: '', secretKey: '' });
    const [klingModel, setKlingModel] = useState('kling-v3');
    const [cameraSettings, setCameraSettings] = useState<CameraSettingsData>(() => getEffectiveDefaults().cameraSettings);
    const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>(() => getEffectiveDefaults().cameraPresets);
    const [selectedModalImage, setSelectedModalImage] = useState<{src: string, alt: string} | null>(null);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
    const [bulkDownloadModalData, setBulkDownloadModalData] = useState<{
        isOpen: boolean;
        title: string;
        description?: string;
        images: ImageData[];
        defaultPrefix: string;
    } | null>(null);

    const [isRestartModalOpen, setIsRestartModalOpen] = useState<boolean>(false);
    const [isModelInsertionModalOpen, setIsModelInsertionModalOpen] = useState<boolean>(false);
    const [modelStudioMode, setModelStudioMode] = useState<'swap' | 'insert'>('swap');
    const [swapPreselect, setSwapPreselect] = useState<{
        sceneImage: ImageData | null;
        modelImage: ImageData | null;
        targetSubject?: string;
    }>({ sceneImage: null, modelImage: null });

    const allWorkspaceImages = useMemo<ImageData[]>(() => {
        const list: ImageData[] = [];
        const seen = new Set<string>();
        const addAll = (imgs: ImageData[]) => {
            for (const img of imgs) {
                if (!img?.base64) continue;
                const key = `${img.name || ''}_${img.base64.slice(0, 40)}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push(img);
                }
            }
        };
        addAll(subjectImages);
        addAll(modelImages);
        addAll(productImages);
        addAll(poseImages);
        addAll(competitorImages);
        return list;
    }, [subjectImages, modelImages, productImages, poseImages, competitorImages]);

    const openCharacterSwapStudio = useCallback((sceneName?: string, modelName?: string, targetDesc?: string) => {
        const findByName = (name?: string): ImageData | null => {
            if (!name) return null;
            const lower = name.toLowerCase();
            const base = lower.replace(/\.[^/.]+$/, '');
            return (
                allWorkspaceImages.find(i => i.name?.toLowerCase() === lower) ||
                allWorkspaceImages.find(i => i.name?.toLowerCase().replace(/\.[^/.]+$/, '') === base) ||
                allWorkspaceImages.find(i => i.name?.toLowerCase().includes(base)) ||
                null
            );
        };
        const resolvedScene = findByName(sceneName) || subjectImages[0] || productImages[0] || allWorkspaceImages[0] || null;
        const resolvedModel = findByName(modelName) || modelImages[0] || allWorkspaceImages.find(i => i.base64 !== resolvedScene?.base64) || null;
        setSwapPreselect({
            sceneImage: resolvedScene,
            modelImage: resolvedModel,
            targetSubject: targetDesc || 'the woman',
        });
        setModelStudioMode('swap');
        setIsModelInsertionModalOpen(true);
    }, [allWorkspaceImages, subjectImages, productImages, modelImages]);
    const [promptErrors, setPromptErrors] = useState<Record<number, { message: string; specificReason?: string; modelUsed?: string }>>({});
    const [promptModelsUsed, setPromptModelsUsed] = useState<Record<number, string>>({});
    const [historicalSessions, setHistoricalSessions] = useState<HistoricalSessionReferenceSnapshot[]>([]);
    const [latestHistoricalSnapshot, setLatestHistoricalSnapshot] = useState<HistoricalSessionReferenceSnapshot | null>(null);
    const [restartToastMessage, setRestartToastMessage] = useState<string | null>(null);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [customKeyInput, setCustomKeyInput] = useState<string>(() => getCustomApiKey() || '');
    const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
    const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [hasAiStudioKey, setHasAiStudioKey] = useState<boolean>(false);
    const [hasServerKey, setHasServerKey] = useState<boolean>(false);

    // Check on mount if an AI Studio key is already hooked up or present on server
    useEffect(() => {
        const checkKeys = async () => {
            if (window.aistudio?.hasSelectedApiKey) {
                try {
                    const selected = await window.aistudio.hasSelectedApiKey();
                    setHasAiStudioKey(selected);
                } catch (err) {
                    console.error('Error checking window.aistudio key:', err);
                }
            }
            try {
                const res = await fetch('/api/gemini/key-status');
                if (res.ok) {
                    const data = await res.json();
                    setHasServerKey(Boolean(data.hasServerKey));
                }
            } catch (e) {
                // ignore network err
            }
        };
        checkKeys();
    }, []);

    const handleOpenSelectKey = useCallback(async () => {
        // 1. If running in Google AI Studio, open native key selector dialog directly!
        if (window.aistudio?.openSelectKey) {
            try {
                await window.aistudio.openSelectKey();
                if (window.aistudio.hasSelectedApiKey) {
                    const selected = await window.aistudio.hasSelectedApiKey();
                    setHasAiStudioKey(selected);
                    if (selected) {
                        setRestartToastMessage('AI Studio API Key selected and ready.');
                    }
                }
                return;
            } catch (err) {
                console.warn('AI Studio key selector threw, opening modal:', err);
            }
        }
        // 2. Fallback to selection modal
        setIsKeyModalOpen(true);
    }, []);

    const handleTestKey = async () => {
        const keyToTest = customKeyInput.trim() || getCustomApiKey() || '';
        if (!keyToTest) {
            setKeyTestResult({ success: false, message: 'Please paste or enter an API key to test.' });
            return;
        }
        setIsTestingKey(true);
        setKeyTestResult(null);
        try {
            const res = await fetch('/api/gemini/validate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: keyToTest })
            });
            const data = await res.json();
            if (res.ok && data.valid) {
                setKeyTestResult({ success: true, message: data.message });
            } else {
                setKeyTestResult({ success: false, message: data.message || 'Key validation failed.' });
            }
        } catch (e: any) {
            setKeyTestResult({ success: false, message: e.message || 'Network error during validation.' });
        } finally {
            setIsTestingKey(false);
        }
    };

    useEffect(() => {
        const handleOpen = () => {
            handleOpenSelectKey();
        };
        window.addEventListener('open-api-key-modal', handleOpen);
        return () => window.removeEventListener('open-api-key-modal', handleOpen);
    }, [handleOpenSelectKey]);

    useEffect(() => {
        if (!restartToastMessage) return;
        const timer = setTimeout(() => {
            setRestartToastMessage(null);
        }, 5000);
        return () => clearTimeout(timer);
    }, [restartToastMessage]);

    const handleQuickDownloadImageData = (image: ImageData, defaultName: string) => {
        const filename = generateUniqueFilename(defaultName, 'png');
        downloadSingleImage(`data:${image.mimeType};base64,${image.base64}`, filename, 'png');
    };

    const abortControllerRef = useRef<AbortController | null>(null);
    const isInitialMount = useRef(true);
    const isPurgingRef = useRef(false);

    // Load state from storage on mount
    useEffect(() => {
        const loadSavedState = async () => {
            try {
                // 1. Load history from IndexedDB (more reliable for images)
                const savedHistory = await storage.getItem<any[]>('adgen-history');
                if (savedHistory) {
                    // Handle migration from string[] to { thumbnail, fullRes }[]
                    const migratedHistory = savedHistory.map(item => {
                        if (typeof item === 'string') {
                            return { thumbnail: item, fullRes: item };
                        }
                        return item;
                    });
                    setHistory(migratedHistory);
                }

                // 2. Load current generated ads
                const savedAds = await storage.getItem<any>('adgen-current-ads');
                if (savedAds) {
                    if (Array.isArray(savedAds)) {
                        setGeneratedAds({
                            images: savedAds.map((url, i) => ({ url, variantIndex: i })),
                            errors: []
                        });
                    } else {
                        setGeneratedAds(savedAds);
                    }
                }

                const savedActiveIndex = await storage.getItem<number>('adgen-active-index');
                if (savedActiveIndex !== null) setActiveAdIndex(savedActiveIndex);

                // 3. Load form state from localStorage
                const storedState = localStorage.getItem('adgen-form-state');
                if (storedState) {
                    const state = JSON.parse(storedState);
                    if (state.productName !== undefined) setProductName(state.productName);
                    if (state.selectedBackground !== undefined) setSelectedBackground(state.selectedBackground);
                    if (state.customBackground !== undefined) setCustomBackground(state.customBackground);
                    if (state.slogan !== undefined) setSlogan(state.slogan);
                    if (state.placement !== undefined) setPlacement(state.placement);
                    if (state.promptMode !== undefined) setPromptMode(state.promptMode);
                    if (state.fullPrompt !== undefined) setFullPrompt(state.fullPrompt);
                    if (state.multiplePrompts !== undefined) {
                        const loadedPrompts = Array.isArray(state.multiplePrompts) ? state.multiplePrompts : [];
                        const paddedPrompts = [...loadedPrompts];
                        while (paddedPrompts.length < 40) paddedPrompts.push('');
                        setMultiplePrompts(paddedPrompts.slice(0, 40));
                    }
                    if (state.disabledPrompts !== undefined) {
                        const loadedDisabled = Array.isArray(state.disabledPrompts) ? state.disabledPrompts : [];
                        const paddedDisabled = [...loadedDisabled];
                        while (paddedDisabled.length < 40) paddedDisabled.push(false);
                        setDisabledPrompts(paddedDisabled.slice(0, 40));
                    }
                    if (state.promptIds !== undefined) {
                        const loadedIds = Array.isArray(state.promptIds) ? state.promptIds : [];
                        const paddedIds = [...loadedIds];
                        while (paddedIds.length < 40) paddedIds.push(String(paddedIds.length + 1));
                        setPromptIds(paddedIds.slice(0, 40));
                    }
                    if (state.promptFileNames !== undefined) {
                        const loadedFiles = Array.isArray(state.promptFileNames) ? state.promptFileNames : [];
                        const paddedFiles = [...loadedFiles];
                        while (paddedFiles.length < 40) paddedFiles.push('');
                        setPromptFileNames(paddedFiles.slice(0, 40));
                    }
                    if (state.promptReferenceImages !== undefined) {
                        const loadedRefs = Array.isArray(state.promptReferenceImages) ? state.promptReferenceImages : [];
                        const paddedRefs = [...loadedRefs];
                        while (paddedRefs.length < 40) paddedRefs.push([]);
                        setPromptReferenceImages(paddedRefs.slice(0, 40));
                    }
                    if (state.singlePromptFileName !== undefined) {
                        setSinglePromptFileName(state.singlePromptFileName || '');
                    }
                    if (state.singlePromptReferenceImages !== undefined) {
                        setSinglePromptReferenceImages(Array.isArray(state.singlePromptReferenceImages) ? state.singlePromptReferenceImages : []);
                    }
                    if (state.soloPromptIndex !== undefined) {
                        setSoloPromptIndex(typeof state.soloPromptIndex === 'number' ? state.soloPromptIndex : null);
                    }
                    const defaults = getEffectiveDefaults();
                    if (state.aspectRatio !== undefined) setAspectRatio(state.aspectRatio);
                    if (state.negativePrompt !== undefined) {
                        setNegativePrompt(state.negativePrompt);
                    } else {
                        setNegativePrompt(defaults.negativePrompt);
                    }
                    if (state.selectedStyle !== undefined) {
                        setSelectedStyle(state.selectedStyle);
                    } else {
                        setSelectedStyle(defaults.selectedStyle);
                    }
                    if (state.selectedMood !== undefined) setSelectedMood(state.selectedMood);
                    if (state.numberOfVariations !== undefined) setNumberOfVariations(state.numberOfVariations);
                    if (state.modelType !== undefined) {
                        setModelType(state.modelType);
                    } else {
                        setModelType(defaults.modelType || 'pro');
                    }
                    if (state.imageSize !== undefined) {
                        setImageSize(state.imageSize);
                    } else {
                        setImageSize(defaults.imageSize || '2K');
                    }
                    if (state.cameraSettings !== undefined) {
                        setCameraSettings(state.cameraSettings);
                    } else {
                        setCameraSettings(defaults.cameraSettings);
                    }
                    if (state.cameraPresets !== undefined && Array.isArray(state.cameraPresets) && state.cameraPresets.length > 0) {
                        setCameraPresets(state.cameraPresets);
                    } else {
                        setCameraPresets(defaults.cameraPresets);
                    }
                    
                    // Load images from IndexedDB (they are too large for localStorage)
                    const pImgs = await storage.getItem<ImageData[]>('adgen-product-images');
                    if (pImgs && pImgs.length > 0) {
                        setProductImages(pImgs);
                    } else {
                        const pImg = await storage.getItem<ImageData>('adgen-product-image');
                        if (pImg) setProductImages([pImg]);
                    }
                    
                    const compImgs = await storage.getItem<ImageData[]>('adgen-competitor-images');
                    if (compImgs) setCompetitorImages(compImgs);
                    
                    const cLogo = await storage.getItem<ImageData>('adgen-company-logo');
                    if (cLogo) setCompanyLogo(cLogo);
                    
                    const sImgs = await storage.getItem<ImageData[]>('adgen-subject-images');
                    if (sImgs) setSubjectImages(sImgs);

                    const mImgs = await storage.getItem<ImageData[]>('adgen-model-images');
                    if (mImgs) setModelImages(mImgs);

                    const poseImgs = await storage.getItem<ImageData[]>('adgen-pose-images');
                    if (poseImgs) setPoseImages(poseImgs);
                }

                // 4. Load historical session checkpoints
                const savedSessions = await getAllHistoricalSessions();
                if (savedSessions && savedSessions.length > 0) {
                    setHistoricalSessions(savedSessions);
                    setLatestHistoricalSnapshot(savedSessions[0]);
                } else {
                    const latest = await getLatestHistoricalSession();
                    if (latest) {
                        setHistoricalSessions([latest]);
                        setLatestHistoricalSnapshot(latest);
                    }
                }
            } catch (e) {
                console.error("Failed to load state from storage", e);
            } finally {
                isInitialMount.current = false;
            }
        };

        loadSavedState();
    }, []);

    // Save history when it changes
    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-history', history).catch(console.error);
    }, [history]);

    // Save current ads when they change
    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-current-ads', generatedAds).catch(console.error);
    }, [generatedAds]);

    // Save active index
    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-active-index', activeAdIndex).catch(console.error);
    }, [activeAdIndex]);

    // Save form state to localStorage (text only)
    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        const stateToSave = {
            productName,
            selectedBackground,
            customBackground,
            slogan,
            placement,
            promptMode,
            fullPrompt,
            multiplePrompts,
            disabledPrompts,
            promptIds,
            promptFileNames,
            promptReferenceImages,
            singlePromptFileName,
            singlePromptReferenceImages,
            soloPromptIndex,
            aspectRatio,
            negativePrompt,
            selectedStyle,
            selectedMood,
            numberOfVariations,
            modelType,
            imageSize,
            cameraSettings,
            cameraPresets
        };
        localStorage.setItem('adgen-form-state', JSON.stringify(stateToSave));
    }, [
        productName, selectedBackground, customBackground, slogan, placement, 
        promptMode, fullPrompt, multiplePrompts, disabledPrompts, promptIds, promptFileNames, promptReferenceImages, singlePromptFileName, singlePromptReferenceImages, soloPromptIndex, aspectRatio, negativePrompt, selectedStyle, 
        selectedMood, numberOfVariations, modelType, imageSize, cameraSettings, cameraPresets
    ]);

    // Save images to IndexedDB
    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-product-images', productImages).catch(console.error);
    }, [productImages]);

    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-competitor-images', competitorImages).catch(console.error);
    }, [competitorImages]);

    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-company-logo', companyLogo).catch(console.error);
    }, [companyLogo]);

    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-subject-images', subjectImages).catch(console.error);
    }, [subjectImages]);

    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-model-images', modelImages).catch(console.error);
    }, [modelImages]);

    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        storage.setItem('adgen-pose-images', poseImages).catch(console.error);
    }, [poseImages]);

    const hasAnyImage = useMemo(() => productImages.length > 0 || competitorImages.length > 0 || subjectImages.length > 0 || modelImages.length > 0 || poseImages.length > 0 || !!companyLogo, [productImages, competitorImages, subjectImages, modelImages, poseImages, companyLogo]);

    // Auto-checkpoint historical session references when active reference assets or prompts change
    useEffect(() => {
        if (isInitialMount.current || isPurgingRef.current) return;
        if (!hasAnyImage && !productName && !placement && !fullPrompt && !multiplePrompts.some(p => p.trim())) {
            return;
        }

        const timer = setTimeout(() => {
            if (isPurgingRef.current) return;
            const currentSnapshot = buildSessionSnapshot({
                productImages,
                competitorImages,
                companyLogo,
                subjectImages,
                modelImages,
                poseImages,
                productName,
                selectedBackground,
                customBackground,
                slogan,
                placement,
                promptMode,
                fullPrompt,
                multiplePrompts,
                disabledPrompts,
                promptIds,
                promptFileNames,
                promptReferenceImages,
                soloPromptIndex,
                negativePrompt,
                selectedStyle,
                selectedMood,
                aspectRatio,
                modelType,
                imageSize,
                numberOfVariations,
                cameraSettings,
                cameraPresets,
                history,
                currentAds: generatedAds,
            });

            saveHistoricalSessionSnapshot(currentSnapshot).then(async () => {
                if (isPurgingRef.current) return;
                const all = await getAllHistoricalSessions();
                setHistoricalSessions(all);
                setLatestHistoricalSnapshot(currentSnapshot);
            }).catch(console.error);
        }, 2500);

        return () => clearTimeout(timer);
    }, [
        hasAnyImage, productImages, competitorImages, companyLogo, subjectImages, modelImages, poseImages,
        productName, selectedBackground, customBackground, slogan, placement, promptMode, fullPrompt,
        multiplePrompts, disabledPrompts, promptIds, promptFileNames, soloPromptIndex, negativePrompt, selectedStyle,
        selectedMood, aspectRatio, modelType, imageSize, numberOfVariations, cameraSettings, cameraPresets,
        history, generatedAds
    ]);


    const canGenerate = useMemo(() => {
        const hasGuidedPrompt = promptMode === 'guided' && (placement.trim() !== '' || customBackground.trim() !== '' || selectedBackground !== BACKGROUND_OPTIONS[0].prompt);
        const hasFullPrompt = promptMode === 'full' && fullPrompt.trim() !== '';
        const hasMultiplePrompts = promptMode === 'multiple' && (
            soloPromptIndex !== null
                ? (multiplePrompts[soloPromptIndex]?.trim() !== '')
                : multiplePrompts.some((p, i) => !disabledPrompts[i] && p.trim() !== '')
        );
        return hasAnyImage || hasGuidedPrompt || hasFullPrompt || hasMultiplePrompts;
    }, [hasAnyImage, promptMode, placement, customBackground, selectedBackground, fullPrompt, multiplePrompts, disabledPrompts, soloPromptIndex]);

    const handleSaveCameraPreset = useCallback((name: string) => {
        const newPreset: CameraPreset = {
            id: Date.now().toString(),
            name,
            settings: { ...cameraSettings }
        };
        setCameraPresets(prev => [...prev, newPreset]);
    }, [cameraSettings]);

    const handleDeleteCameraPreset = useCallback((id: string) => {
        setCameraPresets(prev => prev.filter(p => p.id !== id));
    }, []);

    const handleApplyCameraPreset = useCallback((preset: CameraPreset) => {
        setCameraSettings(preset.settings);
    }, []);

    const handleSaveWorkspaceDefaults = useCallback(() => {
        saveUserDefaults({
            cameraPresets,
            cameraSettings,
            selectedStyle,
            negativePrompt,
            modelType,
            imageSize,
        });
        setRestartToastMessage('Default preferences saved! Camera presets, aesthetic style, negative prompt, and PRO model (gemini-3-pro-image) are now your default.');
        setTimeout(() => setRestartToastMessage(null), 5000);
    }, [cameraPresets, cameraSettings, selectedStyle, negativePrompt, modelType, imageSize]);

    const handleRestoreWorkspaceDefaults = useCallback(() => {
        const defaults = getEffectiveDefaults();
        setCameraPresets([...defaults.cameraPresets]);
        setCameraSettings({ ...defaults.cameraSettings });
        setSelectedStyle(defaults.selectedStyle);
        setNegativePrompt(defaults.negativePrompt);
        setModelType(defaults.modelType || 'pro');
        setImageSize(defaults.imageSize || '2K');
        setRestartToastMessage('Workspace defaults restored: PRO model, camera presets, aesthetic style, and negative prompt reloaded.');
        setTimeout(() => setRestartToastMessage(null), 4000);
    }, []);

    const handleResetFactoryDefaults = useCallback(() => {
        const factory = resetUserDefaultsToFactory();
        setCameraPresets([...factory.cameraPresets]);
        setCameraSettings({ ...factory.cameraSettings });
        setSelectedStyle(factory.selectedStyle);
        setNegativePrompt(factory.negativePrompt);
        setModelType(factory.modelType || 'pro');
        setImageSize(factory.imageSize || '2K');
        setRestartToastMessage('Reset to factory default PRO model, curated camera presets, style, and negative prompt.');
        setTimeout(() => setRestartToastMessage(null), 4000);
    }, []);

    const handleRestoreDefaultCameraPresets = useCallback(() => {
        setCameraPresets([...DEFAULT_CAMERA_PRESETS]);
        setRestartToastMessage('Restored standard 8 curated studio camera presets.');
        setTimeout(() => setRestartToastMessage(null), 4000);
    }, []);

    const handleToggleDisablePrompt = useCallback((index: number) => {
        if (soloPromptIndex !== null) {
            setSoloPromptIndex(null);
        }
        setDisabledPrompts(prev => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    }, [soloPromptIndex]);

    const handleToggleSoloPrompt = useCallback((index: number) => {
        if (soloPromptIndex === index) {
            setSoloPromptIndex(null);
        } else {
            setSoloPromptIndex(index);
            setDisabledPrompts(prev => {
                const next = [...prev];
                next[index] = false;
                return next;
            });
        }
    }, [soloPromptIndex]);

    const handleEnableAllPrompts = useCallback(() => {
        setSoloPromptIndex(null);
        setDisabledPrompts(prev => new Array(Math.max(prev.length, multiplePrompts.length, 60)).fill(false));
    }, [multiplePrompts.length]);

    const handleDisableAllPrompts = useCallback(() => {
        setSoloPromptIndex(null);
        setDisabledPrompts(prev => new Array(Math.max(prev.length, multiplePrompts.length, 60)).fill(true));
    }, [multiplePrompts.length]);

    const handleInvertDisabledPrompts = useCallback(() => {
        setSoloPromptIndex(null);
        setDisabledPrompts(prev => prev.map(d => !d));
    }, []);

    const handleDisableOtherPrompts = useCallback((targetIndex: number) => {
        setSoloPromptIndex(null);
        setDisabledPrompts(prev => {
            const len = Math.max(prev.length, multiplePrompts.length, targetIndex + 1, 60);
            const next = new Array(len).fill(true);
            next[targetIndex] = false;
            return next;
        });
    }, [multiplePrompts.length]);

    const handleAddPromptSlots = useCallback((countToAdd = 10) => {
        setMultiplePrompts(prev => [...prev, ...new Array(countToAdd).fill('')]);
        setDisabledPrompts(prev => [...prev, ...new Array(countToAdd).fill(false)]);
        setPromptIds(prev => [...prev, ...Array.from({ length: countToAdd }, (_, i) => String(prev.length + i + 1))]);
        setPromptFileNames(prev => [...prev, ...new Array(countToAdd).fill('')]);
        setPromptReferenceImages(prev => [...prev, ...new Array(countToAdd).fill([])]);
    }, []);

    const handleClearAllMultiprompt = useCallback(() => {
        setMultiplePrompts(new Array(60).fill(''));
        setDisabledPrompts(new Array(60).fill(false));
        setPromptIds(Array.from({ length: 60 }, (_, i) => String(i + 1)));
        setPromptFileNames(new Array(60).fill(''));
        setPromptReferenceImages(new Array(60).fill([]));
        setSoloPromptIndex(null);
        setSuggestionTargetIndex(null);
        setPromptErrors({});
        setNumberOfVariations(1);
    }, []);

    const handleClearAllMultipromptReferences = useCallback(() => {
        setPromptFileNames(new Array(60).fill(''));
        setPromptReferenceImages(new Array(60).fill([]));
    }, []);

    const handleReset = useCallback(async () => {
        isPurgingRef.current = true;
        abortControllerRef.current?.abort();

        try {
            // 1. Tell backend server to reset all proxy state, session caches, and memory
            fetch('/api/reset', { method: 'POST' }).catch(() => {});

            // 2. Nuclear wipe of all historical references, cached images, session checkpoints, and local storage
            await purgeAllHistoricalData();

            // 3. Reset all React states to pristine empty defaults
            setProductImages([]);
            setCompetitorImages([]);
            setModelImages([]);
            setPoseImages([]);
            setCompanyLogo(null);
            setSubjectImages([]);
            setHistoricalSessions([]);
            setLatestHistoricalSnapshot(null);
            setProductName('');
            setSelectedBackground(BACKGROUND_OPTIONS[0].prompt);
            setCustomBackground('');
            setSlogan('');
            setPlacement('');
            setGeneratedAds(null);
            setActiveAdIndex(0);
            setGeneratedVideo(null);
            setIsLoading(false);
            setIsEditing(false);
            setError(null);
            setPromptMode('guided');
            setFullPrompt('');
            setMultiplePrompts(new Array(60).fill(''));
            setDisabledPrompts(new Array(60).fill(false));
            setPromptIds(Array.from({ length: 60 }, (_, i) => String(i + 1)));
            setPromptFileNames(new Array(60).fill(''));
            setPromptReferenceImages(new Array(60).fill([]));
            setSinglePromptFileName('');
            setSinglePromptReferenceImages([]);
            setSoloPromptIndex(null);
            setSuggestionTargetIndex(null);
            setSuggestions([]);
            setGenerationType(null);
            setVideoLoadingMessage('');
            setImageLoadingMessage('');
            const defaults = getEffectiveDefaults();
            setAspectRatio('1:1');
            setNegativePrompt(defaults.negativePrompt);
            setSelectedStyle(defaults.selectedStyle);
            setSelectedMood('');
            setNumberOfVariations(1);
            setAdCopy('');
            setShowCameraSettings(false);
            setModelType(defaults.modelType || 'pro');
            setImageSize(defaults.imageSize || '2K');
            setCameraSettings(defaults.cameraSettings);
            setCameraPresets([...defaults.cameraPresets]);
            setHistory([]);
            setIsRestartModalOpen(false);

            window.scrollTo({ top: 0, behavior: 'smooth' });
            setRestartToastMessage('Reset complete: all historical backend references, checkpoints, and cached assets have been completely wiped clean.');
            setTimeout(() => setRestartToastMessage(null), 5000);
        } catch (err) {
            console.error('Error during workspace reset:', err);
        } finally {
            setTimeout(() => {
                isPurgingRef.current = false;
            }, 1000);
        }
    }, []);


    const handleRestartFromHistoricalSession = useCallback((snapshot: HistoricalSessionReferenceSnapshot, options?: { referencesOnly?: boolean }) => {
        // 1. Rehydrate reference photos
        setProductImages(snapshot.references.productImages ? [...snapshot.references.productImages] : []);
        setCompetitorImages(snapshot.references.competitorImages ? [...snapshot.references.competitorImages] : []);
        setCompanyLogo(snapshot.references.companyLogo ? { ...snapshot.references.companyLogo } : null);
        setSubjectImages(snapshot.references.subjectImages ? [...snapshot.references.subjectImages] : []);
        setModelImages(snapshot.references.modelImages ? [...snapshot.references.modelImages] : []);
        setPoseImages(snapshot.references.poseImages ? [...snapshot.references.poseImages] : []);

        // 2. Rehydrate prompts & configuration if full restart requested
        if (!options?.referencesOnly) {
            setProductName(snapshot.prompts.productName || '');
            setSelectedBackground(snapshot.prompts.selectedBackground || BACKGROUND_OPTIONS[0].prompt);
            setCustomBackground(snapshot.prompts.customBackground || '');
            setSlogan(snapshot.prompts.slogan || '');
            setPlacement(snapshot.prompts.placement || '');
            setPromptMode(snapshot.prompts.promptMode || 'guided');
            setFullPrompt(snapshot.prompts.fullPrompt || '');

            const loadedPrompts = Array.isArray(snapshot.prompts.multiplePrompts) ? snapshot.prompts.multiplePrompts : [];
            const paddedPrompts = [...loadedPrompts];
            while (paddedPrompts.length < 40) paddedPrompts.push('');
            setMultiplePrompts(paddedPrompts.slice(0, 40));

            const loadedDisabled = Array.isArray(snapshot.prompts.disabledPrompts) ? snapshot.prompts.disabledPrompts : [];
            const paddedDisabled = [...loadedDisabled];
            while (paddedDisabled.length < 40) paddedDisabled.push(false);
            setDisabledPrompts(paddedDisabled.slice(0, 40));

            const loadedIds = Array.isArray(snapshot.prompts.promptIds) ? snapshot.prompts.promptIds : [];
            const paddedIds = [...loadedIds];
            while (paddedIds.length < 40) paddedIds.push(String(paddedIds.length + 1));
            setPromptIds(paddedIds.slice(0, 40));

            const loadedFiles = Array.isArray(snapshot.prompts.promptFileNames) ? snapshot.prompts.promptFileNames : [];
            const paddedFiles = [...loadedFiles];
            while (paddedFiles.length < 40) paddedFiles.push('');
            setPromptFileNames(paddedFiles.slice(0, 40));

            const loadedRefs = Array.isArray(snapshot.prompts.promptReferenceImages) ? snapshot.prompts.promptReferenceImages : [];
            const paddedRefs = [...loadedRefs];
            while (paddedRefs.length < 40) paddedRefs.push([]);
            setPromptReferenceImages(paddedRefs.slice(0, 40));

            setSoloPromptIndex(snapshot.prompts.soloPromptIndex ?? null);
            setNegativePrompt(snapshot.prompts.negativePrompt || '');
            setSelectedStyle(snapshot.prompts.selectedStyle || '');
            setSelectedMood(snapshot.prompts.selectedMood || '');

            setAspectRatio(snapshot.settings.aspectRatio || '1:1');
            setModelType(snapshot.settings.modelType || 'pro');
            setImageSize(snapshot.settings.imageSize || '2K');
            setNumberOfVariations(snapshot.settings.numberOfVariations || 1);
            setCameraSettings(snapshot.settings.cameraSettings ? { ...snapshot.settings.cameraSettings } : INITIAL_CAMERA_SETTINGS);
            if (snapshot.settings.cameraPresets) {
                setCameraPresets([...snapshot.settings.cameraPresets]);
            }
        }

        // 3. Rehydrate generated outputs or reset generation cycle
        if (snapshot.currentAds) {
            setGeneratedAds({ ...snapshot.currentAds });
        }
        if (snapshot.history && snapshot.history.length > 0) {
            setHistory([...snapshot.history]);
        }

        // 4. Reset runtime status
        setIsLoading(false);
        setIsEditing(false);
        setError(null);
        setGeneratedVideo(null);
        setActiveAdIndex(0);

        setIsRestartModalOpen(false);
        const photoCount = snapshot.summary.photoCount;
        setRestartToastMessage(
            options?.referencesOnly
                ? `Program restarted with ${photoCount} reference ${photoCount === 1 ? 'photo' : 'photos'} restored into catalog.`
                : `Program restarted from historical session references (${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} and session settings restored).`
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleDeleteHistoricalSession = useCallback(async (id: string) => {
        const updated = await deleteHistoricalSession(id);
        setHistoricalSessions(updated);
        setLatestHistoricalSnapshot(updated[0] || null);
    }, []);

    const cleanupDetachedPhotos = useCallback((removedNames: string[]) => {
        if (!removedNames || removedNames.length === 0) return;
        const removedSet = new Set(removedNames.map(n => n.toLowerCase().trim()));
        setPromptFileNames(prev => prev.map(fn => removedSet.has(fn.toLowerCase().trim()) ? '' : fn));
        setPromptReferenceImages(prev => prev.map(refs => refs ? refs.filter(r => !removedSet.has(r.toLowerCase().trim())) : []));
        setSinglePromptFileName(prev => removedSet.has(prev.toLowerCase().trim()) ? '' : prev);
        setSinglePromptReferenceImages(prev => prev.filter(r => !removedSet.has(r.toLowerCase().trim())));
    }, []);

    const handleAddSubjectImage = (newImage: ImageData | null) => {
        if (newImage && subjectImages.length < 100) {
            setSubjectImages(prevImages => [...prevImages, newImage]);
        }
    };

    const handleAddMultipleSubjectImages = (newImages: ImageData[]) => {
        setSubjectImages(prevImages => {
            const combined = [...prevImages, ...newImages];
            return combined.slice(0, 100); // Limit to 100
        });
    };

    const handleRemoveSubjectImage = (indexToRemove: number) => {
        const removed = subjectImages[indexToRemove];
        if (removed) {
            const name = removed.name || `context_scene_${indexToRemove + 1}.png`;
            cleanupDetachedPhotos([name]);
        }
        setSubjectImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleAddProductImage = (newImage: ImageData | null) => {
        if (newImage && productImages.length < 30) {
            setProductImages(prevImages => [...prevImages, newImage]);
        }
    };

    const handleAddMultipleProductImages = (newImages: ImageData[]) => {
        setProductImages(prevImages => {
            const combined = [...prevImages, ...newImages];
            return combined.slice(0, 30); // Limit to 30
        });
    };

    const handleRemoveProductImage = (indexToRemove: number) => {
        const removed = productImages[indexToRemove];
        if (removed) {
            const name = removed.name || `product_photo_${indexToRemove + 1}.png`;
            cleanupDetachedPhotos([name]);
        }
        setProductImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleAddCompetitorImage = (newImage: ImageData | null) => {
        if (newImage && competitorImages.length < 12) {
            setCompetitorImages(prevImages => [...prevImages, newImage]);
        }
    };

    const handleAddMultipleCompetitorImages = (newImages: ImageData[]) => {
        setCompetitorImages(prevImages => {
            const combined = [...prevImages, ...newImages];
            return combined.slice(0, 12); // Limit to 12
        });
    };

    const handleRemoveCompetitorImage = (indexToRemove: number) => {
        const removed = competitorImages[indexToRemove];
        if (removed) {
            const name = removed.name || `competitor_ref_${indexToRemove + 1}.png`;
            cleanupDetachedPhotos([name]);
        }
        setCompetitorImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleAddModelImage = (newImage: ImageData | null) => {
        if (newImage && modelImages.length < 20) {
            setModelImages(prevImages => [...prevImages, newImage]);
        }
    };

    const handleAddMultipleModelImages = (newImages: ImageData[]) => {
        setModelImages(prevImages => {
            const combined = [...prevImages, ...newImages];
            return combined.slice(0, 20); // Limit to 20
        });
    };

    const handleRemoveModelImage = (indexToRemove: number) => {
        const removed = modelImages[indexToRemove];
        if (removed) {
            const name = removed.name || `model_character_${indexToRemove + 1}.png`;
            cleanupDetachedPhotos([name]);
        }
        setModelImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleAddPoseImage = (newImage: ImageData | null) => {
        if (newImage && poseImages.length < 15) {
            setPoseImages(prevImages => [...prevImages, newImage]);
        }
    };

    const handleAddMultiplePoseImages = (newImages: ImageData[]) => {
        setPoseImages(prevImages => {
            const combined = [...prevImages, ...newImages];
            return combined.slice(0, 15); // Limit to 15
        });
    };

    const handleRemovePoseImage = (indexToRemove: number) => {
        const removed = poseImages[indexToRemove];
        if (removed) {
            const name = removed.name || `pose_action_${indexToRemove + 1}.png`;
            cleanupDetachedPhotos([name]);
        }
        setPoseImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handlePromptsLoaded = useCallback((
        newPrompts: string[], 
        mode: 'replace' | 'append', 
        fileName: string, 
        newPromptIds?: string[], 
        newPromptFileNames?: string[],
        newPromptReferenceImages?: string[][],
        embeddedReferences?: ImageData[],
        newDisabledFlags?: boolean[]
    ) => {
        let totalCount = newPrompts.length;
        setMultiplePrompts(prev => {
            let combined: string[] = [];
            if (mode === 'append') {
                const existing = prev.filter(p => p.trim().length > 0);
                combined = [...existing, ...newPrompts];
            } else {
                combined = [...newPrompts];
            }
            totalCount = combined.length;
            const targetLength = Math.max(60, combined.length);
            const padded = [...combined];
            while (padded.length < targetLength) {
                padded.push('');
            }
            return padded;
        });

        if (mode === 'replace') {
            setSoloPromptIndex(null);
            const initialDisabled = new Array(Math.max(60, newPrompts.length)).fill(false);
            if (newDisabledFlags && newDisabledFlags.length > 0) {
                newDisabledFlags.forEach((d, i) => {
                    if (i < initialDisabled.length) initialDisabled[i] = !!d;
                });
            }
            setDisabledPrompts(initialDisabled);
        } else {
            // Append mode: retain previous states and append new ones
            setDisabledPrompts(prev => {
                const existingCount = totalCount - newPrompts.length;
                const existingDisabled = prev.slice(0, existingCount);
                const appendedDisabled = newDisabledFlags && newDisabledFlags.length > 0
                    ? newDisabledFlags.slice(0, newPrompts.length)
                    : new Array(newPrompts.length).fill(false);
                const combined = [...existingDisabled, ...appendedDisabled];
                while (combined.length < Math.max(60, combined.length)) combined.push(false);
                return combined;
            });
        }

        if (newPromptIds && newPromptIds.length > 0) {
            setPromptIds(prev => {
                let combinedIds: string[] = [];
                if (mode === 'append') {
                    const existingIds = prev.filter(id => id.trim().length > 0);
                    combinedIds = [...existingIds, ...newPromptIds];
                } else {
                    combinedIds = [...newPromptIds];
                }
                const targetLength = Math.max(60, combinedIds.length);
                const paddedIds = [...combinedIds];
                while (paddedIds.length < targetLength) {
                    paddedIds.push(String(paddedIds.length + 1));
                }
                return paddedIds;
            });
        }

        if (newPromptFileNames && newPromptFileNames.length > 0) {
            setPromptFileNames(prev => {
                let combinedFiles: string[] = [];
                if (mode === 'append') {
                    const existingFiles = prev.filter(fn => fn.trim().length > 0);
                    combinedFiles = [...existingFiles, ...newPromptFileNames];
                } else {
                    combinedFiles = [...newPromptFileNames];
                }
                const targetLength = Math.max(60, combinedFiles.length);
                const paddedFiles = [...combinedFiles];
                while (paddedFiles.length < targetLength) {
                    paddedFiles.push('');
                }
                return paddedFiles;
            });
        } else if (mode === 'replace') {
            setPromptFileNames(new Array(Math.max(60, newPrompts.length)).fill(''));
        }

        if (newPromptReferenceImages && newPromptReferenceImages.length > 0) {
            setPromptReferenceImages(prev => {
                let combinedRefs: string[][] = [];
                if (mode === 'append') {
                    const existingCount = totalCount - newPrompts.length;
                    const existingRefs = prev.slice(0, existingCount);
                    combinedRefs = [...existingRefs, ...newPromptReferenceImages];
                } else {
                    combinedRefs = [...newPromptReferenceImages];
                }
                const targetLength = Math.max(60, combinedRefs.length);
                const paddedRefs = [...combinedRefs];
                while (paddedRefs.length < targetLength) {
                    paddedRefs.push([]);
                }
                return paddedRefs;
            });
        } else if (mode === 'replace') {
            setPromptReferenceImages(new Array(Math.max(60, newPrompts.length)).fill([]));
        }

        // If JSON has embedded base64 reference images, automatically add them into scene/context reference photos
        if (embeddedReferences && embeddedReferences.length > 0) {
            setSubjectImages(prev => {
                const combined = [...prev, ...embeddedReferences];
                return combined.slice(0, 100);
            });
        }

        setNumberOfVariations(totalCount);
        setPromptMode('multiple');
    }, []);

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    // Sync number of variations with multiple prompts automatically (only when not in solo single prompt mode)
    useEffect(() => {
        if (promptMode === 'multiple' && soloPromptIndex === null) {
            const lastFilledIndex = [...multiplePrompts].reverse().findIndex(p => p.trim() !== '');
            if (lastFilledIndex !== -1) {
                const actualIndex = multiplePrompts.length - 1 - lastFilledIndex;
                if (actualIndex + 1 > numberOfVariations) {
                    setNumberOfVariations(actualIndex + 1);
                }
            }
        }
    }, [multiplePrompts, promptMode, numberOfVariations, soloPromptIndex]);

    const handleGenerateAd = useCallback(async () => {
        if (!canGenerate) {
            setError('Please upload an image or provide a detailed description to generate an ad.');
            return;
        }

        // Ensure user has hooked up their API key before running generation
        if (window.aistudio?.hasSelectedApiKey) {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey && !getCustomApiKey() && !hasServerKey) {
                    if (window.aistudio.openSelectKey) {
                        await window.aistudio.openSelectKey();
                        const nowSelected = await window.aistudio.hasSelectedApiKey();
                        setHasAiStudioKey(nowSelected);
                    }
                }
            } catch (e) {
                console.warn('Error verifying AI Studio key before generation:', e);
            }
        }

        setIsLoading(true);
        setGenerationType('image');
        setImageLoadingMessage('Starting image generation...');
        setError(null);
        setPromptErrors({});
        setGeneratedAds(null);
        setGeneratedVideo(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const backgroundPrompt = selectedBackground === 'custom' ? customBackground : selectedBackground;

        try {
            const effectiveVariationsCount = Math.max(1, numberOfVariations);

            let effectivePrompts: string[] | undefined = undefined;
            let effectivePromptIds: string[] | undefined = undefined;
            let effectivePromptFileNames: string[] | undefined = undefined;
            let effectivePromptReferenceImages: (string[] | undefined)[] | undefined = undefined;
            let effectivePromptBoxIndices: number[] | undefined = undefined;
            let countToRun = effectiveVariationsCount;

            if (promptMode === 'multiple') {
                if (soloPromptIndex !== null) {
                    // Generate batch of variations for the solo single prompt
                    const soloText = multiplePrompts[soloPromptIndex]?.trim() || '';
                    const soloId = promptIds[soloPromptIndex] || String(soloPromptIndex + 1);
                    const soloFile = promptFileNames[soloPromptIndex]?.trim() || '';
                    const soloRefs = promptReferenceImages[soloPromptIndex] || [];
                    effectivePrompts = new Array(effectiveVariationsCount).fill(soloText);
                    effectivePromptIds = new Array(effectiveVariationsCount).fill(soloId);
                    effectivePromptFileNames = new Array(effectiveVariationsCount).fill(soloFile);
                    effectivePromptReferenceImages = new Array(effectiveVariationsCount).fill(soloRefs);
                    effectivePromptBoxIndices = new Array(effectiveVariationsCount).fill(soloPromptIndex);
                    countToRun = effectiveVariationsCount;
                } else {
                    // Filter down to only enabled, non-empty prompts within the requested variation range
                    const activeIndices: number[] = [];
                    for (let i = 0; i < effectiveVariationsCount; i++) {
                        if (!disabledPrompts[i] && multiplePrompts[i]?.trim()) {
                            activeIndices.push(i);
                        }
                    }

                    // If none found within range, check any enabled prompt across all available slots
                    if (activeIndices.length === 0) {
                        for (let i = 0; i < multiplePrompts.length; i++) {
                            if (!disabledPrompts[i] && multiplePrompts[i]?.trim()) {
                                activeIndices.push(i);
                                if (activeIndices.length >= effectiveVariationsCount) break;
                            }
                        }
                    }

                    if (activeIndices.length === 0) {
                        setError('All prompts are currently disabled or empty. Please enable at least one prompt with text.');
                        setIsLoading(false);
                        return;
                    }

                    effectivePrompts = activeIndices.map(i => multiplePrompts[i].trim());
                    effectivePromptIds = activeIndices.map(i => promptIds[i] || String(i + 1));
                    effectivePromptFileNames = activeIndices.map(i => promptFileNames[i]?.trim() || '');
                    effectivePromptReferenceImages = activeIndices.map(i => promptReferenceImages[i] || []);
                    effectivePromptBoxIndices = activeIndices;
                    countToRun = activeIndices.length;
                }
            } else if (promptMode === 'guided' || promptMode === 'full') {
                const activePromptText = promptMode === 'full' ? fullPrompt : placement;
                const hasExplicitAtMention = /@[a-zA-Z0-9_\-\.]+/.test(activePromptText || '');
                const selectedFile = singlePromptFileName?.trim() || (!hasExplicitAtMention ? (productImages[0]?.name || productImage?.name) : undefined);
                if (selectedFile) {
                    effectivePromptFileNames = new Array(effectiveVariationsCount).fill(selectedFile);
                }
                if (singlePromptReferenceImages && singlePromptReferenceImages.length > 0) {
                    effectivePromptReferenceImages = new Array(effectiveVariationsCount).fill(singlePromptReferenceImages);
                }
            }

            const resultImages = await generateAdImage({
                productImage: productImage ?? undefined,
                productImages,
                competitorImages,
                subjectImages,
                modelImages,
                poseImages,
                companyLogo: companyLogo ?? undefined,
                productName,
                backgroundPrompt,
                slogan,
                placement,
                fullPrompt: promptMode === 'full' 
                    ? fullPrompt 
                    : effectivePrompts,
                promptIds: effectivePromptIds,
                promptFileNames: effectivePromptFileNames,
                promptReferenceImages: effectivePromptReferenceImages,
                promptBoxIndices: effectivePromptBoxIndices,
                soloPromptIndex: promptMode === 'multiple' ? soloPromptIndex : null,
                aspectRatio,
                negativePrompt,
                style: selectedStyle,
                mood: selectedMood,
                numberOfVariations: countToRun,
                modelType,
                imageSize,
                promptMode,
                characters,
                ...cameraSettings,
            }, controller.signal, (current, total) => {
                const promptBoxInfo = (effectivePromptBoxIndices && effectivePromptBoxIndices[current] !== undefined)
                    ? ` (Prompt #${effectivePromptBoxIndices[current] + 1})`
                    : '';
                const modelLabel = modelType === 'pro' 
                    ? 'Gemini 3 Pro (nano banana pro)' 
                    : modelType === 'nano-banana-2.1'
                        ? 'Nano Banana 2.1 (Gemini 3.6 Flash Image)'
                        : resolveImageModelName(modelType);
                setImageLoadingMessage(`Generating variation ${current + 1} of ${total}${promptBoxInfo} with ${modelLabel}...`);
            });
            setGeneratedAds(resultImages);

            const newModelsUsed: Record<number, string> = { ...promptModelsUsed };
            if (resultImages.images) {
                resultImages.images.forEach(img => {
                    const boxIdx = (effectivePromptBoxIndices && effectivePromptBoxIndices[img.variantIndex] !== undefined)
                        ? effectivePromptBoxIndices[img.variantIndex]
                        : (soloPromptIndex !== null ? soloPromptIndex : img.variantIndex);
                    newModelsUsed[boxIdx] = img.modelUsed || resolveImageModelName(modelType);
                });
            }
            if (resultImages.errors) {
                resultImages.errors.forEach(err => {
                    const boxIdx = err.promptBoxIndex !== undefined 
                        ? err.promptBoxIndex 
                        : (soloPromptIndex !== null ? soloPromptIndex : err.variantIndex);
                    newModelsUsed[boxIdx] = err.modelUsed || resolveImageModelName(modelType);
                });
            }
            setPromptModelsUsed(newModelsUsed);
            
            if (resultImages.errors && resultImages.errors.length > 0) {
                const newPromptErrors: Record<number, { message: string; specificReason?: string; modelUsed?: string }> = {};
                resultImages.errors.forEach(err => {
                    const boxIdx = err.promptBoxIndex !== undefined 
                        ? err.promptBoxIndex 
                        : (soloPromptIndex !== null ? soloPromptIndex : err.variantIndex);
                    newPromptErrors[boxIdx] = {
                        message: err.message,
                        specificReason: err.specificReason || err.message,
                        modelUsed: err.modelUsed || resolveImageModelName(modelType)
                    };
                });
                setPromptErrors(newPromptErrors);

                if (resultImages.images.length === 0) {
                    const summary = resultImages.errors.length === 1
                        ? `${resultImages.errors[0].promptTitle || `Prompt Box #${(resultImages.errors[0].promptBoxNumber || 1)}`}: ${resultImages.errors[0].specificReason || resultImages.errors[0].message}`
                        : `${resultImages.errors.length} prompt variations failed. Distinct reasons are detailed in each prompt box and in the report below.`;
                    setError(summary);
                } else {
                    setError(null);
                }
            } else {
                setPromptErrors({});
                setError(null);
            }

            if (resultImages.images.length > 0) {
                const thumbnails = await Promise.all(resultImages.images.map(img => createThumbnail(img.url)));
                const newHistoryItems = resultImages.images.map((img, i) => ({
                    thumbnail: thumbnails[i],
                    fullRes: img.url,
                    id: img.id,
                    fileName: img.fileName,
                    referenceImages: img.referenceImages
                }));
                setHistory(prev => [...newHistoryItems, ...prev].slice(0, 15));
            }

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log("Generation cancelled by user.");
                setError(null);
                setGeneratedAds(null);
                setGeneratedVideo(null);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
                console.error(err);
            }
        } finally {
            setIsLoading(false);
            setGenerationType(null);
            abortControllerRef.current = null;
        }
    }, [productImage, productImages, competitorImages, subjectImages, modelImages, poseImages, companyLogo, productName, selectedBackground, customBackground, slogan, placement, promptMode, fullPrompt, multiplePrompts, disabledPrompts, promptIds, promptFileNames, promptReferenceImages, singlePromptFileName, singlePromptReferenceImages, characters, soloPromptIndex, canGenerate, aspectRatio, negativePrompt, selectedStyle, selectedMood, numberOfVariations, hasAnyImage, cameraSettings, modelType, imageSize]);
    
    const handleGenerateVideo = useCallback(async () => {
        if (!canGenerate) {
            setError('Please provide enough details to generate a video.');
            return;
        }
        
        setIsLoading(true);
        setGenerationType('video');
        setError(null);
        setGeneratedAds(null);
        setGeneratedVideo(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;
    
        const videoMessages = ["Storyboarding your ad...", "Rendering initial frames...", "Applying visual effects...", "Compositing the scene...", "Adding final touches...", "Almost ready!"];
        let messageIndex = 0;
        setVideoLoadingMessage(videoMessages[0]);
    
        const messageInterval = setInterval(() => {
            messageIndex++;
            setVideoLoadingMessage(videoMessages[messageIndex % videoMessages.length]);
        }, 5000);
    
        const backgroundPrompt = selectedBackground === 'custom' ? customBackground : selectedBackground;
        
        const getFullPromptInternal = () => {
            if (promptMode === 'full') return fullPrompt;
            if (promptMode === 'multiple') {
                if (soloPromptIndex !== null && multiplePrompts[soloPromptIndex]?.trim()) {
                    return multiplePrompts[soloPromptIndex].trim();
                }
                const activePrompts = multiplePrompts
                    .slice(0, numberOfVariations)
                    .filter((p, i) => !disabledPrompts[i] && p.trim() !== '');
                return activePrompts.length > 0 ? activePrompts[0].trim() : undefined;
            }
            return undefined;
        };
    
        try {
            const videoBlob = await generateAdVideo({
                productImage: productImage ?? undefined, 
                productImages,
                subjectImages, 
                modelImages,
                poseImages,
                companyLogo: companyLogo ?? undefined,
                productName, 
                backgroundPrompt, 
                slogan, 
                placement, 
                fullPrompt: getFullPromptInternal(),
                videoModel,
                promptMode,
                klingKeys: { ...klingKeys, model: klingModel }
            }, controller.signal);
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideo(videoUrl);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log("Generation cancelled by user.");
                setError(null);
                setGeneratedAds(null);
                setGeneratedVideo(null);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred while generating the video.');
                console.error(err);
            }
        } finally {
            setIsLoading(false);
            clearInterval(messageInterval);
            setGenerationType(null);
            abortControllerRef.current = null;
        }
    }, [productImage, productImages, subjectImages, modelImages, poseImages, companyLogo, productName, selectedBackground, customBackground, slogan, placement, promptMode, fullPrompt, multiplePrompts, disabledPrompts, soloPromptIndex, canGenerate, videoModel, klingKeys, klingModel, numberOfVariations]);

    const handleAnimateImage = useCallback(async (image: ImageData, prompt: string, settings: VideoSettingsData, customKlingKeys?: { apiKey: string, secretKey: string, model: string }) => {
        setIsLoading(true);
        setGenerationType('video');
        setError(null);
        setGeneratedAds(null);
        setGeneratedVideo(null);

        const controller = new AbortController();
        abortControllerRef.current = controller;
    
        const videoMessages = ["Analyzing image structure...", "Planning motion paths...", "Synthesizing video frames...", "Refining cinematic quality...", "Finalizing animation...", "Almost ready!"];
        let messageIndex = 0;
        setVideoLoadingMessage(videoMessages[0]);
    
        const messageInterval = setInterval(() => {
            messageIndex++;
            setVideoLoadingMessage(videoMessages[messageIndex % videoMessages.length]);
        }, 5000);
    
        try {
            const keysToUse = customKlingKeys || { ...klingKeys, model: klingModel };
            const videoBlob = await animateImage({ image, prompt, settings, klingKeys: keysToUse }, controller.signal);
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideo(videoUrl);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log("Animation cancelled by user.");
                setError(null);
            } else {
                setError(err instanceof Error ? err.message : 'An unknown error occurred while animating the image.');
                console.error(err);
            }
        } finally {
            setIsLoading(false);
            clearInterval(messageInterval);
            setGenerationType(null);
            abortControllerRef.current = null;
        }
    }, [klingKeys, klingModel]);

    const handleEditAction = async (action: 'upscale' | 'pan' | 'zoom' | 'vary', options: any) => {
        if (!generatedAds || typeof activeAdIndex === 'undefined' || !generatedAds.images || !generatedAds.images[activeAdIndex]) return;

        setIsEditing(true);
        setError(null);

        try {
            const imageToEdit = generatedAds.images[activeAdIndex].url;
            const newImage = await editAdImage(imageToEdit, action, options);

            const newImages = [...generatedAds.images];
            newImages[activeAdIndex] = {
                ...newImages[activeAdIndex],
                url: newImage
            };
            const updatedAds = {
                ...generatedAds,
                images: newImages
            };
            setGeneratedAds(updatedAds);
            
            const thumbnail = await createThumbnail(newImage);
            setHistory(prev => [{ thumbnail, fullRes: newImage }, ...prev].slice(0, 15));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during image editing.');
            console.error(err);
        } finally {
            setIsEditing(false);
        }
    };

    const handleUpscale = () => handleEditAction('upscale', {});
    const handlePan = (direction: PanDirection) => handleEditAction('pan', { direction });
    const handleZoomIn = (level: ZoomLevel) => handleEditAction('zoom', { direction: 'in', level });
    const handleZoomOut = () => handleEditAction('zoom', { direction: 'out', level: '1.5x' });
    const handleVary = (strength: VaryStrength) => handleEditAction('vary', { strength });

    // State for renaming photos directly
    const [renameTarget, setRenameTarget] = useState<{
        category: 'Product' | 'Competitor' | 'Model' | 'Pose' | 'Scene' | 'Apparel / Gear' | 'Logo';
        index: number;
        currentName: string;
    } | null>(null);

    const handleSaveRenamedPhoto = (newName: string) => {
        if (!renameTarget) return;
        const { category, index } = renameTarget;
        if (category === 'Product') {
            setProductImages(prev => prev.map((img, i) => i === index ? { ...img, name: newName } : img));
        } else if (category === 'Competitor') {
            setCompetitorImages(prev => prev.map((img, i) => i === index ? { ...img, name: newName } : img));
        } else if (category === 'Model') {
            setModelImages(prev => prev.map((img, i) => i === index ? { ...img, name: newName } : img));
        } else if (category === 'Pose') {
            setPoseImages(prev => prev.map((img, i) => i === index ? { ...img, name: newName } : img));
        } else if (category === 'Scene' || category === 'Apparel / Gear') {
            setSubjectImages(prev => prev.map((img, i) => i === index ? { ...img, name: newName } : img));
        } else if (category === 'Logo') {
            if (companyLogo) {
                setCompanyLogo({ ...companyLogo, name: newName });
            }
        }
        const oldName = renameTarget.currentName;
        if (oldName && oldName !== newName) {
            setPromptFileNames(prev => prev.map(fn => fn === oldName ? newName : fn));
            setPromptReferenceImages(prev => prev.map(refs => refs ? refs.map(r => r === oldName ? newName : r) : []));
            setSinglePromptFileName(prev => prev === oldName ? newName : prev);
            setSinglePromptReferenceImages(prev => prev.map(r => r === oldName ? newName : r));
        }
        setRenameTarget(null);
    };

    // Aggregate all uploaded reference photos with metadata, filenames, and category styling
    const allPhotoReferences = useMemo<PhotoRefSummary[]>(() => {
        const refs: PhotoRefSummary[] = [];
        productImages.forEach((img, i) => {
            const name = img.name || `product_photo_${i + 1}.png`;
            refs.push({ 
                name, 
                category: 'Product', 
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 
                icon: '📦', 
                preview: `data:${img.mimeType};base64,${img.base64}`,
                index: i
            });
        });
        competitorImages.forEach((img, i) => {
            const name = img.name || `competitor_ref_${i + 1}.png`;
            refs.push({ 
                name, 
                category: 'Competitor', 
                badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30', 
                icon: '⚔️', 
                preview: `data:${img.mimeType};base64,${img.base64}`,
                index: i
            });
        });
        modelImages.forEach((img, i) => {
            const name = img.name || `model_character_${i + 1}.png`;
            refs.push({ 
                name, 
                category: 'Model', 
                badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30', 
                icon: '👤', 
                preview: `data:${img.mimeType};base64,${img.base64}`,
                index: i
            });
        });
        poseImages.forEach((img, i) => {
            const name = img.name || `pose_action_${i + 1}.png`;
            refs.push({ 
                name, 
                category: 'Pose', 
                badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', 
                icon: '🤸', 
                preview: `data:${img.mimeType};base64,${img.base64}`,
                index: i
            });
        });
        subjectImages.forEach((img, i) => {
            const name = img.name || `context_scene_${i + 1}.png`;
            const isApparelOrGear = /sleeve|knee|brace|apparel|gear|shoe|sneaker|wearable|strap|glove|shirt|pant|short|sock|jacket|hoodie|hat|cap|belt|vest|guard|accessory|prop|item|product/i.test(name);
            refs.push({ 
                name, 
                category: isApparelOrGear ? 'Apparel / Gear' : 'Scene', 
                badgeColor: isApparelOrGear ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30', 
                icon: isApparelOrGear ? '🎽' : '🌄', 
                preview: `data:${img.mimeType};base64,${img.base64}`,
                index: i
            });
        });
        if (companyLogo) {
            const name = companyLogo.name || 'brand_logo.png';
            refs.push({ 
                name, 
                category: 'Logo', 
                badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', 
                icon: '🏷️', 
                preview: `data:${companyLogo.mimeType};base64,${companyLogo.base64}`,
                index: 0
            });
        }
        return refs;
    }, [productImages, competitorImages, modelImages, poseImages, subjectImages, companyLogo]);

    const allPhotoNames = useMemo(() => allPhotoReferences.map(r => r.name), [allPhotoReferences]);

    const handleInsertPhotoTag = (tag: string) => {
        const cleanTag = tag.startsWith('@') ? tag : `@${tag.replace(/^\[Photo:\s*([^\]]+)\]$/i, '$1')}`;
        if (promptMode === 'guided') {
            setPlacement(prev => (prev ? `${prev} with ${cleanTag}` : `Featuring ${cleanTag}`));
        } else if (promptMode === 'full') {
            setFullPrompt(prev => (prev ? `${prev} using ${cleanTag}` : `A commercial ad featuring ${cleanTag}`));
        } else if (promptMode === 'multiple') {
            const targetIdx = soloPromptIndex !== null ? soloPromptIndex : 0;
            setMultiplePrompts(prev => {
                const next = [...prev];
                next[targetIdx] = next[targetIdx] ? `${next[targetIdx]} featuring ${cleanTag}` : `A commercial shot featuring ${cleanTag}`;
                return next;
            });
        }
    };

    const renderSinglePromptReferenceSection = (title = "Visual Reference Images") => {
        const hasAnyRefs = Boolean(singlePromptFileName || (singlePromptReferenceImages && singlePromptReferenceImages.length > 0));
        const heroRefObj = singlePromptFileName 
            ? allPhotoReferences.find(r => r.name.toLowerCase() === singlePromptFileName.toLowerCase())
            : null;

        return (
            <div className="bg-black/30 border border-white/10 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <PhotoIcon className="w-4 h-4 text-brand-accent" />
                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">
                            {title}
                        </h3>
                        <span className="text-[10px] text-gray-400 font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            {allPhotoNames.length} catalog photo{allPhotoNames.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    {hasAnyRefs && (
                        <button
                            type="button"
                            onClick={() => {
                                setSinglePromptFileName('');
                                setSinglePromptReferenceImages([]);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded bg-red-950/40 border border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer"
                        >
                            Clear References
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                        Select target photo(s) from your uploaded catalog, or type <strong className="text-cyan-300 font-mono">@</strong> in the prompt to pinpoint an exact photo reference for zero-hallucination replication.
                    </p>
                </div>

                {/* Selection Controls */}
                {allPhotoNames.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Primary Hero Selector */}
                        <div className="flex items-center gap-1.5 bg-black/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[11px] text-emerald-400 font-bold shrink-0">Primary Hero:</span>
                            <select
                                value={singlePromptFileName}
                                onChange={(e) => setSinglePromptFileName(e.target.value)}
                                className="bg-gray-800 text-gray-200 border border-emerald-500/40 rounded px-2 py-0.5 text-xs font-mono focus:ring-1 focus:ring-emerald-400 cursor-pointer max-w-[200px] truncate"
                            >
                                <option value="">(Default: 1st Product Photo)</option>
                                {allPhotoNames.map((name, pIdx) => (
                                    <option key={pIdx} value={name}>{name}</option>
                                ))}
                            </select>
                            {singlePromptFileName && (
                                <button
                                    type="button"
                                    onClick={() => setSinglePromptFileName('')}
                                    className="text-gray-400 hover:text-red-300 p-0.5 transition-colors cursor-pointer"
                                    title="Reset Hero photo to default"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Extra References Selector */}
                        <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[11px] text-cyan-400 font-bold shrink-0">+ Extra Ref:</span>
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !singlePromptReferenceImages.includes(e.target.value)) {
                                        setSinglePromptReferenceImages([...singlePromptReferenceImages, e.target.value]);
                                    }
                                }}
                                className="bg-gray-800 text-gray-200 border border-cyan-500/40 rounded px-2 py-0.5 text-xs font-mono focus:ring-1 focus:ring-cyan-400 cursor-pointer max-w-[180px] truncate"
                            >
                                <option value="" disabled>+ Add Extra Ref</option>
                                {allPhotoNames
                                    .filter(name => !singlePromptReferenceImages.includes(name) && name !== singlePromptFileName)
                                    .map((name, pIdx) => (
                                        <option key={pIdx} value={name}>{name}</option>
                                    ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="text-[11px] text-amber-300/80 bg-amber-950/30 border border-amber-500/20 p-2.5 rounded-lg">
                        No reference photos uploaded yet. Upload product, model, pose, or subject photos above to select them as references.
                    </div>
                )}

                {/* Badges and Thumbnail Strip */}
                {(singlePromptFileName || (singlePromptReferenceImages && singlePromptReferenceImages.length > 0)) && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {singlePromptFileName && (
                                <div className="flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                    <span className="truncate max-w-[180px]">Hero: @{singlePromptFileName}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleInsertPhotoTag(`@${singlePromptFileName}`)}
                                        className="text-emerald-400 hover:text-white px-1 bg-emerald-500/20 hover:bg-emerald-500/40 rounded text-[9px] cursor-pointer"
                                        title={`Insert @${singlePromptFileName} into prompt`}
                                    >
                                        @ Tag
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSinglePromptFileName('')}
                                        className="hover:text-red-300 p-0.5 ml-0.5 transition-colors cursor-pointer"
                                        title="Remove Hero photo"
                                    >
                                        <CloseIcon className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            )}
                            {singlePromptReferenceImages.map((refName, rIdx) => {
                                const isMatched = allPhotoNames.some(p => p.toLowerCase() === refName.toLowerCase() || p.toLowerCase().includes(refName.toLowerCase()) || refName.toLowerCase().includes(p.toLowerCase()));
                                return (
                                    <div
                                        key={rIdx}
                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-sm border ${
                                            isMatched
                                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                                                : 'bg-blue-950/80 text-blue-300 border-blue-500/30'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMatched ? 'bg-cyan-400' : 'bg-blue-400'}`}></span>
                                        <span className="truncate max-w-[160px]">@{refName}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleInsertPhotoTag(`@${refName}`)}
                                            className="text-cyan-400 hover:text-white px-1 bg-cyan-500/20 hover:bg-cyan-500/40 rounded text-[9px] cursor-pointer"
                                            title={`Insert @${refName} into prompt`}
                                        >
                                            @ Tag
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSinglePromptReferenceImages(singlePromptReferenceImages.filter((_, i) => i !== rIdx));
                                            }}
                                            className="hover:text-red-300 p-0.5 ml-0.5 transition-colors cursor-pointer"
                                            title="Remove reference photo"
                                        >
                                            <CloseIcon className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Visual Thumbnail Strip */}
                        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                            {singlePromptFileName && (
                                <div className="relative group shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-emerald-500 bg-black/60 shadow-md" title={`Hero: ${singlePromptFileName}`}>
                                    {heroRefObj?.preview ? (
                                        <img src={heroRefObj.preview} alt={singlePromptFileName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400 text-center p-0.5">
                                            Hero
                                        </div>
                                    )}
                                    <span className="absolute bottom-0 inset-x-0 bg-emerald-950/90 text-emerald-200 text-[8px] font-bold text-center py-0.5 uppercase tracking-wider">
                                        Hero
                                    </span>
                                </div>
                            )}
                            {singlePromptReferenceImages.map((refName, rIdx) => {
                                const refObj = allPhotoReferences.find(r => r.name.toLowerCase() === refName.toLowerCase() || r.name.toLowerCase().includes(refName.toLowerCase()) || refName.toLowerCase().includes(r.name.toLowerCase()));
                                return (
                                    <div key={rIdx} className="relative group shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-cyan-500 bg-black/60 shadow-md" title={`Ref: ${refName}`}>
                                        {refObj?.preview ? (
                                            <img src={refObj.preview} alt={refName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400 text-center p-0.5">
                                                Ref
                                            </div>
                                        )}
                                        <span className="absolute bottom-0 inset-x-0 bg-cyan-950/90 text-cyan-200 text-[8px] font-bold text-center py-0.5 uppercase tracking-wider">
                                            Ref {rIdx + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSinglePromptReferenceImages(singlePromptReferenceImages.filter((_, i) => i !== rIdx));
                                            }}
                                            className="absolute top-0.5 right-0.5 bg-black/80 hover:bg-red-600 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove"
                                        >
                                            <CloseIcon className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleGetSuggestions = async (index?: number) => {
        setIsGeneratingSuggestions(true);
        setSuggestions([]);
        setError(null);
        setSuggestionTargetIndex(typeof index === 'number' ? index : null);
        try {
            let currentPrompt = '';
            if (promptMode === 'guided') {
                currentPrompt = `Background: ${selectedBackground === 'custom' ? customBackground : selectedBackground}. Placement: ${placement}`;
            } else if (promptMode === 'full') {
                currentPrompt = fullPrompt;
            } else if (promptMode === 'multiple' && typeof index === 'number') {
                currentPrompt = multiplePrompts[index];
            }

            if (currentPrompt.trim()) {
                const result = await generateSuggestions(currentPrompt, allPhotoNames);
                setSuggestions(result);
            }
        } catch (err) {
            setError(err instanceof Error ? `Suggestion Error: ${err.message}`: 'Failed to get suggestions.');
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };

    const handleGenerateCopy = async () => {
        setIsGeneratingCopy(true);
        setAdCopy('');
        setError(null);
        try {
            let sceneDescription = '';
            if (promptMode === 'full') {
                sceneDescription = fullPrompt;
            } else if (promptMode === 'multiple') {
                if (soloPromptIndex !== null && multiplePrompts[soloPromptIndex]?.trim()) {
                    sceneDescription = multiplePrompts[soloPromptIndex].trim();
                } else {
                    const activePrompt = multiplePrompts
                        .slice(0, numberOfVariations)
                        .find((p, i) => !disabledPrompts[i] && p.trim() !== '');
                    sceneDescription = activePrompt ? activePrompt.trim() : (productName || 'the product');
                }
            } else {
                sceneDescription = `${placement}. The setting is ${selectedBackground === 'custom' ? customBackground : selectedBackground}`;
            }
            
            if (productName || slogan || sceneDescription) {
                 const result = await generateAdCopy(productName, slogan, sceneDescription, allPhotoNames);
                 setAdCopy(result);
            }
        } catch(err) {
             setError(err instanceof Error ? `Ad Copy Error: ${err.message}`: 'Failed to get ad copy.');
        } finally {
            setIsGeneratingCopy(false);
        }
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(adCopy).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const applySuggestion = (suggestion: string) => {
        if (promptMode === 'guided') {
            setPlacement(prev => `${prev} ${suggestion}`.trim());
        } else if (promptMode === 'multiple' && suggestionTargetIndex !== null) {
            setMultiplePrompts(prev => {
                const copy = [...prev];
                copy[suggestionTargetIndex] = `${copy[suggestionTargetIndex]} ${suggestion}`.trim();
                return copy;
            });
        } else {
            setFullPrompt(prev => `${prev} ${suggestion}`.trim());
        }
        setSuggestions([]);
        setSuggestionTargetIndex(null);
    };

    const handleClearHistory = useCallback(() => {
        setHistory([]);
        setGeneratedAds(null);
        setGeneratedVideo(null);
        setActiveAdIndex(0);
        storage.removeItem('adgen-history').catch(console.error);
        storage.removeItem('adgen-current-ads').catch(console.error);
        storage.removeItem('adgen-active-index').catch(console.error);
    }, []);

    return (
        <div className="min-h-screen bg-[#080710] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#13112c] via-[#080710] to-[#040409] text-brand-light font-sans relative overflow-x-hidden">
            {/* Ambient Background Grid & Glows */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[300px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-[600px] -left-[100px] w-[300px] h-[300px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="container mx-auto p-4 md:p-8 relative">
                {/* Header Navbar */}
                <header className="relative flex flex-col md:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-accent/10 border border-brand-accent/20 rounded-xl shadow-inner text-brand-accent animate-pulse-fast">
                            <CameraIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-extrabold text-white tracking-tight">
                                    AdCraft Studio
                                </h1>
                                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-brand-accent border border-indigo-500/30 rounded-full">v2.5 Pro</span>
                                <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    Active
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium">Professional AI product & creative ad engine</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            id="btn-select-paid-account"
                            onClick={handleOpenSelectKey}
                            className={`flex items-center gap-2 px-3.5 py-1.5 border font-extrabold rounded-xl transition-all duration-300 text-xs shadow-lg group cursor-pointer ${
                                (hasAiStudioKey || hasServerKey)
                                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/35 hover:to-teal-500/35 border-emerald-500/50 text-emerald-300 hover:text-white'
                                    : customKeyInput
                                        ? 'bg-gradient-to-r from-indigo-500/25 to-purple-500/25 hover:from-indigo-500/40 hover:to-purple-500/40 border-indigo-500/50 text-indigo-300 hover:text-white'
                                        : 'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 hover:from-amber-500/40 hover:to-yellow-500/40 border-amber-500/50 text-amber-300 hover:text-white'
                            }`}
                            title="Select your AI Studio API key already hooked up to the app, or change key"
                        >
                            <KeyIcon className={`w-3.5 h-3.5 ${(hasAiStudioKey || hasServerKey) ? 'text-emerald-400' : customKeyInput ? 'text-indigo-400' : 'text-amber-400'} group-hover:scale-110 transition-transform`} />
                            <span>
                                {(hasAiStudioKey || hasServerKey) 
                                    ? 'API Key Hooked Up' 
                                    : customKeyInput 
                                        ? 'Custom Key Active' 
                                        : 'Select Hooked-Up Key'}
                            </span>
                        </button>

                        <button
                            onClick={() => setIsPdfModalOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/40 text-indigo-300 hover:text-white font-semibold rounded-xl transition-all duration-300 text-xs shadow-lg group"
                        >
                            <SparklesIcon className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span>Application PDF Guide</span>
                        </button>

                        <button
                            id="btn-swap-character-studio"
                            onClick={() => openCharacterSwapStudio()}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-fuchsia-600/35 to-purple-600/35 hover:from-fuchsia-600/55 hover:to-purple-600/55 border border-fuchsia-400/50 text-fuchsia-200 hover:text-white font-bold rounded-xl transition-all duration-300 text-xs shadow-lg group cursor-pointer"
                            title="Simple Character Swap: Replace a person in one photo with a person from another photo"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5 text-fuchsia-300 group-hover:rotate-180 transition-transform duration-300" />
                            <span>Swap Character</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-fuchsia-400/20 text-fuchsia-200 border border-fuchsia-400/30 uppercase">
                                New
                            </span>
                        </button>

                        <button
                            id="btn-insert-model-into-scene"
                            onClick={() => {
                                setModelStudioMode('insert');
                                setSwapPreselect({ sceneImage: subjectImages[0] || productImages[0] || null, modelImage: modelImages[0] || null });
                                setIsModelInsertionModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/50 text-purple-200 hover:text-white font-bold rounded-xl transition-all duration-300 text-xs shadow-lg group cursor-pointer"
                            title="Insert a portrait or model photo into an original reference scene photo"
                        >
                            <UserIcon className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                            <span>Insert Model into Photo</span>
                        </button>

                        <button
                            onClick={downloadBasicAccountPdfDocument}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white font-semibold rounded-xl transition-all duration-300 text-xs shadow-md"
                            title="Download PDF Document"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download PDF</span>
                        </button>

                        <button 
                            id="btn-restart-from-historical-references"
                            onClick={() => setIsRestartModalOpen(true)}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600/25 to-teal-600/25 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/50 text-emerald-300 hover:text-white font-semibold rounded-xl transition-all duration-300 text-xs shadow-lg group cursor-pointer"
                            title="Restart program from historical session references"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
                            <span>Restart from Historical References</span>
                            {historicalSessions.length > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-emerald-400/20 text-emerald-300 rounded-full font-bold border border-emerald-500/30">
                                    {historicalSessions.length}
                                </span>
                            )}
                        </button>

                        <button 
                            id="btn-reset-everything"
                            onClick={handleReset}
                            className="flex items-center gap-2 px-3.5 py-1.5 bg-red-500/10 border border-red-500/30 hover:border-red-500 hover:bg-red-500/20 text-red-300 hover:text-red-100 font-semibold rounded-xl transition-all duration-300 text-xs group shadow-lg cursor-pointer"
                            aria-label="Reset program and purge all historical references"
                            title="Completely reset program and purge all historical references, cached images, and backend state"
                        >
                            <TrashIcon className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
                            <span>Reset Program (Wipe Everything)</span>
                        </button>
                    </div>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="bg-brand-secondary/25 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-2xl flex flex-col gap-6 animate-fade-in">
                        {/* Asset Uploader */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-brand-accent border border-indigo-500/30 shadow-sm">Step 1</span>
                                <h2 className="text-lg font-bold text-white tracking-tight">Upload Your Assets</h2>
                            </div>

                            {/* Simple Character Swap & Model Compositor Spotlight Card */}
                            <div className="mb-4 p-3.5 bg-gradient-to-r from-fuchsia-950/40 via-purple-950/40 to-black/40 border border-fuchsia-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-md">
                                <div className="flex items-center gap-2.5">
                                    <span className="p-2 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                                        <LayersIcon className="w-4 h-4 text-fuchsia-400" />
                                    </span>
                                    <div>
                                        <p className="font-bold text-white text-xs">Simple Character Swap &amp; Model Compositor</p>
                                        <p className="text-[11px] text-gray-300">
                                            Swap any person between two uploaded photos cleanly, or type <span className="font-mono text-cyan-300">Replace woman in @PhotoA with woman in @PhotoB</span> in any prompt.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => openCharacterSwapStudio()}
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold rounded-lg text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <ArrowPathIcon className="w-3.5 h-3.5" />
                                        <span>Swap Character</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModelStudioMode('insert');
                                            setSwapPreselect({ sceneImage: subjectImages[0] || productImages[0] || null, modelImage: modelImages[0] || null });
                                            setIsModelInsertionModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-purple-500/40 text-purple-200 hover:text-white font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                        <span>Insert Model</span>
                                    </button>
                                </div>
                            </div>


                            {/* Historical Session References Quick Banner if workspace empty but references exist */}
                            {allPhotoReferences.length === 0 && latestHistoricalSnapshot && (
                                <div className="mb-4 p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-md">
                                    <div className="flex items-center gap-2.5">
                                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            <ArrowPathIcon className="w-4 h-4 text-emerald-400" />
                                        </span>
                                        <div>
                                            <p className="font-semibold text-emerald-200">Historical Session References Ready</p>
                                            <p className="text-[11px] text-gray-400">
                                                Previous session includes {latestHistoricalSnapshot.summary.photoCount} reference {latestHistoricalSnapshot.summary.photoCount === 1 ? 'photo' : 'photos'} ({latestHistoricalSnapshot.summary.promptMode} mode).
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleRestartFromHistoricalSession(latestHistoricalSnapshot)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition shadow flex items-center gap-1.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                                        >
                                            <ArrowPathIcon className="w-3 h-3" />
                                            Quick Restart Session
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsRestartModalOpen(true)}
                                            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-lg text-xs transition cursor-pointer flex-1 sm:flex-initial text-center"
                                        >
                                            View Checkpoints
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await clearAllHistoricalSessions();
                                                setHistoricalSessions([]);
                                                setLatestHistoricalSnapshot(null);
                                            }}
                                            className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg text-xs transition cursor-pointer flex-1 sm:flex-initial text-center"
                                            title="Permanently remove historical checkpoints"
                                        >
                                            Dismiss & Clear
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-6">
                                {/* Company Logo */}
                                <div className="border border-gray-800 rounded-xl p-4 bg-black/10">
                                    <div className="h-44">
                                        <ImageUploader 
                                            key={companyLogo ? 'logo-img-loaded' : 'logo-img-empty'} 
                                            id="company-logo" 
                                            label="Company Brand Logo (Optional)" 
                                            onImageUpload={setCompanyLogo} 
                                            initialImage={companyLogo} 
                                        />
                                        {companyLogo && (
                                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={() => setSelectedModalImage({ src: `data:${companyLogo.mimeType};base64,${companyLogo.base64}`, alt: companyLogo.name || 'Company Logo' })}
                                                    className="text-[10px] text-brand-accent hover:underline"
                                                >
                                                    View Full Size
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRenameTarget({ category: 'Logo', index: 0, currentName: companyLogo.name || 'brand_logo.png' })}
                                                        className="text-[10px] text-gray-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                                                        title="Rename Logo file"
                                                    >
                                                        <PencilIcon className="w-2.5 h-2.5" />
                                                        <span className="truncate max-w-[120px] font-mono">{companyLogo.name || 'brand_logo.png'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickDownloadImageData(companyLogo, companyLogo.name?.replace(/\.[^/.]+$/, '') || 'Company_Logo')}
                                                        className="text-[10px] text-gray-400 hover:text-white"
                                                        title="Download Logo"
                                                    >
                                                        <DownloadIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                 {/* Product Images Section (max 30) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm font-medium text-brand-light">Product Images ({productImages.length}/30)</label>
                                            {productImages.length > 0 && (
                                                <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded font-bold">
                                                    {productImages.length} {productImages.length === 1 ? 'image' : 'images'}
                                                </span>
                                            )}
                                        </div>
                                        {productImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkDownloadModalData({
                                                        isOpen: true,
                                                        title: `Bulk Download Product Images (${productImages.length})`,
                                                        description: `Download all ${productImages.length} product photos as a packaged ZIP archive or separate files.`,
                                                        images: productImages,
                                                        defaultPrefix: productName ? `${productName.trim().replace(/\s+/g, '_')}_Product` : 'Product_Image'
                                                    })}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] font-extrabold rounded-md shadow-sm transition-all active:scale-95 border border-indigo-400/30"
                                                    title="Bulk download all product images"
                                                >
                                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                                    <span>Bulk Download ({productImages.length})</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const names = productImages.map((img, i) => img.name || `product_photo_${i + 1}.png`);
                                                        cleanupDetachedPhotos(names);
                                                        setProductImages([]);
                                                    }}
                                                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {productImages.map((image, index) => {
                                                const fileName = image.name || `product_photo_${index + 1}.png`;
                                                return (
                                                    <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                        <img 
                                                            src={`data:${image.mimeType};base64,${image.base64}`} 
                                                            alt={fileName} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                            onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: fileName })}
                                                        />
                                                        <div className="absolute top-1 right-1 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `[Photo: ${fileName}]`;
                                                                    navigator.clipboard.writeText(tag);
                                                                    handleInsertPhotoTag(tag);
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title={`Insert & copy tag [Photo: ${fileName}]`}
                                                                aria-label="Insert and copy photo tag"
                                                            >
                                                                <CopyIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenameTarget({ category: 'Product', index, currentName: fileName });
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Rename photo filename"
                                                                aria-label={`Rename product photo ${fileName}`}
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleQuickDownloadImageData(image, fileName.replace(/\.[^/.]+$/, ''));
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Download this product image"
                                                                aria-label={`Download product image ${index + 1}`}
                                                            >
                                                                <DownloadIcon className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveProductImage(index);
                                                                }} 
                                                                className="bg-black/75 hover:bg-red-600 rounded-full p-1 text-white transition-all shadow" 
                                                                title="Remove product image"
                                                                aria-label={`Remove product image ${index + 1}`}
                                                            >
                                                                <CloseIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenameTarget({ category: 'Product', index, currentName: fileName });
                                                            }}
                                                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 pt-2 z-10 text-left hover:bg-indigo-950/80 transition-colors group/name flex items-center justify-between"
                                                            title={`Click to rename ${fileName}`}
                                                        >
                                                            <p className="text-[9px] text-gray-200 group-hover/name:text-indigo-200 font-mono truncate px-0.5">
                                                                {fileName}
                                                            </p>
                                                            <PencilIcon className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 mr-1" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {productImages.length < 30 && (
                                                <div className="aspect-square">
                                                    <ImageUploader 
                                                        key={`product-uploader-${productImages.length}`} 
                                                        id="product-image-uploader" 
                                                        label="" 
                                                        onImageUpload={handleAddProductImage} 
                                                        onImagesUpload={handleAddMultipleProductImages}
                                                        multiple={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {productImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-16 gap-1">
                                                <p className="text-center text-xs text-gray-500">Upload up to 30 product images (angles, pack shots, packaging)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Competitor & Comparison Products Section (max 12) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <label className="text-sm font-medium text-brand-light flex items-center gap-1.5">
                                                <span>Competitor & Comparison Products</span>
                                                <span className="text-xs text-indigo-400 font-semibold">({competitorImages.length}/12)</span>
                                            </label>
                                            <span className="text-[10px] text-gray-400">Upload competitor products or alternative items for comparison, versus, and benchmark ads</span>
                                        </div>
                                        {competitorImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkDownloadModalData({
                                                        isOpen: true,
                                                        title: `Bulk Download Competitor Images (${competitorImages.length})`,
                                                        description: `Download all ${competitorImages.length} competitor photos as a ZIP archive or separate files.`,
                                                        images: competitorImages,
                                                        defaultPrefix: 'Competitor_Product'
                                                    })}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-md shadow-sm transition-all active:scale-95 border border-indigo-400/30"
                                                    title="Bulk download competitor images"
                                                >
                                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                                    <span>Bulk Download ({competitorImages.length})</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const names = competitorImages.map((img, i) => img.name || `competitor_ref_${i + 1}.png`);
                                                        cleanupDetachedPhotos(names);
                                                        setCompetitorImages([]);
                                                    }}
                                                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                            {competitorImages.map((image, index) => {
                                                const fileName = image.name || `competitor_ref_${index + 1}.png`;
                                                return (
                                                    <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                        <img 
                                                            src={`data:${image.mimeType};base64,${image.base64}`} 
                                                            alt={fileName} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                            onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: fileName })}
                                                        />
                                                        <div className="absolute top-1 right-1 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `[Photo: ${fileName}]`;
                                                                    navigator.clipboard.writeText(tag);
                                                                    handleInsertPhotoTag(tag);
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title={`Insert & copy tag [Photo: ${fileName}]`}
                                                                aria-label="Insert and copy photo tag"
                                                            >
                                                                <CopyIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenameTarget({ category: 'Competitor', index, currentName: fileName });
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Rename photo filename"
                                                                aria-label={`Rename competitor photo ${fileName}`}
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleQuickDownloadImageData(image, fileName.replace(/\.[^/.]+$/, ''));
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Download image"
                                                                aria-label={`Download competitor image ${index + 1}`}
                                                            >
                                                                <DownloadIcon className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveCompetitorImage(index);
                                                                }} 
                                                                className="bg-black/75 rounded-full p-1 text-white hover:bg-red-600 transition-all shadow" 
                                                                aria-label={`Remove competitor image ${index + 1}`}
                                                            >
                                                                <CloseIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenameTarget({ category: 'Competitor', index, currentName: fileName });
                                                            }}
                                                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 pt-2 z-10 text-left hover:bg-indigo-950/80 transition-colors group/name flex items-center justify-between"
                                                            title={`Click to rename ${fileName}`}
                                                        >
                                                            <p className="text-[9px] text-gray-200 group-hover/name:text-indigo-200 font-mono truncate px-0.5">
                                                                {fileName}
                                                            </p>
                                                            <PencilIcon className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 mr-1" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {competitorImages.length < 12 && (
                                                <div className="aspect-square">
                                                    <ImageUploader 
                                                        key={`competitor-uploader-${competitorImages.length}`} 
                                                        id="competitor-image-uploader" 
                                                        label="" 
                                                        onImageUpload={handleAddCompetitorImage} 
                                                        onImagesUpload={handleAddMultipleCompetitorImages}
                                                        multiple={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {competitorImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-16 gap-1">
                                                <p className="text-center text-xs text-gray-500">Upload up to 12 competitor product photos to generate side-by-side comparison or benchmark ads.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Model reference section (max 20) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-brand-light">Model & Person Photos ({modelImages.length}/20)</label>
                                        {modelImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkDownloadModalData({
                                                        isOpen: true,
                                                        title: `Bulk Download Model Photos (${modelImages.length})`,
                                                        description: `Download all ${modelImages.length} model reference photos as a ZIP archive or separate files.`,
                                                        images: modelImages,
                                                        defaultPrefix: 'Model_Photo'
                                                    })}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-md shadow-sm transition-all active:scale-95 border border-indigo-400/30"
                                                    title="Bulk download model photos"
                                                >
                                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                                    <span>Bulk Download ({modelImages.length})</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const names = modelImages.map((img, i) => img.name || `model_character_${i + 1}.png`);
                                                        cleanupDetachedPhotos(names);
                                                        setModelImages([]);
                                                    }}
                                                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {modelImages.map((image, index) => {
                                                const fileName = image.name || `model_character_${index + 1}.png`;
                                                return (
                                                    <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                        <img 
                                                            src={`data:${image.mimeType};base64,${image.base64}`} 
                                                            alt={fileName} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                            onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: fileName })}
                                                        />
                                                        <div className="absolute top-1 right-1 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `@${fileName}`;
                                                                    navigator.clipboard.writeText(tag);
                                                                    handleInsertPhotoTag(tag);
                                                                }}
                                                                className="bg-black/75 hover:bg-cyan-600 rounded-full p-1 text-white transition-all shadow"
                                                                title={`Insert & copy tag @${fileName}`}
                                                                aria-label="Insert and copy photo tag"
                                                            >
                                                                <AtSymbolIcon className="w-3 h-3 text-cyan-300" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenameTarget({ category: 'Model', index, currentName: fileName });
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Rename photo filename"
                                                                aria-label={`Rename model photo ${fileName}`}
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleQuickDownloadImageData(image, fileName.replace(/\.[^/.]+$/, ''));
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Download image"
                                                                aria-label={`Download model image ${index + 1}`}
                                                            >
                                                                <DownloadIcon className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveModelImage(index);
                                                                }} 
                                                                className="bg-black/75 rounded-full p-1 text-white hover:bg-red-600 transition-all shadow" 
                                                                aria-label={`Remove model image ${index + 1}`}
                                                            >
                                                                <CloseIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenameTarget({ category: 'Model', index, currentName: fileName });
                                                            }}
                                                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 pt-2 z-10 text-left hover:bg-indigo-950/80 transition-colors group/name flex items-center justify-between"
                                                            title={`Click to rename ${fileName}`}
                                                        >
                                                            <p className="text-[9px] text-gray-200 group-hover/name:text-indigo-200 font-mono truncate px-0.5">
                                                                {fileName}
                                                            </p>
                                                            <PencilIcon className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 mr-1" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {modelImages.length < 20 && (
                                                <div className="aspect-square">
                                                    <ImageUploader 
                                                        key={`model-uploader-${modelImages.length}`} 
                                                        id="model-image-uploader" 
                                                        label="" 
                                                        onImageUpload={handleAddModelImage} 
                                                        onImagesUpload={handleAddMultipleModelImages}
                                                        multiple={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {modelImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-16 gap-1">
                                                <p className="text-center text-xs text-gray-500">Upload up to 20 model, character, fashion, or lifestyle models.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Pose & Product Use reference section (max 15) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <label className="text-sm font-medium text-brand-light">Pose & Usage Reference Photos ({poseImages.length}/15)</label>
                                            <span className="text-[10px] text-gray-400">Guides how the model poses or interacts with your product</span>
                                        </div>
                                        {poseImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkDownloadModalData({
                                                        isOpen: true,
                                                        title: `Bulk Download Pose Reference Photos (${poseImages.length})`,
                                                        description: `Download all ${poseImages.length} pose reference photos as a ZIP archive or separate files.`,
                                                        images: poseImages,
                                                        defaultPrefix: 'Pose_Reference'
                                                    })}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-md shadow-sm transition-all active:scale-95 border border-indigo-400/30"
                                                    title="Bulk download pose reference photos"
                                                >
                                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                                    <span>Bulk Download ({poseImages.length})</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const names = poseImages.map((img, i) => img.name || `pose_action_${i + 1}.png`);
                                                        cleanupDetachedPhotos(names);
                                                        setPoseImages([]);
                                                    }}
                                                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {poseImages.map((image, index) => {
                                                const fileName = image.name || `pose_action_${index + 1}.png`;
                                                return (
                                                    <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                        <img 
                                                            src={`data:${image.mimeType};base64,${image.base64}`} 
                                                            alt={fileName} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                            onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: fileName })}
                                                        />
                                                        <div className="absolute top-1 right-1 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `@${fileName}`;
                                                                    navigator.clipboard.writeText(tag);
                                                                    handleInsertPhotoTag(tag);
                                                                }}
                                                                className="bg-black/75 hover:bg-cyan-600 rounded-full p-1 text-white transition-all shadow"
                                                                title={`Insert & copy tag @${fileName}`}
                                                                aria-label="Insert and copy photo tag"
                                                            >
                                                                <AtSymbolIcon className="w-3 h-3 text-cyan-300" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenameTarget({ category: 'Pose', index, currentName: fileName });
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Rename photo filename"
                                                                aria-label={`Rename pose reference photo ${fileName}`}
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleQuickDownloadImageData(image, fileName.replace(/\.[^/.]+$/, ''));
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Download image"
                                                                aria-label={`Download pose image ${index + 1}`}
                                                            >
                                                                <DownloadIcon className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemovePoseImage(index);
                                                                }} 
                                                                className="bg-black/75 rounded-full p-1 text-white hover:bg-red-600 transition-all shadow" 
                                                                aria-label={`Remove pose reference image ${index + 1}`}
                                                            >
                                                                <CloseIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenameTarget({ category: 'Pose', index, currentName: fileName });
                                                            }}
                                                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 pt-2 z-10 text-left hover:bg-indigo-950/80 transition-colors group/name flex items-center justify-between"
                                                            title={`Click to rename ${fileName}`}
                                                        >
                                                            <p className="text-[9px] text-gray-200 group-hover/name:text-indigo-200 font-mono truncate px-0.5">
                                                                {fileName}
                                                            </p>
                                                            <PencilIcon className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 mr-1" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {poseImages.length < 15 && (
                                                <div className="aspect-square">
                                                    <ImageUploader 
                                                        key={`pose-uploader-${poseImages.length}`} 
                                                        id="pose-image-uploader" 
                                                        label="" 
                                                        onImageUpload={handleAddPoseImage} 
                                                        onImagesUpload={handleAddMultiplePoseImages}
                                                        multiple={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {poseImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-16 gap-1">
                                                <p className="text-center text-xs text-gray-500">Upload up to 15 pose, product-use, holding angles, or action-guiding reference photos.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Subject/Context Images Section (max 100) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-brand-light">Context/Lifestyle/Setting Images ({subjectImages.length}/100)</label>
                                        {subjectImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkDownloadModalData({
                                                        isOpen: true,
                                                        title: `Bulk Download Context/Lifestyle Images (${subjectImages.length})`,
                                                        description: `Download all ${subjectImages.length} context and setting reference images as a ZIP archive or separate files.`,
                                                        images: subjectImages,
                                                        defaultPrefix: 'Context_Lifestyle'
                                                    })}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold rounded-md shadow-sm transition-all active:scale-95 border border-indigo-400/30"
                                                    title="Bulk download context and lifestyle images"
                                                >
                                                    <ArchiveIcon className="w-3.5 h-3.5" />
                                                    <span>Bulk Download ({subjectImages.length})</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const names = subjectImages.map((img, i) => img.name || `context_scene_${i + 1}.png`);
                                                        cleanupDetachedPhotos(names);
                                                        setSubjectImages([]);
                                                    }}
                                                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {subjectImages.map((image, index) => {
                                                const fileName = image.name || `context_scene_${index + 1}.png`;
                                                return (
                                                    <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                        <img 
                                                            src={`data:${image.mimeType};base64,${image.base64}`} 
                                                            alt={fileName} 
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                            onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: fileName })}
                                                        />
                                                        <div className="absolute top-1 right-1 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `@${fileName}`;
                                                                    navigator.clipboard.writeText(tag);
                                                                    handleInsertPhotoTag(tag);
                                                                }}
                                                                className="bg-black/75 hover:bg-cyan-600 rounded-full p-1 text-white transition-all shadow"
                                                                title={`Insert & copy tag @${fileName}`}
                                                                aria-label="Insert and copy photo tag"
                                                            >
                                                                <AtSymbolIcon className="w-3 h-3 text-cyan-300" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenameTarget({ category: 'Scene', index, currentName: fileName });
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Rename photo filename"
                                                                aria-label={`Rename context photo ${fileName}`}
                                                            >
                                                                <PencilIcon className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleQuickDownloadImageData(image, fileName.replace(/\.[^/.]+$/, ''));
                                                                }}
                                                                className="bg-black/75 hover:bg-indigo-600 rounded-full p-1 text-white transition-all shadow"
                                                                title="Download image"
                                                                aria-label={`Download subject image ${index + 1}`}
                                                            >
                                                                <DownloadIcon className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveSubjectImage(index);
                                                                }} 
                                                                className="bg-black/75 rounded-full p-1 text-white hover:bg-red-600 transition-all shadow" 
                                                                aria-label={`Remove subject image ${index + 1}`}
                                                            >
                                                                <CloseIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenameTarget({ category: 'Scene', index, currentName: fileName });
                                                            }}
                                                            className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-1 pt-2 z-10 text-left hover:bg-indigo-950/80 transition-colors group/name flex items-center justify-between"
                                                            title={`Click to rename ${fileName}`}
                                                        >
                                                            <p className="text-[9px] text-gray-200 group-hover/name:text-indigo-200 font-mono truncate px-0.5">
                                                                {fileName}
                                                            </p>
                                                            <PencilIcon className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover/name:opacity-100 transition-opacity flex-shrink-0 mr-1" />
                                                        </button>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {subjectImages.length < 100 && (
                                                <div className="aspect-square">
                                                    <ImageUploader 
                                                        key={`subject-uploader-${subjectImages.length}`} 
                                                        id="subject-image-uploader" 
                                                        label="" 
                                                        onImageUpload={handleAddSubjectImage} 
                                                        onImagesUpload={handleAddMultipleSubjectImages}
                                                        multiple={true}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {subjectImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-16 gap-1">
                                                <p className="text-center text-xs text-gray-500">Upload up to 100 lifestyle, settings, and other context reference photos.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ad Description */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-brand-accent border border-indigo-500/30 shadow-sm">Step 2</span>
                                <h2 className="text-lg font-bold text-white tracking-tight">Describe Your Ad</h2>
                            </div>
                            <SloganGenerator productName={productName} onProductNameChange={setProductName} slogan={slogan} onSloganChange={setSlogan} onGenerateSlogans={generateSlogans} />
                        </div>
                        
                        {/* Ad Copy */}
                        <div className="space-y-3 bg-black/20 border border-white/5 p-4 rounded-xl">
                             <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Generate Ad Copy (Optional)</h3>
                                <button onClick={handleGenerateCopy} disabled={isGeneratingCopy || !canGenerate} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent/90 text-brand-primary font-extrabold rounded-xl transition-all hover:shadow-[0_0_12px_rgba(129,140,248,0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:bg-gray-850 disabled:text-gray-500 disabled:cursor-not-allowed text-[11px]">
                                    <SparklesIcon className="w-3.5 h-3.5 animate-pulse" />
                                    {isGeneratingCopy ? 'Writing copy...' : 'Generate AI Copy'}
                                </button>
                            </div>
                            <div className="relative">
                                <textarea value={adCopy} readOnly placeholder="Generate compelling, high-converting ad copy to match your visuals..." className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl h-24 resize-none pr-10 text-xs text-gray-300 placeholder-gray-500 focus:outline-none" />
                                {adCopy && (
                                    <button onClick={handleCopyToClipboard} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors" aria-label="Copy to clipboard">
                                        <CopyIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {copySuccess && <p className="text-xs text-green-400 text-center animate-fade-in font-medium">Copied to clipboard!</p>}
                        </div>


                        {/* Scene Crafting */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-brand-accent border border-indigo-500/30 shadow-sm">Step 3</span>
                                <h2 className="text-lg font-bold text-white tracking-tight">Craft Your Scene</h2>
                            </div>

                            {/* Reference Photo Catalog Bar */}
                            {allPhotoReferences.length > 0 && (
                                <div className="mb-4">
                                    <PhotoReferenceCatalogBar 
                                        references={allPhotoReferences}
                                        onInsertTag={handleInsertPhotoTag}
                                        onRename={(category, index, currentName) => setRenameTarget({ category, index, currentName })}
                                        onOpenHistoricalSessions={() => setIsRestartModalOpen(true)}
                                        onOpenCharacterSwap={() => openCharacterSwapStudio()}
                                        onOpenModelInsertion={() => {
                                            setModelStudioMode('insert');
                                            setSwapPreselect({ sceneImage: subjectImages[0] || productImages[0] || null, modelImage: modelImages[0] || null });
                                            setIsModelInsertionModalOpen(true);
                                        }}
                                        currentMode={promptMode}
                                        activeVariationIndex={soloPromptIndex}
                                    />
                                </div>
                            )}

                            {/* Universal Character Cast & Identity Grounding Bar */}
                            <div className="mb-4 p-3 bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-black/40 border border-amber-500/40 rounded-xl flex flex-col gap-2.5 text-xs shadow-md animate-fade-in">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                            <UserIcon className="w-4 h-4 text-amber-400" />
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-white text-xs">Character Demographics & Identity Grounding</span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                    Anti-Whitewashing Active ({characters.filter(c => c.isLocked).length} Locked)
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-300 mt-0.5">
                                                Zero-whitewashing & demographic fidelity for all characters. Any character mentioned in prompts or references will strictly match their established racial identity.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setIsCharacterModalOpen(true)}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                        >
                                            <PencilIcon className="w-3 h-3 text-amber-300" />
                                            <span>Manage Cast ({characters.length})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCharacterModalOpen(true)}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 transition-all shadow-sm shadow-amber-500/20 cursor-pointer active:scale-95"
                                        >
                                            <span>+ Add Character</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Active Character Pills Row */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Cast:</span>
                                    {characters.map(char => (
                                        <button
                                            key={char.id}
                                            type="button"
                                            onClick={() => setIsCharacterModalOpen(true)}
                                            title={`Click to edit ${char.name}'s identity lock`}
                                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                                                char.isLocked 
                                                    ? 'bg-amber-950/50 hover:bg-amber-900/60 border-amber-500/40 text-amber-200 shadow-xs' 
                                                    : 'bg-black/40 hover:bg-black/60 border-white/10 text-gray-400'
                                            }`}
                                        >
                                            <span className="font-bold text-white font-mono">{char.name}</span>
                                            <span className="text-[10px] text-amber-300 font-medium">({char.ethnicity})</span>
                                            {char.isLocked ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            ) : (
                                                <span className="text-[9px] text-gray-500">(Unlocked)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide">

                                <button 
                                    onClick={() => setPromptMode('guided')} 
                                    className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'guided' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} 
                                    aria-pressed={promptMode === 'guided'}
                                >
                                    Guided Mode
                                </button>
                                <button 
                                    onClick={() => setPromptMode('full')} 
                                    className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'full' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} 
                                    aria-pressed={promptMode === 'full'}
                                >
                                    Full Prompt
                                </button>
                                <button 
                                    onClick={() => setPromptMode('multiple')} 
                                    className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'multiple' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} 
                                    aria-pressed={promptMode === 'multiple'}
                                >
                                    Multiple Prompts
                                </button>
                            </div>

                            {promptMode === 'guided' && (
                                <div className="space-y-6 animate-fade-in">
                                    {/* Model Tag Bar */}
                                    <div className="flex items-center justify-between bg-black/40 border border-white/10 px-3.5 py-2 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-300">Target AI Model:</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                {modelType === 'pro' ? 'PRO • gemini-3-pro-image' : modelType === 'nano-banana-2.1' ? 'Nano Banana 2.1 • gemini-nano-banana-2.1' : resolveImageModelName(modelType)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono">Resolution: {imageSize}</span>
                                    </div>

                                    {error && (
                                        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex flex-col gap-1.5 shadow-sm animate-fade-in">
                                            <div className="flex items-center justify-between text-red-300 font-bold text-xs">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                    Guided Mode Error
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setError(null)}
                                                    className="text-red-400 hover:text-red-200 text-[10px] underline cursor-pointer"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                            <div className="text-xs text-red-200/90 leading-relaxed">
                                                <span className="font-bold text-red-300">Specifically Why: </span>
                                                <span className="font-mono text-[11px] text-red-100 break-words">{error}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 pt-1.5 border-t border-red-500/20">
                                                <span>Model Attempted:</span>
                                                <span className="text-purple-300 font-bold">{modelType === 'pro' ? 'gemini-3-pro-image (PRO)' : modelType === 'nano-banana-2.1' ? 'gemini-nano-banana-2.1 (Nano Banana 2.1 / 3.6)' : resolveImageModelName(modelType)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">3a. Select a Background</h3>
                                        <BackgroundSelector selected={selectedBackground} onSelect={setSelectedBackground} custom={customBackground} onCustomChange={setCustomBackground}/>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2.5">
                                            <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">3b. Describe Placement</h3>
                                            <button onClick={() => handleGetSuggestions()} disabled={isGeneratingSuggestions || (!placement && !customBackground)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-brand-accent/15 text-brand-accent font-extrabold rounded-lg hover:bg-brand-accent hover:text-brand-primary disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all border border-brand-accent/20" aria-label="Get AI suggestions for placement"><SparklesIcon className="w-3.5 h-3.5" />{isGeneratingSuggestions ? 'Thinking...' : 'AI Suggestions'}</button>
                                        </div>
                                        <PromptMentionTextarea 
                                            value={placement} 
                                            onChange={(val) => { setPlacement(val); if (error) setError(null); }} 
                                            placeholder="e.g., Replace woman in @Frame-03.png with woman in @frame-01N.webp..." 
                                            allPhotoReferences={allPhotoReferences}
                                            onOpenSwapStudio={openCharacterSwapStudio}
                                            characters={characters}
                                            rows={4}
                                            className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-brand-accent focus:border-brand-accent/80 transition-all resize-none text-xs text-gray-300 placeholder-gray-500" 
                                        />
                                        {suggestions.length > 0 && <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">{suggestions.map((s, i) => (<button key={i} onClick={() => applySuggestion(s)} className="px-3 py-1 text-[10px] font-semibold bg-brand-accent/5 border border-brand-accent/20 rounded-full hover:bg-brand-accent hover:text-brand-primary transition-all text-brand-light">+ "{s}"</button>))}</div>}
                                    </div>

                                    {/* Visual Reference Images Selector */}
                                    {renderSinglePromptReferenceSection("3c. Visual Reference Images (Hero & Extra References)")}

                                    {/* Single Prompt Variations Batch Selector */}
                                    <div className="bg-black/30 border border-white/10 p-3.5 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                                <SparklesIcon className="w-3.5 h-3.5 text-brand-accent" />
                                                Single Prompt Variations Batch:
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                                No limit (60+ supported)
                                            </span>
                                        </div>
                                        <VariationSelector 
                                            selected={numberOfVariations} 
                                            onSelect={setNumberOfVariations} 
                                            maxCount={Math.max(100, numberOfVariations)} 
                                        />
                                    </div>
                                </div>
                            )}

                            {promptMode === 'full' && (
                                <div className="animate-fade-in space-y-4">
                                    {/* Model Tag Bar */}
                                    <div className="flex items-center justify-between bg-black/40 border border-white/10 px-3.5 py-2 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-300">Target AI Model:</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                {modelType === 'pro' ? 'PRO • gemini-3-pro-image' : modelType === 'nano-banana-2.1' ? 'Nano Banana 2.1 • gemini-nano-banana-2.1' : resolveImageModelName(modelType)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono">Resolution: {imageSize}</span>
                                    </div>

                                    {error && (
                                         <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex flex-col gap-1.5 shadow-sm animate-fade-in">
                                            <div className="flex items-center justify-between text-red-300 font-bold text-xs">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                    Full Custom Prompt Box Error
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setError(null)}
                                                    className="text-red-400 hover:text-red-200 text-[10px] underline cursor-pointer"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                            <div className="text-xs text-red-200/90 leading-relaxed">
                                                <span className="font-bold text-red-300">Specifically Why: </span>
                                                <span className="font-mono text-[11px] text-red-100 break-words">{error}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 pt-1.5 border-t border-red-500/20">
                                                <span>Model Attempted:</span>
                                                <span className="text-purple-300 font-bold">{modelType === 'pro' ? 'gemini-3-pro-image (PRO)' : modelType === 'nano-banana-2.1' ? 'gemini-nano-banana-2.1 (Nano Banana 2.1 / 3.6)' : resolveImageModelName(modelType)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex justify-between items-center mb-2.5">
                                            <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Describe the entire scene</h3>
                                            <button onClick={() => handleGetSuggestions()} disabled={isGeneratingSuggestions || !fullPrompt} className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-brand-accent/15 text-brand-accent font-extrabold rounded-lg hover:bg-brand-accent hover:text-brand-primary disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all border border-brand-accent/20" aria-label="Get AI suggestions for full prompt"><SparklesIcon className="w-3.5 h-3.5" />{isGeneratingSuggestions ? 'Thinking...' : 'AI Suggestions'}</button>
                                        </div>
                                        <PromptMentionTextarea 
                                            value={fullPrompt} 
                                            onChange={(val) => { setFullPrompt(val); if (error) setError(null); }} 
                                            placeholder="e.g., Replace woman in @Frame-03.png with woman in @frame-01N.webp..." 
                                            allPhotoReferences={allPhotoReferences}
                                            onOpenSwapStudio={openCharacterSwapStudio}
                                            characters={characters}
                                            rows={6}
                                            className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-brand-accent focus:border-brand-accent/80 transition-all resize-none text-xs text-gray-300 placeholder-gray-500" 
                                        />
                                        {suggestions.length > 0 && <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">{suggestions.map((s, i) => (<button key={i} onClick={() => applySuggestion(s)} className="px-3 py-1 text-[10px] font-semibold bg-brand-accent/5 border border-brand-accent/20 rounded-full hover:bg-brand-accent hover:text-brand-primary transition-all text-brand-light">+ "{s}"</button>))}</div>}
                                    </div>

                                    {/* Visual Reference Images Selector */}
                                    {renderSinglePromptReferenceSection("Visual Reference Images (Hero & Extra References)")}

                                    {/* Single Prompt Variations Batch Selector */}
                                    <div className="bg-black/30 border border-white/10 p-3.5 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                                <SparklesIcon className="w-3.5 h-3.5 text-brand-accent" />
                                                Single Prompt Variations Batch:
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                                No limit (60+ supported)
                                            </span>
                                        </div>
                                        <VariationSelector 
                                            selected={numberOfVariations} 
                                            onSelect={setNumberOfVariations} 
                                            maxCount={Math.max(100, numberOfVariations)} 
                                        />
                                    </div>
                                </div>
                            )}

                                {promptMode === 'multiple' && (
                                    <div className="animate-fade-in space-y-6">
                                        <JsonPromptUploader 
                                            onPromptsLoaded={handlePromptsLoaded} 
                                            currentPrompts={multiplePrompts} 
                                            currentPromptIds={promptIds}
                                            currentPromptFileNames={promptFileNames}
                                            currentPromptReferenceImages={promptReferenceImages}
                                            currentDisabledPrompts={disabledPrompts}
                                        />

                                        {/* Solo Mode Banner */}
                                        {soloPromptIndex !== null && (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-fade-in space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                                                            <BoltIcon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-amber-300">
                                                                Single Prompt Solo Mode Active &bull; Prompt #{soloPromptIndex + 1}
                                                            </div>
                                                            <div className="text-[11px] text-amber-200/80 line-clamp-1">
                                                                {multiplePrompts[soloPromptIndex]?.trim() || '(Empty Prompt Text)'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={handleEnableAllPrompts}
                                                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors border border-amber-500/30 shrink-0 cursor-pointer"
                                                    >
                                                        Enable All Prompts
                                                    </button>
                                                </div>

                                                <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <span className="text-[11px] font-bold text-amber-200">
                                                        Variations Batch for Prompt #{soloPromptIndex + 1} (No limit, 60+ supported):
                                                    </span>
                                                    <VariationSelector 
                                                        selected={numberOfVariations} 
                                                        onSelect={setNumberOfVariations} 
                                                        maxCount={Math.max(100, numberOfVariations)} 
                                                        compact={true}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Prompt Management Bar & Quick Single Prompt Selector */}
                                        <div className="bg-brand-primary/40 border border-white/10 p-4 rounded-xl space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                                                        Prompt Selection & Batch Controls
                                                        {soloPromptIndex === null && (
                                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent font-semibold border border-brand-accent/20">
                                                                {multiplePrompts.slice(0, numberOfVariations).filter((p, i) => !disabledPrompts[i] && p.trim() !== '').length} active for run
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 font-bold border border-purple-500/40 flex items-center gap-1 font-mono">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                            Model: {modelType === 'pro' ? 'gemini-3-pro-image (PRO)' : modelType === 'nano-banana-2.1' ? 'gemini-nano-banana-2.1 (Nano Banana 2.1)' : resolveImageModelName(modelType)}
                                                        </span>
                                                    </h3>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        Select a single prompt to solo and generate unlimited variations (60+ supported), or run a multi-prompt batch across the collection.
                                                    </p>
                                                </div>

                                                {/* Action buttons & Layout Orientation Switcher */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Layout Orientation Switcher */}
                                                    <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5 shrink-0 shadow-inner">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMultipromptOrientation('grid');
                                                                try { localStorage.setItem('multiprompt_orientation', 'grid'); } catch {}
                                                            }}
                                                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                                multipromptOrientation === 'grid'
                                                                    ? 'bg-brand-accent text-brand-primary font-bold shadow'
                                                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                            }`}
                                                            title="2-Column Side-by-Side Grid Orientation"
                                                        >
                                                            <Squares2X2Icon className="w-3.5 h-3.5" />
                                                            <span>2-Col Grid</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMultipromptOrientation('stack');
                                                                try { localStorage.setItem('multiprompt_orientation', 'stack'); } catch {}
                                                            }}
                                                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                                multipromptOrientation === 'stack'
                                                                    ? 'bg-brand-accent text-brand-primary font-bold shadow'
                                                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                            }`}
                                                            title="1-Column Full-Width Stacked Orientation (Spacious layout, no crowding)"
                                                        >
                                                            <ListBulletIcon className="w-3.5 h-3.5" />
                                                            <span>1-Col Stacked</span>
                                                        </button>
                                                    </div>

                                                    {disabledPrompts.some(d => d) || soloPromptIndex !== null ? (

                                                        <button
                                                            onClick={handleEnableAllPrompts}
                                                            className="text-xs px-2.5 py-1.5 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 font-bold rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer"
                                                            title="Enable all prompt variations"
                                                        >
                                                            <EyeIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                            Enable All
                                                        </button>
                                                    ) : null}

                                                    {disabledPrompts.some(d => !d) ? (
                                                        <button
                                                            onClick={handleDisableAllPrompts}
                                                            className="text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg transition-colors border border-white/10 flex items-center gap-1.5 cursor-pointer"
                                                            title="Disable all prompt variations without deleting them"
                                                        >
                                                            <EyeSlashIcon className="w-3.5 h-3.5 text-gray-400" />
                                                            Disable All
                                                        </button>
                                                    ) : null}

                                                    <button
                                                        onClick={handleInvertDisabledPrompts}
                                                        className="text-xs px-2 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-gray-200 font-bold rounded-lg transition-colors border border-white/5 flex items-center gap-1 cursor-pointer"
                                                        title="Invert enabled/disabled state for all prompts"
                                                    >
                                                        Invert
                                                    </button>

                                                    {(promptFileNames.some(fn => !!fn) || promptReferenceImages.some(refs => refs && refs.length > 0)) && (
                                                        <button
                                                            type="button"
                                                            onClick={handleClearAllMultipromptReferences}
                                                            className="text-xs px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 hover:text-white font-bold rounded-lg transition-colors border border-red-500/30 flex items-center gap-1 cursor-pointer"
                                                            title="Detach and clear all attached files and reference images across all multiprompt slots"
                                                        >
                                                            <CloseIcon className="w-3.5 h-3.5" />
                                                            Clear References
                                                        </button>
                                                    )}

                                                    <button 
                                                        type="button"
                                                        onClick={handleClearAllMultiprompt}
                                                        className="text-xs text-gray-400 hover:text-red-400 font-bold transition-colors flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-white/5 cursor-pointer"
                                                        title="Reset all prompt slots, attached files, and reference images"
                                                    >
                                                        <CloseIcon className="w-3.5 h-3.5" />
                                                        Clear All
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Single Prompt Selector Dropdown */}
                                            <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
                                                <label className="text-xs font-semibold text-gray-300 flex-shrink-0 flex items-center gap-1.5">
                                                    <BoltIcon className="w-3.5 h-3.5 text-amber-400" />
                                                    Quick Solo Select:
                                                </label>
                                                <div className="relative flex-1">
                                                    <select
                                                        value={soloPromptIndex !== null ? soloPromptIndex : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '') {
                                                                setSoloPromptIndex(null);
                                                            } else {
                                                                const idx = parseInt(val, 10);
                                                                handleDisableOtherPrompts(idx);
                                                            }
                                                        }}
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 focus:ring-1 focus:ring-brand-accent focus:border-brand-accent appearance-none pr-8 cursor-pointer"
                                                    >
                                                        <option value="">— All Enabled Prompts ({multiplePrompts.slice(0, numberOfVariations).filter((p, i) => !disabledPrompts[i] && p.trim() !== '').length} active) —</option>
                                                        {multiplePrompts.map((prompt, idx) => {
                                                            const hasContent = prompt.trim() !== '';
                                                            const preview = hasContent 
                                                                ? `Prompt ${idx + 1}: ${prompt.trim().slice(0, 45)}${prompt.trim().length > 45 ? '...' : ''}` 
                                                                : `Prompt ${idx + 1} (Empty)`;
                                                            return (
                                                                <option key={idx} value={idx}>
                                                                    {preview}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Variations Count Selector */}
                                        <div className="bg-brand-primary/30 border border-brand-accent/20 p-4 rounded-xl">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-sm font-bold text-brand-accent">
                                                        {soloPromptIndex !== null 
                                                            ? `Single Prompt Variations Batch for Prompt #${soloPromptIndex + 1}`
                                                            : 'Number of Variations Batch'
                                                        }
                                                    </h3>
                                                    <div className="text-[11px] text-gray-400">
                                                        {soloPromptIndex !== null
                                                            ? 'Select how many variation images (no limit, 60+ supported) to generate for this soloed prompt.'
                                                            : 'Sets how many active slots from the list below will be sent for generation (no limit, 60+ supported).'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <VariationSelector 
                                                selected={numberOfVariations} 
                                                onSelect={setNumberOfVariations} 
                                                maxCount={Math.max(100, numberOfVariations, multiplePrompts.length)}
                                            />
                                        </div>

                                        {/* Multi-Prompt Errors Summary Banner */}
                                        {Object.keys(promptErrors).length > 0 && (
                                            <div className="p-3.5 mb-2 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center justify-between shadow-lg animate-fade-in">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex h-2.5 w-2.5 relative">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                    </span>
                                                    <div>
                                                        <span className="font-bold text-red-300">
                                                            {Object.keys(promptErrors).length} Prompt Box{Object.keys(promptErrors).length > 1 ? 'es' : ''} Encountered Errors:
                                                        </span>{' '}
                                                        <span className="text-red-200/90">
                                                            {Object.keys(promptErrors).map(k => `Prompt #${Number(k) + 1}`).join(', ')}. Review the specific reason on each highlighted card below.
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPromptErrors({})}
                                                    className="text-[11px] font-semibold text-red-300 hover:text-white px-2 py-1 bg-red-900/50 hover:bg-red-800/60 rounded border border-red-500/30 transition-colors whitespace-nowrap ml-2 cursor-pointer"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}

                                        {/* Individual Prompts Grid / Stack */}
                                        <div className={
                                            multipromptOrientation === 'stack'
                                                ? "flex flex-col gap-4"
                                                : "grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch"
                                        }>
                                            {Array.from({ length: Math.max(40, multiplePrompts.length, numberOfVariations) }).map((_, index) => {
                                                const inVariationRange = index < numberOfVariations;
                                                const isSolo = soloPromptIndex === index;
                                                const isDisabled = soloPromptIndex !== null ? !isSolo : disabledPrompts[index];
                                                const isActive = inVariationRange && !isDisabled;
                                                const hasText = multiplePrompts[index]?.trim() !== '';
                                                const hasError = !!promptErrors[index];

                                                return (
                                                    <div 
                                                        key={index} 
                                                        className={`relative group flex flex-col justify-between transition-all duration-200 rounded-xl border-2 min-w-0 overflow-hidden ${
                                                            hasError
                                                                ? 'bg-red-950/30 border-red-500 ring-2 ring-red-500/40 shadow-lg shadow-red-500/10'
                                                                : isSolo
                                                                    ? 'bg-amber-500/5 border-amber-400 ring-2 ring-amber-400/20 shadow-lg shadow-amber-500/5'
                                                                    : isDisabled
                                                                        ? 'bg-black/30 border-gray-800/80 opacity-50'
                                                                        : isActive
                                                                            ? 'bg-brand-primary/40 border-brand-accent/50 shadow-md'
                                                                            : 'bg-black/20 border-gray-700/40 opacity-70 hover:opacity-90'
                                                        }`}
                                                    >
                                                        {/* Number & Status Badges Header */}
                                                        <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-white/5 gap-2 bg-black/20 min-w-0">
                                                            {/* Left: Number, Title, ID, Model, and Status Badges */}
                                                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold shadow ${
                                                                    hasError
                                                                        ? 'bg-red-500 text-white font-extrabold'
                                                                        : isSolo 
                                                                            ? 'bg-amber-400 text-black font-extrabold' 
                                                                            : isDisabled 
                                                                                ? 'bg-gray-800 text-gray-400' 
                                                                                : isActive 
                                                                                    ? 'bg-brand-accent text-brand-primary font-extrabold' 
                                                                                    : 'bg-gray-700 text-gray-300'
                                                                }`}>
                                                                    {index + 1}
                                                                </div>
                                                                <span className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                                                                    Prompt #{index + 1}
                                                                </span>
                                                                {promptIds[index] && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-brand-accent border border-white/10 whitespace-nowrap shrink-0" title={`Schema ID: ${promptIds[index]}`}>
                                                                        ID: {promptIds[index]}
                                                                    </span>
                                                                )}
                                                                <span 
                                                                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-950/70 text-purple-300 border border-purple-500/30 flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0" 
                                                                    title={`Model for Prompt #${index + 1}: ${promptModelsUsed[index] || (modelType === 'pro' ? 'gemini-3-pro-image' : resolveImageModelName(modelType))}`}
                                                                >
                                                                    <span className="w-1 h-1 rounded-full bg-purple-400"></span>
                                                                    {promptModelsUsed[index] ? promptModelsUsed[index].replace('gemini-', '') : (modelType === 'pro' ? 'PRO' : modelType === 'nano-banana-2.1' ? 'NB 2.1 (3.6)' : resolveImageModelName(modelType).replace('gemini-', ''))}
                                                                </span>
                                                                {hasError && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1 whitespace-nowrap shrink-0">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                                                                        Error
                                                                    </span>
                                                                )}
                                                                {isSolo && !hasError && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1 whitespace-nowrap shrink-0">
                                                                        <BoltIcon className="w-2.5 h-2.5" />
                                                                        Solo
                                                                    </span>
                                                                )}
                                                                {isDisabled && !isSolo && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-800 text-gray-400 border border-gray-700 whitespace-nowrap shrink-0">
                                                                        Disabled
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Right: Prompt Slot Action Buttons */}
                                                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                                                                {/* Solo Toggle Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleSoloPrompt(index)}
                                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                                                        isSolo
                                                                            ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                                                                            : 'bg-gray-800/80 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-white/5'
                                                                    }`}
                                                                    title={isSolo ? "Exit solo mode" : "Solo this prompt (generate batch variations of this prompt)"}
                                                                >
                                                                    <BoltIcon className="w-3 h-3" />
                                                                    <span>{isSolo ? 'Soloed' : 'Solo'}</span>
                                                                </button>

                                                                {/* Disable Others Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDisableOtherPrompts(index)}
                                                                    className="px-2 py-1 rounded text-[10px] font-bold bg-gray-800/80 hover:bg-indigo-600/30 text-gray-300 hover:text-indigo-200 border border-white/5 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                                                    title={`Disable all other prompts without deleting them, keeping only Prompt #${index + 1} active`}
                                                                >
                                                                    <EyeSlashIcon className="w-3 h-3 text-indigo-400" />
                                                                    <span>Others</span>
                                                                </button>

                                                                {/* Enable / Disable Toggle Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleDisablePrompt(index)}
                                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                                                        isDisabled
                                                                            ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                                                                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                                                                    }`}
                                                                    title={isDisabled ? "Enable this prompt" : "Disable this prompt (skip during generation without deleting text)"}
                                                                >
                                                                    {isDisabled ? (
                                                                        <>
                                                                            <EyeSlashIcon className="w-3 h-3 text-gray-400" />
                                                                            <span>Off</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <EyeIcon className="w-3 h-3 text-emerald-400" />
                                                                            <span>Active</span>
                                                                        </>
                                                                    )}
                                                                </button>

                                                                {/* AI Suggestions Button */}
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleGetSuggestions(index)} 
                                                                    disabled={isGeneratingSuggestions}
                                                                    className="p-1.5 bg-gray-800 hover:bg-brand-accent/20 text-brand-accent rounded transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                                                    title="Get AI prompt suggestions for this variation"
                                                                >
                                                                    <SparklesIcon className="w-3.5 h-3.5" />
                                                                </button>

                                                                {/* Clear Button */}
                                                                {(hasText || !!promptFileNames[index] || (promptReferenceImages[index] && promptReferenceImages[index].length > 0)) && (
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newPrompts = [...multiplePrompts];
                                                                            newPrompts[index] = '';
                                                                            setMultiplePrompts(newPrompts);

                                                                            const newFiles = [...promptFileNames];
                                                                            newFiles[index] = '';
                                                                            setPromptFileNames(newFiles);

                                                                            const newRefs = [...promptReferenceImages];
                                                                            newRefs[index] = [];
                                                                            setPromptReferenceImages(newRefs);

                                                                            if (promptErrors[index]) {
                                                                                setPromptErrors(prev => {
                                                                                    const next = { ...prev };
                                                                                    delete next[index];
                                                                                    return next;
                                                                                });
                                                                            }
                                                                        }} 
                                                                        className="p-1.5 bg-gray-800/80 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded transition-colors shrink-0 cursor-pointer"
                                                                        title="Clear text, attached file, and reference images in this slot"
                                                                    >
                                                                        <CloseIcon className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Attached File & Reference Images Bar */}
                                                        {(promptFileNames[index] || (promptReferenceImages[index] && promptReferenceImages[index].length > 0) || allPhotoNames.length > 0) && (
                                                            <div className="flex items-center gap-1.5 flex-wrap px-3 py-1.5 bg-black/30 border-b border-white/5 text-[10px] min-w-0">
                                                                {promptFileNames[index] ? (
                                                                    <div className="flex items-center gap-1 bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-sm" title={`Attached File: "${promptFileNames[index]}"`}>
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                                                        <span className="truncate max-w-[140px] sm:max-w-[200px]">File: {promptFileNames[index]}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const updated = [...promptFileNames];
                                                                                updated[index] = '';
                                                                                setPromptFileNames(updated);
                                                                            }}
                                                                            className="hover:text-red-300 p-0.5 ml-0.5 transition-colors cursor-pointer shrink-0"
                                                                            title="Detach file from this prompt"
                                                                        >
                                                                            <CloseIcon className="w-2.5 h-2.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (allPhotoNames.length > 0 && (
                                                                    <div className="shrink-0">
                                                                        <select
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                if (e.target.value) {
                                                                                    const updated = [...promptFileNames];
                                                                                    updated[index] = e.target.value;
                                                                                    setPromptFileNames(updated);
                                                                                }
                                                                            }}
                                                                            className="bg-gray-800/80 hover:bg-emerald-950/40 text-gray-400 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 rounded px-1.5 py-0.5 text-[9px] font-mono cursor-pointer transition-colors max-w-[130px] truncate"
                                                                            title="Attach uploaded photo filename to this prompt"
                                                                        >
                                                                            <option value="" disabled>+ Attach File</option>
                                                                            {allPhotoNames.map((name, pIdx) => (
                                                                                <option key={pIdx} value={name}>{name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                ))}

                                                                {/* Extra Reference Images Badges */}
                                                                {promptReferenceImages[index] && promptReferenceImages[index].length > 0 && (
                                                                    <>
                                                                        {promptReferenceImages[index].map((refName, rIdx) => {
                                                                            const isMatched = allPhotoNames.some(p => p.toLowerCase() === refName.toLowerCase() || p.toLowerCase().includes(refName.toLowerCase()) || refName.toLowerCase().includes(p.toLowerCase()));
                                                                            return (
                                                                                <div 
                                                                                    key={rIdx} 
                                                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-sm border ${
                                                                                        isMatched 
                                                                                            ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40' 
                                                                                            : 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                                                                                    }`}
                                                                                    title={isMatched ? `Extra Reference "${refName}" (Matched in Photo Catalog)` : `Extra Reference: "${refName}"`}
                                                                                >
                                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMatched ? 'bg-cyan-400' : 'bg-blue-400'}`}></span>
                                                                                    <span className="truncate max-w-[120px] sm:max-w-[180px]">Ref: {refName}</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const updated = [...promptReferenceImages];
                                                                                            updated[index] = (updated[index] || []).filter((_, i) => i !== rIdx);
                                                                                            setPromptReferenceImages(updated);
                                                                                        }}
                                                                                        className="hover:text-red-300 p-0.5 ml-0.5 transition-colors cursor-pointer shrink-0"
                                                                                        title="Detach this extra reference"
                                                                                    >
                                                                                        <CloseIcon className="w-2.5 h-2.5" />
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </>
                                                                )}

                                                                {allPhotoNames.length > 0 && (
                                                                    <div className="shrink-0">
                                                                        <select
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                if (e.target.value) {
                                                                                    const updated = [...promptReferenceImages];
                                                                                    const currentList = updated[index] || [];
                                                                                    if (!currentList.includes(e.target.value)) {
                                                                                        updated[index] = [...currentList, e.target.value];
                                                                                        setPromptReferenceImages(updated);
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="bg-gray-800/80 hover:bg-cyan-950/40 text-gray-400 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 rounded px-1.5 py-0.5 text-[9px] font-mono cursor-pointer transition-colors max-w-[120px] truncate"
                                                                            title="Attach an extra reference image from uploaded photos"
                                                                        >
                                                                            <option value="" disabled>+ Add Ref</option>
                                                                            {allPhotoNames.map((name, pIdx) => (
                                                                                <option key={pIdx} value={name}>{name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Thumbnail preview strip for attached file & extra references */}
                                                        {(promptFileNames[index] || (promptReferenceImages[index] && promptReferenceImages[index].length > 0)) && (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border-b border-white/5 overflow-x-auto scrollbar-thin">
                                                                {promptFileNames[index] && (() => {
                                                                    const heroRef = allPhotoReferences.find(r => r.name.toLowerCase() === promptFileNames[index]?.toLowerCase() || r.name.toLowerCase().includes(promptFileNames[index]?.toLowerCase()) || promptFileNames[index]?.toLowerCase().includes(r.name.toLowerCase()));
                                                                    return heroRef?.preview ? (
                                                                        <div className="relative shrink-0 w-8 h-8 rounded border border-emerald-500 overflow-hidden bg-black/60 shadow-sm" title={`Attached File: ${promptFileNames[index]}`}>
                                                                            <img src={heroRef.preview} alt={promptFileNames[index]} className="w-full h-full object-cover" />
                                                                            <span className="absolute bottom-0 inset-x-0 bg-emerald-950/90 text-emerald-200 text-[6px] font-bold text-center uppercase">FILE</span>
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                                {promptReferenceImages[index]?.map((refName, rIdx) => {
                                                                    const refObj = allPhotoReferences.find(r => r.name.toLowerCase() === refName.toLowerCase() || r.name.toLowerCase().includes(refName.toLowerCase()) || refName.toLowerCase().includes(r.name.toLowerCase()));
                                                                    return refObj?.preview ? (
                                                                        <div key={rIdx} className="relative shrink-0 w-8 h-8 rounded border border-cyan-500 overflow-hidden bg-black/60 shadow-sm" title={`Extra Ref: ${refName}`}>
                                                                            <img src={refObj.preview} alt={refName} className="w-full h-full object-cover" />
                                                                            <span className="absolute bottom-0 inset-x-0 bg-cyan-950/90 text-cyan-200 text-[6px] font-bold text-center uppercase">REF</span>
                                                                        </div>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Textarea */}
                                                        <div className="p-3 min-w-0 flex-1 flex flex-col justify-between">
                                                            {isDisabled && (
                                                                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-gray-850/90 border border-gray-700/80 text-gray-400 text-[11px] flex items-center justify-between gap-2">
                                                                    <span className="flex items-center gap-1.5 truncate">
                                                                        <EyeSlashIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                                                        <span>Prompt is disabled (skipped during generation). Text &amp; refs preserved.</span>
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleDisablePrompt(index)}
                                                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline shrink-0 cursor-pointer"
                                                                    >
                                                                        Enable
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <PromptMentionTextarea 
                                                                value={multiplePrompts[index]} 
                                                                onChange={(val) => {
                                                                    const newPrompts = [...multiplePrompts];
                                                                    newPrompts[index] = val;
                                                                    setMultiplePrompts(newPrompts);
                                                                    if (promptErrors[index]) {
                                                                        setPromptErrors(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[index];
                                                                            return next;
                                                                        });
                                                                    }
                                                                    if (index + 1 > numberOfVariations && val.trim().length > 0) {
                                                                        setNumberOfVariations(index + 1);
                                                                    }
                                                                }} 
                                                                placeholder={`Describe variation ${index + 1}. Type @ to mention photos (e.g. Replace woman in @Frame-03.png with @frame-01N.webp)...`} 
                                                                allPhotoReferences={allPhotoReferences}
                                                                onOpenSwapStudio={openCharacterSwapStudio}
                                                                characters={characters}
                                                                rows={3}
                                                                disabled={isDisabled}
                                                                className={`w-full p-2.5 bg-black/40 rounded-lg text-xs transition-all duration-200 resize-none ${
                                                                    hasError
                                                                        ? 'text-red-200 placeholder-red-400/50 border border-red-500/50 focus:ring-1 focus:ring-red-400'
                                                                        : isDisabled 
                                                                            ? 'text-gray-500 placeholder-gray-600' 
                                                                            : 'text-gray-200 placeholder-gray-500 focus:ring-1 focus:ring-brand-accent'
                                                                }`}
                                                            />
                                                        </div>


                                                        {/* Distinct Prompt Box Error Callout */}
                                                        {hasError && (
                                                            <div className="mx-3 mb-3 p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex flex-col gap-1.5 shadow-sm animate-fade-in">
                                                                <div className="flex items-center justify-between text-red-300 font-bold text-[11px]">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                                        Prompt Box #{index + 1} Error
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setPromptErrors(prev => {
                                                                                const next = { ...prev };
                                                                                delete next[index];
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="text-red-400 hover:text-red-200 text-[10px] underline cursor-pointer"
                                                                    >
                                                                        Dismiss
                                                                    </button>
                                                                </div>
                                                                <div className="text-[11px] text-red-200/90 leading-relaxed font-sans">
                                                                    <span className="font-bold text-red-300">Specifically Why: </span>
                                                                    <span className="font-mono text-[11px] text-red-100 break-words">{promptErrors[index].specificReason || promptErrors[index].message}</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 pt-1.5 border-t border-red-500/20">
                                                                    <span>Model Attempted:</span>
                                                                    <span className="text-purple-300 font-bold">{promptErrors[index].modelUsed || (modelType === 'pro' ? 'gemini-3-pro-image (PRO)' : resolveImageModelName(modelType))}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Dynamic Add Prompt Slots Bar */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-brand-primary/40 border border-white/10 rounded-xl">
                                            <div className="text-xs text-gray-300">
                                                Currently configured for <span className="text-brand-accent font-bold">{multiplePrompts.length}</span> prompt slots.
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddPromptSlots(10)}
                                                    className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                                                    title="Add 10 more prompt slots"
                                                >
                                                    <span>+ Add 10 More Slots</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddPromptSlots(25)}
                                                    className="px-3 py-1.5 bg-brand-surface hover:bg-gray-800 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                                    title="Add 25 more prompt slots"
                                                >
                                                    <span>+ 25 Slots</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* AI Suggestions Box */}
                                        {suggestions.length > 0 && (
                                            <div className="bg-brand-primary/50 border border-brand-accent/30 p-3 rounded-lg animate-fade-in">
                                                <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 tracking-wider">
                                                    AI Suggestions {suggestionTargetIndex !== null ? `for Prompt #${suggestionTargetIndex + 1}` : ''} (Click to append):
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {suggestions.map((s, i) => (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => applySuggestion(s)} 
                                                            className="px-3 py-1 text-xs bg-brand-primary border border-brand-accent rounded-full hover:bg-brand-accent hover:text-brand-primary transition-colors text-brand-light font-medium"
                                                        >
                                                            + "{s}"
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                             <div className="space-y-6 mt-6">
                                <div className="bg-black/20 border border-white/5 p-4 rounded-2xl space-y-4">
                                    <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                                        <SettingsIcon className="w-4 h-4 text-brand-accent" />
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Model & Engine Settings</h3>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <h4 className="text-xs font-semibold mb-2 text-brand-light flex items-center justify-between">
                                                Model Type
                                                <span className="text-[9px] text-gray-500 font-normal italic">Advanced has lower quotas</span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 bg-black/40 border border-white/5 rounded-xl p-1 gap-1.5">
                                                 <button onClick={() => setModelType('pro')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 ${modelType === 'pro' ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400/50' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                                     <span>Pro (Default)</span>
                                                     <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">PRO</span>
                                                 </button>
                                                 <button onClick={() => setModelType('nano-banana-2.1')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 ${modelType === 'nano-banana-2.1' ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400/50' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} title="Nano Banana 2.1 aka Gemini 3.6 Flash image (High Quality Image Generation)">
                                                     <span>Nano Banana 2.1</span>
                                                     <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">3.6</span>
                                                 </button>
                                                 <button onClick={() => setModelType('ultra')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'ultra' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Flash Image</button>
                                                 <button onClick={() => setModelType('light')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'light' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Flash Lite</button>
                                                 <button onClick={() => setModelType('standard')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'standard' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Standard</button>
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="text-xs font-semibold mb-2 text-brand-light">Resolution (Advanced Only)</h4>
                                            <ImageSizeSelector selected={imageSize} onSelect={setImageSize} disabled={modelType === 'standard' || modelType === 'light'} />
                                        </div>
                                    </div>
                                </div>

                                {/* Workspace Defaults Bar */}
                                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-black/30 border border-indigo-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm">
                                    <div className="flex items-start sm:items-center gap-3">
                                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5 sm:mt-0">
                                            <SparklesIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                                                    Workspace Defaults
                                                </h4>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                    Auto-Loaded
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                                                Model: <span className="text-indigo-300 font-semibold">{modelType === 'pro' ? 'Gemini 3 Pro (PRO Quality)' : modelType === 'nano-banana-2.1' ? 'Nano Banana 2.1 (Gemini 3.6 Flash Image)' : modelType === 'ultra' ? 'Gemini 3.1 Flash Image' : modelType === 'light' ? 'Flash Lite' : 'Standard'}</span> • Style: <span className="text-gray-200 font-medium">{selectedStyle ? (STYLE_OPTIONS.find(s => s.value === selectedStyle)?.label || 'Custom') : 'Standard'}</span> • Negative Prompt: <span className="text-gray-200 font-medium">{negativePrompt ? 'Active' : 'None'}</span> • Presets: <span className="text-gray-200 font-medium">{cameraPresets.length} ready</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleRestoreWorkspaceDefaults}
                                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors"
                                            title="Restore saved default presets, aesthetic style, and negative prompt"
                                        >
                                            ↺ Reload Defaults
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveWorkspaceDefaults}
                                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center gap-1.5 transition-all"
                                            title="Save current camera presets, aesthetic style, and negative prompt as default"
                                        >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                            Save as Default
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">Aesthetic Style</h3>
                                        <StyleSelector selected={selectedStyle} onSelect={setSelectedStyle} />
                                    </div>
                                    <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">Aesthetic Mood</h3>
                                        <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">Texture Realism</h3>
                                        <select
                                            value={cameraSettings.textureDetail}
                                            onChange={(e) => setCameraSettings(prev => ({ ...prev, textureDetail: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-brand-accent/80 focus:ring-1 focus:ring-brand-accent/40"
                                            aria-label="Texture Realism"
                                        >
                                            <option value="">Default</option>
                                            <option value="Hyper-detailed macro textures, emphasizing every surface imperfection, pore, and grain.">Hyperrealism (Skin &amp; Surfaces)</option>
                                            <option value="Smooth, clean product textures with a polished, commercial finish.">Commercial Polish</option>
                                            <option value="Rough, weathered textures with visible wear, grit, and age.">Gritty &amp; Weathered (Objects)</option>
                                        </select>
                                    </div>
                                    <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">Negative Prompt (Optional)</h3>
                                        <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="e.g., no people, blurry, cartoon" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-brand-accent/80 focus:ring-1 focus:ring-brand-accent/40 placeholder-gray-600"/>
                                    </div>
                                </div>

                                <div className="bg-black/20 border border-white/5 p-4 rounded-2xl">
                                    <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-3">Image Generation Settings</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-[11px] font-bold text-brand-light uppercase tracking-wider">
                                                    Variations Batch
                                                </h4>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    No limit (60+ supported)
                                                </span>
                                            </div>
                                            <VariationSelector 
                                                selected={numberOfVariations} 
                                                onSelect={setNumberOfVariations} 
                                                maxCount={Math.max(100, numberOfVariations)}
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-bold text-brand-light uppercase tracking-wider mb-2">Aspect Ratio</h4>
                                            <AspectRatioSelector selected={aspectRatio} onSelect={setAspectRatio} disabled={hasAnyImage && modelType === 'standard'} />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-5">
                                    <button onClick={() => setShowCameraSettings(!showCameraSettings)} className="flex items-center justify-between w-full text-xs font-bold text-brand-accent hover:text-indigo-400 uppercase tracking-widest transition-colors" aria-expanded={showCameraSettings}>
                                        <span className="flex items-center gap-2">
                                            <SettingsIcon className="w-4 h-4" />
                                            Advanced Camera Settings
                                        </span>
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${showCameraSettings ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showCameraSettings && (
                                        <div className="mt-4 animate-fade-in space-y-4">
                                            <div className="bg-brand-primary/40 border border-brand-accent/20 p-3 rounded-lg flex items-start gap-3">
                                                <div className="bg-brand-accent/20 p-1.5 rounded-lg text-brand-accent shrink-0">
                                                    <SparklesIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-brand-accent mb-0.5">Camera Settings Tip</p>
                                                    <p className="text-[10px] text-gray-400 leading-relaxed">
                                                        Selecting <span className="text-white font-medium">"Default"</span> for camera options (Aperture, Focal Length, etc.) removes those specific instructions. This allows your <span className="text-white font-medium">Text Prompt</span> to take full control of the shot's technical look without being overridden by these dropdowns.
                                                    </p>
                                                </div>
                                            </div>
                                            <CameraSettings 
                                                settings={cameraSettings} 
                                                onSettingsChange={setCameraSettings} 
                                                presets={cameraPresets}
                                                onSavePreset={handleSaveCameraPreset}
                                                onDeletePreset={handleDeleteCameraPreset}
                                                onApplyPreset={handleApplyCameraPreset}
                                                onRestoreDefaultPresets={handleRestoreDefaultCameraPresets}
                                                onSaveAsWorkspaceDefaults={handleSaveWorkspaceDefaults}
                                            />
                                        </div>
                                    )}
                                </div>
                                {generatedAds && generatedAds.images && generatedAds.images.length > 0 && (
                                    <div className="border-t border-gray-700 pt-6 mt-6 animate-fade-in">
                                        <CreationActions
                                            disabled={isEditing || isLoading}
                                            onUpscale={handleUpscale}
                                            onPan={handlePan}
                                            onZoomIn={handleZoomIn}
                                            onZoomOut={handleZoomOut}
                                            onVary={handleVary}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Video Model Selection */}
                        <div className="bg-black/20 p-5 rounded-2xl border border-white/5 mt-6 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Video Engine</h3>
                                <KlingConfig onKeysChange={setKlingKeys} />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex bg-black/40 rounded-xl p-1 w-full sm:w-fit border border-white/5">
                                    <button 
                                        onClick={() => setVideoModel('veo')}
                                        className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${videoModel === 'veo' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Google Veo 3.1
                                    </button>
                                    <button 
                                        onClick={() => setVideoModel('kling')}
                                        className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${videoModel === 'kling' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Kling AI V3
                                    </button>
                                </div>

                                {videoModel === 'kling' && (
                                    <div className="flex-1">
                                        <select 
                                            value={klingModel}
                                            onChange={(e) => setKlingModel(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                        >
                                            <option value="kling-v3">Kling V3 (Standard)</option>
                                            <option value="kling-v3-omni">Kling V3 Omni (High Fidelity)</option>
                                            <option value="kling-v1-5">Kling V1.5 (Legacy Pro)</option>
                                            <option value="kling-v1">Kling V1 (Legacy Standard)</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed">
                                {videoModel === 'veo' 
                                    ? "Fast, cinematic, and deeply integrated with Gemini's spatial prompt architecture." 
                                    : "Hyper-realistic physical dynamics and fluid motion vectors. Requires custom Kling API key."}
                            </p>
                        </div>

                        {/* Generate Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 mt-6">
                            <button onClick={handleGenerateAd} disabled={isLoading || !canGenerate} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:from-gray-850 disabled:to-gray-850 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/25"><PhotoIcon className="w-5 h-5" />{isLoading && generationType === 'image' ? 'Generating Image...' : 'Generate Image Ad'}</button>
                            <button onClick={handleGenerateVideo} disabled={isLoading || !canGenerate} className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:from-gray-850 disabled:to-gray-850 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-purple-600/10 hover:shadow-purple-500/25"><FilmIcon className="w-5 h-5" />{isLoading && generationType === 'video' ? 'Generating Video...' : 'Generate Video Ad'}</button>
                        </div>
                         {isLoading && (
                            <div className="mt-4">
                                <button
                                    onClick={handleStopGeneration}
                                    className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-red-500/10"
                                    aria-label="Stop generation"
                                >
                                    <StopIcon className="w-5 h-5" />
                                    Stop Generation
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="lg:sticky lg:top-8 lg:h-fit flex flex-col gap-8">
                        <div className="bg-brand-secondary/25 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-2xl animate-fade-in flex flex-col" style={{ animationDelay: '200ms' }}>
                            <AdDisplay 
                                generatedAds={generatedAds} 
                                generatedVideo={generatedVideo} 
                                isLoading={isLoading} 
                                isEditing={isEditing}
                                error={error} 
                                generationType={generationType} 
                                videoLoadingMessage={videoLoadingMessage}
                                imageLoadingMessage={imageLoadingMessage}
                                activeIndex={activeAdIndex}
                                onSelectVariation={setActiveAdIndex}
                                onImageClick={(url) => setSelectedModalImage({ src: url, alt: 'Generated Ad' })}
                            />

                            {/* Top Quick Generate Controls directly under Active Display */}
                            <div className="mt-5 pt-5 border-t border-white/10 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <SparklesIcon className="w-3.5 h-3.5 text-brand-accent" />
                                            Quick Generate
                                        </span>
                                        {promptMode === 'multiple' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent/15 text-brand-accent font-semibold border border-brand-accent/20">
                                                {soloPromptIndex !== null 
                                                    ? `Solo: #${soloPromptIndex + 1}` 
                                                    : `${multiplePrompts.slice(0, numberOfVariations).filter((p, i) => !disabledPrompts[i] && p.trim() !== '').length} active prompts`}
                                            </span>
                                        )}
                                        {promptMode !== 'multiple' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-semibold border border-white/10 uppercase">
                                                {promptMode} mode
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-medium">
                                        {numberOfVariations} {numberOfVariations === 1 ? 'variation' : 'variations'} &bull; {aspectRatio}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button 
                                        onClick={handleGenerateAd} 
                                        disabled={isLoading || !canGenerate} 
                                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold py-3 px-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:from-gray-850 disabled:to-gray-850 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/25 cursor-pointer"
                                        title={canGenerate ? "Generate image advertisement" : "Please configure a prompt or upload an image to generate"}
                                    >
                                        <PhotoIcon className="w-4 h-4" />
                                        {isLoading && generationType === 'image' ? 'Generating...' : 'Generate Image Ad'}
                                    </button>

                                    <button 
                                        onClick={handleGenerateVideo} 
                                        disabled={isLoading || !canGenerate} 
                                        className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-extrabold py-3 px-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:from-gray-850 disabled:to-gray-850 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-purple-600/15 hover:shadow-purple-500/25 cursor-pointer"
                                        title={canGenerate ? `Generate video advertisement with ${videoModel === 'veo' ? 'Google Veo' : 'Kling AI'}` : "Please configure a prompt or upload an image to generate"}
                                    >
                                        <FilmIcon className="w-4 h-4" />
                                        {isLoading && generationType === 'video' ? 'Generating Video...' : 'Generate Video Ad'}
                                    </button>
                                </div>

                                {isLoading && (
                                    <button
                                        onClick={handleStopGeneration}
                                        className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-extrabold py-2.5 px-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-red-500/15 animate-fade-in cursor-pointer"
                                        aria-label="Stop generation"
                                    >
                                        <StopIcon className="w-4 h-4" />
                                        Stop Generation
                                    </button>
                                )}
                            </div>
                        </div>

                        <AnimateSection 
                            currentImage={generatedAds && generatedAds.images && generatedAds.images[activeAdIndex] ? generatedAds.images[activeAdIndex].url : null}
                            subjectImages={subjectImages}
                            onAnimate={handleAnimateImage}
                            isLoading={isLoading && generationType === 'video'}
                            disabled={isLoading}
                        />
                    </div>
                </main>
                <HistoryDisplay 
                    history={history} 
                    currentBatch={generatedAds?.images || []}
                    onImageSelect={(fullRes) => { setGeneratedAds({ images: [{ url: fullRes, variantIndex: 0 }], errors: [] }); setGeneratedVideo(null); }} 
                    onClearHistory={handleClearHistory} 
                    onOpenHistoricalSessions={() => setIsRestartModalOpen(true)}
                />
            </div>
            {/* Image Modal */}
            <ImageModal 
                isOpen={!!selectedModalImage}
                onClose={() => setSelectedModalImage(null)}
                imageSrc={selectedModalImage?.src || ''}
                alt={selectedModalImage?.alt || ''}
            />

            {/* Application PDF Guide Modal */}
            <PdfApplicationGuideModal 
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
            />

            {/* Bulk Download Modal */}
            {bulkDownloadModalData && (
                <BulkDownloadModal
                    isOpen={bulkDownloadModalData.isOpen}
                    onClose={() => setBulkDownloadModalData(null)}
                    title={bulkDownloadModalData.title}
                    description={bulkDownloadModalData.description}
                    images={bulkDownloadModalData.images}
                    defaultPrefix={bulkDownloadModalData.defaultPrefix}
                />
            )}

            {/* Rename Photo Modal */}
            {renameTarget && (
                <RenamePhotoModal
                    isOpen={!!renameTarget}
                    onClose={() => setRenameTarget(null)}
                    currentName={renameTarget.currentName}
                    category={renameTarget.category}
                    onSave={handleSaveRenamedPhoto}
                />
            )}

            {/* Restart Program from Historical Session References Modal */}
            <RestartHistoricalSessionModal
                isOpen={isRestartModalOpen}
                onClose={() => setIsRestartModalOpen(false)}
                sessions={historicalSessions}
                onRestartSession={handleRestartFromHistoricalSession}
                onDeleteSession={handleDeleteHistoricalSession}
                onClearAllSessions={async () => {
                    await clearAllHistoricalSessions();
                    setHistoricalSessions([]);
                    setLatestHistoricalSnapshot(null);
                    setIsRestartModalOpen(false);
                    setRestartToastMessage('All historical session checkpoints and references permanently deleted.');
                }}
            />

            {/* Simple Character Swap & Insert Model Studio Modal */}
            <ModelInsertionStudioModal
                isOpen={isModelInsertionModalOpen}
                onClose={() => setIsModelInsertionModalOpen(false)}
                availableSceneImages={[...subjectImages, ...productImages]}
                availableModelImages={modelImages}
                allWorkspaceImages={allWorkspaceImages}
                initialMode={modelStudioMode}
                initialSceneImage={swapPreselect.sceneImage || subjectImages[0] || productImages[0] || null}
                initialModelImage={swapPreselect.modelImage || modelImages[0] || null}
                initialTargetSubject={swapPreselect.targetSubject}
                onApplyResultToWorkspace={(images) => {
                    setGeneratedAds({ images, errors: [] });
                    setActiveAdIndex(0);
                    setHistory(prev => [
                        ...images.map(img => ({ thumbnail: img.url, fullRes: img.url })),
                        ...prev
                    ]);
                    setRestartToastMessage(modelStudioMode === 'swap' ? 'Character swap photo loaded into workspace.' : 'Model inserted composite photo loaded into workspace.');
                    window.scrollTo({ top: 500, behavior: 'smooth' });
                }}
            />

            {/* Character Cast & Identity Grounding Modal */}
            <CharacterCastModal
                isOpen={isCharacterModalOpen}
                onClose={() => setIsCharacterModalOpen(false)}
                characters={characters}
                onSaveCharacters={setCharacters}
            />

            {/* Paid Account / API Key Selection Modal */}
            {isKeyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#12111a] border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 text-left">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                                <KeyIcon className="w-5 h-5 text-amber-400" />
                                <span>Gemini Paid Account / API Key Selection</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsKeyModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Primary Action: Select Key Hooked Up in AI Studio */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/60 via-yellow-950/30 to-black/60 border border-amber-500/50 flex flex-col gap-3 shadow-lg">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wide">
                                        Hooked-Up AI Studio Key (1-Click)
                                    </span>
                                </div>
                                {(hasAiStudioKey || hasServerKey) && (
                                    <span className="text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        Active &amp; Hooked Up
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                Select the Google Cloud project or API key already connected to this app in Google AI Studio. No typing or manual entry required.
                            </p>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (window.aistudio?.openSelectKey) {
                                        try {
                                            await window.aistudio.openSelectKey();
                                            if (window.aistudio.hasSelectedApiKey) {
                                                const selected = await window.aistudio.hasSelectedApiKey();
                                                setHasAiStudioKey(selected);
                                                if (selected) {
                                                    setRestartToastMessage('AI Studio API key selected successfully.');
                                                }
                                            }
                                            setIsKeyModalOpen(false);
                                        } catch (e) {
                                            console.error('Error opening AI Studio key selector:', e);
                                        }
                                    } else {
                                        setRestartToastMessage('Native selector is active in AI Studio. You can also paste your key below.');
                                    }
                                }}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <KeyIcon className="w-4 h-4 text-black" />
                                <span>Select My Hooked-Up AI Studio Key</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 my-0.5">
                            <div className="h-px bg-white/10 flex-grow" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Or Enter Custom Key Manually (Optional)</span>
                            <div className="h-px bg-white/10 flex-grow" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-gray-300">Custom / External API Key</label>
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                                >
                                    Get API Key in AI Studio ↗
                                </a>
                            </div>
                            <input
                                type="password"
                                value={customKeyInput}
                                onChange={(e) => {
                                    setCustomKeyInput(e.target.value);
                                    if (keyTestResult) setKeyTestResult(null);
                                }}
                                placeholder="AIzaSy... (optional manual override)"
                                className="w-full p-2.5 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 font-mono"
                            />
                        </div>

                        {keyTestResult && (
                            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                                keyTestResult.success 
                                    ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300' 
                                    : 'bg-red-950/70 border border-red-500/50 text-red-300'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${keyTestResult.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <span className="font-mono text-[11px] break-words">{keyTestResult.message}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            {customKeyInput ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomApiKey('');
                                        setCustomKeyInput('');
                                        setKeyTestResult(null);
                                        setRestartToastMessage('Cleared manual key; using hooked-up AI Studio key.');
                                    }}
                                    className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                                >
                                    Clear Saved Key
                                </button>
                            ) : <span />}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleTestKey}
                                    disabled={isTestingKey || !customKeyInput.trim()}
                                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isTestingKey ? 'Testing...' : 'Test Key'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsKeyModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const trimmedKey = customKeyInput.trim();
                                        setCustomApiKey(trimmedKey);
                                        setIsKeyModalOpen(false);
                                        if (trimmedKey) {
                                            try {
                                                await fetch('/api/gemini/set-key', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ apiKey: trimmedKey })
                                                });
                                                setRestartToastMessage('Paid API key saved and activated on server.');
                                            } catch {
                                                setRestartToastMessage('Key saved locally.');
                                            }
                                        }
                                    }}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                                >
                                    Save &amp; Apply Key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Program Restart Success Toast Notification */}
            {restartToastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in text-xs font-medium">
                    <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-300">
                        <CheckIcon className="w-4 h-4" />
                    </span>
                    <span>{restartToastMessage}</span>
                    <button
                        type="button"
                        onClick={() => setRestartToastMessage(null)}
                        className="ml-2 text-emerald-400 hover:text-white p-0.5 rounded cursor-pointer"
                        aria-label="Dismiss message"
                    >
                        <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;
