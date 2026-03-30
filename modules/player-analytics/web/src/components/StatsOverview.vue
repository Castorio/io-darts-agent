<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-6">
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      {{ t('stats.overview') }}
    </h3>

    <div v-if="store.statistics" class="grid grid-cols-2 gap-4">
      <!-- Total Matches -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.totalMatches') }}</p>
        <p class="text-2xl font-bold text-white">{{ store.statistics.totalMatches }}</p>
        <p class="text-xs text-green-400">{{ store.statistics.matchesWon }} {{ t('matches.won') }}</p>
      </div>

      <!-- Total Legs -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.totalLegs') }}</p>
        <p class="text-2xl font-bold text-white">{{ store.statistics.totalLegs }}</p>
        <p class="text-xs text-green-400">{{ store.statistics.legsWon }} {{ t('matches.won') }}</p>
      </div>

      <!-- Total Darts -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.totalDarts') }}</p>
        <p class="text-2xl font-bold text-white">{{ store.statistics.totalDartsThrown.toLocaleString() }}</p>
      </div>

      <!-- Total Games -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.totalGames') }}</p>
        <p class="text-2xl font-bold text-white">{{ store.statistics.totalGames }}</p>
        <p class="text-xs text-green-400">{{ store.statistics.gamesWon }} {{ t('matches.won') }}</p>
      </div>

      <!-- Win Rates -->
      <div class="col-span-2 mt-2">
        <h4 class="text-sm font-medium text-gray-400 mb-3">{{ t('stats.winRates') }}</h4>

        <!-- Match Win Rate -->
        <div class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span>{{ t('stats.matchWinRate') }}</span>
            <span class="font-medium">{{ store.statistics.matchWinRate.toFixed(1) }}%</span>
          </div>
          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-green-500 progress-bar"
              :style="{ width: `${store.statistics.matchWinRate}%` }"
            />
          </div>
        </div>

        <!-- Leg Win Rate -->
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span>{{ t('stats.legWinRate') }}</span>
            <span class="font-medium">{{ store.statistics.legWinRate.toFixed(1) }}%</span>
          </div>
          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-emerald-500 progress-bar"
              :style="{ width: `${store.statistics.legWinRate}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
