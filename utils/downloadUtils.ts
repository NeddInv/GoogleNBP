/**
 * Sanitizes an ID string or number from the prompt schema so it is safe to use as a file name.
 */
export const sanitizeIdForFilename = (id: string | number, fallback = 'ad'): string => {
  const str = String(id ?? '').trim();
  if (!str) return fallback;
  // Replace illegal file system characters: / \ : * ? " < > |
  const clean = str.replace(/[/\\:*?"<>|]/g, '_').trim();
  return clean || fallback;
};

/**
 * Returns a filename based strictly on the provided schema ID and extension.
 * Example: formatFilenameWithId("ad_01", "png") -> "ad_01.png"
 * Example: formatFilenameWithId(1, "jpeg") -> "1.jpeg"
 */
export const formatFilenameWithId = (id: string | number, format = 'png'): string => {
  let clean = sanitizeIdForFilename(id);
  const ext = format.toLowerCase().replace(/^\./, '');
  // Strip duplicate extension if already present at the end of the ID
  clean = clean.replace(/\.(png|jpe?g|webp|gif)$/i, '');
  return `${clean}.${ext}`;
};

/**
 * Returns a filename based on an attached filename or schema ID.
 * If fileName is provided (e.g. "luxury_watch_01.png" or "watch_shot.jpg"), it cleans it and ensures the correct extension.
 * If only id is provided, it falls back to formatFilenameWithId.
 */
export const formatFilenameWithFileOrId = (
  fileName?: string | null,
  fallbackId?: string | number,
  format = 'png'
): string => {
  const ext = format.toLowerCase().replace(/^\./, '');
  if (fileName && fileName.trim()) {
    let clean = fileName.trim().replace(/[/\\:*?"<>|]/g, '_').trim();
    clean = clean.replace(/\.(png|jpe?g|webp|gif|svg)$/i, '');
    return `${clean || 'ad'}.${ext}`;
  }
  return formatFilenameWithId(fallbackId ?? 'ad', format);
};

/**
 * Generates a unique, descriptive filename for exported ads, images, videos, and zip files.
 * Example: AdCraft_Ad_Variant_1_20260811_153045_123_x9k2.png
 */
export const generateUniqueFilename = (
  prefix = 'AdCraft',
  extension = 'png',
  variantIndex?: number | string
): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  // Random 4-character alphanumeric hash for absolute uniqueness
  const randomHash = Math.random().toString(36).substring(2, 6);

  // Clean prefix to remove illegal filename characters
  const cleanPrefix = prefix
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const variantStr = (variantIndex !== undefined && variantIndex !== null) ? `_v${variantIndex}` : '';
  const ext = extension.startsWith('.') ? extension : `.${extension}`;

  return `${cleanPrefix || 'AdCraft'}_${year}${month}${day}_${hours}${minutes}${seconds}_${ms}${variantStr}_${randomHash}${ext}`;
};

/**
 * Utility function to download any image URL or base64 directly as a high-quality PNG file with unique filename.
 */
export const downloadImageAsPng = (imageUrl: string, customFilename?: string): Promise<void> => {
  return new Promise((resolve) => {
    const filename = customFilename || generateUniqueFilename('AdCraft_Image', 'png');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    const sanitizeFilename = (name: string) => {
      const clean = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      return clean.toLowerCase().endsWith('.png') ? clean : `${clean}.png`;
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1024;
        canvas.height = img.height || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context unavailable');
        }
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            throw new Error('Blob creation failed');
          }
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = sanitizeFilename(filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          resolve();
        }, 'image/png');
      } catch (err) {
        console.warn('Canvas conversion failed, downloading original URL', err);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = sanitizeFilename(filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      }
    };

    img.onerror = () => {
      // Fallback direct anchor download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = sanitizeFilename(filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve();
    };
  });
};

/**
 * Downloads a single image with format options (PNG, JPEG, WebP)
 */
export const downloadSingleImage = (
  imageUrl: string,
  filename: string,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.95
): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    const sanitizeFilename = (name: string, ext: string) => {
      const clean = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const suffix = `.${ext}`;
      return clean.toLowerCase().endsWith(suffix) ? clean : `${clean}${suffix}`;
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1024;
        canvas.height = img.height || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context unavailable');
        }
        ctx.drawImage(img, 0, 0);

        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              throw new Error('Blob creation failed');
            }
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = sanitizeFilename(filename, format);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            resolve();
          },
          mimeType,
          quality
        );
      } catch (err) {
        console.warn('Canvas conversion failed, fallback download', err);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = sanitizeFilename(filename, format);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      }
    };

    img.onerror = () => {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = sanitizeFilename(filename, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve();
    };
  });
};

/**
 * Downloads a list of images sequentially as individual files
 */
export const downloadImagesSequentially = async (
  items: { url: string; name: string }[],
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.95,
  delayMs = 250
): Promise<void> => {
  for (let i = 0; i < items.length; i++) {
    await downloadSingleImage(items[i].url, items[i].name, format, quality);
    if (i < items.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

