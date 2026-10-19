/**
 * Bull-off view helpers. The hub sends `bullOff` with every match state of
 * the Autodarts variant "Bull-off": per player.index the distance to the
 * bull centre in mm and the normalized dart coordinates (radius 1 = 170 mm).
 */

export interface BullOffPlayer {
  index: number
  name: string
  distance: number | null
  x: number | null
  y: number | null
}

export interface BullOffState {
  players: BullOffPlayer[]
  finished: boolean
  winnerIndex: number | null
}

export function isBullOffVariant(variant: string | null | undefined): boolean {
  return variant?.toLowerCase() === 'bull-off'
}

/** Players who have thrown, closest first; players without a dart last */
export function bullOffRanking(state: BullOffState | null): BullOffPlayer[] {
  if (!state) return []
  return [...state.players].sort((a, b) => {
    if (a.distance === null) return b.distance === null ? 0 : 1
    if (b.distance === null) return -1
    return a.distance - b.distance
  })
}

/** Board radius in mm: 1 coordinate unit = 170 mm (outer edge of the double) */
export const BOARD_RADIUS_MM = 170
/** Farthest a marker is drawn (just inside the number ring), in mm */
const MAX_MARKER_MM = 196
/** Smallest vertical gap between two labels, in mm */
const LABEL_GAP = 16

export interface DartMarker extends BullOffPlayer {
  x: number
  y: number
  offBoard: boolean
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

/**
 * Board positions (mm, SVG y pointing down) for every player with a dart.
 * Misses far outside are drawn at the edge; labels of darts close together
 * are moved apart so they stay readable.
 */
export function dartMarkers(players: BullOffPlayer[]): DartMarker[] {
  const markers: DartMarker[] = []
  for (const p of players) {
    if (p.x === null || p.y === null) continue
    let x = p.x * BOARD_RADIUS_MM
    let y = -p.y * BOARD_RADIUS_MM
    const len = Math.hypot(x, y)
    const offBoard = len > BOARD_RADIUS_MM
    if (len > MAX_MARKER_MM) {
      x = (x / len) * MAX_MARKER_MM
      y = (y / len) * MAX_MARKER_MM
    }
    const dir = Math.hypot(x, y) || 1
    let labelY = y + (y / dir) * 14
    for (const other of markers) {
      if (Math.abs(other.labelX - x) < 120 && Math.abs(other.labelY - labelY) < LABEL_GAP) {
        labelY = other.labelY + (labelY >= other.labelY ? LABEL_GAP : -LABEL_GAP)
      }
    }
    markers.push({
      ...p,
      x,
      y,
      offBoard,
      labelX: x + (x / dir) * 14,
      labelY,
      anchor: x >= 0 ? 'start' : 'end',
    })
  }
  return markers
}
