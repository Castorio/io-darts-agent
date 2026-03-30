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
  /** Subfolder path (e.g., "ai-generated/180" or "custom") */
  folder?: string;
}

/**
 * Media folder info
 */
export interface MediaFolder {
  name: string;
  path: string;
  type: MediaType;
  fileCount: number;
  createdAt: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  type: MediaType;
  originalName: string;
  mimeType: string;
  /** Optional subfolder to place the file in */
  folder?: string;
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
    const { type, originalName, mimeType, folder } = options;

    // Validate MIME type
    if (!this.validateFileType(mimeType, type)) {
      throw new Error(
        `Invalid file type. Allowed types for ${type}: ${ALLOWED_MIME_TYPES[type].join(', ')}`
      );
    }

    // Validate and sanitize folder path
    const sanitizedFolder = folder ? this.sanitizeFolderPath(folder) : undefined;

    // Generate unique filename
    const id = randomUUID();
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || extname(originalName);
    const filename = `${id}${ext}`;

    // Build file path with optional subfolder
    const targetDir = sanitizedFolder
      ? join(this.mediaPath, type, sanitizedFolder)
      : join(this.mediaPath, type);

    // Ensure target directory exists
    await this.ensureDir(targetDir);

    const filePath = join(targetDir, filename);

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

    // Build URL with folder path
    const urlPath = sanitizedFolder
      ? `${this.baseUrl}/${type}/${sanitizedFolder}/${filename}`
      : `${this.baseUrl}/${type}/${filename}`;

