import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerMediaRoutes } from '../../../src/api/routes/media.js';
import { MediaService } from '../../../src/core/media/MediaService.js';
import { rm } from 'fs/promises';

const TEST_MEDIA_PATH = './test-media-api-temp';

// Mock APIServer
const mockServer = {
  isAuthEnabled: vi.fn().mockReturnValue(false),
};

describe('Media Routes', () => {
  let fastify: FastifyInstance;
  let mediaService: MediaService;

  beforeEach(async () => {
    mediaService = new MediaService({
      mediaPath: TEST_MEDIA_PATH,
      maxFileSize: 1024 * 1024,
    });
    await mediaService.init();

    fastify = Fastify();
    registerMediaRoutes(fastify, mockServer as any, { mediaService });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    try {
      await rm(TEST_MEDIA_PATH, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  describe('GET /api/media/:type', () => {
    it('should return empty list initially', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/image',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return uploaded files', async () => {
      // Upload a file first
      await mediaService.uploadFromBuffer(Buffer.from('test'), {
        type: 'image',
        originalName: 'test.png',
        mimeType: 'image/png',
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/image',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.files).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('should reject invalid media type', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/media/:type/:filename', () => {
    it('should delete existing file', async () => {
      const file = await mediaService.uploadFromBuffer(Buffer.from('delete me'), {
        type: 'image',
        originalName: 'delete.png',
        mimeType: 'image/png',
      });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/media/image/${file.filename}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/media/image/nonexistent.png',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/media/files/:type/:filename', () => {
    it('should serve uploaded file', async () => {
      const content = 'fake image content';
      const file = await mediaService.uploadFromBuffer(Buffer.from(content), {
        type: 'image',
        originalName: 'serve.png',
        mimeType: 'image/png',
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/media/files/image/${file.filename}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.body).toBe(content);
    });

    it('should return 404 for non-existent file', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/files/image/nonexistent.png',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should set cache headers', async () => {
      const file = await mediaService.uploadFromBuffer(Buffer.from('cache'), {
        type: 'image',
        originalName: 'cache.png',
        mimeType: 'image/png',
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/media/files/image/${file.filename}`,
      });

      expect(response.headers['cache-control']).toContain('max-age=');
    });
  });

  describe('GET /api/media/info', () => {
    it('should return media service info', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/info',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.maxFileSize).toBe(1024 * 1024);
      expect(body.allowedTypes.animation).toContain('image/gif');
      expect(body.allowedTypes.sound).toContain('audio/mpeg');
      expect(body.allowedTypes.image).toContain('image/png');
    });
  });

  describe('Authentication', () => {
    beforeEach(() => {
      mockServer.isAuthEnabled.mockReturnValue(true);
    });

    afterEach(() => {
      mockServer.isAuthEnabled.mockReturnValue(false);
    });

    it('should return 401 for listing when auth enabled', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/media/image',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow file serving without auth (public endpoint)', async () => {
      // First disable auth to upload
      mockServer.isAuthEnabled.mockReturnValue(false);
      const file = await mediaService.uploadFromBuffer(Buffer.from('public'), {
        type: 'image',
        originalName: 'public.png',
        mimeType: 'image/png',
      });

      // Re-enable auth
      mockServer.isAuthEnabled.mockReturnValue(true);

      // File serving should still work
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/media/files/image/${file.filename}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
