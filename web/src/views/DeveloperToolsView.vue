<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()

interface MatchState {
  matchId: string
  players: Array<{ id: string; name: string; index: number; color?: string }>
  currentPlayerIndex: number
  scores: number[]
  gameScores: number[]
  round: number
  leg: number
  set: number
  turnScore: number
  turnBusted: boolean
}

interface Scenario {
  id: string
  name: string
  description: string
}

const isLoading = ref(true)
const isEnabled = ref(false)
const matchActive = ref(false)
const matchState = ref<MatchState | null>(null)
const scenarios = ref<Scenario[]>([])
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Quick throw buttons
const throwButtons = [
  { label: 'S20', number: 20, multiplier: 1 as const },
  { label: 'D20', number: 20, multiplier: 2 as const },
  { label: 'T20', number: 20, multiplier: 3 as const },
  { label: 'S19', number: 19, multiplier: 1 as const },
  { label: 'D19', number: 19, multiplier: 2 as const },
  { label: 'T19', number: 19, multiplier: 3 as const },
  { label: 'Bull', number: 25, multiplier: 1 as const },
  { label: 'D-Bull', number: 25, multiplier: 2 as const },
  { label: 'Miss', number: 0, multiplier: 1 as const },
]

// Custom throw
const customNumber = ref(20)
const customMultiplier = ref<1 | 2 | 3>(1)

// New match players
const player1Name = ref('Player 1')
const player1Color = ref('#3b82f6')
const player2Name = ref('Player 2')
const player2Color = ref('#ef4444')
const startScore = ref(501)

const currentPlayer = computed(() => {
  if (!matchState.value) return null
  return matchState.value.players[matchState.value.currentPlayerIndex]
})

async function loadStatus() {
  isLoading.value = true
  try {
    const status = await api.getDeveloperStatus()
    isEnabled.value = status.enabled
    matchActive.value = status.matchActive
    matchState.value = status.matchState || null

    if (isEnabled.value) {
      const scenarioResult = await api.getScenarios()
      scenarios.value = scenarioResult.scenarios
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Error loading status',
    }
  } finally {
    isLoading.value = false
  }
}

