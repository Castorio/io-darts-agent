import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
  animationSpeed: 'slow' | 'normal' | 'fast'
  showOtherPlayers: boolean
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
  })

  const wsConnection = ref<WebSocket | null>(null)
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
    animationSpeed: 'normal',
    showOtherPlayers: true,
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
        }

        // Parse each animation group (new format from module.json)
        for (const [groupName, eventType] of Object.entries(animationGroupMap)) {
          const groupConfig = data[groupName] as Record<string, unknown> | undefined
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
          animationSpeed: data.animationSpeed || 'normal',
          showOtherPlayers: data.showOtherPlayers !== false,
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

  function connect() {
    if (wsConnection.value?.readyState === WebSocket.OPEN) return

    // Connect to the hub's WebSocket - handle different base paths
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/events`

    wsConnection.value = new WebSocket(wsUrl)

    wsConnection.value.onopen = async () => {
      console.log('Game Display WebSocket connected')
      isConnected.value = true
      // Load configuration and current match in parallel
      await Promise.all([
        fetchConfig(),
        fetchCurrentMatch()
      ])
    }

    wsConnection.value.onclose = () => {
      console.log('Game Display WebSocket disconnected')
      isConnected.value = false
      // Auto-reconnect after 3 seconds
      setTimeout(() => connect(), 3000)
    }

    wsConnection.value.onerror = (error) => {
      console.error('Game Display WebSocket error:', error)
    }

    wsConnection.value.onmessage = (wsEvent) => {
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
    if (wsConnection.value) {
      wsConnection.value.close()
      wsConnection.value = null
    }
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

  function handleMatchStart(data: Record<string, unknown>) {
    console.log('handleMatchStart data:', data)

    // Cancel any pending match results timer and hide results
    if (matchResultsTimer) {
      clearTimeout(matchResultsTimer)
      matchResultsTimer = null
    }
    showMatchResults.value = false

    // Reset dart tracking for new match
    lastProcessedDartsCount = 0

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

    gameState.value.matchId = data.matchId as string
    gameState.value.isActive = true

    // Parse game settings
    const settings = data.settings as Record<string, unknown> | undefined
    if (settings) {
      gameState.value.startScore = (settings.baseScore as number) || (settings.startScore as number) || 501
      gameState.value.setsToWin = (settings.sets as number) || 1
      gameState.value.legsToWin = (settings.legs as number) || 3
    }

    // Parse players - the hub sends players with basic info and gameScores separately
    const players = data.players as Array<Record<string, unknown>> | undefined
    const gameScores = data.gameScores as number[] | undefined

    if (players) {
      gameState.value.players = players.map((p, index) => ({
        index: (p.index as number) ?? index,
        name: (p.name as string) || `Player ${index + 1}`,
        // Score comes from gameScores array, not from player object
        score: gameScores?.[index] ?? gameState.value.startScore,
        setsWon: (p.setsWon as number) || 0,
        legsWon: (p.legsWon as number) || 0,
        isActive: index === (data.player as number ?? 0),
        color: (p.color as string) || defaultColors[index % defaultColors.length],
        average: p.average as number | undefined,
        dartsThrown: p.dartsThrown as number | undefined,
      }))
    }

    // Active player
    gameState.value.activePlayerIndex = (data.player as number) ?? 0

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
    const playerRemainingScore = gameScores?.[gameState.value.activePlayerIndex] ?? gameState.value.startScore

    // Check for NEW darts and trigger bull animations if needed
    // This handles the case where throw.detected events don't arrive
    // but we still get the throws via match.state
    const newDartsCount = currentTurnDarts.length
    if (newDartsCount > lastProcessedDartsCount) {
      // Process only the NEW darts (ones we haven't seen before)
      for (let i = lastProcessedDartsCount; i < newDartsCount; i++) {
        const dart = currentTurnDarts[i]
        if (dart && dart.segment) {
          const number = dart.segment.number
          const multiplier = dart.segment.multiplier
          const player = gameState.value.players[gameState.value.activePlayerIndex]

          // Trigger bull animations
          if (number === 25 && multiplier === 1) {
            console.log('🎯 Bull detected from match.state - triggering animation')
            triggerAnimation('bull', player || undefined)
          } else if (number === 25 && multiplier === 2) {
            console.log('🎯 Double Bull detected from match.state - triggering animation')
            triggerAnimation('doubleBull', player || undefined)
          }

          // Check for 180 (after 3 darts, all T20)
          if (i === 2 && turnScore === 180) {
            triggerAnimation('180', player || undefined)
          }

          // Check for high score (140+) after third dart
          if (i === 2 && turnScore >= 140 && turnScore < 180) {
            triggerAnimation('highScore', player || undefined)
          }
        }
      }
    }
    lastProcessedDartsCount = newDartsCount

    gameState.value.currentTurn = {
      darts: currentTurnDarts,
      turnScore: turnScore,
      remaining: playerRemainingScore,
      isBusted: turnBusted,
    }

    // Check checkout possibility
    updateCheckoutStatus()

    // Check if this leg/game is finished
    const finished = data.finished as boolean | undefined
    const winnerIndex = data.winner as number | undefined

    if (finished && winnerIndex !== undefined) {
      // Leg/Game finished - set winner
      const winner = gameState.value.players[winnerIndex]
      if (winner) {
        gameState.value.winner = winner
      }
    } else {
      // Game continues or new leg started - clear winner
      gameState.value.winner = null
    }
  }

  function handleThrow(data: Record<string, unknown>) {
    // throw.detected events only have segment info, no scores
    // The next match.state event will have the complete data including scores
    // We just add the dart visually here for immediate feedback
    const segment = data.segment as Record<string, unknown> | undefined
    const dartIndex = gameState.value.currentTurn.darts.length

    if (dartIndex < 3 && segment) {
      const number = (segment.number as number) || 0
      const multiplier = (segment.multiplier as number) || 1
      const calculatedPoints = number * multiplier
      // Use 'name' field for display (e.g. "S1", "T20", "D16")
      const name = (segment.name as string) || ''

      const dart: DartThrow = {
        segment: {
          number,
          multiplier,
          bed: name, // Store name in bed field for getDartLabel()
        },
        points: calculatedPoints,
        index: dartIndex,
      }

      gameState.value.currentTurn.darts.push(dart)

      // Update turn score for immediate visual feedback
      // The next match.state will provide the authoritative values
      const newTurnScore = gameState.value.currentTurn.darts.reduce((sum, d) => sum + d.points, 0)
      gameState.value.currentTurn.turnScore = newTurnScore

      // Check for special throws - trigger animations
      const player = activePlayer.value
      if (number === 25 && multiplier === 1) {
        triggerAnimation('bull', player || undefined)
      } else if (number === 25 && multiplier === 2) {
        triggerAnimation('doubleBull', player || undefined)
      }

      // Check for 180 (after 3 darts, all T20)
      if (newTurnScore === 180 && gameState.value.currentTurn.darts.length === 3) {
        triggerAnimation('180', player || undefined)
      }

      // Check for high score (140+)
      if (newTurnScore >= 140 && newTurnScore < 180 && gameState.value.currentTurn.darts.length === 3) {
        triggerAnimation('highScore', player || undefined)
      }

      // Subtract the thrown points from the CURRENT remaining score
      // (not from activePlayer.score, which already reflects the server state)
      gameState.value.currentTurn.remaining -= calculatedPoints

      updateCheckoutStatus()
    }
  }

  function handlePlayerChange(data: Record<string, unknown>) {
    console.log('handlePlayerChange data:', data)
    // The hub sends currentPlayer, not playerIndex
    const newPlayerIndex = (data.currentPlayer as number) ?? (data.playerIndex as number) ?? 0

    // Save last turn score before switching
    gameState.value.lastTurnScore = gameState.value.currentTurn.turnScore

    // Update active player
    gameState.value.activePlayerIndex = newPlayerIndex
    gameState.value.players.forEach((p, i) => {
      p.isActive = i === newPlayerIndex
    })

    // Update scores from event data if available
    const scores = data.scores as number[] | undefined
    if (scores) {
      scores.forEach((score, i) => {
        if (gameState.value.players[i]) {
          gameState.value.players[i].score = score
        }
      })
    }

    // Reset current turn and dart tracking
    lastProcessedDartsCount = 0
    gameState.value.currentTurn = {
      darts: [],
      turnScore: 0,
      remaining: gameState.value.players[newPlayerIndex]?.score || gameState.value.startScore,
      isBusted: false,
    }

    updateCheckoutStatus()
  }

  function handleTurnFinished(data: Record<string, unknown>) {
    // Update player score
    const playerIndex = (data.playerIndex as number) || gameState.value.activePlayerIndex
    const newScore = data.remaining as number | undefined

    // Check for bust
    const busted = data.busted as boolean | undefined
    if (busted) {
      const player = gameState.value.players[playerIndex]
      triggerAnimation('bust', player || undefined)
    }

    // Check for checkout (remaining = 0 and finished with double)
    if (newScore === 0) {
      const player = gameState.value.players[playerIndex]
      triggerAnimation('checkout', player || undefined)
    }

    if (newScore !== undefined && gameState.value.players[playerIndex]) {
      gameState.value.players[playerIndex].score = newScore
    }
  }

  function handleGameFinished(data: Record<string, unknown>) {
    console.log('handleGameFinished data:', data)
    // The hub sends winner, not winnerIndex
    const winnerIndex = (data.winner as number) ?? (data.winnerIndex as number) ?? 0
    const winner = gameState.value.players[winnerIndex]

    if (winner) {
      winner.legsWon++
      gameState.value.winner = winner

      // Create win event data for enhanced animation
      const winData: WinEventData = {
        winnerIndex,
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

      // Trigger leg win animation with win data
      triggerAnimation('legWin', winner, winData)
    }

    // Update leg count from data if available
    if (data.leg !== undefined) {
      gameState.value.currentLeg = (data.leg as number) + 1
    } else {
      gameState.value.currentLeg++
    }
  }

  function handleMatchFinished(data: Record<string, unknown>) {
    console.log('handleMatchFinished data:', data)
    // The hub sends winner, not winnerIndex
    const winnerIndex = (data.winner as number) ?? (data.winnerIndex as number) ?? 0
    const winner = gameState.value.players[winnerIndex]

    if (winner) {
      gameState.value.winner = winner

      // Create win event data for enhanced animation
      const winData: WinEventData = {
        winnerIndex,
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

      // Trigger match win animation with win data
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
    const winnerIndex = data.winner as number | undefined
    const players = data.players as Array<Record<string, unknown>> | undefined

    if (chalkboards) {
      // Update player names from result data if available
      if (players) {
        players.forEach((p, idx) => {
          if (gameState.value.players[idx]) {
            gameState.value.players[idx].name = (p.name as string) || gameState.value.players[idx].name
          }
        })
      }

      const results: MatchResults = {
        chalkboards: chalkboards.map((cb, index) => {
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
  }

  function getAnimationForEvent(
    eventType: AnimationEventType,
    player?: Player
  ): AnimationConfig | null {
    if (!config.value.animationsEnabled) return null

    // First check player-specific animations
    if (player) {
      console.log(`🔍 [GameDisplay] Looking for player animation:`, {
        playerName: player.name,
        playerOdId: player.odId,
        availableOverrides: config.value.playerAnimations.map((pa: Record<string, unknown>) => ({
          playerName: pa.playerName,
          playerId: pa.playerId
        }))
      })

      // Support both old format (with animations sub-object) and new format (direct keys)
      const playerAnim = config.value.playerAnimations.find(
        (pa: Record<string, unknown>) =>
          (pa.playerId && pa.playerId === player.odId) ||
          (pa.playerName && (pa.playerName as string).toLowerCase() === player.name.toLowerCase())
      ) as Record<string, unknown> | undefined

      if (playerAnim) {
        // Get the UI key for this event type
        const uiKey = EVENT_TO_UI_KEY_MAP[eventType]

        // Check new format: direct keys like throw180, legWin, etc.
        const newFormatAnim = playerAnim[uiKey] as Record<string, unknown> | undefined
        if (newFormatAnim) {
          const animType = newFormatAnim.type as string
          // Check if animation is configured (type is not 'none' and not undefined)
          if (animType && animType !== 'none') {
            const mediaUrl = (newFormatAnim.mediaUrl as string) || ''
            const soundUrl = (newFormatAnim.soundUrl as string) || undefined
            console.log(`🎮 [GameDisplay] Found player animation for ${player.name}:`, {
              uiKey,
              animType,
              mediaUrl,
              soundUrl,
              fullConfig: newFormatAnim
            })
            return {
              enabled: true,
              url: animType === 'builtin' ? '' : mediaUrl,
              duration: BUILTIN_ANIMATION_DURATIONS[eventType] || 3000,
              sound: soundUrl,
            }
          }
        }

        // Check old format: animations sub-object
        const oldAnimations = playerAnim.animations as Record<string, AnimationConfig> | undefined
        if (oldAnimations?.[eventType]?.enabled) {
          return oldAnimations[eventType]
        }
      }
    }

    // Fall back to default animations if explicitly configured
    const defaultAnim = config.value.defaultAnimations[eventType]
    if (defaultAnim?.enabled) {
      return defaultAnim
    }

    // If no explicit config exists but animations are enabled globally,
    // return a default builtin animation config
    // This ensures builtin animations play even without explicit configuration
    return {
      enabled: true,
      url: '', // empty URL triggers builtin animation in AnimationOverlay.vue
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
    }
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
