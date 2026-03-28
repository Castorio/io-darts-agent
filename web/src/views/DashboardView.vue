<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useAppStore } from '../stores/app'
import { useModulesStore } from '../stores/modules'
import { useEventsStore } from '../stores/events'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import StatusBadge from '../components/StatusBadge.vue'

const appStore = useAppStore()
const modulesStore = useModulesStore()
const eventsStore = useEventsStore()

// Computed
const uptime = computed(() => {
  const seconds = appStore.hubStatus?.uptime || 0
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
})

const isConnected = computed(() => appStore.hubStatus?.autodarts.connected ?? false)

// Actions
async function connectAutodarts() {
  try {
    await api.connectAutodarts()
    await appStore.refreshStatus()
  } catch (e) {
    console.error('Failed to connect:', e)
  }
}

async function disconnectAutodarts() {
  try {
    await api.disconnectAutodarts()
    await appStore.refreshStatus()
  } catch (e) {
    console.error('Failed to disconnect:', e)
  }
}

// Lifecycle
onMounted(async () => {
  await appStore.refreshStatus()
  await modulesStore.fetchModules()
  eventsStore.connect()

  // Auto-refresh status every 30 seconds
  const interval = setInterval(() => {
    appStore.refreshStatus()
  }, 30000)

  onUnmounted(() => {
    clearInterval(interval)
    eventsStore.disconnect()
  })
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Dashboard</h1>
          <p class="text-dark-400">Übersicht über Ihren IO-Darts-Agent</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Autodarts Status -->
        <BaseCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-dark-400">Autodarts</p>
              <StatusBadge
                :status="isConnected ? 'connected' : 'disconnected'"
                class="mt-1"
              />
            </div>
            <div
              :class="[
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isConnected ? 'bg-green-500/10' : 'bg-dark-700',
              ]"
            >
              <svg
                :class="['w-6 h-6', isConnected ? 'text-green-400' : 'text-dark-400']"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
          </div>
        </BaseCard>

        <!-- Running Modules -->
        <BaseCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-dark-400">Aktive Module</p>
              <p class="text-2xl font-bold text-white mt-1">
                {{ modulesStore.runningCount }}
                <span class="text-sm font-normal text-dark-400">
                  / {{ modulesStore.moduleCount }}
                </span>
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-autodarts-600/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-autodarts-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
          </div>
        </BaseCard>

        <!-- Uptime -->
        <BaseCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-dark-400">Laufzeit</p>
              <p class="text-2xl font-bold text-white mt-1">{{ uptime }}</p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </BaseCard>

        <!-- Events -->
        <BaseCard>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-dark-400">Events heute</p>
              <p class="text-2xl font-bold text-white mt-1">
                {{ eventsStore.eventLog.length }}
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Connection Control -->
        <BaseCard title="Autodarts Verbindung" subtitle="Steuern Sie die Verbindung zum Board">
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'w-3 h-3 rounded-full',
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-dark-500',
                  ]"
                />
                <div>
                  <p class="text-white font-medium">
                    {{ isConnected ? 'Verbunden' : 'Nicht verbunden' }}
                  </p>
                  <p class="text-sm text-dark-400">
                    Board: {{ appStore.hubStatus?.autodarts.boardId?.slice(0, 8) || 'N/A' }}...
                  </p>
                </div>
              </div>
              <BaseButton
                v-if="isConnected"
                variant="danger"
                size="sm"
                @click="disconnectAutodarts"
              >
                Trennen
              </BaseButton>
              <BaseButton
                v-else
                size="sm"
                @click="connectAutodarts"
              >
                Verbinden
              </BaseButton>
            </div>

            <!-- Match Info -->
            <div v-if="eventsStore.currentMatchId" class="p-4 rounded-lg bg-autodarts-600/10 border border-autodarts-600/30">
              <p class="text-sm text-autodarts-400 font-medium">Aktives Match</p>
              <p class="text-white font-mono text-sm mt-1">
                {{ eventsStore.currentMatchId }}
              </p>
            </div>
          </div>
        </BaseCard>

        <!-- Active Modules -->
        <BaseCard title="Module" subtitle="Status Ihrer installierten Module">
          <div v-if="modulesStore.modules.length === 0" class="text-center py-8">
            <svg
              class="w-12 h-12 mx-auto text-dark-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p class="text-dark-400 mt-3">Keine Module installiert</p>
            <router-link
              to="/modules/install"
              class="inline-block mt-4 text-autodarts-400 hover:text-autodarts-300 text-sm"
            >
              Modul installieren →
            </router-link>
          </div>

          <div v-else class="space-y-2">
            <router-link
              v-for="module in modulesStore.modules.slice(0, 5)"
              :key="module.id"
              :to="`/modules/${module.id}`"
              class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    module.status === 'running' ? 'bg-green-500/20' : 'bg-dark-600',
                  ]"
                >
                  <svg
                    :class="[
                      'w-4 h-4',
                      module.status === 'running' ? 'text-green-400' : 'text-dark-400',
                    ]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-white font-medium">{{ module.name }}</p>
                  <p class="text-xs text-dark-400">v{{ module.version }}</p>
                </div>
              </div>
              <StatusBadge :status="module.status" />
            </router-link>

            <router-link
              v-if="modulesStore.modules.length > 5"
              to="/modules"
              class="block text-center text-sm text-autodarts-400 hover:text-autodarts-300 mt-4"
            >
              Alle {{ modulesStore.modules.length }} Module anzeigen →
            </router-link>
          </div>
        </BaseCard>
      </div>

      <!-- Recent Events -->
      <BaseCard title="Letzte Events" subtitle="Live-Events von Autodarts">
        <div v-if="eventsStore.recentEvents.length === 0" class="text-center py-8">
          <svg
            class="w-12 h-12 mx-auto text-dark-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p class="text-dark-400 mt-3">
            {{ isConnected ? 'Warte auf Events...' : 'Nicht verbunden' }}
          </p>
        </div>

        <div v-else class="space-y-2 max-h-64 overflow-y-auto">
          <div
            v-for="event in [...eventsStore.recentEvents].reverse()"
            :key="event.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50"
          >
            <div class="w-2 h-2 rounded-full bg-autodarts-500" />
            <div class="flex-1 min-w-0">
              <p class="text-white font-mono text-sm truncate">{{ event.type }}</p>
              <p class="text-xs text-dark-400">
                {{ new Date(event.timestamp).toLocaleTimeString('de-DE') }}
              </p>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-between">
            <span
              :class="[
                'flex items-center gap-2 text-sm',
                eventsStore.isConnected ? 'text-green-400' : 'text-dark-400',
              ]"
            >
              <span
                :class="[
                  'w-2 h-2 rounded-full',
                  eventsStore.isConnected ? 'bg-green-500 animate-pulse' : 'bg-dark-500',
                ]"
              />
              {{ eventsStore.isConnected ? 'Live' : 'Offline' }}
            </span>
            <button
              @click="eventsStore.clearLog"
              class="text-sm text-dark-400 hover:text-white transition-colors"
            >
              Log leeren
            </button>
          </div>
        </template>
      </BaseCard>
    </div>
  </AppLayout>
</template>
