import { isCricket } from './cricket'
import { isBullOffVariant } from './bullOff'

/**
 * Game info lines for the display (game, legs/sets, in mode)
 */

export interface GameInfoData {
  variant: string
  baseScore: number
  inMode: string
  outMode: string
  bullMode: string
  maxRounds: number
  cutThroat?: boolean
  setsToWin: number
  legsToWin: number
}

export interface GameInfoLine {
  label: string
  value: string
}

type Translate = (key: string) => string

/**
 * Autodarts sends legs and sets as the number needed to win, and null for a
 * single leg match
 */
export function legsAndSetsFrom(source: { legs?: unknown; sets?: unknown }): { legsToWin: number; setsToWin: number } {
  const count = (value: unknown): number => (typeof value === 'number' && value >= 1 ? value : 1)
  return { legsToWin: count(source.legs), setsToWin: count(source.sets) }
}

/** Autodarts writes modes capitalised ("Straight", "Double") */
function formatMode(mode: string, isIn: boolean, t: Translate): string {
  switch (mode.toLowerCase()) {
    case 'straight':
      return isIn ? t('strings.straightIn') : t('strings.straightOut')
    case 'double':
      return isIn ? t('strings.doubleIn') : t('strings.doubleOut')
    case 'master':
      return t('strings.masterOut')
    default:
      return mode
  }
}

export function gameInfoLines(info: GameInfoData, t: Translate): GameInfoLine[] {
  const lines: GameInfoLine[] = []

  // Bull-off: only decides who starts, no score, legs or modes
  if (isBullOffVariant(info.variant)) {
    return [{ label: t('gameInfo.game'), value: t('bullOff.title') }]
  }

  const cricket = isCricket(info.variant)
  if (cricket) {
    // Score and in/out modes are X01 only
    lines.push({ label: t('gameInfo.game'), value: info.cutThroat ? `Cricket ${t('cricket.cutThroat')}` : 'Cricket' })
  } else {
    const game = info.baseScore > 0 ? `${info.baseScore}` : info.variant
    lines.push({ label: t('gameInfo.game'), value: `${game} ${formatMode(info.outMode, false, t)}` })
  }

  const legs = info.legsToWin > 1 ? `${t('strings.firstTo')} ${info.legsToWin} ${t('score.legs')}` : `1 ${t('score.leg')}`
  if (info.setsToWin > 1) {
    lines.push({
      label: t('gameInfo.format'),
      value: `${t('strings.firstTo')} ${info.setsToWin} ${t('score.sets')}, ${legs}`,
    })
  } else {
    lines.push({ label: t('gameInfo.legs'), value: legs })
  }

  // Straight in is the default and not worth a line
  if (!cricket && info.inMode.toLowerCase() !== 'straight') {
    lines.push({ label: t('gameInfo.inMode'), value: formatMode(info.inMode, true, t) })
  }

  return lines
}