    return {
      id,
      filename,
      originalName,
      type,
      mimeType,
      size: stats.size,
      url: urlPath,
      createdAt: new Date().toISOString(),
      folder: sanitizedFolder,
    };
  }

  /**
   * Upload a file from buffer
   */
  async uploadFromBuffer(
    buffer: Buffer,
    options: UploadOptions
  ): Promise<MediaFile> {
    const { type, originalName, mimeType, folder } = options;

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

    // Validate and sanitize folder path
    const sanitizedFolder = folder ? this.sanitizeFolderPath(folder) : undefined;

    // Generate unique filename
    const id = randomUUID();
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || extname(originalName);
    const filename = `${id}${ext}`;

    // Build file path with optional subfolder
    const targetDir = sanitizedFolder
      ? join(this.mediaPath, type, sanitizedFolder)
      : join(this.mediaPath, type);

    // Ensure target directory exists
    await this.ensureDir(targetDir);

    const filePath = join(targetDir, filename);

    // Write file
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, buffer);

    // Build URL with folder path
    const urlPath = sanitizedFolder
      ? `${this.baseUrl}/${type}/${sanitizedFolder}/${filename}`
      : `${this.baseUrl}/${type}/${filename}`;

    return {
      id,
      filename,
      originalName,
      type,
      mimeType,
      size: buffer.length,
      url: urlPath,
      createdAt: new Date().toISOString(),
      folder: sanitizedFolder,
    };
  }

  /**
   * Delete a file
   * @param type - Media type
   * @param filename - Filename to delete
   * @param folder - Optional subfolder path
   */
  async delete(type: MediaType, filename: string, folder?: string): Promise<boolean> {
    const sanitizedFolder = folder ? this.sanitizeFolderPath(folder) : undefined;
    const targetDir = sanitizedFolder
      ? join(this.mediaPath, type, sanitizedFolder)
      : join(this.mediaPath, type);
    const filePath = join(targetDir, basename(filename));

    try {
      await access(filePath);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files by type, optionally filtered by folder
   * @param type - Media type
   * @param folder - Optional subfolder path (use '*' to include all subfolders recursively)
   */
  async listFiles(type: MediaType, folder?: string): Promise<MediaFile[]> {
    const baseDir = join(this.mediaPath, type);

    try {
      await access(baseDir);
    } catch {
      return [];
    }

    // If folder is '*', list all files recursively
    if (folder === '*') {
      return this.listFilesRecursive(type, baseDir, '');
    }

    // If folder specified, list only that folder
    const sanitizedFolder = folder ? this.sanitizeFolderPath(folder) : undefined;
    const dirPath = sanitizedFolder ? join(baseDir, sanitizedFolder) : baseDir;

    try {
      await access(dirPath);
    } catch {
      return [];
    }

    const entries = await readdir(dirPath, { withFileTypes: true });
    const mediaFiles: MediaFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filename = entry.name;
      const filePath = join(dirPath, filename);
      const stats = await stat(filePath);

      const ext = extname(filename).toLowerCase();
      const mimeType = this.getMimeTypeFromExt(ext);

      // Build URL with folder path
      const urlPath = sanitizedFolder
        ? `${this.baseUrl}/${type}/${sanitizedFolder}/${filename}`
        : `${this.baseUrl}/${type}/${filename}`;

      mediaFiles.push({
        id: basename(filename, ext),
        filename,
        originalName: filename,
        type,
        mimeType,
        size: stats.size,
        url: urlPath,
        createdAt: stats.birthtime.toISOString(),
        folder: sanitizedFolder,
      });
    }

    return mediaFiles.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * List files recursively from all subfolders
   */
  private async listFilesRecursive(
    type: MediaType,
    baseDir: string,
    currentFolder: string
  ): Promise<MediaFile[]> {
    const dirPath = currentFolder ? join(baseDir, currentFolder) : baseDir;
    const mediaFiles: MediaFile[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectory
          const subFolder = currentFolder ? `${currentFolder}/${entry.name}` : entry.name;
          const subFiles = await this.listFilesRecursive(type, baseDir, subFolder);
          mediaFiles.push(...subFiles);
        } else if (entry.isFile()) {
          const filename = entry.name;
          const stats = await stat(entryPath);
          const ext = extname(filename).toLowerCase();
          const mimeType = this.getMimeTypeFromExt(ext);

          // Build URL with folder path
          const urlPath = currentFolder
            ? `${this.baseUrl}/${type}/${currentFolder}/${filename}`
            : `${this.baseUrl}/${type}/${filename}`;

          mediaFiles.push({
            id: basename(filename, ext),
            filename,
            originalName: filename,
            type,
            mimeType,
            size: stats.size,
            url: urlPath,
            createdAt: stats.birthtime.toISOString(),
            folder: currentFolder || undefined,
          });
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return mediaFiles.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get file path for serving
   */
  getFilePath(type: MediaType, filename: string, folder?: string): string {
    const sanitizedFolder = folder ? this.sanitizeFolderPath(folder) : undefined;
    const targetDir = sanitizedFolder
      ? join(this.mediaPath, type, sanitizedFolder)
      : join(this.mediaPath, type);
    return join(targetDir, basename(filename));
  }

  /**
   * Check if file exists
   */
  async exists(type: MediaType, filename: string, folder?: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(type, filename, folder);
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all folders for a media type
   */
  async listFolders(type: MediaType): Promise<MediaFolder[]> {
    const baseDir = join(this.mediaPath, type);
    const folders: MediaFolder[] = [];

    try {
      await access(baseDir);
    } catch {
      return [];
    }

    await this.listFoldersRecursive(baseDir, '', type, folders);

    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * List folders recursively
   */
  private async listFoldersRecursive(
    baseDir: string,
    currentPath: string,
    type: MediaType,
    folders: MediaFolder[]
  ): Promise<void> {
    const dirPath = currentPath ? join(baseDir, currentPath) : baseDir;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          const fullPath = join(baseDir, folderPath);

          // Count files in this folder
          const files = await readdir(fullPath, { withFileTypes: true });
          const fileCount = files.filter((f) => f.isFile()).length;

          // Get folder creation time
          const stats = await stat(fullPath);

          folders.push({
            name: entry.name,
            path: folderPath,
            type,
            fileCount,
            createdAt: stats.birthtime.toISOString(),
          });

          // Recurse into subdirectory
          await this.listFoldersRecursive(baseDir, folderPath, type, folders);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  /**
   * Create a folder
   */
  async createFolder(type: MediaType, folderPath: string): Promise<MediaFolder> {
    const sanitizedPath = this.sanitizeFolderPath(folderPath);
    const fullPath = join(this.mediaPath, type, sanitizedPath);

    await this.ensureDir(fullPath);

    const stats = await stat(fullPath);
    const name = sanitizedPath.split('/').pop() || sanitizedPath;

    return {
      name,
      path: sanitizedPath,
      type,
      fileCount: 0,
      createdAt: stats.birthtime.toISOString(),
    };
  }

  /**
   * Delete a folder (must be empty)
   */
  async deleteFolder(type: MediaType, folderPath: string): Promise<boolean> {
    const sanitizedPath = this.sanitizeFolderPath(folderPath);
    const fullPath = join(this.mediaPath, type, sanitizedPath);

    try {
      const entries = await readdir(fullPath);
      if (entries.length > 0) {
        throw new Error('Folder is not empty');
      }

      const { rmdir } = await import('fs/promises');
      await rmdir(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Move a file to a different folder
   */
  async moveFile(
    type: MediaType,
    filename: string,
    fromFolder: string | undefined,
    toFolder: string | undefined
  ): Promise<MediaFile | null> {
    const sanitizedFrom = fromFolder ? this.sanitizeFolderPath(fromFolder) : undefined;
    const sanitizedTo = toFolder ? this.sanitizeFolderPath(toFolder) : undefined;

    const sourceDir = sanitizedFrom
      ? join(this.mediaPath, type, sanitizedFrom)
      : join(this.mediaPath, type);
    const targetDir = sanitizedTo
      ? join(this.mediaPath, type, sanitizedTo)
      : join(this.mediaPath, type);

    const sourcePath = join(sourceDir, basename(filename));
    const targetPath = join(targetDir, basename(filename));

    try {
      // Check source exists
      await access(sourcePath);

      // Ensure target directory exists
      await this.ensureDir(targetDir);

      // Move file
      const { rename } = await import('fs/promises');
      await rename(sourcePath, targetPath);

      // Get file info
      const stats = await stat(targetPath);
      const ext = extname(filename).toLowerCase();
      const mimeType = this.getMimeTypeFromExt(ext);

      const urlPath = sanitizedTo
        ? `${this.baseUrl}/${type}/${sanitizedTo}/${filename}`
        : `${this.baseUrl}/${type}/${filename}`;

      return {
        id: basename(filename, ext),
        filename,
        originalName: filename,
        type,
        mimeType,
        size: stats.size,
        url: urlPath,
        createdAt: stats.birthtime.toISOString(),
        folder: sanitizedTo,
      };
    } catch {
      return null;
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
   * Sanitize folder path to prevent directory traversal attacks
   */
  private sanitizeFolderPath(folderPath: string): string {
    // Remove leading/trailing slashes and normalize
    let sanitized = folderPath
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/\/+/g, '/') // Collapse multiple slashes
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>:"|?*\\]/g, '') // Remove invalid characters
      .trim();

    // Split, filter empty segments, and rejoin
    sanitized = sanitized
      .split('/')
      .filter((segment) => segment.length > 0 && segment !== '.')
      .join('/');

    return sanitized;
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
