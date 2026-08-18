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
console.log('Cloudinary Config:');
console.log('  Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('  API Key:', process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing');
console.log('  API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing');

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
 * ============================================================
 * DOCUMENT IMAGE COMPRESSION (Prescriptions / Lab Test / Cashless Form)
 * ============================================================
 * These settings control how scanned/photographed documents (e.g. a
 * handwritten prescription photographed by a nurse) are compressed
 * before being stored. The goal is to keep the file small while
 * preserving enough resolution/quality for the text to remain readable.
 *
 * To change the target file size or quality behaviour later, only the
 * values below need to be edited — no other code needs to change.
 */
const DOCUMENT_COMPRESSION_CONFIG = {
  targetSizeKB: 100,   // desired final file size, in kilobytes
  maxWidth: 1800,       // starting max width (px)
  maxHeight: 1800,      // starting max height (px)
  minWidth: 900,        // will not shrink below this width, to protect readability
  minHeight: 900,
  startQuality: 90,     // starting WebP quality (1-100)
  minQuality: 50,       // will not go below this quality, to protect readability
  qualityStep: 10,      // how much quality is reduced per attempt
  format: 'webp'
};

/**
 * Internal helper: repeatedly compress an image, first by lowering
 * quality, then (if still above target size) by reducing dimensions,
 * until the target size or the configured floor is reached.
 */
async function compressToTargetSize(fileBuffer, config) {
  let width = config.maxWidth;
  let height = config.maxHeight;
  let quality = config.startQuality;
  let buffer = null;

  // Step 1: reduce quality first — this preserves resolution/readability
  while (quality >= config.minQuality) {
    buffer = await sharp(fileBuffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    if (buffer.length <= config.targetSizeKB * 1024) {
      return { buffer, width, height, quality };
    }
    quality -= config.qualityStep;
  }

  // Step 2: if still above target at minimum quality, reduce dimensions
  quality = config.minQuality;
  while (width > config.minWidth && height > config.minHeight) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);

    buffer = await sharp(fileBuffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    if (buffer.length <= config.targetSizeKB * 1024) {
      return { buffer, width, height, quality };
    }
  }

  // Best effort reached (minimum floors hit). Returned even if slightly
  // above target, so readability is never degraded past the configured limits.
  return { buffer, width, height, quality };
}

/**
 * Compress and upload a scanned/photographed document image
 * (prescriptions, lab test reports, cashless forms, etc.)
 * Targets a configurable file size while protecting a minimum
 * resolution/quality floor for readability.
 *
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {String} folder - Cloudinary folder
 * @param {String} fileName - Original file name
 * @param {Object} options - Overrides for DOCUMENT_COMPRESSION_CONFIG
 * @returns {Promise<Object>} - Cloudinary response with secure_url
 */
async function uploadAndCompressDocumentImage(fileBuffer, folder, fileName, options = {}) {
  try {
    const config = { ...DOCUMENT_COMPRESSION_CONFIG, ...options };
    console.log(`[Cloudinary] Compressing document image: ${fileName} (target: ${config.targetSizeKB}KB)`);

    const { buffer: compressedBuffer, width, height, quality } = await compressToTargetSize(fileBuffer, config);

    console.log(`[Sharp] Document compressed to ${Math.round(compressedBuffer.length / 1024)}KB at ${width}x${height}, quality ${quality}`);

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
            console.error('[Cloudinary] Document upload stream error:', error);
            reject(error);
          } else {
            console.log('[Cloudinary] Document upload successful:', result.public_id);
            resolve(result);
          }
        }
      );

      uploadStream.end(compressedBuffer);
    });
  } catch (err) {
    console.error('[Cloudinary] Document image compression/upload error:', err.message);
    throw new Error(`Failed to upload document image: ${err.message}`);
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

/**
 * ============================================================
 * INTERIM STORAGE (MongoDB-embedded, no external service)
 * ============================================================
 * Temporary storage path used until Cloudinary credentials or
 * allocated disk storage are configured. Stores the compressed
 * image directly inside the MongoDB document as a base64 data URI.
 * The frontend already supports rendering "data:" URIs directly
 * (see documentHelpers.js buildDocumentUrl), so no frontend
 * changes are required for this to work.
 *
 * To switch to Cloudinary or disk storage later, only the route
 * files (prescriptions.js / tests.js) need to call a different
 * function — this file and the database schema stay unchanged.
 */
async function compressImageToDataUri(fileBuffer, options = {}) {
  const config = { ...DOCUMENT_COMPRESSION_CONFIG, ...options };
  const { buffer, width, height, quality } = await compressToTargetSize(fileBuffer, config);
  console.log(`[Interim Storage] Image compressed to ${Math.round(buffer.length / 1024)}KB at ${width}x${height}, quality ${quality}`);
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}

function bufferToDataUri(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

module.exports = {
  uploadAndCompressImage,
  uploadAndCompressDocumentImage,
  uploadDocument,
  deleteImage,
  extractPublicId,
  uploadMultipleImages,
  getOptimizedUrl,
  compressImageToDataUri,
  bufferToDataUri,
  cloudinary
};