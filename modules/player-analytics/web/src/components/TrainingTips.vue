<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyticsStore } from '../stores/analytics'
import type { TipCategory } from '../types/api'

const { t } = useI18n()
const store = useAnalyticsStore()

const selectedFocusArea = ref<TipCategory | undefined>(undefined)

const tipCategories: TipCategory[] = [
  'doubles',
  'triples',
  'checkout',
  'consistency',
  'high-scoring',
  'mental',
  'technique',
  'segment-focus',
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

function getCategoryIcon(category: TipCategory): string {
  const icons: Record<TipCategory, string> = {
    doubles: '🎯',
    triples: '🔥',
    checkout: '✅',
    consistency: '📊',
    'high-scoring': '⚡',
    mental: '🧠',
    technique: '🎓',
    'segment-focus': '🔍',
  }
  return icons[category] || '💡'
}

async function handleGenerateTips(): Promise<void> {
  await store.generateTips(selectedFocusArea.value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Generate Button -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <h3 class="text-xl font-semibold flex items-center gap-2">
          <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {{ t('tips.title') }}
        </h3>

        <div class="flex items-center gap-3">
          <!-- Focus Area Select -->
          <select
            v-model="selectedFocusArea"
            class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            :disabled="!store.isAIEnabled"
          >
            <option :value="undefined">{{ t('tips.all') }}</option>
            <option v-for="category in tipCategories" :key="category" :value="category">
              {{ getCategoryIcon(category) }} {{ t(`tips.categories.${category}`) }}
            </option>
          </select>

          <!-- Generate Button -->
          <button
            @click="handleGenerateTips"
            :disabled="store.isGeneratingTips || !store.isAIEnabled"
            class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg
              v-if="store.isGeneratingTips"
              class="w-4 h-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ store.isGeneratingTips ? t('tips.generating') : t('tips.generate') }}
          </button>
        </div>
      </div>

      <!-- AI Disabled Warning -->
      <div v-if="!store.isAIEnabled" class="mt-4 bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="font-medium text-yellow-400">{{ t('tips.aiDisabled') }}</p>
            <p class="text-sm text-gray-400 mt-1">{{ t('tips.enableAI') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tips List -->
    <div v-if="store.tips.length > 0" class="space-y-4">
      <div
        v-for="tip in store.tips"
        :key="tip.id"
        class="tip-card"
        :class="tip.priority"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <!-- Header -->
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">{{ getCategoryIcon(tip.category) }}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="{
                  'bg-red-500/20 text-red-400': tip.priority === 'high',
                  'bg-yellow-500/20 text-yellow-400': tip.priority === 'medium',
                  'bg-green-500/20 text-green-400': tip.priority === 'low',
                }"
              >
                {{ t(`tips.priority.${tip.priority}`) }}
              </span>
              <span class="text-xs text-gray-500">
                {{ t(`tips.categories.${tip.category}`) }}
              </span>
            </div>

            <!-- Title -->
            <h4 class="font-semibold text-lg mb-2">{{ tip.title }}</h4>

            <!-- Description -->
            <p class="text-gray-300 mb-3">{{ tip.description }}</p>

            <!-- Practice Exercise -->
            <div v-if="tip.practiceExercise" class="bg-gray-700/50 rounded-lg p-3 mb-3">
              <p class="text-xs text-purple-400 font-medium mb-1">
                {{ t('tips.practiceExercise') }}
              </p>
              <p class="text-sm text-gray-300">{{ tip.practiceExercise }}</p>
            </div>

            <!-- Based On -->
            <p class="text-xs text-gray-500">
              {{ t('tips.basedOn') }}: {{ tip.basedOnData }}
            </p>
            <p class="text-xs text-gray-600 mt-1">
              {{ formatDate(tip.generatedAt) }}
            </p>
          </div>

          <!-- Acknowledge Button -->
          <button
            v-if="!tip.acknowledged"
            @click="store.acknowledgeTip(tip.id)"
            class="shrink-0 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            {{ t('tips.acknowledge') }}
          </button>
          <span v-else class="shrink-0 text-green-400 text-sm">
            ✓
          </span>
        </div>
      </div>
    </div>

    <!-- No Tips -->
    <div v-else class="bg-gray-800 rounded-lg p-8 text-center">
      <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p class="text-gray-400 text-lg">{{ t('tips.noTips') }}</p>
      <p class="text-gray-500 text-sm mt-1">{{ t('tips.noTipsDescription') }}</p>
    </div>
  </div>
</template>
