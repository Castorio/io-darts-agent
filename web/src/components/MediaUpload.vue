<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api } from '../api/client'
import BaseButton from './BaseButton.vue'

interface MediaFile {
  name: string
  filename: string
  url: string
  size: number
  type: string
  folder?: string
}

interface MediaFolder {
  name: string
  path: string
  fileCount: number
}

const props = defineProps<{
  modelValue: string
  mediaType?: 'animation' | 'sound' | 'image'
  accept?: string
  label?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Determine media type from accept prop or explicit mediaType
const mediaType = computed((): 'animation' | 'sound' | 'image' => {
  if (props.mediaType) return props.mediaType
  const accept = props.accept || ''
  if (accept.includes('audio/')) return 'sound'
  if (accept.includes('video/') || accept.includes('image/gif')) return 'animation'
  if (accept.includes('image/')) return 'image'
  return 'animation'
})
const acceptTypes = computed(() => props.accept || 'image/gif,video/mp4,video/webm')

const isUploading = ref(false)
const uploadProgress = ref(0)
const error = ref<string | null>(null)
const showMediaLibrary = ref(false)
const mediaFiles = ref<MediaFile[]>([])
const mediaFolders = ref<MediaFolder[]>([])
const currentFolder = ref<string | null>(null)
const isLoadingMedia = ref(false)

// Breadcrumb path
const breadcrumbs = computed(() => {
  if (!currentFolder.value) return []
  return currentFolder.value.split('/').map((part, index, arr) => ({
    name: part,
    path: arr.slice(0, index + 1).join('/'),
  }))
})

// Filtered folders in current directory
const currentFolders = computed(() => {
  if (!currentFolder.value) {
    // Root level - show top-level folders only
    return mediaFolders.value.filter((f) => !f.path.includes('/'))
  }
  // Show direct children of current folder
  const prefix = currentFolder.value + '/'
  return mediaFolders.value
    .filter((f) => f.path.startsWith(prefix) && !f.path.slice(prefix.length).includes('/'))
    .map((f) => ({
      ...f,
      name: f.path.slice(prefix.length),
    }))
})

// Files in current folder
const currentFiles = computed(() => {
  return mediaFiles.value.filter((f) => {
    if (!currentFolder.value) {
      return !f.folder
    }
    return f.folder === currentFolder.value
  })
})

// Determine if current value is a URL or uploaded file
const isExternalUrl = computed(() => {
  const value = props.modelValue
  if (!value) return false
  return value.startsWith('http://') || value.startsWith('https://')
})

const isUploadedFile = computed(() => {
  const value = props.modelValue
  if (!value) return false
  return value.startsWith('/api/media/') || value.startsWith('/media/')
})

const displayValue = computed(() => {
  const value = props.modelValue
  if (!value) return ''
  if (isUploadedFile.value) {
    // Extract filename from path
    return value.split('/').pop() || value
  }
  return value
})

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate file type
  const allowedTypes = acceptTypes.value.split(',').map((t) => t.trim())
  if (!allowedTypes.some((type) => file.type.match(type.replace('*', '.*')))) {
    error.value = 'Ungültiger Dateityp. Erlaubt: GIF, MP4, WebM'
    return
  }

  // Validate file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    error.value = 'Datei zu groß. Maximum: 50MB'
    return
  }

  isUploading.value = true
  error.value = null
  uploadProgress.value = 0

  try {
    // Upload to current folder if in media library
    const folder = showMediaLibrary.value ? currentFolder.value || undefined : undefined
    const result = await api.uploadMedia(file, mediaType.value, folder)
    if (result.success) {
      emit('update:modelValue', result.url)
      // Reload media library if open
      if (showMediaLibrary.value) {
        await loadMediaLibrary()
      }
    } else {
      error.value = result.error || 'Upload fehlgeschlagen'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload fehlgeschlagen'
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    // Reset input
    input.value = ''
  }
}

async function loadMediaLibrary() {
  showMediaLibrary.value = true
  isLoadingMedia.value = true
  error.value = null

  try {
    // Load all files recursively
    const result = await api.listMedia(mediaType.value, { recursive: true })
    if (result.success) {
      mediaFiles.value = result.files.map((f) => ({
        name: f.name,
        filename: f.filename || f.name,
        url: f.url,
        size: f.size,
        type: f.type,
        folder: f.folder,
      }))
    }

    // Load folders
    const foldersResult = await api.listMediaFolders(mediaType.value)
    mediaFolders.value = foldersResult.folders || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden'
  } finally {
    isLoadingMedia.value = false
  }
}

