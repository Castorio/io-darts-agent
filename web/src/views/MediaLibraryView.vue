<script setup lang="ts">
import { copyText } from '../lib/clipboard'
import { onMounted, ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

const { t } = useI18n()

type MediaType = 'animation' | 'sound' | 'image'

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
  createdAt: string
}

// State
const activeTab = ref<MediaType>('animation')
const mediaFiles = ref<MediaFile[]>([])
const folders = ref<MediaFolder[]>([])
const currentFolder = ref<string | null>(null)
const isLoading = ref(false)
const isUploading = ref(false)
const error = ref<string | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const searchQuery = ref('')

// Folder management
const showCreateFolderModal = ref(false)
const newFolderName = ref('')
const isCreatingFolder = ref(false)

// Tabs
const tabs: { key: MediaType; icon: string }[] = [
  { key: 'animation', icon: 'video' },
  { key: 'sound', icon: 'audio' },
  { key: 'image', icon: 'image' },
]

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
    return folders.value.filter((f) => !f.path.includes('/'))
  }
  // Show direct children of current folder
  const prefix = currentFolder.value + '/'
  return folders.value
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

// Filtered files based on search
const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return currentFiles.value
  const query = searchQuery.value.toLowerCase()
  return currentFiles.value.filter((file) => file.name.toLowerCase().includes(query))
})

// Filtered folders based on search
const filteredFolders = computed(() => {
  if (!searchQuery.value.trim()) return currentFolders.value
  const query = searchQuery.value.toLowerCase()
  return currentFolders.value.filter((folder) => folder.name.toLowerCase().includes(query))
})

// Get MIME type from filename extension
function getMimeTypeFromName(name: string): string {
  if (!name) return 'unknown'
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'gif':
      return 'image/gif'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'mp4':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'ogg':
      return 'audio/ogg'
    default:
      return 'unknown'
  }
}

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

// Load media files and folders
async function loadMedia() {
  isLoading.value = true
  error.value = null

  try {
    // Load all files recursively
    const result = await api.listMedia(activeTab.value, { recursive: true })
    if (result.success) {
      mediaFiles.value = result.files
        .filter((f) => f && f.name)
        .map((f) => ({
          name: f.name || 'unknown',
          filename: f.filename || f.name || 'unknown',
          url: f.url || '',
          size: f.size || 0,
          type: f.type || getMimeTypeFromName(f.name),
          folder: f.folder,
        }))
    }

    // Load folders
    const foldersResult = await api.listMediaFolders(activeTab.value)
    folders.value = foldersResult.folders || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('media.loadError')
  } finally {
    isLoading.value = false
  }
}

// Navigate to folder
function navigateToFolder(folderPath: string | null) {
  currentFolder.value = folderPath
  searchQuery.value = ''
}


// Create folder
async function createFolder() {
  if (!newFolderName.value.trim()) return

  isCreatingFolder.value = true
  try {
    const folderPath = currentFolder.value
      ? `${currentFolder.value}/${newFolderName.value.trim()}`
      : newFolderName.value.trim()

    const result = await api.createMediaFolder(activeTab.value, folderPath)
    if (result.success) {
      message.value = { type: 'success', text: t('media.folderCreated') }
      await loadMedia()
      showCreateFolderModal.value = false
      newFolderName.value = ''
    } else {
      message.value = { type: 'error', text: result.error || t('media.folderCreateError') }
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('media.folderCreateError'),
    }
  } finally {
    isCreatingFolder.value = false
    setTimeout(() => {
      message.value = null
    }, 3000)
  }
}

