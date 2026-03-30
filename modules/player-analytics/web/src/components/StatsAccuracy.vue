<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()

function getAccuracyColor(rate: number): string {
  if (rate >= 50) return 'text-green-400'
  if (rate >= 30) return 'text-yellow-400'
  return 'text-red-400'
}

function getProgressColor(rate: number): string {
  if (rate >= 50) return 'bg-green-500'
  if (rate >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-6">
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ t('stats.accuracy') }}
    </h3>

    <div v-if="store.statistics" class="space-y-4">
      <!-- Doubles Hit Rate -->
      <div>
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-400">{{ t('stats.doublesHitRate') }}</span>
          <span :class="getAccuracyColor(store.statistics.doublesHitRate)" class="font-medium">
            {{ store.statistics.doublesHitRate.toFixed(1) }}%
          </span>
        </div>
        <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full progress-bar"
            :class="getProgressColor(store.statistics.doublesHitRate)"
            :style="{ width: `${Math.min(store.statistics.doublesHitRate, 100)}%` }"
          />
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ store.statistics.doublesHit }} / {{ store.statistics.doublesAttempted }}
        </p>
      </div>

      <!-- Triples Hit Rate -->
      <div>
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-400">{{ t('stats.triplesHitRate') }}</span>
          <span :class="getAccuracyColor(store.statistics.triplesHitRate)" class="font-medium">
            {{ store.statistics.triplesHitRate.toFixed(1) }}%
          </span>
        </div>
        <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full progress-bar"
            :class="getProgressColor(store.statistics.triplesHitRate)"
            :style="{ width: `${Math.min(store.statistics.triplesHitRate, 100)}%` }"
          />
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ store.statistics.triplesHit }} / {{ store.statistics.triplesAttempted }}
        </p>
      </div>

      <!-- Checkout Rate -->
      <div>
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-400">{{ t('stats.checkoutRate') }}</span>
          <span :class="getAccuracyColor(store.statistics.checkoutRate)" class="font-medium">
            {{ store.statistics.checkoutRate.toFixed(1) }}%
          </span>
        </div>
        <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full progress-bar"
            :class="getProgressColor(store.statistics.checkoutRate)"
            :style="{ width: `${Math.min(store.statistics.checkoutRate, 100)}%` }"
          />
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ store.statistics.successfulCheckouts }} / {{ store.statistics.checkoutAttempts }}
        </p>
      </div>

      <!-- Hit Distribution -->
      <div class="mt-4 pt-4 border-t border-gray-700">
        <h4 class="text-sm font-medium text-gray-400 mb-3">Hit Distribution</h4>
        <div class="grid grid-cols-4 gap-2 text-center">
          <div class="bg-gray-700/50 rounded p-2">
            <p class="text-lg font-bold text-white">{{ store.statistics.singlesHit }}</p>
            <p class="text-xs text-gray-400">Singles</p>
          </div>
          <div class="bg-gray-700/50 rounded p-2">
            <p class="text-lg font-bold text-green-400">{{ store.statistics.doublesHit }}</p>
            <p class="text-xs text-gray-400">Doubles</p>
          </div>
          <div class="bg-gray-700/50 rounded p-2">
            <p class="text-lg font-bold text-red-400">{{ store.statistics.triplesHit }}</p>
            <p class="text-xs text-gray-400">Triples</p>
          </div>
          <div class="bg-gray-700/50 rounded p-2">
            <p class="text-lg font-bold text-yellow-400">{{ store.statistics.bullsHit }}</p>
            <p class="text-xs text-gray-400">Bulls</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
