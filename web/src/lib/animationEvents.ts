/**
 * Events the animation generator offers
 *
 * `id` is the event type the hub accepts (DART_EVENT_TYPES), `slot` the
 * Game Display animation setting a finished animation is assigned to.
 */
export interface AnimationEvent {
  id: string
  slot: string
  labelKey: string
  icon: string
}

export const ANIMATION_EVENTS: AnimationEvent[] = [
  { id: '180', slot: 'animation180', labelKey: 'animationGen.event180', icon: '🎯' },
  { id: 'bull', slot: 'animationBull', labelKey: 'animationGen.eventBull', icon: '🎯' },
  { id: 'double-bull', slot: 'animationDoubleBull', labelKey: 'animationGen.eventDoubleBull', icon: '🎯' },
  { id: '160+', slot: 'animationHighScore', labelKey: 'animationGen.eventHighScore', icon: '🔥' },
  { id: 'checkout', slot: 'animationCheckout', labelKey: 'animationGen.eventCheckout', icon: '✅' },
  { id: 'leg-won', slot: 'animationLegWin', labelKey: 'animationGen.eventLegWin', icon: '🏆' },
  { id: 'match-won', slot: 'animationMatchWin', labelKey: 'animationGen.eventMatchWin', icon: '🥇' },
  { id: 'bust', slot: 'animationBust', labelKey: 'animationGen.eventBust', icon: '💥' },
]

export function animationSlotFor(eventType: string): string | undefined {
  return ANIMATION_EVENTS.find((e) => e.id === eventType)?.slot
}