// Delete folder
async function deleteFolder(folder: MediaFolder) {
  if (!confirm(t('media.confirmDeleteFolder', { name: folder.name }))) return

  try {
    const result = await api.deleteMediaFolder(activeTab.value, folder.path)
    if (result.success) {
      message.value = { type: 'success', text: t('media.folderDeleted') }
      await loadMedia()
    } else {
      message.value = { type: 'error', text: result.error || t('media.folderDeleteError') }
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('media.folderDeleteError'),
    }
  }

  setTimeout(() => {
    message.value = null
  }, 3000)
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
        const result = await api.uploadMedia(file, activeTab.value, currentFolder.value || undefined)
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
    const result = await api.deleteMedia(activeTab.value, file.filename, file.folder)
    if (result.success) {
      mediaFiles.value = mediaFiles.value.filter((f) => f.filename !== file.filename)
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
  const copied = await copyText(window.location.origin + url)
  message.value = copied
    ? { type: 'success', text: t('media.urlCopied') }
    : { type: 'error', text: t('media.copyError') }

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
  currentFolder.value = null
  loadMedia()
}

// Load initial data
onMounted(() => {
  loadMedia()
})

// Reload when tab changes
watch(activeTab, () => {
  currentFolder.value = null
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
        <div class="flex items-center gap-2">
          <!-- Create Folder Button -->
          <BaseButton variant="secondary" @click="showCreateFolderModal = true">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            {{ t('media.newFolder') }}
          </BaseButton>

          <!-- Upload Button -->
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
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
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
          <svg v-if="tab.icon === 'video'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <!-- Audio Icon -->
          <svg v-else-if="tab.icon === 'audio'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <!-- Image Icon -->
          <svg v-else-if="tab.icon === 'image'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ t(`media.tabs.${tab.key}`) }}
        </button>
      </div>

      <!-- Breadcrumb Navigation -->
      <div class="flex items-center gap-2 text-sm">
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
          {{ t('media.root') }}
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

      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <!-- Error State -->
      <BaseCard v-else-if="error">
        <div class="text-center py-8">
          <svg class="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">{{ t('common.error') }}</h3>
          <p class="text-dark-400 mt-2">{{ error }}</p>
          <BaseButton class="mt-4" @click="loadMedia">
            {{ t('common.refresh') }}
          </BaseButton>
        </div>
      </BaseCard>

      <!-- Content -->
      <template v-else>
        <!-- Empty State -->
        <BaseCard v-if="filteredFolders.length === 0 && filteredFiles.length === 0">
          <div class="text-center py-12">
            <svg class="w-16 h-16 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 class="text-lg font-medium text-white mt-4">{{ t('media.noFiles') }}</h3>
            <p class="text-dark-400 mt-2 max-w-md mx-auto">
              {{ currentFolder ? t('media.noFilesInFolder') : t('media.noFilesDescription') }}
            </p>
            <div class="flex items-center justify-center gap-3 mt-6">
              <BaseButton variant="secondary" @click="showCreateFolderModal = true">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {{ t('media.newFolder') }}
              </BaseButton>
              <label class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-autodarts-600 hover:bg-autodarts-500 cursor-pointer transition-colors">
                <input type="file" :accept="acceptTypes" multiple class="hidden" @change="handleFileUpload" />
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="text-white font-medium">{{ t('media.uploadFirst') }}</span>
              </label>
            </div>
          </div>
        </BaseCard>

        <!-- Folders and Files Grid -->
        <div v-else>
          <!-- Folders -->
          <div v-if="filteredFolders.length > 0" class="mb-6">
            <h3 class="text-sm font-medium text-dark-400 mb-3">{{ t('media.folders') }}</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div
                v-for="folder in filteredFolders"
                :key="folder.path"
                class="group relative flex flex-col items-center p-4 rounded-xl bg-dark-800 border border-dark-700 hover:border-dark-500 cursor-pointer transition-all"
                @click="navigateToFolder(folder.path)"
              >
                <svg class="w-12 h-12 text-autodarts-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p class="text-white text-sm font-medium truncate w-full text-center">{{ folder.name }}</p>
                <p class="text-dark-500 text-xs">{{ folder.fileCount }} {{ t('media.files') }}</p>

                <!-- Delete button -->
                <button
                  v-if="folder.fileCount === 0"
                  @click.stop="deleteFolder(folder)"
                  class="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-700 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-all"
                  :title="t('common.delete')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Files -->
          <div v-if="filteredFiles.length > 0">
            <h3 class="text-sm font-medium text-dark-400 mb-3">{{ t('media.files') }}</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div
                v-for="file in filteredFiles"
                :key="file.filename"
                class="group relative aspect-square rounded-xl overflow-hidden bg-dark-800 border border-dark-700 hover:border-dark-500 transition-all"
              >
                <!-- Thumbnail -->
                <img
                  v-if="file.type?.startsWith('image/') || file.name?.endsWith('.gif')"
                  :src="file.url"
                  :alt="file.name"
                  class="w-full h-full object-cover"
                />
                <video
                  v-else-if="file.type?.startsWith('video/') || file.name?.endsWith('.webm') || file.name?.endsWith('.mp4')"
                  :src="file.url"
                  class="w-full h-full object-cover"
                  muted
                  loop
                  @mouseenter="($event.target as HTMLVideoElement).play()"
                  @mouseleave="($event.target as HTMLVideoElement).pause()"
                />
                <div
                  v-else-if="file.type?.startsWith('audio/') || file.name?.endsWith('.mp3') || file.name?.endsWith('.wav')"
                  class="w-full h-full flex items-center justify-center bg-dark-700"
                >
                  <svg class="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div v-else class="w-full h-full flex items-center justify-center bg-dark-700">
                  <svg class="w-12 h-12 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      @click.stop="deleteFile(file)"
                      class="py-1.5 px-3 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                      :title="t('common.delete')"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Info Card -->
      <BaseCard :title="t('common.info')">
        <p class="text-dark-400 mb-4">{{ t('media.infoText') }}</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoAnimations') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoAnimationsDesc') }}</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoSounds') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoSoundsDesc') }}</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 class="text-white font-medium">{{ t('media.infoImages') }}</h4>
            <p class="text-sm text-dark-400 mt-1">{{ t('media.infoImagesDesc') }}</p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Create Folder Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateFolderModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/70" @click="showCreateFolderModal = false" />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-md w-full">
          <h3 class="text-lg font-semibold text-white mb-4">{{ t('media.createFolder') }}</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('media.folderName') }}</label>
              <BaseInput
                v-model="newFolderName"
                :placeholder="t('media.folderNamePlaceholder')"
                @keyup.enter="createFolder"
              />
              <p v-if="currentFolder" class="text-sm text-dark-400 mt-2">
                {{ t('media.folderPath') }}: {{ currentFolder }}/{{ newFolderName || '...' }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 mt-6">
            <BaseButton variant="ghost" @click="showCreateFolderModal = false">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton
              :disabled="!newFolderName.trim() || isCreatingFolder"
              :loading="isCreatingFolder"
              @click="createFolder"
            >
              {{ t('media.create') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
