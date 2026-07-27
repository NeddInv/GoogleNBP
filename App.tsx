
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { BackgroundSelector } from './components/BackgroundSelector';
import { SloganGenerator } from './components/SloganGenerator';
import { AdDisplay } from './components/AdDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { generateSlogans, generateAdImage, generateSuggestions, generateAdVideo, generateAdCopy, editAdImage, animateImage } from './services/geminiService';
import { BACKGROUND_OPTIONS } from './constants';
import * as storage from './services/storageService';
import { CameraIcon, CloseIcon, SparklesIcon, PhotoIcon, FilmIcon, CopyIcon, SettingsIcon, ChevronDownIcon, StopIcon, ArrowPathIcon } from './components/icons';
import type { ImageData, AspectRatio, CameraSettingsData, PanDirection, ZoomDirection, VaryStrength, ZoomLevel, ModelType, ImageSize, VideoSettingsData, VideoModel, CameraPreset, ImageGenerationResponse } from './types';
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

const INITIAL_CAMERA_SETTINGS: CameraSettingsData = {
    cameraType: '',
    focalLength: '',
    aperture: '',
    shutterSpeed: '',
    lightingStyle: '',
    lightingSetup: '',
    distortion: '',
    textureDetail: '',
    colorStyle: '',
    technique: '',
    cameraAngle: '',
};

