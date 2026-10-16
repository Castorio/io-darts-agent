<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { previewKind } from '../lib/mediaPreview'

const props = defineProps<{
  name: string
  url: string
  mimeType: string
  hasPrevious: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'copy'): void
  (e: 'delete'): void
}>()

const { t } = useI18n()

const kind = computed(() => previewKind(props.mimeType, props.name))

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowLeft' && props.hasPrevious) emit('previous')
  else if (event.key === 'ArrowRight' && props.hasNext) emit('next')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="name"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-4xl rounded-xl bg-dark-800 border border-dark-600 shadow-2xl">
      <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-dark-700">
        <p class="text-white font-medium truncate">{{ name }}</p>
        <button
          class="p-1 text-dark-400 hover:text-white"
          :aria-label="t('common.close')"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Checkerboard shows the transparency of WebM animations -->
      <div class="preview-stage flex items-center justify-center p-4 min-h-[240px]">
        <!-- :key makes the element reload when switching files -->
        <video
          v-if="kind === 'video'"
          :key="url"
          :src="url"
          class="max-h-[65vh] max-w-full"
          controls
          autoplay
          loop
          playsinline
        />
        <img v-else-if="kind === 'image'" :key="url" :src="url" :alt="name" class="max-h-[65vh] max-w-full" />
        <audio v-else-if="kind === 'audio'" :key="url" :src="url" class="w-full max-w-lg" controls autoplay />
        <p v-else class="text-dark-400">{{ name }}</p>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-dark-700">
        <button
          class="px-3 py-2 rounded-lg text-sm text-dark-200 hover:text-white disabled:opacity-30"
          :disabled="!hasPrevious"
          @click="emit('previous')"
        >
          ‹ {{ t('media.previous') }}
        </button>
        <div class="flex gap-2">
          <button class="px-3 py-2 rounded-lg text-sm bg-dark-700 text-white hover:bg-dark-600" @click="emit('copy')">
            {{ t('media.copyUrl') }}
          </button>
          <button class="px-3 py-2 rounded-lg text-sm bg-red-600/20 text-red-300 hover:bg-red-600/30" @click="emit('delete')">
            {{ t('common.delete') }}
          </button>
        </div>
        <button
          class="px-3 py-2 rounded-lg text-sm text-dark-200 hover:text-white disabled:opacity-30"
          :disabled="!hasNext"
          @click="emit('next')"
        >
          {{ t('media.next') }} ›
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-stage {
  background-color: #2a2a35;
  background-image:
    linear-gradient(45deg, #3a3a48 25%, transparent 25%),
    linear-gradient(-45deg, #3a3a48 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3a3a48 75%),
    linear-gradient(-45deg, transparent 75%, #3a3a48 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
</style>
