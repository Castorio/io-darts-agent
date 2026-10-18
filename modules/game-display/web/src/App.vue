<script setup lang="ts">
import { gameInfoLines } from './utils/gameInfo'
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDisplayStore } from './stores/gameDisplay'
import { getCheckoutSuggestion, getDartLabel } from './utils/checkouts'
import AnimationOverlay from './components/AnimationOverlay.vue'
import WinAnimation from './components/WinAnimation.vue'
import CricketBoard from './components/CricketBoard.vue'

const { t } = useI18n()
const store = useGameDisplayStore()

// Configuration
const config = computed(() => store.config)
const hasLastGame = computed(() => store.hasLastGame)
const lastGameState = computed(() => store.lastGameState)
const gameInfo = computed(() => store.gameState.gameInfo)

// Animation states
const scoreAnimating = ref(false)
const dartAnimating = ref<number | null>(null)
const previousScore = ref<number | null>(null)

// Computed values
const gameState = computed(() => store.gameState)
const activePlayer = computed(() => store.activePlayer)
const otherPlayers = computed(() => store.otherPlayers)
const currentDarts = computed(() => store.currentDarts)
const turnScore = computed(() => store.turnScore)
const remainingScore = computed(() => store.remainingScore)
const isBusted = computed(() => store.isBusted)
const isCricketGame = computed(() => store.isCricketGame)

// Match started state
const isMatchStarted = computed(() => store.isMatchStarted)

// Match results state
const showMatchResults = computed(() => store.showMatchResults)
const matchResults = computed(() => store.matchResults)

// Match winner player - lookup by player.index field, not array position
// Autodarts sends winner as player.index value, not array position
const matchWinnerPlayer = computed(() => {
  if (matchResults.value?.winner === null || matchResults.value?.winner === undefined) return null
  // Find player by index field, not array position
  return gameState.value.players.find(p => p.index === matchResults.value!.winner)
    || gameState.value.players[matchResults.value!.winner] // fallback to array position
})

// Check if a player at boardIndex is the winner (by index field comparison)
function isWinnerByBoardIndex(boardIndex: number): boolean {
  if (matchResults.value?.winner === null || matchResults.value?.winner === undefined) return false
  const player = gameState.value.players[boardIndex]
  return player?.index === matchResults.value.winner
}

// Player color with fallback
const playerColor = computed(() => {
  return activePlayer.value?.color || '#3b82f6'
})

// Darker version of player color for gradients
const playerColorDark = computed(() => {
  const hex = playerColor.value.replace('#', '')
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 80)
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 80)
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 80)
  return `rgb(${r}, ${g}, ${b})`
})

// Even darker for deep background
const playerColorDeep = computed(() => {
  const hex = playerColor.value.replace('#', '')
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 150)
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 150)
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 150)
  return `rgb(${r}, ${g}, ${b})`
})

// Checkout suggestion
const checkout = computed(() => {
  if (!activePlayer.value || isBusted.value) return null
  const dartsRemaining = 3 - currentDarts.value.length
  return getCheckoutSuggestion(remainingScore.value, dartsRemaining)
})

// Status text
const statusText = computed(() => {
  if (!gameState.value.isActive) return t('game.waitingForGame')

  const leg = `${t('score.leg')} ${gameState.value.currentLeg}`
  const set = gameState.value.setsToWin > 1 ? `${t('score.set')} ${gameState.value.currentSet}` : ''

  return [set, leg].filter(Boolean).join(' • ')
})

// Game info position classes based on config
const gameInfoPositionClasses = computed(() => {
  const position = config.value.gameInfoPosition || 'top-left'
  const baseSpacing = 'top-6 left-6 lg:top-10 lg:left-10'

  switch (position) {
    case 'top-right':
      return 'top-6 right-6 lg:top-10 lg:right-10'
    case 'bottom-left':
      return 'bottom-6 left-6 lg:bottom-10 lg:left-10'
    case 'bottom-right':
      return 'bottom-6 right-6 lg:bottom-10 lg:right-10'
    case 'top-left':
    default:
      return baseSpacing
  }
})

