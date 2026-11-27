/**
 * HEIC / HEIF image conversion utility.
 * Handles Apple HEIC/HEIF format conversions to standard JPEG for browser rendering,
 * canvas manipulation, thumbnail generation, and API compatibility.
 */

// Track script loading promise to avoid duplicate network calls
let heic2anyLoaderPromise: Promise<any> | null = null;

/**
 * Checks if a given file or blob is a HEIC/HEIF image.
 */
export const isHeicImage = (file: File | Blob, customName?: string): boolean => {
  const fileName = (customName || (file instanceof File ? file.name : '')).toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  return (
    fileType === 'image/heic' ||
    fileType === 'image/heif' ||
    fileType === 'image/heic-sequence' ||
    fileType === 'image/heif-sequence' ||
    fileName.endsWith('.heic') ||
    fileName.endsWith('.heif')
  );
};

/**
 * Dynamically loads the heic2any library from CDN with resilient fallback mirrors.
 */
const loadHeic2Any = (): Promise<any> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window not available'));
  }

  if ((window as any).heic2any) {
    return Promise.resolve((window as any).heic2any);
  }

  if (heic2anyLoaderPromise) {
    return heic2anyLoaderPromise;
  }

  const cdnMirrors = [
    'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    'https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js',
  ];

  heic2anyLoaderPromise = new Promise((resolve, reject) => {
    let mirrorIndex = 0;

    const tryNextMirror = () => {
      if (mirrorIndex >= cdnMirrors.length) {
        heic2anyLoaderPromise = null;
        reject(new Error('Failed to load HEIC converter library from all CDN mirrors.'));
        return;
      }

      const script = document.createElement('script');
      script.src = cdnMirrors[mirrorIndex];
      script.async = true;

      script.onload = () => {
        if ((window as any).heic2any) {
          resolve((window as any).heic2any);
        } else {
          mirrorIndex++;
          tryNextMirror();
        }
      };

      script.onerror = () => {
        script.remove();
        mirrorIndex++;
        tryNextMirror();
      };

      document.head.appendChild(script);
    };

    tryNextMirror();
  });

  return heic2anyLoaderPromise;
};

/**
 * Converts a HEIC / HEIF File or Blob to a standard JPEG File.
 * If the file is already a standard image (PNG, JPEG, WebP, GIF, SVG), it is returned untouched.
 */
export const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (!isHeicImage(file)) {
    return file;
  }

  // 1. First, attempt native browser decode (Safari / iOS 17+ or browsers with built-in HEIC support)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const jpegBlob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, 'image/jpeg', 0.92)
        );
        if (jpegBlob && jpegBlob.size > 0) {
          const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
          return new File([jpegBlob], newName, { type: 'image/jpeg' });
        }
      }
    } catch {
      // Browser does not have native HEIC decoding for createImageBitmap; proceed to fallback
    }
  }

  // 2. Use heic2any WASM decoder for non-native browsers (Chrome, Firefox, Edge, Android)
  try {
    const heic2any = await loadHeic2Any();
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });

    const resultBlob: Blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([resultBlob], newName, { type: 'image/jpeg' });
  } catch (error) {
    console.error('HEIC conversion failure:', error);
    throw new Error(
      `Could not decode HEIC image "${file.name}". Please ensure it is a valid HEIC file, or convert to JPG/PNG.`
    );
  }
};

/**
 * Reads a File into a base64 string and mimeType, automatically converting HEIC if necessary.
 */
export const processImageFile = async (
  file: File
): Promise<{ file: File; base64: string; mimeType: string }> => {
  let processedFile = file;

  if (isHeicImage(file)) {
    processedFile = await convertHeicToJpeg(file);
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processedFile);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Content = result.split(',')[1] || '';
      resolve(base64Content);
    };
    reader.onerror = (err) => reject(err);
  });

  return {
    file: processedFile,
    base64,
    mimeType: processedFile.type || 'image/jpeg',
  };
};
