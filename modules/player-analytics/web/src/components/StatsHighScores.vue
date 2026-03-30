<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-6">
    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
      {{ t('stats.specialScores') }}
    </h3>

    <div v-if="store.statistics" class="grid grid-cols-2 gap-4">
      <!-- 180s -->
      <div class="stat-card bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-600/30">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-2xl">🎯</span>
          <span class="text-yellow-400 font-bold text-lg">{{ t('stats.count180s') }}</span>
        </div>
        <p class="text-4xl font-bold text-yellow-400">{{ store.statistics.count180s }}</p>
      </div>

      <!-- 140+ -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.count140Plus') }}</p>
        <p class="text-3xl font-bold text-orange-400">{{ store.statistics.count140Plus }}</p>
      </div>

      <!-- 100+ -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.count100Plus') }}</p>
        <p class="text-3xl font-bold text-blue-400">{{ store.statistics.count100Plus }}</p>
      </div>

      <!-- 60+ -->
      <div class="stat-card">
        <p class="text-gray-400 text-sm">{{ t('stats.count60Plus') }}</p>
        <p class="text-3xl font-bold text-gray-300">{{ store.statistics.count60Plus }}</p>
      </div>

      <!-- Visual Distribution -->
      <div class="col-span-2 mt-2">
        <div class="h-4 rounded-full overflow-hidden flex bg-gray-700">
          <div
            v-if="store.statistics.count180s > 0"
            class="bg-yellow-500"
            :style="{ width: `${(store.statistics.count180s / (store.statistics.count180s + store.statistics.count140Plus + store.statistics.count100Plus + store.statistics.count60Plus)) * 100}%` }"
            :title="`${t('stats.count180s')}: ${store.statistics.count180s}`"
          />
          <div
            v-if="store.statistics.count140Plus > 0"
            class="bg-orange-500"
            :style="{ width: `${(store.statistics.count140Plus / (store.statistics.count180s + store.statistics.count140Plus + store.statistics.count100Plus + store.statistics.count60Plus)) * 100}%` }"
            :title="`${t('stats.count140Plus')}: ${store.statistics.count140Plus}`"
          />
          <div
            v-if="store.statistics.count100Plus > 0"
            class="bg-blue-500"
            :style="{ width: `${(store.statistics.count100Plus / (store.statistics.count180s + store.statistics.count140Plus + store.statistics.count100Plus + store.statistics.count60Plus)) * 100}%` }"
            :title="`${t('stats.count100Plus')}: ${store.statistics.count100Plus}`"
          />
          <div
            v-if="store.statistics.count60Plus > 0"
            class="bg-gray-500"
            :style="{ width: `${(store.statistics.count60Plus / (store.statistics.count180s + store.statistics.count140Plus + store.statistics.count100Plus + store.statistics.count60Plus)) * 100}%` }"
            :title="`${t('stats.count60Plus')}: ${store.statistics.count60Plus}`"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>High scores distribution</span>
          <span>{{ store.statistics.count180s + store.statistics.count140Plus + store.statistics.count100Plus + store.statistics.count60Plus }} total</span>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      {{ t('common.loading') }}
    </div>
  </div>
</template>
