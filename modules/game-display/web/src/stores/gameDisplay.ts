import { defineStore } from 'pinia'
import { legsAndSetsFrom } from '../utils/gameInfo'
import { ref, shallowRef, computed } from 'vue'
import { DEFAULT_HIGH_SCORE_THRESHOLD, ThrowAnimationTracker, throwAnimationsForDart } from '../utils/throwAnimations'
import {
  CRICKET_FIELDS,
  DEFAULT_CRICKET_MARKS_THRESHOLD,
  OnceTracker,
  isCricket,
  type CricketState,
} from '../utils/cricket'

// ============================================================================
// PLAYER RESOLVER - Robuste Spieler-Erkennung trotz Array-Rotation
// ============================================================================
// Autodarts rotiert das Spieler-Array nach jedem Leg. Das führt zu Problemen:
// - Array-Position (data.player) ändert sich
// - Der "winner" Index bezieht sich auf die AKTUELLE (rotierte) Array-Position
// - Scores-Array ist nach player.index indiziert (stabil)
//
// Lösung: PlayerResolver nutzt eine stabile interne Map (by player.index)
// und bietet einheitliche Lookup-Methoden.
// ============================================================================

interface ResolvedPlayer {
  index: number           // Stabiler player.index von Autodarts
  arrayPosition: number   // Aktuelle Position in gameState.players
  name: string
  score: number
  setsWon: number
  legsWon: number
  isActive: boolean
  color: string
  average?: number
  dartsThrown?: number
  odId?: string
}

interface PlayerLookupResult {
  player: ResolvedPlayer | null
  arrayPosition: number
  confidence: 'high' | 'medium' | 'low'
  method: 'name' | 'index' | 'arrayPosition' | 'none'
}

class PlayerResolver {
  // Interne Map: player.index -> Player-Daten
  private playersByIndex: Map<number, ResolvedPlayer> = new Map()
  // Name -> player.index für schnelles Lookup
  private indexByName: Map<string, number> = new Map()
  // odId -> player.index für Animation-Lookup
  private indexByOdId: Map<string, number> = new Map()

  // PERSISTENTE Maps: Diese werden beim Match-Start gesetzt und NICHT bei Leg-Wechsel überschrieben
  // Sie speichern die ORIGINALE Zuordnung Name/odId -> playerIndex
  private originalIndexByName: Map<string, number> = new Map()
  private originalIndexByOdId: Map<string, number> = new Map()
  private isInitialized = false

  /**
   * Setzt den Resolver komplett zurück (bei neuem Match)
   */
  reset(): void {
    this.playersByIndex.clear()
    this.indexByName.clear()
    this.indexByOdId.clear()
    this.originalIndexByName.clear()
    this.originalIndexByOdId.clear()
    this.isInitialized = false
    console.log('🔄 [PlayerResolver] Reset - all maps cleared')
  }

  /**
   * Initialisiert/Aktualisiert den Resolver mit frischen Spielerdaten
   */
  updatePlayers(
    autodartsPlayers: Array<Record<string, unknown>>,
    gameScores?: number[],
    playerScores?: Array<{ legs: number; sets: number }>,
    defaultColors: string[] = []
  ): ResolvedPlayer[] {
    this.playersByIndex.clear()
    this.indexByName.clear()
    this.indexByOdId.clear()

    const resolvedPlayers: ResolvedPlayer[] = []

    // Beim ERSTEN Aufruf (Match-Start) die originalen Zuordnungen speichern
    const isFirstInit = !this.isInitialized

    autodartsPlayers.forEach((p, arrayPos) => {
      const playerIndex = (p.index as number) ?? arrayPos
      const name = (p.name as string) || `Player ${playerIndex + 1}`
      const odId = (p.odId as string) || (p.id as string) || undefined

      const resolved: ResolvedPlayer = {
        index: playerIndex,
        arrayPosition: arrayPos,
        name,
        score: gameScores?.[arrayPos] ?? 501,
        setsWon: playerScores?.[playerIndex]?.sets ?? 0,
        legsWon: playerScores?.[playerIndex]?.legs ?? 0,
        isActive: false,
        color: (p.color as string) || defaultColors[playerIndex % defaultColors.length] || '#3b82f6',
        average: p.average as number | undefined,
        dartsThrown: p.dartsThrown as number | undefined,
        odId,
      }

      this.playersByIndex.set(playerIndex, resolved)
      this.indexByName.set(name.toLowerCase(), playerIndex)
      if (odId) {
        this.indexByOdId.set(odId, playerIndex)
      }

      // Beim ERSTEN Aufruf die ORIGINALEN Zuordnungen speichern
      // Diese werden bei Leg-Wechseln NICHT überschrieben
      if (isFirstInit) {
        this.originalIndexByName.set(name.toLowerCase(), playerIndex)
        if (odId) {
          this.originalIndexByOdId.set(odId, playerIndex)
        }
      }

      resolvedPlayers.push(resolved)
    })

    if (isFirstInit) {
      this.isInitialized = true
      console.log('🎯 [PlayerResolver] First init - saved original mappings:', {
        names: Object.fromEntries(this.originalIndexByName),
        odIds: Object.fromEntries(this.originalIndexByOdId)
      })
    }

    // Sortiert nach player.index für stabile UI-Reihenfolge
    resolvedPlayers.sort((a, b) => a.index - b.index)

    // WICHTIG: Nach dem Sortieren müssen die arrayPosition-Werte aktualisiert werden!
    // Die arrayPosition bezieht sich auf die Position im SORTIERTEN Array (gameState.players)
    resolvedPlayers.forEach((p, newArrayPos) => {
      p.arrayPosition = newArrayPos
    })

    return resolvedPlayers
  }

  /**
   * Findet einen Spieler mit Fallback-Strategie
   * Priorität: Name (original) > player.index > Array-Position
   *
   * WICHTIG: Nutzt die ORIGINALEN Name->Index Zuordnungen vom Match-Start,
   * da Autodarts die Namen bei Array-Rotation mitrotiert!
   */
  findPlayer(params: {
    name?: string
    playerIndex?: number
    arrayPosition?: number
    players: ResolvedPlayer[]
  }): PlayerLookupResult {
    const { name, playerIndex, arrayPosition, players } = params

    // 1. Versuch: Nach Name mit ORIGINALER Zuordnung (höchste Zuverlässigkeit)
    // Die originalIndexByName Map enthält die Zuordnung vom Match-Start
    if (name) {
      // Zuerst in der ORIGINALEN Map suchen (stabil über Leg-Wechsel)
      let idx = this.originalIndexByName.get(name.toLowerCase())

      // Fallback auf aktuelle Map wenn nicht in Original gefunden
      if (idx === undefined) {
        idx = this.indexByName.get(name.toLowerCase())
      }

      if (idx !== undefined) {
        const player = players.find(p => p.index === idx) || null
        if (player) {
          return {
            player,
            arrayPosition: players.indexOf(player),
            confidence: 'high',
            method: 'name'
          }
        }
      }
    }

    // 2. Versuch: Nach player.index (stabil über Rotationen)
    if (playerIndex !== undefined) {
      const player = players.find(p => p.index === playerIndex) || null
      if (player) {
        return {
          player,
          arrayPosition: players.indexOf(player),
          confidence: 'high',
          method: 'index'
        }
      }
    }

    // 3. Fallback: Array-Position (kann nach Rotation falsch sein)
    if (arrayPosition !== undefined && arrayPosition < players.length) {
      const player = players[arrayPosition] || null
      return {
        player,
        arrayPosition: arrayPosition,
        confidence: 'low',
        method: 'arrayPosition'
      }
    }

    return { player: null, arrayPosition: -1, confidence: 'low', method: 'none' }
  }

  /**
   * Findet Spieler für Animation-Konfiguration
   */
  findForAnimation(player: ResolvedPlayer, animationConfigs: Array<Record<string, unknown>>): Record<string, unknown> | null {
    // 1. Nach odId/playerId
    if (player.odId) {
      const byId = animationConfigs.find(c => c.playerId === player.odId)
      if (byId) return byId
    }

    // 2. Nach Name (case-insensitive)
    const byName = animationConfigs.find(c =>
      (c.playerName as string)?.toLowerCase() === player.name.toLowerCase()
    )
    if (byName) return byName

    return null
  }

  /**
   * Konvertiert Autodarts winner-Index (Array-Position) zu unserem player.index
   */
  resolveWinnerFromArrayPosition(
    arrayPosition: number,
    autodartsPlayers: Array<Record<string, unknown>>,
    winnerName?: string
  ): { playerIndex: number; name: string } | null {
    // Bevorzugt: Name aus Event-Daten
    if (winnerName) {
      const idx = this.indexByName.get(winnerName.toLowerCase())
      if (idx !== undefined) {
        return { playerIndex: idx, name: winnerName }
      }
    }

    // Fallback: Aus Autodarts-Array auslesen
    const winner = autodartsPlayers[arrayPosition]
    if (winner) {
      const playerIndex = (winner.index as number) ?? arrayPosition
      const name = (winner.name as string) || `Player ${playerIndex + 1}`
      return { playerIndex, name }
    }

    return null
  }

