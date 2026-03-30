<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getMatchResult(match: typeof store.recentMatches[0]): 'won' | 'lost' | 'aborted' {
  if (match.isAborted) return 'aborted'
  if (match.winnerId === store.selectedPlayerId) return 'won'
  return 'lost'
}

function getOpponentName(match: typeof store.recentMatches[0]): string {
  const opponents = match.players.filter(p => p.playerId !== store.selectedPlayerId)
  if (opponents.length === 0) return 'Solo'
  return opponents.map(p => p.playerName).join(', ')
}
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ t('matches.title') }}
      </h3>
    </div>

    <div v-if="store.recentMatches.length > 0" class="space-y-2">
      <div
        v-for="match in store.recentMatches"
        :key="match.id"
        class="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4"
      >
        <!-- Result Badge -->
        <div
          class="w-16 h-16 rounded-lg flex items-center justify-center text-sm font-bold"
          :class="{
            'bg-green-600/20 text-green-400': getMatchResult(match) === 'won',
            'bg-red-600/20 text-red-400': getMatchResult(match) === 'lost',
            'bg-gray-600/20 text-gray-400': getMatchResult(match) === 'aborted',
          }"
        >
          {{ t(`matches.${getMatchResult(match)}`) }}
        </div>

        <!-- Match Info -->
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ store.selectedPlayer?.name }}</span>
            <span class="text-gray-500">{{ t('matches.vs') }}</span>
            <span class="font-medium text-gray-300">{{ getOpponentName(match) }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm text-gray-400 mt-1">
            <span>{{ match.gameType }} {{ match.startingScore }}</span>
            <span>•</span>
            <span>{{ formatDate(match.timestamp) }}</span>
          </div>
        </div>

        <!-- Arrow -->
        <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      {{ t('common.noData') }}
    </div>
  </div>
</template>
