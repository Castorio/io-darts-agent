<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()

type MediaType = 'animation' | 'sound' | 'image'

interface MediaFile {
  name: string
  url: string
  size: number
  type: string
  mimeType?: string
}

// State
const activeTab = ref<MediaType>('animation')
const mediaFiles = ref<MediaFile[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const error = ref<string | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const searchQuery = ref('')

// Tabs
const tabs: { key: MediaType; icon: string }[] = [
  { key: 'animation', icon: 'video' },
  { key: 'sound', icon: 'audio' },
  { key: 'image', icon: 'image' },
]

// Filtered files based on search
const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return mediaFiles.value
  const query = searchQuery.value.toLowerCase()
  return mediaFiles.value.filter((file) => file.name.toLowerCase().includes(query))
})

// Get accept types for file input
const acceptTypes = computed(() => {
  switch (activeTab.value) {
    case 'animation':
      return 'image/gif,video/mp4,video/webm'
    case 'sound':
      return 'audio/mpeg,audio/wav,audio/ogg,audio/mp3'
    case 'image':
      return 'image/png,image/jpeg,image/webp,image/svg+xml'
    default:
      return '*/*'
  }
})

// Load media files for active tab
async function loadMedia() {
  isLoading.value = true
  error.value = null

  try {
    const result = await api.listMedia(activeTab.value)
    if (result.success) {
      mediaFiles.value = result.files.map((f) => ({
        name: f.name,
        url: f.url,
        size: f.size,
        type: f.type || 'unknown',
      }))
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('media.loadError')
  } finally {
    isLoading.value = false
  }
}

// Handle file upload
async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  isUploading.value = true
  error.value = null
  let successCount = 0
  let errorCount = 0

  try {
    for (const file of Array.from(files)) {
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        errorCount++
        continue
      }

      try {
        const result = await api.uploadMedia(file, activeTab.value)
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    if (successCount > 0) {
      message.value = {
        type: 'success',
        text: t('media.uploadSuccess', { count: successCount }),
      }
      await loadMedia()
    }

    if (errorCount > 0) {
      message.value = {
        type: 'error',
        text: t('media.uploadPartialError', { count: errorCount }),
      }
    }
  } finally {
    isUploading.value = false
    input.value = ''
    setTimeout(() => {
      message.value = null
    }, 5000)
  }
}

// Delete a file
async function deleteFile(file: MediaFile) {
  if (!confirm(t('media.confirmDelete', { name: file.name }))) return

  try {
    const result = await api.deleteMedia(activeTab.value, file.name)
    if (result.success) {
      mediaFiles.value = mediaFiles.value.filter((f) => f.name !== file.name)
      message.value = { type: 'success', text: t('media.deleteSuccess') }
    } else {
      message.value = { type: 'error', text: result.error || t('media.deleteError') }
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('media.deleteError'),
    }
  }

  setTimeout(() => {
    message.value = null
  }, 3000)
}

// Copy URL to clipboard
async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(window.location.origin + url)
    message.value = { type: 'success', text: t('media.urlCopied') }
  } catch {
    message.value = { type: 'error', text: t('media.copyError') }
  }

  setTimeout(() => {
    message.value = null
  }, 2000)
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Switch tab and reload media
function switchTab(tab: MediaType) {
  activeTab.value = tab
  loadMedia()
}

