
// CRC32 Lookup Table
const makeCrc32Table = () => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
};

const crc32Table = makeCrc32Table();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Creates a standard uncompressed ZIP Blob (STORE mode, compression 0)
 */
export function createZipBlob(files: ZipFileEntry[]): Blob {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let currentOffset = 0;

  const encoder = new TextEncoder();
  const now = new Date();

  // Convert current time to MS-DOS format
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((now.getSeconds() >> 1) & 0x1f);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  files.forEach((file) => {
    const fileNameBytes = encoder.encode(file.name);
    const fileData = file.data;
    const dataLength = fileData.length;
    const fileCrc = crc32(fileData);

    // Local header: 30 bytes + filename length
    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true);         // Version needed to extract (2.0)
    view.setUint16(6, 0, true);          // General purpose bit flag
    view.setUint16(8, 0, true);          // Compression method (0 = store)
    view.setUint16(10, dosTime, true);   // Last mod time
    view.setUint16(12, dosDate, true);   // Last mod date
    view.setUint32(14, fileCrc, true);   // CRC-32
    view.setUint32(18, dataLength, true);// Compressed size
    view.setUint32(22, dataLength, true);// Uncompressed size
    view.setUint16(26, fileNameBytes.length, true);
    view.setUint16(28, 0, true);         // Extra field length
    localHeader.set(fileNameBytes, 30);

    localHeaders.push(localHeader);
    localHeaders.push(fileData);

    // Central directory header: 46 bytes + filename length
    const centralHeader = new Uint8Array(46 + fileNameBytes.length);
    const cView = new DataView(centralHeader.buffer);

    cView.setUint32(0, 0x02014b50, true); // Central dir signature
    cView.setUint16(4, 20, true);         // Version made by
    cView.setUint16(6, 20, true);         // Version needed
    cView.setUint16(8, 0, true);          // Flags
    cView.setUint16(10, 0, true);         // Compression method
    cView.setUint16(12, dosTime, true);
    cView.setUint16(14, dosDate, true);
    cView.setUint32(16, fileCrc, true);
    cView.setUint32(20, dataLength, true);
    cView.setUint32(24, dataLength, true);
    cView.setUint16(28, fileNameBytes.length, true);
    cView.setUint16(30, 0, true);         // Extra field length
    cView.setUint16(32, 0, true);         // File comment length
    cView.setUint16(34, 0, true);         // Disk start
    cView.setUint16(36, 0, true);         // Internal attrs
    cView.setUint32(38, 0, true);         // External attrs
    cView.setUint32(42, currentOffset, true); // Offset of local header
    centralHeader.set(fileNameBytes, 46);

    centralHeaders.push(centralHeader);

    currentOffset += localHeader.length + fileData.length;
  });

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  centralHeaders.forEach((h) => (centralDirSize += h.length));

  // End of Central Directory (EOCD): 22 bytes
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);

  eView.setUint32(0, 0x06054b50, true); // EOCD signature
  eView.setUint16(4, 0, true);          // Disk number
  eView.setUint16(6, 0, true);          // Disk start
  eView.setUint16(8, files.length, true); // Number of records on disk
  eView.setUint16(10, files.length, true);// Total records
  eView.setUint32(12, centralDirSize, true); // Size of central dir
  eView.setUint32(16, centralDirOffset, true); // Offset of central dir
  eView.setUint16(20, 0, true);         // Comment length

  const allParts = [...localHeaders, ...centralHeaders, eocd];
  return new Blob(allParts, { type: 'application/zip' });
}

/**
 * Converts an image source URL or base64 to image bytes (PNG, WebP, or JPEG)
 */
export async function fetchAndConvertToImageBytes(
  imageUrl: string,
  format: 'png' | 'webp' | 'jpeg' = 'png',
  quality = 0.95
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1024;
        canvas.height = img.height || 1024;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2D canvas context'));
        }
        ctx.drawImage(img, 0, 0);

        const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              return reject(new Error(`Failed to convert canvas to ${format} blob`));
            }
            const buffer = await blob.arrayBuffer();
            resolve(new Uint8Array(buffer));
          },
          mimeType,
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image for ${format} conversion`));
    };
  });
}

/**
 * Downloads bulk images as a single ZIP file (PNG, WebP, or JPEG)
 */
export async function downloadImagesAsZip(
  images: { url: string; name?: string }[],
  zipFilename = 'finished-ad-images.zip',
  format: 'png' | 'webp' | 'jpeg' = 'png',
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  if (!images || images.length === 0) return;

  const zipEntries: ZipFileEntry[] = [];
  const usedNames = new Set<string>();
  const total = images.length;

  for (let i = 0; i < total; i++) {
    const item = images[i];
    if (onProgress) onProgress(i, total);

    try {
      const imageBytes = await fetchAndConvertToImageBytes(item.url, format);
      const cleanName = item.name 
        ? item.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        : `ad_image_${i + 1}_${Math.random().toString(36).substring(2, 6)}`;
      
      const ext = `.${format}`;
      let baseFileName = cleanName.endsWith(ext) ? cleanName.slice(0, -ext.length) : cleanName;
      let fileName = `${baseFileName}${ext}`;

      // Guarantee unique file names inside the zip archive
      let counter = 1;
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseFileName}_${counter}${ext}`;
        counter++;
      }
      usedNames.add(fileName.toLowerCase());

      zipEntries.push({
        name: fileName,
        data: imageBytes
      });
    } catch (err) {
      console.error(`Error processing image ${i + 1} for ${format} ZIP:`, err);
    }
  }

  if (onProgress) onProgress(total, total);

  if (zipEntries.length === 0) {
    throw new Error(`No images could be converted to ${format.toUpperCase()} format.`);
  }

  const zipBlob = createZipBlob(zipEntries);
  const blobUrl = URL.createObjectURL(zipBlob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Backward-compatible WebP ZIP download helper
 */
export async function downloadImagesAsWebpZip(
  images: { url: string; name?: string }[],
  zipFilename = 'finished-ad-images-webp.zip',
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  return downloadImagesAsZip(images, zipFilename, 'webp', onProgress);
}
