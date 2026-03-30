<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'

const { t } = useI18n()
const store = useAnalyticsStore()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div class="bg-gray-800 rounded-lg p-4">
    <h2 class="text-lg font-semibold mb-4">{{ t('nav.players') }}</h2>

    <!-- Loading State -->
    <div v-if="store.isLoading" class="text-center py-8">
      <div class="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto" />
      <p class="text-gray-400 mt-2">{{ t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="store.error" class="text-center py-8">
      <p class="text-red-400">{{ store.error }}</p>
      <button
        @click="store.fetchPlayers()"
        class="mt-2 text-green-400 hover:underline"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- No Players -->
    <div v-else-if="store.players.length === 0" class="text-center py-8">
      <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p class="text-gray-400">{{ t('dashboard.noPlayers') }}</p>
      <p class="text-gray-500 text-sm mt-1">{{ t('dashboard.noPlayersDescription') }}</p>
    </div>

    <!-- Player List -->
    <div v-else class="space-y-2">
      <button
        v-for="player in store.players"
        :key="player.id"
        @click="store.selectPlayer(player.id)"
        :class="[
          'w-full text-left px-4 py-3 rounded-lg transition-colors',
          store.selectedPlayerId === player.id
            ? 'bg-green-600/20 border border-green-600'
            : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
        ]"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center font-bold text-lg">
            {{ player.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ player.name }}</p>
            <p class="text-xs text-gray-400">
              {{ t('player.since') }} {{ formatDate(player.createdAt) }}
            </p>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
