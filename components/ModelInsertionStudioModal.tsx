import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ImageData, AspectRatio, ModelType, AdVariation, InsertModelParams } from '../types';
import { CloseIcon, SparklesIcon, PhotoIcon, ArrowPathIcon, CheckIcon, UserIcon, LayersIcon, DownloadIcon } from './icons';
import { insertModelIntoScene } from '../services/geminiService';
import { downloadSingleImage } from '../utils/downloadUtils';
import { FileNamePromptModal } from './FileNamePromptModal';

interface ModelInsertionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSceneImages?: ImageData[];
  availableModelImages?: ImageData[];
  allWorkspaceImages?: ImageData[];
  onApplyResultToWorkspace?: (images: { url: string; variantIndex: number }[]) => void;
  initialSceneImage?: ImageData | null;
  initialModelImage?: ImageData | null;
  initialMode?: 'swap' | 'insert';
  initialTargetSubject?: string;
}

export const ModelInsertionStudioModal: React.FC<ModelInsertionStudioModalProps> = ({
  isOpen,
  onClose,
  availableSceneImages = [],
  availableModelImages = [],
  allWorkspaceImages = [],
  onApplyResultToWorkspace,
  initialSceneImage = null,
  initialModelImage = null,
  initialMode = 'swap',
  initialTargetSubject = 'the woman',
}) => {
  const combinedWorkspaceImages = useMemo(() => {
    const merged: ImageData[] = [];
    const seen = new Set<string>();
    const add = (list: ImageData[]) => {
      for (const img of list) {
        if (!img?.base64) continue;
        const key = `${img.name || ''}_${img.base64.slice(0, 40)}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(img);
        }
      }
    };
    add(allWorkspaceImages);
    add(availableSceneImages);
    add(availableModelImages);
    return merged;
  }, [allWorkspaceImages, availableSceneImages, availableModelImages]);

  const [studioMode, setStudioMode] = useState<'swap' | 'insert'>(initialMode);
  const [sceneImage, setSceneImage] = useState<ImageData | null>(initialSceneImage || combinedWorkspaceImages[0] || null);
  const [modelImage, setModelImage] = useState<ImageData | null>(initialModelImage || combinedWorkspaceImages[1] || availableModelImages[0] || null);

  const [targetSubject, setTargetSubject] = useState<string>(initialTargetSubject || 'the woman');
  const [outfitMode, setOutfitMode] = useState<'keep-scene-outfit' | 'keep-model-outfit' | 'harmonize'>('keep-scene-outfit');
  const [placement, setPlacement] = useState<string>('Replace existing person in the original photo');
  const [actionOrPose, setActionOrPose] = useState<string>('Natural pose and expression matching the target scene');
  const [clothingStyle, setClothingStyle] = useState<string>('Outfit harmonizing naturally with the scene aesthetic');
  const [blendingMode, setBlendingMode] = useState<'seamless-blend' | 'replace-subject' | 'subtle-background' | 'hero-foreground'>(
    initialMode === 'swap' ? 'replace-subject' : 'seamless-blend'
  );
  const [customNotes, setCustomNotes] = useState<string>('');

  // Prop safety guard (checked by default to prevent tools/wands from reference photos from being inserted)
  const [excludeHandheldProps, setExcludeHandheldProps] = useState<boolean>(true);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [modelType, setModelType] = useState<ModelType>('pro');
  const [numberOfVariations, setNumberOfVariations] = useState<number>(2);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [results, setResults] = useState<AdVariation[] | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep studio synced when opened with new targets or workspace assets
  useEffect(() => {
    if (!isOpen) return;
    setStudioMode(initialMode);
    if (initialMode === 'swap') {
      setBlendingMode('replace-subject');
      setPlacement('Replace existing person in the original photo');
    } else {
      setBlendingMode('seamless-blend');
      setPlacement('Center foreground as the hero subject');
    }
    if (initialTargetSubject) {
      setTargetSubject(initialTargetSubject);
    }
    if (initialSceneImage) {
      setSceneImage(initialSceneImage);
    } else if (!sceneImage && combinedWorkspaceImages.length > 0) {
      setSceneImage(combinedWorkspaceImages[0]);
    }
    if (initialModelImage) {
      setModelImage(initialModelImage);
    } else if (!modelImage) {
      const candidate = availableModelImages[0] || combinedWorkspaceImages.find(img => img.base64 !== (initialSceneImage?.base64 || sceneImage?.base64)) || null;
      setModelImage(candidate);
    }
    setErrorMessage(null);
  }, [isOpen, initialMode, initialSceneImage, initialModelImage, initialTargetSubject]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'scene' | 'model') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const imgData: ImageData = {
        base64,
        mimeType,
        name: file.name,
      };

      if (target === 'scene') {
        setSceneImage(imgData);
      } else {
        setModelImage(imgData);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFlipSlots = () => {
    const prevScene = sceneImage;
    setSceneImage(modelImage);
    setModelImage(prevScene);
  };

  const handleSwitchMode = (mode: 'swap' | 'insert') => {
    setStudioMode(mode);
    if (mode === 'swap') {
      setBlendingMode('replace-subject');
      setPlacement('Replace existing person in the original photo');
    } else {
      setBlendingMode('seamless-blend');
      setPlacement('Center foreground as the hero subject');
    }
  };

  const handleGenerate = async () => {
    if (!sceneImage || !modelImage) {
      setErrorMessage(
        studioMode === 'swap'
          ? 'Please select or upload both the Target Scene Photo (with the person to replace) and the Replacement Character Photo.'
          : 'Please provide both the original reference photo and the portrait/model photo.'
      );
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setGenerationStep(
      studioMode === 'swap'
        ? `Removing "${targetSubject || 'the person'}" from ${sceneImage.name || 'target scene'} & preparing swap...`
        : 'Analyzing reference scene perspective & lighting...'
    );

    abortControllerRef.current = new AbortController();

    try {
      const timer1 = setTimeout(
        () =>
          setGenerationStep(
            studioMode === 'swap'
              ? `Extracting identity, skin tone & hair from ${modelImage.name || 'replacement character'}...`
              : 'Extracting facial identity & hair texture (omitting handheld props)...'
          ),
        1800
      );
      const timer2 = setTimeout(
        () => setGenerationStep('Harmonizing depth of field, color cast, and realistic contact shadows...'),
        4500
      );

      const params: InsertModelParams = {
        sceneImage,
        modelImage,
        mode: studioMode,
        targetSubject: targetSubject.trim() || 'the person',
        outfitMode,
        placement,
        actionOrPose,
        clothingStyle,
        blendingMode: studioMode === 'swap' ? 'replace-subject' : blendingMode,
        customNotes,
        aspectRatio,
        modelType,
        numberOfVariations,
        excludeHandheldProps,
      };

      const response = await insertModelIntoScene(params, abortControllerRef.current.signal);

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (response.images && response.images.length > 0) {
        setResults(response.images);
        setActiveResultIndex(0);
      } else {
        throw new Error('No composite image generated.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setErrorMessage('Generation cancelled.');
      } else {
        setErrorMessage(err.message || 'Failed to swap/insert character into photo. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleApplyToWorkspace = () => {
    if (!results || results.length === 0 || !onApplyResultToWorkspace) return;
    onApplyResultToWorkspace(results);
    onClose();
  };

  const defaultCompositeName = studioMode === 'swap'
    ? `character_swap_${activeResultIndex + 1}`
    : `model_inserted_composite_${activeResultIndex + 1}`;

  const executeDownloadActiveResult = (customName?: string) => {
    if (!results || !results[activeResultIndex]) return;
    const url = results[activeResultIndex].url;
    const finalBase = customName || defaultCompositeName;
    const filename = `${finalBase}.png`;
    downloadSingleImage(url, filename, 'png');
  };

  const handleDownloadActiveResult = () => {
    if (!results || !results[activeResultIndex]) return;
    setIsNamePromptOpen(true);
  };

  const scenePickList = combinedWorkspaceImages;
  const modelPickList = combinedWorkspaceImages;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className="bg-brand-secondary/95 border border-indigo-500/30 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-xl text-purple-400">
              <LayersIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {studioMode === 'swap' ? 'Simple Character Swap Studio' : 'Insert Model into Reference Photo'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  {studioMode === 'swap' ? 'Character Swap' : 'Model Compositor'}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {studioMode === 'swap'
                  ? 'Pick the target scene photo (Image 1) and the replacement person photo (Image 2). Keeps the scene intact and swaps ONLY the person.'
                  : 'Supply an original scene photo plus a model portrait to composite her into the setting with matched lighting and perspective.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleSwitchMode('swap')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  studioMode === 'swap'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Swap Character
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('insert')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  studioMode === 'insert'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Insert Model
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
          {/* Step 1 & 2: Two Reference Photo Slots */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
            {/* Slot A: Target Scene Photo */}
            <div className="p-4 bg-black/40 border border-blue-500/25 rounded-2xl space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Image 1 • Base Scene
                  </span>
                  <span className="font-bold text-xs text-white">
                    {studioMode === 'swap' ? 'Target Photo (Person to Replace)' : 'Original Scene / Setting'}
                  </span>
                </div>
                {sceneImage && (
                  <button
                    type="button"
                    onClick={() => setSceneImage(null)}
                    className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {sceneImage ? (
                <div className="space-y-2">
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center relative group/img">
                    <img
                      src={`data:${sceneImage.mimeType};base64,${sceneImage.base64}`}
                      alt="Target Scene Reference"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] text-cyan-200 font-mono truncate max-w-[85%] border border-white/10">
                      @{sceneImage.name || 'target_scene.png'}
                    </div>
                  </div>
                  <label className="block text-center cursor-pointer">
                    <span className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                      Upload Different Target Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'scene')}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-white/15 hover:border-blue-400/50 rounded-xl cursor-pointer bg-white/[0.01] hover:bg-blue-500/[0.03] transition-all p-4 text-center">
                  <PhotoIcon className="w-8 h-8 text-blue-400/70 mb-2" />
                  <span className="text-xs font-semibold text-gray-200">
                    {studioMode === 'swap' ? 'Upload Target Scene (e.g. Frame-03.png)' : 'Upload Original Reference Photo'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1">
                    {studioMode === 'swap' ? 'The photo whose background stays & person gets replaced' : 'Environment, room, outdoor backdrop, or product scene'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'scene')}
                    className="hidden"
                  />
                </label>
              )}

              {/* Quick Pick from ALL workspace photos */}
              {scenePickList.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    Pick from uploaded photos ({scenePickList.length}):
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {scenePickList.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSceneImage(img)}
                        title={img.name || `Photo ${idx + 1}`}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 transition-all cursor-pointer group/thumb ${
                          sceneImage?.base64 === img.base64
                            ? 'border-blue-500 ring-2 ring-blue-500/60'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={`data:${img.mimeType};base64,${img.base64}`}
                          alt={img.name || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {img.name && (
                          <span className="absolute inset-x-0 bottom-0 bg-black/75 text-[8px] text-gray-200 truncate px-1 py-0.5 font-mono">
                            {img.name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Flip A <-> B Button */}
            <button
              type="button"
              onClick={handleFlipSlots}
              title="Swap Image 1 and Image 2"
              className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#1a1635] hover:bg-purple-600 border border-purple-400/50 text-purple-200 hover:text-white items-center justify-center shadow-xl transition-all cursor-pointer active:scale-90"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>

            {/* Slot B: Replacement Character Photo */}
            <div className="p-4 bg-black/40 border border-purple-500/25 rounded-2xl space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Image 2 • New Person
                  </span>
                  <span className="font-bold text-xs text-white">
                    {studioMode === 'swap' ? 'Replacement Person Photo' : 'Portrait / Model Photo'}
                  </span>
                </div>
                {modelImage && (
                  <button
                    type="button"
                    onClick={() => setModelImage(null)}
                    className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {modelImage ? (
                <div className="space-y-2">
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center relative group/img">
                    <img
                      src={`data:${modelImage.mimeType};base64,${modelImage.base64}`}
                      alt="Replacement Character Reference"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] text-purple-200 font-mono truncate max-w-[85%] border border-white/10">
                      @{modelImage.name || 'replacement_person.png'}
                    </div>
                  </div>
                  <label className="block text-center cursor-pointer">
                    <span className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                      Upload Different Person Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'model')}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-white/15 hover:border-purple-400/50 rounded-xl cursor-pointer bg-white/[0.01] hover:bg-purple-500/[0.03] transition-all p-4 text-center">
                  <UserIcon className="w-8 h-8 text-purple-400/70 mb-2" />
                  <span className="text-xs font-semibold text-gray-200">
                    {studioMode === 'swap' ? 'Upload Replacement Person (e.g. frame-01N.webp)' : 'Upload Portrait or Model Photo'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1">
                    {studioMode === 'swap' ? 'Only her face, skin tone, hair & likeness will be transferred' : 'Selfie, headshot, or full-body model photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'model')}
                    className="hidden"
                  />
                </label>
              )}

              {/* Quick Pick from ALL workspace photos */}
              {modelPickList.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    Pick from uploaded photos ({modelPickList.length}):
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {modelPickList.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setModelImage(img)}
                        title={img.name || `Photo ${idx + 1}`}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 transition-all cursor-pointer ${
                          modelImage?.base64 === img.base64
                            ? 'border-purple-500 ring-2 ring-purple-500/60'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={`data:${img.mimeType};base64,${img.base64}`}
                          alt={img.name || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {img.name && (
                          <span className="absolute inset-x-0 bottom-0 bg-black/75 text-[8px] text-gray-200 truncate px-1 py-0.5 font-mono">
                            {img.name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Flip Button */}
          <div className="flex md:hidden justify-center">
            <button
              type="button"
              onClick={handleFlipSlots}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-purple-300"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Flip Target ↔ Replacement</span>
            </button>
          </div>

          {/* Step 3: Swap / Compositing Controls */}
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2">
              <SparklesIcon className="w-4 h-4" />
              {studioMode === 'swap' ? 'Character Swap Setup' : 'Compositing Setup & Placement'}
            </h4>

            {studioMode === 'swap' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Who to replace */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Who in Image 1 should be replaced?</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['the woman', 'the man', 'the main person', 'person on the left', 'person on the right'].map((who) => (
                      <button
                        key={who}
                        type="button"
                        onClick={() => setTargetSubject(who)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          targetSubject.toLowerCase() === who
                            ? 'bg-purple-600/30 border-purple-500 text-white font-semibold'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {who}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={targetSubject}
                    onChange={(e) => setTargetSubject(e.target.value)}
                    placeholder="e.g. the woman in the white shirt, person on the curb..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {/* Outfit handling */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Outfit & Clothing During Swap:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'keep-scene-outfit' as const, label: 'Keep Scene Outfit', desc: 'Swap identity only' },
                      { id: 'keep-model-outfit' as const, label: 'Keep New Outfit', desc: 'Bring Image 2 clothes' },
                      { id: 'harmonize' as const, label: 'Harmonize', desc: 'Match scene naturally' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOutfitMode(opt.id)}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          outfitMode === opt.id
                            ? 'bg-indigo-600/30 border-indigo-400 text-white'
                            : 'bg-white/[0.02] border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-bold">{opt.label}</div>
                        <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Position Presets for Insert Mode */
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Where should she be placed?</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Center foreground as the hero subject',
                    'Sitting comfortably on the furniture / surface',
                    'Standing on the left side of the scene',
                    'Standing on the right side of the scene',
                    'In the midground naturally enjoying the setting',
                    'Replace existing person in the original photo',
                  ].map((pos, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPlacement(pos)}
                      className={`px-3 py-2 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer ${
                        placement === pos
                          ? 'bg-purple-600/30 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                          : 'bg-white/[0.02] border-white/10 text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  placeholder="Or type custom placement: e.g. Leaning against the kitchen island..."
                  className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            )}

            {/* Pose & Extra Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Pose & Expression:</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    'Natural pose and expression matching the target scene',
                    'Warm, natural smile looking at camera',
                    'Relaxed candid pose looking away',
                    'Walking naturally forward',
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActionOrPose(p)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition cursor-pointer ${
                        actionOrPose === p
                          ? 'bg-indigo-500/30 border-indigo-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={actionOrPose}
                  onChange={(e) => setActionOrPose(e.target.value)}
                  placeholder="e.g. Same pose as target scene, smiling..."
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  {studioMode === 'swap' ? 'Additional Swap Notes (Optional):' : 'Wardrobe & Attire:'}
                </label>
                {studioMode === 'swap' ? (
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Keep her wearing the knee sleeve on her right leg..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {[
                        'Outfit harmonizing naturally with the scene aesthetic',
                        'Modern casual chic',
                        'Keep clothing style from portrait photo',
                      ].map((w, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setClothingStyle(w)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition cursor-pointer ${
                            clothingStyle === w
                              ? 'bg-indigo-500/30 border-indigo-500 text-white'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={clothingStyle}
                      onChange={(e) => setClothingStyle(e.target.value)}
                      placeholder="e.g. White linen shirt, cozy cashmere sweater..."
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Prop Exclusion Banner */}
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-200">
                  <strong>Identity & Ethnicity Lock + Background Guard:</strong> Transfers person's face, skin tone & hair cleanly without copying background clutter or handheld tools.
                </span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-300 shrink-0">
                <input
                  type="checkbox"
                  checked={excludeHandheldProps}
                  onChange={(e) => setExcludeHandheldProps(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-700 text-emerald-500 bg-black/40"
                />
                <span>Clean hands</span>
              </label>
            </div>

            {/* Model & Variations Options */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 text-xs">
              <div>
                <label className="block text-gray-400 text-[11px] mb-1">AI Engine:</label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as ModelType)}
                  className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-white text-xs"
                >
                  <option value="pro">Gemini 3 Pro (PRO Quality - Default)</option>
                  <option value="nano-banana-2.1">Nano Banana 2.1 (Gemini 3.6 Flash Image)</option>
                  <option value="ultra">Gemini 3.1 Flash Image (Fast & High Res)</option>
                  <option value="standard">Standard (Flash Lite)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1">Aspect Ratio:</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-white text-xs"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Story / Reel</option>
                  <option value="4:3">4:3 Photo Standard</option>
                  <option value="3:4">3:4 Portrait</option>
                  <option value="4:5">4:5 Instagram Feed</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1">Variations:</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumberOfVariations(num)}
                      className={`flex-1 py-1 rounded border text-xs font-bold transition cursor-pointer ${
                        numberOfVariations === num
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-white"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Results Preview (if generated) */}
          {results && results.length > 0 && (
            <div className="bg-black/50 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-300">
                    <CheckIcon className="w-4 h-4" />
                  </span>
                  <span className="font-bold text-sm text-white">
                    {studioMode === 'swap' ? `Character Swap Results (${results.length})` : `Composited Results (${results.length})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadActiveResult}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  {onApplyResultToWorkspace && (
                    <button
                      type="button"
                      onClick={handleApplyToWorkspace}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      <SparklesIcon className="w-3.5 h-3.5" />
                      <span>Use in Workspace (Upscale / Animate)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Main Image View */}
              <div className="w-full max-h-[460px] rounded-xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                <img
                  src={results[activeResultIndex].url}
                  alt={`Result variation ${activeResultIndex + 1}`}
                  className="max-h-[460px] w-auto max-w-full object-contain"
                />
              </div>

              {/* Variation Thumbnails */}
              {results.length > 1 && (
                <div className="flex gap-2.5 justify-center overflow-x-auto pt-1">
                  {results.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveResultIndex(i)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all w-20 h-20 flex-shrink-0 cursor-pointer ${
                        activeResultIndex === i
                          ? 'border-purple-500 scale-105 shadow-lg shadow-purple-500/20'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={res.url}
                        alt={`Variation ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.2 bg-black/70 rounded text-[9px] text-white font-bold">
                        #{i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition text-xs font-semibold cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isGenerating && (
              <span className="text-xs text-purple-300 font-medium animate-pulse flex items-center gap-1.5">
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                {generationStep || 'Processing swap...'}
              </span>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !sceneImage || !modelImage}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  <span>{studioMode === 'swap' ? 'Swapping Character...' : 'Compositing Scene...'}</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 text-purple-200" />
                  <span>{studioMode === 'swap' ? 'Swap Character Now' : 'Insert Model into Photo Now'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filename prompt modal */}
      <FileNamePromptModal
        isOpen={isNamePromptOpen}
        onClose={() => setIsNamePromptOpen(false)}
        onConfirm={(name) => executeDownloadActiveResult(name)}
        title="Export Result Image (PNG)"
        subtitle={`Result #${activeResultIndex + 1}`}
        description="Choose whether to keep the default file name or enter a custom name before exporting."
        defaultName={defaultCompositeName}
        extension="png"
      />
    </div>
  );
};