// Game info size classes based on config
const gameInfoSizeClasses = computed(() => {
  const size = config.value.gameInfoSize || 'medium'

  switch (size) {
    case 'small':
      return {
        container: 'px-2 py-1.5',
        primaryText: 'text-sm lg:text-base',
        secondaryText: 'text-xs lg:text-sm text-white/60'
      }
    case 'large':
      return {
        container: 'px-6 py-4',
        primaryText: 'text-xl lg:text-2xl',
        secondaryText: 'text-base lg:text-lg text-white/60'
      }
    case 'medium':
    default:
      return {
        container: 'px-4 py-3',
        primaryText: 'text-lg lg:text-xl',
        secondaryText: 'text-sm lg:text-base text-white/60'
      }
  }
})

// Game info offset styles for additional positioning
const gameInfoOffsetStyles = computed(() => {
  const offsetX = config.value.gameInfoOffsetX || 0
  const offsetY = config.value.gameInfoOffsetY || 0
  const position = config.value.gameInfoPosition || 'top-left'

  // Determine which direction to apply offsets based on position
  const isRight = position.includes('right')
  const isBottom = position.includes('bottom')

  return {
    // Add margin in the appropriate direction
    marginLeft: !isRight && offsetX > 0 ? `${offsetX}px` : undefined,
    marginRight: isRight && offsetX > 0 ? `${offsetX}px` : undefined,
    marginTop: !isBottom && offsetY > 0 ? `${offsetY}px` : undefined,
    marginBottom: isBottom && offsetY > 0 ? `${offsetY}px` : undefined,
  }
})

// Game info display items with labels
interface GameInfoItem {
  label: string
  value: string
}

const gameInfoText = computed((): GameInfoItem[] | null =>
  gameInfo.value ? gameInfoLines(gameInfo.value, (key) => t(key)) : null
)

// Watch for score changes to animate
watch(() => activePlayer.value?.score, (newScore, oldScore) => {
  if (oldScore !== undefined && newScore !== oldScore) {
    previousScore.value = oldScore
    scoreAnimating.value = true
    setTimeout(() => {
      scoreAnimating.value = false
    }, 500)
  }
})

// Watch for new darts
watch(() => currentDarts.value.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    dartAnimating.value = newLen - 1
    setTimeout(() => {
      dartAnimating.value = null
    }, 400)
  }
})

// Format dart for display
function formatDart(dart: { segment: { number: number; multiplier: number; bed: string }; points: number } | undefined): string {
  if (!dart) return '-'
  return getDartLabel(dart.segment)
}

onMounted(() => {
  store.connect()
})

onUnmounted(() => {
  store.disconnect()
})
</script>

