import { describe, it, expect } from 'vitest'
import { ANIMATION_EVENTS, animationSlotFor } from './animationEvents'
import { DART_EVENT_TYPES } from '../../../src/core/media/types/animation'
import gameDisplay from '../../../modules/game-display/module.json'

describe('animation generator events', () => {
  it('only offers event ids the hub accepts', () => {
    for (const event of ANIMATION_EVENTS) {
      expect(DART_EVENT_TYPES, event.id).toContain(event.id)
    }
  })

  it('maps every offered event to an existing Game Display animation slot', () => {
    const slots = Object.keys((gameDisplay as { config: Record<string, unknown> }).config)
    for (const event of ANIMATION_EVENTS) {
      expect(slots, event.id).toContain(event.slot)
    }
  })

  it('finds the slot for a finished job and ignores unknown event types', () => {
    expect(animationSlotFor('double-bull')).toBe('animationDoubleBull')
    expect(animationSlotFor('leg-won')).toBe('animationLegWin')
    expect(animationSlotFor('setWin')).toBeUndefined()
  })
})
