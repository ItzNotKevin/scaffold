import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

/**
 * Compresses an image file before upload
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed File object
 */
export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  // Only compress image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const defaultOptions = {
    maxSizeMB: 1, // Maximum file size in MB (adjust as needed)
    maxWidthOrHeight: 1920, // Maximum width or height
    useWebWorker: true,
    fileType: file.type, // Maintain original file type
    ...options
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    
    // Log compression results
    const originalSize = (file.size / (1024 * 1024)).toFixed(2);
    const compressedSize = (compressedFile.size / (1024 * 1024)).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    
    console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB (${reduction}% reduction)`);
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // If compression fails, return original file
    return file;
  }
};



