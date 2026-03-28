<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'
import BaseInput from './BaseInput.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import { PLAYER_COLORS, PLAYER_AVATARS } from '../types/player'
import type { Player, CreatePlayerRequest, UpdatePlayerRequest } from '../types/player'

const { t } = useI18n()

interface Props {
  show: boolean
  player?: Player | null
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<{
  close: []
  save: [data: CreatePlayerRequest | UpdatePlayerRequest]
  delete: [id: string]
}>()

// Form state
const name = ref('')
const color = ref<string>(PLAYER_COLORS[0])
const avatar = ref<string>('default')
const autodartsUserId = ref('')
const showDeleteConfirm = ref(false)

// Computed
const isEdit = computed(() => !!props.player)
const title = computed(() => (isEdit.value ? t('players.editPlayer') : t('players.addPlayer')))

const isValid = computed(() => name.value.trim().length >= 2)

// Watch for player changes
watch(
  () => props.player,
  (player) => {
    if (player) {
      name.value = player.name
      color.value = player.color
      avatar.value = player.avatar || 'default'
      autodartsUserId.value = player.autodartsUserId || ''
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.show,
  (show) => {
    if (show && !props.player) {
      resetForm()
    }
    showDeleteConfirm.value = false
  }
)

function resetForm() {
  name.value = ''
  color.value = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)] as string
  avatar.value = 'default'
  autodartsUserId.value = ''
}

function handleSave() {
  if (!isValid.value) return

  const data: CreatePlayerRequest | UpdatePlayerRequest = {
    name: name.value.trim(),
    color: color.value,
    avatar: avatar.value === 'default' ? undefined : avatar.value,
    autodartsUserId: autodartsUserId.value.trim() || undefined,
  }

  emit('save', data)
}

function handleDelete() {
  if (props.player) {
    emit('delete', props.player.id)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Overlay -->
      <div
        class="absolute inset-0 bg-black/70"
        @click="$emit('close')"
      />

      <!-- Modal -->
      <div class="relative bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 class="text-xl font-bold text-white">{{ title }}</h2>
          <button
            @click="$emit('close')"
            class="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Preview -->
          <div class="flex items-center justify-center">
            <PlayerAvatar
              :name="name || '?'"
              :color="color"
              :avatar="avatar === 'default' ? undefined : avatar"
              size="xl"
            />
          </div>

          <!-- Name -->
          <BaseInput
            v-model="name"
            :label="t('players.playerName')"
            :placeholder="t('players.playerNamePlaceholder')"
            required
          />

          <!-- Color Selection -->
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-3">{{ t('players.color') }}</label>
            <div class="grid grid-cols-9 gap-2">
              <button
                v-for="c in PLAYER_COLORS"
                :key="c"
                type="button"
                @click="color = c as string"
                :class="[
                  'w-8 h-8 rounded-full transition-transform hover:scale-110',
                  color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110' : '',
                ]"
                :style="{ backgroundColor: c }"
              />
            </div>
          </div>

          <!-- Avatar Selection -->
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-3">{{ t('players.avatar') }}</label>
            <div class="grid grid-cols-8 gap-2">
              <button
                v-for="a in PLAYER_AVATARS"
                :key="a"
                type="button"
                @click="avatar = a"
                :class="[
                  'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                  avatar === a
                    ? 'bg-autodarts-600 ring-2 ring-autodarts-400'
                    : 'bg-dark-700 hover:bg-dark-600',
                ]"
              >
                <!-- Default (initials) -->
                <span v-if="a === 'default'" class="text-sm font-bold text-white">Aa</span>
                <!-- Dart -->
                <svg v-else-if="a === 'dart'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.83L18.17 12 12 18.17 5.83 12 12 5.83z"/>
                </svg>
                <!-- Bullseye -->
                <svg v-else-if="a === 'bullseye'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                <!-- Trophy -->
                <svg v-else-if="a === 'trophy'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                </svg>
                <!-- Star -->
                <svg v-else-if="a === 'star'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <!-- Crown -->
                <svg v-else-if="a === 'crown'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                </svg>
                <!-- Fire -->
                <svg v-else-if="a === 'fire'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
                </svg>
                <!-- Bolt -->
                <svg v-else-if="a === 'bolt'" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Autodarts User ID (optional) -->
          <BaseInput
            v-model="autodartsUserId"
            :label="t('players.autodartsUserId')"
            :placeholder="t('players.autodartsUserIdPlaceholder')"
          />
          <p class="text-sm text-dark-400 -mt-4">
            {{ t('players.autodartsLinkDescription') }}
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-6 border-t border-dark-700">
          <!-- Delete Button (only in edit mode) -->
          <div>
            <BaseButton
              v-if="isEdit && !showDeleteConfirm"
              variant="danger"
              @click="showDeleteConfirm = true"
            >
              {{ t('common.delete') }}
            </BaseButton>
            <div v-else-if="showDeleteConfirm" class="flex items-center gap-2">
              <span class="text-sm text-red-400">{{ t('players.confirmDelete') }}</span>
              <BaseButton
                variant="danger"
                size="sm"
                :loading="isLoading"
                @click="handleDelete"
              >
                {{ t('common.yes') }}
              </BaseButton>
              <BaseButton
                variant="ghost"
                size="sm"
                @click="showDeleteConfirm = false"
              >
                {{ t('common.no') }}
              </BaseButton>
            </div>
          </div>

          <!-- Save/Cancel -->
          <div class="flex items-center gap-3">
            <BaseButton variant="ghost" @click="$emit('close')">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton
              :loading="isLoading"
              :disabled="!isValid"
              @click="handleSave"
            >
              {{ isEdit ? t('common.save') : t('common.create') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
