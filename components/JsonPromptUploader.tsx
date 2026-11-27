import React, { useState, useRef } from 'react';
import { UploadIcon, DownloadIcon, DocumentTextIcon, CodeBracketIcon, CloseIcon, SparklesIcon } from './icons';
import type { ImageData } from '../types';

interface ExtractedPromptItem {
  id: string;
  prompt: string;
  fileName?: string;
  referenceImages?: string[];
  embeddedImages?: ImageData[];
  disabled?: boolean;
}

interface JsonPromptUploaderProps {
  onPromptsLoaded: (
    prompts: string[], 
    mode: 'replace' | 'append', 
    fileName: string, 
    promptIds?: string[], 
    promptFileNames?: string[],
    promptReferenceImages?: string[][],
    embeddedReferences?: ImageData[],
    disabledFlags?: boolean[]
  ) => void;
  currentPrompts: string[];
  currentPromptIds?: string[];
  currentPromptFileNames?: string[];
  currentPromptReferenceImages?: string[][];
  currentDisabledPrompts?: boolean[];
}

export const JsonPromptUploader: React.FC<JsonPromptUploaderProps> = ({ 
  onPromptsLoaded, 
  currentPrompts, 
  currentPromptIds,
  currentPromptFileNames,
  currentPromptReferenceImages,
  currentDisabledPrompts
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; name: string; filesCount?: number; refsCount?: number } | null>(null);
  const [previewItems, setPreviewItems] = useState<ExtractedPromptItem[] | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to extract schema ID from an object
  const extractIdFromNode = (obj: any, fallbackIndex: number): string => {
    if (!obj || typeof obj !== 'object') return String(fallbackIndex + 1);
    if (obj.id !== undefined && obj.id !== null && String(obj.id).trim() !== '') {
      return String(obj.id).trim();
    }
    if (obj.prompt_id !== undefined && obj.prompt_id !== null && String(obj.prompt_id).trim() !== '') {
      return String(obj.prompt_id).trim();
    }
    if (obj.prompt_number !== undefined && obj.prompt_number !== null && String(obj.prompt_number).trim() !== '') {
      return String(obj.prompt_number).trim();
    }
    if (obj.slot !== undefined && obj.slot !== null && String(obj.slot).trim() !== '') {
      return String(obj.slot).trim();
    }
    if (obj.name !== undefined && obj.name !== null && String(obj.name).trim() !== '') {
      return String(obj.name).trim();
    }
    return String(fallbackIndex + 1);
  };

  // Helper to detect if a prompt node is marked as disabled / inactive
  const extractDisabledFromNode = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.disabled === true || obj.disabled === 'true' || obj.disabled === 1) return true;
    if (obj.enabled === false || obj.enabled === 'false' || obj.enabled === 0) return true;
    if (obj.active === false || obj.active === 'false' || obj.active === 0) return true;
    return false;
  };

  // Helper to detect and clean 'file' or 'file_name' from any JSON node or candidate object
  const extractFileNameFromNode = (obj: any, parentFileName?: string): string | undefined => {
    if (!obj || typeof obj !== 'object') return parentFileName;

    const candidateKeys = [
      'file',
      'file_name',
      'fileName',
      'filename',
      'image_file',
      'image_filename',
      'img_file',
      'photo_file',
      'photo_name',
      'product_file',
      'product_image',
      'reference_file',
      'target_file',
      'file_path',
      'filePath'
    ];

    for (const key of candidateKeys) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        // Strip folder path if present: e.g. "images/watch.png" -> "watch.png"
        const clean = val.trim().replace(/^.*[\\/]/, '').trim();
        if (clean.length > 0) {
          return clean;
        }
      }
      if (val && typeof val === 'object') {
        if (typeof val.name === 'string' && val.name.trim().length > 0) {
          return val.name.trim().replace(/^.*[\\/]/, '').trim();
        }
        if (typeof val.file_name === 'string' && val.file_name.trim().length > 0) {
          return val.file_name.trim().replace(/^.*[\\/]/, '').trim();
        }
        if (typeof val.fileName === 'string' && val.fileName.trim().length > 0) {
          return val.fileName.trim().replace(/^.*[\\/]/, '').trim();
        }
        if (typeof val.filename === 'string' && val.filename.trim().length > 0) {
          return val.filename.trim().replace(/^.*[\\/]/, '').trim();
        }
        if (typeof val.file === 'string' && val.file.trim().length > 0) {
          return val.file.trim().replace(/^.*[\\/]/, '').trim();
        }
      }
    }

    // Check if `image` or `photo` is a filename string (has image extension and not http/data:)
    if (typeof obj.image === 'string') {
      const val = obj.image.trim();
      if (!/^(https?:\/\/|data:image)/i.test(val) && /\.(png|jpe?g|webp|gif|svg)$/i.test(val)) {
        return val.replace(/^.*[\\/]/, '').trim();
      }
    }
    if (typeof obj.photo === 'string') {
      const val = obj.photo.trim();
      if (!/^(https?:\/\/|data:image)/i.test(val) && /\.(png|jpe?g|webp|gif|svg)$/i.test(val)) {
        return val.replace(/^.*[\\/]/, '').trim();
      }
    }

    return parentFileName;
  };

  // Helper to detect 'reference_images' or extra references from any JSON node
  const extractReferenceImagesFromNode = (obj: any): { names: string[]; images: ImageData[] } => {
    const names: string[] = [];
    const images: ImageData[] = [];
    if (!obj || typeof obj !== 'object') return { names, images };

    const candidateKeys = [
      'reference_images',
      'reference_image',
      'referenceImages',
      'referenceImage',
      'extra_references',
      'extra_reference_images',
      'extra_reference',
      'references',
      'reference_photos',
      'reference_files',
      'ref_images',
      'ref_image'
    ];

    const processItem = (item: any) => {
      if (!item) return;
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) return;
        // Data URL
        if (trimmed.startsWith('data:image/')) {
          const match = trimmed.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (match) {
            const autoName = `ref_${names.length + 1}.png`;
            images.push({
              base64: match[2],
              mimeType: match[1],
              name: autoName
            });
            if (!names.includes(autoName)) names.push(autoName);
            return;
          }
        }
        // Comma-separated list of filenames
        if (trimmed.includes(',') && !trimmed.startsWith('http')) {
          const parts = trimmed.split(',').map(p => p.trim().replace(/^.*[\\/]/, '').trim()).filter(Boolean);
          parts.forEach(p => {
            if (!names.includes(p)) names.push(p);
          });
          return;
        }
        // Clean single filename or path
        const clean = trimmed.replace(/^.*[\\/]/, '').trim();
        if (clean && !names.includes(clean)) {
          names.push(clean);
        }
      } else if (typeof item === 'object') {
        let extractedName = '';
        if (typeof item.file === 'string') extractedName = item.file;
        else if (typeof item.file_name === 'string') extractedName = item.file_name;
        else if (typeof item.fileName === 'string') extractedName = item.fileName;
        else if (typeof item.filename === 'string') extractedName = item.filename;
        else if (typeof item.name === 'string') extractedName = item.name;
        else if (typeof item.image === 'string') extractedName = item.image;
        else if (typeof item.url === 'string') extractedName = item.url;
        else if (typeof item.path === 'string') extractedName = item.path;
        else if (typeof item.src === 'string') extractedName = item.src;
        else if (typeof item.description === 'string' && item.description.length < 50) extractedName = item.description;

        if (item.base64 && (item.mimeType || item.type)) {
          const imgName = (extractedName || `ref_${names.length + 1}.png`).replace(/^.*[\\/]/, '').trim();
          images.push({
            base64: item.base64,
            mimeType: item.mimeType || item.type || 'image/png',
            name: imgName
          });
          if (!names.includes(imgName)) names.push(imgName);
        } else if (extractedName) {
          const clean = extractedName.trim().replace(/^.*[\\/]/, '').trim();
          if (clean && !names.includes(clean)) names.push(clean);
        }
      }
    };

    for (const key of candidateKeys) {
      const val = obj[key];
      if (!val) continue;

      if (Array.isArray(val)) {
        val.forEach(processItem);
      } else if (typeof val === 'object' && !val.base64) {
        for (const [, subVal] of Object.entries(val)) {
          if (typeof subVal === 'string') {
            const clean = subVal.trim().replace(/^.*[\\/]/, '').trim();
            if (clean && !names.includes(clean)) names.push(clean);
          } else {
            processItem(subVal);
          }
        }
      } else {
        processItem(val);
      }
    }

    return { names, images };
  };

  // Helper to extract array of prompts with schema IDs, attached filenames, and extra reference images recursively
  const extractPromptsFromJson = (data: any): ExtractedPromptItem[] => {
    const rootFileName = extractFileNameFromNode(data);
    const rootRefs = extractReferenceImagesFromNode(data);

    // Helper to format a single object into a complete prompt string
    const formatPromptObject = (obj: any): string => {
      if (typeof obj === 'string') return obj.trim();
      if (typeof obj !== 'object' || obj === null) return '';

      // If there is an explicit full prompt string field
      if (typeof obj.prompt === 'string' && obj.prompt.trim().length > 0 && !obj.scene) {
        return obj.prompt.trim();
      }
      if (typeof obj.fullPrompt === 'string' && obj.fullPrompt.trim().length > 0) {
        return obj.fullPrompt.trim();
      }
      if (typeof obj.full_prompt === 'string' && obj.full_prompt.trim().length > 0) {
        return obj.full_prompt.trim();
      }

      // Construct prompt from structured sections (scene, camera, realism_block, skin_block, style_block, etc.)
      const parts: string[] = [];

      if (typeof obj.scene === 'string' && obj.scene.trim()) {
        parts.push(obj.scene.trim());
      } else if (typeof obj.prompt === 'string' && obj.prompt.trim()) {
        parts.push(obj.prompt.trim());
      } else if (typeof obj.description === 'string' && obj.description.trim()) {
        parts.push(obj.description.trim());
      } else if (typeof obj.text === 'string' && obj.text.trim()) {
        parts.push(obj.text.trim());
      }

      if (typeof obj.camera === 'string' && obj.camera.trim()) {
        parts.push(`Camera: ${obj.camera.trim()}`);
      }

      if (typeof obj.realism_block === 'string' && obj.realism_block.trim()) {
        parts.push(`Realism: ${obj.realism_block.trim()}`);
      }

      if (typeof obj.skin_block === 'string' && obj.skin_block.trim()) {
        parts.push(`Skin: ${obj.skin_block.trim()}`);
      }

      if (typeof obj.style_block === 'string' && obj.style_block.trim()) {
        parts.push(`Style: ${obj.style_block.trim()}`);
      }

      if (typeof obj.emotional_job === 'string' && obj.emotional_job.trim()) {
        parts.push(`Emotional Goal: ${obj.emotional_job.trim()}`);
      }

      // If we collected structured parts, return them joined
      if (parts.length > 0) {
        return parts.join(' ');
      }

      // Fallback: collect any remaining string values in the object that aren't metadata keys
      const METADATA_KEYS = /^(id|prompt_id|prompt_number|file|file_name|filename|fileName|image_file|photo_file|photo_name|product_file|file_path|filePath|slot|aspect_ratio|type|version|url|uri|status|timestamp|created_at|author|reference_images|reference_image|referenceImages|referenceImage|extra_references|extra_reference_images|extra_reference|references|reference_photos|reference_files|ref_images|ref_image)$/i;
      const fallbackParts: string[] = [];
      for (const key of Object.keys(obj)) {
        if (!METADATA_KEYS.test(key) && typeof obj[key] === 'string' && obj[key].trim().length > 0) {
          fallbackParts.push(obj[key].trim());
        }
      }

      return fallbackParts.join(' ');
    };

    // 1. First search: Collect all objects that have `prompt_number` or `prompt_id` anywhere in the JSON
    const promptObjectsWithNum: { num: number; obj: any }[] = [];
    const findObjectsWithPromptNumber = (node: any) => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) findObjectsWithPromptNumber(item);
        return;
      }
      if (typeof node.prompt_number === 'number' || (typeof node.prompt_number === 'string' && !isNaN(Number(node.prompt_number)))) {
        promptObjectsWithNum.push({ num: Number(node.prompt_number), obj: node });
      } else if (typeof node.prompt_id === 'string' && /prompt|diane|img|image|item|slot/i.test(node.prompt_id)) {
        const match = node.prompt_id.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : 999;
        promptObjectsWithNum.push({ num, obj: node });
      } else {
        for (const key of Object.keys(node)) {
          findObjectsWithPromptNumber(node[key]);
        }
      }
    };

    findObjectsWithPromptNumber(data);

    if (promptObjectsWithNum.length > 0) {
      // Sort by prompt_number ascending
      promptObjectsWithNum.sort((a, b) => a.num - b.num);
      const results: ExtractedPromptItem[] = [];
      promptObjectsWithNum.forEach((item, idx) => {
        const p = formatPromptObject(item.obj);
        if (p.length > 0) {
          const itemRefs = extractReferenceImagesFromNode(item.obj);
          const combinedNames = Array.from(new Set([...itemRefs.names, ...rootRefs.names]));
          const combinedImages = [...itemRefs.images, ...rootRefs.images];
          results.push({
            id: extractIdFromNode(item.obj, idx),
            fileName: extractFileNameFromNode(item.obj, rootFileName),
            referenceImages: combinedNames.length > 0 ? combinedNames : undefined,
            embeddedImages: combinedImages.length > 0 ? combinedImages : undefined,
            disabled: extractDisabledFromNode(item.obj),
            prompt: p
          });
        }
      });
      if (results.length > 0) return results;
    }

    // 2. Second search: Check if there is an array under `images`, `prompts`, `variations`, `items`, `data`, or if root is an array
    let candidateArray: any[] | null = null;
    if (Array.isArray(data)) {
      candidateArray = data;
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data.images)) candidateArray = data.images;
      else if (Array.isArray(data.prompts)) candidateArray = data.prompts;
      else if (Array.isArray(data.variations)) candidateArray = data.variations;
      else if (Array.isArray(data.items)) candidateArray = data.items;
      else if (Array.isArray(data.data)) candidateArray = data.data;
      else if (Array.isArray(data.batch)) candidateArray = data.batch;
    }

    if (candidateArray && candidateArray.length > 0) {
      const results: ExtractedPromptItem[] = [];
      candidateArray.forEach((item, idx) => {
        const p = formatPromptObject(item);
        if (p.length > 0 && !/^(http:\/\/|https:\/\/|data:image)/i.test(p)) {
          const itemRefs = extractReferenceImagesFromNode(item);
          const combinedNames = Array.from(new Set([...itemRefs.names, ...rootRefs.names]));
          const combinedImages = [...itemRefs.images, ...rootRefs.images];
          results.push({
            id: extractIdFromNode(item, idx),
            fileName: extractFileNameFromNode(item, rootFileName),
            referenceImages: combinedNames.length > 0 ? combinedNames : undefined,
            embeddedImages: combinedImages.length > 0 ? combinedImages : undefined,
            disabled: extractDisabledFromNode(item),
            prompt: p
          });
        }
      });
      if (results.length > 0) return results;
    }

    // 3. Fallback: Generic recursive search for string prompts or objects with prompt keys
    const fallbackResults: ExtractedPromptItem[] = [];
    const traverseGeneric = (node: any) => {
      if (!node) return;
      if (typeof node === 'string') {
        const trimmed = node.trim();
        if (trimmed.length > 15 && !/^(http:\/\/|https:\/\/|data:image)/i.test(trimmed)) {
          fallbackResults.push({
            id: String(fallbackResults.length + 1),
            fileName: rootFileName,
            referenceImages: rootRefs.names.length > 0 ? rootRefs.names : undefined,
            embeddedImages: rootRefs.images.length > 0 ? rootRefs.images : undefined,
            disabled: false,
            prompt: trimmed
          });
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(item => traverseGeneric(item));
        return;
      }
      if (typeof node === 'object') {
        const formatted = formatPromptObject(node);
        if (formatted.length > 15) {
          const itemRefs = extractReferenceImagesFromNode(node);
          const combinedNames = Array.from(new Set([...itemRefs.names, ...rootRefs.names]));
          const combinedImages = [...itemRefs.images, ...rootRefs.images];
          fallbackResults.push({
            id: extractIdFromNode(node, fallbackResults.length),
            fileName: extractFileNameFromNode(node, rootFileName),
            referenceImages: combinedNames.length > 0 ? combinedNames : undefined,
            embeddedImages: combinedImages.length > 0 ? combinedImages : undefined,
            disabled: extractDisabledFromNode(node),
            prompt: formatted
          });
        } else {
          Object.values(node).forEach(v => traverseGeneric(v));
        }
      }
    };

    traverseGeneric(data);
    return fallbackResults;
  };

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith('.json') && !file.name.endsWith('.txt')) {
      setError('Please upload a valid .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let parsed: any;
        
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr) {
          // If JSON parse fails, try splitting plain lines if txt/formatted
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('//'));
          if (lines.length > 0) {
            parsed = lines;
          } else {
            throw new Error('Invalid JSON file format. Could not parse JSON structure.');
          }
        }

        const prompts = extractPromptsFromJson(parsed);
        if (prompts.length === 0) {
          setError('No valid text prompts found in the uploaded JSON file. Ensure your JSON contains an array of strings or objects with a "prompt" property.');
          return;
        }

        setPreviewItems(prompts);
        setPendingFileName(file.name);
        setShowModal(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error reading JSON file');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file from disk');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const confirmImport = (mode: 'replace' | 'append') => {
    if (previewItems && previewItems.length > 0) {
      const prompts = previewItems.map(item => item.prompt);
      const ids = previewItems.map(item => item.id);
      const fileNames = previewItems.map(item => item.fileName || '');
      const referenceImages = previewItems.map(item => item.referenceImages || []);
      const disabledFlags = previewItems.map(item => item.disabled || false);
      const embeddedReferences: ImageData[] = [];
      previewItems.forEach(item => {
        if (item.embeddedImages && item.embeddedImages.length > 0) {
          embeddedReferences.push(...item.embeddedImages);
        }
      });
      onPromptsLoaded(prompts, mode, pendingFileName, ids, fileNames, referenceImages, embeddedReferences, disabledFlags);
      const filesCount = previewItems.filter(i => i.fileName).length;
      const refsCount = previewItems.reduce((acc, i) => acc + (i.referenceImages?.length || 0), 0);
      setSuccessInfo({ count: previewItems.length, name: pendingFileName, filesCount, refsCount });
      setShowModal(false);
      setPreviewItems(null);
    }
  };

  const downloadSampleJson = () => {
    const sampleData = [
      {
        id: "luxury_watch_01",
        file_name: "luxury_watch_front.png",
        reference_images: ["watch_side_angle.png", "dark_obsidian_texture.jpg"],
        disabled: false,
        prompt: "A photorealistic shot of a luxury watch sitting on dark obsidian stone with soft studio rim light and shallow depth of field."
      },
      {
        id: "outdoor_lifestyle_02",
        file: "cosmetic_serum_lifestyle.jpg",
        reference_images: ["model_reference_diane.png"],
        disabled: false,
        prompt: "A vibrant outdoor lifestyle advertisement showing a cheerful woman holding the product in a sunny park setting."
      },
      {
        id: "minimalist_tech_03",
        file_name: "tech_earbuds_angle.png",
        disabled: false,
        prompt: "A sleek minimalist tech product hero shot floating above a gradient neon background with subtle reflection."
      },
      {
        id: "cosmetic_serum_04",
        file: "cosmetic_serum_dropper.png",
        reference_images: ["water_droplets_macro.png", "serum_glass_clarity.jpg"],
        disabled: false,
        prompt: "An elegant cosmetic serum bottle resting on smooth wet river stones with gentle water splashes and morning light."
      },
      {
        id: "rustic_commercial_05",
        file_name: "organic_coffee_bag.jpg",
        reference_images: ["dark_oak_table_ref.png"],
        disabled: false,
        prompt: "A cinematic commercial scene of the product on a rustic dark oak table alongside fresh organic ingredients."
      }
    ];

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sampleData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "sample_ad_prompts.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCurrentPromptsToJson = () => {
    const activeEntries = currentPrompts
      .map((prompt, index) => ({
        prompt: prompt.trim(),
        id: (currentPromptIds && currentPromptIds[index]) ? currentPromptIds[index] : String(index + 1),
        fileName: (currentPromptFileNames && currentPromptFileNames[index]) ? currentPromptFileNames[index].trim() : '',
        referenceImages: (currentPromptReferenceImages && currentPromptReferenceImages[index]) ? currentPromptReferenceImages[index] : [],
        disabled: (currentDisabledPrompts && currentDisabledPrompts[index]) ? true : false
      }))
      .filter(item => item.prompt.length > 0);

    if (activeEntries.length === 0) {
      setError('No active prompts available to export. Enter some prompts or import a list first.');
      return;
    }

    const exportData = activeEntries.map((item) => ({
      id: item.id,
      ...(item.fileName ? { file_name: item.fileName } : {}),
      ...(item.referenceImages && item.referenceImages.length > 0 ? { reference_images: item.referenceImages } : {}),
      ...(item.disabled ? { disabled: true } : {}),
      prompt: item.prompt
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `exported_ad_prompts_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Upload Box Card */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
          isDragging 
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]' 
            : 'border-white/10 hover:border-indigo-500/40 bg-black/30 hover:bg-black/50'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".json,application/json,.txt" 
          className="hidden" 
        />
        
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-brand-accent shadow-lg shadow-indigo-500/5">
            <DocumentTextIcon className="w-8 h-8 animate-bounce-slow" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-white flex items-center justify-center gap-2">
              <span>Batch Upload Prompts File</span>
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-brand-accent/20 text-brand-accent rounded-full border border-brand-accent/30">
                .JSON
              </span>
            </h4>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Drag & drop a JSON file. Automatically detects <code className="text-emerald-300 font-mono font-bold">'file'</code>, <code className="text-emerald-300 font-mono font-bold">'file_name'</code>, and <code className="text-cyan-300 font-mono font-bold">'reference_images'</code> for extra visual references!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <UploadIcon className="w-4 h-4" />
              Upload JSON File
            </button>

            <button 
              type="button"
              onClick={downloadSampleJson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium rounded-xl text-xs transition-all"
              title="Download a template JSON file with file and file_name sample structure"
            >
              <CodeBracketIcon className="w-3.5 h-3.5 text-indigo-400" />
              Sample JSON
            </button>

            {currentPrompts.some(p => p.trim().length > 0) && (
              <button 
                type="button"
                onClick={exportCurrentPromptsToJson}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium rounded-xl text-xs transition-all"
                title="Export current active prompts with attached file names to JSON"
              >
                <DownloadIcon className="w-3.5 h-3.5 text-emerald-400" />
                Export Current JSON
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:text-white">
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successInfo && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Successfully imported <strong>{successInfo.count} prompts</strong> from <em>{successInfo.name}</em>!</span>
            {successInfo.filesCount !== undefined && successInfo.filesCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                {successInfo.filesCount} file name{successInfo.filesCount === 1 ? '' : 's'} attached
              </span>
            )}
            {successInfo.refsCount !== undefined && successInfo.refsCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                {successInfo.refsCount} extra reference{successInfo.refsCount === 1 ? '' : 's'} detected
              </span>
            )}
          </div>
          <button onClick={() => setSuccessInfo(null)} className="p-1 hover:text-white">
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {showModal && previewItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121028] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-brand-accent rounded-xl border border-indigo-500/30">
                  <DocumentTextIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>Import Batch Prompts</span>
                    {previewItems.some(i => i.fileName) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {previewItems.filter(i => i.fileName).length} files
                      </span>
                    )}
                    {previewItems.some(i => i.referenceImages && i.referenceImages.length > 0) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {previewItems.reduce((acc, i) => acc + (i.referenceImages?.length || 0), 0)} references
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400">Found {previewItems.length} prompt variations in <span className="text-indigo-300 font-mono">{pendingFileName}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal List Body */}
            <div className="p-5 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Prompt Variations Preview</span>
                <span className="text-[10px] text-gray-400 font-normal">Attached file names &amp; extra reference images</span>
              </div>
              {previewItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl text-xs text-gray-200 flex gap-3 items-start hover:border-white/10 transition-colors">
                  <div className="flex flex-col gap-1 items-start flex-shrink-0">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-mono font-bold rounded text-[10px] border border-indigo-500/30">
                      ID: {item.id}
                    </span>
                    {item.fileName && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded text-[10px] border border-emerald-500/30 flex items-center gap-1" title={`Attached File Name: "${item.fileName}"`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        File: {item.fileName}
                      </span>
                    )}
                    {item.referenceImages && item.referenceImages.length > 0 && (
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 font-mono font-bold rounded text-[10px] border border-cyan-500/30 flex items-center gap-1" title={`Extra Reference Images: ${item.referenceImages.join(', ')}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span className="truncate max-w-[150px]">Refs: {item.referenceImages.join(', ')}</span>
                      </span>
                    )}
                    {item.disabled && (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 font-mono font-bold rounded text-[10px] border border-gray-700 flex items-center gap-1" title="Marked as disabled in JSON">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                        Disabled in JSON
                      </span>
                    )}
                    <span className="text-[9px] text-gray-500 font-medium pl-0.5">
                      Slot #{idx + 1}
                    </span>
                  </div>
                  <p className="flex-1 leading-relaxed">{item.prompt}</p>
                </div>
              ))}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-white/10 bg-black/30 flex flex-wrap items-center justify-between gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-medium text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {currentPrompts.some(p => p.trim().length > 0) && (
                  <button 
                    onClick={() => confirmImport('append')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/10"
                  >
                    Append to Existing ({currentPrompts.filter(p => p.trim()).length + previewItems.length})
                  </button>
                )}

                <button 
                  onClick={() => confirmImport('replace')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <SparklesIcon className="w-4 h-4" />
                  Replace All Prompts ({previewItems.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