function navigateToFolder(folderPath: string | null) {
  currentFolder.value = folderPath
}

function selectMediaFile(file: MediaFile) {
  emit('update:modelValue', file.url)
  showMediaLibrary.value = false
}

async function deleteMediaFile(file: MediaFile) {
  try {
    await api.deleteMedia(mediaType.value, file.filename, file.folder)
    mediaFiles.value = mediaFiles.value.filter((f) => f.filename !== file.filename)
    // Clear value if deleted file was selected
    if (props.modelValue === file.url) {
      emit('update:modelValue', '')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen'
  }
}

function clearValue() {
  emit('update:modelValue', '')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Reset folder navigation when modal closes
watch(showMediaLibrary, (open) => {
  if (!open) {
    currentFolder.value = null
  }
})
</script>

<template>
  <div class="space-y-2">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-dark-200">
      {{ label }}
    </label>

    <!-- Input with upload button -->
    <div class="flex gap-2">
      <div class="flex-1 relative">
        <input
          type="text"
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          :placeholder="placeholder || 'URL eingeben oder Datei hochladen'"
          class="w-full px-4 py-2.5 pr-10 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
        />
        <!-- Clear button -->
        <button
          v-if="modelValue"
          type="button"
          @click="clearValue"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Upload button -->
      <label
        :class="[
          'px-4 py-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2',
          isUploading
            ? 'bg-dark-700 border-dark-600 cursor-wait'
            : 'bg-dark-700 border-dark-600 hover:bg-dark-600 hover:border-dark-500',
        ]"
      >
        <input
          type="file"
          :accept="acceptTypes"
          class="hidden"
          :disabled="isUploading"
          @change="handleFileSelect"
        />
        <svg v-if="!isUploading" class="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <svg v-else class="w-5 h-5 text-dark-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span class="text-dark-200 text-sm">{{ isUploading ? 'Lädt...' : 'Upload' }}</span>
      </label>

      <!-- Media library button -->
      <button
        type="button"
        @click="loadMediaLibrary"
        class="px-4 py-2.5 rounded-lg bg-dark-700 border border-dark-600 hover:bg-dark-600 hover:border-dark-500 transition-all flex items-center gap-2"
      >
        <svg class="w-5 h-5 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-dark-200 text-sm hidden sm:inline">Mediathek</span>
      </button>
    </div>

    <!-- Preview -->
    <div v-if="modelValue" class="mt-3">
      <div class="p-3 rounded-lg bg-dark-700/50 border border-dark-600">
        <div class="flex items-center gap-3">
          <!-- Thumbnail -->
          <div class="w-16 h-16 rounded-lg bg-dark-800 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              v-if="modelValue.match(/\.(gif|png|jpg|jpeg|webp)$/i)"
              :src="modelValue"
              alt="Preview"
              class="w-full h-full object-cover"
              @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <video
              v-else-if="modelValue.match(/\.(mp4|webm|mov)$/i)"
              :src="modelValue"
              class="w-full h-full object-cover"
              muted
            />
            <svg v-else class="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">{{ displayValue }}</p>
            <p class="text-xs text-dark-400 mt-0.5">
              {{ isExternalUrl ? 'Externe URL' : isUploadedFile ? 'Hochgeladene Datei' : 'URL' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

    <!-- Media Library Modal -->
    <Teleport to="body">
      <div
        v-if="showMediaLibrary"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="showMediaLibrary = false"
        />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-white">Mediathek</h3>
            <button
              @click="showMediaLibrary = false"
              class="p-2 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <svg class="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Breadcrumb Navigation -->
          <div class="flex items-center gap-2 text-sm mb-4 pb-3 border-b border-dark-700">
            <button
              @click="navigateToFolder(null)"
              :class="[
                'flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-700 transition-colors',
                !currentFolder ? 'text-white' : 'text-dark-400 hover:text-white',
              ]"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Root
            </button>

            <template v-for="crumb in breadcrumbs" :key="crumb.path">
              <span class="text-dark-600">/</span>
              <button
                @click="navigateToFolder(crumb.path)"
                :class="[
                  'px-2 py-1 rounded hover:bg-dark-700 transition-colors',
                  crumb.path === currentFolder ? 'text-white' : 'text-dark-400 hover:text-white',
                ]"
              >
                {{ crumb.name }}
              </button>
            </template>
          </div>

          <!-- Loading -->
          <div v-if="isLoadingMedia" class="flex-1 flex items-center justify-center py-12">
            <svg class="w-8 h-8 text-autodarts-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>

          <!-- Empty state (no folders and no files) -->
          <div v-else-if="currentFolders.length === 0 && currentFiles.length === 0" class="flex-1 flex flex-col items-center justify-center py-12">
            <svg class="w-16 h-16 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-dark-400 mt-4">{{ currentFolder ? 'Dieser Ordner ist leer' : 'Noch keine Medien hochgeladen' }}</p>
            <p class="text-dark-500 text-sm mt-1">Nutze den Upload-Button um Dateien hinzuzufügen</p>
          </div>

          <!-- Content -->
          <div v-else class="flex-1 overflow-y-auto space-y-4">
            <!-- Folders -->
            <div v-if="currentFolders.length > 0">
              <h4 class="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">Ordner</h4>
              <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                <button
                  v-for="folder in currentFolders"
                  :key="folder.path"
                  @click="navigateToFolder(folder.path)"
                  class="flex flex-col items-center p-3 rounded-lg bg-dark-700/50 border border-dark-600 hover:border-dark-500 hover:bg-dark-700 transition-all text-center"
                >
                  <svg class="w-8 h-8 text-autodarts-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span class="text-white text-xs truncate w-full">{{ folder.name }}</span>
                  <span class="text-dark-500 text-xs">{{ folder.fileCount }}</span>
                </button>
              </div>
            </div>

            <!-- Files -->
            <div v-if="currentFiles.length > 0">
              <h4 class="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">Dateien</h4>
              <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <div
                  v-for="file in currentFiles"
                  :key="file.filename"
                  class="group relative aspect-square rounded-lg overflow-hidden bg-dark-700 border-2 transition-all cursor-pointer"
                  :class="modelValue === file.url ? 'border-autodarts-500' : 'border-transparent hover:border-dark-500'"
                  @click="selectMediaFile(file)"
                >
                  <!-- Thumbnail -->
                  <img
                    v-if="file.type?.startsWith('image/')"
                    :src="file.url"
                    :alt="file.name"
                    class="w-full h-full object-cover"
                  />
                  <video
                    v-else-if="file.type?.startsWith('video/')"
                    :src="file.url"
                    class="w-full h-full object-cover"
                    muted
                    @mouseenter="($event.target as HTMLVideoElement).play()"
                    @mouseleave="($event.target as HTMLVideoElement).pause()"
                  />
                  <div
                    v-else-if="file.type?.startsWith('audio/')"
                    class="w-full h-full flex items-center justify-center bg-dark-700"
                  >
                    <svg class="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center"
                  >
                    <svg class="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>

                  <!-- Overlay with info -->
                  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="absolute bottom-0 left-0 right-0 p-2">
                      <p class="text-white text-xs truncate">{{ file.name }}</p>
                      <p class="text-dark-400 text-xs">{{ formatFileSize(file.size) }}</p>
                    </div>
                  </div>

                  <!-- Delete button -->
                  <button
                    type="button"
                    @click.stop="deleteMediaFile(file)"
                    class="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <!-- Selected indicator -->
                  <div
                    v-if="modelValue === file.url"
                    class="absolute top-2 left-2 p-1 rounded-full bg-autodarts-500"
                  >
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Upload new button -->
          <div class="mt-4 pt-4 border-t border-dark-700 flex justify-between items-center">
            <label class="flex items-center gap-2 px-4 py-2 rounded-lg bg-autodarts-600 hover:bg-autodarts-500 transition-colors cursor-pointer">
              <input
                type="file"
                :accept="acceptTypes"
                class="hidden"
                @change="handleFileSelect"
              />
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span class="text-white font-medium text-sm">
                {{ currentFolder ? `In "${currentFolder.split('/').pop()}" hochladen` : 'Neue Datei hochladen' }}
              </span>
            </label>
            <BaseButton variant="ghost" @click="showMediaLibrary = false">
              Schließen
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
