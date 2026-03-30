<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'
import StatsOverview from './StatsOverview.vue'
import StatsScoring from './StatsScoring.vue'
import StatsAccuracy from './StatsAccuracy.vue'
import StatsHighScores from './StatsHighScores.vue'
import TrainingTips from './TrainingTips.vue'
import RecentMatches from './RecentMatches.vue'

defineProps<{
  activeTab: 'dashboard' | 'tips'
}>()

const { t } = useI18n()
const store = useAnalyticsStore()
</script>

<template>
  <!-- No Player Selected -->
  <div v-if="!store.selectedPlayer" class="bg-gray-800 rounded-lg p-8 text-center">
    <svg class="w-20 h-20 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
    <h2 class="text-xl font-semibold text-gray-400 mb-2">{{ t('dashboard.title') }}</h2>
    <p class="text-gray-500">{{ t('dashboard.selectPlayer') }}</p>
  </div>

  <!-- Player Dashboard -->
  <div v-else class="space-y-6">
    <!-- Player Header -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-3xl">
          {{ store.selectedPlayer.name.charAt(0).toUpperCase() }}
        </div>
        <div>
          <h2 class="text-2xl font-bold">{{ store.selectedPlayer.name }}</h2>
          <p class="text-gray-400 text-sm" v-if="store.statistics">
            {{ t('stats.totalMatches') }}: {{ store.statistics.totalMatches }} |
            {{ t('stats.averagePerTurn') }}: {{ store.statistics.averagePerTurn.toFixed(1) }}
          </p>
        </div>
        <button
          @click="store.refreshStatistics()"
          class="ml-auto p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
          title="Refresh statistics"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Dashboard Tab -->
    <template v-if="activeTab === 'dashboard'">
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatsOverview />
        <StatsScoring />
        <StatsAccuracy />
        <StatsHighScores />
      </div>

      <!-- Recent Matches -->
      <RecentMatches />
    </template>

    <!-- Tips Tab -->
    <template v-else-if="activeTab === 'tips'">
      <TrainingTips />
    </template>
  </div>
</template>
