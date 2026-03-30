<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-6">
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {{ t('stats.scoring') }}
    </h3>

    <div v-if="store.statistics" class="space-y-4">
      <!-- 3-Dart Average - Featured -->
      <div class="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg p-4 border border-yellow-600/30">
        <p class="text-yellow-400 text-sm font-medium">{{ t('stats.averagePerTurn') }}</p>
        <p class="text-4xl font-bold text-white mt-1">
          {{ store.statistics.averagePerTurn.toFixed(2) }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ t('stats.averagePerDart') }}: {{ store.statistics.averagePerDart.toFixed(2) }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Highest Turn -->
        <div class="stat-card">
          <p class="text-gray-400 text-sm">{{ t('stats.highestTurn') }}</p>
          <p class="text-2xl font-bold" :class="store.statistics.highestTurnScore === 180 ? 'text-yellow-400' : 'text-white'">
            {{ store.statistics.highestTurnScore }}
          </p>
        </div>

        <!-- Highest Checkout -->
        <div class="stat-card">
          <p class="text-gray-400 text-sm">{{ t('stats.highestCheckout') }}</p>
          <p class="text-2xl font-bold" :class="store.statistics.highestCheckout >= 100 ? 'text-green-400' : 'text-white'">
            {{ store.statistics.highestCheckout }}
          </p>
        </div>

        <!-- Fastest Leg -->
        <div class="stat-card">
          <p class="text-gray-400 text-sm">{{ t('stats.fastestLeg') }}</p>
          <p class="text-2xl font-bold text-white">
            {{ store.statistics.fastestLeg || '-' }}
          </p>
          <p class="text-xs text-gray-400">{{ t('stats.darts') }}</p>
        </div>

        <!-- Avg Darts Per Leg -->
        <div class="stat-card">
          <p class="text-gray-400 text-sm">{{ t('stats.avgDartsPerLeg') }}</p>
          <p class="text-2xl font-bold text-white">
            {{ store.statistics.averageDartsPerLeg ? store.statistics.averageDartsPerLeg.toFixed(1) : '-' }}
          </p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
