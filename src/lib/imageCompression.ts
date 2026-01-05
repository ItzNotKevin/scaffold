import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const defaultOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type,
    ...options
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    const originalSize = (file.size / (1024 * 1024)).toFixed(2);
    const compressedSize = (compressedFile.size / (1024 * 1024)).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(`Image compressed: ${originalSize}MB → ${compressedSize}MB (${reduction}% reduction)`);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    return file;
  }
};








