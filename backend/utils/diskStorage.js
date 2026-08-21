const fs = require('fs');
const path = require('path');
const { compressToTargetSize, DOCUMENT_COMPRESSION_CONFIG } = require('./cloudinary');

/**
 * ============================================================
 * DISK STORAGE (institute-allocated storage, replaces Cloudinary)
 * ============================================================
 * Files are written to backend/uploads/<folder>/ and served back out
 * by the express.static('/uploads', ...) route already mounted in
 * server.js. Compression reuses the exact same compressToTargetSize
 * helper Cloudinary uploads used — only the destination changes.
 *
 * Resolved relative to this file (__dirname), not process.cwd(), so
 * it works the same regardless of which directory the app is started
 * from (local dev vs PM2 on the VM).
 */
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function safeFileName(fileName) {
  // Strip anything that isn't safe in a URL path / filesystem name.
  const base = path.parse(fileName || 'file').name;
  return base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

async function ensureFolder(folder) {
  const dir = path.join(UPLOADS_ROOT, folder);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Compress and save an image to disk (mirrors uploadAndCompressDocumentImage,
 * but writes to the local/mounted disk instead of Cloudinary).
 * @returns {Promise<{ url: String, path: String }>}
 */
async function saveCompressedImageToDisk(fileBuffer, folder, fileName, options = {}) {
  const config = { ...DOCUMENT_COMPRESSION_CONFIG, ...options };
  const { buffer, width, height, quality } = await compressToTargetSize(fileBuffer, config);
  console.log(`[DiskStorage] Compressed to ${Math.round(buffer.length / 1024)}KB at ${width}x${height}, quality ${quality}`);

  const dir = await ensureFolder(folder);
  const name = `${Date.now()}-${safeFileName(fileName)}.webp`;
  const filePath = path.join(dir, name);

  await fs.promises.writeFile(filePath, buffer);

  const url = `/uploads/${folder}/${name}`;
  console.log(`[DiskStorage] Saved image: ${url}`);
  return { url, path: filePath };
}

/**
 * Save a non-image file (e.g. PDF) to disk as-is, no compression.
 * @returns {Promise<{ url: String, path: String }>}
 */
async function saveRawFileToDisk(fileBuffer, folder, fileName, mimetype) {
  const dir = await ensureFolder(folder);
  const ext = mimetype === 'application/pdf' ? '.pdf' : path.extname(fileName || '') || '';
  const name = `${Date.now()}-${safeFileName(fileName)}${ext}`;
  const filePath = path.join(dir, name);

  await fs.promises.writeFile(filePath, fileBuffer);

  const url = `/uploads/${folder}/${name}`;
  console.log(`[DiskStorage] Saved file: ${url}`);
  return { url, path: filePath };
}

/**
 * Delete a previously-saved file given its /uploads/... URL.
 * Safe to call even if the file is missing (e.g. already deleted).
 */
async function deleteFileFromDisk(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const relative = url.replace(/^\/uploads\//, '');
  const filePath = path.join(UPLOADS_ROOT, relative);

  // Guard against path traversal (e.g. a stored URL containing "..").
  if (!filePath.startsWith(UPLOADS_ROOT)) {
    console.warn('[DiskStorage] Refusing to delete path outside uploads root:', url);
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[DiskStorage] Failed to delete file:', url, err.message);
    }
  }
}

module.exports = {
  saveCompressedImageToDisk,
  saveRawFileToDisk,
  deleteFileFromDisk,
};
