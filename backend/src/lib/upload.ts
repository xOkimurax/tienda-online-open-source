import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import type { NextFunction, Request, Response } from 'express';
import { env } from '@/env';

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_DOC_TYPES = new Set([...ALLOWED_IMAGE_TYPES, 'application/pdf']);

// Product/branding photos: held in memory just long enough to re-encode as
// WebP (smaller, faster to load in the storefront) before hitting disk.
const IMAGE_MAX_WIDTH = 1600;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_TYPES.has(file.mimetype));
  },
});

async function persistAsWebp(buffer: Buffer): Promise<string> {
  const filename = `${nanoid(16)}.webp`;
  const webp = await sharp(buffer)
    .rotate() // apply EXIF orientation before it gets stripped
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.promises.writeFile(path.join(env.UPLOAD_DIR, filename), webp);
  return filename;
}

async function convertUploadedImages(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.file) {
      req.file.filename = await persistAsWebp(req.file.buffer);
    }
    const files = Array.isArray(req.files) ? req.files : req.files ? Object.values(req.files).flat() : [];
    await Promise.all(files.map(async (f) => { f.filename = await persistAsWebp(f.buffer); }));
    next();
  } catch (err) {
    next(err);
  }
}

export const uploadImage = {
  single: (field: string) => [imageUpload.single(field), convertUploadedImages] as const,
  array: (field: string, maxCount: number) => [imageUpload.array(field, maxCount), convertUploadedImages] as const,
};

// Payment proofs ("comprobante") can be a PDF or a photo. Photos go through
// the same WebP re-encode as product images (any extension in — .png, .jpg,
// whatever the phone camera produced — .webp out); a PDF is kept as-is since
// sharp can't touch it and it's evidence, not something to compress.
const comprobanteUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_DOC_TYPES.has(file.mimetype));
  },
});

async function persistComprobante(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === 'application/pdf') {
    const filename = `${nanoid(16)}.pdf`;
    await fs.promises.writeFile(path.join(env.UPLOAD_DIR, filename), file.buffer);
    return filename;
  }
  return persistAsWebp(file.buffer);
}

async function convertUploadedComprobante(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.file) req.file.filename = await persistComprobante(req.file);
    next();
  } catch (err) {
    next(err);
  }
}

export const uploadComprobante = {
  single: (field: string) => [comprobanteUpload.single(field), convertUploadedComprobante] as const,
};

export function publicUrlFor(filename: string) {
  return `${env.PUBLIC_UPLOAD_BASE_URL}/${filename}`;
}
