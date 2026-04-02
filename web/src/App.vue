<script setup lang="ts">
import { useAppStore } from './stores/app'
import { useI18n } from 'vue-i18n'

const appStore = useAppStore()
const { t } = useI18n()
</script>

<template>
  <!-- Loading State -->
  <div
    v-if="appStore.isLoading"
    class="min-h-screen bg-dark-900 flex items-center justify-center"
  >
    <div class="text-center">
      <svg
        class="animate-spin h-12 w-12 text-autodarts-500 mx-auto"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="text-dark-400 mt-4">{{ t('common.loading') }}</p>
    </div>
  </div>

  <!-- Router View -->
  <router-view v-else />
</template>