  /**
   * Aktualisiert einen einzelnen Spieler in-place
   */
  updatePlayerData(
    players: ResolvedPlayer[],
    playerIndex: number,
    updates: Partial<Omit<ResolvedPlayer, 'index'>>
  ): void {
    const player = players.find(p => p.index === playerIndex)
    if (player) {
      Object.assign(player, updates)
    }
  }

  /**
   * Setzt den aktiven Spieler nach player.index
   */
  setActivePlayer(players: ResolvedPlayer[], activePlayerIndex: number): number {
    players.forEach(p => {
      p.isActive = p.index === activePlayerIndex
    })
    // Gibt die Array-Position des aktiven Spielers zurück
    return players.findIndex(p => p.isActive)
  }

  /**
   * Debug-Ausgabe des aktuellen Resolver-Zustands
   */
  debug(players: ResolvedPlayer[]): void {
    console.log('🔍 [PlayerResolver] State:', {
      byIndex: Object.fromEntries(this.playersByIndex),
      byName: Object.fromEntries(this.indexByName),
      byOdId: Object.fromEntries(this.indexByOdId),
      sortedPlayers: players.map(p => ({ idx: p.index, pos: p.arrayPosition, name: p.name }))
    })
  }
}

// Globale Resolver-Instanz für den Store
const playerResolver = new PlayerResolver()

// Animation event types
export type AnimationEventType =
  | '180'
  | 'bull'
  | 'doubleBull'
  | 'highScore' // 140+
  | 'checkout'
  | 'legWin'
  | 'setWin'
  | 'matchWin'
  | 'bust'
  | 'cricketClose' // Cricket: a field closed with the third mark
  | 'cricketMarks' // Cricket: strong turn from N marks

export interface AnimationConfig {
  enabled: boolean
  url: string // URL to GIF, WebM, or MP4
  duration: number // Display duration in ms (0 = auto for videos)
  sound?: string // Optional sound URL
}

/**
 * Extended win animation configuration with additional options
 */
export interface WinAnimationConfig extends AnimationConfig {
  /** Custom message to display during animation */
  message?: string
  /** Show player name in animation */
  showPlayerName?: boolean
  /** Show final score in animation */
  showFinalScore?: boolean
  /** Show statistics (average, checkout %) in animation */
  showStats?: boolean
  /** Confetti/particle effect type */
  effectType?: 'none' | 'confetti' | 'fireworks' | 'sparkles'
  /** Background color for the win screen */
  backgroundColor?: string
  /** Text color for win messages */
  textColor?: string
}

/**
 * Win event data for enhanced win animations
 */
export interface WinEventData {
  /** Index of the winning player */
  winnerIndex: number
  /** Name of the winning player */
  winnerName: string
  /** Player's ID (for player-specific animations) */
  playerId?: string
  /** Final score (for checkout display) */
  finalScore?: number
  /** Checkout path taken */
  checkoutPath?: string[]
  /** Player statistics */
  stats?: {
    average?: number
    dartsThrown?: number
    checkoutPercent?: number
    highestCheckout?: number
    first9Average?: number
    total180s?: number
  }
  /** Current leg number */
  leg?: number
  /** Current set number */
  set?: number
  /** Legs won by player */
  legsWon?: number
  /** Sets won by player */
  setsWon?: number
}

// Player animation override (new format from UI)
export interface PlayerAnimationOverride {
  type?: 'builtin' | 'gif' | 'video' | 'none'
  mediaUrl?: string
  soundUrl?: string
}

export interface PlayerAnimations {
  playerId?: string // Autodarts user ID or local player ID
  playerName?: string // Match by name if no ID
  // Old format (backward compatibility)
  animations?: Partial<Record<AnimationEventType, AnimationConfig>>
  // New format (from UI config)
  throw180?: PlayerAnimationOverride
  legWin?: PlayerAnimationOverride
  matchWin?: PlayerAnimationOverride
  checkout?: PlayerAnimationOverride
}

// Types
export interface Player {
  index: number
  name: string
  score: number
  setsWon: number
  legsWon: number
  isActive: boolean
  color: string
  average?: number
  dartsThrown?: number
  odId?: string // Autodarts user ID for player-specific animations
}

export interface DartThrow {
  segment: {
    number: number
    multiplier: number
    bed: string
  }
  points: number
  index: number // 0, 1, or 2
}

// Chalkboard row for match results
export interface ChalkboardRow {
  round: number
  score: number
  points: number
  isScoreStruck: boolean
  isPointsStruck: boolean
}

// Match results with chalkboards
export interface MatchResults {
  chalkboards: Array<{
    playerIndex: number
    rows: ChalkboardRow[]
  }>
  winner: number | null
  stats: Array<{
    average?: number
    dartsThrown?: number
    checkoutPercent?: number
    highestCheckout?: number
    first9Average?: number
  }>
}

export interface GameInfo {
  variant: string       // e.g. "X01"
  baseScore: number     // e.g. 501, 301
  inMode: string        // e.g. "straight", "double"
  outMode: string       // e.g. "straight", "double"
  bullMode: string      // e.g. "25/50"
  maxRounds: number     // e.g. 0 = unlimited
  cutThroat?: boolean   // Cricket: points count against the other players
  setsToWin: number
  legsToWin: number
}

export interface GameState {
  matchId: string | null
  isActive: boolean
  gameMode: string
  startScore: number
  currentSet: number
  currentLeg: number
  setsToWin: number
  legsToWin: number
  players: Player[]
  activePlayerIndex: number
  currentTurn: {
    darts: DartThrow[]
    turnScore: number
    remaining: number
    isBusted: boolean
  }
  lastTurnScore: number
  isCheckoutPossible: boolean
  winner: Player | null
  gameInfo: GameInfo | null
  /** Cricket state as pushed by the hub (null outside Cricket/Tactics) */
  cricket: CricketState | null
}

export interface DisplayConfig {
  idleMode: 'black' | 'image' | 'lastGame'
  idleImageUrl: string
  // Match started screen config
  matchStartedMode: 'default' | 'image'
  matchStartedImageUrl: string
  matchStartedDuration: number // Duration in ms before showing game
  gameOnBackgroundColor: string // Background color for Game On! screen
  // Match results config
  matchResultsDuration: number // 0 = infinite (until new match)
  matchResultsBackgroundColor: string // Background color for results table
  showCheckouts: boolean
  checkoutThreshold: number
  /** "From Score" of the high score animation */
  highScoreThreshold: number
  /** "From Marks" of the Cricket strong turn animation */
  cricketMarksThreshold: number
  animationSpeed: 'slow' | 'normal' | 'fast'
  showOtherPlayers: boolean
  // Game info display
  showGameInfo: boolean
  gameInfoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  gameInfoSize: 'small' | 'medium' | 'large'
  gameInfoOffsetX: number
  gameInfoOffsetY: number
  // Animation settings
  animationsEnabled: boolean
  defaultAnimations: Partial<Record<AnimationEventType, AnimationConfig>>
  playerAnimations: PlayerAnimations[]
}

// Active animation state
export interface ActiveAnimation {
  id: string
  type: AnimationEventType
  url: string
  duration: number
  sound?: string
  startTime: number
  /** Extended win data for win animations */
  winData?: WinEventData
  /** Win animation specific config */
  winConfig?: WinAnimationConfig
}

