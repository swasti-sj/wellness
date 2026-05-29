const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Log Cloudinary configuration (without secrets)
console.log('🔧 Cloudinary Config:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');

/**
 * Compress and upload an image to Cloudinary
 * @param {Buffer|Stream} fileBuffer - File buffer from multer
 * @param {String} folder - Cloudinary folder (e.g., 'wellness/notes', 'wellness/prescriptions')
 * @param {String} fileName - Original file name
 * @param {Object} options - Additional options for compression
 * @returns {Promise<Object>} - Cloudinary response with secure_url
 */
async function uploadAndCompressImage(fileBuffer, folder, fileName, options = {}) {
  try {
    console.log(`[Cloudinary] Uploading image: ${fileName} to folder: ${folder}`);
    
    // Default compression options
    const compressionOptions = {
      width: options.width || 1200,
      height: options.height || 1200,
      quality: options.quality || 80,
      fit: 'inside',
      withoutEnlargement: true,
      format: 'webp'
    };

    // Compress image using sharp
    console.log('[Sharp] Compressing image...');
    const compressedBuffer = await sharp(fileBuffer)
      .resize(compressionOptions.width, compressionOptions.height, {
        fit: compressionOptions.fit,
        withoutEnlargement: compressionOptions.withoutEnlargement
      })
      .webp({ quality: compressionOptions.quality })
      .toBuffer();
    
    console.log(`[Sharp] Compressed to ${compressedBuffer.length} bytes`);

    // Upload to Cloudinary using unsigned upload (for temp files)
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: `${Date.now()}-${path.parse(fileName).name}`,
          overwrite: false,
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Upload stream error:', error);
            reject(error);
          } else {
            console.log('[Cloudinary] Upload successful:', result.public_id);
            console.log('[Cloudinary] URL:', result.secure_url);
            resolve(result);
          }
        }
      );

      console.log('[Cloudinary] Sending buffer to upload stream...');
      // Write compressed buffer to stream
      uploadStream.end(compressedBuffer);
    });

  } catch (err) {
    console.error('[Cloudinary] Image compression/upload error:', err.message);
    console.error('[Cloudinary] Error stack:', err.stack);
    throw new Error(`Failed to upload image: ${err.message}`);
  }
}

/**
 * Upload PDF or document to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {String} folder - Cloudinary folder
 * @param {String} fileName - Original file name
 * @param {String} resourceType - 'auto' (default) or 'raw' for PDFs
 * @returns {Promise<Object>} - Cloudinary response
 */
async function uploadDocument(fileBuffer, folder, fileName, resourceType = 'auto') {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: `${Date.now()}-${path.parse(fileName).name}`,
          resource_type: resourceType
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (err) {
    console.error('Document upload error:', err.message);
    throw new Error(`Failed to upload document: ${err.message}`);
  }
}

/**
 * Delete an image from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteImage(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (err) {
    console.error('Delete error:', err.message);
    throw new Error(`Failed to delete image: ${err.message}`);
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {String} url - Cloudinary secure URL
 * @returns {String} - Public ID
 */
function extractPublicId(url) {
  try {
    const parts = url.split('/');
    const index = parts.findIndex(p => p === 'upload');
    if (index === -1) return null;
    
    // Reconstruct public_id from URL (remove version info and file extension)
    const publicPath = parts.slice(index + 2).join('/');
    const publicId = publicPath.split('.')[0];
    return publicId;
  } catch (err) {
    console.error('Error extracting public ID:', err.message);
    return null;
  }
}

/**
 * Batch upload multiple images
 * @param {Array} files - Array of file buffers from multer
 * @param {String} folder - Cloudinary folder
 * @returns {Promise<Array>} - Array of upload results
 */
async function uploadMultipleImages(files, folder) {
  try {
    const uploadPromises = files.map(file =>
      uploadAndCompressImage(file.buffer, folder, file.originalname)
    );
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (err) {
    console.error('Batch upload error:', err.message);
    throw new Error(`Failed to upload multiple images: ${err.message}`);
  }
}

/**
 * Get optimized image URL with transformations
 * @param {String} publicId - Cloudinary public ID
 * @param {Object} transformations - Transformation options
 * @returns {String} - Optimized URL
 */
function getOptimizedUrl(publicId, transformations = {}) {
  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto',
    width: 800,
    crop: 'limit'
  };

  const trans = { ...defaultTransformations, ...transformations };

  return cloudinary.url(publicId, {
    transformation: [trans],
    secure: true
  });
}

module.exports = {
  uploadAndCompressImage,
  uploadDocument,
  deleteImage,
  extractPublicId,
  uploadMultipleImages,
  getOptimizedUrl,
  cloudinary
};
