/**
 * Media Service
 *
 * Handles storage and retrieval of uploaded media files (GIFs, videos, sounds)
 */

import { readdir, mkdir, unlink, stat, access } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

const DEFAULT_MEDIA_PATH = './media';

/**
 * Supported media types
 */
export type MediaType = 'animation' | 'sound' | 'image';

/**
 * Media file info
 */
export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  type: MediaType;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  type: MediaType;
  originalName: string;
  mimeType: string;
}

/**
 * Media service options
 */
export interface MediaServiceOptions {
  mediaPath?: string;
  baseUrl?: string;
  maxFileSize?: number; // in bytes
}

/**
 * Allowed MIME types per media type
 */
const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  animation: [
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ],
  sound: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
  ],
  image: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ],
};

/**
 * File extensions per MIME type
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

export class MediaService {
  private mediaPath: string;
  private baseUrl: string;
  private maxFileSize: number;

  constructor(options: MediaServiceOptions = {}) {
    this.mediaPath = options.mediaPath ?? DEFAULT_MEDIA_PATH;
    this.baseUrl = options.baseUrl ?? '/api/media/files';
    this.maxFileSize = options.maxFileSize ?? 50 * 1024 * 1024; // 50MB default
  }

  /**
   * Initialize media directories
   */
  async init(): Promise<void> {
    // Create main media directory
    await this.ensureDir(this.mediaPath);

    // Create subdirectories for each type
    await this.ensureDir(join(this.mediaPath, 'animation'));
    await this.ensureDir(join(this.mediaPath, 'sound'));
    await this.ensureDir(join(this.mediaPath, 'image'));
  }

  /**
   * Validate file type
   */
  validateFileType(mimeType: string, type: MediaType): boolean {
    const allowed = ALLOWED_MIME_TYPES[type];
    return allowed.includes(mimeType.toLowerCase());
  }

  /**
   * Get allowed MIME types for a media type
   */
  getAllowedMimeTypes(type: MediaType): string[] {
    return ALLOWED_MIME_TYPES[type];
  }

  /**
   * Upload a file from stream
   */
  async uploadFromStream(
    stream: Readable,
    options: UploadOptions
  ): Promise<MediaFile> {
    const { type, originalName, mimeType } = options;

    // Validate MIME type
    if (!this.validateFileType(mimeType, type)) {
      throw new Error(
        `Invalid file type. Allowed types for ${type}: ${ALLOWED_MIME_TYPES[type].join(', ')}`
      );
    }

    // Generate unique filename
    const id = randomUUID();
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || extname(originalName);
    const filename = `${id}${ext}`;
    const filePath = join(this.mediaPath, type, filename);

    // Write file
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    // Get file stats
    const stats = await stat(filePath);

    // Check file size
    if (stats.size > this.maxFileSize) {
      await unlink(filePath);
      throw new Error(
        `File too large. Maximum size is ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
      );
    }

    return {
      id,
      filename,
      originalName,
      type,
      mimeType,
      size: stats.size,
      url: `${this.baseUrl}/${type}/${filename}`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Upload a file from buffer
   */
  async uploadFromBuffer(
    buffer: Buffer,
    options: UploadOptions
  ): Promise<MediaFile> {
    const { type, originalName, mimeType } = options;

    // Validate MIME type
    if (!this.validateFileType(mimeType, type)) {
      throw new Error(
        `Invalid file type. Allowed types for ${type}: ${ALLOWED_MIME_TYPES[type].join(', ')}`
      );
    }

    // Check file size
    if (buffer.length > this.maxFileSize) {
      throw new Error(
        `File too large. Maximum size is ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
      );
    }

    // Generate unique filename
    const id = randomUUID();
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || extname(originalName);
    const filename = `${id}${ext}`;
    const filePath = join(this.mediaPath, type, filename);

    // Write file
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, buffer);

    return {
      id,
      filename,
      originalName,
      type,
      mimeType,
      size: buffer.length,
      url: `${this.baseUrl}/${type}/${filename}`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Delete a file
   */
  async delete(type: MediaType, filename: string): Promise<boolean> {
    const filePath = join(this.mediaPath, type, basename(filename));

    try {
      await access(filePath);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files by type
   */
  async listFiles(type: MediaType): Promise<MediaFile[]> {
    const dirPath = join(this.mediaPath, type);

    try {
      await access(dirPath);
    } catch {
      return [];
    }

    const files = await readdir(dirPath);
    const mediaFiles: MediaFile[] = [];

    for (const filename of files) {
      const filePath = join(dirPath, filename);
      const stats = await stat(filePath);

      if (!stats.isFile()) continue;

      const ext = extname(filename).toLowerCase();
      const mimeType = this.getMimeTypeFromExt(ext);

      mediaFiles.push({
        id: basename(filename, ext),
        filename,
        originalName: filename,
        type,
        mimeType,
        size: stats.size,
        url: `${this.baseUrl}/${type}/${filename}`,
        createdAt: stats.birthtime.toISOString(),
      });
    }

    return mediaFiles.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get file path for serving
   */
  getFilePath(type: MediaType, filename: string): string {
    return join(this.mediaPath, type, basename(filename));
  }

  /**
   * Check if file exists
   */
  async exists(type: MediaType, filename: string): Promise<boolean> {
    try {
      await access(join(this.mediaPath, type, basename(filename)));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get media path
   */
  getMediaPath(): string {
    return this.mediaPath;
  }

  /**
   * Get max file size
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(path: string): Promise<void> {
    try {
      await access(path);
    } catch {
      await mkdir(path, { recursive: true });
    }
  }

  /**
   * Get MIME type from extension
   */
  private getMimeTypeFromExt(ext: string): string {
    const extToMime: Record<string, string> = {
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.weba': 'audio/webm',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return extToMime[ext] || 'application/octet-stream';
  }
}
