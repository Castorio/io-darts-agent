import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
    if (!activePlayer.value) return 0
    return activePlayer.value.score - gameState.value.currentTurn.turnScore
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
  function connect() {
    if (wsConnection.value?.readyState === WebSocket.OPEN) return

    // Connect to the hub's WebSocket - handle different base paths
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/events`

    wsConnection.value = new WebSocket(wsUrl)

    wsConnection.value.onopen = () => {
      console.log('Game Display WebSocket connected')
      isConnected.value = true
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
    gameState.value.winner = null

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

    // Reset current turn
    gameState.value.currentTurn = {
      darts: [],
      turnScore: turnScore,
      remaining: (gameScores?.[gameState.value.activePlayerIndex] ?? gameState.value.startScore) - turnScore,
      isBusted: false,
    }

    // Check checkout possibility
    updateCheckoutStatus()
  }

  function handleThrow(data: Record<string, unknown>) {
    const segment = data.segment as Record<string, unknown> | undefined
    const points = (data.points as number) || 0
    const turnPoints = (data.turnPoints as number) || 0
    const busted = data.busted as boolean || false
    const dartIndex = gameState.value.currentTurn.darts.length

    if (dartIndex < 3 && segment) {
      const dart: DartThrow = {
        segment: {
          number: (segment.number as number) || 0,
          multiplier: (segment.multiplier as number) || 1,
          bed: (segment.bed as string) || '',
        },
        points,
        index: dartIndex,
      }

      gameState.value.currentTurn.darts.push(dart)
    }

    gameState.value.currentTurn.turnScore = turnPoints
    gameState.value.currentTurn.isBusted = busted

    // Update remaining score
    const activePlayer = gameState.value.players[gameState.value.activePlayerIndex]
    if (activePlayer) {
      gameState.value.currentTurn.remaining = activePlayer.score - turnPoints
    }

    updateCheckoutStatus()
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

  function resetGame() {
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
    handleEvent,
    resetGame,
    startDemo,
  }
})