export const useGameDisplayStore = defineStore('gameDisplay', () => {
  // State
  const gameState = ref<GameState>({
    matchId: null,
    isActive: false,
    gameMode: 'X01',
    startScore: 501,
    currentSet: 1,
    currentLeg: 1,
    setsToWin: 1,
    legsToWin: 1,
    players: [],
    activePlayerIndex: 0,
    currentTurn: {
      darts: [],
      turnScore: 0,
      remaining: 501,
      isBusted: false,
    },
    lastTurnScore: 0,
    isCheckoutPossible: false,
    winner: null,
    gameInfo: null,
    cricket: null,
  })

  // shallowRef: a reactive proxy would make the socket identity check in onclose fail
  const wsConnection = shallowRef<WebSocket | null>(null)
  const isConnected = ref(false)

  // Configuration
  const config = ref<DisplayConfig>({
    idleMode: 'lastGame',
    idleImageUrl: '',
    // Match started screen
    matchStartedMode: 'default',
    matchStartedImageUrl: '',
    matchStartedDuration: 3000, // 3 seconds default
    gameOnBackgroundColor: '#0a0a0f', // Default dark background
    // Match results
    matchResultsDuration: 0, // 0 = infinite
    matchResultsBackgroundColor: '#0a0a0f', // Dark background
    showCheckouts: true,
    checkoutThreshold: 170,
    highScoreThreshold: DEFAULT_HIGH_SCORE_THRESHOLD,
    cricketMarksThreshold: DEFAULT_CRICKET_MARKS_THRESHOLD,
    animationSpeed: 'normal',
    showOtherPlayers: true,
    // Game info display
    showGameInfo: true,
    gameInfoPosition: 'top-left',
    gameInfoSize: 'medium',
    gameInfoOffsetX: 0,
    gameInfoOffsetY: 0,
    // Animation defaults
    animationsEnabled: true,
    defaultAnimations: {},
    playerAnimations: [],
  })

  // Match started state - shown when match.start event received but no match data yet
  const isMatchStarted = ref(false)
  const matchStartedMatchId = ref<string | null>(null)

  // Active animation queue
  const activeAnimation = ref<ActiveAnimation | null>(null)
  const animationQueue = ref<ActiveAnimation[]>([])

  // Track if we have a "last game" to show
  const hasLastGame = ref(false)
  const lastGameState = ref<GameState | null>(null)

  // Match results (chalkboards) for showing final results table
  const matchResults = ref<MatchResults | null>(null)
  const showMatchResults = ref(false)
  let matchResultsTimer: ReturnType<typeof setTimeout> | null = null

  // Track processed darts to detect new throws from match.state events
  // This allows bull/bullseye animations even when throw.detected events don't arrive
  let lastProcessedDartsCount = 0
  // Each throw animation fires once per turn and dart, even if a dart is seen twice
  const throwAnimationTracker = new ThrowAnimationTracker()
  // Cricket: strong-turn animations that already fired (one per turnId).
  // Field closes are deduped by the hub, so no tracker is needed for those.
  const cricketAnimationTracker = new OnceTracker()
  // Whether the current game is Cricket/Tactics, from the last match.state's
  // game.mode (fallback: variant). Set before gameState.cricket is updated,
  // so it is known in time for the throw.detected events that precede it.
  const lastGameIsCricket = ref(false)
  // Animation slots set to "Disabled" (also turns off the built-in fallback)
  const disabledAnimations = new Set<AnimationEventType>()

  // Computed
  const activePlayer = computed(() => {
    return gameState.value.players[gameState.value.activePlayerIndex] || null
  })

  const otherPlayers = computed(() => {
    return gameState.value.players.filter((_, i) => i !== gameState.value.activePlayerIndex)
  })

  const currentDarts = computed(() => {
    return gameState.value.currentTurn.darts
  })

  const turnScore = computed(() => {
    return gameState.value.currentTurn.turnScore
  })

  const remainingScore = computed(() => {
    // Use the remaining score from currentTurn (comes from server)
    return gameState.value.currentTurn.remaining
  })

  const isBusted = computed(() => {
    return gameState.value.currentTurn.isBusted
  })

  const isCricketGame = computed(() => lastGameIsCricket.value)

  const cricketDeadFields = computed(() => gameState.value.cricket?.deadFields ?? [])

  const cricketFields = computed(() => gameState.value.cricket?.fields ?? [...CRICKET_FIELDS])

  /** Cricket marks per field, keyed by player.index (empty outside Cricket) */
  const cricketMarksByIndex = computed(() => {
    const result: Record<number, Record<string, number>> = {}
    for (const p of gameState.value.cricket?.players ?? []) result[p.index] = p.marks
    return result
  })

  // Default player colors
  const defaultColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ]

  // Helper to convert animation group config to AnimationConfig format
  function parseAnimationGroup(
    groupConfig: Record<string, unknown> | undefined,
    defaultDuration: number = 3000
  ): AnimationConfig | WinAnimationConfig | null {
    if (!groupConfig) return null
    // Default to 'builtin' if type is not set (e.g., when config hasn't been saved yet)
    const type = (groupConfig.type as string) || 'builtin'
    if (type === 'none') return null

    // Base animation config
    const baseConfig: AnimationConfig = {
      enabled: true, // Animation is enabled if type is 'builtin', 'gif', or 'video'
      url: type === 'builtin' ? '' : ((groupConfig.mediaUrl as string) || ''),
      duration: (groupConfig.duration as number) || defaultDuration,
      sound: (groupConfig.soundUrl as string) || undefined,
    }

    // Check if this has win animation specific fields
    const hasWinFields = groupConfig.showPlayerName !== undefined ||
                         groupConfig.showStats !== undefined ||
                         groupConfig.effectType !== undefined ||
                         groupConfig.backgroundColor !== undefined ||
                         groupConfig.textColor !== undefined

    if (hasWinFields) {
      const winConfig: WinAnimationConfig = {
        ...baseConfig,
        showPlayerName: (groupConfig.showPlayerName as boolean) ?? true,
        showStats: (groupConfig.showStats as boolean) ?? false,
        effectType: (groupConfig.effectType as 'none' | 'confetti' | 'fireworks' | 'sparkles') ?? 'confetti',
        backgroundColor: (groupConfig.backgroundColor as string) ?? '#0a0a0f',
        textColor: (groupConfig.textColor as string) ?? '#fbbf24',
      }
      return winConfig
    }

    return baseConfig
  }

  // Actions
  async function fetchConfig() {
    try {
      const response = await fetch('/api/modules/game-display/config')
      const data = await response.json()
      console.log('Fetched config:', data)
      if (data) {
        // Parse animation groups from module.json config format
        const defaultAnimations: Partial<Record<AnimationEventType, AnimationConfig>> = {}

        // Map animation group names to event types
        const animationGroupMap: Record<string, AnimationEventType> = {
          'animation180': '180',
          'animationBull': 'bull',
          'animationDoubleBull': 'doubleBull',
          'animationHighScore': 'highScore',
          'animationCheckout': 'checkout',
          'animationLegWin': 'legWin',
          'animationMatchWin': 'matchWin',
          'animationBust': 'bust',
          'animationCricketClose': 'cricketClose',
          'animationCricketMarks': 'cricketMarks',
        }

        // Parse each animation group (new format from module.json)
        disabledAnimations.clear()
        for (const [groupName, eventType] of Object.entries(animationGroupMap)) {
          const groupConfig = data[groupName] as Record<string, unknown> | undefined
          if (groupConfig?.type === 'none') disabledAnimations.add(eventType)
          const animConfig = parseAnimationGroup(groupConfig)
          if (animConfig) {
            defaultAnimations[eventType] = animConfig
          }
        }

        // Fallback: Also check for old format in data.defaultAnimations
        // This ensures backward compatibility with existing configurations
        const legacyAnimations = data.defaultAnimations as Partial<Record<AnimationEventType, AnimationConfig>> | undefined
        if (legacyAnimations) {
          for (const [eventType, animConfig] of Object.entries(legacyAnimations)) {
            // Only use legacy config if we didn't already load from new format
            if (!defaultAnimations[eventType as AnimationEventType] && animConfig?.enabled) {
              defaultAnimations[eventType as AnimationEventType] = animConfig
            }
          }
        }

        config.value = {
          idleMode: data.idleMode || 'lastGame',
          idleImageUrl: data.idleImageUrl || '',
          // Match started screen
          matchStartedMode: data.matchStartedMode || 'default',
          matchStartedImageUrl: data.matchStartedImageUrl || '',
          matchStartedDuration: data.matchStartedDuration ?? 3000,
          gameOnBackgroundColor: data.gameOnBackgroundColor || '#0a0a0f',
          // Match results
          matchResultsDuration: data.matchResultsDuration ?? 0,
          matchResultsBackgroundColor: data.matchResultsBackgroundColor || '#0a0a0f',
          showCheckouts: data.showCheckouts !== false,
          checkoutThreshold: data.checkoutThreshold || 170,
          highScoreThreshold: Number((data.animationHighScore as Record<string, unknown> | undefined)?.threshold) || DEFAULT_HIGH_SCORE_THRESHOLD,
          cricketMarksThreshold: Number((data.animationCricketMarks as Record<string, unknown> | undefined)?.threshold) || DEFAULT_CRICKET_MARKS_THRESHOLD,
          animationSpeed: data.animationSpeed || 'normal',
          showOtherPlayers: data.showOtherPlayers !== false,
          // Game info display
          showGameInfo: data.showGameInfo !== false,
          gameInfoPosition: data.gameInfoPosition || 'top-left',
          gameInfoSize: data.gameInfoSize || 'medium',
          gameInfoOffsetX: data.gameInfoOffsetX ?? 0,
          gameInfoOffsetY: data.gameInfoOffsetY ?? 0,
          animationsEnabled: data.animationsEnabled !== false,
          defaultAnimations: defaultAnimations,
          playerAnimations: data.playerAnimations || [],
        }
        console.log('🎮 [GameDisplay] Parsed player animations:', config.value.playerAnimations)
      }
    } catch (e) {
      console.error('Failed to fetch config:', e)
    }
  }

  async function fetchCurrentMatch() {
    try {
      const response = await fetch('/api/match/current')
      const data = await response.json()
      console.log('Fetched current match:', data)
      if (data.active) {
        handleMatchState(data)
      }
    } catch (e) {
      console.error('Failed to fetch current match:', e)
    }
  }

  // One socket and one pending reconnect at most: every failed attempt used to
  // schedule its own reconnect, so after the hub rejected the socket during
  // setup several loops connected at once and every event arrived twice.
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let shouldReconnect = true

  function scheduleReconnect() {
    if (!shouldReconnect || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  function connect() {
    shouldReconnect = true
    const current = wsConnection.value
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    // Connect to the hub's WebSocket - handle different base paths
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/events`

    const socket = new WebSocket(wsUrl)
    wsConnection.value = socket

    socket.onopen = async () => {
      console.log('Game Display WebSocket connected')
      isConnected.value = true
      // Load configuration and current match in parallel
      await Promise.all([
        fetchConfig(),
        fetchCurrentMatch()
      ])
    }

    socket.onclose = () => {
      // A socket that was already replaced must not start another loop
      if (wsConnection.value !== socket) return
      console.log('Game Display WebSocket disconnected')
      isConnected.value = false
      wsConnection.value = null
      scheduleReconnect()
    }

    socket.onerror = (error) => {
      console.error('Game Display WebSocket error:', error)
    }

    socket.onmessage = (wsEvent) => {
      try {
        const message = JSON.parse(wsEvent.data)
        console.log('Game Display received:', message)

        // The hub sends messages in format: { type: 'event', event: { type: '...', data: {...} } }
        if (message.type === 'event' && message.event) {
          handleEvent({
            type: message.event.type,
            data: message.event.data
          })
        } else if (message.type === 'status') {
          // Handle status updates (connection status)
          console.log('Status update:', message.status)
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }
  }

  function disconnect() {
    shouldReconnect = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const socket = wsConnection.value
    wsConnection.value = null
    socket?.close()
  }

  function handleEvent(message: { type: string; data: unknown }) {
    const { type, data } = message

    switch (type) {
      case 'match.start':
        // match.start event received - show "match started" screen while waiting for data
        handleMatchStart(data as Record<string, unknown>)
        break

      case 'match.state':
        handleMatchState(data as Record<string, unknown>)
        break

      case 'throw.detected':
        handleThrow(data as Record<string, unknown>)
        break

      case 'cricket.state':
        handleCricketState(data as Record<string, unknown>)
        break

      case 'cricket.closed':
        handleCricketClosed(data as Record<string, unknown>)
        break

      case 'player.change':
        handlePlayerChange(data as Record<string, unknown>)
        break

      case 'turn.finished':
        handleTurnFinished(data as Record<string, unknown>)
        break

      case 'game.finished':
        handleGameFinished(data as Record<string, unknown>)
        break

      case 'match.finished':
        handleMatchFinished(data as Record<string, unknown>)
        break

      case 'match.result':
      case 'match.results':
        handleMatchResults(data as Record<string, unknown>)
        break

      case 'match.delete':
        resetGame()
        break

      case 'match.finish':
        // User pressed "Finish" button after match ended - go to idle
        handleMatchFinish()
        break
    }
  }

  /**
   * Legs and sets won as counted by the hub (keyed by player.index, so the
   * rotating players array of Autodarts does not matter). Returns false when
   * the event carries no counts.
   */
  function applyWonCounts(data: Record<string, unknown>): boolean {
    const legsWon = data.legsWon as Record<string, number> | undefined
    const setsWon = data.setsWon as Record<string, number> | undefined
    if (!legsWon) return false
    for (const player of gameState.value.players) {
      if (typeof legsWon[player.index] === 'number') player.legsWon = legsWon[player.index]
      if (typeof setsWon?.[player.index] === 'number') player.setsWon = setsWon[player.index]
    }
    return true
  }

  /**
   * Drops everything that belongs to the previous match. Without this the
   * winner of a finished match stayed set, so the first state of the next
   * match was handled as a finished state and kept the old players.
   */
  function clearPreviousMatch() {
    gameState.value.winner = null
    gameState.value.players = []
    gameState.value.activePlayerIndex = 0
    gameState.value.cricket = null
    lastProcessedDartsCount = 0
    throwAnimationTracker.reset()
    cricketAnimationTracker.reset()
    playerResolver.reset()
  }

  function handleMatchStart(data: Record<string, unknown>) {
    console.log('handleMatchStart data:', data)

    // Cancel any pending match results timer and hide results
    if (matchResultsTimer) {
      clearTimeout(matchResultsTimer)
      matchResultsTimer = null
    }
    showMatchResults.value = false

    // Winner, players and trackers of the previous match must not carry over
    // (also resets the PlayerResolver, so name -> index starts fresh)
    clearPreviousMatch()
    lastGameIsCricket.value = false

    // Set match started state
    isMatchStarted.value = true
    matchStartedMatchId.value = (data.matchId as string) || null

    // Fetch full match data from API
    console.log('Match started, fetching full match data...')
    fetchCurrentMatch()
  }

  function handleMatchState(data: Record<string, unknown>) {
    console.log('handleMatchState data:', data)

    // Clear match started state when we receive actual match data
    isMatchStarted.value = false
    matchStartedMatchId.value = null

    // A different match (also when its match.start was missed, e.g. after a
    // reconnect): the winner and players of the previous match must not carry over
    const incomingMatchId = data.matchId as string | undefined
    if (incomingMatchId && gameState.value.matchId && incomingMatchId !== gameState.value.matchId) {
      clearPreviousMatch()
    }

    gameState.value.matchId = data.matchId as string
    gameState.value.isActive = true

    // ========================================================================
    // GAME SETTINGS
    // ========================================================================
    const settings = data.settings as Record<string, unknown> | undefined
    const variant = (data.variant as string) || 'X01'
    const gameMode = (data.game as { mode?: string } | undefined)?.mode
    const cricket = gameMode !== undefined
      ? (gameMode === 'cricket' || gameMode === 'tactics')
      : isCricket(variant)
    lastGameIsCricket.value = cricket
    gameState.value.gameMode = variant
    // null from Autodarts means a single leg match, not "best of 3"
    const { legsToWin, setsToWin } = legsAndSetsFrom({
      legs: data.legs ?? settings?.legs,
      sets: data.sets ?? settings?.sets,
    })

    if (settings) {
      gameState.value.startScore = (settings.baseScore as number) || (settings.startScore as number) || 501
      gameState.value.setsToWin = setsToWin
      gameState.value.legsToWin = legsToWin
      gameState.value.gameInfo = {
        variant,
        baseScore: (settings.baseScore as number) || 501,
        inMode: (settings.inMode as string) || 'straight',
        outMode: (settings.outMode as string) || 'double',
        bullMode: (settings.bullMode as string) || '25/50',
        maxRounds: (settings.maxRounds as number) || 0,
        cutThroat: settings.cutThroat === true,
        setsToWin,
        legsToWin,
      }
    } else {
      gameState.value.setsToWin = setsToWin
      gameState.value.legsToWin = legsToWin
    }

    // ========================================================================
    // PLAYER HANDLING MIT PLAYERRESOLVER
    // ========================================================================
    const autodartsPlayers = data.players as Array<Record<string, unknown>> | undefined
    const gameScores = data.gameScores as number[] | undefined
    const playerScores = data.scores as Array<{ legs: number; sets: number }> | undefined

    // Prüfe ob Spiel/Match beendet ist
    const isGameFinished = (data.gameFinished as boolean) && (data.gameWinner as number) !== undefined
    const isMatchFinished = (data.finished as boolean) && (data.winner as number) !== undefined
    const hasExistingWinner = gameState.value.winner !== null

    // WICHTIG: Wenn ein neues Leg beginnt (gameFinished: false), aber noch ein Winner
    // vom vorherigen Leg existiert, muss dieser zurückgesetzt werden!
    const gameFinishedFlag = data.gameFinished as boolean | undefined
    const isNewLegStarting = gameFinishedFlag === false && hasExistingWinner && !isMatchFinished
    if (isNewLegStarting) {
      console.log('🔄 [PlayerResolver] New leg started - clearing previous winner')
      gameState.value.winner = null

      // Reset dart tracking für neues Leg
      lastProcessedDartsCount = 0
    }

    // Re-evaluate hasExistingWinner after potential reset
    const effectiveHasWinner = gameState.value.winner !== null

    if (autodartsPlayers) {
      // DEBUG: Log all incoming player data to diagnose the issue
      console.log('🎯 [GameDisplay] Incoming players from match.state:', autodartsPlayers.map((p, i) => ({
        arrayPos: i,
        index: p.index,
        name: p.name,
        color: p.color,
        odId: p.odId || p.id
      })))

      // Aktiver Spieler: data.player ist die Array-Position in Autodarts' rotiertem Array
      const activeArrayPos = (data.player as number) ?? 0
      const activePlayerIndex = (autodartsPlayers[activeArrayPos]?.index as number) ?? activeArrayPos

      if (isGameFinished || isMatchFinished || effectiveHasWinner) {
        // ====================================================================
        // FINISHED STATE: In-Place Update um Winner-Referenz zu erhalten
        // ====================================================================
        console.log('🔒 [PlayerResolver] In-place update (finished state)')

        // Erstelle Score-Mapping: playerIndex -> score
        const scoreByPlayerIndex = new Map<number, number>()
        autodartsPlayers.forEach((p, arrayPos) => {
          const idx = (p.index as number) ?? arrayPos
          scoreByPlayerIndex.set(idx, gameScores?.[arrayPos] ?? gameState.value.startScore)
        })

        // Update bestehende Spieler in-place
        gameState.value.players.forEach(player => {
          const incoming = autodartsPlayers.find(p => (p.index as number) === player.index)
          if (incoming) {
            player.name = (incoming.name as string) || player.name
            player.score = scoreByPlayerIndex.get(player.index) ?? player.score
            player.setsWon = playerScores?.[player.index]?.sets ?? player.setsWon
            player.legsWon = playerScores?.[player.index]?.legs ?? player.legsWon
            player.average = incoming.average as number | undefined
            player.dartsThrown = incoming.dartsThrown as number | undefined
            player.odId = (incoming.odId as string) || (incoming.id as string) || player.odId
            // WICHTIG: isActive wird hier NICHT aktualisiert, um den Winner-Zustand zu erhalten
          }
        })
      } else if (isNewLegStarting) {
        // ====================================================================
        // NEW LEG STATE: Scores zurückgesetzt, aktiver Spieler wechselt
        // ====================================================================
        // WICHTIG: Bei neuem Leg wird der aktive Spieler NICHT aus match.state gesetzt!
        // Autodarts rotiert das Spieler-Array nach jedem Leg, daher ist data.player
        // (die Array-Position) nicht mehr korrekt.
        // Stattdessen warten wir auf das player.change Event, das die korrekte Info hat.
        // Dies ist das gleiche Pattern wie WLED es verwendet.
        console.log('🎯 [PlayerResolver] New leg - updating scores only, waiting for player.change event')

        // Scores aktualisieren (sollten auf Startwert zurückgesetzt sein)
        autodartsPlayers.forEach((p, arrayPos) => {
          const playerIndex = (p.index as number) ?? arrayPos
          const player = gameState.value.players.find(pl => pl.index === playerIndex)
          if (player) {
            player.score = gameScores?.[arrayPos] ?? gameState.value.startScore
            player.setsWon = playerScores?.[playerIndex]?.sets ?? player.setsWon
            player.legsWon = playerScores?.[playerIndex]?.legs ?? player.legsWon
            player.average = p.average as number | undefined
            player.dartsThrown = p.dartsThrown as number | undefined
          }
        })

        // NICHT den aktiven Spieler hier setzen - das macht player.change Event!
        // Behalte den vorherigen aktiven Spieler bei bis player.change kommt
        console.log(`🎯 [PlayerResolver] New leg - keeping current active player until player.change event`)
      } else {
        // ====================================================================
        // NORMAL STATE: Nutze PlayerResolver für saubere Spieler-Erstellung
        // ====================================================================
        console.log('🎯 [PlayerResolver] Building player list, activePlayerIndex:', activePlayerIndex)

        // PlayerResolver erstellt sortierte Spielerliste
        const resolvedPlayers = playerResolver.updatePlayers(
          autodartsPlayers,
          gameScores,
          playerScores,
          defaultColors
        )

        // DEBUG: Log resolved players to see if all are processed correctly
        console.log('🎯 [GameDisplay] Resolved players after PlayerResolver:', resolvedPlayers.map(p => ({
          index: p.index,
          arrayPosition: p.arrayPosition,
          name: p.name,
          color: p.color
        })))

        // Setze aktiven Spieler
        const activeArrayIndex = playerResolver.setActivePlayer(resolvedPlayers, activePlayerIndex)

        // Konvertiere zu Player-Interface
        gameState.value.players = resolvedPlayers.map(rp => ({
          index: rp.index,
          name: rp.name,
          score: rp.score,
          setsWon: rp.setsWon,
          legsWon: rp.legsWon,
          isActive: rp.isActive,
          color: rp.color,
          average: rp.average,
          dartsThrown: rp.dartsThrown,
          odId: rp.odId,
        }))

        gameState.value.activePlayerIndex = activeArrayIndex !== -1 ? activeArrayIndex : 0

        console.log(`🎯 [PlayerResolver] Active: ${gameState.value.players[gameState.value.activePlayerIndex]?.name}`)
        console.log('🎯 [GameDisplay] Final gameState.players:', gameState.value.players.map(p => ({
          index: p.index,
          name: p.name,
          color: p.color
        })))
      }
    }

    applyWonCounts(data)

    // ========================================================================
    // ACTIVE PLAYER INDEX (nur wenn nicht finished)
    // ========================================================================
    if (!isMatchFinished && !isGameFinished && !effectiveHasWinner) {
      const activeIdx = gameState.value.players.findIndex(p => p.isActive)
      if (activeIdx !== -1) {
        gameState.value.activePlayerIndex = activeIdx
      }
    } else {
      console.log('🔒 [PlayerResolver] Keeping winner displayed')
    }

    // Current leg/set
    gameState.value.currentSet = (data.set as number) || 1
    gameState.value.currentLeg = (data.leg as number) || 1

    // Current turn score
    const turnScore = (data.turnScore as number) || 0
    const turnBusted = (data.turnBusted as boolean) || false

    // Extract throws from the current turn in the turns array
    // The last turn in the array is the current active turn
    const turns = data.turns as Array<Record<string, unknown>> | undefined
    let currentTurnDarts: DartThrow[] = []

    if (turns && turns.length > 0) {
      // Simply get the last turn - it's the current active one
      const activeTurn = turns[turns.length - 1]

      if (activeTurn) {
        const throwsData = activeTurn.throws as Array<Record<string, unknown>> | undefined
        if (throwsData && throwsData.length > 0) {
          currentTurnDarts = throwsData.map((t, index) => {
            const segment = t.segment as Record<string, unknown>
            const number = (segment?.number as number) || 0
            const multiplier = (segment?.multiplier as number) || 1
            // Use 'name' field for display (e.g. "S1", "T20", "D16")
            // 'bed' contains description like "Single", "Double", "Triple"
            const name = (segment?.name as string) || ''
            return {
              segment: {
                number,
                multiplier,
                bed: name, // Store name in bed field for getDartLabel()
              },
              points: number * multiplier,
              index,
            }
          })
        }
      }
    }

    // gameScores contains the current remaining score for each player
    // This is already the score AFTER the current turn's throws are subtracted
    // (Autodarts updates gameScores in real-time with each throw)
    // FIXED: Use the active player's score from our sorted players array (already mapped correctly above)
    const activePlayer = gameState.value.players[gameState.value.activePlayerIndex]
    const playerRemainingScore = activePlayer?.score ?? gameState.value.startScore

    // Throw animations (bull, bullseye, 180, high score) are triggered only
    // here, from the authoritative match state. The tracker makes sure each
    // fires once per turn and dart.
    const lastTurn = turns && turns.length > 0 ? turns[turns.length - 1] : undefined
    const turnKey = (lastTurn?.id as string | undefined)
      ?? `${data.set}:${data.leg}:${data.round}:${data.player}`
    const newDartsCount = currentTurnDarts.length
    if (newDartsCount > lastProcessedDartsCount) {
      const segments = currentTurnDarts.map((d) => d.segment)
      const player = gameState.value.players[gameState.value.activePlayerIndex]
      for (let i = lastProcessedDartsCount; i < newDartsCount; i++) {
        // Cricket keeps Bull and Bullseye; 180 and high score are X01 only
        const types = throwAnimationsForDart(segments, i, turnScore, config.value.highScoreThreshold)
          .filter((type) => !cricket || type === 'bull' || type === 'doubleBull')
        for (const type of throwAnimationTracker.take(turnKey, i, types)) {
          triggerAnimation(type, player || undefined)
        }
      }
    }
    lastProcessedDartsCount = newDartsCount

    // Cricket state: the hub's cricket.state event (processed before this
    // match.state in the same batch) already set gameState.cricket while
    // the game is ongoing. Only two cases need handling here: leaving
    // Cricket, and a reload via /api/match/current (which carries data.cricket
    // directly, since it has no preceding cricket.state event).
    if (!cricket) {
      gameState.value.cricket = null
    } else if (data.cricket) {
      gameState.value.cricket = data.cricket as CricketState
    }

    gameState.value.currentTurn = {
      darts: currentTurnDarts,
      turnScore: turnScore,
      remaining: playerRemainingScore,
      isBusted: turnBusted,
    }

    // Check checkout possibility
    updateCheckoutStatus()

    // NOTE: We do NOT set the winner here from match.state data.
    // The winner is set authoritatively by handleGameFinished (leg winner) and
    // handleMatchFinished (match winner) which receive the correct winnerName
    // from the backend EventParser at the moment of the win.
    //
    // Previously, this code would incorrectly overwrite the leg winner with the
    // match winner when a late match.state event arrived with finished=true and
    // winner set (which is the MATCH winner index, not the LEG winner index).
    //
    // The winner is only cleared when a new leg starts (detected by gameFinished being false
    // and no existing winner context from handleGameFinished/handleMatchFinished).
    const gameFinished = data.gameFinished as boolean | undefined
    const matchFinished = data.finished as boolean | undefined

    // Only clear winner if game is actively continuing (not finished)
    // AND we're not in a "just finished" state that handleGameFinished/handleMatchFinished will handle
    if (!gameFinished && !matchFinished && !hasExistingWinner) {
      gameState.value.winner = null
    }
  }

  /** Cricket state pushed by the hub's cricket.state event */
  function handleCricketState(data: Record<string, unknown>) {
    gameState.value.cricket = data as unknown as CricketState
  }

  /** Field closed (hub dedupes, so this always means "trigger the animation") */
  function handleCricketClosed(data: Record<string, unknown>) {
    if (!isCricketGame.value) return
    const playerIndex = data.playerIndex as number
    const player = gameState.value.players.find((p) => p.index === playerIndex)
    triggerAnimation('cricketClose', player ?? undefined)
  }

  function handleThrow(data: Record<string, unknown>) {
    // Darts, turn score and remaining score come from the next match.state
    // (the hub sends it right after every throw.detected). Adding the dart
    // and subtracting here as well counted darts twice whenever a throw was
    // reported more than once.

    // Cricket: a strong turn (from the configured mark threshold) fires here,
    // once per turnId, since this is the only event carrying turnMarks live.
    if (isCricketGame.value) {
      const turnMarksValue = data.turnMarks
      const turnId = data.turnId as string | null | undefined
      if (
        typeof turnMarksValue === 'number'
        && turnMarksValue >= config.value.cricketMarksThreshold
        && turnId
        && cricketAnimationTracker.take(`${turnId}:marks`)
      ) {
        triggerAnimation('cricketMarks', activePlayer.value ?? undefined)
      }
    }
  }

  function handlePlayerChange(data: Record<string, unknown>) {
    console.log('handlePlayerChange data:', data)

    // ========================================================================
    // PLAYER LOOKUP MIT PLAYERRESOLVER
    // Priorität: Name > playerIndex > arrayPosition (Fallback)
    // ========================================================================
    const result = playerResolver.findPlayer({
      name: data.playerName as string | undefined,
      playerIndex: data.playerIndex as number | undefined,
      arrayPosition: data.currentPlayer as number | undefined,
      players: gameState.value.players as unknown as ResolvedPlayer[]
    })

    const newArrayIndex = result.arrayPosition !== -1 ? result.arrayPosition : 0
    console.log(`🔄 [PlayerResolver] Player change: ${result.player?.name} (method: ${result.method}, confidence: ${result.confidence})`)

    // Save last turn score before switching
    gameState.value.lastTurnScore = gameState.value.currentTurn.turnScore

    // Update active player
    gameState.value.activePlayerIndex = newArrayIndex
    gameState.value.players.forEach((p, i) => {
      p.isActive = i === newArrayIndex
    })

    // Update scores from event data if available
    const scores = data.scores as number[] | undefined
    if (scores) {
      // scores Array ist nach player.index indiziert, nicht nach Array-Position
      gameState.value.players.forEach(player => {
        if (scores[player.index] !== undefined) {
          player.score = scores[player.index]
        }
      })
    }

    // Reset current turn and dart tracking
    lastProcessedDartsCount = 0
    gameState.value.currentTurn = {
      darts: [],
      turnScore: 0,
      remaining: gameState.value.players[newArrayIndex]?.score || gameState.value.startScore,
      isBusted: false,
    }

    updateCheckoutStatus()
  }

  function handleTurnFinished(data: Record<string, unknown>) {
    // ========================================================================
    // PLAYER LOOKUP MIT PLAYERRESOLVER
    // ========================================================================
    const result = playerResolver.findPlayer({
      name: data.playerName as string | undefined,
      playerIndex: data.playerIndex as number | undefined,
      arrayPosition: gameState.value.activePlayerIndex, // Fallback auf aktuellen Spieler
      players: gameState.value.players as unknown as ResolvedPlayer[]
    })

    const playerArrayIndex = result.arrayPosition !== -1 ? result.arrayPosition : gameState.value.activePlayerIndex
    const newScore = data.remaining as number | undefined

    // Check for bust
    const busted = data.busted as boolean | undefined
    if (busted) {
      const player = gameState.value.players[playerArrayIndex]
      triggerAnimation('bust', player || undefined)
    }

    // Check for checkout (remaining = 0 and finished with double)
    // In Cricket a score of 0 just means no points yet
    if (newScore === 0 && !isCricketGame.value) {
      const player = gameState.value.players[playerArrayIndex]
      triggerAnimation('checkout', player || undefined)
    }

    if (newScore !== undefined && gameState.value.players[playerArrayIndex]) {
      gameState.value.players[playerArrayIndex].score = newScore
    }
  }

  function handleGameFinished(data: Record<string, unknown>) {
    console.log('handleGameFinished data:', data)

    // ========================================================================
    // DEBUG: Log all available data to diagnose winner detection
    // ========================================================================
    console.log('🏆 [GameFinished] DEBUG - Available winner fields:', {
      winnerName: data.winnerName,
      winnerPlayerIndex: data.winnerPlayerIndex,
      winner: data.winner,
      winnerIndex: data.winnerIndex,
    })
    console.log('🏆 [GameFinished] DEBUG - Current players in store:',
      gameState.value.players.map(p => ({ index: p.index, name: p.name, score: p.score }))
    )

    // ========================================================================
    // RESET FÜR NEUES LEG
    // ========================================================================
    // Wichtig: Dart-Tracking zurücksetzen für das neue Leg
    lastProcessedDartsCount = 0

    // ========================================================================
    // WINNER ERMITTLUNG - Mehrere Strategien mit Fallbacks
    // ========================================================================
    // Reihenfolge der Zuverlässigkeit:
    // 1. winnerName aus Event-Daten (vom Backend zum Zeitpunkt des Gewinns erfasst)
    // 2. winnerPlayerIndex aus Event-Daten (stabiler player.index)
    // 3. Score = 0 (wenn noch nicht für neues Leg zurückgesetzt)
    // 4. winner Array-Position aus Event (kann nach Rotation falsch sein)

    let winner: Player | null = null
    let winnerArrayPosition = -1

    const winnerNameFromEvent = data.winnerName as string | undefined
    const winnerPlayerIndex = data.winnerPlayerIndex as number | undefined
    const winnerArrayPos = (data.winner as number) ?? (data.winnerIndex as number)

    // STRATEGIE 1: winnerName aus Event (höchste Priorität - vom Backend erfasst)
    if (winnerNameFromEvent) {
      console.log(`🏆 [GameFinished] Trying to find winner by name: "${winnerNameFromEvent}"`)
      const foundByName = gameState.value.players.find(
        p => p.name.toLowerCase() === winnerNameFromEvent.toLowerCase()
      )
      if (foundByName) {
        winner = foundByName
        winnerArrayPosition = gameState.value.players.indexOf(foundByName)
        console.log(`🏆 [GameFinished] Winner by name from event: ${winner.name}`)
      } else {
        console.log(`🏆 [GameFinished] Could not find player with name: "${winnerNameFromEvent}"`)
      }
    } else {
      console.log(`🏆 [GameFinished] No winnerName in event data`)
    }

    // STRATEGIE 2: winnerPlayerIndex aus Event (stabiler index)
    if (!winner && winnerPlayerIndex !== undefined) {
      const foundByIndex = gameState.value.players.find(p => p.index === winnerPlayerIndex)
      if (foundByIndex) {
        winner = foundByIndex
        winnerArrayPosition = gameState.value.players.indexOf(foundByIndex)
        console.log(`🏆 [GameFinished] Winner by playerIndex from event: ${winner.name}`)
      }
    }

    // STRATEGIE 3: Spieler mit Score = 0 (wenn Leg noch nicht gewechselt hat)
    // In Cricket a score of 0 means no points, not a checkout
    if (!winner && !isCricketGame.value) {
      const zeroScorePlayer = gameState.value.players.find(p => p.score === 0)
      if (zeroScorePlayer) {
        winner = zeroScorePlayer
        winnerArrayPosition = gameState.value.players.indexOf(zeroScorePlayer)
        console.log(`🏆 [GameFinished] Winner by score=0: ${winner.name}`)
      }
    }

    // STRATEGIE 4: winner Array-Position aus Event (Fallback - kann nach Rotation falsch sein)
    if (!winner && winnerArrayPos !== undefined) {
      const result = playerResolver.findPlayer({
        arrayPosition: winnerArrayPos,
        players: gameState.value.players as unknown as ResolvedPlayer[]
      })
      if (result.player) {
        winner = gameState.value.players[result.arrayPosition]
        winnerArrayPosition = result.arrayPosition
        console.log(`🏆 [GameFinished] Winner by arrayPosition (fallback): ${winner?.name}`)
      }
    }

    console.log(`🏆 [GameFinished] Final winner: ${winner?.name || 'NOT FOUND'}`)

    // Extract legs/sets from scores array (indexed by player.index)
    const scores = data.scores as Array<{ legs: number; sets: number }> | undefined

    if (winner) {
      // Legs/sets won: the hub's own count per player.index, Autodarts' scores as fallback
      if (!applyWonCounts(data) && scores) {
        gameState.value.players.forEach(player => {
          if (scores[player.index]) {
            player.legsWon = scores[player.index].legs
            player.setsWon = scores[player.index].sets
          }
        })
      }

      gameState.value.winner = winner
      gameState.value.activePlayerIndex = winnerArrayPosition

      // Win animation data
      const winData: WinEventData = {
        winnerIndex: winner.index,
        winnerName: winner.name,
        playerId: winner.odId,
        legsWon: winner.legsWon,
        setsWon: winner.setsWon,
        leg: gameState.value.currentLeg,
        set: gameState.value.currentSet,
        stats: {
          average: winner.average,
          dartsThrown: winner.dartsThrown,
        },
      }

      triggerAnimation('legWin', winner, winData)
    }

    // Update leg count
    if (data.leg !== undefined) {
      gameState.value.currentLeg = (data.leg as number) + 1
    } else {
      gameState.value.currentLeg++
    }
  }

  function handleMatchFinished(data: Record<string, unknown>) {
    console.log('handleMatchFinished data:', data)

    // ========================================================================
    // WINNER ERMITTLUNG - Mehrere Strategien mit Fallbacks
    // ========================================================================
    let winner: Player | null = null
    let winnerArrayPosition = -1

    const winnerNameFromEvent = data.winnerName as string | undefined
    const winnerPlayerIndex = data.winnerPlayerIndex as number | undefined
    const winnerArrayPos = (data.winner as number) ?? (data.winnerIndex as number)

    // STRATEGIE 1: winnerName aus Event (höchste Priorität)
    if (winnerNameFromEvent) {
      const foundByName = gameState.value.players.find(
        p => p.name.toLowerCase() === winnerNameFromEvent.toLowerCase()
      )
      if (foundByName) {
        winner = foundByName
        winnerArrayPosition = gameState.value.players.indexOf(foundByName)
        console.log(`🏆 [MatchFinished] Winner by name from event: ${winner.name}`)
      }
    }

    // STRATEGIE 2: winnerPlayerIndex aus Event
    if (!winner && winnerPlayerIndex !== undefined) {
      const foundByIndex = gameState.value.players.find(p => p.index === winnerPlayerIndex)
      if (foundByIndex) {
        winner = foundByIndex
        winnerArrayPosition = gameState.value.players.indexOf(foundByIndex)
        console.log(`🏆 [MatchFinished] Winner by playerIndex from event: ${winner.name}`)
      }
    }

    // STRATEGIE 3: Score = 0
    // In Cricket a score of 0 means no points, not a checkout
    if (!winner && !isCricketGame.value) {
      const zeroScorePlayer = gameState.value.players.find(p => p.score === 0)
      if (zeroScorePlayer) {
        winner = zeroScorePlayer
        winnerArrayPosition = gameState.value.players.indexOf(zeroScorePlayer)
        console.log(`🏆 [MatchFinished] Winner by score=0: ${winner.name}`)
      }
    }

    // STRATEGIE 4: winner Array-Position (Fallback)
    if (!winner && winnerArrayPos !== undefined) {
      const result = playerResolver.findPlayer({
        arrayPosition: winnerArrayPos,
        players: gameState.value.players as unknown as ResolvedPlayer[]
      })
      if (result.player) {
        winner = gameState.value.players[result.arrayPosition]
        winnerArrayPosition = result.arrayPosition
        console.log(`🏆 [MatchFinished] Winner by arrayPosition (fallback): ${winner?.name}`)
      }
    }

    console.log(`🏆 [MatchFinished] Final winner: ${winner?.name || 'NOT FOUND'}`)

    // Extract legs/sets from scores array (indexed by player.index)
    const scores = data.scores as Array<{ legs: number; sets: number }> | undefined

    if (winner) {
      // Legs/sets won: the hub's own count per player.index, Autodarts' scores as fallback
      if (!applyWonCounts(data) && scores) {
        gameState.value.players.forEach(player => {
          if (scores[player.index]) {
            player.legsWon = scores[player.index].legs
            player.setsWon = scores[player.index].sets
          }
        })
      }

      gameState.value.winner = winner
      gameState.value.activePlayerIndex = winnerArrayPosition

      // Win animation data
      const winData: WinEventData = {
        winnerIndex: winner.index,
        winnerName: winner.name,
        playerId: winner.odId,
        legsWon: winner.legsWon,
        setsWon: winner.setsWon,
        leg: gameState.value.currentLeg,
        set: gameState.value.currentSet,
        stats: {
          average: winner.average,
          dartsThrown: winner.dartsThrown,
        },
      }

      triggerAnimation('matchWin', winner, winData)
    }

    gameState.value.isActive = false
  }

  // Pending match results (shown after win animation completes)
  const pendingMatchResults = ref<MatchResults | null>(null)

  function handleMatchResults(data: Record<string, unknown>) {
    console.log('handleMatchResults data:', data)

    // Parse chalkboards
    const chalkboards = data.chalkboards as Array<Record<string, unknown>> | undefined
    const stats = data.stats as Array<Record<string, unknown>> | undefined
    // Stable player.index of the winner as resolved by the hub; raw winner as fallback
    const winnerIndex = (data.winnerPlayerIndex as number | undefined) ?? (data.winner as number | undefined)
    const players = data.players as Array<Record<string, unknown>> | undefined

    // Show results even if chalkboards are empty - we can still show winner and stats
    if (chalkboards || winnerIndex !== undefined) {
      // Update player names from result data if available
      if (players) {
        players.forEach((p, idx) => {
          if (gameState.value.players[idx]) {
            gameState.value.players[idx].name = (p.name as string) || gameState.value.players[idx].name
          }
        })
      }

      const results: MatchResults = {
        chalkboards: (chalkboards || []).map((cb, index) => {
          const rows = cb.rows as Array<Record<string, unknown>> | undefined
          return {
            playerIndex: index,
            rows: rows?.map((row) => ({
              round: (row.round as number) || 0,
              score: (row.score as number) || 0,
              points: (row.points as number) || 0,
              isScoreStruck: (row.isScoreStruck as boolean) || false,
              isPointsStruck: (row.isPointsStruck as boolean) || false,
            })) || [],
          }
        }),
        winner: winnerIndex ?? null,
        stats: stats?.map((playerStats) => {
          // Stats can be in two formats:
          // 1. Direct stats object (legacy)
          // 2. Nested { legStats, matchStats, setStats } (new format from match.result)
          const legStats = playerStats.legStats as Record<string, unknown> | undefined
          const matchStats = playerStats.matchStats as Record<string, unknown> | undefined
          const statsSource = matchStats || legStats || playerStats

          return {
            average: (statsSource.average as number) ?? undefined,
            dartsThrown: (statsSource.dartsThrown as number) ?? undefined,
            checkoutPercent: (statsSource.checkoutPercent as number) ?? undefined,
            highestCheckout: (statsSource.checkoutPoints as number) ?? undefined,
            first9Average: (statsSource.first9Average as number) ?? undefined,
          }
        }) || [],
      }

      // Check if there's an active win animation - if so, delay showing results
      const hasActiveWinAnimation = activeAnimation.value &&
        (activeAnimation.value.type === 'matchWin' ||
         activeAnimation.value.type === 'setWin' ||
         activeAnimation.value.type === 'legWin')

      const hasQueuedWinAnimation = animationQueue.value.some(
        anim => anim.type === 'matchWin' || anim.type === 'setWin' || anim.type === 'legWin'
      )

      if (hasActiveWinAnimation || hasQueuedWinAnimation) {
        // Store results to show after animation completes
        console.log('Win animation active - deferring match results display')
        pendingMatchResults.value = results
        matchResults.value = results
      } else {
        // No win animation - show results immediately
        matchResults.value = results
        showMatchResultsWithTimer()
      }
    }
  }

  // Show match results and start auto-hide timer
  function showMatchResultsWithTimer() {
    showMatchResults.value = true

    // Start auto-hide timer if duration is set
    if (matchResultsTimer) {
      clearTimeout(matchResultsTimer)
      matchResultsTimer = null
    }

    const durationMs = config.value.matchResultsDuration
    if (durationMs > 0) {
      console.log(`Match results will auto-hide in ${durationMs}ms (${durationMs / 1000}s)`)
      matchResultsTimer = setTimeout(() => {
        console.log('Auto-hiding match results')
        showMatchResults.value = false
        matchResultsTimer = null
      }, durationMs)
    }
  }

  // Called when win animation ends - check for pending results
  function onWinAnimationComplete() {
    if (pendingMatchResults.value) {
      console.log('Win animation complete - showing pending match results')
      showMatchResultsWithTimer()
      pendingMatchResults.value = null
    }
  }

  // Handle match.finish event (user pressed "Finish" button)
  function handleMatchFinish() {
    console.log('handleMatchFinish - transitioning to idle')

    // Cancel any pending match results timer
    if (matchResultsTimer) {
      clearTimeout(matchResultsTimer)
      matchResultsTimer = null
    }

    // Hide match results and go to idle
    showMatchResults.value = false

    // Save last game state
    if (gameState.value.players.length > 0) {
      lastGameState.value = JSON.parse(JSON.stringify(gameState.value))
      hasLastGame.value = true
    }

    // Deactivate game
    gameState.value.isActive = false
  }

  function updateCheckoutStatus() {
    const remaining = gameState.value.currentTurn.remaining
    // Checkout is possible if remaining is between 2 and 170 and not busted
    gameState.value.isCheckoutPossible =
      !isCricketGame.value &&
      !gameState.value.currentTurn.isBusted &&
      remaining >= 2 &&
      remaining <= 170
  }

  // Animation functions

  // Default durations for builtin animations (in ms)
  const BUILTIN_ANIMATION_DURATIONS: Record<AnimationEventType, number> = {
    '180': 4000,
    'bull': 2000,
    'doubleBull': 2500,
    'highScore': 2000,
    'checkout': 2500,
    'legWin': 3000,
    'setWin': 3000,
    'matchWin': 5000,
    'bust': 1500,
    'cricketClose': 2000,
    'cricketMarks': 2500,
  }

  // Map event type to UI key
  const EVENT_TO_UI_KEY_MAP: Record<AnimationEventType, string> = {
    '180': 'throw180',
    'legWin': 'legWin',
    'matchWin': 'matchWin',
    'checkout': 'checkout',
    'bull': 'bull',
    'doubleBull': 'doubleBull',
    'highScore': 'highScore',
    'setWin': 'setWin',
    'bust': 'bust',
    'cricketClose': 'cricketClose',
    'cricketMarks': 'cricketMarks',
  }

  function getAnimationForEvent(
    eventType: AnimationEventType,
    player?: Player
  ): AnimationConfig | null {
    if (!config.value.animationsEnabled) return null

    // ========================================================================
    // PLAYER-SPECIFIC ANIMATION MIT PLAYERRESOLVER
    // ========================================================================
    if (player) {
      // Konvertiere Player zu ResolvedPlayer-ähnlichem Objekt für Resolver
      const resolvedPlayer: ResolvedPlayer = {
        index: player.index,
        arrayPosition: gameState.value.players.indexOf(player),
        name: player.name,
        score: player.score,
        setsWon: player.setsWon,
        legsWon: player.legsWon,
        isActive: player.isActive,
        color: player.color,
        average: player.average,
        dartsThrown: player.dartsThrown,
        odId: player.odId,
      }

      // Nutze PlayerResolver für Animation-Lookup
      const playerAnim = playerResolver.findForAnimation(
        resolvedPlayer,
        config.value.playerAnimations as Array<Record<string, unknown>>
      )

      if (playerAnim) {
        const uiKey = EVENT_TO_UI_KEY_MAP[eventType]
        const newFormatAnim = playerAnim[uiKey] as Record<string, unknown> | undefined

        if (newFormatAnim) {
          const animType = newFormatAnim.type as string
          if (animType && animType !== 'none') {
            const mediaUrl = (newFormatAnim.mediaUrl as string) || ''
            const soundUrl = (newFormatAnim.soundUrl as string) || undefined
            console.log(`🎮 [PlayerResolver] Animation found for ${player.name}: ${eventType}`)
            return {
              enabled: true,
              url: animType === 'builtin' ? '' : mediaUrl,
              duration: BUILTIN_ANIMATION_DURATIONS[eventType] || 3000,
              sound: soundUrl,
            }
          }
        }

        // Legacy-Format Support
        const oldAnimations = playerAnim.animations as Record<string, AnimationConfig> | undefined
        if (oldAnimations?.[eventType]?.enabled) {
          return oldAnimations[eventType]
        }
      }
    }

    // Slot set to "Disabled": no built-in fallback either
    if (disabledAnimations.has(eventType)) return null

    // Fall back to default animations
    const defaultAnim = config.value.defaultAnimations[eventType]
    if (defaultAnim?.enabled) {
      return defaultAnim
    }

    // Default builtin animation
    return {
      enabled: true,
      url: '',
      duration: BUILTIN_ANIMATION_DURATIONS[eventType] || 3000,
      sound: undefined,
    }
  }

  function triggerAnimation(eventType: AnimationEventType, player?: Player, winData?: WinEventData) {
    const animConfig = getAnimationForEvent(eventType, player)
    if (!animConfig) return

    // Check if this is a win animation config (has extended properties)
    const isWinConfig = 'showPlayerName' in animConfig || 'effectType' in animConfig

    const animation: ActiveAnimation = {
      id: `${eventType}-${Date.now()}`,
      type: eventType,
      url: animConfig.url,
      duration: animConfig.duration || 3000,
      sound: animConfig.sound,
      startTime: Date.now(),
      winData: winData,
      winConfig: isWinConfig ? (animConfig as WinAnimationConfig) : undefined,
    }

    console.log(`🎬 [GameDisplay] Triggering animation:`, {
      eventType,
      playerName: player?.name,
      animConfig,
      resultAnimation: animation
    })

    // Add to queue
    animationQueue.value.push(animation)

    // If no animation is playing, start this one
    if (!activeAnimation.value) {
      playNextAnimation()
    }
  }

  function playNextAnimation() {
    // Check if current animation was a win animation - trigger pending results
    const currentAnim = activeAnimation.value
    if (currentAnim) {
      const isWinAnimation = currentAnim.type === 'matchWin' ||
                             currentAnim.type === 'setWin' ||
                             currentAnim.type === 'legWin'
      if (isWinAnimation) {
        // Win animation completed - check for pending results
        onWinAnimationComplete()
      }
    }

    if (animationQueue.value.length === 0) {
      activeAnimation.value = null
      return
    }

    const next = animationQueue.value.shift()!
    activeAnimation.value = next

    // Auto-dismiss after duration
    setTimeout(() => {
      if (activeAnimation.value?.id === next.id) {
        playNextAnimation()
      }
    }, next.duration)
  }

  function dismissAnimation() {
    // Check if dismissed animation was a win animation
    const currentAnim = activeAnimation.value
    if (currentAnim) {
      const isWinAnimation = currentAnim.type === 'matchWin' ||
                             currentAnim.type === 'setWin' ||
                             currentAnim.type === 'legWin'
      if (isWinAnimation) {
        onWinAnimationComplete()
      }
    }

    activeAnimation.value = null
    playNextAnimation()
  }

  function clearAnimationQueue() {
    animationQueue.value = []
    activeAnimation.value = null
  }

  function resetGame() {
    // Save last game state before resetting (if there was an active game)
    if (gameState.value.isActive || gameState.value.players.length > 0) {
      lastGameState.value = JSON.parse(JSON.stringify(gameState.value))
      hasLastGame.value = true
    }

    // Reset dart tracking
    lastProcessedDartsCount = 0

    // Reset PlayerResolver für neues Match
    playerResolver.reset()

    // Reset match started state
    isMatchStarted.value = false
    matchStartedMatchId.value = null

    // Reset match results and cancel timer
    if (matchResultsTimer) {
      clearTimeout(matchResultsTimer)
      matchResultsTimer = null
    }
    matchResults.value = null
    showMatchResults.value = false
    pendingMatchResults.value = null

    gameState.value = {
      matchId: null,
      isActive: false,
      gameMode: 'X01',
      startScore: 501,
      currentSet: 1,
      currentLeg: 1,
      setsToWin: 1,
      legsToWin: 3,
      players: [],
      activePlayerIndex: 0,
      currentTurn: {
        darts: [],
        turnScore: 0,
        remaining: 501,
        isBusted: false,
      },
      lastTurnScore: 0,
      isCheckoutPossible: false,
      winner: null,
      gameInfo: null,
      cricket: null,
    }
    lastGameIsCricket.value = false
    cricketAnimationTracker.reset()
  }

  // Demo mode for testing
  function startDemo() {
    gameState.value = {
      matchId: 'demo-123',
      isActive: true,
      gameMode: 'X01',
      startScore: 501,
      currentSet: 1,
      currentLeg: 2,
      setsToWin: 1,
      legsToWin: 3,
      players: [
        {
          index: 0,
          name: 'Max Power',
          score: 141,
          setsWon: 0,
          legsWon: 1,
          isActive: true,
          color: '#3b82f6',
          average: 62.5,
          dartsThrown: 12,
        },
        {
          index: 1,
          name: 'John Dart',
          score: 180,
          setsWon: 0,
          legsWon: 0,
          isActive: false,
          color: '#ef4444',
          average: 45.2,
          dartsThrown: 12,
        },
      ],
      activePlayerIndex: 0,
      currentTurn: {
        darts: [
          { segment: { number: 20, multiplier: 3, bed: 'T20' }, points: 60, index: 0 },
          { segment: { number: 20, multiplier: 3, bed: 'T20' }, points: 60, index: 1 },
        ],
        turnScore: 120,
        remaining: 21,
        isBusted: false,
      },
      lastTurnScore: 81,
      isCheckoutPossible: true,
      winner: null,
      gameInfo: {
        variant: 'X01',
        baseScore: 501,
        inMode: 'straight',
        outMode: 'double',
        bullMode: '25/50',
        maxRounds: 0,
        setsToWin: 1,
        legsToWin: 3,
      },
      cricket: null,
    }
  }

  // Hide match results and go back to idle
  function hideMatchResults() {
    showMatchResults.value = false
  }

  return {
    // State
    gameState,
    isConnected,
    config,
    hasLastGame,
    lastGameState,
    activeAnimation,
    animationQueue,
    pendingMatchResults,
    // Match started state
    isMatchStarted,
    matchStartedMatchId,
    // Match results state
    matchResults,
    showMatchResults,
    // Computed
    activePlayer,
    otherPlayers,
    currentDarts,
    turnScore,
    remainingScore,
    isBusted,
    isCricketGame,
    cricketDeadFields,
    cricketFields,
    cricketMarksByIndex,
    // Actions
    connect,
    disconnect,
    fetchConfig,
    fetchCurrentMatch,
    handleEvent,
    resetGame,
    startDemo,
    hideMatchResults,
    showMatchResultsWithTimer,
    onWinAnimationComplete,
    // Animation actions
    triggerAnimation,
    dismissAnimation,
    clearAnimationQueue,
    getAnimationForEvent,
  }
})