async function startMatch() {
  try {
    message.value = null
    const result = await api.simulateMatchStart(
      [
        { name: player1Name.value, color: player1Color.value },
        { name: player2Name.value, color: player2Color.value },
      ],
      startScore.value
    )
    if (result.success) {
      message.value = { type: 'success', text: t('dev.matchStarted', { player1: player1Name.value, player2: player2Name.value }) }
      await loadStatus()
    } else {
      message.value = { type: 'error', text: result.error || t('dev.matchStartFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: e instanceof Error ? e.message : t('dev.matchStartFailed') }
  }
}

async function endMatch(cancelled = false) {
  try {
    message.value = null
    const result = await api.simulateMatchEnd(undefined, cancelled)
    if (result.success) {
      message.value = { type: 'success', text: cancelled ? t('dev.matchCancelled') : t('dev.matchFinished') }
      await loadStatus()
    } else {
      message.value = { type: 'error', text: result.error || t('dev.matchEndFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: e instanceof Error ? e.message : t('dev.matchEndFailed') }
  }
}

async function simulateThrow(number: number, multiplier: 1 | 2 | 3) {
  try {
    message.value = null
    const result = await api.simulateThrow(number, multiplier)
    if (result.success) {
      message.value = {
        type: 'success',
        text: t('dev.throwResult', { points: result.points, remaining: result.remaining }),
      }
      await loadStatus()
    } else {
      message.value = { type: 'error', text: result.error || t('dev.throwFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: e instanceof Error ? e.message : t('dev.throwFailed') }
  }
}

async function endTurn() {
  try {
    message.value = null
    const result = await api.simulateTurnEnd()
    if (result.success) {
      message.value = { type: 'success', text: t('dev.turnEnded', { player: result.nextPlayer }) }
      await loadStatus()
    } else {
      message.value = { type: 'error', text: result.error || t('dev.turnEndFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: e instanceof Error ? e.message : t('dev.turnEndFailed') }
  }
}

async function runScenario(id: string) {
  try {
    message.value = null
    const result = await api.runScenario(id)
    if (result.success) {
      message.value = { type: 'success', text: t('dev.scenarioExecuted', { name: id }) }
      await loadStatus()
    } else {
      message.value = { type: 'error', text: result.error || t('dev.scenarioFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: e instanceof Error ? e.message : t('dev.scenarioFailed') }
  }
}

onMounted(loadStatus)
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-4xl">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white">{{ t('developer.title') }}</h1>
        <p class="text-dark-400">{{ t('developer.subtitle') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <!-- Not Enabled -->
      <div v-else-if="!isEnabled" class="p-8 rounded-xl bg-dark-800/50 border border-dark-700 text-center">
        <svg class="w-16 h-16 mx-auto text-dark-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 class="text-lg font-medium text-white mb-2">{{ t('developer.notEnabled') }}</h3>
        <p class="text-dark-400 mb-4">{{ t('developer.enableInSettings') }}</p>
        <router-link to="/settings" class="text-autodarts-400 hover:text-autodarts-300 underline">
          {{ t('developer.goToSettings') }}
        </router-link>
      </div>

      <!-- Developer Tools Content -->
      <template v-else>
        <!-- Message -->
        <div
          v-if="message"
          :class="[
            'p-4 rounded-lg',
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400',
          ]"
        >
          {{ message.text }}
        </div>

        <!-- Match Status -->
        <BaseCard :title="t('developer.matchStatus')">
          <div v-if="matchActive && matchState" class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="p-3 rounded-lg bg-dark-700/50">
                <p class="text-xs text-dark-400 mb-1">{{ t('dev.matchId') }}</p>
                <p class="text-white font-mono text-sm truncate">{{ matchState.matchId }}</p>
              </div>
              <div class="p-3 rounded-lg bg-dark-700/50">
                <p class="text-xs text-dark-400 mb-1">{{ t('developer.round') }}</p>
                <p class="text-white font-medium">{{ matchState.round }}</p>
              </div>
              <div class="p-3 rounded-lg bg-dark-700/50">
                <p class="text-xs text-dark-400 mb-1">{{ t('developer.turnScore') }}</p>
                <p class="text-white font-medium">{{ matchState.turnScore }}</p>
              </div>
              <div class="p-3 rounded-lg bg-dark-700/50">
                <p class="text-xs text-dark-400 mb-1">{{ t('developer.currentPlayer') }}</p>
                <p class="text-white font-medium">{{ currentPlayer?.name }}</p>
              </div>
            </div>

            <!-- Players -->
            <div class="flex gap-4">
              <div
                v-for="(player, idx) in matchState.players"
                :key="player.id"
                :class="[
                  'flex-1 p-4 rounded-lg border-2 transition-all',
                  idx === matchState.currentPlayerIndex
                    ? 'bg-autodarts-600/20 border-autodarts-500'
                    : 'bg-dark-700/50 border-dark-600',
                ]"
              >
                <div class="flex items-center gap-3 mb-2">
                  <div
                    class="w-4 h-4 rounded-full"
                    :style="{ backgroundColor: player.color || '#666' }"
                  />
                  <span class="font-medium text-white">{{ player.name }}</span>
                  <span v-if="idx === matchState.currentPlayerIndex" class="ml-auto text-xs text-autodarts-400">
                    {{ t('developer.active') }}
                  </span>
                </div>
                <div class="text-3xl font-bold text-white">{{ matchState.scores[idx] }}</div>
                <div class="text-sm text-dark-400">{{ t('dev.legs') }}: {{ matchState.gameScores[idx] }}</div>
              </div>
            </div>

            <!-- Match Actions -->
            <div class="flex gap-3">
              <BaseButton variant="secondary" @click="endMatch(false)">
                {{ t('developer.finishMatch') }}
              </BaseButton>
              <BaseButton variant="ghost" @click="endMatch(true)">
                {{ t('developer.cancelMatch') }}
              </BaseButton>
            </div>
          </div>

          <!-- No Match Active -->
          <div v-else class="text-center py-8">
            <p class="text-dark-400 mb-4">{{ t('developer.noActiveMatch') }}</p>

            <!-- New Match Form -->
            <div class="max-w-md mx-auto space-y-4 text-left">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-dark-300 mb-1">{{ t('developer.player1') }}</label>
                  <input
                    v-model="player1Name"
                    class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm text-dark-300 mb-1">{{ t('developer.color') }}</label>
                  <input
                    v-model="player1Color"
                    type="color"
                    class="w-full h-10 rounded-lg bg-dark-700 border border-dark-600 cursor-pointer"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-dark-300 mb-1">{{ t('developer.player2') }}</label>
                  <input
                    v-model="player2Name"
                    class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm text-dark-300 mb-1">{{ t('developer.color') }}</label>
                  <input
                    v-model="player2Color"
                    type="color"
                    class="w-full h-10 rounded-lg bg-dark-700 border border-dark-600 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm text-dark-300 mb-1">{{ t('developer.startScore') }}</label>
                <select
                  v-model="startScore"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white"
                >
                  <option :value="301">301</option>
                  <option :value="501">501</option>
                  <option :value="701">701</option>
                </select>
              </div>
              <BaseButton @click="startMatch" class="w-full">
                {{ t('developer.startMatch') }}
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Throw Simulator -->
        <BaseCard v-if="matchActive" :title="t('developer.throwSimulator')">
          <div class="space-y-4">
            <!-- Quick Throw Buttons -->
            <div class="grid grid-cols-3 md:grid-cols-9 gap-2">
              <button
                v-for="btn in throwButtons"
                :key="btn.label"
                @click="simulateThrow(btn.number, btn.multiplier)"
                :class="[
                  'px-3 py-2 rounded-lg font-medium text-sm transition-all',
                  btn.multiplier === 3
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : btn.multiplier === 2
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-dark-600 hover:bg-dark-500 text-white',
                ]"
              >
                {{ btn.label }}
              </button>
            </div>

            <!-- Custom Throw -->
            <div class="flex items-end gap-3">
              <div class="flex-1">
                <label class="block text-sm text-dark-300 mb-1">{{ t('developer.number') }}</label>
                <input
                  v-model.number="customNumber"
                  type="number"
                  min="0"
                  max="25"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white"
                />
              </div>
              <div class="flex-1">
                <label class="block text-sm text-dark-300 mb-1">{{ t('developer.multiplier') }}</label>
                <select
                  v-model.number="customMultiplier"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white"
                >
                  <option :value="1">{{ t('dev.single') }}</option>
                  <option :value="2">{{ t('dev.double') }}</option>
                  <option :value="3">{{ t('dev.triple') }}</option>
                </select>
              </div>
              <BaseButton @click="simulateThrow(customNumber, customMultiplier)">
                {{ t('developer.throw') }}
              </BaseButton>
            </div>

            <!-- End Turn -->
            <div class="pt-4 border-t border-dark-700">
              <BaseButton variant="secondary" @click="endTurn" class="w-full">
                {{ t('developer.endTurn') }}
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Scenarios -->
        <BaseCard :title="t('developer.scenarios')" :subtitle="t('developer.scenariosSubtitle')">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              v-for="scenario in scenarios"
              :key="scenario.id"
              @click="runScenario(scenario.id)"
              class="p-4 rounded-lg bg-dark-700/50 border border-dark-600 hover:border-autodarts-500 hover:bg-dark-700 transition-all text-left"
            >
              <p class="font-medium text-white mb-1">{{ scenario.name }}</p>
              <p class="text-sm text-dark-400">{{ scenario.description }}</p>
            </button>
          </div>
        </BaseCard>
      </template>
    </div>
  </AppLayout>
</template>