const createThumbnail = (base64Image: string, maxWidth: number = 256, maxHeight: number = 256): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Image;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

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

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (error) => reject(error);
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
    const [fullPrompt, setFullPrompt] = useState<string>('');
    const [multiplePrompts, setMultiplePrompts] = useState<string[]>(new Array(40).fill(''));
    const [history, setHistory] = useState<{ thumbnail: string, fullRes: string }[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [generationType, setGenerationType] = useState<'image' | 'video' | null>(null);
    const [videoLoadingMessage, setVideoLoadingMessage] = useState<string>('');
    const [imageLoadingMessage, setImageLoadingMessage] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [negativePrompt, setNegativePrompt] = useState<string>('');
    const [selectedStyle, setSelectedStyle] = useState<string>('');
    const [selectedMood, setSelectedMood] = useState<string>('');
    const [numberOfVariations, setNumberOfVariations] = useState<number>(1);
    const [adCopy, setAdCopy] = useState<string>('');
    const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [showCameraSettings, setShowCameraSettings] = useState<boolean>(false);
    const [modelType, setModelType] = useState<ModelType>('standard');
    const [imageSize, setImageSize] = useState<ImageSize>('1K');
    const [videoModel, setVideoModel] = useState<VideoModel>('veo');
    const [klingKeys, setKlingKeys] = useState({ apiKey: '', secretKey: '' });
    const [klingModel, setKlingModel] = useState('kling-v3');
    const [cameraSettings, setCameraSettings] = useState<CameraSettingsData>(INITIAL_CAMERA_SETTINGS);
    const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>([]);
    const [selectedModalImage, setSelectedModalImage] = useState<{src: string, alt: string} | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const isInitialMount = useRef(true);

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
                    if (state.aspectRatio !== undefined) setAspectRatio(state.aspectRatio);
                    if (state.negativePrompt !== undefined) setNegativePrompt(state.negativePrompt);
                    if (state.selectedStyle !== undefined) setSelectedStyle(state.selectedStyle);
                    if (state.selectedMood !== undefined) setSelectedMood(state.selectedMood);
                    if (state.numberOfVariations !== undefined) setNumberOfVariations(state.numberOfVariations);
                    if (state.modelType !== undefined) setModelType(state.modelType);
                    if (state.imageSize !== undefined) setImageSize(state.imageSize);
                    if (state.cameraSettings !== undefined) setCameraSettings(state.cameraSettings);
                    if (state.cameraPresets !== undefined) setCameraPresets(state.cameraPresets);
                    
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
        if (isInitialMount.current) return;
        storage.setItem('adgen-current-ads', generatedAds).catch(console.error);
    }, [generatedAds]);

    // Save active index
    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-active-index', activeAdIndex).catch(console.error);
    }, [activeAdIndex]);

    // Save form state to localStorage (text only)
    useEffect(() => {
        if (isInitialMount.current) return;
        const stateToSave = {
            productName,
            selectedBackground,
            customBackground,
            slogan,
            placement,
            promptMode,
            fullPrompt,
            multiplePrompts,
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
        promptMode, fullPrompt, multiplePrompts, aspectRatio, negativePrompt, selectedStyle, 
        selectedMood, numberOfVariations, modelType, imageSize, cameraSettings, cameraPresets
    ]);

    // Save images to IndexedDB
    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-product-images', productImages).catch(console.error);
    }, [productImages]);

    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-competitor-images', competitorImages).catch(console.error);
    }, [competitorImages]);

    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-company-logo', companyLogo).catch(console.error);
    }, [companyLogo]);

    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-subject-images', subjectImages).catch(console.error);
    }, [subjectImages]);

    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-model-images', modelImages).catch(console.error);
    }, [modelImages]);

    useEffect(() => {
        if (isInitialMount.current) return;
        storage.setItem('adgen-pose-images', poseImages).catch(console.error);
    }, [poseImages]);

    const hasAnyImage = useMemo(() => productImages.length > 0 || competitorImages.length > 0 || subjectImages.length > 0 || modelImages.length > 0 || poseImages.length > 0 || !!companyLogo, [productImages, competitorImages, subjectImages, modelImages, poseImages, companyLogo]);

    const canGenerate = useMemo(() => {
        const hasGuidedPrompt = promptMode === 'guided' && (placement.trim() !== '' || customBackground.trim() !== '' || selectedBackground !== BACKGROUND_OPTIONS[0].prompt);
        const hasFullPrompt = promptMode === 'full' && fullPrompt.trim() !== '';
        const hasMultiplePrompts = promptMode === 'multiple' && multiplePrompts.some(p => p.trim() !== '');
        return hasAnyImage || hasGuidedPrompt || hasFullPrompt || hasMultiplePrompts;
    }, [hasAnyImage, promptMode, placement, customBackground, selectedBackground, fullPrompt, multiplePrompts]);

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

    const handleReset = useCallback(() => {
        setProductImages([]);
        setCompetitorImages([]);
        setModelImages([]);
        setPoseImages([]);
        setCompanyLogo(null);
        setSubjectImages([]);
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
        setMultiplePrompts(new Array(40).fill(''));
        setSuggestions([]);
        setGenerationType(null);
        setVideoLoadingMessage('');
        setImageLoadingMessage('');
        setAspectRatio('1:1');
        setNegativePrompt('');
        setSelectedStyle('');
        setSelectedMood('');
        setNumberOfVariations(1);
        setAdCopy('');
        setShowCameraSettings(false);
        setModelType('standard');
        setImageSize('1K');
        setCameraSettings(INITIAL_CAMERA_SETTINGS);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        setPoseImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    };

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    // Sync number of variations with multiple prompts automatically
    useEffect(() => {
        if (promptMode === 'multiple') {
            const lastFilledIndex = [...multiplePrompts].reverse().findIndex(p => p.trim() !== '');
            if (lastFilledIndex !== -1) {
                const actualIndex = multiplePrompts.length - 1 - lastFilledIndex;
                if (actualIndex + 1 > numberOfVariations) {
                    setNumberOfVariations(actualIndex + 1);
                }
            }
        }
    }, [multiplePrompts, promptMode, numberOfVariations]);

    const handleGenerateAd = useCallback(async () => {
        if (!canGenerate) {
            setError('Please upload an image or provide a detailed description to generate an ad.');
            return;
        }

        setIsLoading(true);
        setGenerationType('image');
        setImageLoadingMessage('Starting image generation...');
        setError(null);
        setGeneratedAds(null);
        setGeneratedVideo(null);

        // Check for paid API key if using Pro, Ultra, or Light model
        if ((modelType === 'pro' || modelType === 'ultra' || modelType === 'light') && window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
            }
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const backgroundPrompt = selectedBackground === 'custom' ? customBackground : selectedBackground;

        try {
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
                    : (promptMode === 'multiple' 
                        ? multiplePrompts 
                        : undefined),
                aspectRatio,
                negativePrompt,
                style: selectedStyle,
                mood: selectedMood,
                numberOfVariations,
                modelType,
                imageSize,
                promptMode,
                ...cameraSettings,
            }, controller.signal, (current, total) => {
                setImageLoadingMessage(`Generating variation ${current + 1} of ${total}...`);
            });
            setGeneratedAds(resultImages);
            
            const thumbnails = await Promise.all(resultImages.images.map(img => createThumbnail(img.url)));
            const newHistoryItems = resultImages.images.map((img, i) => ({
                thumbnail: thumbnails[i],
                fullRes: img.url
            }));
            setHistory(prev => [...newHistoryItems, ...prev].slice(0, 15));

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
    }, [productImage, productImages, subjectImages, modelImages, poseImages, companyLogo, productName, selectedBackground, customBackground, slogan, placement, promptMode, fullPrompt, multiplePrompts, canGenerate, aspectRatio, negativePrompt, selectedStyle, selectedMood, numberOfVariations, hasAnyImage, cameraSettings, modelType, imageSize]);
    
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

        if (window.aistudio) {
             const hasKey = await window.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                 await window.aistudio.openSelectKey();
             }
        }

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
                const activePrompts = multiplePrompts.filter(p => p.trim() !== '');
                return activePrompts.length > 0 ? activePrompts[0] : undefined;
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
    }, [productImage, productImages, subjectImages, modelImages, poseImages, companyLogo, productName, selectedBackground, customBackground, slogan, placement, promptMode, fullPrompt, multiplePrompts, canGenerate, videoModel, klingKeys, klingModel]);

    const handleAnimateImage = useCallback(async (image: ImageData, prompt: string, settings: VideoSettingsData, customKlingKeys?: { apiKey: string, secretKey: string, model: string }) => {
        setIsLoading(true);
        setGenerationType('video');
        setError(null);
        setGeneratedAds(null);
        setGeneratedVideo(null);

        if (window.aistudio) {
             const hasKey = await window.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                 await window.aistudio.openSelectKey();
             }
        }

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

    const handleGetSuggestions = async (index?: number) => {
        setIsGeneratingSuggestions(true);
        setSuggestions([]);
        setError(null);
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
                const result = await generateSuggestions(currentPrompt);
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
                const activePrompt = multiplePrompts.find(p => p.trim() !== '');
                sceneDescription = activePrompt || productName || 'the product';
            } else {
                sceneDescription = `${placement}. The setting is ${selectedBackground === 'custom' ? customBackground : selectedBackground}`;
            }
            
            if (productName || slogan || sceneDescription) {
                 const result = await generateAdCopy(productName, slogan, sceneDescription);
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
        } else {
            setFullPrompt(prev => `${prev} ${suggestion}`.trim());
        }
        setSuggestions([]);
    };

    const handleClearHistory = () => setHistory([]);

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
                    
                    <button 
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-white/[0.02] border border-white/5 hover:border-red-500/30 hover:bg-red-500/5 text-gray-400 hover:text-red-400 font-medium rounded-xl transition-all duration-300 text-xs group shadow-lg"
                        aria-label="Reset all fields"
                    >
                        <ArrowPathIcon className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                        Reset All Workspace
                    </button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="bg-brand-secondary/25 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-2xl flex flex-col gap-6 animate-fade-in">
                        {/* Asset Uploader */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-brand-accent border border-indigo-500/30 shadow-sm">Step 1</span>
                                <h2 className="text-lg font-bold text-white tracking-tight">Upload Your Assets</h2>
                            </div>
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
                                            <button 
                                                onClick={() => setSelectedModalImage({ src: `data:${companyLogo.mimeType};base64,${companyLogo.base64}`, alt: 'Company Logo' })}
                                                className="mt-1 text-[10px] text-brand-accent hover:underline"
                                            >
                                                View Full Size
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Product Images Section (max 30) */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-brand-light">Product Images ({productImages.length}/30)</label>
                                        {productImages.length > 0 && (
                                            <button 
                                                onClick={() => setProductImages([])}
                                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {productImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                    <img 
                                                        src={`data:${image.mimeType};base64,${image.base64}`} 
                                                        alt={`Product ${index + 1}`} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                        onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: `Product ${index + 1}` })}
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveProductImage(index)} 
                                                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" 
                                                        aria-label={`Remove product image ${index + 1}`}
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                    </div>
                                                </div>
                                            ))}
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
                                            <button 
                                                onClick={() => setCompetitorImages([])}
                                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                            {competitorImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                    <img 
                                                        src={`data:${image.mimeType};base64,${image.base64}`} 
                                                        alt={`Competitor Product ${index + 1}`} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                        onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: `Competitor Product ${index + 1}` })}
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveCompetitorImage(index)} 
                                                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" 
                                                        aria-label={`Remove competitor image ${index + 1}`}
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                    </div>
                                                </div>
                                            ))}
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
                                            <button 
                                                onClick={() => setModelImages([])}
                                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {modelImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                    <img 
                                                        src={`data:${image.mimeType};base64,${image.base64}`} 
                                                        alt={`Model ${index + 1}`} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                        onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: `Model ${index + 1}` })}
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveModelImage(index)} 
                                                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" 
                                                        aria-label={`Remove model image ${index + 1}`}
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                    </div>
                                                </div>
                                            ))}
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
                                            <button 
                                                onClick={() => setPoseImages([])}
                                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {poseImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                    <img 
                                                        src={`data:${image.mimeType};base64,${image.base64}`} 
                                                        alt={`Pose ${index + 1}`} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                        onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: `Pose Reference ${index + 1}` })}
                                                    />
                                                    <button 
                                                        onClick={() => handleRemovePoseImage(index)} 
                                                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" 
                                                        aria-label={`Remove pose reference image ${index + 1}`}
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                    </div>
                                                </div>
                                            ))}
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
                                            <button 
                                                onClick={() => setSubjectImages([])}
                                                className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 border border-gray-700 rounded-lg bg-brand-primary/40 min-h-[8rem]">
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                            {subjectImages.map((image, index) => (
                                                <div key={index} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-gray-800">
                                                    <img 
                                                        src={`data:${image.mimeType};base64,${image.base64}`} 
                                                        alt={`Subject ${index + 1}`} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                        onClick={() => setSelectedModalImage({ src: `data:${image.mimeType};base64,${image.base64}`, alt: `Subject ${index + 1}` })}
                                                    />
                                                    <button 
                                                        onClick={() => handleRemoveSubjectImage(index)} 
                                                        className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" 
                                                        aria-label={`Remove subject image ${index + 1}`}
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-full">View</span>
                                                    </div>
                                                </div>
                                            ))}
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
                            <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-hide">
                                <button onClick={() => setPromptMode('guided')} className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'guided' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} aria-pressed={promptMode === 'guided'}>Guided Mode</button>
                                <button onClick={() => setPromptMode('full')} className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'full' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} aria-pressed={promptMode === 'full'}>Full Prompt</button>
                                <button onClick={() => setPromptMode('multiple')} className={`flex-shrink-0 w-1/3 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${promptMode === 'multiple' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} aria-pressed={promptMode === 'multiple'}>Multiple Prompts</button>
                            </div>

                            {promptMode === 'guided' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider mb-2.5">3a. Select a Background</h3>
                                        <BackgroundSelector selected={selectedBackground} onSelect={setSelectedBackground} custom={customBackground} onCustomChange={setCustomBackground}/>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2.5">
                                            <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">3b. Describe Placement</h3>
                                            <button onClick={() => handleGetSuggestions()} disabled={isGeneratingSuggestions || (!placement && !customBackground)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-brand-accent/15 text-brand-accent font-extrabold rounded-lg hover:bg-brand-accent hover:text-brand-primary disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all border border-brand-accent/20" aria-label="Get AI suggestions for placement"><SparklesIcon className="w-3.5 h-3.5" />{isGeneratingSuggestions ? 'Thinking...' : 'AI Suggestions'}</button>
                                        </div>
                                        <textarea value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="e.g., A woman with curly hair is happily holding the product, showing it to the camera..." className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-brand-accent focus:border-brand-accent/80 transition-all h-28 resize-none text-xs text-gray-300 placeholder-gray-500" />
                                        {suggestions.length > 0 && <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">{suggestions.map((s, i) => (<button key={i} onClick={() => applySuggestion(s)} className="px-3 py-1 text-[10px] font-semibold bg-brand-accent/5 border border-brand-accent/20 rounded-full hover:bg-brand-accent hover:text-brand-primary transition-all text-brand-light">+ "{s}"</button>))}</div>}
                                    </div>
                                </div>
                            )}

                            {promptMode === 'full' && (
                                <div className="animate-fade-in">
                                    <div className="flex justify-between items-center mb-2.5">
                                        <h3 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Describe the entire scene</h3>
                                        <button onClick={() => handleGetSuggestions()} disabled={isGeneratingSuggestions || !fullPrompt} className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-brand-accent/15 text-brand-accent font-extrabold rounded-lg hover:bg-brand-accent hover:text-brand-primary disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all border border-brand-accent/20" aria-label="Get AI suggestions for full prompt"><SparklesIcon className="w-3.5 h-3.5" />{isGeneratingSuggestions ? 'Thinking...' : 'AI Suggestions'}</button>
                                    </div>
                                    <textarea value={fullPrompt} onChange={(e) => setFullPrompt(e.target.value)} placeholder="e.g., A photorealistic image of the product sitting on a rustic wooden table..." className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-brand-accent focus:border-brand-accent/80 transition-all h-48 resize-none text-xs text-gray-300 placeholder-gray-500" />
                                    {suggestions.length > 0 && <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">{suggestions.map((s, i) => (<button key={i} onClick={() => applySuggestion(s)} className="px-3 py-1 text-[10px] font-semibold bg-brand-accent/5 border border-brand-accent/20 rounded-full hover:bg-brand-accent hover:text-brand-primary transition-all text-brand-light">+ "{s}"</button>))}</div>}
                                </div>
                            )}

                              {promptMode === 'multiple' && (
                                <div className="animate-fade-in space-y-6">
                                    <div className="bg-brand-primary/30 border border-brand-accent/20 p-4 rounded-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-medium text-brand-accent">Number of Variations</h3>
                                            <div className="text-[10px] text-gray-500 italic">
                                                Determines how many prompts below will be processed.
                                            </div>
                                        </div>
                                        <VariationSelector selected={numberOfVariations} onSelect={setNumberOfVariations} />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-medium text-brand-accent">Individual Prompts (Max 40)</h3>
                                        <button 
                                            onClick={() => {
                                                setMultiplePrompts(new Array(40).fill(''));
                                                setNumberOfVariations(1);
                                            }}
                                            className="text-[10px] text-gray-400 hover:text-red-400 font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 group px-2 py-1 rounded hover:bg-red-500/10"
                                            title="Reset all 40 prompt slots"
                                        >
                                            <CloseIcon className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                                            Clear All
                                        </button>
                                    </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Array.from({ length: 40 }).map((_, index) => {
                                            const isActive = index < numberOfVariations;
                                            const hasText = multiplePrompts[index]?.trim() !== '';
                                            return (
                                                <div key={index} className={`relative group transition-all duration-200 ${isActive ? 'opacity-100 scale-100 z-10' : 'opacity-60 scale-95 grayscale-[50%] hover:opacity-100 hover:grayscale-0 hover:scale-100'}`}>
                                                    <div className={`absolute -left-3 top-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-20 transition-colors ${isActive ? 'bg-brand-accent text-brand-primary border-2 border-white' : 'bg-gray-700 text-gray-300'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <div className="relative">
                                                        <textarea 
                                                            value={multiplePrompts[index]} 
                                                            onChange={(e) => {
                                                                const newPrompts = [...multiplePrompts];
                                                                newPrompts[index] = e.target.value;
                                                                setMultiplePrompts(newPrompts);
                                                                // Auto-activate slot if typing
                                                                if (index + 1 > numberOfVariations && e.target.value.trim().length > 0) {
                                                                    setNumberOfVariations(index + 1);
                                                                }
                                                            }} 
                                                            placeholder={`Prompt ${index + 1}: Describe variation ${index + 1}...`} 
                                                            className={`w-full p-4 pl-8 bg-brand-primary border-2 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all duration-200 h-32 resize-none shadow-lg ${isActive ? 'border-brand-accent/50 shadow-brand-accent/5' : 'border-gray-700/50'}`}
                                                        />
                                                        <div className="absolute top-2 right-2 flex items-center gap-1">
                                                            {isActive && hasText && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newPrompts = [...multiplePrompts];
                                                                            newPrompts[index] = '';
                                                                            setMultiplePrompts(newPrompts);
                                                                        }} 
                                                                        className="p-1.5 bg-gray-800/80 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                                                        title="Clear this specific prompt"
                                                                    >
                                                                        <CloseIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleGetSuggestions(index)} 
                                                                        disabled={isGeneratingSuggestions}
                                                                        className="p-1.5 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold border border-brand-accent/20"
                                                                        title="AI help for this variation"
                                                                    >
                                                                        <SparklesIcon className="w-3.5 h-3.5" />
                                                                        {isGeneratingSuggestions ? '...' : 'AI Help'}
                                                                    </button>
                                                                </>
                                                            )}
                                                            {isActive && !hasText && (
                                                                <button 
                                                                    onClick={() => handleGetSuggestions(index)} 
                                                                    disabled={isGeneratingSuggestions}
                                                                    className="p-1.5 bg-gray-800 hover:bg-gray-700 text-brand-accent rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                                                                    title="Get AI prompt suggestions"
                                                                >
                                                                    <SparklesIcon className="w-3 h-3" />
                                                                    {isGeneratingSuggestions ? '...' : 'Get Idea'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {suggestions.length > 0 && (
                                        <div className="bg-brand-primary/50 border border-brand-accent/30 p-3 rounded-lg animate-fade-in">
                                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 tracking-wider">AI Suggestions</div>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestions.map((s, i) => (
                                                    <button 
                                                        key={i} 
                                                        onClick={() => {
                                                            // We apply it to the first active prompt that might need it, or just generic behavior
                                                            // For multiple, we don't have a simple apply target unless we track which index triggered it.
                                                            // But usually suggestions are for the focused one. 
                                                            // For now, let's just show them.
                                                            setSuggestions([]); 
                                                        }} 
                                                        className="px-3 py-1 text-xs bg-brand-primary border border-brand-accent rounded-full hover:bg-brand-accent hover:text-brand-primary transition-colors"
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
                                            <div className="grid grid-cols-2 sm:grid-cols-4 bg-black/40 border border-white/5 rounded-xl p-1 gap-1.5">
                                                 <button onClick={() => setModelType('standard')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'standard' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Nano</button>
                                                 <button onClick={() => setModelType('pro')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'pro' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Pro (Banana)</button>
                                                 <button onClick={() => setModelType('ultra')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'ultra' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Banana 2</button>
                                                 <button onClick={() => setModelType('light')} className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${modelType === 'light' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Lite</button>
                                            </div>
                                        </div>
                                         <div>
                                            <h4 className="text-xs font-semibold mb-2 text-brand-light">Resolution (Advanced Only)</h4>
                                            <ImageSizeSelector selected={imageSize} onSelect={setImageSize} disabled={modelType === 'standard'} />
                                        </div>
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
                                            <h4 className="text-[11px] font-bold text-brand-light uppercase tracking-wider mb-2">Variations</h4>
                                            <VariationSelector selected={numberOfVariations} onSelect={setNumberOfVariations} />
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
                    onImageSelect={(fullRes) => { setGeneratedAds({ images: [{ url: fullRes, variantIndex: 0 }], errors: [] }); setGeneratedVideo(null); }} 
                    onClearHistory={handleClearHistory} 
                />
            </div>
            {/* Image Modal */}
            <ImageModal 
                isOpen={!!selectedModalImage}
                onClose={() => setSelectedModalImage(null)}
                imageSrc={selectedModalImage?.src || ''}
                alt={selectedModalImage?.alt || ''}
            />
        </div>
    );
};

export default App;
