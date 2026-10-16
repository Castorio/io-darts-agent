import type { FastifyInstance } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import type { APIServer } from '../Server.js';
import type { MediaService, MediaFile, MediaType, MediaFolder } from '../../core/media/MediaService.js';
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
  folder?: string;
}

/**
 * Folder list response
 */
export interface FolderListResponse {
  folders: MediaFolder[];
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
 * Folder operation response
 */
export interface FolderResponse {
  success: boolean;
  folder?: MediaFolder;
  error?: string;
}

/**
 * Move file response
 */
export interface MoveFileResponse {
  success: boolean;
  file?: MediaFile;
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
   * Query params:
   *   - folder: Optional folder path (use '*' to list all files recursively)
   */
  fastify.get<{
    Params: { type: string };
    Querystring: { folder?: string };
    Reply: MediaListResponse | { error: string };
  }>('/api/media/:type', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { error: 'Authentication required' };
    }

    const { type } = request.params;
    const { folder } = request.query;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { error: 'Invalid media type. Must be: animation, sound, or image' };
    }

    const files = await mediaService.listFiles(type as MediaType, folder);

    return {
      files,
      total: files.length,
      folder: folder === '*' ? undefined : folder,
    };
  });

  /**
   * GET /api/media/:type/folders - List all folders for a media type
   */
  fastify.get<{
    Params: { type: string };
    Reply: FolderListResponse | { error: string };
  }>('/api/media/:type/folders', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { error: 'Authentication required' };
    }

    const { type } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { error: 'Invalid media type' };
    }

    const folders = await mediaService.listFolders(type as MediaType);

    return {
      folders,
      total: folders.length,
    };
  });

  /**
   * POST /api/media/:type/folders - Create a new folder
   */
  fastify.post<{
    Params: { type: string };
    Body: { path: string };
    Reply: FolderResponse;
  }>('/api/media/:type/folders', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type } = request.params;
    const { path } = request.body;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    if (!path || typeof path !== 'string') {
      void reply.code(400);
      return { success: false, error: 'Folder path is required' };
    }

    try {
      const folder = await mediaService.createFolder(type as MediaType, path);
      void reply.code(201);
      return { success: true, folder };
    } catch (error) {
      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create folder',
      };
    }
  });

  /**
   * DELETE /api/media/:type/folders/:path - Delete a folder (must be empty)
   */
  fastify.delete<{
    Params: { type: string; path: string };
    Reply: DeleteResponse;
  }>('/api/media/:type/folders/:path', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type, path } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    const deleted = await mediaService.deleteFolder(type as MediaType, path);

    if (!deleted) {
      void reply.code(400);
      return { success: false, error: 'Failed to delete folder. Make sure it is empty.' };
    }

    return { success: true, message: 'Folder deleted' };
  });

  /**
   * POST /api/media/:type/upload - Upload a media file
   * Query params:
   *   - folder: Optional folder path to upload to
   */
  fastify.post<{
    Params: { type: string };
    Querystring: { folder?: string };
    Reply: UploadResponse;
  }>('/api/media/:type/upload', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type } = request.params;
    const { folder } = request.query;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    try {
      // Get multipart data (file() is added by the @fastify/multipart plugin)
      const data: MultipartFile | undefined = await request.file();

      if (!data) {
        void reply.code(400);
        return { success: false, error: 'No file uploaded' };
      }

      const { filename, mimetype, file: fileStream } = data;

      // Validate MIME type
      if (!mediaService.validateFileType(mimetype, type as MediaType)) {
        const allowed = mediaService.getAllowedMimeTypes(type as MediaType);
        void reply.code(400);
        return {
          success: false,
          error: `Invalid file type. Allowed: ${allowed.join(', ')}`,
        };
      }

      // Upload file with optional folder
      const mediaFile = await mediaService.uploadFromStream(fileStream, {
        type: type as MediaType,
        originalName: filename,
        mimeType: mimetype,
        folder,
      });

      void reply.code(201);
      return {
        success: true,
        file: mediaFile,
      };
    } catch (error) {
      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  });

  /**
   * POST /api/media/:type/move - Move a file to a different folder
   */
  fastify.post<{
    Params: { type: string };
    Body: { filename: string; fromFolder?: string; toFolder?: string };
    Reply: MoveFileResponse;
  }>('/api/media/:type/move', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type } = request.params;
    const { filename, fromFolder, toFolder } = request.body;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    if (!filename) {
      void reply.code(400);
      return { success: false, error: 'Filename is required' };
    }

    const movedFile = await mediaService.moveFile(
      type as MediaType,
      filename,
      fromFolder,
      toFolder
    );

    if (!movedFile) {
      void reply.code(404);
      return { success: false, error: 'File not found or move failed' };
    }

    return { success: true, file: movedFile };
  });

  /**
   * DELETE /api/media/:type/:filename - Delete a media file
   * Query params:
   *   - folder: Optional folder path where the file is located
   */
  fastify.delete<{
    Params: { type: string; filename: string };
    Querystring: { folder?: string };
    Reply: DeleteResponse;
  }>('/api/media/:type/:filename', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { type, filename } = request.params;
    const { folder } = request.query;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { success: false, error: 'Invalid media type' };
    }

    const deleted = await mediaService.delete(type as MediaType, filename, folder);

    if (!deleted) {
      void reply.code(404);
      return { success: false, error: 'File not found' };
    }

    return {
      success: true,
      message: 'File deleted',
    };
  });

  /**
   * GET /api/media/files/:type/:filename - Serve a media file from root folder
   * This endpoint is public (no auth required) for embedding in displays
   */
  fastify.get<{
    Params: { type: string; filename: string };
  }>('/api/media/files/:type/:filename', async (request, reply) => {
    const { type, filename } = request.params;

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { error: 'Invalid media type' };
    }

    const exists = await mediaService.exists(type as MediaType, filename);
    if (!exists) {
      void reply.code(404);
      return { error: 'File not found' };
    }

    const filePath = mediaService.getFilePath(type as MediaType, filename);
    const stats = await stat(filePath);
    const contentType = getContentType(filename);

    void reply.header('Content-Type', contentType);
    void reply.header('Content-Length', stats.size);
    void reply.header('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    const stream = createReadStream(filePath);
    return reply.send(stream);
  });

  /**
   * GET /api/media/files/:type/:folder/:filename - Serve a media file from subfolder
   * Supports nested folders with wildcard path
   * This endpoint is public (no auth required) for embedding in displays
   */
  fastify.get<{
    Params: { type: string; '*': string };
  }>('/api/media/files/:type/*', async (request, reply) => {
    const { type } = request.params;
    const pathParts = request.params['*'];

    if (!['animation', 'sound', 'image'].includes(type)) {
      void reply.code(400);
      return { error: 'Invalid media type' };
    }

    // Parse path: last segment is filename, rest is folder path
    const segments = pathParts.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) {
      void reply.code(400);
      return { error: 'Filename is required' };
    }

    const filename = segments.pop()!;
    const folder = segments.length > 0 ? segments.join('/') : undefined;

    const exists = await mediaService.exists(type as MediaType, filename, folder);
    if (!exists) {
      void reply.code(404);
      return { error: 'File not found' };
    }

    const filePath = mediaService.getFilePath(type as MediaType, filename, folder);
    const stats = await stat(filePath);
    const contentType = getContentType(filename);

    void reply.header('Content-Type', contentType);
    void reply.header('Content-Length', stats.size);
    void reply.header('Cache-Control', 'public, max-age=31536000'); // 1 year cache

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
  }>('/api/media/info', () => {
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
