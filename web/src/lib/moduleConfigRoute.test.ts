import { describe, it, expect } from 'vitest'
import { dedicatedConfigRoute } from './moduleConfigRoute'

describe('dedicatedConfigRoute', () => {
  it('sends WLED to its own configuration page', () => {
    expect(dedicatedConfigRoute('wled')).toBe('wled-config')
  })

  it('keeps the generic form for other modules', () => {
    expect(dedicatedConfigRoute('game-display')).toBeNull()
    expect(dedicatedConfigRoute('my-module')).toBeNull()
  })
})
