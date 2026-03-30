<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'
import MediaUpload from './MediaUpload.vue'

const { t } = useI18n()

interface CallerEventConfig {
  enabled: boolean
  soundUrl?: string
  textTemplate?: string
  useCustomSound: boolean
}

const props = defineProps<{
  eventKey: string
  eventLabel: string
  eventDescription: string
  config: CallerEventConfig
}>()

const emit = defineEmits<{
  update: [config: CallerEventConfig]
}>()

// Local state
const isExpanded = ref(false)
const localConfig = ref<CallerEventConfig>({ ...props.config })

// Watch for prop changes
watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = { ...newConfig }
  },
  { deep: true }
)

// Computed
const isEnabled = computed({
  get: () => localConfig.value.enabled !== false,
  set: (value: boolean) => {
    localConfig.value.enabled = value
    emitUpdate()
  },
})

// Methods
function emitUpdate() {
  emit('update', { ...localConfig.value })
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function updateSoundUrl(url: string) {
  localConfig.value.soundUrl = url
  localConfig.value.useCustomSound = !!url
  emitUpdate()
}

function updateTextTemplate(template: string) {
  localConfig.value.textTemplate = template
  emitUpdate()
}

function testSound() {
  if (localConfig.value.soundUrl) {
    const audio = new Audio(localConfig.value.soundUrl)
    audio.volume = 0.5
    audio.play().catch(console.error)
  }
}
</script>

<template>
  <div
    class="rounded-lg border transition-all"
    :class="isEnabled
      ? 'border-autodarts-500/30 bg-autodarts-500/5'
      : 'border-dark-600 bg-dark-700/30 opacity-60'"
  >
    <!-- Header Row -->
    <div
      class="flex items-center justify-between p-4 cursor-pointer"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <!-- Enable Toggle -->
        <button
          type="button"
          @click.stop="isEnabled = !isEnabled"
          :class="[
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
            isEnabled ? 'bg-autodarts-600' : 'bg-dark-600',
          ]"
        >
          <span
            :class="[
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
              isEnabled ? 'translate-x-5' : 'translate-x-1',
            ]"
          />
        </button>

        <!-- Event Info -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-white font-medium truncate">{{ eventLabel }}</p>
            <span
              v-if="config.useCustomSound"
              class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex-shrink-0"
            >
              {{ t('caller.customSound') }}
            </span>
          </div>
          <p class="text-sm text-dark-400 truncate">{{ eventDescription }}</p>
        </div>
      </div>

      <!-- Expand Icon -->
      <svg
        :class="[
          'w-5 h-5 text-dark-400 transition-transform flex-shrink-0 ml-2',
          isExpanded ? 'rotate-180' : '',
        ]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Expanded Content -->
    <div
      v-if="isExpanded && isEnabled"
      class="px-4 pb-4 space-y-4 border-t border-dark-700"
    >
      <div class="pt-4 space-y-4">
        <!-- Custom Sound -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-dark-200">{{ t('caller.customSoundFile') }}</label>
            <BaseButton
              v-if="localConfig.soundUrl"
              variant="ghost"
              size="sm"
              @click.stop="testSound"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
              </svg>
              {{ t('common.test') }}
            </BaseButton>
          </div>
          <MediaUpload
            :model-value="localConfig.soundUrl || ''"
            :placeholder="t('caller.soundPlaceholder')"
            media-type="sound"
            accept="audio/mpeg,audio/wav,audio/ogg"
            @update:model-value="updateSoundUrl"
          />
          <p class="text-xs text-dark-500 mt-1">{{ t('caller.customSoundHint') }}</p>
        </div>

        <!-- Text Template (for TTS) -->
        <div>
          <label class="block text-sm font-medium text-dark-200 mb-2">
            {{ t('caller.textTemplate') }}
          </label>
          <input
            type="text"
            :value="localConfig.textTemplate"
            @input="updateTextTemplate(($event.target as HTMLInputElement).value)"
            :placeholder="t('caller.textTemplatePlaceholder')"
            class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-autodarts-500"
          />
          <p class="text-xs text-dark-500 mt-1">
            {{ t('caller.textTemplateHint') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
