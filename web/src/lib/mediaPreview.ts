/**
 * Helpers for the media library preview
 */

export type PreviewKind = 'video' | 'image' | 'audio' | 'other'

const EXT_KIND: Record<string, PreviewKind> = {
  webm: 'video',
  mp4: 'video',
  mov: 'video',
  gif: 'image',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  svg: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  weba: 'audio',
}

/** How a file is shown: GIFs are images, everything else follows its type */
export function previewKind(mimeType: string, name: string): PreviewKind {
  if (mimeType === 'image/gif') return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_KIND[ext] ?? 'other'
}

/** Index of the previous (-1) or next (1) file, null at the ends */
export function neighborIndex(length: number, index: number, direction: -1 | 1): number | null {
  const next = index + direction
  return next >= 0 && next < length ? next : null
}
