import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaService } from './MediaService.js';
import { rm, mkdir, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';

const TEST_MEDIA_PATH = './test-media-temp';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    service = new MediaService({
      mediaPath: TEST_MEDIA_PATH,
      maxFileSize: 1024 * 1024, // 1MB for tests
    });
    await service.init();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(TEST_MEDIA_PATH, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('init()', () => {
    it('should create media directories', async () => {
      const dirs = await readdir(TEST_MEDIA_PATH);
      expect(dirs).toContain('animation');
      expect(dirs).toContain('sound');
      expect(dirs).toContain('image');
    });
  });

  describe('validateFileType()', () => {
    it('should accept valid animation types', () => {
      expect(service.validateFileType('image/gif', 'animation')).toBe(true);
      expect(service.validateFileType('video/mp4', 'animation')).toBe(true);
      expect(service.validateFileType('video/webm', 'animation')).toBe(true);
    });

    it('should accept valid sound types', () => {
      expect(service.validateFileType('audio/mpeg', 'sound')).toBe(true);
      expect(service.validateFileType('audio/wav', 'sound')).toBe(true);
      expect(service.validateFileType('audio/ogg', 'sound')).toBe(true);
    });

    it('should accept valid image types', () => {
      expect(service.validateFileType('image/png', 'image')).toBe(true);
      expect(service.validateFileType('image/jpeg', 'image')).toBe(true);
      expect(service.validateFileType('image/webp', 'image')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(service.validateFileType('text/plain', 'animation')).toBe(false);
      expect(service.validateFileType('application/pdf', 'image')).toBe(false);
      expect(service.validateFileType('video/mp4', 'sound')).toBe(false);
    });
  });

  describe('getAllowedMimeTypes()', () => {
    it('should return allowed types for animation', () => {
      const types = service.getAllowedMimeTypes('animation');
      expect(types).toContain('image/gif');
      expect(types).toContain('video/mp4');
    });

    it('should return allowed types for sound', () => {
      const types = service.getAllowedMimeTypes('sound');
      expect(types).toContain('audio/mpeg');
      expect(types).toContain('audio/wav');
    });

    it('should return allowed types for image', () => {
      const types = service.getAllowedMimeTypes('image');
      expect(types).toContain('image/png');
      expect(types).toContain('image/jpeg');
    });
  });

  describe('uploadFromBuffer()', () => {
    it('should upload a valid file', async () => {
      const buffer = Buffer.from('fake image data');
      const result = await service.uploadFromBuffer(buffer, {
        type: 'image',
        originalName: 'test.png',
        mimeType: 'image/png',
      });

      expect(result.id).toBeDefined();
      expect(result.filename).toMatch(/\.png$/);
      expect(result.type).toBe('image');
      expect(result.mimeType).toBe('image/png');
      expect(result.size).toBe(buffer.length);
      expect(result.url).toContain('/api/media/files/image/');
    });

    it('should reject invalid MIME type', async () => {
      const buffer = Buffer.from('fake data');

      await expect(
        service.uploadFromBuffer(buffer, {
          type: 'image',
          originalName: 'test.exe',
          mimeType: 'application/x-executable',
        })
      ).rejects.toThrow('Invalid file type');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB > 1MB limit

      await expect(
        service.uploadFromBuffer(largeBuffer, {
          type: 'image',
          originalName: 'large.png',
          mimeType: 'image/png',
        })
      ).rejects.toThrow('File too large');
    });
  });

  describe('uploadFromStream()', () => {
    it('should upload from stream', async () => {
      const data = Buffer.from('test stream data');
      const stream = Readable.from([data]);

      const result = await service.uploadFromStream(stream, {
        type: 'animation',
        originalName: 'test.gif',
        mimeType: 'image/gif',
      });

      expect(result.id).toBeDefined();
      expect(result.filename).toMatch(/\.gif$/);
      expect(result.type).toBe('animation');
    });
  });

  describe('listFiles()', () => {
    it('should list uploaded files', async () => {
      // Upload some files
      await service.uploadFromBuffer(Buffer.from('file1'), {
        type: 'image',
        originalName: 'file1.png',
        mimeType: 'image/png',
      });

      await service.uploadFromBuffer(Buffer.from('file2'), {
        type: 'image',
        originalName: 'file2.png',
        mimeType: 'image/png',
      });

      const files = await service.listFiles('image');

      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('image');
    });

    it('should return empty array for no files', async () => {
      const files = await service.listFiles('sound');
      expect(files).toEqual([]);
    });
  });

  describe('delete()', () => {
    it('should delete existing file', async () => {
      const result = await service.uploadFromBuffer(Buffer.from('to delete'), {
        type: 'image',
        originalName: 'delete.png',
        mimeType: 'image/png',
      });

      const deleted = await service.delete('image', result.filename);
      expect(deleted).toBe(true);

      const exists = await service.exists('image', result.filename);
      expect(exists).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const deleted = await service.delete('image', 'nonexistent.png');
      expect(deleted).toBe(false);
    });
  });

  describe('exists()', () => {
    it('should return true for existing file', async () => {
      const result = await service.uploadFromBuffer(Buffer.from('exists'), {
        type: 'image',
        originalName: 'exists.png',
        mimeType: 'image/png',
      });

      const exists = await service.exists('image', result.filename);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await service.exists('image', 'nonexistent.png');
      expect(exists).toBe(false);
    });
  });

  describe('getFilePath()', () => {
    it('should return correct file path', () => {
      const path = service.getFilePath('animation', 'test.gif');
      expect(path).toBe(join(TEST_MEDIA_PATH, 'animation', 'test.gif'));
    });

    it('should sanitize filename', () => {
      const path = service.getFilePath('animation', '../../../etc/passwd');
      expect(path).not.toContain('..');
    });
  });

  describe('getMaxFileSize()', () => {
    it('should return configured max file size', () => {
      expect(service.getMaxFileSize()).toBe(1024 * 1024);
    });
  });
});
