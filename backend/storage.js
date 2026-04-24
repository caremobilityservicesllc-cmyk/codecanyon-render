import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const storageRoot = path.join(rootDir, 'storage');

export const uploadMiddleware = multer({ storage: multer.memoryStorage() }).single('file');

function sanitizeSegment(segment) {
  return String(segment || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '-'))
    .join('/');
}

function resolveBucketPath(bucket, filePath) {
  const safeBucket = sanitizeSegment(bucket);
  const safePath = sanitizeSegment(filePath);
  if (!safeBucket || !safePath) {
    throw new Error('Bucket and path are required');
  }

  const absolutePath = path.resolve(storageRoot, safeBucket, safePath);
  const relativeToRoot = path.relative(storageRoot, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('Invalid storage path');
  }

  return {
    bucket: safeBucket,
    path: safePath,
    absolutePath,
  };
}

export async function saveUploadedFile({ bucket, filePath, file }) {
  if (!file?.buffer) {
    throw new Error('File payload is required');
  }

  const target = resolveBucketPath(bucket, filePath);
  await fs.mkdir(path.dirname(target.absolutePath), { recursive: true });
  await fs.writeFile(target.absolutePath, file.buffer);

  return {
    path: `${target.bucket}/${target.path}`,
    fullPath: target.absolutePath,
    mimetype: file.mimetype || 'application/octet-stream',
    size: file.size || file.buffer.length,
  };
}

export async function removeStoredFiles(bucket, paths) {
  const results = [];
  for (const entry of paths || []) {
    const target = resolveBucketPath(bucket, entry);
    try {
      await fs.rm(target.absolutePath, { force: true });
      results.push({ path: `${target.bucket}/${target.path}`, removed: true });
    } catch {
      results.push({ path: `${target.bucket}/${target.path}`, removed: false });
    }
  }
  return results;
}