// Load initial data
onMounted(() => {
  loadMedia()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ t('media.title') }}</h1>
          <p class="text-dark-400">{{ t('media.subtitle') }}</p>
        </div>
        <label
          :class="[
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer transition-all',
            isUploading
              ? 'bg-dark-700 cursor-wait'
              : 'bg-autodarts-600 hover:bg-autodarts-500',
          ]"
        >
          <input
            type="file"
            :accept="acceptTypes"
            multiple
            class="hidden"
            :disabled="isUploading"
            @change="handleFileUpload"
          />
          <svg
            v-if="!isUploading"
            class="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <svg
            v-else
            class="w-5 h-5 text-white animate-spin"
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
          <span class="text-white font-medium">
            {{ isUploading ? t('media.uploading') : t('media.upload') }}
          </span>
        </label>
      </div>

      <!-- Message -->
      <div
        v-if="message"
        :class="[
          'p-4 rounded-lg',
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400',
        ]"
      >
        {{ message.text }}
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 border-b border-dark-700 pb-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="switchTab(tab.key)"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
            activeTab === tab.key
              ? 'bg-dark-700 text-white border-b-2 border-autodarts-500'
              : 'text-dark-400 hover:text-white hover:bg-dark-800',
          ]"
        >
          <!-- Video/Animation Icon -->
          <svg
            v-if="tab.icon === 'video'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <!-- Audio Icon -->
          <svg
            v-else-if="tab.icon === 'audio'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <!-- Image Icon -->
          <svg
            v-else-if="tab.icon === 'image'"
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
          {{ t(`media.tabs.${tab.key}`) }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('media.searchPlaceholder')"
          class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
        />
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <svg
          class="animate-spin h-8 w-8 text-autodarts-500"
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
      </div>

      <!-- Error State -->
      <BaseCard v-else-if="error">
        <div class="text-center py-8">
          <svg
            class="w-16 h-16 mx-auto text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">{{ t('common.error') }}</h3>
          <p class="text-dark-400 mt-2">{{ error }}</p>
          <BaseButton class="mt-4" @click="loadMedia">
            {{ t('common.refresh') }}
          </BaseButton>
        </div>
      </BaseCard>

      <!-- Empty State -->
      <BaseCard v-else-if="filteredFiles.length === 0">
        <div class="text-center py-12">
          <svg
            class="w-16 h-16 mx-auto text-dark-500"
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
          <h3 class="text-lg font-medium text-white mt-4">{{ t('media.noFiles') }}</h3>
          <p class="text-dark-400 mt-2 max-w-md mx-auto">
            {{ t('media.noFilesDescription') }}
          </p>
          <label
            class="inline-flex items-center gap-2 mt-6 px-4 py-2.5 rounded-lg bg-autodarts-600 hover:bg-autodarts-500 cursor-pointer transition-colors"
          >
            <input
              type="file"
              :accept="acceptTypes"
              multiple
              class="hidden"
              @change="handleFileUpload"
            />
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="text-white font-medium">{{ t('media.uploadFirst') }}</span>
          </label>
        </div>
      </BaseCard>

      <!-- Media Grid -->
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div
          v-for="file in filteredFiles"
          :key="file.name"
          class="group relative aspect-square rounded-xl overflow-hidden bg-dark-800 border border-dark-700 hover:border-dark-500 transition-all"
        >
          <!-- Thumbnail -->
          <img
            v-if="file.type.startsWith('image/') || file.name.endsWith('.gif')"
            :src="file.url"
            :alt="file.name"
            class="w-full h-full object-cover"
          />
          <video
            v-else-if="file.type.startsWith('video/')"
            :src="file.url"
            class="w-full h-full object-cover"
            muted
            loop
            @mouseenter="($event.target as HTMLVideoElement).play()"
            @mouseleave="($event.target as HTMLVideoElement).pause()"
          />
          <div
            v-else-if="file.type.startsWith('audio/')"
            class="w-full h-full flex items-center justify-center bg-dark-700"
          >
            <svg class="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <div
            v-else
            class="w-full h-full flex items-center justify-center bg-dark-700"
          >
            <svg class="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <!-- Overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
            <p class="text-white text-sm font-medium truncate">{{ file.name }}</p>
            <p class="text-dark-400 text-xs">{{ formatFileSize(file.size) }}</p>

            <!-- Actions -->
            <div class="flex gap-2 mt-2">
              <button
                @click.stop="copyUrl(file.url)"
                class="flex-1 py-1.5 rounded-lg bg-dark-600/80 hover:bg-dark-500 text-white text-xs font-medium transition-colors"
                :title="t('media.copyUrl')"
              >
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                @click.stop="deleteFile(file)"
                class="py-1.5 px-3 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                :title="t('common.delete')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Card -->
      <BaseCard :title="t('common.info')">
        <p class="text-dark-400 mb-4">{{ t('media.infoText') }}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoAnimations') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoAnimationsDesc') }}</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoSounds') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoSoundsDesc') }}</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoImages') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoImagesDesc') }}</p>
          </div>
        </div>
      </BaseCard>
    </div>
  </AppLayout>
</template>
