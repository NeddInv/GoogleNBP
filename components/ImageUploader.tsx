
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageData } from '../types';
import { UploadIcon, CloseIcon } from './icons';
import { processImageFile, isHeicImage } from '../utils/heicConverter';

interface ImageUploaderProps {
    id: string;
    label: string;
    onImageUpload: (imageData: ImageData | null) => void;
    onImagesUpload?: (images: ImageData[]) => void;
    initialImage?: ImageData | null;
    multiple?: boolean;
}

const isSupportedImageType = (file: File): boolean => {
    if (isHeicImage(file)) return true;
    const type = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    return (
        ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(type) ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp') ||
        name.endsWith('.heic') ||
        name.endsWith('.heif')
    );
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({ id, label, onImageUpload, onImagesUpload, initialImage, multiple }) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('Processing...');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync preview if initialImage changes (e.g., reset)
    useEffect(() => {
        if (!initialImage) {
            setPreview(null);
            setFileName(null);
        } else {
            setPreview(`data:${initialImage.mimeType};base64,${initialImage.base64}`);
            if (initialImage.name) {
                setFileName(initialImage.name);
            }
        }
    }, [initialImage]);

    const processFiles = useCallback(async (files: FileList) => {
        setIsProcessing(true);
        try {
            if (multiple && onImagesUpload) {
                const newImages: ImageData[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (!isSupportedImageType(file)) {
                        alert(`File ${file.name} is not a supported image type (PNG, JPG, WEBP, HEIC).`);
                        continue;
                    }
                    if (file.size > 25 * 1024 * 1024) {
                        alert(`File ${file.name} exceeds 25MB limit.`);
                        continue;
                    }
                    try {
                        if (isHeicImage(file)) {
                            setProcessingStatus(`Converting HEIC ${file.name}...`);
                        } else {
                            setProcessingStatus('Processing...');
                        }
                        const { base64, mimeType } = await processImageFile(file);
                        newImages.push({ base64, mimeType, name: file.name });
                    } catch (error) {
                        console.error('Error converting file to base64:', error);
                        alert(`Could not process image "${file.name}".`);
                    }
                }
                if (newImages.length > 0) {
                    onImagesUpload(newImages);
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                const file = files[0];
                if (file) {
                    if (!isSupportedImageType(file)) {
                        alert(`File ${file.name} is not a supported image type (PNG, JPG, WEBP, HEIC).`);
                        return;
                    }
                    try {
                        if (file.size > 25 * 1024 * 1024) {
                            alert("File size exceeds 25MB limit.");
                            return;
                        }
                        if (isHeicImage(file)) {
                            setProcessingStatus('Converting HEIC image...');
                        } else {
                            setProcessingStatus('Processing image...');
                        }
                        const { file: processedFile, base64, mimeType } = await processImageFile(file);
                        const imageData: ImageData = { base64, mimeType, name: file.name };
                        onImageUpload(imageData);
                        setPreview(URL.createObjectURL(processedFile));
                        setFileName(file.name);
                    } catch (error) {
                        console.error('Error converting file to base64:', error);
                        alert(`Failed to load "${file.name}". Please ensure it is a valid image.`);
                        onImageUpload(null);
                        setPreview(null);
                        setFileName(null);
                    }
                }
            }
        } finally {
            setIsProcessing(false);
            setProcessingStatus('Processing...');
        }
    }, [multiple, onImagesUpload, onImageUpload]);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        await processFiles(files);
    }, [processFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering the file dialog
        onImageUpload(null);
        setPreview(null);
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onImageUpload]);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full">
            {label && <label htmlFor={id} className="text-sm font-medium text-brand-light mb-2">{label}</label>}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer transition-all overflow-hidden ${
                    isDragging 
                        ? 'border-brand-accent bg-indigo-900/20 scale-[1.02]' 
                        : 'border-gray-500 bg-brand-primary hover:bg-gray-800'
                }`}
            >
                {preview ? (
                    <>
                        <img src={preview} alt="Preview" className="object-contain h-full w-full rounded-lg" />
                        <button 
                            onClick={handleRemove} 
                            className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-full p-1 text-white hover:bg-red-600 transition-colors"
                            aria-label="Remove image"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </>
                ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-xs text-gray-300 font-medium">{processingStatus}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                        <UploadIcon className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="mb-1 text-xs text-gray-400"><span className="font-semibold">Click or drag to upload</span></p>
                        <p className="text-[10px] text-gray-500">PNG, JPG, WEBP, HEIC (MAX. 25MB)</p>
                        {multiple && <p className="mt-1 text-[10px] text-brand-accent font-bold">Multiple allowed</p>}
                    </div>
                )}
                <input 
                    ref={fileInputRef} 
                    id={id} 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange} 
                    accept="image/png, image/jpeg, image/webp, image/heic, image/heif, .heic, .heif" 
                    multiple={multiple}
                />
            </div>
             {fileName && <p className="text-xs text-gray-400 mt-2 truncate max-w-full">{fileName}</p>}
        </div>
    );
};