<template>
  <div
    class="game-display min-h-screen flex flex-col overflow-hidden transition-colors duration-700"
    :style="{
      '--player-color': playerColor,
      '--player-color-dark': playerColorDark,
      '--player-color-deep': playerColorDeep,
    }"
  >
    <!-- Animated Background -->
    <div class="absolute inset-0 overflow-hidden">
      <!-- Base gradient -->
      <div
        class="absolute inset-0 transition-all duration-700"
        :style="{
          background: `radial-gradient(ellipse at 50% 0%, ${playerColorDark} 0%, ${playerColorDeep} 50%, #0a0a0f 100%)`
        }"
      />
      <!-- Animated glow orbs -->
      <div
        class="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-30 animate-pulse-slow transition-colors duration-700"
        :style="{
          background: playerColor,
          top: '-200px',
          left: '50%',
          transform: 'translateX(-50%)',
        }"
      />
      <div
        class="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20 animate-float transition-colors duration-700"
        :style="{
          background: playerColor,
          bottom: '20%',
          right: '-100px',
        }"
      />
      <!-- Subtle grid overlay -->
      <div class="absolute inset-0 opacity-5" style="background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 50px 50px;" />
    </div>

    <!-- Content -->
    <div class="relative z-10 flex flex-col min-h-screen p-6 lg:p-10">

      <!-- Demo Toggle (development) -->
      <!--
        <button
        @click="toggleDemo"
        class="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors z-50"
      >
        {{ isDemo ? t('demo.stop') : t('demo.start') }}
      </button>
      -->

      <!-- Match Started State - waiting for first throw -->
      <div
        v-if="isMatchStarted && !gameState.isActive"
        class="fixed inset-0 z-50 flex items-center justify-center"
        :style="{ backgroundColor: config.matchStartedMode === 'default' ? (config.gameOnBackgroundColor || '#0a0a0f') : 'transparent' }"
      >
        <!-- Mode: Default "Game On!" screen -->
        <div v-if="config.matchStartedMode === 'default'" class="text-center">
          <div class="relative">
            <!-- Animated glow -->
            <div class="absolute inset-0 blur-3xl opacity-60 bg-green-500 animate-pulse" />
            <!-- Main text -->
            <h1 class="relative text-[8rem] lg:text-[14rem] font-black text-white uppercase tracking-tight"
                style="text-shadow: 0 0 100px rgba(34, 197, 94, 0.6);">
              {{ t('game.gameOn') }}
            </h1>
          </div>
          <p class="text-white/50 text-2xl mt-6 animate-pulse">{{ t('game.waitingForFirstThrow') }}</p>
        </div>

        <!-- Mode: Custom Image/GIF -->
        <div v-else-if="config.matchStartedMode === 'image' && config.matchStartedImageUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <img
            :src="config.matchStartedImageUrl"
            alt="Match Started"
            class="max-w-full max-h-full object-contain"
            @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
          />
          <p class="absolute bottom-10 text-white/50 text-xl animate-pulse">{{ t('game.waitingForFirstThrow') }}</p>
        </div>

        <!-- Fallback to default -->
        <div v-else class="text-center">
          <div class="relative">
            <div class="absolute inset-0 blur-3xl opacity-60 bg-green-500 animate-pulse" />
            <h1 class="relative text-[8rem] lg:text-[14rem] font-black text-white uppercase tracking-tight"
                style="text-shadow: 0 0 100px rgba(34, 197, 94, 0.6);">
              {{ t('game.gameOn') }}
            </h1>
          </div>
          <p class="text-white/50 text-2xl mt-6 animate-pulse">{{ t('game.waitingForFirstThrow') }}</p>
        </div>
      </div>
      <!-- End Match Started overlay -->

      <!-- Match Results Table -->
      <div
        v-else-if="showMatchResults && matchResults"
        class="fixed inset-0 z-40 flex flex-col items-center justify-center p-8"
        :style="{ backgroundColor: config.matchResultsBackgroundColor }"
      >
        <!-- Header -->
        <div class="text-center mb-8">
          <h1 class="text-4xl lg:text-6xl font-bold text-white uppercase tracking-tight mb-4">
            {{ t('game.matchResults') }}
          </h1>
          <div
            v-if="matchWinnerPlayer"
            class="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"
          >
            <svg class="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span class="text-2xl font-bold text-yellow-400">
              {{ matchWinnerPlayer.name }}
            </span>
            <span class="text-lg text-yellow-400/70">{{ t('game.winner') }}</span>
          </div>
        </div>

        <!-- Results Table Grid -->
        <!-- Use gameState.players.length to determine grid layout, not chalkboards.length
             This ensures proper layout even when chalkboards are empty but players exist -->
        <div
          v-if="matchResults.chalkboards.length > 0"
          class="w-full max-w-6xl grid gap-8"
          :class="{
            'grid-cols-1': matchResults.chalkboards.length === 1,
            'grid-cols-2': matchResults.chalkboards.length === 2,
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': matchResults.chalkboards.length >= 3
          }"
        >
          <div
            v-for="(board, boardIndex) in matchResults.chalkboards"
            :key="boardIndex"
            class="bg-white/5 border rounded-2xl overflow-hidden transition-all"
            :class="isWinnerByBoardIndex(boardIndex) ? 'border-yellow-500/50 ring-2 ring-yellow-500/30' : 'border-white/10'"
          >
            <!-- Player Header -->
            <div
              class="px-6 py-4 border-b border-white/10 flex items-center justify-between"
              :style="{ backgroundColor: gameState.players[boardIndex]?.color + '20' }"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-4 h-4 rounded-full"
                  :style="{ backgroundColor: gameState.players[boardIndex]?.color || '#3b82f6' }"
                />
                <span class="text-xl font-bold text-white uppercase">
                  {{ gameState.players[boardIndex]?.name || `Player ${boardIndex + 1}` }}
                </span>
                <span
                  v-if="isWinnerByBoardIndex(boardIndex)"
                  class="px-2 py-0.5 rounded-full bg-yellow-500 text-black text-xs font-bold uppercase"
                >
                  {{ t('game.winner') }}
                </span>
              </div>
              <!-- Stats -->
              <div v-if="matchResults.stats[boardIndex]" class="flex items-center gap-4 text-sm text-white/60">
                <span v-if="matchResults.stats[boardIndex].average">
                  Ø {{ matchResults.stats[boardIndex].average?.toFixed(1) }}
                </span>
                <span v-if="matchResults.stats[boardIndex].highestCheckout">
                  HCO: {{ matchResults.stats[boardIndex].highestCheckout }}
                </span>
              </div>
            </div>

            <!-- Chalkboard Rows -->
            <div class="overflow-y-auto max-h-[400px]">
              <table class="w-full">
                <thead class="sticky top-0 bg-dark-900/95 backdrop-blur">
                  <tr class="text-sm text-white/50 uppercase tracking-wider">
                    <th class="px-4 py-2 text-left w-16">{{ t('game.round') }}</th>
                    <th class="px-4 py-2 text-center">{{ t('game.points') }}</th>
                    <th class="px-4 py-2 text-right">{{ t('game.remaining') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in board.rows"
                    :key="row.round"
                    class="border-t border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td class="px-4 py-2 text-white/50 text-sm">{{ row.round }}</td>
                    <td
                      class="px-4 py-2 text-center text-xl font-semibold"
                      :class="row.isPointsStruck ? 'text-red-400 line-through' : 'text-white'"
                    >
                      {{ row.points }}
                    </td>
                    <td
                      class="px-4 py-2 text-right text-lg font-medium"
                      :class="row.isScoreStruck ? 'text-red-400 line-through' : row.score === 0 ? 'text-green-400' : 'text-white/80'"
                    >
                      {{ row.score }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Stats Footer -->
            <div
              v-if="matchResults.stats && matchResults.stats[boardIndex]"
              class="px-6 py-3 border-t border-white/10 bg-white/5 grid grid-cols-3 gap-4 text-center"
            >
              <div>
                <p class="text-xs text-white/40 uppercase">{{ t('game.average') }}</p>
                <p class="text-lg font-bold text-white">
                  {{ matchResults.stats[boardIndex]?.average?.toFixed(1) || '-' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-white/40 uppercase">{{ t('game.darts') }}</p>
                <p class="text-lg font-bold text-white">
                  {{ matchResults.stats[boardIndex]?.dartsThrown || '-' }}
                </p>
              </div>
              <div>
                <p class="text-xs text-white/40 uppercase">{{ t('game.checkout') }}</p>
                <p class="text-lg font-bold text-white">
                  {{ (matchResults.stats[boardIndex]?.checkoutPercent ?? 0) > 0 ? matchResults.stats[boardIndex]?.checkoutPercent?.toFixed(0) + '%' : '-' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Fallback: Show player summary when chalkboards are empty but players exist -->
        <div
          v-else-if="gameState.players.length > 0"
          class="w-full max-w-6xl grid gap-8"
          :class="{
            'grid-cols-1': gameState.players.length === 1,
            'grid-cols-2': gameState.players.length === 2,
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': gameState.players.length >= 3
          }"
        >
          <div
            v-for="(player, playerIndex) in gameState.players"
            :key="playerIndex"
            class="bg-white/5 border rounded-2xl overflow-hidden transition-all"
            :class="isWinnerByBoardIndex(playerIndex) ? 'border-yellow-500/50 ring-2 ring-yellow-500/30' : 'border-white/10'"
          >
            <!-- Player Header -->
            <div
              class="px-6 py-4 border-b border-white/10 flex items-center justify-between"
              :style="{ backgroundColor: player.color + '20' }"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-4 h-4 rounded-full"
                  :style="{ backgroundColor: player.color || '#3b82f6' }"
                />
                <span class="text-xl font-bold text-white uppercase">
                  {{ player.name || `Player ${playerIndex + 1}` }}
                </span>
                <span
                  v-if="isWinnerByBoardIndex(playerIndex)"
                  class="px-2 py-0.5 rounded-full bg-yellow-500 text-black text-xs font-bold uppercase"
                >
                  {{ t('game.winner') }}
                </span>
              </div>
            </div>

            <!-- Player Stats Summary -->
            <div class="px-6 py-6 flex flex-col items-center gap-4">
              <!-- Final Score -->
              <div class="text-center">
                <p class="text-xs text-white/40 uppercase mb-1">{{ t('game.remaining') }}</p>
                <p class="text-4xl font-bold" :class="player.score === 0 ? 'text-green-400' : 'text-white'">
                  {{ player.score }}
                </p>
              </div>

              <!-- Legs/Sets Won -->
              <div class="flex items-center gap-6 text-center">
                <div>
                  <p class="text-xs text-white/40 uppercase">{{ t('score.legs') }}</p>
                  <p class="text-2xl font-bold text-white">{{ player.legsWon }}</p>
                </div>
                <div v-if="gameState.setsToWin > 1">
                  <p class="text-xs text-white/40 uppercase">{{ t('score.sets') }}</p>
                  <p class="text-2xl font-bold text-white">{{ player.setsWon }}</p>
                </div>
              </div>

              <!-- Stats from matchResults if available -->
              <div v-if="matchResults.stats[playerIndex]" class="grid grid-cols-3 gap-4 w-full mt-2 pt-4 border-t border-white/10">
                <div class="text-center">
                  <p class="text-xs text-white/40 uppercase">{{ t('game.average') }}</p>
                  <p class="text-lg font-bold text-white">
                    {{ matchResults.stats[playerIndex]?.average?.toFixed(1) || '-' }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-white/40 uppercase">{{ t('game.darts') }}</p>
                  <p class="text-lg font-bold text-white">
                    {{ matchResults.stats[playerIndex]?.dartsThrown || '-' }}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-white/40 uppercase">{{ t('game.checkout') }}</p>
                  <p class="text-lg font-bold text-white">
                    {{ (matchResults.stats[playerIndex]?.checkoutPercent ?? 0) > 0 ? matchResults.stats[playerIndex]?.checkoutPercent?.toFixed(0) + '%' : '-' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Continue hint -->
        <p class="text-white/30 mt-8 text-sm">{{ t('game.waitingForNextGame') }}</p>
      </div>

      <!-- Waiting State / Idle Mode -->
      <div
        v-else-if="!gameState.isActive"
        class="flex-1 flex items-center justify-center"
      >
        <!-- Mode: Black Screen -->
        <div v-if="config.idleMode === 'black'" class="fixed inset-0 bg-black z-50" />

        <!-- Mode: Custom Image -->
        <div v-else-if="config.idleMode === 'image' && config.idleImageUrl" class="fixed inset-0 z-50">
          <img
            :src="config.idleImageUrl"
            alt="Idle Image"
            class="w-full h-full object-contain bg-black"
            @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
          />
        </div>

        <!-- Mode: Last Game State (or fallback waiting message) -->
        <div v-else-if="config.idleMode === 'lastGame' && hasLastGame && lastGameState" class="text-center">
          <div class="mb-6">
            <span class="px-4 py-2 rounded-full bg-white/10 text-white/60 text-sm uppercase tracking-wider">
              {{ t('game.lastGame') }}
            </span>
          </div>
          <!-- Show last game players and scores -->
          <div class="flex flex-wrap items-center justify-center gap-6">
            <div
              v-for="player in lastGameState.players"
              :key="player.index"
              class="flex flex-col items-center px-8 py-6 rounded-2xl bg-white/5 border border-white/10"
              :class="{ 'ring-2 ring-yellow-400': lastGameState.winner?.index === player.index }"
            >
              <!-- Winner badge -->
              <div
                v-if="lastGameState.winner?.index === player.index"
                class="mb-2 px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-bold uppercase"
              >
                {{ t('game.winner') }}
              </div>
              <!-- Color indicator -->
              <div
                class="w-4 h-4 rounded-full mb-3"
                :style="{ backgroundColor: player.color }"
              />
              <!-- Name -->
              <span class="text-white/80 font-medium text-lg uppercase">{{ player.name }}</span>
              <!-- Final Score -->
              <span class="text-5xl font-bold text-white mt-2">{{ player.score }}</span>
              <!-- Legs/Sets -->
              <div class="flex items-center gap-4 mt-3 text-white/50 text-sm">
                <span>{{ player.legsWon }} {{ player.legsWon !== 1 ? t('score.legs') : t('score.leg') }}</span>
                <span v-if="lastGameState.setsToWin > 1">{{ player.setsWon }} {{ player.setsWon !== 1 ? t('score.sets') : t('score.set') }}</span>
              </div>
            </div>
          </div>
          <p class="text-white/30 mt-8">{{ t('game.waitingForNextGame') }}</p>
        </div>

        <!-- Fallback: Default waiting message -->
        <div v-else class="text-center">
          <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <svg class="w-12 h-12 text-white/30 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-light text-white/50">{{ t('game.waitingForGame') }}</h2>
          <p class="text-white/30 mt-2">{{ t('game.displayUpdatesAutomatically') }}</p>
        </div>
      </div>

      <!-- Active Game -->
      <template v-else>
        <!-- Game Info Overlay (configurable position) -->
        <div
          v-if="config.showGameInfo && gameInfoText"
          class="absolute z-20"
          :class="gameInfoPositionClasses"
          :style="gameInfoOffsetStyles"
        >
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <!-- Header with player color -->
            <div
              class="px-4 py-3 border-b border-white/10 flex items-center gap-3"
              :style="{ backgroundColor: playerColor + '20' }"
            >
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: playerColor }"
              />
              <span class="text-white font-semibold uppercase tracking-wide" :class="gameInfoSizeClasses.primaryText">
                {{ t('gameInfo.title') }}
              </span>
            </div>
            <!-- Content -->
            <div :class="gameInfoSizeClasses.container" class="flex flex-col gap-2">
              <div
                v-for="(item, idx) in gameInfoText"
                :key="idx"
                class="flex items-baseline justify-between gap-4"
              >
                <span
                  class="text-white/50 font-normal"
                  :class="gameInfoSizeClasses.secondaryText"
                >
                  {{ item.label }}
                </span>
                <span
                  class="text-white font-semibold"
                  :class="gameInfoSizeClasses.secondaryText"
                >
                  {{ item.value }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Header: Player Name + Status -->
        <header class="text-center mb-6 lg:mb-10">
          <!-- Player Name -->
          <h1
            class="text-4xl lg:text-6xl font-bold text-white tracking-tight transition-all duration-300 uppercase"
            :style="{ textShadow: `0 0 60px ${playerColor}40` }"
          >
            {{ activePlayer?.name || t('player.defaultName') }}
          </h1>

          <!-- Status Line -->
          <div class="flex items-center justify-center gap-4 mt-3 text-white/60">
            <span class="text-lg">{{ statusText }}</span>
            <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span class="text-lg">{{ t('game.atTurn') }}</span>
          </div>

          <!-- Legs/Sets Won -->
          <div class="flex items-center justify-center gap-6 mt-4">
            <div v-if="gameState.setsToWin > 1" class="flex items-center gap-2">
              <span class="text-white/40 text-sm uppercase tracking-wider">{{ t('score.sets') }}</span>
              <span class="text-xl font-semibold text-white">{{ activePlayer?.setsWon || 0 }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/40 text-sm uppercase tracking-wider">{{ t('score.legs') }}</span>
              <span class="text-xl font-semibold text-white">{{ activePlayer?.legsWon || 0 }}</span>
            </div>
          </div>
        </header>

        <!-- Cricket: points and marks per field -->
        <CricketBoard
          v-if="isCricketGame"
          :active-player="activePlayer"
          :other-players="config.showOtherPlayers ? otherPlayers : []"
          :marks="gameState.cricketMarks"
          :fields="store.cricketFields"
          :dead-fields="store.cricketDeadFields"
          :cut-throat="gameInfo?.cutThroat === true"
          :player-color="playerColor"
        />

        <!-- Main Score -->
        <div v-else class="flex-1 flex flex-col items-center justify-center -mt-10">
          <!-- Remaining Score -->
          <div class="relative">
            <!-- Glow effect -->
            <div
              class="absolute inset-0 blur-3xl opacity-40 transition-colors duration-700"
              :style="{ background: playerColor }"
            />

            <!-- Score Number -->
            <div
              class="relative text-[12rem] lg:text-[18rem] font-black leading-none tracking-tighter transition-all duration-300"
              :class="{
                'text-white': !isBusted,
                'text-red-500 animate-shake': isBusted,
                'scale-95 opacity-80': scoreAnimating,
              }"
              :style="{ textShadow: isBusted ? '0 0 80px rgba(239, 68, 68, 0.5)' : `0 0 100px ${playerColor}60` }"
            >
              {{ remainingScore }}
            </div>

            <!-- Bust Indicator -->
            <div
              v-if="isBusted"
              class="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-red-500 text-white font-bold text-xl uppercase tracking-widest animate-bounce"
            >
              {{ t('game.bust') }}
            </div>
          </div>

          <!-- Checkout Suggestion -->
          <div
            v-if="checkout && !checkout.isImpossible && checkout.path.length > 0"
            class="mt-8 px-8 py-4 rounded-2xl border transition-all duration-500"
            :class="checkout.dartsNeeded <= (3 - currentDarts.length) ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-white/5'"
          >
            <div class="flex items-center gap-4">
              <span class="text-white/50 text-sm uppercase tracking-wider">{{ t('score.checkout') }}</span>
              <div class="flex items-center gap-2">
                <span
                  v-for="(dart, i) in checkout.path"
                  :key="i"
                  class="text-2xl lg:text-3xl font-bold text-white"
                >
                  {{ dart }}
                  <span v-if="i < checkout.path.length - 1" class="text-white/30 mx-1">→</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Darts Thrown -->
        <div class="mt-auto">
          <!-- Three Dart Boxes -->
          <div
            class="grid grid-cols-3 gap-4 lg:gap-6 mx-auto mb-6"
            :class="isCricketGame ? 'max-w-md' : 'max-w-2xl'"
          >
            <div
              v-for="i in 3"
              :key="i"
              class="relative aspect-square rounded-2xl border-2 flex items-center justify-center transition-all duration-300"
              :class="{
                'border-white/30 bg-white/5': currentDarts[i-1],
                'border-white/10 bg-white/[0.02]': !currentDarts[i-1],
                'scale-110 border-white/60': dartAnimating === i-1,
              }"
            >
              <!-- Dart number indicator -->
              <span class="absolute top-2 left-3 text-xs text-white/30 font-medium">{{ i }}</span>

              <!-- Dart value -->
              <span
                class="text-3xl lg:text-5xl font-bold transition-all duration-300"
                :class="currentDarts[i-1] ? 'text-white' : 'text-white/20'"
              >
                {{ formatDart(currentDarts[i-1]) }}
              </span>

              <!-- Points -->
              <!-- X01 points only: in Cricket a dart counts by its marks -->
              <span
                v-if="currentDarts[i-1] && !isCricketGame"
                class="absolute bottom-2 right-3 text-sm text-white/50"
              >
                {{ currentDarts[i-1]?.points }}
              </span>
            </div>
          </div>

          <!-- Turn Score -->
          <div class="text-center mb-8">
            <div class="inline-flex items-center gap-4 px-8 py-3 rounded-full bg-white/5 border border-white/10">
              <span class="text-white/50 uppercase text-sm tracking-wider">{{ t('score.turn') }}</span>
              <span
                class="text-4xl lg:text-5xl font-bold text-white transition-all duration-300"
                :class="{ 'text-red-400': isBusted }"
              >
                {{ turnScore }}
              </span>
            </div>
          </div>

          <!-- Other Players Bar -->
          <div
            v-if="otherPlayers.length > 0 && !isCricketGame"
            class="flex items-center justify-center gap-4 py-4 border-t border-white/10"
          >
            <div
              v-for="player in otherPlayers"
              :key="player.index"
              class="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 transition-all hover:bg-white/10"
            >
              <!-- Color indicator -->
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: player.color }"
              />
              <!-- Name and score -->
              <span class="text-white/70 font-medium uppercase">{{ player.name }}</span>
              <span class="text-2xl font-bold text-white">{{ player.score }}</span>
              <!-- Legs won -->
              <span class="text-white/40 text-sm">
                ({{ player.legsWon }} {{ player.legsWon !== 1 ? t('score.legs') : t('score.leg') }})
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Animation Overlay (for non-win animations) -->
    <AnimationOverlay />

    <!-- Win Animation (for leg/set/match wins with enhanced display) -->
    <WinAnimation />
  </div>
</template>

<style scoped>
.game-display {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

@keyframes pulse-slow {
  0%, 100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.4; transform: translateX(-50%) scale(1.05); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.animate-pulse-slow {
  animation: pulse-slow 8s ease-in-out infinite;
}

.animate-float {
  animation: float 12s ease-in-out infinite;
}

.animate-shake {
  animation: shake 0.3s ease-in-out;
}

/* Ensure crisp text rendering */
.game-display * {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
