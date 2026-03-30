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

export interface PlayerAnimations {
  playerId?: string // Autodarts user ID or local player ID
  playerName?: string // Match by name if no ID
  animations: Partial<Record<AnimationEventType, AnimationConfig>>
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
    showCheckouts: true,
    checkoutThreshold: 170,
    animationSpeed: 'normal',
    showOtherPlayers: true,
    // Animation defaults
    animationsEnabled: true,
    defaultAnimations: {},
    playerAnimations: [],
  })

  // Active animation queue
  const activeAnimation = ref<ActiveAnimation | null>(null)
  const animationQueue = ref<ActiveAnimation[]>([])

  // Track if we have a "last game" to show
  const hasLastGame = ref(false)
  const lastGameState = ref<GameState | null>(null)

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

  // Actions
  async function fetchConfig() {
    try {
      const response = await fetch('/api/modules/game-display/config')
      const data = await response.json()
      console.log('Fetched config:', data)
      if (data) {
        config.value = {
          idleMode: data.idleMode || 'lastGame',
          idleImageUrl: data.idleImageUrl || '',
          showCheckouts: data.showCheckouts !== false,
          checkoutThreshold: data.checkoutThreshold || 170,
          animationSpeed: data.animationSpeed || 'normal',
          showOtherPlayers: data.showOtherPlayers !== false,
          animationsEnabled: data.animationsEnabled !== false,
          defaultAnimations: data.defaultAnimations || {},
          playerAnimations: data.playerAnimations || [],
        }
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
        // match.start only has matchId - fetch full match data from API
        console.log('Match started, fetching full match data...')
        fetchCurrentMatch()
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

      case 'match.delete':
        resetGame()
        break
    }
  }

  function handleMatchState(data: Record<string, unknown>) {
    console.log('handleMatchState data:', data)

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

    // Reset current turn
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
      // Trigger leg win animation
      triggerAnimation('legWin', winner)
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
      // Trigger match win animation
      triggerAnimation('matchWin', winner)
    }

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
  function getAnimationForEvent(
    eventType: AnimationEventType,
    player?: Player
  ): AnimationConfig | null {
    if (!config.value.animationsEnabled) return null

    // First check player-specific animations
    if (player) {
      const playerAnim = config.value.playerAnimations.find(
        (pa) =>
          (pa.playerId && pa.playerId === player.odId) ||
          (pa.playerName && pa.playerName.toLowerCase() === player.name.toLowerCase())
      )
      if (playerAnim?.animations[eventType]?.enabled) {
        return playerAnim.animations[eventType]!
      }
    }

    // Fall back to default animations
    const defaultAnim = config.value.defaultAnimations[eventType]
    if (defaultAnim?.enabled) {
      return defaultAnim
    }

    return null
  }

  function triggerAnimation(eventType: AnimationEventType, player?: Player) {
    const animConfig = getAnimationForEvent(eventType, player)
    if (!animConfig) return

    const animation: ActiveAnimation = {
      id: `${eventType}-${Date.now()}`,
      type: eventType,
      url: animConfig.url,
      duration: animConfig.duration || 3000,
      sound: animConfig.sound,
      startTime: Date.now(),
    }

    // Add to queue
    animationQueue.value.push(animation)

    // If no animation is playing, start this one
    if (!activeAnimation.value) {
      playNextAnimation()
    }
  }

  function playNextAnimation() {
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

  return {
    // State
    gameState,
    isConnected,
    config,
    hasLastGame,
    lastGameState,
    activeAnimation,
    animationQueue,
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
    // Animation actions
    triggerAnimation,
    dismissAnimation,
    clearAnimationQueue,
    getAnimationForEvent,
  }
})
