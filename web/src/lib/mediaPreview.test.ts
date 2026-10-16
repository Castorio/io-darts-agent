import { describe, it, expect } from 'vitest'
import { previewKind, neighborIndex } from './mediaPreview'

describe('previewKind', () => {
  it.each([
    ['video/webm', 'a.webm', 'video'],
    ['video/mp4', 'a.mp4', 'video'],
    ['image/gif', 'a.gif', 'image'],
    ['image/png', 'a.png', 'image'],
    ['audio/mpeg', 'a.mp3', 'audio'],
    ['', 'a.wav', 'audio'],
    ['', 'a.webm', 'video'],
    ['application/octet-stream', 'a.json', 'other'],
  ])('%s %s -> %s', (mime, name, kind) => {
    expect(previewKind(mime, name)).toBe(kind)
  })
})

describe('neighborIndex', () => {
  it('moves within the list and stops at the ends', () => {
    expect(neighborIndex(3, 1, 1)).toBe(2)
    expect(neighborIndex(3, 1, -1)).toBe(0)
    expect(neighborIndex(3, 2, 1)).toBeNull()
    expect(neighborIndex(3, 0, -1)).toBeNull()
  })
})
