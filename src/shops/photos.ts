import { randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export const PHOTO_CAP = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const OK = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function uploadsRoot() {
  return join(process.cwd(), 'uploads');
}

export function photoDir(shopId: number, customerId: number) {
  return join(uploadsRoot(), `s${shopId}`, `c${customerId}`);
}

function cloudReady() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function cloudCfg() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export function assertPhoto(file?: { mimetype?: string; size?: number; buffer?: Buffer }) {
  if (!file?.buffer?.length) throw new BadRequestException('Need an image.');
  if (!OK.has(file.mimetype ?? '')) throw new BadRequestException('Use jpg, png, or webp.');
  if ((file.size ?? file.buffer.length) > MAX_BYTES) {
    throw new BadRequestException('Image must be under 2 MB.');
  }
}

export function photoName(mime: string) {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `${Date.now().toString(36)}${randomBytes(4).toString('hex')}.${ext}`;
}

export function publicIdFromUrl(url: string) {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export async function savePhoto(shopId: number, customerId: number, file: { mimetype: string; buffer: Buffer }) {
  if (!cloudReady()) {
    throw new BadRequestException(
      'Cloudinary not set. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
    );
  }
  cloudCfg();
  const id = `nestpro/s${shopId}/c${customerId}/${photoName(file.mimetype).replace(/\.[^.]+$/, '')}`;
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: id, resource_type: 'image', overwrite: false },
      (err, res) => {
        if (err || !res?.secure_url) reject(err ?? new Error('Cloudinary upload failed'));
        else resolve(res.secure_url);
      },
    );
    stream.end(file.buffer);
  });
}

export async function dropPhoto(shopId: number, customerId: number, name: string) {
  if (!name || name.includes('..')) return;
  if (name.startsWith('http')) {
    if (!cloudReady()) return;
    cloudCfg();
    const id = publicIdFromUrl(name);
    if (id) {
      try {
        await cloudinary.uploader.destroy(id);
      } catch {
        /* already gone */
      }
    }
    return;
  }
  if (name.includes('/') || name.includes('\\')) return;
  try {
    await unlink(join(photoDir(shopId, customerId), name));
  } catch {
    /* already gone */
  }
}
