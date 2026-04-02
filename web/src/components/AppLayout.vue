<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app'
import StatusBadge from './StatusBadge.vue'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const isMobileMenuOpen = ref(false)

const navigation = computed(() => [
  { name: t('nav.dashboard'), path: '/', icon: 'dashboard' },
  { name: t('nav.modules'), path: '/modules', icon: 'modules' },
  { name: t('nav.players'), path: '/players', icon: 'players' },
  { name: t('nav.media'), path: '/media', icon: 'media' },
  { name: t('nav.logs'), path: '/logs', icon: 'logs' },
  { name: 'AI Provider', path: '/ai-settings', icon: 'ai' },
  { name: t('nav.settings'), path: '/settings', icon: 'settings' },
])

async function handleLogout() {
  await appStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-dark-900">
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-700 transform transition-transform duration-300 lg:translate-x-0',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b border-dark-700">
        <div class="w-10 h-10 rounded-lg bg-autodarts-600 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white">IO-Darts-Agent</h1>
          <p class="text-xs text-dark-400">v{{ appStore.version }}</p>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="px-6 py-4 border-b border-dark-700">
        <div class="flex items-center justify-between">
          <span class="text-sm text-dark-300">Autodarts</span>
          <StatusBadge :status="appStore.isConnected ? 'connected' : 'disconnected'" />
        </div>
      </div>

      <!-- Navigation -->
      <nav class="p-4 space-y-1">
        <router-link
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
            $route.path === item.path
              ? 'bg-autodarts-600/10 text-autodarts-400'
              : 'text-dark-300 hover:bg-dark-700 hover:text-white',
          ]"
          @click="isMobileMenuOpen = false"
        >
          <!-- Dashboard Icon -->
          <svg
            v-if="item.icon === 'dashboard'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <!-- Modules Icon -->
          <svg
            v-else-if="item.icon === 'modules'"
            class="w-5 h-5"
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
          <!-- Players Icon -->
          <svg
            v-else-if="item.icon === 'players'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <!-- Media Icon -->
          <svg
            v-else-if="item.icon === 'media'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <!-- Logs Icon -->
          <svg
            v-else-if="item.icon === 'logs'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <!-- AI Icon -->
          <svg
            v-else-if="item.icon === 'ai'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <!-- Settings Icon -->
          <svg
            v-else-if="item.icon === 'settings'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {{ item.name }}
        </router-link>
      </nav>

      <!-- User Section -->
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-700">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-autodarts-600 flex items-center justify-center">
              <span class="text-sm font-medium text-white">
                {{ appStore.username?.charAt(0).toUpperCase() || 'U' }}
              </span>
            </div>
            <span class="text-sm text-dark-200">{{ appStore.username || 'User' }}</span>
          </div>
          <button
            v-if="appStore.authRequired"
            @click="handleLogout"
            class="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            :title="t('nav.logout')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile Menu Overlay -->
    <div
      v-if="isMobileMenuOpen"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="isMobileMenuOpen = false"
    />

    <!-- Mobile Header -->
    <header class="lg:hidden fixed top-0 left-0 right-0 z-30 bg-dark-800 border-b border-dark-700">
      <div class="flex items-center justify-between px-4 py-3">
        <button
          @click="isMobileMenuOpen = true"
          class="p-2 rounded-lg text-dark-300 hover:bg-dark-700"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <span class="text-lg font-bold text-white">IO-Darts-Agent</span>
        <StatusBadge :status="appStore.isConnected ? 'connected' : 'disconnected'" />
      </div>
    </header>

    <!-- Main Content -->
    <main class="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
      <div class="p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
