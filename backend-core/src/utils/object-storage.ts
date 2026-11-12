import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const DEFAULT_PRESIGN_EXPIRY_SECONDS = 3600;

// Dynamic ESM loader so CommonJS TypeScript compiles files-sdk cleanly under Node 20
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = any>(
  specifier: string
) => Promise<T>;

const getBucketName = () => process.env.NEON_STORAGE_BUCKET || 'uploads';

const getStorageClient = async () => {
  const bucket = getBucketName();
  const [{ Files }, { neon }] = await Promise.all([
    dynamicImport('files-sdk'),
    dynamicImport('files-sdk/neon'),
  ]);
  return new Files({ adapter: neon({ bucket }) });
};

export const isObjectStorageConfigured = (): boolean =>
  Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_ENDPOINT_URL_S3
  );

const isNeonStorageHostname = (hostname: string): boolean => {
  if (/\.neon\.tech$/i.test(hostname)) return true;
  if (process.env.AWS_ENDPOINT_URL_S3) {
    try {
      const configuredHost = new URL(process.env.AWS_ENDPOINT_URL_S3).hostname;
      if (hostname.toLowerCase() === configuredHost.toLowerCase()) return true;
    } catch {
      // ignore invalid configured URL
    }
  }
  return false;
};

/**
 * Extracts the bucket object key from a Neon Object Storage URL or raw key.
 * Returns null for non-Neon URLs (e.g. legacy Cloudinary URLs).
 */
export const extractObjectStorageKey = (value?: string | null): string | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith('data:') || trimmed.startsWith('/')) return null;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!isNeonStorageHostname(parsed.hostname)) return null;
    const rawPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const bucket = getBucketName();
    if (rawPath.startsWith(`${bucket}/`)) {
      return rawPath.slice(bucket.length + 1) || null;
    }
    return rawPath || null;
  } catch {
    return null;
  }
};

/**
 * Normalizes a question image reference for Postgres persistence:
 * stores the object key for Neon Object Storage assets and keeps legacy URLs intact.
 */
export const normalizeStoredImageValue = (value?: string | null): string | undefined => {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return extractObjectStorageKey(trimmed) || trimmed;
};

/**
 * Resolves a stored object key (or Neon URL) to a fresh presigned GET URL on read.
 */
export const resolveObjectStorageUrl = async (
  value?: string | null,
  expiresIn = DEFAULT_PRESIGN_EXPIRY_SECONDS
): Promise<string | null> => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const key = extractObjectStorageKey(trimmed);
  if (!key || !isObjectStorageConfigured()) {
    return trimmed;
  }

  try {
    const files = await getStorageClient();
    return await files.url(key, { expiresIn });
  } catch (error) {
    console.error('Neon Object Storage presign error:', error);
    return trimmed;
  }
};

export const resolveQuestionImages = async <T extends { image?: string | null }>(
  questions: T[]
): Promise<T[]> => {
  if (!Array.isArray(questions) || questions.length === 0) return questions;
  return Promise.all(
    questions.map(async (q) => {
      if (!q?.image) return q;
      const resolvedUrl = await resolveObjectStorageUrl(q.image);
      return { ...q, image: resolvedUrl };
    })
  );
};

export const uploadToObjectStorage = async (localFilePath: string): Promise<string | null> => {
  try {
    if (!localFilePath || !fs.existsSync(localFilePath)) return null;

    if (!isObjectStorageConfigured()) {
      console.warn('Neon Object Storage not configured. Cannot upload image.');
      return null;
    }

    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] || 'application/octet-stream';
    const key = `cira-quiz-images/${crypto.randomUUID()}${ext || '.bin'}`;
    const fileBuffer = fs.readFileSync(localFilePath);

    const files = await getStorageClient();
    await files.upload(key, fileBuffer, { contentType });
    return await files.url(key, { expiresIn: DEFAULT_PRESIGN_EXPIRY_SECONDS });
  } catch (error) {
    console.error('Neon Object Storage upload error:', error);
    return null;
  } finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch {
        console.error('Failed to clean up temp file:', localFilePath);
      }
    }
  }
};

export const uploadBufferToObjectStorage = async (
  buffer: Buffer,
  mimeType: string
): Promise<string | null> => {
  try {
    if (!isObjectStorageConfigured() || !buffer.length) return null;
    const ext = ALLOWED_IMAGE_MIME_TYPES[mimeType];
    if (!ext) return null;

    const key = `cira-quiz-images/${crypto.randomUUID()}.${ext}`;
    const files = await getStorageClient();
    await files.upload(key, buffer, { contentType: mimeType });
    return await files.url(key, { expiresIn: DEFAULT_PRESIGN_EXPIRY_SECONDS });
  } catch (error) {
    console.error('Neon Object Storage buffer upload error:', error);
    return null;
  }
};
