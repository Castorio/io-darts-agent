<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from './stores/analytics'
import PlayerList from './components/PlayerList.vue'
import PlayerDashboard from './components/PlayerDashboard.vue'

const { t } = useI18n()
const store = useAnalyticsStore()
const activeTab = ref<'dashboard' | 'tips'>('dashboard')

onMounted(async () => {
  await store.fetchConfig()
  await store.fetchPlayers()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <a
              href="/"
              class="text-gray-400 hover:text-white transition-colors"
              :title="t('common.backToHub')"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <h1 class="text-2xl font-bold text-green-400">
              {{ t('title') }}
            </h1>
          </div>

          <!-- Tab Navigation -->
          <nav class="flex gap-2">
            <button
              @click="activeTab = 'dashboard'"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                activeTab === 'dashboard'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              ]"
            >
              {{ t('nav.dashboard') }}
            </button>
            <button
              @click="activeTab = 'tips'"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors relative',
                activeTab === 'tips'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              ]"
            >
              {{ t('nav.tips') }}
              <span
                v-if="store.activeTips.length > 0"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
              >
                {{ store.activeTips.length }}
              </span>
            </button>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid grid-cols-12 gap-6">
        <!-- Sidebar: Player List -->
        <aside class="col-span-12 md:col-span-3">
          <PlayerList />
        </aside>

        <!-- Main: Dashboard or Tips -->
        <div class="col-span-12 md:col-span-9">
          <PlayerDashboard :active-tab="activeTab" />
        </div>
      </div>
    </main>
  </div>
</template>
