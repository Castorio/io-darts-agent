import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import type { APIServer } from '../Server.js';
import type { MediaService, MediaFile, MediaType } from '../../core/media/MediaService.js';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export interface MediaDependencies {
  mediaService: MediaService;
}

/**
 * Media list response
 */
export interface MediaListResponse {
  files: MediaFile[];
  total: number;
}

/**
 * Upload response
 */
export interface UploadResponse {
  success: boolean;
  file?: MediaFile;
  error?: string;
}

/**
 * Delete response
 */
export interface DeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Helper to check authentication
 */
function isAuthorized(
  server: APIServer,
  session: { authenticated?: boolean } | undefined
): boolean {
  if (!server.isAuthEnabled()) {
    return true;
  }
  return session?.authenticated === true;
}

/**
 * Get content type for file extension
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    weba: 'audio/webm',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return types[ext || ''] || 'application/octet-stream';
}

/**
 * Register media routes
 */
export function registerMediaRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: MediaDependencies
): void {
  const { mediaService } = deps;

  /**
   * GET /api/media/:type - List media files by type
   */
  fastify.get<{
    Params: { type: string };
    Reply: MediaListResponse | { error: string };
  }>('/api/media/:type', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const { type } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      reply.code(400);
      return { error: 'Invalid media type. Must be: animation, sound, or image' };
    }

    const files = await mediaService.listFiles(type as MediaType);

    return {
      files,
      total: files.length,
    };
  });

  /**
   * POST /api/media/:type/upload - Upload a media file
   */
  fastify.post<{
    Params: { type: string };
    Reply: UploadResponse;
  }>('/api/media/:type/upload', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    try {
      // Get multipart data - need to cast request to access file() method from multipart plugin
      const data = await (request as any).file() as MultipartFile | undefined;

      if (!data) {
        reply.code(400);
        return { success: false, error: 'No file uploaded' };
      }

      const { filename, mimetype, file: fileStream } = data;

      // Validate MIME type
      if (!mediaService.validateFileType(mimetype, type as MediaType)) {
        const allowed = mediaService.getAllowedMimeTypes(type as MediaType);
        reply.code(400);
        return {
          success: false,
          error: `Invalid file type. Allowed: ${allowed.join(', ')}`,
        };
      }

      // Upload file
      const mediaFile = await mediaService.uploadFromStream(fileStream, {
        type: type as MediaType,
        originalName: filename,
        mimeType: mimetype,
      });

      reply.code(201);
      return {
        success: true,
        file: mediaFile,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  });

  /**
   * DELETE /api/media/:type/:filename - Delete a media file
   */
  fastify.delete<{
    Params: { type: string; filename: string };
    Reply: DeleteResponse;
  }>('/api/media/:type/:filename', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type, filename } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    const deleted = await mediaService.delete(type as MediaType, filename);

    if (!deleted) {
      reply.code(404);
      return { success: false, error: 'File not found' };
    }

    return {
      success: true,
      message: 'File deleted',
    };
  });

  /**
   * GET /api/media/files/:type/:filename - Serve a media file
   * This endpoint is public (no auth required) for embedding in displays
   */
  fastify.get<{
    Params: { type: string; filename: string };
  }>('/api/media/files/:type/:filename', async (request, reply) => {
    const { type, filename } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      reply.code(400);
      return { error: 'Invalid media type' };
    }

    const exists = await mediaService.exists(type as MediaType, filename);
    if (!exists) {
      reply.code(404);
      return { error: 'File not found' };
    }

    const filePath = mediaService.getFilePath(type as MediaType, filename);
    const stats = await stat(filePath);
    const contentType = getContentType(filename);

    reply.header('Content-Type', contentType);
    reply.header('Content-Length', stats.size);
    reply.header('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    const stream = createReadStream(filePath);
    return reply.send(stream);
  });

  /**
   * GET /api/media/info - Get media service info
   */
  fastify.get<{
    Reply: {
      maxFileSize: number;
      allowedTypes: Record<MediaType, string[]>;
    };
  }>('/api/media/info', async () => {
    return {
      maxFileSize: mediaService.getMaxFileSize(),
      allowedTypes: {
        animation: mediaService.getAllowedMimeTypes('animation'),
        sound: mediaService.getAllowedMimeTypes('sound'),
        image: mediaService.getAllowedMimeTypes('image'),
      },
    };
  });
}
